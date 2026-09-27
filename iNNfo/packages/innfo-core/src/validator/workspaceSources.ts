import type { RecursiveParseResult } from '../recursiveParser/types.js'
import type { ReferenceDiagnostic } from './references.js'
import { parseCsvTable } from '../csvTable.js'
import { parseKnowledgeQuery } from '../queryUnits.js'
import {
  SOURCE_FIELD_NAMES,
  CONFLICT_FIELD_NAMES,
  extractHeadings,
  normalizeName,
  parseKnowledgeUnitRef,
  parseSourceRef,
  splitSourceFieldValue,
  type SourceRef,
} from '../sourceRef.js'
import { listSectionFields, resolveUnit } from '../unitResolve.js'
import type { ModelNode } from '../types/index.js'
import type { TemplateSchema } from '../schema/index.js'
import { findDeclaredField } from '../schema/index.js'

export interface SourceResolution {
  exists: boolean
  headings?: string[]
  content?: string
  parentExists?: boolean
  suggestions?: string[]
}

/**
 * Host-supplied callback that resolves a workspace-relative source path
 * (`sources/nn/<path>.md`, `sources/nn/<path>.csv`, or `models/<path>.md`) to
 * whether the file exists and, when cheap to compute, its heading slugs and/or
 * raw content (content unlocks row/column/field checks and precise `@` suggestions).
 *
 * - Node host (`innfo-mcp`): read the file from disk, return
 *   `extractHeadings(content).map(h => h.slug)` plus the content itself.
 * - Browser host (`innfo-editor`): look the file up in the in-memory workspace.
 *
 * Returning `null` is equivalent to `{ exists: false }`. Unit checks degrade to
 * file-existence-only when neither `headings` nor `content` is supplied.
 */
export type SourceResolver = (
  refPath: string,
  referringPath?: string,
) => SourceResolution | null

/**
 * Validates every `sources::` / `source::` Citation across the parsed workspace.
 *
 * Runs after the host's `recursiveParse()`. Complements — never replaces —
 * per-file `validateModel`/`validateDocument`, which do not open other files.
 *
 * Two grammars, one pass: `@` pointers are validated structurally (codes `KU_*`);
 * legacy `#slug` references keep their historical diagnostics plus a timeline-neutral
 * `KU_DEPRECATED_HASH` warning suggesting the canonical `@` form.
 *
 * Severities (codes stable for tests):
 * - `error KU_MALFORMED` — unparseable value on a declared source field.
 * - `error KU_DANGLING_FILE` — the referenced file is not present in the workspace.
 * - `warning KU_UNKNOWN_SLUG` — the file resolves but the slug matches no heading.
 * - `warning KU_DEPRECATED_HASH` — legacy `#slug` form (suggests `@` canonical).
 * - `error KU_UNKNOWN_ROW` / `KU_UNKNOWN_COLUMN` — CSV key/column absent.
 * - `error KU_FIELD_OUTSIDE_SECTION` — `&field` absent from the pointed section.
 * - `error KU_UNKNOWN_MATRIX_CELL` — matrix `&row&col` does not resolve.
 * - `error KU_DUPLICATE_KEY` / `KU_EMPTY_KEY` — CSV key-column integrity (once per file).
 */
/**
 * Whether `fieldName` on an element of concept `conceptType` carries a
 * citation (AD-5).
 *
 * The DECLARED type wins: a field the template declares `citation` is checked
 * whatever it is called, and a field it declares as anything else is not —
 * which is what stops `documentation`'s `source:: <content path>` from being
 * misdiagnosed as a broken citation.
 *
 * Name matching against `SOURCE_FIELD_NAMES` remains ONLY as the fallback for
 * a model whose template schema did not resolve (no resolver supplied, an
 * offline workspace, a concept the template never declared). Without that
 * fallback this change could not land without migrating every template in the
 * same commit.
 */
function isCitationField(
  fieldName: string,
  conceptType: string | undefined,
  schema: TemplateSchema | undefined,
): boolean {
  const declared = findDeclaredField(schema, conceptType, fieldName)
  if (declared) return declared.type === 'citation'
  return SOURCE_FIELD_NAMES.has(fieldName.toLowerCase())
}

