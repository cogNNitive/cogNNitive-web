import { parseKnowledge } from '../parser/index.js'
import type { ParsedKnowledge, KnowledgeNode } from '../types/index.js'
import { IdentityRegistry } from '../identity.js'
import { normalizeMatrixDecl } from '../matrix.js'
import { resolveGraphEdgeTarget } from './paths.js'
import { nowIso, toLocalMetamodel, toFieldValues, normalizeElementsIntoGraph } from './normalize.js'
import type { ParseContext, ParseIssue } from './types.js'

/**
 * Parses a single model file and registers its root node and elements into ctx.
 * Shared by the wikilink-driven path (index.md present) and the fallback path
 * (index.md missing — standalone _NN.md files).
 */
/**
 * Normalizes a single model content string, returning the parsed nodes and issues.
 *
 * @param content - Raw markdown contents of the model file
 * @param refPath - Source file path or URL of the model
 * @param refName - Derived name/identifier of the model (e.g. rootId)
 * @param identity - Optional identity registry for ID qualification
 * @returns An object containing the normalized KnowledgeNode records and parsed issues
 */
export function normalizeSingleKnowledge(
  content: string,
  refPath: string,
  refName: string,
  identity?: IdentityRegistry,
): { nodes: Record<string, KnowledgeNode>; issues: ParseIssue[] } {
  const resolvedIdentity = identity ?? new IdentityRegistry()
  const ctx: ParseContext = {
    nodes: {},
    identity: resolvedIdentity,
    issues: [],
  }

  let parsed: ParsedKnowledge
  try {
    parsed = parseKnowledge(content)
  } catch (err) {
    ctx.issues.push({
      path: refPath,
      message: err instanceof Error ? err.message : String(err),
    })
    return { nodes: ctx.nodes, issues: ctx.issues }
  }

  // Skip files without iNNfo frontmatter — not a model (§2.1).
  // When the filename follows the `_NN` convention, surface the problem so an
  // "empty folder" report isn't misleading: the file was found but could not
  // be parsed as a model (e.g. broken YAML delimiters).
  const fm = parsed.frontmatter
  const hasSpecVersion = typeof fm.spec_version === 'string' && fm.spec_version.length > 0
  const hasLevel = fm.level !== undefined
  const hasParent = !!(fm.parent || fm.parent_spec)

  if (!hasSpecVersion && !hasLevel && !hasParent) {
    const isNnNamed =
      refName.toLowerCase().endsWith('_nn') || refPath.toLowerCase().endsWith('_nn.md')
    if (isNnNamed) {
      ctx.issues.push({
        path: refPath,
        message:
          'File uses the _NN naming convention but has no valid iNNfo frontmatter (missing level, parent or spec_version) — skipped',
      })
    }
    return { nodes: ctx.nodes, issues: ctx.issues }
  }

  // Create root node for this model
  const qualifiedId = ctx.identity.register(null, refName)
  const rootNode: KnowledgeNode = {
    id: qualifiedId,
    name: refName,
    parentId: null,
    childIds: [],
    type: (parsed.frontmatter.title as string) || 'document',
    kind: 'root',
    fields: toFieldValues(parsed.frontmatter as Record<string, unknown>),
    markers: {},
    tags: [],
    conceptTags: parsed.conceptTags,
    relationships: [],
    rawSections: parsed.rawSections ?? {},
    rawContent: content,
    localMetamodel: toLocalMetamodel(parsed),
    sourceMode: 'parsed',
    source: { path: refPath },
  }

  // Parse graph_edges from frontmatter into relationships
  if (parsed.frontmatter.graph_edges) {
    const graphEdges = parsed.frontmatter.graph_edges as Array<{
      target: string
      label: string
      weight?: number
    }>
    for (const edge of graphEdges) {
      rootNode.relationships.push({
        targetId: resolveGraphEdgeTarget(edge.target, refPath),
        label: edge.label,
        value: edge.weight,
        origin: 'graph_edge',
      })
    }
  }

  // Store matrix definitions as __matrix_defs for UI components.
  // Priority: frontmatter `matrices` first (explicit declarations), then the
  // model's own `# NN matrices:` body blocks. The body-block fallback keeps the
  // matrices visible in the navigation tree even when the parent template could
  // not be resolved (source/target then come from the blocks or stay empty) —
  // the app renders them from model data with a warning instead of hiding them.
  const fmMatrices = (parsed.frontmatter as any)?.matrices
  if (Array.isArray(fmMatrices) && fmMatrices.length > 0) {
    rootNode.fields['__matrix_defs'] = {
      value: fmMatrices.map((m: any) => normalizeMatrixDecl(m)),
      editAttribution: { author: { kind: 'system', id: 'parser' }, timestamp: nowIso() },
    }
  } else if (parsed.matrices.length > 0) {
    rootNode.fields['__matrix_defs'] = {
      value: parsed.matrices.map((m) =>
        normalizeMatrixDecl({ name: m.name, source: m.source, target: m.target }),
      ),
      editAttribution: { author: { kind: 'system', id: 'parser' }, timestamp: nowIso() },
    }
  }

  ctx.nodes[qualifiedId] = rootNode

  // Surface slug collisions as warnings (R-IE-05)
  if (parsed.slugCollisions && parsed.slugCollisions.length > 0) {
    for (const sc of parsed.slugCollisions) {
      ctx.issues.push({
        path: refPath,
        message: `Slug collision: "${sc.slug}" is shared by elements: ${sc.elements.join(', ')}`,
      })
    }
  }

  // Normalize in-file elements
  normalizeElementsIntoGraph(parsed, qualifiedId, refPath, ctx)

  // Store matrix cell values as root node fields for MatricesGrid. Keys use the
  // stable qualified element id (`matrixName||<rowId>||<colId>`) so that two
  // same-named elements in different parents (different models in a workspace)
  // resolve to independent cells — display names would collapse them (E1).
  const idByElementName = new Map<string, string>()
  for (const node of Object.values(ctx.nodes)) {
    if (node.kind === 'element' && node.name) {
      idByElementName.set(node.name, node.id)
    }
  }
  for (const matrix of parsed.matrices) {
    const prefix = matrix.name + '||'
    for (const cell of matrix.cells) {
      if (cell.row && cell.col) {
        const rowId = idByElementName.get(cell.row)
        const colId = idByElementName.get(cell.col)
        if (rowId && colId) {
          rootNode.fields[prefix + rowId + '||' + colId] = {
            value: cell.value,
            editAttribution: { author: { kind: 'system', id: 'parser' }, timestamp: nowIso() },
          }
        }
      }
    }
  }

  return { nodes: ctx.nodes, issues: ctx.issues }
}

