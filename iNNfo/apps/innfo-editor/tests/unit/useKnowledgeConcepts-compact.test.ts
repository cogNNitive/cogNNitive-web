import { describe, it, expect } from 'vitest'
import { compactTreeGroup, type TreeGroup } from '../../src/composables/useKnowledgeConcepts'
import type { KnowledgeNode } from '../../src/model/types'

function makeElementNode(id: string, type: string): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    type,
    kind: 'element',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: '' },
  }
}

describe('compactTreeGroup (Path Compression / Compact Folders)', () => {
  it('compacts unary chains of empty parent groups into a single compound group', () => {
    // Artifacts (0 elements) -> Artifacts Catalog (0 elements) -> Artifact (2 elements)
    const element1 = makeElementNode('el-1', 'Artifact')
    const element2 = makeElementNode('el-2', 'Artifact')

    const leafGroup: TreeGroup = {
      name: 'Artifact',
      ghost: false,
      elements: [element1, element2],
      children: [],
    }

    const intermediateGroup: TreeGroup = {
      name: 'Artifacts Catalog',
      ghost: false,
      elements: [],
      children: [leafGroup],
    }

    const rootGroup: TreeGroup = {
      name: 'Artifacts',
      ghost: false,
      elements: [],
      children: [intermediateGroup],
    }

    const result = compactTreeGroup(rootGroup)

    expect(result.name).toBe('Artifacts / Artifacts Catalog / Artifact')
    expect(result.elements).toEqual([element1, element2])
    expect(result.children).toEqual([])
    expect(result.ghost).toBe(false)
  })

  it('does NOT compact when a group has its own direct elements', () => {
    const parentEl = makeElementNode('parent-1', 'Category')
    const childEl = makeElementNode('child-1', 'Item')

    const childGroup: TreeGroup = {
      name: 'Item',
      ghost: false,
      elements: [childEl],
      children: [],
    }

    const parentGroup: TreeGroup = {
      name: 'Category',
      ghost: false,
      elements: [parentEl],
      children: [childGroup],
    }

    const result = compactTreeGroup(parentGroup)

    expect(result.name).toBe('Category')
    expect(result.elements).toEqual([parentEl])
    expect(result.children.length).toBe(1)
    expect(result.children[0].name).toBe('Item')
  })

  it('does NOT compact when a group has multiple children', () => {
    const child1: TreeGroup = {
      name: 'Spec',
      ghost: false,
      elements: [makeElementNode('s1', 'Spec')],
      children: [],
    }
    const child2: TreeGroup = {
      name: 'Template',
      ghost: false,
      elements: [makeElementNode('t1', 'Template')],
      children: [],
    }

    const parentGroup: TreeGroup = {
      name: 'Definitions',
      ghost: false,
      elements: [],
      children: [child1, child2],
    }

    const result = compactTreeGroup(parentGroup)

    expect(result.name).toBe('Definitions')
    expect(result.elements).toEqual([])
    expect(result.children.length).toBe(2)
  })
})
