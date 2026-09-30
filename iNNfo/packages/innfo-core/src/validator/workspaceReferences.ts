import type { ConceptField, KnowledgeNode } from '../types/index.js'
import type { RecursiveParseResult } from '../recursiveParser/types.js'
import type { WorkspaceIndex } from '../recursiveParser/workspaceIndex.js'
import type { ReferenceDiagnostic } from './references.js'
import { normalizeSeparators } from '../parser/slug.js'
import { stripMdSuffix, basename } from '../recursiveParser/paths.js'
import { matchesTargetBlueprint } from './blueprintMatching.js'

/**
 * `[[Model Title :: Element Name]]` — the ONLY cross-model reference form
 * (no `path#slug`, no bare `[[Element Name]]` across models). Only the
 * first `::` is treated as the title/element delimiter; everything after it
 * (including any further `::`) belongs to the element name.
 */
export const QUALIFIED_REF_RE = /^\[\[\s*([^\]]+?)\s*::\s*([^\]]+?)\s*\]\]$/

export interface QualifiedRef {
  modelTitle: string
  elementName: string
  raw: string
}

/**
 * Thrown when a workspace-scope validator is called without a resolvable
 * `WorkspaceIndex`. Without this guard, the missing-argument case surfaces as
 * a raw `TypeError: Cannot read properties of undefined (reading 'nodeSchema')`
 * from deep inside `iterateTypedFieldValues`, which gives the caller no hint
 * about what was actually missing or how to fix it.
 */
export class MissingWorkspaceIndexError extends Error {
  constructor() {
    super(
      'validateWorkspaceReferences requires a WorkspaceIndex. Build one with ' +
        '`buildWorkspaceIndex(result)` (from `recursiveParser/workspaceIndex`) and pass it as the ' +
        'second argument.',
    )
    this.name = 'MissingWorkspaceIndexError'
  }
}

/** Throws `MissingWorkspaceIndexError` when `index` is not a resolvable `WorkspaceIndex`. */
function assertWorkspaceIndex(index: WorkspaceIndex): asserts index is WorkspaceIndex {
  if (!index || typeof index !== 'object' || !('nodeSchema' in index)) {
    throw new MissingWorkspaceIndexError()
  }
}

/**
 * Stable code for non-canonical multivalue reference syntax. Frozen once
 * shipped: baseline fingerprints and tests assert this string, not prose.
 */
export const MULTIVALUE_SYNTAX_CODE = 'MULTIVALUE_SYNTAX'

/**
 * Splits one raw field value into its canonical multivalue tokens: a YAML
 * sequence already arrives as an array (one token per item); a scalar holds
 * one `[[Model Title :: Element Name]]` per line (newline-separated). Commas
 * NEVER split — `[[A :: x]], [[B :: y]]` is the observed footgun and fails
 * with `MULTIVALUE_SYNTAX` instead of resolving silently.
 */
