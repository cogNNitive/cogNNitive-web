import { describe, it, expect } from 'vitest'
import { isConceptPresent } from '../../src/utils/ghostDetection'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    type: 'text',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
    ...overrides,
  }
}

describe('isConceptPresent — type-specific detection rules', () => {
  /* ── text type: rawSections ── */

  it('detects text concept via rawSections key on root node', () => {
    const nodes = {
      Root: makeNode('Root', {
        rawSections: { Description: 'Some text content' },
      }),
    }
    expect(isConceptPresent('Description', 'text', nodes, ['Root'])).toBe(true)
  })

  it('detects text concept case-insensitively', () => {
    const nodes = {
      Root: makeNode('Root', {
        rawSections: { DESCRIPTION: 'Content' },
      }),
    }
    expect(isConceptPresent('description', 'text', nodes, ['Root'])).toBe(true)
  })

  it('returns false for text concept missing from rawSections', () => {
    const nodes = {
      Root: makeNode('Root', {
        rawSections: { OtherSection: 'Content' },
      }),
    }
    expect(isConceptPresent('MissingConcept', 'text', nodes, ['Root'])).toBe(false)
  })

  it('returns false for text concept when root has no rawSections', () => {
    const nodes = {
      Root: makeNode('Root'),
    }
    expect(isConceptPresent('Description', 'text', nodes, ['Root'])).toBe(false)
  })

  /* ── list type: graph node type match ── */

  it('detects list concept via element node with matching type (concept name)', () => {
    const nodes = {
      Root: makeNode('Root', { childIds: ['Root/Item1'] }),
      'Root/Item1': makeNode('Root/Item1', {
        parentId: 'Root',
        type: 'Requirement',
        kind: 'element',
      }),
    }
    expect(isConceptPresent('Requirement', 'list', nodes, ['Root'])).toBe(true)
  })

  it('returns false for list concept with no matching node type', () => {
    const nodes = {
      Root: makeNode('Root', { childIds: ['Root/Item1'] }),
      'Root/Item1': makeNode('Root/Item1', {
        parentId: 'Root',
        type: 'OtherType',
        kind: 'element',
      }),
    }
    expect(isConceptPresent('Requirement', 'list', nodes, ['Root'])).toBe(false)
  })

  /* ── category type: node with matching type AND children ── */

  it('detects category concept when node has matching type (concept name) and children', () => {
    const nodes = {
      Root: makeNode('Root'),
      'Root/Phase': makeNode('Root/Phase', {
        parentId: 'Root',
        type: 'Phase',
        childIds: ['Root/Phase/Item1'],
      }),
      'Root/Phase/Item1': makeNode('Root/Phase/Item1', { parentId: 'Root/Phase' }),
    }
    expect(isConceptPresent('Phase', 'category', nodes, ['Root'])).toBe(true)
  })

  it('returns false for category concept with no children', () => {
    const nodes = {
      Root: makeNode('Root'),
      'Root/Empty': makeNode('Root/Empty', { parentId: 'Root', type: 'Phase', childIds: [] }),
    }
    expect(isConceptPresent('Phase', 'category', nodes, ['Root'])).toBe(false)
  })

  it('returns false for category concept when no node has the matching type', () => {
    const nodes = {
      Root: makeNode('Root', { childIds: ['Root/C'] }),
      'Root/C': makeNode('Root/C', { parentId: 'Root', type: 'Other' }),
    }
    expect(isConceptPresent('Phase', 'category', nodes, ['Root'])).toBe(false)
  })

  /* ── weight / steps / sequence: match by node type ── */

  it('detects weight concept via matching node type (concept name)', () => {
    const nodes = {
      Root: makeNode('Root', { childIds: ['Root/W'] }),
      'Root/W': makeNode('Root/W', {
        parentId: 'Root',
        type: 'Priority',
        kind: 'element',
      }),
    }
    expect(isConceptPresent('Priority', 'weight', nodes, ['Root'])).toBe(true)
  })

  it('detects steps concept via matching node type (concept name)', () => {
    const nodes = {
      Root: makeNode('Root', { childIds: ['Root/S'] }),
      'Root/S': makeNode('Root/S', { parentId: 'Root', type: 'Phase', kind: 'element' }),
    }
    expect(isConceptPresent('Phase', 'steps', nodes, ['Root'])).toBe(true)
  })

  it('detects sequence concept via matching node type (concept name)', () => {
    const nodes = {
      Root: makeNode('Root', { childIds: ['Root/Q'] }),
      'Root/Q': makeNode('Root/Q', { parentId: 'Root', type: 'Question', kind: 'element' }),
    }
    expect(isConceptPresent('Question', 'sequence', nodes, ['Root'])).toBe(true)
  })

  /* ── Edge cases ── */

  it('returns false when rootIds is empty', () => {
    expect(isConceptPresent('Anything', 'text', {}, [])).toBe(false)
  })

  it('returns false when root node does not exist in nodes map', () => {
    expect(isConceptPresent('Anything', 'text', {}, ['MissingRoot'])).toBe(false)
  })
})
