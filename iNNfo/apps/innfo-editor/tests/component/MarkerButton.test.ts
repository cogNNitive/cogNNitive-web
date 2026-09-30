import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import MarkerButton from '../../src/components/editor/MarkerButton.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(id: string, name: string, markers: Record<string, number | string>): KnowledgeNode {
  return {
    id,
    name,
    parentId: null,
    childIds: [],
    type: 'element',
    fields: {},
    markers,
    relationships: [],
    rawSections: {},
    source: { path: id },
  }
}

describe('MarkerButton.vue — single unified marker interaction', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the marker glyph with a stable test id', () => {
    const wrapper = mount(MarkerButton, {
      props: { markerName: 'completion' },
    })
    expect(wrapper.find('[data-testid="marker-completion"]').exists()).toBe(true)
  })

  it('shows marker description and its value scale on hover', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', 'Root', { completion: 2 }) }, ['Root'])

    const wrapper = mount(MarkerButton, {
      props: { markerName: 'completion', nodeId: 'Root' },
      attachTo: document.body,
    })

    await wrapper.element.dispatchEvent(new MouseEvent('mouseenter'))
    await wrapper.vm.$nextTick()

    const body = document.body.textContent ?? ''
    expect(body).toContain('How complete this element is')
    expect(body).toContain('0 Not set')
    expect(body).toContain('3 High')
  })

  it('cycles the marker value on click when interactive', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', 'Root', { priority: 1 }) }, ['Root'])

    const wrapper = mount(MarkerButton, {
      props: { markerName: 'priority', nodeId: 'Root' },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="marker-priority"]').trigger('click')
    expect(knowledgeStore.getNode('Root')?.markers['priority']).toBe(2)
  })

  it('does not cycle the value when interactive is false', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', 'Root', { rating: 3 }) }, ['Root'])

    const wrapper = mount(MarkerButton, {
      props: { markerName: 'rating', nodeId: 'Root', interactive: false },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="marker-rating"]').trigger('click')
    expect(knowledgeStore.getNode('Root')?.markers['rating']).toBe(3)
  })
})
