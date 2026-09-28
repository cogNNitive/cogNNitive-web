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
  extractHeadings,
} from '@cognnitive/innfo-core'
import type {
  ParsedModel,
  SourceResolver,
  TemplateSchema,
  ResolvedUnit,
  SourceRef,
  HeadingInfo,
} from '@cognnitive/innfo-core'
import { readModel } from './list-read.js'
import { findModelFile, resolveTemplateWithCache } from './spec.js'
import { createWorkspaceSourceResolver, buildTemplateSchemaResolverFromCache } from './validate.js'

/** Hard cap on a returned excerpt's character length. */
export const EXCERPT_CHAR_CAP = 500

/**
 * Origin classification for a resolved citation (design D1-D9): who produced
 * the cited content, derived per-citation from the heading the `@` pointer
 * targets. Never derived from the file-level `is_synthetic` flag.
 */
export type CitationOrigin = 'agent' | 'human' | 'reviewer' | 'document'

/** The `concept` half of a `## NN Agent Modification: <slug>` heading. */
export const AGENT_MODIFICATION_CONCEPT = 'NN Agent Modification'

/**
 * Known agent tool ids (design D1: kept here, not in innfo-core, because
 * this resolver is the single consumer). Matching normalises both sides
 * (design D2): lowercase, strip everything outside `[a-z0-9]`.
 */
export const KNOWN_AGENT_TOOL_IDS: readonly string[] = ['ClaudeCode', 'OpenCode', 'Antigravity']

