import type {
  ElementNode,
  ParsedKnowledge,
  FieldValue,
  LocalMetamodel,
  KnowledgeNode,
  TaxonomyEdge,
} from '../types/index.js'
import { extractBlueprintSchema, findDeclaredField, type BlueprintSchema } from '../schema/index.js'
import { normalizeSeparators } from '../parser/slug.js'
import {
  SOURCE_FIELD_NAMES,
  parseKnowledgeUnitRef,
  parseSourceRef,
  splitSourceFieldValue,
  type SourceRef,
} from '../sourceRef.js'
import type { ParseContext } from './types.js'
import { addFieldAndMentionEdges } from './relationships.js'

/**
 * Reads a node's `sources`/`source` field, parses every value as a
 * {@link SourceRef}, and — when at least one parses — attaches `node.sources`
 * plus one `origin: 'source'` relationship per ref (targetId = the
 * workspace-relative file path, since Sources are not graph nodes). Values that
 * do not parse are left for the workspace source validator to report; they do
 * not populate `node.sources`.
 */
export function attachSourceCitations(node: KnowledgeNode): void {
  for (const [fieldName, fv] of Object.entries(node.fields)) {
    if (!SOURCE_FIELD_NAMES.has(fieldName.toLowerCase())) continue
    const refs: SourceRef[] = []
    for (const raw of splitSourceFieldValue(fv.value)) {
      const ref = parseKnowledgeUnitRef(raw) ?? parseSourceRef(raw)
      if (ref) refs.push(ref)
    }
    if (refs.length > 0) {
      node.sources = refs
      for (const ref of refs) {
        node.relationships.push({ targetId: ref.filePath, label: fieldName, origin: 'source' })
      }
    }
  }
}

/**
 * Additive second pass, run once a node's composed `templateSchema` is known
 * (design D3): any field the schema declares `type:: citation`, whose name is
 * NOT already in `SOURCE_FIELD_NAMES` (that path stays byte-identical, see
 * {@link attachSourceCitations}), is resolved the same way — appended to
 * `node.sources` and emitting one `origin: 'source'` relationship. The union
 * of the two paths (name OR declared type) is intentional (design D5): a
 * field named `sources`/`source` keeps working even when the schema declares
 * it as something else.
 */
