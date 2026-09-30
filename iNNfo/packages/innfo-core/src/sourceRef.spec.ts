import { describe, it, expect } from 'vitest'
import {
  parseSourceRef,
  slugifyHeading,
  extractHeadings,
  resolveHeadingSection,
  splitSourceFieldValue,
  levenshteinDistance,
  SOURCE_FIELD_NAMES,
  CONFLICT_FIELD_NAMES,
} from './sourceRef.js'

describe('parseSourceRef', () => {
  it('resolves a bare path under sources/nn/', () => {
    expect(parseSourceRef('clientA/report.md#market-overview')).toEqual({
      filePath: 'sources/nn/clientA/report.md',
      fileName: 'report.md',
      slug: 'market-overview',
      kind: 'source',
      raw: 'clientA/report.md#market-overview',
    })
  })

  it('keeps an explicit sources/nn/ prefix', () => {
    const r = parseSourceRef('sources/nn/report.md#intro')
    expect(r?.filePath).toBe('sources/nn/report.md')
    expect(r?.kind).toBe('source')
  })

  it('recognises a kNNowledge/ cross-domain reference', () => {
    const r = parseSourceRef('kNNowledge/Business_Plan_V_1-0-0_NN.md#stakeholders')
    expect(r?.filePath).toBe('kNNowledge/Business_Plan_V_1-0-0_NN.md')
    expect(r?.kind).toBe('model')
    expect(r?.slug).toBe('stakeholders')
  })

  it('parses a reference with no slug', () => {
    const r = parseSourceRef('notes.md')
    expect(r).toEqual({
      filePath: 'sources/nn/notes.md',
      fileName: 'notes.md',
      slug: undefined,
      kind: 'source',
      raw: 'notes.md',
    })
  })

  it('rejects a #L line-range anchor', () => {
    expect(parseSourceRef('report.md#L12-L45')).toBeNull()
    expect(parseSourceRef('report.md#L7')).toBeNull()
  })

  it('rejects a src-NNN wrapper', () => {
    expect(parseSourceRef('src-007 report.md#intro')).toBeNull()
    expect(parseSourceRef('src-12')).toBeNull()
  })

  it('rejects a sources/original/ path', () => {
    expect(parseSourceRef('sources/original/report.pdf')).toBeNull()
    expect(parseSourceRef('sources/original/a.md#x')).toBeNull()
  })

  it('rejects http(s) URLs and parent-relative paths', () => {
    expect(parseSourceRef('https://example.com/a.md')).toBeNull()
    expect(parseSourceRef('../outside.md#x')).toBeNull()
  })

  it('returns null for plain non-reference strings', () => {
    expect(parseSourceRef('just some prose')).toBeNull()
    expect(parseSourceRef('')).toBeNull()
  })
})

describe('slugifyHeading', () => {
  it('lowercases and dashes whitespace', () => {
    expect(slugifyHeading('Market Overview')).toBe('market-overview')
  })

  it('strips markdown emphasis and leading hashes', () => {
    expect(slugifyHeading('## **Q3** _Milestones_')).toBe('q3-milestones')
  })

  it('transliterates accented letters (NFD)', () => {
    expect(slugifyHeading('Visión Estratégica')).toBe('vision-estrategica')
    expect(slugifyHeading('Café résumé')).toBe('cafe-resume')
    expect(slugifyHeading('métricas Q3 — año 2026')).toBe('metricas-q3-ano-2026')
  })

  it('still drops characters that have no ASCII transliteration', () => {
    expect(slugifyHeading('Q3 → Q4 (100%)')).toBe('q3-q4-100')
  })

  it('collapses and trims dashes', () => {
    expect(slugifyHeading('  a --- b  ')).toBe('a-b')
  })
})

