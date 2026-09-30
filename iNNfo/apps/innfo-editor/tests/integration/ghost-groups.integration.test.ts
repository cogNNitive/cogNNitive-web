import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LeftSidebar from '../../src/components/layout/LeftSidebar.vue'
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

describe('Ghost groups — Add action integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('knowledgeStore.addConceptElement creates a child element and reduces ghost count', () => {
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

    const metamodelStore = useMetamodelStore()
    expect(metamodelStore.ghostConcepts).toHaveLength(2)

    // Add an element of type Task
    const newId = knowledgeStore.addConceptElement('Task', 'My first task')
    expect(newId).toBe('Root/My first task')

    // Verify element was created
    const newNode = knowledgeStore.getNode(newId)
    expect(newNode).toBeDefined()
    expect(newNode!.type).toBe('Task')
    expect(newNode!.kind).toBe('element')
    expect(newNode!.parentId).toBe('Root')

    // Ghost concepts should now exclude Task
    expect(metamodelStore.ghostConcepts).toHaveLength(1)
    expect(metamodelStore.ghostConcepts[0].name).toBe('Note')
  })

  it('addConceptElement throws when no root exists', () => {
    const knowledgeStore = useKnowledgeStore()
    expect(() => knowledgeStore.addConceptElement('Task', 'My Task')).toThrow('No root node')
  })

  it('clicking a ghost group header in LeftSidebar selects virtual concept ID without creating element', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          childIds: [],
          localMetamodel: {
            concepts: [{ name: 'Task', type: 'list' }],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const metamodelStore = useMetamodelStore()

    expect(metamodelStore.ghostConcepts).toHaveLength(1)

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    // Models start collapsed by default (feature: "collapsed initial state");
    // expand the model INLINE via the disclosure toggle (F-12) before
    // inspecting its rendered tree.
    await wrapper.find('[data-testid="model-header-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()

    const emptyToggle = wrapper.find('[data-testid="empty-groups-toggle"]')
    if (emptyToggle.exists()) {
      await emptyToggle.trigger('click')
      await wrapper.vm.$nextTick()
    }

    // Find and click the ghost group header
    const ghostHeader = wrapper.find('[data-testid="ghost-group-header"]')
    expect(ghostHeader.exists()).toBe(true)
    await ghostHeader.trigger('click')

    // It should NOT create elements immediately, so ghost count remains 1
    expect(metamodelStore.ghostConcepts).toHaveLength(1)

    // The select-node event should be emitted by LeftSidebar with the virtual concept node ID
    expect(wrapper.emitted('select-node')).toBeTruthy()
    expect(wrapper.emitted('select-node')![0]).toEqual(['virtual:Root:Task'])
  })
})
