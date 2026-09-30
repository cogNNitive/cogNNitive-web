import type { Concept, ValidationError } from '../types/index.js'
import { parseKnowledge } from '../parser/index.js'
import {
  CONCEPT_DEFINITION,
  FIELD_DEFINITION,
  MARKER_DEFINITION,
  MATRIX_DEFINITION,
  asObject,
  asString,
  extractBlueprintSchema,
} from './extract.js'

/* ── Metaschema (Self-Description) ──────────────────────────────
 *
 * The level-1 iNNfo spec carries, under its "## Metaschema (Self-Description)"
 * section, a fenced ```markdown block that expresses the four root primitives
 * in iNNfo's own syntax. `validateBlueprintAgainstMetaschema` resolves that
 * block and checks a level-2 template's `… Definition` elements against it —
 * the same code path (`extractBlueprintSchema` + per-Field checks) used to
 * validate a level-3 Model against its level-2 Template.
 */

/**
 * Pull the fenced ```markdown block that follows the "The Metaschema" heading
 * inside the level-1 iNNfo spec content. Returns null when absent.
 */
export function extractMetaschema(specContent: string): string | null {
  const anchor = specContent.search(/^#{1,6}\s+The Metaschema\s*$/m)
  const region = anchor >= 0 ? specContent.slice(anchor) : specContent
  const fence = region.match(/```(?:markdown|md)?\s*\n([\s\S]*?)\n```/)
  return fence ? fence[1] : null
}

/** Field names REQUIRED on each primitive — transcribed from the "(required)"
 *  markers in the iNNfo spec's Metaschema section (source of truth). */
const REQUIRED_BY_PRIMITIVE: Record<string, string[]> = {
  [CONCEPT_DEFINITION]: ['type'],
  [FIELD_DEFINITION]: ['concept', 'type'],
  [MARKER_DEFINITION]: [],
  [MATRIX_DEFINITION]: ['source', 'target'],
}

export interface SchemaCheckOptions {
  /** How to report a property no Field Definition declares. Default `warning`. */
  unknownProperty?: 'error' | 'warning' | 'ignore'
  /** `<concept name>` → field names that MUST be present on every element. */
  requiredByConcept?: Record<string, string[]>
  /** Also flag element groups whose Concept is absent from the schema. */
  reportUnknownConcept?: boolean
}

/**
 * The one property/enum conformance pass shared by every level boundary.
 * Given element groups (`Concept name` → elements) and a resolved schema
 * (`Concept[]` with their `fields`), it reports:
 *   - properties not declared by any Field Definition of the owning Concept,
 *   - values outside a `select` Field's `options`,
 *   - missing required properties.
 * Level-2-against-L1 (primitive elements vs the metaschema) and
 * level-3-against-L2 (model elements vs the template) call this with the same
 * signature — they differ only in which schema is passed. Reference and
 * matrix-cell checks are model-only and layered on top by `validateKnowledge`.
 */
export function checkElementsAgainstSchema(
  elementGroups: Iterable<[string, Array<{ name: string; fields: Record<string, unknown> }>]>,
  concepts: Concept[],
  opts: SchemaCheckOptions = {},
): ValidationError[] {
  const unknownProperty = opts.unknownProperty ?? 'warning'
  const conceptByName = new Map(concepts.map((c) => [c.name.toLowerCase(), c]))
  const diagnostics: ValidationError[] = []

  for (const [conceptName, elements] of elementGroups) {
    const def = conceptByName.get(conceptName.toLowerCase())
    if (!def) {
      if (opts.reportUnknownConcept) {
        diagnostics.push({
          path: `${conceptName}`,
          message: `Concept "${conceptName}" is not defined in the schema`,
          severity: 'error',
        })
      }
      continue
    }
    const fieldByName = new Map((def.fields ?? []).map((f) => [f.name.toLowerCase(), f]))
    const required =
      opts.requiredByConcept?.[def.name] ?? opts.requiredByConcept?.[conceptName] ?? []

    for (const el of elements) {
      for (const key of required) {
        const v = el.fields[key]
        if (v === undefined || v === null || v === '') {
          diagnostics.push({
            path: `${def.name}.${el.name}.${key}`,
            message: `${def.name} "${el.name}" is missing required property "${key}"`,
            severity: 'error',
          })
        }
      }

      for (const [key, rawVal] of Object.entries(el.fields)) {
        const fieldDef = fieldByName.get(key.toLowerCase())
        if (!fieldDef) {
          if (unknownProperty !== 'ignore') {
            diagnostics.push({
              path: `${def.name}.${el.name}.${key}`,
              message: `Property "${key}" is not declared on ${def.name} in the schema`,
              severity: unknownProperty,
            })
          }
          continue
        }
        if (fieldDef.type === 'select' && fieldDef.options && fieldDef.options.length > 0) {
          const val = String(rawVal)
          if (!fieldDef.options.includes(val)) {
            diagnostics.push({
              path: `${def.name}.${el.name}.${key}`,
              message: `Invalid value "${val}" for "${key}". Allowed: ${fieldDef.options.join(', ')}`,
              severity: 'error',
            })
          }
        }
      }
    }
  }

  return diagnostics
}

/** Allowed `widget_config` keys per `widget` value (iNNfo "Widget Configuration"). */
const WIDGET_CONFIG_KEYS: Record<string, string[]> = {
  scale: ['min', 'max', 'step'],
  cycle: ['order'],
  set: ['max_selections'],
  text: ['max_length'],
  boolean: [],
}

/**
 * Validate the `widget` / `widget_config` pair on Marker/Matrix Definition
 * elements: unknown keys for the declared widget are WARNINGs, a `scale`
 * missing `min`/`max` is an ERROR, `widget_config` without `widget` is a
 * WARNING.
 */
export function checkWidgetConfig(
  elementGroups: Iterable<[string, Array<{ name: string; fields: Record<string, unknown> }>]>,
): ValidationError[] {
  const diagnostics: ValidationError[] = []
  for (const [primitive, elements] of elementGroups) {
    for (const el of elements) {
      const widget = asString(el.fields['widget'])
      const cfg = asObject(el.fields['widget_config'])
      if (!cfg) continue
      if (!widget) {
        diagnostics.push({
          path: `${primitive}.${el.name}.widget_config`,
          message: `"${el.name}" declares widget_config but no widget`,
          severity: 'warning',
        })
        continue
      }
      const allowed = WIDGET_CONFIG_KEYS[widget.toLowerCase()]
      if (!allowed) continue
      for (const key of Object.keys(cfg)) {
        if (!allowed.includes(key)) {
          diagnostics.push({
            path: `${primitive}.${el.name}.widget_config.${key}`,
            message: `"${key}" is not a widget_config key for widget "${widget}". Allowed: ${allowed.join(', ') || '(none)'}`,
            severity: 'warning',
          })
        }
      }
      if (widget.toLowerCase() === 'scale') {
        for (const req of ['min', 'max']) {
          if (cfg[req] === undefined || cfg[req] === null || cfg[req] === '') {
            diagnostics.push({
              path: `${primitive}.${el.name}.widget_config.${req}`,
              message: `widget "scale" requires widget_config.${req}`,
              severity: 'error',
            })
          }
        }
      }
    }
  }
  return diagnostics
}

/**
 * Validate a level-2 template's root-primitive elements against the level-1
 * metaschema. `metaschemaSpecContent` is the raw content of the resolved
 * level-1 iNNfo spec. Unknown properties are warnings; bad enum values and
 * missing required properties are errors. When the spec carries no resolvable
 * metaschema block, a single warning is returned and the check is skipped.
 */
export function validateBlueprintAgainstMetaschema(
  templateContent: string,
  metaschemaSpecContent: string,
): ValidationError[] {
  const metaMarkdown = extractMetaschema(metaschemaSpecContent)
  if (!metaMarkdown) {
    return [
      {
        path: 'metaschema',
        message:
          'Resolved level-1 spec has no "The Metaschema" block; template primitive validation skipped',
        severity: 'warning',
      },
    ]
  }

  const metaConcepts = extractBlueprintSchema(parseKnowledge(metaMarkdown)).concepts
  const template = parseKnowledge(templateContent)
  const groups: Array<[string, Array<{ name: string; fields: Record<string, unknown> }>]> = [
    CONCEPT_DEFINITION,
    FIELD_DEFINITION,
    MARKER_DEFINITION,
    MATRIX_DEFINITION,
  ].map((primitive) => [primitive, template.elements.get(primitive) ?? []])

  return [
    ...checkElementsAgainstSchema(groups, metaConcepts, {
      unknownProperty: 'warning',
      requiredByConcept: REQUIRED_BY_PRIMITIVE,
    }),
    ...checkWidgetConfig([
      [MARKER_DEFINITION, template.elements.get(MARKER_DEFINITION) ?? []],
      [MATRIX_DEFINITION, template.elements.get(MATRIX_DEFINITION) ?? []],
    ]),
  ]
}