export function splitCanonicalMultivalue(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

/** True when a scalar value comma-joins two `[[...]]` references on one line
 *  (e.g. `[[A :: x]], [[B :: y]]`) — the non-canonical multivalue form. */
export function isCommaJoinedMultivalue(value: string): boolean {
  return /\]\]\s*,\s*\[\[/.test(value)
}

/**
 * Parses a single field value as a qualified cross-model reference.
 * Returns `null` for anything else (unqualified `[[Element]]`, positional
 * `path#slug` syntax, bare text, etc.) — those stay the per-file validator's
 * job (`references.ts`, AD-06).
 */
export function parseQualifiedRef(value: string): QualifiedRef | null {
  const match = QUALIFIED_REF_RE.exec(value.trim())
  if (!match) return null
  const [, modelTitle, elementName] = match
  if (!modelTitle || !elementName) return null
  return { modelTitle, elementName, raw: value }
}

/** A typed-field value that parsed as a qualified reference, with everything `checkOne` needs. */
export interface QualifiedRefCandidate {
  /** The document root that owns `element` (walked up from `element.parentId`). */
  root: KnowledgeNode
  /** The element node whose field held the qualified reference. */
  element: KnowledgeNode
  /** The element's owning concept name (`element.type`). */
  concept: string
  /** The template's field definition that declared this value `reference`/`model` typed. */
  fieldDef: ConceptField
  ref: QualifiedRef
}

/** Walks `parentId` up from `node` until a `kind === 'root'` node is found. */
function findRootAncestor(result: RecursiveParseResult, node: KnowledgeNode): KnowledgeNode | undefined {
  const seen = new Set<string>()
  let current: KnowledgeNode | undefined = node
  while (current && current.kind !== 'root') {
    if (seen.has(current.id)) return undefined
    seen.add(current.id)
    current = current.parentId ? result.nodes[current.parentId] : undefined
  }
  return current
}

/** A `reference`/`model` typed field value on an element node, with everything
 *  workspace-scope passes need: the owning document root, the element, its
 *  concept name, the template field definition, and the raw stored value. */
interface TypedFieldValue {
  root: KnowledgeNode
  element: KnowledgeNode
  concept: string
  fieldDef: ConceptField
  raw: unknown
}

/**
 * Iterates every `reference`/`model` typed field value on every element node
 * whose document root has a resolvable template schema — the shared traversal
 * for candidate collection and multivalue-syntax validation, so both passes
 * agree on which values are in scope.
 */
function* iterateTypedFieldValues(
  result: RecursiveParseResult,
  index: WorkspaceIndex,
): Generator<TypedFieldValue> {
  assertWorkspaceIndex(index)

  for (const node of Object.values(result.nodes)) {
    if (node.kind !== 'element') continue

    const root = findRootAncestor(result, node)
    if (!root) continue

    const schema = index.nodeSchema[root.id]
    if (!schema) continue // no schema resolvable for this node's document => skip gracefully

    const concept = node.type
    const conceptDef = schema.concepts.find((c) => c.name.toLowerCase() === concept.toLowerCase())
    const fieldDefs = conceptDef?.fields ?? []

    for (const [fieldName, fieldValue] of Object.entries(node.fields)) {
      const fieldDef = fieldDefs.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())
      if (!fieldDef || (fieldDef.type !== 'reference' && fieldDef.type !== 'knowledge')) continue

      const raw = fieldValue.value
      if (raw === undefined || raw === null || raw === '') continue

      yield { root, element: node, concept, fieldDef, raw }
    }
  }
}

/**
 * AD-07: re-scans the values `normalizeElementsIntoGraph` already
 * materialized on `KnowledgeNode.fields` — zero additional parses. Iterates
 * every element node, resolves its owning document root and the root's
 * stashed/resolved `BlueprintSchema` (`index.nodeSchema`), and collects every
 * `reference`/`model` typed field value that parses as a qualified
 * cross-model reference (typed fields only, v1 — prose and untyped fields
 * are never scanned).
 */
export function collectQualifiedReferenceCandidates(
  result: RecursiveParseResult,
  index: WorkspaceIndex,
): QualifiedRefCandidate[] {
  const candidates: QualifiedRefCandidate[] = []

  for (const { root, element, concept, fieldDef, raw } of iterateTypedFieldValues(result, index)) {
    const values = Array.isArray(raw)
      ? raw.flatMap((v) => splitCanonicalMultivalue(String(v)))
      : splitCanonicalMultivalue(String(raw))
    for (const v of values) {
      const ref = parseQualifiedRef(String(v))
      if (!ref) continue // unqualified => the per-file validator's job (AD-06)
      candidates.push({ root, element, concept, fieldDef, ref })
    }
  }

  return candidates
}

/** Builds the `elements.<Concept>.<Element>.fields.<field>` diagnostic path, prefixed by the referring model's file path so a workspace-scope diagnostic is attributable to a file. */
function diagnosticPath(root: KnowledgeNode, concept: string, element: KnowledgeNode, fieldDef: ConceptField): string {
  return `${root.source.path}#elements.${concept}.${element.name}.fields.${fieldDef.name}`
}

/** Node id -> source file path, falling back to the id itself when the node can't be found. */
function pathForNodeId(id: string, result: RecursiveParseResult): string {
  return result.nodes[id]?.source?.path ?? id
}

/**
 * Resolution ladder (AD-05): `titleToNodeIds[t]` exact -> `fileNameToNodeIds[t]`
 * exact -> `titleToNodeIds[normalizeSeparators(t)]` -> `fileNameToNodeIds[normalizeSeparators(t)]`.
 * Stops at the first tier that produces any hit (whether 1 or many) — later
 * tiers are only tried when the current tier is completely empty.
 */
