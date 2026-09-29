import type {
  Concept,
  ConceptField,
  Marker,
  MatrixDecl,
  ParsedModel,
  TaxonomyEdge,
} from '../types/index.js'
import { parseModel } from '../parser/index.js'

/**
 * Root primitives of the Metaplantilla Nivel 1 (V_0-1-0). A level-2 template
 * instantiates these four primitives as ordinary elements in its body, using
 * the unified syntax:
 *
 *   # NN Concept Definition
 *   ## NN Concept Definition: <Concept Name>
 *   type:: text
 *   weight:: 90
 *
 *   # NN Field Definition
 *   ## NN Field Definition: <Field Name>
 *   concept:: <Concept Name>
 *   type:: string
 *
 *   # NN Marker Definition
 *   ## NN Marker Definition: <Marker Name>
 *   symbol:: *
 *
 *   # NN Matrix Definition
 *   ## NN Matrix Definition: <Matrix Name>
 *   source:: A
 *   target:: B
 *   values:: [Max, High, Low]
 *
 * This module extracts a template's effective schema (concepts, markers,
 * matrices) from those elements. The legacy frontmatter blocks
 * (`concepts:` / `markers:` / `matrices:`) are still honoured when present.
 */

export const CONCEPT_DEFINITION = 'Concept Definition'
export const FIELD_DEFINITION = 'Field Definition'
export const MARKER_DEFINITION = 'Marker Definition'
export const MATRIX_DEFINITION = 'Matrix Definition'

export interface TemplateSchema {
  concepts: Concept[]
  markers: Marker[]
  matrices: MatrixDecl[]
  taxonomy: TaxonomyEdge[]
}

export function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function asStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String)
  return undefined
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v)
  return undefined
}

export function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

function cleanWikilink(v: unknown): string | undefined {
  const str = asString(v)
  if (!str) return undefined
  const trimmed = str.trim()
  if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
    const inner = trimmed.slice(2, -2).trim()
    return inner !== '' ? inner : undefined
  }
  return trimmed !== '' ? trimmed : undefined
}

/**
 * Extracts a template schema from a parsed document's body elements.
 * Returns empty arrays when the document does not instantiate the root
 * primitives (e.g. a plain level-3 model).
 */
export function extractTemplateSchema(parsed: ParsedModel): TemplateSchema {
  const concepts: Concept[] = []
  const fieldsByConcept = new Map<string, ConceptField[]>()

  for (const el of parsed.elements.get(CONCEPT_DEFINITION) ?? []) {
    const parent = cleanWikilink(el.fields['parent'])
    const concept: Concept = {
      name: el.name,
      parent,
      type: (asString(el.fields['type']) as Concept['type']) ?? 'text',
      icon: asString(el.fields['icon']),
      color: asString(el.fields['color']),
      weight: asNumber(el.fields['weight']),
    }
    concepts.push(concept)
    fieldsByConcept.set(concept.name, [])
  }

  for (const el of parsed.elements.get(FIELD_DEFINITION) ?? []) {
    const owner = asString(el.fields['concept'])
    if (!owner) continue
    const targetBlueprint = asString(el.fields['target_blueprint'])
    const targetTemplate = asString(el.fields['target_template'])
    const field: ConceptField = {
      name: el.name,
      type: (asString(el.fields['type']) as ConceptField['type']) ?? 'string',
      options: asStringArray(el.fields['options']),
      target_concepts: asStringArray(el.fields['target_concepts']),
      target_blueprint: targetBlueprint ?? targetTemplate,
      target_template: targetTemplate ?? targetBlueprint,
    }
    const list = fieldsByConcept.get(owner)
    if (list) {
      list.push(field)
    } else {
      fieldsByConcept.set(owner, [field])
    }
  }

  for (const concept of concepts) {
    const fields = fieldsByConcept.get(concept.name)
    if (fields && fields.length > 0) concept.fields = fields
  }

  const markers: Marker[] = (parsed.elements.get(MARKER_DEFINITION) ?? []).map((el) => {
    const marker: Marker = {
      name: el.name,
      symbol: asString(el.fields['symbol']),
      icon: asString(el.fields['icon']),
      color: asString(el.fields['color']),
      weight: asNumber(el.fields['weight']),
    }
    const appliesTo = asStringArray(el.fields['applies_to'])
    if (appliesTo) marker.applies_to = appliesTo
    const values = asStringArray(el.fields['values'])
    if (values) marker.values = values
    const widget = asString(el.fields['widget'])
    if (widget) marker.widgetType = widget
    const widgetConfig = asObject(el.fields['widget_config'])
    if (widgetConfig) marker.widgetConfig = widgetConfig
    return marker
  })

  const matrices: MatrixDecl[] = (parsed.elements.get(MATRIX_DEFINITION) ?? []).map((el) => {
    const values = asStringArray(el.fields['values'])
    const widget = asString(el.fields['widget']) ?? asString(el.fields['widgetType'])
    const decl: MatrixDecl = {
      name: el.name,
      source: asString(el.fields['source']) ?? '',
      target: asString(el.fields['target']) ?? '',
      params: '',
    }
    if (values) decl.values = values
    if (widget) decl.widgetType = widget as MatrixDecl['widgetType']
    const widgetConfig = asObject(el.fields['widget_config'])
    if (widgetConfig) decl.widgetConfig = widgetConfig
    const description = asString(el.fields['description'])
    if (description) decl.description = description
    return decl
  })

  let taxonomy: TaxonomyEdge[] = []
  const hasParentField = concepts.some((c) => c.parent !== undefined)
  if (hasParentField) {
    for (const concept of concepts) {
      taxonomy.push({
        parent: concept.parent ?? '',
        child: concept.name,
      })
    }
  } else {
    taxonomy = parsed.taxonomy
  }

  return { concepts, markers, matrices, taxonomy }
}

/**
 * Extracts a template schema from raw document content.
 * Templates instantiate the root primitives in their body; there is no
 * legacy frontmatter fallback.
 */
export function extractTemplateSchemaFromContent(content: string): TemplateSchema {
  return extractTemplateSchema(parseModel(content))
}
