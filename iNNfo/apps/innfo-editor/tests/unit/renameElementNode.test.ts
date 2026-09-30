import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { useUiStore } from '../../src/stores/uiStore'

describe('knowledgeStore.renameElementNode propagation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renames node and propagates across referencing fields and wikilinks', () => {
    const store = useKnowledgeStore()
    store.setGraph(
      {
        'doc/node1': {
          id: 'doc/node1',
          name: 'Task Alpha',
          type: 'Task',
          parentId: 'doc',
          childIds: [],
          fields: {
            assignee: {
              value: 'Task Beta',
              editAttribution: { author: { kind: 'system', id: 'test' }, timestamp: '' },
            },
            notes: {
              value: 'Refers to [[Task Beta|secondary task]]',
              editAttribution: { author: { kind: 'system', id: 'test' }, timestamp: '' },
            },
          },
          markers: {},
        },
        'doc/node2': {
          id: 'doc/node2',
          name: 'Task Beta',
          type: 'Task',
          parentId: 'doc',
          childIds: [],
          fields: {},
          markers: {},
        },
      },
      ['doc'],
    )

    store.renameElementNode('doc/node2', 'Task Gamma')

    const node1 = store.getNode('doc/node1')
    expect(node1?.fields['assignee']?.value).toBe('Task Gamma')
    expect(node1?.fields['notes']?.value).toBe('Refers to [[Task Gamma|secondary task]]')

    const node2 = store.getNode('doc/node2/Task Gamma') || store.getNode('doc/node2')
    expect(node2).toBeDefined()
    expect(node2?.name).toBe('Task Gamma')
  })

  it('marks root node as dirty and serializes renamed element in recursiveSerialize', async () => {
    const store = useKnowledgeStore()
    const rootId = 'doc'
    store.setGraph(
      {
        [rootId]: {
          id: rootId,
          name: 'doc',
          type: 'document',
          parentId: null,
          childIds: ['doc/node1'],
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          rawContent:
            '---\nspec_version: "V_0-1-1"\ntitle: "Doc"\n---\n# _NN Problems\n\n* _NN Problems: Task Beta\n  Initial description.\n',
          source: { path: 'doc.md' },
        },
        'doc/node1': {
          id: 'doc/node1',
          name: 'Task Beta',
          type: 'Problems',
          parentId: rootId,
          childIds: [],
          fields: {},
          markers: {},
          relationships: [],
          rawSections: { description: '  Initial description.' },
          source: { path: 'doc.md' },
          kind: 'element',
        },
      },
      [rootId],
    )

    // Clear dirty flags set by setGraph
    store.dirtyIds.clear()

    // 1. Rename element
    store.renameElementNode('doc/node1', 'Task Gamma')

    // Expect child node to have new name
    const renamedChild = store.getNode('doc/Task Gamma') || store.getNode('doc/node1')
    expect(renamedChild).toBeDefined()
    expect(renamedChild?.name).toBe('Task Gamma')

    // Expect root node to be marked dirty
    expect(store.dirtyIds.has(rootId)).toBe(true)

    // 2. Serialize
    const { recursiveSerialize } = await import('../../src/model/recursiveSerializer')

    // We don't pass a driver so it just updates rawContent in nodes and returns report
    const reports = await recursiveSerialize(store.nodes, store.dirtyIds)

    expect(reports).toHaveLength(1)
    expect(reports[0].path).toBe('doc.md')

    const rootNode = store.getNode(rootId)
    expect(rootNode?.rawContent).toContain('Task Gamma')
    expect(rootNode?.rawContent).not.toContain('Task Beta')
  })

  it('updates selectedNodeId in uiStore if the renamed node is currently selected', () => {
    const store = useKnowledgeStore()
    const uiStore = useUiStore()

    const rootId = 'doc'
    store.setGraph(
      {
        [rootId]: {
          id: rootId,
          name: 'doc',
          type: 'document',
          parentId: null,
          childIds: ['doc/Task Beta'],
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'doc.md' },
        },
        'doc/Task Beta': {
          id: 'doc/Task Beta',
          name: 'Task Beta',
          type: 'Problems',
          parentId: rootId,
          childIds: [],
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'doc.md' },
          kind: 'element',
        },
      },
      [rootId],
    )

    // Select the node
    uiStore.selectNode('doc/Task Beta')
    expect(uiStore.selectedNodeId).toBe('doc/Task Beta')

    // Rename the node
    store.renameElementNode('doc/Task Beta', 'Task Gamma')

    // Expect selection to have updated to the new ID
    expect(uiStore.selectedNodeId).toBe('doc/Task Gamma')
  })

  it('does not re-validate an unrelated model when renaming inside another one (F-15)', () => {
    const store = useKnowledgeStore()
    store.setGraph(
      {
        modelA: {
          id: 'modelA',
          name: 'modelA',
          type: 'document',
          parentId: null,
          childIds: ['modelA/node1'],
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          rawContent:
            '---\nspec_version: "V_0-1-1"\ntitle: "A"\n---\n# _NN Problems\n\n* _NN Problems: Task Beta\n',
          source: { path: 'modelA.md' },
        },
        'modelA/node1': {
          id: 'modelA/node1',
          name: 'Task Beta',
          type: 'Problems',
          parentId: 'modelA',
          childIds: [],
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'modelA.md' },
          kind: 'element',
        },
        modelB: {
          id: 'modelB',
          name: 'modelB',
          type: 'document',
          parentId: null,
          childIds: ['modelB/node1'],
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          rawContent:
            '---\nspec_version: "V_0-1-1"\ntitle: "B"\n---\n# _NN Problems\n\n* _NN Problems: Task Zeta\n',
          source: { path: 'modelB.md' },
        },
        'modelB/node1': {
          id: 'modelB/node1',
          name: 'Task Zeta',
          type: 'Problems',
          parentId: 'modelB',
          childIds: [],
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'modelB.md' },
          kind: 'element',
        },
      },
      ['modelA', 'modelB'],
    )

    const reportBBefore = store.validationReports['modelB']
    expect(reportBBefore).toBeDefined()

    store.renameElementNode('modelA/node1', 'Task Gamma')

    // Same object reference proves modelB's report was reused, not recomputed.
    expect(store.validationReports['modelB']).toBe(reportBBefore)
    expect(store.validationReports['modelA']).toBeDefined()
  })
})
