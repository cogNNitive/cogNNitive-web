import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import VirtualGroupNode from '../../src/components/layout/VirtualGroupNode.vue'
import { useModelStore } from '../../src/stores/modelStore'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: 'Root',
    childIds: [],
    type: 'Source',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
    ...overrides,
  }
}

describe('VirtualGroupNode — progressive batch rendering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders initial 60 items when given 250 elements and displays show-more button', async () => {
    const modelStore = useModelStore()
    const nodes: Record<string, KnowledgeNode> = {
      Root: makeNode('Root', {
        parentId: null,
        localMetamodel: {
          concepts: [{ name: 'Source', type: 'list', color: 'cyan', icon: 'file-text' }],
          markers: [],
        },
      }),
    }

    const elements: KnowledgeNode[] = []
    for (let i = 0; i < 250; i++) {
      const el = makeNode(`source-${i}`, { name: `Source ${i}` })
      nodes[el.id] = el
      elements.push(el)
    }

    modelStore.setGraph(nodes, ['Root'])

    const wrapper = mount(VirtualGroupNode, {
      props: {
        conceptName: 'Source',
        elements,
        selectedId: null,
      },
    })

    // Initially collapsed — total count badge shows 250
    expect(wrapper.text()).toContain('250')

    // Find children when not collapsed
    const showMoreButton = wrapper.find('[data-testid="show-more-elements"]')
    expect(showMoreButton.exists()).toBe(true)
    expect(showMoreButton.text()).toContain('Showing 60 of 250')
    expect(showMoreButton.text()).toContain('Show all (+190)')

    // Click show more to expand all 250 elements
    await showMoreButton.trigger('click')
    expect(wrapper.find('[data-testid="show-more-elements"]').exists()).toBe(false)
  })

  it('automatically expands renderLimit if selectedId is past the initial batch', async () => {
    const modelStore = useModelStore()
    const nodes: Record<string, KnowledgeNode> = {
      Root: makeNode('Root', { parentId: null }),
    }

    const elements: KnowledgeNode[] = []
    for (let i = 0; i < 150; i++) {
      const el = makeNode(`source-${i}`, { name: `Source ${i}` })
      nodes[el.id] = el
      elements.push(el)
    }

    modelStore.setGraph(nodes, ['Root'])

    const wrapper = mount(VirtualGroupNode, {
      props: {
        conceptName: 'Source',
        elements,
        selectedId: 'source-100', // item beyond initial 60
      },
    })

    const showMoreButton = wrapper.find('[data-testid="show-more-elements"]')
    if (showMoreButton.exists()) {
      // Must show at least past 100 items (120)
      expect(showMoreButton.text()).toContain('Showing 120 of 150')
    }
  })
})