export async function parseAndRegisterKnowledge(
  content: string,
  refPath: string,
  refName: string,
  ctx: ParseContext,
  elementNameToModel: Map<string, string>,
): Promise<void> {
  let result: { nodes: Record<string, KnowledgeNode>; issues: ParseIssue[] }
  try {
    result = normalizeSingleKnowledge(content, refPath, refName, ctx.identity)
  } catch (err) {
    ctx.issues.push({
      path: refPath,
      message: err instanceof Error ? err.message : String(err),
    })
    return
  }

  // Merge resulting nodes and issues into context
  for (const [id, node] of Object.entries(result.nodes)) {
    ctx.nodes[id] = node
  }
  for (const issue of result.issues) {
    ctx.issues.push(issue)
  }

  // Track element names per model (FR-005). Shared identity across models is
  // LEGAL (AD-7 / shipped-sample-workspace R6) — the same person, place, or
  // concept can legitimately appear in more than one model in a workspace,
  // and `[[Model Title :: Element Name]]` is the disambiguation mechanism
  // the format already provides. Do NOT advise the user to rename; only
  // record an info-level note naming the qualified form. Intra-document
  // collisions are a different, still-enforced case (normalizeElementsIntoGraph
  // rejects them before this point).
  for (const node of Object.values(result.nodes)) {
    if (node.kind === 'element') {
      if (elementNameToModel.has(node.name)) {
        const existingModel = elementNameToModel.get(node.name)!
        ctx.issues.push({
          path: '<root>',
          severity: 'info',
          message: `Element "${node.name}" resolves across multiple models ("${existingModel}" and "${refName}"). Use "${existingModel} :: ${node.name}" or "${refName} :: ${node.name}" to address a specific one.`,
        })
      } else {
        elementNameToModel.set(node.name, refName)
      }
    }
  }
}
