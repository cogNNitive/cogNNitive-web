import type { Concept, ParsedKnowledge } from '../types/index.js'
import { normalizeSeparators } from '../parser/slug.js'
import { conceptsByElementName, IMPLICIT_REF_FIELDS } from './elementIndex.js'
import { matchesTargetBlueprint } from './templateMatching.js'

export interface ReferenceDiagnostic {
  path: string
  message: string
  severity: 'error' | 'warning'
  /** Stable machine-readable code (e.g. `KU_UNKNOWN_ROW`). Tests assert codes, not prose. */
  code?: string
  /** Inline fix hint naming the canonical form or repair step. Survives the
   *  `Diagnostics` accumulator and the model/document report mapping. */
  promptHint?: string
  /** Structured context for reporters (paths, template names, urls). */
  meta?: Record<string, unknown>
}

/**
 * Synchronous callback supplied by host environments (Node MCP or Browser Editor)
 * to resolve submodel files and inspect their template identities.
 */
export type SubmodelResolver = (
  refPath: string,
  referringPath?: string,
) => { exists: boolean; templateName?: string; templateUrl?: string } | null

/** Collect all element names model-wide (lowercased for case-insensitive matching). */
function collectElementNames(model: ParsedKnowledge): Set<string> {
  const names = new Set<string>()
  for (const [, elements] of model.elements.entries()) {
    for (const el of elements) {
      names.add(el.name.toLowerCase())
    }
  }
  return names
}

/**
 * Map from separator-normalized + lowercased element name -> original element
 * name, used as a fallback lookup when an exact (case-insensitive) match
 * fails, to tolerate hyphen/dash typographic variants (Fix 3).
 */
function collectNormalizedElementNames(model: ParsedKnowledge): Map<string, string> {
  const names = new Map<string, string>()
  for (const [, elements] of model.elements.entries()) {
    for (const el of elements) {
      const key = normalizeSeparators(el.name.toLowerCase())
      if (!names.has(key)) names.set(key, el.name)
    }
  }
  return names
}

/**
 * Resolves a reference value against the known element names. Returns the
 * exact-match result when found; otherwise falls back to a separator-
 * normalized match (hyphen vs en/em dash/minus) and flags it as inexact so
 * callers can emit a WARNING instead of treating it as a clean match.
 */
function resolveElementName(
  value: string,
  elementNames: Set<string>,
  normalizedElementNames: Map<string, string>,
): { found: boolean; exact: boolean; matchedName?: string } {
  const lower = value.toLowerCase()
  if (elementNames.has(lower)) return { found: true, exact: true }
  const normalizedMatch = normalizedElementNames.get(normalizeSeparators(lower))
  if (normalizedMatch) return { found: true, exact: false, matchedName: normalizedMatch }
  return { found: false, exact: false }
}

/**
 * Validate that all references in matrix cells point to existing element names.
 * Returns diagnostics for dangling references (R-IE-04).
 */
export function validateReferences(model: ParsedKnowledge): ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = []
  const elementNames = collectElementNames(model)
  const normalizedElementNames = collectNormalizedElementNames(model)

  for (const matrix of model.matrices) {
    for (const cell of matrix.cells) {
      if (cell.row) {
        const resolved = resolveElementName(cell.row, elementNames, normalizedElementNames)
        if (!resolved.found) {
          diagnostics.push({
            path: `matrices.${matrix.name}.row`,
            message: `Dangling reference: matrix "${matrix.name}" row "${cell.row}" does not match any element name`,
            severity: 'error',
          })
        } else if (!resolved.exact) {
          diagnostics.push({
            path: `matrices.${matrix.name}.row`,
            message: `Matrix reference "${cell.row}" doesn't exactly match element "${resolved.matchedName}" — separator character differs (hyphen vs dash). Consider using the exact same character.`,
            severity: 'warning',
          })
        }
      }
      if (cell.col) {
        const resolved = resolveElementName(cell.col, elementNames, normalizedElementNames)
        if (!resolved.found) {
          diagnostics.push({
            path: `matrices.${matrix.name}.col`,
            message: `Dangling reference: matrix "${matrix.name}" column "${cell.col}" does not match any element name`,
            severity: 'error',
          })
        } else if (!resolved.exact) {
          diagnostics.push({
            path: `matrices.${matrix.name}.col`,
            message: `Matrix reference "${cell.col}" doesn't exactly match element "${resolved.matchedName}" — separator character differs (hyphen vs dash). Consider using the exact same character.`,
            severity: 'warning',
          })
        }
      }
    }
  }

  return diagnostics
}

/**
 * Validate that element fields declared as `reference` in the template point
 * to existing element names (model-wide, case-insensitive). When the field
 * declares `target_concepts`, the resolved element's owning concept(s) must
 * be among them (R-IE-04).
 */