/**
 * Whether `fieldName` is the reserved `conflicts` property (design D5). This
 * is a RESERVED NAME check, deliberately independent of `isCitationField`'s
 * declared-type resolution: `conflicts::` values follow the same KU_*
 * validation path as `sources::`, but must NEVER be added to
 * `SOURCE_FIELD_NAMES` or fed into `recursiveParser/normalize.ts`'s
 * `node.sources` / `origin: 'source'` relationship-edge construction. The
 * reserved name wins over any declared field type.
 */
function isConflictField(fieldName: string): boolean {
  return CONFLICT_FIELD_NAMES.has(fieldName.toLowerCase())
}

/**
 * Trigger pairs for the deprecated read-only legacy derivation keys (design
 * D3): `(any concept, derived_from_inputs)` and `(Models, derived_from)`.
 * The warning fires ONLY when the resolved schema declares the concept but
 * not the field — so the frozen cogNNitive schema (which declares
 * `ModelRecords`, not `Models`) and an unresolved schema both stay silent.
 */
const LEGACY_DERIVATION_FIELD_NAMES = new Set(['derived_from', 'derived_from_inputs'])

function legacyDerivationKeyFor(
  fieldName: string,
  conceptType: string | undefined,
  schema: TemplateSchema | undefined,
): string | undefined {
  const lower = fieldName.toLowerCase()
  if (!LEGACY_DERIVATION_FIELD_NAMES.has(lower)) return undefined
  if (!schema || !conceptType) return undefined
  const concept = schema.concepts.find((c) => c.name.toLowerCase() === conceptType.toLowerCase())
  if (!concept) return undefined
  // Declares the concept but NOT the field — that is the trigger condition.
  const declaresField = concept.fields?.some((f) => f.name.toLowerCase() === lower)
  if (declaresField) return undefined
  return fieldName
}

export function validateWorkspaceSources(
  result: RecursiveParseResult,
  resolver: SourceResolver,
): ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = []
  const checkedCsvKeys = new Set<string>()

  /** The composed template schema of the document this node belongs to, if any.
   *  `recursiveParse` stashes it on the root node, so no host plumbing is
   *  needed here — walk up to the root and read it. */
  const schemaFor = (node: ModelNode): TemplateSchema | undefined => {
    let current: ModelNode | undefined = node
    while (current) {
      if (current.templateSchema) return current.templateSchema
      current = current.parentId ? result.nodes[current.parentId] : undefined
    }
    return undefined
  }

  for (const node of Object.values(result.nodes)) {
    if (node.kind !== 'element') continue
    const schema = schemaFor(node)

    for (const [fieldName, fv] of Object.entries(node.fields)) {
      const isConflict = isConflictField(fieldName)
      const legacyKey = legacyDerivationKeyFor(fieldName, node.type, schema)

      if (legacyKey) {
        const path = `${node.source.path}#${node.name}.${fieldName}`
        diagnostics.push({
          path,
          message: `"${legacyKey}" is deprecated — write "sources::" (pointer list); lineage is computed`,
          severity: 'warning',
          code: 'LEGACY_DERIVATION_KEY',
        })
      }

      // The reserved `conflicts` name wins over any declared field type
      // (design D5) — a conflicts:: field is checked here even when the
      // schema does not declare it `type:: citation`.
      if (!isConflict && !isCitationField(fieldName, node.type, schema)) continue

      const path = `${node.source.path}#${node.name}.${fieldName}`
      let sawValidConflictPointer = false

      for (const value of splitSourceFieldValue(fv.value)) {
        // Queries select sets for retrieval tools — never a valid citation.
        // This check precedes both parsers so the message stays specific.
        if (value.includes('?') && parseKnowledgeQuery(value)) {
          diagnostics.push({
            path,
            message: `Queries are not valid citations: "${value}" selects a set, not a unit — resolve it to pointers first (e.g. run it as a query, then cite the resulting "@" references)`,
            severity: 'error',
            code: 'QU_NOT_PROVENANCE',
          })
          continue
        }

        const unitRef = parseKnowledgeUnitRef(value)
        if (unitRef?.unit) {
          const before = diagnostics.length
          validateUnitPointer(
            unitRef,
            node.source.path,
            path,
            resolver,
            diagnostics,
            checkedCsvKeys,
          )
          if (isConflict && !diagnostics.slice(before).some((d) => d.severity === 'error')) {
            sawValidConflictPointer = true
          }
          continue
        }

        const ref = parseSourceRef(value)
        if (!ref) {
          diagnostics.push({
            path,
            message: `Malformed source reference "${value}" — use "<path>@<unit>" (e.g. "file.md@## Section", "data.csv@104"); line ranges like #L10-L20 and src-NNN ids are not allowed, and sources/original/ is not citable`,
            severity: 'error',
            code: 'KU_MALFORMED',
          })
          continue
        }

        const resolved = resolver(ref.filePath, node.source.path)
        if (!resolved || !resolved.exists) {
          diagnostics.push({
            path,
            message: formatDanglingMessage(ref, resolved),
            severity: 'error',
            code: 'KU_DANGLING_FILE',
          })
          continue
        }

        if (isConflict) sawValidConflictPointer = true

        if (ref.slug && resolved.headings && !resolved.headings.includes(ref.slug)) {
          diagnostics.push({
            path,
            message: `Source reference "${ref.raw}" points at heading "#${ref.slug}" which does not exist in "${ref.fileName}"`,
            severity: 'warning',
            code: 'KU_UNKNOWN_SLUG',
          })
        }

        diagnostics.push({
          path,
          message: `Legacy "#slug" form is deprecated — prefer "@" pointers${suggestCanonical(resolved, ref)}`,
          severity: 'warning',
          code: 'KU_DEPRECATED_HASH',
        })
      }

      if (isConflict && sawValidConflictPointer) {
        diagnostics.push({
          path,
          message: `Element "${node.name}" flags a conflict via "conflicts::" — review and record the resolution in "rationale::"`,
          severity: 'warning',
          code: 'SRC_CONFLICT_FLAGGED',
        })
      }
    }
  }

  return diagnostics
}

