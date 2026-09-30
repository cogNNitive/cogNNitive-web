/**
 * list_models and read_model tools.
 *
 * list_models scans the root directory for iNNfo model files (`*_NN.md`)
 * and returns their id, path, mode, and version.
 *
 * read_model parses a model by id and returns its parsed structure.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { listKnowledge as coreListModels, parseKnowledge, ElementsMap } from '@cognnitive/innfo-core'
import type { ModelInfo, ParsedKnowledge } from '@cognnitive/innfo-core'

/**
 * Default line cap for surgical slice reads (llm-context-efficiency).
 * A slice larger than this is truncated unless the caller records an
 * explicit `override_reason`. Observed artifacts reach ~600 lines while
 * surgical edits touch tens of lines; 150 fits one concept slice plus
 * schema excerpt with margin.
 */
export const SLICE_LINE_CAP = 150

/** Bounded slice-read options for `readKnowledge` (all optional, no-op when omitted). */
export interface ReadKnowledgeSliceOptions {
  /** Concept to slice (e.g. `Models`); when omitted the whole model is returned. */
  concept?: string
  /** Element within the concept to slice (requires `concept` for scoped reads). */
  element?: string
  /** Line cap for the returned `rawContent` (default {@link SLICE_LINE_CAP}). */
  max_lines?: number
  /** Recorded reason for exceeding the cap; bypasses truncation. */
  override_reason?: string
}

/** A parsed model with slice metadata for budgeted surgical reads. */
export type SlicedModel = ParsedKnowledge & {
  /** True when `rawContent` was cut to the line cap. */
  truncated: boolean
  /** Echo of `override_reason` when the cap was bypassed. */
  overrideRecorded?: string
}

/**
 * Normalize a model ID by stripping trailing file extensions (.md, .markdown) and redundant _NN suffixes.
 * E.g., `defiNNe_V_1-0_NN.md` or `model_NN_NN` resolves to `defiNNe_V_1-0` or `model`.
 *
 * @param id Raw model ID input string
 * @returns Normalized canonical base model ID
 */
export function normalizeId(id: string): string {
  if (!id) return ''
  let normalized = id.trim()
  normalized = normalized.replace(/\.(md|markdown)$/i, '')
  while (/_NN$/i.test(normalized)) {
    normalized = normalized.replace(/_NN$/i, '')
  }
  return normalized
}

/**
 * Scan a directory for iNNfo knowledge documents.
 */
export async function listKnowledge(rootDir: string): Promise<ModelInfo[]> {
  const rootModels = await coreListModels(rootDir)
  const candidateDirs = [join(rootDir, 'kNNowledge'), join(rootDir, 'models')]
  for (const dir of candidateDirs) {
    try {
      const { stat } = await import('node:fs/promises')
      const st = await stat(dir)
      if (st.isDirectory()) {
        const subModels = await coreListModels(dir)
        for (const m of subModels) {
          if (!rootModels.some((rm) => rm.path === m.path)) {
            rootModels.push(m)
          }
        }
      }
    } catch (err) {
      /* v8 ignore start */
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn(`[list-read] Failed to scan dir ${dir}: ${err}`)
      }
      /* v8 ignore stop */
    }
  }
  rootModels.sort((a, b) => a.id.localeCompare(b.id))
  return rootModels
}

/**
 * Read and parse an iNNfo model by its id.
 * The id is the filename stem (e.g. `Ghostbusters_V_0-1-0_business`
 * resolves to `Ghostbusters_V_0-1-0_business_NN.md`).
 *
 * Searches the root and the conventional `kNNowledge/` subdirectory, trying
 * `<cleanId>_NN.md`, `<cleanId>.md`, `<cleanId>`, `<id>` and `<id>.md`.
 *
 * Returns null if the file doesn't exist or can't be parsed.
 *
 * Slice reads (llm-context-efficiency): pass `{ concept }` to return only
 * that concept's elements, `{ concept, element }` for a single element, and
 * `{ max_lines }` (default 150) to cap `rawContent` lines. Slices larger
 * than the cap are truncated with `truncated: true` unless the caller
 * records `{ override_reason }`, which bypasses the cap and echoes the
 * reason in `overrideRecorded`. Omitting all options preserves the legacy
 * behavior (whole model, `truncated: false`). A unit over the cap returned
 * without a slice or override is a caller violation, never a server error.
 */
export async function readKnowledge(
  rootDir: string,
  id: string,
  options?: ReadKnowledgeSliceOptions,
): Promise<SlicedModel | null> {
  const { findKnowledgeFile } = await import('./spec.js')
  const filePath = await findKnowledgeFile(rootDir, id)
  if (!filePath) return null
  try {
    const content = await readFile(filePath, 'utf-8')
    const model = parseKnowledge(content)
    return applySlice(model, options)
  } catch (err) {
    /* v8 ignore start */
    // propagate: a read/parse failure must surface, not silently return null.
    console.warn(`[list-read] Failed to read/slice model ${filePath}: ${err}`)
    return null
    /* v8 ignore stop */
  }
}