function resolveTargetModel(
  modelTitle: string,
  index: WorkspaceIndex,
): { nodeIds: string[]; exact: boolean } {
  const lower = modelTitle.trim().toLowerCase()
  const normalized = normalizeSeparators(lower)

  const exactTitle = index.titleToNodeIds[lower] ?? []
  if (exactTitle.length > 0) return { nodeIds: exactTitle, exact: true }

  const exactFile = index.fileNameToNodeIds[lower] ?? []
  if (exactFile.length > 0) return { nodeIds: exactFile, exact: true }

  const normalizedTitle = index.titleToNodeIds[normalized] ?? []
  if (normalizedTitle.length > 0) return { nodeIds: normalizedTitle, exact: false }

  const normalizedFile = index.fileNameToNodeIds[normalized] ?? []
  return { nodeIds: normalizedFile, exact: false }
}

/**
 * When `index.missing` (paths referenced but never parsed, `ParseIssue` code
 * `MODEL_NOT_FOUND`) contains a path whose basename matches the unresolved
 * target, returns a hint sentence to append to the dangling-model error.
 */
function missingFileHint(modelTitle: string, index: WorkspaceIndex): string {
  const target = normalizeSeparators(modelTitle.trim().toLowerCase())
  const hasMatch = index.missing.some((missingPath) => {
    const base = normalizeSeparators(stripMdSuffix(basename(missingPath)).toLowerCase())
    return base === target
  })
  return hasMatch ? ' (a reference to that file exists but the file was not found)' : ''
}

/**
 * Runs the four ordered checks for a single qualified reference: target
 * model exists, target element exists, concept membership, template
 * membership. Short-circuits after check 1 or 2 fails — checks 3 and 4 only
 * run once the target model and element both resolved.
 *
 * Severities are fixed by proposal decision 5: `error` for dangling
 * model/element and ambiguity; `warning` for concept mismatch, template
 * mismatch, and normalized-fallback matches.
 *
 * Duplicate-title errors are produced by `buildWorkspaceIndex` (PR4) and
 * surfaced by hosts from `index.issues`; this function never re-emits them —
 * it only reports *use-site* ambiguity (a specific reference resolving to
 * more than one model).
 */
