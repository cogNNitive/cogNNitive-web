import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { useMetamodelStore } from '../../src/stores/metamodelStore'
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

describe('metamodelStore: ghostConcepts computed', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns all template concepts as ghosts when none are instantiated', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          localMetamodel: {
            concepts: [
              { name: 'Description', type: 'text', icon: 'file-text' },
              { name: 'Requirement', type: 'list', icon: 'list' },
              { name: 'Category', type: 'category', icon: 'folder' },
            ],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const store = useMetamodelStore()
    expect(store.ghostConcepts).toHaveLength(3)
    expect(store.ghostConcepts.map((c) => c.name)).toEqual([
      'Description',
      'Requirement',
      'Category',
    ])
  })

  it('excludes concepts that have instantiated elements', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          childIds: ['Root/Req1'],
          localMetamodel: {
            concepts: [
              { name: 'Description', type: 'text', icon: 'file-text' },
              { name: 'Requirement', type: 'list', icon: 'list' },
            ],
            markers: [],
          },
        }),
        'Root/Req1': makeNode('Root/Req1', {
          parentId: 'Root',
          type: 'Requirement',
          kind: 'element',
        }),
      },
      ['Root'],
    )

    const store = useMetamodelStore()
    expect(store.ghostConcepts).toHaveLength(1)
    expect(store.ghostConcepts[0].name).toBe('Description')
  })

  it('excludes text concept present in rawSections', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          rawSections: { Description: 'Some text' },
          localMetamodel: {
            concepts: [
              { name: 'Description', type: 'text' },
              { name: 'Notes', type: 'text' },
            ],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const store = useMetamodelStore()
    expect(store.ghostConcepts).toHaveLength(1)
    expect(store.ghostConcepts[0].name).toBe('Notes')
  })

  it('excludes category concept that has children', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          childIds: ['Root/CategoryGroup'],
          localMetamodel: {
            concepts: [
              { name: 'Phase', type: 'category' },
              { name: 'Standalone', type: 'list' },
            ],
            markers: [],
          },
        }),
        'Root/CategoryGroup': makeNode('Root/CategoryGroup', {
          parentId: 'Root',
          type: 'Phase',
          childIds: ['Root/CategoryGroup/Item1'],
          kind: 'concept',
        }),
        'Root/CategoryGroup/Item1': makeNode('Root/CategoryGroup/Item1', {
          parentId: 'Root/CategoryGroup',
          kind: 'element',
        }),
      },
      ['Root'],
    )

    const store = useMetamodelStore()
    expect(store.ghostConcepts).toHaveLength(1)
    expect(store.ghostConcepts[0].name).toBe('Standalone')
  })

  it('returns empty array when no root node exists', () => {
    const store = useMetamodelStore()
    expect(store.ghostConcepts).toEqual([])
  })

  it('returns empty array when template has no concepts', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          localMetamodel: { concepts: [], markers: [] },
        }),
      },
      ['Root'],
    )

    const store = useMetamodelStore()
    expect(store.ghostConcepts).toEqual([])
  })

  it('reactively updates when a new element is added', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          childIds: [],
          localMetamodel: {
            concepts: [
              { name: 'Task', type: 'list' },
              { name: 'Note', type: 'text' },
            ],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const store = useMetamodelStore()
    expect(store.ghostConcepts).toHaveLength(2)

    // Add an element of type Task
    knowledgeStore.addConceptElement('Task', 'My Task')
    expect(store.ghostConcepts).toHaveLength(1)
    expect(store.ghostConcepts[0].name).toBe('Note')
  })
})