/**
 * Apply bounded slice options to an already-parsed model (pure).
 * Extracts the requested concept/element section from `rawContent`,
 * filters `elements` to the slice, and enforces the line cap.
 */
export function applySlice(model: ParsedKnowledge, options?: ReadKnowledgeSliceOptions): SlicedModel {
  const sliced = model as SlicedModel
  const concept = options?.concept?.trim() || undefined
  const element = options?.element?.trim() || undefined
  const override = options?.override_reason?.trim() || undefined
  const rawMax = options?.max_lines
  const maxLines =
    rawMax !== undefined && Number.isInteger(rawMax) && rawMax > 0 ? rawMax : SLICE_LINE_CAP
  const wantsSlice = concept !== undefined || element !== undefined || rawMax !== undefined

  if (!wantsSlice) {
    sliced.truncated = false
    return sliced
  }

  const filtered = new ElementsMap()
  let section: string | null = null
  if (concept !== undefined) {
    const nodes = model.elements.get(concept) ?? []
    const scoped =
      element !== undefined
        ? nodes.filter((n) => n.name.toLowerCase() === element.toLowerCase())
        : nodes
    filtered.set(conceptKey(model, concept), scoped)
    section = extractSection(model.rawContent, concept, element) ?? renderSlice(concept, scoped)
  } else if (element !== undefined) {
    for (const [key, nodes] of model.elements.entries()) {
      const scoped = nodes.filter((n) => n.name.toLowerCase() === element.toLowerCase())
      if (scoped.length > 0) {
        filtered.set(key, scoped)
        section ??= extractSection(model.rawContent, key, element)
      }
    }
    section ??= renderSlice(element, [])
  } else {
    for (const [key, nodes] of model.elements.entries()) filtered.set(key, nodes)
    section = model.rawContent
  }

  const raw = section ?? model.rawContent
  if (override) {
    sliced.elements = filtered
    sliced.rawContent = raw
    sliced.truncated = false
    sliced.overrideRecorded = override
    return sliced
  }
  const lines = raw.split('\n')
  if (lines.length > maxLines) {
    sliced.elements = filtered
    sliced.rawContent = lines.slice(0, maxLines).join('\n')
    sliced.truncated = true
    return sliced
  }
  sliced.elements = filtered
  sliced.rawContent = raw
  sliced.truncated = false
  return sliced
}

/** Preserve the model's canonical concept key casing when filtering. */
function conceptKey(model: ParsedKnowledge, concept: string): string {
  for (const key of model.elements.keys()) {
    if (key.toLowerCase() === concept.toLowerCase()) return key
  }
  return concept
}

/** Match a `# NN <concept>` section heading line (case-insensitive). */
function isConceptHeading(line: string, concept: string): boolean {
  return new RegExp(`^#\\s+NN\\s+${escapeRegExp(concept)}\\s*$`, 'i').test(line.trim())
}

/** Match a `## NN <concept>: <element>` element heading line (case-insensitive). */
function isElementHeading(line: string, concept: string, element: string): boolean {
  return new RegExp(
    `^##\\s+NN\\s+${escapeRegExp(concept)}\\s*:\\s*${escapeRegExp(element)}\\s*$`,
    'i',
  ).test(line.trim())
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extract a concept (or single-element) section from raw markdown,
 * bounded by the next same-level heading. Returns null when the
 * headings are not found so the caller can fall back to rendering.
 */
export function extractSection(
  rawContent: string,
  concept: string,
  element?: string,
): string | null {
  const lines = rawContent.split('\n')
  const start = lines.findIndex((l) => isConceptHeading(l, concept))
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#\s+NN\s+/i.test(lines[i].trim())) {
      end = i
      break
    }
  }
  if (element === undefined) return lines.slice(start, end).join('\n')
  const elStart = lines.findIndex(
    (l, i) => i >= start && i < end && isElementHeading(l, concept, element),
  )
  if (elStart === -1) return null
  let elEnd = end
  for (let i = elStart + 1; i < end; i++) {
    if (/^#{1,2}\s+NN\s+/i.test(lines[i].trim())) {
      elEnd = i
      break
    }
  }
  return lines.slice(elStart, elEnd).join('\n')
}

/** Deterministic fallback rendering when raw headings are unavailable. */
function renderSlice(
  concept: string,
  nodes: Array<{ name: string; fields: Record<string, unknown> }>,
): string {
  const lines = [`# NN ${concept}`]
  for (const node of nodes) {
    lines.push(`## NN ${concept}: ${node.name}`)
    for (const [key, value] of Object.entries(node.fields)) lines.push(`${key}:: ${value}`)
  }
  return lines.join('\n')
}