export interface ResolvedCitation {
  path: string
  anchor?: string
  exists: boolean
  field: string
  origin: CitationOrigin
  author?: string
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
    return [
      {
        path: input.model,
        exists: false,
        field: input.fieldName ?? '',
        origin: 'document',
        error: 'MODEL_NOT_FOUND',
      },
    ]
  }

  const element = findElement(model, input.elementId)
  if (!element) {
    return [
      {
        path: input.elementId,
        exists: false,
        field: input.fieldName ?? '',
        origin: 'document',
        error: 'ELEMENT_NOT_FOUND',
      },
    ]
  }

  const fieldNames = await resolveFieldNames(rootDir, model, element, input.fieldName)
  const resolver = createWorkspaceSourceResolver(rootDir)

  const results: ResolvedCitation[] = []
  for (const fieldName of fieldNames) {
    const value = element.fields[fieldName]
    if (value === undefined) continue
    for (const raw of splitSourceFieldValue(value)) {
      results.push(resolveOneCitation(raw, fieldName, resolver, modelPath))
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
  field: string,
  resolver: SourceResolver,
  modelPath: string,
): ResolvedCitation {
  const ref = parseKnowledgeUnitRef(raw) ?? parseSourceRef(raw)
  if (!ref) {
    return { path: raw, exists: false, field, origin: 'document', error: 'MALFORMED' }
  }

  const anchor = ref.slug ?? (ref.unit?.kind === 'row' ? ref.unit.id : undefined)
  const resolved = resolver(ref.filePath, modelPath)
  if (!resolved || !resolved.exists) {
    return { path: ref.filePath, anchor, exists: false, field, origin: 'document', error: 'DANGLING_FILE' }
  }

  const content = resolved.content
  if (!content) {
    return { path: ref.filePath, anchor, exists: true, field, origin: 'document' }
  }

  const fm = parseFrontmatter(content) as
    | { sha256?: string; version?: string; model_version?: string; source_type?: string; author?: string }
    | null
  const sha256 = fm?.sha256
  const version = fm?.version ?? fm?.model_version

  let excerpt: { text: string; truncated: boolean } | undefined
  if (ref.unit) {
    const unitResult = resolveUnit(content, ref)
    if (!unitResult) {
      const fmOnly = classifyFromFrontmatter(fm)
      return {
        path: ref.filePath,
        anchor,
        exists: true,
        field,
        origin: fmOnly.origin,
        ...(fmOnly.author ? { author: fmOnly.author } : {}),
        error: 'UNKNOWN_ANCHOR',
      }
    }
    excerpt = extractExcerpt(content, unitResult)
  } else if (ref.slug) {
    const section = resolveHeadingSection(content, ref.slug)
    if (!section) {
      const fmOnly = classifyFromFrontmatter(fm)
      return {
        path: ref.filePath,
        anchor,
        exists: true,
        field,
        origin: fmOnly.origin,
        ...(fmOnly.author ? { author: fmOnly.author } : {}),
        error: 'UNKNOWN_ANCHOR',
      }
    }
    const lines = content.split('\n')
    excerpt = capExcerpt(lines.slice(section.startLine, section.endLine).join('\n'))
  }

  const classified = classifyOrigin(content, fm, ref)

  return {
    path: ref.filePath,
    anchor,
    exists: true,
    field,
    origin: classified.origin,
    ...(classified.author ? { author: classified.author } : {}),
    ...(excerpt ? { excerpt: excerpt.text, ...(excerpt.truncated ? { truncated: true } : {}) } : {}),
    ...(sha256 ? { sha256 } : {}),
    ...(version ? { version } : {}),
  }
}

/**
 * Normalise a tool-id string for comparison against `KNOWN_AGENT_TOOL_IDS`
 * (design D2): lowercase, strip everything outside `[a-z0-9]`.
 */
function normalizeToolId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const NORMALIZED_KNOWN_AGENT_TOOL_IDS = new Set(KNOWN_AGENT_TOOL_IDS.map(normalizeToolId))

/**
 * Walk from the target heading (`headings[idx]`) up through its structural
 * ancestors looking for an enclosing `## NN Agent Modification: …` heading
 * (design D3). Tests itself first, then each ancestor (a heading whose level
 * is strictly less than the current level). Siblings and descendants after
 * the target are never considered.
 */
function findEnclosingAgentModification(
  headings: HeadingInfo[],
  idx: number,
): HeadingInfo | undefined {
  const isAgentModification = (h: HeadingInfo): boolean =>
    h.concept?.trim().toLowerCase() === AGENT_MODIFICATION_CONCEPT.toLowerCase()

  if (isAgentModification(headings[idx])) return headings[idx]

  let level = headings[idx].level
  for (let j = idx - 1; j >= 0; j--) {
    if (headings[j].level < level) {
      if (isAgentModification(headings[j])) return headings[j]
      level = headings[j].level
    }
  }
  return undefined
}

/**
 * Read the `author::` line from an Agent Modification block's own lines
 * (from the heading to the next heading of any level) and classify it
 * (design C1's `readAgentModificationAuthor`).
 */
function readAgentModificationAuthor(
  content: string,
  amHeading: HeadingInfo,
): { origin: CitationOrigin; author: string } {
  const lines = content.split('\n')
  let endLine = lines.length
  for (let i = amHeading.line + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      endLine = i
      break
    }
  }

  const authorLineRe = /^\s*author\s*::\s*(.*?)\s*$/i
  let value = ''
  for (let i = amHeading.line + 1; i < endLine; i++) {
    const match = lines[i].match(authorLineRe)
    if (match) {
      value = (match[1] ?? '').trim()
      break
    }
  }

  if (!value || value === '_') {
    return { origin: 'agent', author: 'unknown' }
  }
  if (NORMALIZED_KNOWN_AGENT_TOOL_IDS.has(normalizeToolId(value))) {
    return { origin: 'agent', author: value }
  }
  return { origin: 'human', author: value }
}

/** Step 2/3 of classification: frontmatter-only, no heading walk. */
function classifyFromFrontmatter(fm: { source_type?: string; author?: string } | null): {
  origin: CitationOrigin
  author?: string
} {
  if (fm?.source_type === 'feedback') {
    return { origin: 'reviewer', ...(fm.author ? { author: fm.author } : {}) }
  }
  return { origin: 'document' }
}

/**
 * Classify a resolved citation's origin (design C1's `classifyOrigin`).
 * Precedence: an enclosing Agent Modification block (anchor-level), then
 * `fm.source_type === 'feedback'` (file-level), then `document`.
 */
function classifyOrigin(
  content: string,
  fm: { source_type?: string; author?: string } | null,
  ref: SourceRef,
): { origin: CitationOrigin; author?: string } {
  if (ref.slug) {
    const headings = extractHeadings(content)
    const idx =
      ref.unit?.kind === 'header'
        ? headings.findIndex((h) => h.slug === ref.slug && h.level === (ref.unit as { level: number }).level)
        : headings.findIndex((h) => h.slug === ref.slug)

    if (idx !== -1) {
      const amHeading = findEnclosingAgentModification(headings, idx)
      if (amHeading) return readAgentModificationAuthor(content, amHeading)
    }
  }

  return classifyFromFrontmatter(fm)
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
