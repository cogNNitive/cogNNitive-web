import { describe, it, expect } from 'vitest'
import { printTaxonomyNode } from '../src/parser/taxonomy'
import { serializeModel } from '../src/parser'
import type { ParsedModel } from '../src/types'

/** Minimal ParsedModel with an overridable frontmatter / taxonomy. */
function makeModel(overrides: Partial<ParsedModel>): ParsedModel {
  return {
    frontmatter: { level: 3, knowledge_version: 'V_0-1-0', title: 'Guard Repro' },
    elements: new Map(),
    taxonomy: [],
    matrices: [],
    nodeMarkers: {},
    ...overrides,
  } as unknown as ParsedModel
}

describe('taxonomy / serializer guards', () => {
  it('printTaxonomyNode does not infinite-recurse on a cyclic taxonomy', () => {
    const lines: string[] = []
    printTaxonomyNode(
      '',
      [
        { parent: '', child: 'A' },
        { parent: 'A', child: 'B' },
        { parent: 'B', child: 'A' }, // cycle back to an ancestor
      ],
      lines,
      -1,
    )
    expect(lines).toEqual(['* [[A]]', '  * [[B]]'])
  })

  it('printTaxonomyNode preserves a diamond (shared child under two parents)', () => {
    const lines: string[] = []
    printTaxonomyNode(
      '',
      [
        { parent: '', child: 'A' },
        { parent: 'A', child: 'B' },
        { parent: 'A', child: 'C' },
        { parent: 'B', child: 'D' },
        { parent: 'C', child: 'D' },
      ],
      lines,
      -1,
    )
    expect(lines.filter((l) => l.includes('[[D]]')).length).toBe(2)
  })

  it('serializeModel does not throw on a cyclic taxonomy', () => {
    const model = makeModel({
      taxonomy: [
        { parent: '', child: 'A' },
        { parent: 'A', child: 'B' },
        { parent: 'B', child: 'A' },
      ],
    })
    expect(() => serializeModel(model)).not.toThrow()
  })

  it('serializeModel emits at most one `parent:` frontmatter line', () => {
    const model = makeModel({
      frontmatter: {
        level: 2,
        parent: 'https://example.com/base_V_0-1-0_NN.md',
        title: 'Dup Parent Repro',
      } as unknown as ParsedModel['frontmatter'],
    })
    const serialized = serializeModel(model)
    const parentLines = serialized.split('\n').filter((l) => /^parent:/.test(l))
    expect(parentLines).toHaveLength(1)
  })
})
