/**
 * Source-reference parsing and GitHub-compatible heading slugs.
 *
 * THE single implementation shared by `innfo-core`, `innfo-mcp`, and
 * `innfo-editor` (which re-exports this module). Previously duplicated in
 * `apps/innfo-editor/src/utils/sourceRef.ts`.
 *
 * Canonical source-reference form is a workspace-relative path under
 * `sources/nn/`, optionally followed by a heading-slug anchor:
 * `sources/nn/<path>.md#<heading-slug>`. Unqualified paths (`<path>.md#<slug>`)
 * resolve under `sources/nn/`. A `models/<path>.md#<slug>` form is accepted for
 * cross-domain model references. Line-range anchors (`#L12-L45`) and the legacy
 * `src-NNN` wrapper are rejected.
 */

import { nfc, stripCombiningMarks } from './parser/slug.js'

export interface HeaderUnit {
  /** Markdown heading unit: level is structural rank, slug is the canonical form. */
  kind: 'header'
  level: 1 | 2 | 3 | 4 | 5 | 6
  /** Raw heading text (markers stripped, not slugified). */
  text: string
  slug: string
}

export interface RowUnit {
  /** CSV row unit: explicit key-column value (never positional). Case-sensitive. */
  kind: 'row'
  id: string
}

export type KnowledgeUnit = HeaderUnit | RowUnit

export interface SourceRef {
  /** Workspace-relative path, always normalised to start with `sources/nn/` (or `models/`). */
  filePath: string
  /** Last path segment. */
  fileName: string
  /** Heading slug after `#`, if present. */
  slug?: string
  /** `model` for a `models/…` reference, `source` for a `sources/nn/…` one. */
  kind: 'source' | 'model'
  /** Original string as authored. */
  raw: string
  /** Knowledge-unit address when parsed from `@` grammar (set by parseKnowledgeUnitRef only). */
  unit?: KnowledgeUnit
  /** Subunit names (field / column / matrix row+column labels). Names only, never values. */
  subunits?: string[]
}

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'

/**
 * Field names (case-insensitive, caller lowercases before checking) that hold
 * source Citations. THE single definition, shared by the writer
 * (`parser/serializer.ts`, citation-list serialization) and both readers
 * (`validator/workspaceSources.ts`, `recursiveParser/normalize.ts`) so writing
 * and reading a `sources::`/`source::` field key off the same grammar by
 * construction, not by coincidence.
 */
export const SOURCE_FIELD_NAMES = new Set(['sources', 'source'])

/**
 * Reserved element-level property name for `conflicts::`. Deliberately kept
 * SEPARATE from `SOURCE_FIELD_NAMES`: a `conflicts::` pointer is validated by
 * the same citation grammar, but MUST NOT feed `recursiveParser/normalize.ts`'s
 * `node.sources` / lineage-edge construction the way a `sources::` value does.
 */
export const CONFLICT_FIELD_NAMES = new Set(['conflicts'])

/**
 * Parse a single field value as a source reference. Returns `null` for anything
 * that is not a reference (plain prose, URLs, line-range anchors, `src-NNN`
 * wrappers, `sources/original/` paths).
 */
export function parseSourceRef(input: string): SourceRef | null {
  if (!input || typeof input !== 'string') return null
  const clean = input.trim()

  // Reject legacy line-range anchor: #L13 or #L12-L45
  if (/#L\d+(-L\d+)?$/i.test(clean)) return null
  // Reject src-NNN wrapper
  if (/^src-\d+/i.test(clean)) return null

  const explicit = clean.match(new RegExp(`^(sources/nn/[^#]+?)(?:#(${SLUG}))?$`))
  if (explicit) {
    const filePath = explicit[1].trim()
    return {
      filePath,
      fileName: basename(filePath),
      slug: explicit[2] || undefined,
      kind: 'source',
      raw: clean,
    }
  }

  const model = clean.match(new RegExp(`^(models/[^#]+?\\.md)(?:#(${SLUG}))?$`))
  if (model) {
    const filePath = model[1].trim()
    return {
      filePath,
      fileName: basename(filePath),
      slug: model[2] || undefined,
      kind: 'model',
      raw: clean,
    }
  }

  const unqualified = clean.match(
    new RegExp(`^((?!https?://)(?!\\.\\.?/)[^#:]+?\\.md)(?:#(${SLUG}))?$`),
  )
  if (unqualified) {
    const rawPath = unqualified[1].trim()
    if (rawPath.startsWith('sources/original/')) return null
    const filePath = `sources/nn/${rawPath}`
    return {
      filePath,
      fileName: basename(rawPath),
      slug: unqualified[2] || undefined,
      kind: 'source',
      raw: clean,
    }
  }

  return null
}

function basename(p: string): string {
  return p.split(/[/\\]/).pop() || p
}

function cleanSourceItem(v: unknown): string {
  if (v === undefined || v === null) return ''
  let s = String(v).trim()
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim()
  }
  return s.replace(/\\,/g, ',').trim()
}

