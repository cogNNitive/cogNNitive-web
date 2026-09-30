import { describe, it, expect } from 'vitest'
import { getConceptFieldsForNode, getMergedBlockFields } from '../../src/utils/metamodelHelper'
import type { KnowledgeNode } from '../../src/model/types'

describe('metamodelHelper', () => {
  const mockGetConceptFields = (type: string) => {
    if (type === 'risk') {
      return [
        { name: 'probability', type: 'number' },
        { name: 'impact', type: 'number' },
        { name: 'mitigated', type: 'boolean' },
      ]
    }
    return []
  }

  it('merges metamodel fields with node fields correctly', () => {
    const node: KnowledgeNode = {
      id: 'node1',
      name: 'node1',
      parentId: null,
      childIds: [],
      type: 'risk',
      fields: {
        probability: {
          value: 3,
          editAttribution: { author: { kind: 'system', id: 'p' }, timestamp: '' },
        },
        custom_field: {
          value: 'custom',
          editAttribution: { author: { kind: 'system', id: 'p' }, timestamp: '' },
        },
      },
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: '' },
    }

    const mergedDefs = getConceptFieldsForNode(node, mockGetConceptFields)
    expect(mergedDefs).toEqual([
      { name: 'probability', type: 'number' },
      { name: 'impact', type: 'number' },
      { name: 'mitigated', type: 'boolean' },
      { name: 'custom_field', type: 'string' },
    ])

    const mergedFields = getMergedBlockFields(node, mockGetConceptFields)
    expect(mergedFields).toEqual({
      probability: 3,
      impact: '',
      mitigated: false,
      custom_field: 'custom',
    })
  })

  it('handles empty node fields and returns defaults correctly', () => {
    const node: KnowledgeNode = {
      id: 'node2',
      name: 'node2',
      parentId: null,
      childIds: [],
      type: 'risk',
      fields: {},
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: '' },
    }

    const mergedDefs = getConceptFieldsForNode(node, mockGetConceptFields)
    expect(mergedDefs).toEqual([
      { name: 'probability', type: 'number' },
      { name: 'impact', type: 'number' },
      { name: 'mitigated', type: 'boolean' },
    ])

    const mergedFields = getMergedBlockFields(node, mockGetConceptFields)
    expect(mergedFields).toEqual({
      probability: '',
      impact: '',
      mitigated: false,
    })
  })
})