export function attachSchemaTypedCitations(node: KnowledgeNode, schema: BlueprintSchema | undefined): void {
  if (!schema) return
  for (const [fieldName, fv] of Object.entries(node.fields)) {
    if (SOURCE_FIELD_NAMES.has(fieldName.toLowerCase())) continue
    const declared = findDeclaredField(schema, node.type, fieldName)
    if (declared?.type !== 'citation') continue

    const refs: SourceRef[] = []
    for (const raw of splitSourceFieldValue(fv.value)) {
      const ref = parseKnowledgeUnitRef(raw) ?? parseSourceRef(raw)
      if (ref) refs.push(ref)
    }
    if (refs.length > 0) {
      node.sources = [...(node.sources ?? []), ...refs]
      for (const ref of refs) {
        node.relationships.push({ targetId: ref.filePath, label: fieldName, origin: 'source' })
      }
    }
  }
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Extracts a node's own locally-declared metamodel from its body-level
 *  `Concept Definition` / `Marker Definition` elements (level-2 templates
 *  instantiate the root primitives of the Metaplantilla Nivel 1). Level-3
 *  models declare no local metamodel. */
export function toLocalMetamodel(parsed: ParsedKnowledge): LocalMetamodel {
  const schema = extractBlueprintSchema(parsed)
  return { concepts: schema.concepts, markers: schema.markers, taxonomy: schema.taxonomy }
}

export function toFieldValues(fields: Record<string, unknown>): Record<string, FieldValue> {
  const result: Record<string, FieldValue> = {}
  for (const [key, value] of Object.entries(fields)) {
    result[key] = {
      value,
      editAttribution: { author: { kind: 'system', id: 'parser' }, timestamp: nowIso() },
    }
  }
  return result
}

/** Builds a taxonomy parent-lookup: child name -> parent name. */
export function buildTaxonomyParentMap(parsed: ParsedKnowledge): Map<string, string> {
  const parentOf = new Map<string, string>()
  for (const edge of parsed.taxonomy) {
    parentOf.set(edge.child, edge.parent)
  }
  return parentOf
}

/**
 * Normalizes a single already-parsed ParsedKnowledge's elements into ModelNodes,
 * attached under `rootId`. Elements form a flat or taxonomy-derived
 * hierarchy beneath the document root; unrecognized parents fall back to
 * being direct children of the root.
 */
export function normalizeElementsIntoGraph(
  parsed: ParsedKnowledge,
  rootId: string,
  sourcePath: string,
  ctx: ParseContext,
  templateTaxonomy?: TaxonomyEdge[],
): void {
  const effectiveTaxonomy = parsed.taxonomy.length > 0 ? parsed.taxonomy : (templateTaxonomy ?? [])
  const parentOfTaxonomy = buildTaxonomyParentMap({ ...parsed, taxonomy: effectiveTaxonomy })
  const qualifiedIdByElementName = new Map<string, string>()

  // Collect all elements in declaration order, grouped by concept.
  const allElements: ElementNode[] = []
  for (const [, elementNodes] of parsed.elements.entries()) {
    for (const el of elementNodes) {
      allElements.push(el)
    }
  }

  // Re-sort elements by their position in the NN index (if present or inherited from template).
  // The index defines both hierarchy AND display order; elements not listed
  // in the index get a high sort value so they appear after indexed ones.
  if (effectiveTaxonomy.length > 0) {
    const indexOrder = new Map<string, number>()
    let orderIdx = 0
    for (const edge of effectiveTaxonomy) {
      if (!indexOrder.has(edge.parent)) indexOrder.set(edge.parent, orderIdx++)
      if (!indexOrder.has(edge.child)) indexOrder.set(edge.child, orderIdx++)
    }
    allElements.sort((a, b) => {
      const oa = indexOrder.get(a.name) ?? 99999
      const ob = indexOrder.get(b.name) ?? 99999
      return oa - ob
    })
  }

  // First pass: elements whose taxonomy parent has no listed parent themselves
  // (i.e. top-level relative to this document) get created first, so their
  // qualifiedId is available for children referencing them via taxonomy.
  const byName = new Map<string, ElementNode>()
  for (const el of allElements) byName.set(el.name, el)

  function resolveParentQualifiedId(elementName: string, seen: Set<string>): string {
    const taxonomyParentName = parentOfTaxonomy.get(elementName)
    if (!taxonomyParentName || seen.has(elementName)) {
      return rootId
    }
    if (qualifiedIdByElementName.has(taxonomyParentName)) {
      return qualifiedIdByElementName.get(taxonomyParentName)!
    }
    if (byName.has(taxonomyParentName)) {
      seen.add(elementName)
      return resolveParentQualifiedId(taxonomyParentName, seen)
    }
    return rootId
  }

  // Model-wide element-name uniqueness (R-IE-02).
  //
  // NOTE: an element that fails this check is DROPPED from the graph, not just
  // reported — which is why the issue below carries `severity: 'error'`.
  // Keying this on the element SLUG instead (so an explicit `slug::` could
  // legitimise the same display name under two concepts) was considered and
  // deliberately NOT done here: `IdentityRegistry` independently enforces
  // sibling-name uniqueness and derives each node's qualified id FROM THE
  // NAME, so changing the rule in one place only would leave the two gates
  // disagreeing and would move `[[wikilink]]` resolution underneath every
  // consumer. That belongs in its own change.
  const modelWideElementNames = new Set<string>()

  for (const el of allElements) {
    try {
      if (modelWideElementNames.has(el.name)) {
        throw new Error(
          `Duplicate element name "${el.name}" — element names must be unique within the whole model`,
        )
      }
      modelWideElementNames.add(el.name)

      const parentQualifiedId = resolveParentQualifiedId(el.name, new Set())
      const qualifiedId = ctx.identity.register(parentQualifiedId, el.name)
      qualifiedIdByElementName.set(el.name, qualifiedId)

      const node: KnowledgeNode = {
        id: qualifiedId,
        name: el.name,
        parentId: parentQualifiedId,
        childIds: [],
        type: el.type,
        kind: 'element',
        slug: el.slug,
        fields: toFieldValues(el.fields),
        markers: { ...(parsed.nodeMarkers[el.name] ?? {}) },
        tags: el.tags,
        relationships: [],
        rawSections: el.description ? { description: el.description } : {},
        source: { path: sourcePath },
      }
      attachSourceCitations(node)
      ctx.nodes[qualifiedId] = node
      const parent = ctx.nodes[parentQualifiedId]
      if (parent && !parent.childIds.includes(qualifiedId)) {
        parent.childIds.push(qualifiedId)
      }
    } catch (err) {
      ctx.issues.push({
        path: `${sourcePath}#${el.name}`,
        message: err instanceof Error ? err.message : String(err),
        // This element is dropped from the graph, so the issue is an error,
        // not advice. It previously carried no severity at all, which left
        // hosts unable to triage it.
        severity: 'error',
      })
    }
  }

  // Concept-scoped Marker scores (an `item-markers matrix` row whose subject
  // is a Concept name, permitted when the Marker's `applies_to` includes
  // `Concept`). There is no Concept node in the graph to hang these on, so
  // they are preserved on the document root for a future consumer rather than
  // dropped. Element-scoped rows are already attached to their element above.
  const rootNode = ctx.nodes[rootId]
  if (rootNode) {
    for (const [subject, scores] of Object.entries(parsed.nodeMarkers)) {
      if (!qualifiedIdByElementName.has(subject)) {
        rootNode.conceptMarkers = rootNode.conceptMarkers ?? {}
        rootNode.conceptMarkers[subject] = { ...scores }
      }
    }
  }

  // Attach relationships from matrices between named elements, once all
  // qualified ids are known. Falls back to a separator-normalized lookup
  // (hyphen vs en/em dash/minus) when the exact name isn't found, emitting a
  // warning issue rather than silently treating it as a clean match.
  const normalizedNameById = new Map<string, { id: string; originalName: string }>()
  for (const [name, id] of qualifiedIdByElementName.entries()) {
    const key = normalizeSeparators(name)
    if (!normalizedNameById.has(key)) {
      normalizedNameById.set(key, { id, originalName: name })
    }
  }
  function resolveMatrixEndpoint(
    name: string,
    matrixName: string,
    side: 'row' | 'col',
  ): string | undefined {
    const exact = qualifiedIdByElementName.get(name)
    if (exact) return exact
    const normalized = normalizedNameById.get(normalizeSeparators(name))
    if (normalized) {
      ctx.issues.push({
        path: `${sourcePath}#matrices.${matrixName}.${side}`,
        message: `Matrix reference "${name}" doesn't exactly match element "${normalized.originalName}" — separator character differs (hyphen vs dash). Consider using the exact same character.`,
      })
      return normalized.id
    }
    return undefined
  }
  for (const matrix of parsed.matrices) {
    for (const cell of matrix.cells) {
      const valStr = String(cell.value ?? '').trim()
      if (!valStr || valStr === '-' || valStr === '—' || valStr === 'false') continue
      const sourceId = resolveMatrixEndpoint(cell.row, matrix.name, 'row')
      const targetId = resolveMatrixEndpoint(cell.col, matrix.name, 'col')
      if (sourceId && targetId && ctx.nodes[sourceId]) {
        ctx.nodes[sourceId].relationships.push({
          targetId,
          label: matrix.name,
          value: cell.value,
          origin: 'matrix',
        })
      }
    }
  }

  // Attach field and mention relationships (relationship-types)
  addFieldAndMentionEdges(parsed, rootId, sourcePath, ctx, qualifiedIdByElementName, allElements)

  // Resolve asset paths for elements with asset-typed fields (FR-004)
  resolveElementAssets(parsed, rootId, sourcePath, ctx, qualifiedIdByElementName)
}

/**
 * Resolve asset paths for elements whose concept fields are of type
 * image/file/video/audio. Paths follow the single canonical storage
 * convention: `{modelDir}/assets/{element-slug}/{filename}`.
 */
export function resolveElementAssets(
  parsed: ParsedKnowledge,
  rootId: string,
  sourcePath: string,
  ctx: ParseContext,
  qualifiedIdByElementName: Map<string, string>,
): void {
  // Build a map of concept name -> asset field definitions
  const assetFieldsByConcept = new Map<string, Array<{ name: string; type: string }>>()
  const schemaConcepts = extractBlueprintSchema(parsed).concepts
  for (const concept of schemaConcepts) {
    const assetFields = (concept.fields ?? []).filter(
      (f) => f.type === 'image' || f.type === 'file' || f.type === 'video' || f.type === 'audio',
    )
    if (assetFields.length > 0) {
      assetFieldsByConcept.set(
        concept.name,
        assetFields.map((f) => ({ name: f.name, type: f.type })),
      )
    }
  }

  if (assetFieldsByConcept.size === 0) return

  const modelDir = sourcePath.replace(/\/?[^/]+$/, '') // directory of the model file

  for (const [conceptName, elementNodes] of parsed.elements.entries()) {
    const assetFields = assetFieldsByConcept.get(conceptName)
    if (!assetFields) continue

    for (const el of elementNodes) {
      const qualifiedId = qualifiedIdByElementName.get(el.name)
      if (!qualifiedId) continue
      const node = ctx.nodes[qualifiedId]
      if (!node) continue

      const paths: string[] = []
      for (const fieldDef of assetFields) {
        const fieldValue = el.fields[fieldDef.name]
        if (typeof fieldValue === 'string' && fieldValue.trim()) {
          const assetDir = el.slug ? `${modelDir}/assets/${el.slug}` : `${modelDir}/assets`
          paths.push(`${assetDir}/${fieldValue.trim()}`)
        }
      }

      if (paths.length > 0) {
        node.assets = [...(node.assets ?? []), ...paths]
      }
    }
  }
}
