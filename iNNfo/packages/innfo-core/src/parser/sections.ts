import { ElementNode, MatrixCell } from '../types/index.js'
import { parseMarkdownTable, parseTableRow, normalizeSource } from './markdown.js'

/**
 * Unified syntax (Metaplantilla Nivel 1, V_0-1-0). There is NO legacy syntax:
 *
 *   Concept section:  `# NN <Concept>`              (H1 heading)
 *   Element heading:  `## NN <Concept>: <Element>`  (H2 heading)
 *   Property line:    `key:: value`                 (immediately after the H2)
 */

/** Unified element heading: `## NN Concept: Element`. */
const UNIFIED_ELEMENT_RE = /^\s*##\s+NN\s+([^:\n]+?):\s+(.*)$/

/** Property line: `key:: value`. */
const PROPERTY_RE = /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*::\s*(.*)$/

/** Section heading marker: `NN`, followed by `matrices: name` or a bare concept name. */
const SECTION_RE = /^NN\s+(?:(matrices):\s*(.*)|(.*))/

export function sectionName(rawTitle: string): string | null {
  const fm = rawTitle.match(SECTION_RE)
  if (fm) {
    if (fm[1]) return fm[1] // 'matrices'
    if (fm[3] != null) return 'concepts' // implicit 'concepts' for bare ConceptName
  }
  return null
}

export function sectionTitle(rawTitle: string): string {
  const fm = rawTitle.match(SECTION_RE)
  if (fm) {
    if (fm[2]) return fm[2].trim() // matrix name
    if (fm[3] != null) return fm[3].trim() // concept name
  }
  return rawTitle
}

/** Unified element heading parser: `## NN <Concept>: <Element>`. */
export function parseElementHeading(line: string): string | null {
  const match = line.match(UNIFIED_ELEMENT_RE)
  if (match) return match[2].trim()
  return null
}

/** Unified property line parser: `key:: value`. Returns `[key, value]`. */
export function parsePropertyLine(line: string): [string, string] | null {
  const match = line.match(PROPERTY_RE)
  if (!match) return null
  return [match[1], match[2].trim()]
}

/** Parses a property value into a plain JS value (arrays, numbers, booleans, quoted strings). */
export function parsePropertyValue(raw: string): unknown {
  const value = raw.trim()
  if (value === '') return ''
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1)
  }
  // WikiLinks [[Name]] or [[Name1, Name2]] — return as-is (reference fields)
  if (value.startsWith('[[') && value.endsWith(']]')) {
    return value
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    if (inner === '') return []
    return inner.split(',').map((part) => parsePropertyValue(part.trim()))
  }
  if (value.startsWith('{') && value.endsWith('}')) {
    try {
      return JSON.parse(value)
    } catch (err) {
      // propagate deliberately: malformed JSON object literals fall through to
      // scalar parsing below — this is a parsing fallback, not a swallowed IO error.
    }
  }
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  if (value.toLowerCase() === 'null') return null
  if (/^-?\d+$/.test(value)) return parseInt(value, 10)
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value)
  return value
}

/**
 * Normalizes a `tags::` raw value into a list of lowercase, trimmed tags.
 * Accepts both plain comma-separated lists (`a, b, c`) and bracket-array
 * lists (`[a, b, c]`, as used by hand-authored samples). Empty values and
 * empty array entries are dropped.
 */