describe('splitSourceFieldValue', () => {
  it('passes an array through, trimming and dropping blanks', () => {
    expect(splitSourceFieldValue(['a.md#x', ' b.md#y ', '', null])).toEqual(['a.md#x', 'b.md#y'])
  })

  it('splits the bracketed-list string form', () => {
    expect(splitSourceFieldValue('[present.md#overview, missing.md#intro]')).toEqual([
      'present.md#overview',
      'missing.md#intro',
    ])
  })

  it('handles bracketed list with quoted item containing commas', () => {
    expect(
      splitSourceFieldValue('["report, final (2026).md#intro", "notes.md#overview"]'),
    ).toEqual(['report, final (2026).md#intro', 'notes.md#overview'])
  })

  it('handles array input with quoted strings', () => {
    expect(splitSourceFieldValue(['"nested/data, part 1.md#sec"', 'notes.md'])).toEqual([
      'nested/data, part 1.md#sec',
      'notes.md',
    ])
  })

  it('handles single-quoted list items', () => {
    expect(
      splitSourceFieldValue("['report, final (2026).md#intro', 'notes.md#overview']"),
    ).toEqual(['report, final (2026).md#intro', 'notes.md#overview'])
  })

  it('handles escaped commas in unquoted list items', () => {
    expect(
      splitSourceFieldValue('[quarterly\\, report.md#summary, annex.md#data]'),
    ).toEqual(['quarterly, report.md#summary', 'annex.md#data'])
  })

  it('handles mixed quotes and escaped characters', () => {
    expect(
      splitSourceFieldValue('["item1\\, with quotes.md", item2\\, unquoted.md]'),
    ).toEqual(['item1, with quotes.md', 'item2, unquoted.md'])
  })

  it('treats a bare scalar as a one-element list and unquotes/unescapes if needed', () => {
    expect(splitSourceFieldValue('report.md#q3')).toEqual(['report.md#q3'])
    expect(splitSourceFieldValue('"report, final.md#q3"')).toEqual(['report, final.md#q3'])
    expect(splitSourceFieldValue('quarterly\\, report.md#q3')).toEqual(['quarterly, report.md#q3'])
  })

  it('returns [] for empty input', () => {
    expect(splitSourceFieldValue('')).toEqual([])
    expect(splitSourceFieldValue([])).toEqual([])
    expect(splitSourceFieldValue(null)).toEqual([])
    expect(splitSourceFieldValue(undefined)).toEqual([])
  })
})

describe('levenshteinDistance', () => {
  it('computes edit distance accurately (case-insensitive)', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('annual_repots.md', 'annual_reports.md')).toBe(1)
    expect(levenshteinDistance('SAME', 'same')).toBe(0)
    expect(levenshteinDistance('', 'abc')).toBe(3)
    expect(levenshteinDistance('abc', '')).toBe(3)
  })
})

describe('SOURCE_FIELD_NAMES', () => {
  it('exports the single citation field-name set shared by the writer and both readers (H2/H3)', () => {
    expect(SOURCE_FIELD_NAMES).toEqual(new Set(['sources', 'source']))
    expect(SOURCE_FIELD_NAMES.has('sources')).toBe(true)
    expect(SOURCE_FIELD_NAMES.has('source')).toBe(true)
    expect(SOURCE_FIELD_NAMES.has('SOURCES')).toBe(false) // case-folding is the caller's job
    expect(SOURCE_FIELD_NAMES.has('title')).toBe(false)
  })

  it('stays unchanged by the addition of CONFLICT_FIELD_NAMES', () => {
    expect(SOURCE_FIELD_NAMES).toEqual(new Set(['sources', 'source']))
  })
})

describe('CONFLICT_FIELD_NAMES', () => {
  it('exports exactly the reserved "conflicts" property name, separate from SOURCE_FIELD_NAMES', () => {
    expect(CONFLICT_FIELD_NAMES).toEqual(new Set(['conflicts']))
    expect(CONFLICT_FIELD_NAMES.has('conflicts')).toBe(true)
    expect(CONFLICT_FIELD_NAMES.has('sources')).toBe(false)
    expect(SOURCE_FIELD_NAMES.has('conflicts')).toBe(false)
  })
})

describe('extractHeadings', () => {
  it('numbers duplicate slugs the GitHub way', () => {
    const md = ['# Intro', 'text', '## Intro', 'more', '## Intro'].join('\n')
    const hs = extractHeadings(md)
    expect(hs.map((h) => h.slug)).toEqual(['intro', 'intro-1', 'intro-2'])
    expect(hs[1].level).toBe(2)
  })
})

describe('resolveHeadingSection', () => {
  it('returns the span up to the next same-or-higher heading', () => {
    const md = ['# A', 'a1', '## B', 'b1', 'b2', '# C', 'c1'].join('\n')
    const sec = resolveHeadingSection(md, 'b')
    expect(sec?.startLine).toBe(2)
    expect(sec?.endLine).toBe(5)
  })

  it('returns null for an unknown slug', () => {
    expect(resolveHeadingSection('# A\ntext', 'missing')).toBeNull()
  })
})
