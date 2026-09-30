import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useModelStore } from '../../src/stores/modelStore'
import { getConceptMeta } from '../../src/composables/useConceptVisuals'
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
  } as KnowledgeNode
}

describe('getConceptMeta — name-based icon/color lookup (moved from LeftSidebar/MatricesGrid)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resolves icon/color for a concept declared on a root localMetamodel, case-insensitively', () => {
    const modelStore = useModelStore()
    const specRoot = makeNode('spec:business', {
      localMetamodel: {
        concepts: [{ name: 'Process', icon: 'workflow', color: 'blue' }],
        markers: [],
      } as any,
    })
    modelStore.setGraph({ 'spec:business': specRoot }, ['spec:business'])

    expect(getConceptMeta('process')).toEqual({ icon: 'workflow', color: 'blue' })
  })

  it('returns {} when no root declares the concept', () => {
    const modelStore = useModelStore()
    modelStore.setGraph({ Root: makeNode('Root') }, ['Root'])

    expect(getConceptMeta('unknown-concept')).toEqual({})
  })
})