function checkOne(
  root: KnowledgeNode,
  element: KnowledgeNode,
  concept: string,
  fieldDef: ConceptField,
  ref: QualifiedRef,
  index: WorkspaceIndex,
  result: RecursiveParseResult,
): ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = []
  const path = diagnosticPath(root, concept, element, fieldDef)

  // Check 1: target model exists.
  const { nodeIds, exact } = resolveTargetModel(ref.modelTitle, index)

  if (nodeIds.length === 0) {
    diagnostics.push({
      path,
      message: `Dangling cross-model reference: model "${ref.modelTitle}" is not present in this workspace${missingFileHint(ref.modelTitle, index)}`,
      severity: 'error',
    })
    return diagnostics
  }

  if (nodeIds.length > 1) {
    const paths = nodeIds.map((id) => pathForNodeId(id, result))
    diagnostics.push({
      path,
      message: `Ambiguous cross-model reference: model title "${ref.modelTitle}" matches ${nodeIds.length} models (${paths.join(', ')})`,
      severity: 'error',
    })
    return diagnostics
  }

  const targetId = nodeIds[0]

  if (!exact) {
    diagnostics.push({
      path,
      message: `Cross-model reference "${ref.raw}" matched model "${pathForNodeId(targetId, result)}" only after separator normalization`,
      severity: 'warning',
    })
  }

  // Check 2: target element exists.
  const elementConceptsForTarget = index.nodeElementConcepts[targetId] ?? {}
  const elementKey = ref.elementName.trim().toLowerCase()
  const normalizedElementKey = normalizeSeparators(elementKey)
  const exactOwners = elementConceptsForTarget[elementKey]
  const normalizedOwners = elementConceptsForTarget[normalizedElementKey]
  const owningConcepts = exactOwners ?? normalizedOwners

  if (!owningConcepts) {
    diagnostics.push({
      path,
      message: `Dangling cross-model reference: element "${ref.elementName}" does not exist in model "${ref.modelTitle}"`,
      severity: 'error',
    })
    return diagnostics
  }

  if (!exactOwners) {
    diagnostics.push({
      path,
      message: `Cross-model reference "${ref.raw}" matched element "${ref.elementName}" in model "${ref.modelTitle}" only after separator normalization`,
      severity: 'warning',
    })
  }

  // Check 3: concept membership.
  if (fieldDef.target_concepts && fieldDef.target_concepts.length > 0) {
    const allowed = fieldDef.target_concepts.map((c) => c.toLowerCase())
    const allowedMatch = owningConcepts.some((c) => allowed.includes(c.toLowerCase()))
    if (!allowedMatch) {
      diagnostics.push({
        path,
        message: `Cross-model reference "${ref.raw}" in field "${fieldDef.name}" resolves to element "${ref.elementName}" in model "${ref.modelTitle}" but that element belongs to concept(s) "${owningConcepts.join(', ')}" which is not in target_concepts of the field`,
        severity: 'warning',
      })
    }
  }

  // Check 4: template membership.
  if (fieldDef.target_blueprint) {
    const actualBlueprint = index.nodeBlueprint[targetId]
    const matches = actualBlueprint ? matchesTargetBlueprint(fieldDef.target_blueprint, actualBlueprint) : false
    if (!matches) {
      const actualLabel = actualBlueprint?.name ?? actualBlueprint?.url ?? 'unknown'
      diagnostics.push({
        path,
        message: `Cross-model reference "${ref.raw}" in field "${fieldDef.name}" expects template "${fieldDef.target_blueprint}", but model "${ref.modelTitle}" uses template "${actualLabel}"`,
        severity: 'warning',
      })
    }
  }

  return diagnostics
}

/**
 * Reports one `MULTIVALUE_SYNTAX` error per reference/`model` typed field
 * value that comma-joins qualified references (`[[A :: x]], [[B :: y]]`).
 * The hint migrates to the canonical form with the actual values, one per
 * line. Runs before resolution: a non-canonical value never resolves, so no
 * dangling/ambiguity noise is emitted alongside the syntax error.
 */
export function validateMultivalueSyntax(
  result: RecursiveParseResult,
  index: WorkspaceIndex,
): ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = []

  for (const { root, element, concept, fieldDef, raw } of iterateTypedFieldValues(result, index)) {
    const scalars = Array.isArray(raw) ? raw.map(String) : [String(raw)]
    for (const scalar of scalars) {
      if (!isCommaJoinedMultivalue(scalar)) continue
      const tokens = scalar
        .split(/\s*,\s*(?=\[\[)/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
      diagnostics.push({
        path: diagnosticPath(root, concept, element, fieldDef),
        message: `Non-canonical multivalue reference syntax in field "${fieldDef.name}": comma-joined values are not resolved; use a YAML sequence or one [[Model Title :: Element Name]] per line`,
        severity: 'error',
        code: MULTIVALUE_SYNTAX_CODE,
        promptHint: `Replace the comma-joined value with one reference per line or a YAML sequence, e.g.:\n${tokens.join('\n')}`,
        meta: { field: fieldDef.name, tokenCount: tokens.length },
      })
    }
  }

  return diagnostics
}

/**
 * Validates every qualified cross-model reference (`[[Model Title ::
 * Element Name]]`) found in `reference`/`model` typed element fields across
 * the whole parsed workspace. Must run after the host's own
 * `recursiveParse()` and `buildWorkspaceIndex()` — never in place of
 * per-file `validateDocument`/`validateKnowledge`, which deliberately bypasses
 * the qualified form (AD-06).
 */
export function validateWorkspaceReferences(
  result: RecursiveParseResult,
  index: WorkspaceIndex,
): ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [...validateMultivalueSyntax(result, index)]
  for (const candidate of collectQualifiedReferenceCandidates(result, index)) {
    diagnostics.push(
      ...checkOne(
        candidate.root,
        candidate.element,
        candidate.concept,
        candidate.fieldDef,
        candidate.ref,
        index,
        result,
      ),
    )
  }
  return diagnostics
}
