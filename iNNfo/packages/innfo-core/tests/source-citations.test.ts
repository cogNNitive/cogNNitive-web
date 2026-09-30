import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachSourceCitations } from '../src/recursiveParser/normalize'
import { parseKnowledge, serializeKnowledge } from '../src/parser'
import type { KnowledgeNode } from '../src/types'

function field(value: unknown): KnowledgeNode['fields'][string] {
  return { value, editAttribution: { author: { kind: 'system', id: 'test' }, timestamp: '' } }
}

function elementNode(fields: Record<string, unknown>): KnowledgeNode {
  return {
    id: 'elem-1',
    name: 'Enterprise Clients',
    parentId: 'root-1',
    childIds: [],
    type: 'Stakeholders',
    kind: 'element',
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, field(v)])),
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: 'kNNowledge/Plan_V_1-0-0_NN.md' },
  }
}

describe('attachSourceCitations', () => {
  it('attaches parsed refs from a list-valued sources field and one edge each', () => {
    const node = elementNode({
      sources: ['interview.md#clients', 'notes/kickoff.md#priorities'],
      relationship_model: 'B2B',
    })
    attachSourceCitations(node)

    expect(node.sources?.map((s) => s.filePath)).toEqual([
      'sources/nn/interview.md',
      'sources/nn/notes/kickoff.md',
    ])
    const sourceEdges = node.relationships.filter((r) => r.origin === 'source')
    expect(sourceEdges).toEqual([
      { targetId: 'sources/nn/interview.md', label: 'sources', origin: 'source' },
      { targetId: 'sources/nn/notes/kickoff.md', label: 'sources', origin: 'source' },
    ])
  })

  it('accepts a scalar single value', () => {
    const node = elementNode({ sources: 'report.md#q3' })
    attachSourceCitations(node)
    expect(node.sources).toHaveLength(1)
    expect(node.sources?.[0].slug).toBe('q3')
  })

  it('is case-insensitive on the field name', () => {
    const node = elementNode({ Source: 'a.md' })
    attachSourceCitations(node)
    expect(node.sources?.[0].filePath).toBe('sources/nn/a.md')
  })

  it('does not populate node.sources when no value parses', () => {
    const node = elementNode({ sources: ['report.md#L1-L9', 'src-3 a.md'] })
    attachSourceCitations(node)
    expect(node.sources).toBeUndefined()
    expect(node.relationships.filter((r) => r.origin === 'source')).toHaveLength(0)
  })

  it('keeps only the parseable subset', () => {
    const node = elementNode({ sources: ['ok.md#intro', 'bad.md#L4'] })
    attachSourceCitations(node)
    expect(node.sources?.map((s) => s.filePath)).toEqual(['sources/nn/ok.md'])
  })

  it('ignores nodes with no source field', () => {
    const node = elementNode({ relationship_model: 'B2B' })
    attachSourceCitations(node)
    expect(node.sources).toBeUndefined()
  })
})

// H2/H3: the serialized `sources::` form written by the mutation engine must
// round-trip through the citation reader byte-identically, and this MUST NOT
// change serialization of any other field type (design.md Decision 1).
const LEVEL3_TEMPLATE = (propertyLine: string) => `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "Fixture"
  url: "https://example.test/fixture"
title: "Fixture Model"
---

# NN Stakeholder
## NN Stakeholder: Acme
${propertyLine}
`

