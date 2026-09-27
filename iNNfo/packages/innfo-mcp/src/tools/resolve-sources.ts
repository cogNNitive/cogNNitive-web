/**
 * `resolve_sources` tool: read-only resolution of an element's citations to
 * their underlying file, anchor, and content — "where did this value come
 * from?" without manually tracing `sources::` values by hand.
 *
 * Composes only existing exports (design.md's Approach section): `readModel`,
 * `splitSourceFieldValue`, `parseKnowledgeUnitRef`/`parseSourceRef`,
 * `createWorkspaceSourceResolver`, `resolveHeadingSection`/`resolveUnit`, and
 * the shared frontmatter parser. When `fieldName` is omitted, field selection
 * additionally needs `findDeclaredField` (from A3) to catch schema-typed
 * `type:: citation` fields — a soft dependency: an explicit `fieldName` works
 * standalone.
 */
import {
  parseCsvTable,
  parseFrontmatter,
  parseKnowledgeUnitRef,
  parseSourceRef,
  resolveHeadingSection,
  resolveUnit,
  splitSourceFieldValue,
  SOURCE_FIELD_NAMES,
  findDeclaredField,
} from '@cognnitive/innfo-core'
import type { ParsedModel, SourceResolver, TemplateSchema, ResolvedUnit } from '@cognnitive/innfo-core'
import { readModel } from './list-read.js'
import { findModelFile, resolveTemplateWithCache } from './spec.js'
import { createWorkspaceSourceResolver, buildTemplateSchemaResolverFromCache } from './validate.js'

/** Hard cap on a returned excerpt's character length. */
export const EXCERPT_CHAR_CAP = 500

export interface ResolvedCitation {
  path: string
  anchor?: string
  exists: boolean
  excerpt?: string
  truncated?: boolean
  sha256?: string
  version?: string
  error?: 'MALFORMED' | 'DANGLING_FILE' | 'UNKNOWN_ANCHOR' | 'ELEMENT_NOT_FOUND' | 'MODEL_NOT_FOUND'
}

/**
 * Resolve every citation on an element's citation-typed field(s) to its
 * underlying file/anchor/content. Never writes files; never throws on a
 * dangling reference (that is reported as an entry with `exists: false`).
 */
export async function resolveSources(
  rootDir: string,
  input: { model: string; elementId: string; fieldName?: string },
): Promise<ResolvedCitation[]> {
  const modelPath = await findModelFile(rootDir, input.model)
  const model = modelPath ? await readModel(rootDir, input.model) : null
  if (!modelPath || !model) {
    return [{ path: input.model, exists: false, error: 'MODEL_NOT_FOUND' }]
  }

  const element = findElement(model, input.elementId)
  if (!element) {
    return [{ path: input.elementId, exists: false, error: 'ELEMENT_NOT_FOUND' }]
  }

  const fieldNames = await resolveFieldNames(rootDir, model, element, input.fieldName)
  const resolver = createWorkspaceSourceResolver(rootDir)

  const results: ResolvedCitation[] = []
  for (const fieldName of fieldNames) {
    const value = element.fields[fieldName]
    if (value === undefined) continue
    for (const raw of splitSourceFieldValue(value)) {
      results.push(resolveOneCitation(raw, resolver, modelPath))
    }
  }
  return results
}

interface FoundElement {
  concept: string
  fields: Record<string, unknown>
}

function findElement(model: ParsedModel, elementId: string): FoundElement | undefined {
  for (const [concept, nodes] of model.elements.entries()) {
    const match = nodes.find((n) => n.name.toLowerCase() === elementId.toLowerCase())
    if (match) return { concept, fields: match.fields }
  }
  return undefined
}

/**
 * Field selection (design D6): explicit `fieldName` skips schema resolution
 * entirely (works standalone, no A3 dependency). When omitted, the schema
 * comes from `resolveTemplateWithCache` + `buildTemplateSchemaResolverFromCache`
 * — a single-model read, never a full `recursiveParse` — and falls back to
 * `SOURCE_FIELD_NAMES` only when no schema resolves.
 */