function parseBracketedSourceList(inner: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let inQuote: '"' | "'" | null = null
  let escaped = false

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (escaped) {
      if (ch === ',') {
        cur += ','
      } else if (ch === inQuote) {
        cur += ch
      } else if (ch === '\\') {
        cur += '\\'
      } else {
        cur += '\\' + ch
      }
      escaped = false
      continue
    }

    if (ch === '\\') {
      escaped = true
      continue
    }

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null
      } else {
        cur += ch
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch
      continue
    }

    if (ch === ',') {
      const cleaned = cleanSourceItem(cur)
      if (cleaned) tokens.push(cleaned)
      cur = ''
      continue
    }

    cur += ch
  }

  if (escaped) {
    cur += '\\'
  }

  const cleaned = cleanSourceItem(cur)
  if (cleaned) tokens.push(cleaned)
  return tokens
}

/**
 * Normalise a `sources`/`source` field value into the list of raw reference
 * strings it holds. Handles the three forms a Citation field takes:
 * - an already-split array (`["a.md#x", "b.md#y"]`);
 * - the bracketed-list string the unified `key:: [a, b]` syntax produces when
 *   the field is untyped (`"[a.md#x, b.md#y]"`), with support for single/double
 *   quotes and escaped commas (`\,`);
 * - a single scalar (`"a.md#x"`).
 * Empty / whitespace-only entries are dropped.
 */
export function splitSourceFieldValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out: string[] = []
    for (const v of value) {
      const cleaned = cleanSourceItem(v)
      if (cleaned) out.push(cleaned)
    }
    return out
  }
  const s = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (!s) return []
  const bracketed = s.match(/^\[(.*)\]$/s)
  if (bracketed) {
    return parseBracketedSourceList(bracketed[1])
  }
  const cleaned = cleanSourceItem(s)
  return cleaned ? [cleaned] : []
}

/**
 * Compute the Levenshtein edit distance between two strings (case-insensitive).
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an
  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0))
  for (let i = 0; i <= an; i++) matrix[0][i] = i
  for (let j = 0; j <= bn; j++) matrix[j][0] = j
  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost,
      )
    }
  }
  return matrix[bn][an]
}

/**
 * Slugify one Markdown heading's text into a GitHub-style anchor slug. THE
 * single algorithm — `skills/nn-trannsform/scripts/markdown-utils.js`
 * mirrors it exactly (parity is asserted by that skill's `test-slug-parity.js`).
 *
 * Steps: strip a leading `#` marker and `* _ \`` emphasis characters,
 * NFD-normalise and drop combining marks so accented letters transliterate
 * ("Visión" → "vision", "Café" → "cafe"), trim, lowercase, whitespace → `-`,
 * drop the remaining non `[a-z0-9-]`, collapse repeated `-`, trim leading /
 * trailing `-`.
 */
