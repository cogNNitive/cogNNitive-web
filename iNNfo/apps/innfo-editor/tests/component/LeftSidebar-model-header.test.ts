import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LeftSidebar from '../../src/components/layout/LeftSidebar.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { useUiStore } from '../../src/stores/uiStore'
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

describe('LeftSidebar — model header toggle vs focus (F-12)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function seedSingleModel() {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          childIds: ['Root/Item'],
          localMetamodel: { concepts: [{ name: 'Concept', type: 'list' }], markers: [] },
        }),
        'Root/Item': makeNode('Root/Item', {
          parentId: 'Root',
          type: 'Concept',
          kind: 'element',
          source: { path: 'Root' },
        }),
      },
      ['Root'],
    )
  }

  it('clicking the disclosure toggle expands the model inline WITHOUT leaving workspace overview mode', async () => {
    seedSingleModel()
    const uiStore = useUiStore()
    const wrapper = mount(LeftSidebar, { attachTo: document.body })

    expect(uiStore.sidebarMode).toBe('workspace')

    await wrapper.find('[data-testid="model-header-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Still in workspace overview — expanding inline must not focus the model.
    expect(uiStore.sidebarMode).toBe('workspace')
    // The tree content for the model is now rendered.
    expect(wrapper.find('[data-testid="virtual-group-node"]').exists()).toBe(true)
  })

  it('clicking the model name focuses the model (Focused Model Mode)', async () => {
    seedSingleModel()
    const uiStore = useUiStore()
    const wrapper = mount(LeftSidebar, { attachTo: document.body })

    await wrapper.find('[data-testid="model-header-name"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(uiStore.sidebarMode).toBe('focused_model')
    expect(uiStore.focusedModelId).toBe('Root')
  })
})