async function resolveFieldNames(
  rootDir: string,
  model: ParsedModel,
  element: FoundElement,
  explicitFieldName?: string,
): Promise<string[]> {
  if (explicitFieldName) return [explicitFieldName]

  const candidateNames = Object.keys(element.fields)
  const nameBased = candidateNames.filter((f) => SOURCE_FIELD_NAMES.has(f.toLowerCase()))

  const schema = await resolveSchemaForModel(rootDir, model)
  if (!schema) return nameBased

  const schemaTyped = candidateNames.filter(
    (f) =>
      !SOURCE_FIELD_NAMES.has(f.toLowerCase()) &&
      findDeclaredField(schema, element.concept, f)?.type === 'citation',
  )
  return [...nameBased, ...schemaTyped]
}

async function resolveSchemaForModel(
  rootDir: string,
  model: ParsedModel,
): Promise<TemplateSchema | undefined> {
  const parent = model.frontmatter.parent_spec
  if (!parent?.url || !parent?.name) return undefined
  const { cache } = await resolveTemplateWithCache(rootDir, parent.url, parent.name)
  if (!cache) return undefined
  const resolveSchema = buildTemplateSchemaResolverFromCache(cache)
  return (
    resolveSchema({ path: '', name: parent.name, content: '', frontmatter: model.frontmatter }) ??
    undefined
  )
}

function resolveOneCitation(
  raw: string,
  resolver: SourceResolver,
  modelPath: string,
): ResolvedCitation {
  const ref = parseKnowledgeUnitRef(raw) ?? parseSourceRef(raw)
  if (!ref) {
    return { path: raw, exists: false, error: 'MALFORMED' }
  }

  const anchor = ref.slug ?? (ref.unit?.kind === 'row' ? ref.unit.id : undefined)
  const resolved = resolver(ref.filePath, modelPath)
  if (!resolved || !resolved.exists) {
    return { path: ref.filePath, anchor, exists: false, error: 'DANGLING_FILE' }
  }

  const content = resolved.content
  if (!content) {
    return { path: ref.filePath, anchor, exists: true }
  }

  const fm = parseFrontmatter(content) as
    | { sha256?: string; version?: string; model_version?: string }
    | null
  const sha256 = fm?.sha256
  const version = fm?.version ?? fm?.model_version

  let excerpt: { text: string; truncated: boolean } | undefined
  if (ref.unit) {
    const unitResult = resolveUnit(content, ref)
    if (!unitResult) {
      return { path: ref.filePath, anchor, exists: true, error: 'UNKNOWN_ANCHOR' }
    }
    excerpt = extractExcerpt(content, unitResult)
  } else if (ref.slug) {
    const section = resolveHeadingSection(content, ref.slug)
    if (!section) {
      return { path: ref.filePath, anchor, exists: true, error: 'UNKNOWN_ANCHOR' }
    }
    const lines = content.split('\n')
    excerpt = capExcerpt(lines.slice(section.startLine, section.endLine).join('\n'))
  }

  return {
    path: ref.filePath,
    anchor,
    exists: true,
    ...(excerpt ? { excerpt: excerpt.text, ...(excerpt.truncated ? { truncated: true } : {}) } : {}),
    ...(sha256 ? { sha256 } : {}),
    ...(version ? { version } : {}),
  }
}

function extractExcerpt(content: string, unit: ResolvedUnit): { text: string; truncated: boolean } {
  const lines = content.split('\n')
  if (unit.kind === 'section') {
    return capExcerpt(lines.slice(unit.startLine, unit.endLine).join('\n'))
  }
  if (unit.kind === 'field') {
    return capExcerpt(unit.lines.map((i) => lines[i]).join('\n'))
  }
  if (unit.kind === 'cell') {
    return capExcerpt(String(unit.value))
  }
  // kind === 'row': no dedicated raw-text slice; reconstruct from the parsed table.
  const table = parseCsvTable(content)
  const row = table.rows[unit.index]
  return capExcerpt(row ? row.join(',') : '')
}

function capExcerpt(text: string): { text: string; truncated: boolean } {
  if (text.length <= EXCERPT_CHAR_CAP) return { text, truncated: false }
  return { text: text.slice(0, EXCERPT_CHAR_CAP), truncated: true }
}