describe('serializePropertyValue citation round-trip (H3b, via parseKnowledge/serializeKnowledge)', () => {
  it('round-trips a multi-value sources list byte-identically', () => {
    const model1 = parseKnowledge(LEVEL3_TEMPLATE('sources:: [a.md#x, b.md#y]'))
    const element1 = model1.elements.get('Stakeholder')?.[0]
    expect(element1?.fields.sources).toEqual(['a.md#x', 'b.md#y'])

    const serialized1 = serializeKnowledge(model1)
    expect(serialized1).toContain('sources:: [a.md#x, b.md#y]')

    const model2 = parseKnowledge(serialized1)
    expect(model2.elements.get('Stakeholder')?.[0].fields.sources).toEqual(['a.md#x', 'b.md#y'])
    expect(serializeKnowledge(model2)).toBe(serialized1)
  })

  it('round-trips a scalar source value byte-identically, with no spurious quoting', () => {
    const model1 = parseKnowledge(LEVEL3_TEMPLATE('sources:: a.md#x'))
    expect(model1.elements.get('Stakeholder')?.[0].fields.sources).toBe('a.md#x')

    const serialized1 = serializeKnowledge(model1)
    expect(serialized1).toContain('sources:: a.md#x')
    expect(serialized1).not.toContain('"a.md#x"')

    const model2 = parseKnowledge(serialized1)
    expect(model2.elements.get('Stakeholder')?.[0].fields.sources).toBe('a.md#x')
    expect(serializeKnowledge(model2)).toBe(serialized1)
  })

  it('round-trips an empty sources list', () => {
    const model1 = parseKnowledge(LEVEL3_TEMPLATE('sources:: []'))
    expect(model1.elements.get('Stakeholder')?.[0].fields.sources).toEqual([])

    const serialized1 = serializeKnowledge(model1)
    expect(serialized1).toContain('sources:: []')

    const model2 = parseKnowledge(serialized1)
    expect(model2.elements.get('Stakeholder')?.[0].fields.sources).toEqual([])
    expect(serializeKnowledge(model2)).toBe(serialized1)
  })

  it('falls back to JSON.stringify for a comma-containing item, unchanged from today', () => {
    const model = parseKnowledge(LEVEL3_TEMPLATE('note:: keep'))
    const element = model.elements.get('Stakeholder')?.[0]
    expect(element).toBeDefined()
    element!.fields.sources = ['a,b.md#x']

    const serialized = serializeKnowledge(model)
    expect(serialized).toContain(`sources:: ${JSON.stringify(['a,b.md#x'])}`)
  })

  // Requirement 5 (document-fidelity spec): the bracket-list grammar that
  // already applied to citation fields is now the general rule for EVERY
  // list-valued property, not a citation-only special case.
  it('serializes non-citation array fields with the same bracket-list grammar as citation fields', () => {
    const fieldNames = ['options', 'values', 'applies_to', 'target_concepts', 'needs']
    for (const fieldName of fieldNames) {
      const model = parseKnowledge(LEVEL3_TEMPLATE('note:: keep'))
      const element = model.elements.get('Stakeholder')?.[0]
      element!.fields[fieldName] = ['.md', '.csv']
      const serialized = serializeKnowledge(model)
      expect(serialized).toContain(`${fieldName}:: [.md, .csv]`)
    }
  })

  // AD-1: canonical scalar values are written unquoted (`category:: cost`,
  // not `category:: "cost"`) whenever that round-trips safely.
  it('serializes a non-citation scalar field unquoted, matching canonical form', () => {
    const model1 = parseKnowledge(LEVEL3_TEMPLATE('category:: cost'))
    const serialized1 = serializeKnowledge(model1)
    expect(serialized1).toContain('category:: cost')
    expect(serialized1).not.toContain('category:: "cost"')
  })
})

describe('corpus round-trip: parse -> serialize is a fixed point for every real model sample', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const templatesDir = join(here, '..', '..', '..', 'specs', 'bluepriNNts')

  function findSampleModels(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        out.push(...findSampleModels(full))
      } else if (
        entry.isFile() &&
        entry.name.endsWith('_NN.md') &&
        basename(dir) === 'samples'
      ) {
        out.push(full)
      }
    }
    return out
  }

  const corpus = findSampleModels(templatesDir)

  it('finds at least one sample model under specs/bluepriNNts/**/samples to verify against', () => {
    expect(corpus.length).toBeGreaterThan(0)
  })

  // Scope: field-VALUE round-trip stability (parse -> serialize -> parse
  // preserves every element's `fields` byte-identically), not whole-document
  // text equality. Prose/description formatting is out of scope for H2/H3 and
  // has its own, unrelated, pre-existing round-trip characteristics.
  it.each(corpus)('every element field round-trips byte-identically: %s', (file) => {
    const raw = readFileSync(file, 'utf8')
    const model1 = parseKnowledge(raw)
    const serialized1 = serializeKnowledge(model1)
    const model2 = parseKnowledge(serialized1)

    for (const [conceptName, elements1] of model1.elements.entries()) {
      const elements2 = model2.elements.get(conceptName) ?? []
      elements1.forEach((el1, idx) => {
        expect(elements2[idx]?.fields).toEqual(el1.fields)
      })
    }
  })
})