export function slugifyHeading(text: string): string {
  const stripped = nfc(text)
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/[*_`]/g, '')
  // Split on exactly-two hyphens bounded by letters/numbers (the `--` boundary
  // marker), slugify each part with full collapsing, rejoin. Runs of 3+ and
  // whitespace-born doubles still collapse; split+join makes canonical slugs
  // (which contain `--`) stable under re-parsing by construction.
  return stripped
    .split(/(?<=[\p{L}\p{N}])--(?=[\p{L}\p{N}])/gu)
    .map(slugifyFlat)
    .join('--')
}

function slugifyFlat(part: string): string {
  const transliterated = stripCombiningMarks(part)
  const dashed = transliterated.trim().toLowerCase().replace(/\s+/g, '-')
  const filtered = dashed.replace(/[^\p{L}\p{N}-]+/gu, '')
  return filtered.replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

export interface HeadingInfo {
  /** Heading level, 1-6 (number of leading `#`). */
  level: number
  /** Raw heading text (emphasis characters stripped, not slugified). */
  text: string
  /** Disambiguated slug for this heading (matches GitHub's anchor behavior). */
  slug: string
  /** Concept (left of `:`) for `## NN Concept: Element` headers, when present. */
  concept?: string
  /** Element (right of `:`) for `## NN Concept: Element` headers, when present. */
  element?: string
  /** 0-based line index of the heading line within the document. */
  line: number
}

/**
 * Scan a Markdown document's `#`/`##`/... headings top-to-bottom and compute
 * each one's disambiguated slug (first occurrence bare, later ones `-1`, `-2`).
 */
export function extractHeadings(markdown: string): HeadingInfo[] {
  const lines = markdown.split('\n')
  const seen = new Map<string, number>()
  const headings: HeadingInfo[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!match) continue

    const level = match[1].length
    const text = match[2].replace(/[*_`]/g, '').trim()
    const { concept, element, slug: baseSlug } = headingSlugParts(text)
    const occurrence = seen.get(baseSlug) ?? 0
    seen.set(baseSlug, occurrence + 1)
    const slug = occurrence === 0 ? baseSlug : `${baseSlug}-${occurrence}`

    headings.push({ level, text, slug, line: i, concept, element })
  }

  return headings
}

export interface ResolvedHeadingSection {
  heading: HeadingInfo
  /** 0-based line index where the section starts (the heading line itself). */
  startLine: number
  /**
   * 0-based line index where the section ends, exclusive: the next heading at
   * the same-or-higher level, or the document's total line count.
   */
  endLine: number
}

/**
 * Resolve a citation slug to the section it points at: the matching heading plus
 * every line up to (not including) the next heading of the same or higher level.
 */
export function resolveHeadingSection(
  markdown: string,
  slug: string,
): ResolvedHeadingSection | null {
  const headings = extractHeadings(markdown)
  const index = headings.findIndex((h) => h.slug === slug)
  if (index === -1) return null

  const heading = headings[index]
  const lines = markdown.split('\n')
  let endLine = lines.length

  for (let j = index + 1; j < headings.length; j++) {
    if (headings[j].level <= heading.level) {
      endLine = headings[j].line
      break
    }
  }

  return { heading, startLine: heading.line, endLine }
}

/**
 * Split a heading into Concept/Element at the FIRST `:` (the structural boundary in
 * `## NN Concept: Element`). Inner colons belong to the element text and slugify away.
 * Returns the canonical slug, keeping the boundary visible as `--`.
 */
export function headingSlugParts(text: string): {
  slug: string
  concept?: string
  element?: string
} {
  const clean = text.trim()
  const boundary = clean.indexOf(':')
  if (boundary > 0) {
    const concept = clean.slice(0, boundary).trim()
    const element = clean.slice(boundary + 1).trim()
    if (concept && element) {
      return {
        slug: `${slugifyHeading(concept)}--${slugifyHeading(element)}`,
        concept,
        element,
      }
    }
  }
  return { slug: slugifyHeading(clean) }
}

/**
 * Slugify one Markdown heading into a knowledge-unit slug, preserving the header level
 * and the Concept/Element boundary (`--`). The level is captured by the caller BEFORE
 * slugification — it is structural metadata, not slug text.
 */
export function slugifyUnitHeading(
  level: number,
  text: string,
): { level: 1 | 2 | 3 | 4 | 5 | 6; text: string; slug: string } {
  const clean = text.trim()
  const { slug } = headingSlugParts(clean)
  const clamped = Math.min(6, Math.max(1, Math.floor(level) || 1)) as 1 | 2 | 3 | 4 | 5 | 6
  return { level: clamped, text: clean, slug }
}

/**
 * Normalise a field/column/filter name: trim, lowercase, inner whitespace to `_`,
 * preserving `_` and non-Latin letters. Gentler than heading slugs — data-world names
 * (`mrr_usd`, `relationship_model`) must survive verbatim modulo case.
 */
export function normalizeName(name: string): string {
  return nfc(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-\p{L}\p{N}]+/gu, '')
}

export function resolveUnitPath(
  rawPath: string,
): { filePath: string; kind: 'source' | 'model' } | null {
  const trimmed = rawPath.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null
  const segments = trimmed.split(/[/\\]/)
  if (segments.some((s) => s === '..')) return null
  const forward = segments.join('/')
  if (forward.startsWith('sources/original/')) return null
  const isMd = /\.md$/i.test(forward)
  const isCsv = /\.csv$/i.test(forward)
  if (!isMd && !isCsv) return null
  if (forward.startsWith('sources/nn/')) return { filePath: forward, kind: 'source' }
  if (/^models\//i.test(forward)) {
    if (!isMd) return null
    return { filePath: forward, kind: 'model' }
  }
  if (/^[a-zA-Z]:[/\\]/.test(trimmed) || trimmed.startsWith('/')) return null
  return { filePath: `sources/nn/${forward}`, kind: 'source' }
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch (err) {
    // propagate deliberately: a malformed URI segment makes the reference invalid.
    return null
  }
}

const HEADER_UNIT = /^(#{1,6})\s*(.+?)\s*$/

/**
 * Parse a knowledge-unit pointer: `path "@" unit *("&" subunit)`.
 * The file extension disambiguates the unit grammar (`.md` → `#`-level header,
 * `.csv` → explicit key-column value). Subunits are names only, never values.
 * Returns `null` for anything that is not a pointer (bare paths, legacy `#slug`
 * fragments, URLs, absolute paths, line anchors).
 */
export function parseKnowledgeUnitRef(input: string): SourceRef | null {
  if (!input || typeof input !== 'string') return null
  const clean = input.trim()
  const at = clean.indexOf('@')
  if (at === -1) return null
  const resolved = resolveUnitPath(clean.slice(0, at))
  if (!resolved) return null
  const rawSegments = clean.slice(at + 1).split('&')
  if (rawSegments.some((s) => s.trim() === '')) return null
  const decoded: string[] = []
  for (const part of rawSegments) {
    const text = decodeSegment(part.trim())
    if (text === null || text.trim() === '') return null
    decoded.push(text.trim())
  }
  const [unitRaw, ...subunits] = decoded
  const isCsv = /\.csv$/i.test(resolved.filePath)
  if (isCsv) {
    if (resolved.kind === 'model') return null
    return {
      filePath: resolved.filePath,
      fileName: basename(resolved.filePath),
      kind: 'source',
      unit: { kind: 'row', id: unitRaw },
      subunits,
      raw: clean,
    }
  }
  const heading = unitRaw.match(HEADER_UNIT)
  if (!heading) return null
  const headed = slugifyUnitHeading(heading[1].length, heading[2])
  if (!headed.text || !headed.slug) return null
  const unit: HeaderUnit = {
    kind: 'header',
    level: headed.level,
    text: headed.text,
    slug: headed.slug,
  }
  return {
    filePath: resolved.filePath,
    fileName: basename(resolved.filePath),
    slug: headed.slug,
    kind: resolved.kind,
    unit,
    subunits,
    raw: clean,
  }
}

/**
 * Serialize a parsed pointer back to its canonical `@` form: header level + slug,
 * verbatim row-id, subunits normalized. `parse(serialize(parse(x)))` is stable.
 */
export function serializeKnowledgeUnitRef(
  filePath: string,
  unit: KnowledgeUnit,
  subunits: string[] = [],
): string {
  // Headings are written in their human-readable form (`@## Q4 Outlook`), the
  // way an author would type them and the way they appear in the source file.
  // The slug stays a READ-side derivation: emitting `@##q4-outlook` turned
  // every citation into something nobody could read back against the document.
  const head = unit.kind === 'header' ? `${'#'.repeat(unit.level)} ${unit.text}` : unit.id
  const tail = subunits.map((s) => normalizeName(s)).filter((s) => s !== '')
  return tail.length > 0 ? `${filePath}@${head}&${tail.join('&')}` : `${filePath}@${head}`
}

/**
 * Split a `key::` field value into matchable items. Bracketed lists split on
 * commas respecting double quotes (`[a, "b,c"]` → two items, quotes stripped);
 * anything else is a single scalar (commas preserved). Contrast
 * `splitSourceFieldValue`, which splits naively and stays untouched for
 * provenance parsing.
 */
export function splitBracketList(value: unknown): string[] {
  if (value === undefined || value === null) return []
  const s = String(value).trim()
  if (s === '') return []
  if (!(s.startsWith('[') && s.endsWith(']'))) return [s]
  const inner = s.slice(1, -1)
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '\\' && i + 1 < inner.length) {
      cur += inner[i + 1]
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out.filter((v) => v !== '')
}