export function parseTagList(raw: string): string[] {
  let value = raw.trim()
  if (value.startsWith('[') && value.endsWith(']')) {
    value = value.slice(1, -1).trim()
  }
  if (value === '') return []
  return value
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

export interface ParsedConceptSection {
  /** Element instances parsed from `## NN` headings (empty for `text` concepts). */
  elements: ElementNode[]
  /** Free-form Markdown content that precedes/falls outside any element
   *  (the full section body for `text` concepts; leading prose for others). */
  content: string
  tags?: string[]
  /** Exact source text of the concept-level `tags::` RHS, for round-trip
   *  fidelity — `parseTagList` lowercases, so the authored casing lives
   *  only here. See `ElementNode.rawTags`. */
  rawTags?: string
}

export function parseConceptSection(conceptName: string, content: string): ParsedConceptSection {
  const nodes: ElementNode[] = []
  const lines = content.split('\n')
  let current: ElementNode | null = null
  let descriptionLines: string[] = []
  const leadingLines: string[] = []
  let seenElement = false

  // Closes out an element: `description` is trimmed, so the blank lines that
  // surrounded it in the source would be lost. Both separations are recorded
  // instead, because the shipped corpus is NOT uniform about either and
  // `serializeKnowledge` replays whatever this element actually had.
  const finishElement = (node: ElementNode) => {
    // Blank line between this element and the next `## NN` heading.
    node.trailingBlankLine =
      descriptionLines.length > 0 && descriptionLines[descriptionLines.length - 1] === ''
    // Blank line between the element's last `key:: value` and its prose.
    const firstProseIndex = descriptionLines.findIndex((l) => l.trim() !== '')
    node.descriptionBlankLine = firstProseIndex > 0
    node.description = descriptionLines.join('\n').trim()
    nodes.push(node)
  }

  const startElement = (name: string): ElementNode => {
    if (current) {
      finishElement(current)
    }
    const node: ElementNode = { type: conceptName, name, description: '', fields: {}, markers: {} }
    descriptionLines = []
    seenElement = true
    return node
  }

  let conceptTags: string[] | undefined
  let rawConceptTags: string | undefined

  for (const line of lines) {
    // Unified element heading: `## NN Concept: Element`
    const headingName = parseElementHeading(line)
    if (headingName !== null) {
      current = startElement(headingName)
      continue
    }

    // Unified property line: `key:: value` (immediately after an element heading)
    if (current) {
      const prop = parsePropertyLine(line)
      if (prop !== null) {
        if (prop[0] === 'slug') {
          current.slug = String(prop[1])
          current.slugExplicit = true
        } else if (prop[0] === 'tags') {
          current.tags = parseTagList(String(prop[1]))
          current.rawTags = String(prop[1])
        } else {
          current.fields[prop[0]] = parsePropertyValue(prop[1])
          current.rawFields = current.rawFields ?? {}
          current.rawFields[prop[0]] = prop[1]
        }
        continue
      }
    } else {
      const prop = parsePropertyLine(line)
      if (prop !== null && prop[0] === 'tags') {
        conceptTags = parseTagList(String(prop[1]))
        rawConceptTags = String(prop[1])
        continue
      }
    }

    // Element prose: keep every non-field, non-heading line, including Markdown
    // bullet lines (`-`/`*`) — they are prose, not structural delimiters. The
    // serializer re-emits `description` verbatim, so the round-trip holds once
    // the parser stops dropping them.
    if (seenElement) {
      // AD-3: strip the canonical property/description indentation on read.
      // The (now-fixed) serializer never writes it, but documents saved by
      // the old, buggy serializer carry it — a full left-trim converges them
      // to column 0 in a single pass instead of leaving residual indentation
      // that would keep drifting on further saves (Requirement 2).
      descriptionLines.push(line.replace(/^[ \t]+/, ''))
    } else {
      leadingLines.push(line)
    }
  }

  if (current) {
    finishElement(current)
  }

  return {
    elements: nodes,
    content: leadingLines.join('\n').trim(),
    tags: conceptTags,
    rawTags: rawConceptTags,
  }
}

export function parseMatrixSection(content: string, _matrixName: string): MatrixCell[] {
  const rows = parseMarkdownTable(content)
  if (rows.length === 0) return []
  const colNames = Object.keys(rows[0] || {})
  const cells: MatrixCell[] = []
  for (const row of rows) {
    const rowName = colNames.length > 0 ? row[colNames[0]] || '' : ''
    for (let i = 1; i < colNames.length; i++) {
      if (row[colNames[i]]) {
        cells.push({ row: rowName, col: colNames[i], value: row[colNames[i]] })
      }
    }
  }
  return cells
}

/**
 * Parses the two axis labels from a matrix table header's first cell, e.g.
 * `| Metrics \ Variables | ... |` → `{ source: 'Metrics', target: 'Variables' }`
 * (AD-4 / Requirement 3). Reads the header row directly (not via
 * `parseMarkdownTable`, which requires at least one data row and would miss
 * a declaration-only matrix that has a header but no cells yet). Returns
 * `null` when there is no header row, or it carries no `\` separator
 * (matrices built programmatically with no axis labels, e.g. `init_model` —
 * AD-4's kept fallback).
 */
export function parseMatrixHeaderAxis(content: string): { source: string; target: string } | null {
  const headerLine = normalizeSource(content)
    .split('\n')
    .find((l) => /(^|[^\\])\|/.test(l.trim()))
  if (!headerLine) return null
  const [firstCell] = parseTableRow(headerLine)
  if (!firstCell) return null
  const sepIndex = firstCell.indexOf('\\')
  if (sepIndex === -1) return null
  return {
    source: firstCell.slice(0, sepIndex).trim(),
    target: firstCell.slice(sepIndex + 1).trim(),
  }
}

export function getSectionType(rawTitle: string): 'index' | 'concept' | 'matrix' | 'other' {
  const sn = sectionName(rawTitle)
  if (!sn) return 'other'
  const s = sn.toLowerCase()
  if (s === 'concepts') {
    const name = sectionTitle(rawTitle).toLowerCase()
    if (name === 'index') return 'index'
    return 'concept'
  }
  if (s === 'matrices') return 'matrix'
  return 'other'
}
