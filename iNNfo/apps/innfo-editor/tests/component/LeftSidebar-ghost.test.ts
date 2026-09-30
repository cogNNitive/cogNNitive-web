import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LeftSidebar from '../../src/components/layout/LeftSidebar.vue'
import { useModelStore } from '../../src/stores/modelStore'
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

describe('LeftSidebar — ghost concept groups (R-TGC-01, R-TGC-05)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows ghost concept groups inline alongside populated ones', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          childIds: ['Root/ExistingItem'],
          localMetamodel: {
            concepts: [
              { name: 'ExistingConcept', type: 'list' },
              { name: 'GhostConcept', type: 'list' },
            ],
            markers: [],
          },
        }),
        'Root/ExistingItem': makeNode('Root/ExistingItem', {
          parentId: 'Root',
          type: 'ExistingConcept',
          kind: 'element',
          source: { path: 'Root' },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    // Models start collapsed by default (feature: "collapsed initial state");
    // expand the model INLINE via the disclosure toggle (F-12) — this must
    // NOT leave workspace overview mode, unlike clicking the model name.
    await wrapper.find('[data-testid="model-header-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Expand empty/inactive groups section to see ghost concept headers
    const emptyToggle = wrapper.find('[data-testid="empty-groups-toggle"]')
    if (emptyToggle.exists()) {
      await emptyToggle.trigger('click')
      await wrapper.vm.$nextTick()
    }

    // Ghost groups are rendered inline, no separate section container
    expect(wrapper.find('[data-testid="ghost-concepts-section"]').exists()).toBe(false)
    // But ghost group headers exist in the tree
    const ghostHeaders = wrapper.findAll('[data-testid="ghost-group-header"]')
    expect(ghostHeaders.length).toBeGreaterThan(0)
    expect(ghostHeaders[0].text()).toContain('GhostConcept')
  })
})