export function validateElementFieldReferences(
  model: ParsedKnowledge,
  templateConcepts: Concept[],
  options?: {
    resolveSubmodel?: SubmodelResolver
    referringPath?: string
  },
): ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = []
  const elementNames = collectElementNames(model)
  const conceptsByElement = conceptsByElementName(model)

  for (const [conceptName, elements] of model.elements.entries()) {
    const conceptDef = templateConcepts.find(
      (c) => c.name.toLowerCase() === conceptName.toLowerCase(),
    )
    const fieldDefs = conceptDef?.fields ?? []

    for (const el of elements) {
      for (const fieldName of Object.keys(el.fields)) {
        const fieldDef = fieldDefs.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())

        const isRef =
            (fieldDef && (fieldDef.type === 'reference' || fieldDef.type === 'knowledge')) ||
          IMPLICIT_REF_FIELDS.has(fieldName.toLowerCase())
        if (!isRef) continue

        const raw = el.fields[fieldName]
        if (raw === undefined || raw === null || raw === '') continue

        const refs = Array.isArray(raw) ? raw.map(String) : [String(raw)]
        for (const ref of refs) {
          const rawValue = ref.trim()
          if (!rawValue) continue

          // Clean reference syntax: [[Name]] -> Name. Skip qualified cross-model references.
          let value = rawValue
          if (value.startsWith('[[') && value.endsWith(']]')) {
            value = value.slice(2, -2).trim()
          }

          if (fieldDef?.type === 'knowledge') {
            const cleanPath = value.trim()
            if (options?.resolveSubmodel) {
              const res = options.resolveSubmodel(cleanPath, options.referringPath)
              if (res) {
                if (!res.exists) {
                  diagnostics.push({
                    path: `elements.${conceptName}.${el.name}.fields.${fieldDef?.name ?? fieldName}`,
                    message: `Dangling submodel reference: field "${fieldDef?.name ?? fieldName}" references file "${cleanPath}" which does not exist`,
                    severity: 'warning',
                    code: 'SUBMODEL_NOT_FOUND',
                    promptHint: `Create the file "${cleanPath}" or fix the path in field "${fieldDef?.name ?? fieldName}".`,
                    meta: { refPath: cleanPath, field: fieldDef?.name ?? fieldName },
                  })
                } else if (fieldDef.target_blueprint) {
                  const matches = matchesTargetBlueprint(fieldDef.target_blueprint, {
                    name: res.templateName,
                    url: res.templateUrl,
                  })

                  if (!matches) {
                    const actualLabel = res.templateName || res.templateUrl || 'unknown'
                    diagnostics.push({
                      path: `elements.${conceptName}.${el.name}.fields.${fieldDef?.name ?? fieldName}`,
                      message: `Submodel template mismatch: field "${fieldDef?.name ?? fieldName}" expects template "${fieldDef.target_blueprint}", but referenced file "${cleanPath}" uses template "${actualLabel}"`,
                      severity: 'warning',
                      code: 'SUBMODEL_TEMPLATE_MISMATCH',
                      promptHint: `Field "${fieldDef?.name ?? fieldName}" expects template "${fieldDef.target_blueprint}" but "${cleanPath}" uses "${actualLabel}": update target_blueprint or fix parent_spec in the referenced file.`,
                      meta: {
                        expectedTemplate: fieldDef.target_blueprint,
                        actualBlueprint: actualLabel,
                        refPath: cleanPath,
                      },
                    })
                  }
                }
              }
            }
            continue
          }

          let isCrossModel = false
          if (value.startsWith('[') && value.includes(']')) {
            isCrossModel = true
          } else if (value.includes('::')) {
            isCrossModel = true
          }

          if (isCrossModel) {
            // Deliberate delegation, not an omission (AD-06): the qualified
            // form `[[Model Title :: Element Name]]` is validated
            // workspace-wide by validator/workspaceReferences.ts, which is
            // the only pass that can see sibling models. This per-file
            // validator stays graph-free by design and keeps bypassing any
            // `::`/`[...]`-shaped value exactly as before.
            continue
          }

          if (!elementNames.has(value.toLowerCase())) {
            diagnostics.push({
              path: `elements.${conceptName}.${el.name}.fields.${fieldDef?.name ?? fieldName}`,
              message: `Dangling reference: field "${fieldDef?.name ?? fieldName}" value "${rawValue}" does not match any element name`,
              severity: 'error',
            })
            continue
          }

          if (fieldDef?.target_concepts && fieldDef.target_concepts.length > 0) {
            const owningConcepts = conceptsByElement.get(value.toLowerCase()) ?? new Set<string>()
            const allowed = fieldDef.target_concepts.map((c) => c.toLowerCase())
            const allowedMatch = [...owningConcepts].some((c) => allowed.includes(c.toLowerCase()))
            if (!allowedMatch) {
              diagnostics.push({
                path: `elements.${conceptName}.${el.name}.fields.${fieldDef.name}`,
                message: `Reference "${rawValue}" in field "${fieldDef.name}" resolves to element "${value}" but that element belongs to concept(s) "${[...owningConcepts].join(', ')}" which is not in target_concepts of the field`,
                severity: 'error',
              })
            }
          }
        }
      }
    }
  }

  return diagnostics
}