function formatDanglingMessage(ref: SourceRef, resolved?: SourceResolution | null): string {
  let msg = `Dangling source reference: "${ref.filePath}" is not present in this workspace`
  if (resolved?.parentExists === false) {
    msg += ' (parent directory does not exist)'
  } else if (resolved?.suggestions && resolved.suggestions.length > 0) {
    msg += ` — did you mean '${resolved.suggestions[0]}'?`
  }
  return msg
}

function suggestCanonical(
  resolved: { headings?: string[]; content?: string },
  ref: { filePath: string; slug?: string },
): string {
  if (ref.slug && resolved.content) {
    const found = extractHeadings(resolved.content).find((h) => h.slug === ref.slug)
    if (found) return ` (e.g. "${ref.filePath}@${'#'.repeat(found.level)}${found.slug}")`
  }
  return ` (e.g. "${ref.filePath}@## Section")`
}

function validateUnitPointer(
  ref: SourceRef,
  referringPath: string,
  path: string,
  resolver: SourceResolver,
  diagnostics: ReferenceDiagnostic[],
  checkedCsvKeys: Set<string>,
): void {
  const unit = ref.unit!
  const subunits = ref.subunits ?? []
  const resolved = resolver(ref.filePath, referringPath)
  if (!resolved || !resolved.exists) {
    diagnostics.push({
      path,
      message: formatDanglingMessage(ref, resolved),
      severity: 'error',
      code: 'KU_DANGLING_FILE',
    })
    return
  }
  if (unit.kind === 'header') {
    validateHeaderUnit(ref, unit.slug, unit.level, subunits, resolved, path, diagnostics)
  } else {
    validateRowUnit(ref, unit.id, subunits, resolved, path, diagnostics, checkedCsvKeys)
  }
}

function validateHeaderUnit(
  ref: SourceRef,
  slug: string,
  level: number,
  subunits: string[],
  resolved: { headings?: string[]; content?: string },
  path: string,
  diagnostics: ReferenceDiagnostic[],
): void {
  const headings =
    resolved.headings ??
    (resolved.content ? extractHeadings(resolved.content).map((h) => h.slug) : undefined)
  const heading = resolved.content
    ? extractHeadings(resolved.content).find((h) => h.slug === slug)
    : undefined
  if (headings && !headings.includes(slug)) {
    diagnostics.push({
      path,
      message: `Source reference "${ref.raw}" points at heading "@${slug}" which does not exist in "${ref.fileName}"`,
      severity: 'warning',
      code: 'KU_UNKNOWN_SLUG',
    })
    return
  }
  if (subunits.length === 0) return
  if (subunits.length === 1) {
    const fields =
      resolved.content && heading ? listSectionFieldsFor(resolved.content, heading) : undefined
    if (fields === undefined) return // Degraded: no content to check fields against.
    if (!fields.includes(normalizeName(subunits[0]))) {
      diagnostics.push({
        path,
        message: `Source reference "${ref.raw}" points at field "&${subunits[0]}" which does not exist in section "@${slug}" of "${ref.fileName}"`,
        severity: 'error',
        code: 'KU_FIELD_OUTSIDE_SECTION',
      })
    }
    return
  }
  if (subunits.length === 2) {
    if (!resolved.content) return // Degraded: no content to resolve the cell against.
    if (!resolveUnit(resolved.content, ref)) {
      diagnostics.push({
        path,
        message: `Source reference "${ref.raw}" points at matrix cell "&${subunits[0]}&${subunits[1]}" which does not resolve in "${ref.fileName}"`,
        severity: 'error',
        code: 'KU_UNKNOWN_MATRIX_CELL',
      })
    }
    return
  }
  diagnostics.push({
    path,
    message: `Malformed source reference "${ref.raw}" — a header pointer takes at most one field (&field) or one matrix cell (&row&column)`,
    severity: 'error',
    code: 'KU_MALFORMED',
  })
}

function validateRowUnit(
  ref: SourceRef,
  id: string,
  subunits: string[],
  resolved: { content?: string },
  path: string,
  diagnostics: ReferenceDiagnostic[],
  checkedCsvKeys: Set<string>,
): void {
  if (!resolved.content) return // Degraded: file-existence-only without content.
  const table = parseCsvTable(resolved.content)
  if (table.malformed) {
    diagnostics.push({
      path,
      message: `Source file "${ref.filePath}" cannot be parsed as CSV`,
      severity: 'error',
      code: 'KU_MALFORMED',
    })
    return
  }
  if (!checkedCsvKeys.has(ref.filePath)) {
    checkedCsvKeys.add(ref.filePath)
    const keys = table.rows.map((r) => (r[0] ?? '').trim())
    const seen = new Set<string>()
    for (const key of keys) {
      if (key === '') {
        diagnostics.push({
          path,
          message: `Source file "${ref.filePath}" has a row with an empty key in the first column`,
          severity: 'error',
          code: 'KU_EMPTY_KEY',
        })
      } else if (seen.has(key)) {
        diagnostics.push({
          path,
          message: `Source file "${ref.filePath}" has duplicate key "${key}" in the first column`,
          severity: 'error',
          code: 'KU_DUPLICATE_KEY',
        })
      }
      seen.add(key)
    }
  }
  const rowIdx = table.rows.findIndex((r) => (r[0] ?? '').trim() === id.trim())
  if (rowIdx === -1) {
    diagnostics.push({
      path,
      message: `Source reference "${ref.raw}" points at row "@${id}" which does not exist in "${ref.fileName}"`,
      severity: 'error',
      code: 'KU_UNKNOWN_ROW',
    })
    return
  }
  if (subunits.length === 0) return
  if (subunits.length > 1) {
    diagnostics.push({
      path,
      message: `Malformed source reference "${ref.raw}" — a CSV row takes at most one column (&column)`,
      severity: 'error',
      code: 'KU_MALFORMED',
    })
    return
  }
  if (!table.headers.includes(normalizeName(subunits[0]))) {
    diagnostics.push({
      path,
      message: `Source reference "${ref.raw}" points at column "&${subunits[0]}" which does not exist in "${ref.fileName}"`,
      severity: 'error',
      code: 'KU_UNKNOWN_COLUMN',
    })
  }
}

function listSectionFieldsFor(content: string, heading: { slug: string }): string[] | undefined {
  const fields = listSectionFields(content, heading.slug)
  return fields ?? undefined
}
