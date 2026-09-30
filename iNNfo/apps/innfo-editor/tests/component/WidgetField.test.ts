import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import WidgetField from '../../src/shared/widgets/WidgetField.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(id: string, fieldKey: string, value: unknown): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    storageMode: 'FILE',
    type: 'text',
    fields: {
      [fieldKey]: {
        value,
        editAttribution: {
          author: { kind: 'system', id: 'parser' },
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
    },
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
  }
}

describe('WidgetField: dispatches to ported widget or FallbackWidget (R15)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the correct ported widget for a known type ("text")', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', 'summary', 'Hello') }, ['Root'])

    const wrapper = mount(WidgetField, {
      props: { nodeId: 'Root', fieldKey: 'summary', widgetType: 'text' },
    })

    expect(wrapper.find('.text-widget').exists()).toBe(true)
    expect(wrapper.find('.fallback-widget').exists()).toBe(false)
  })

  it('renders FallbackWidget for an unrecognized widget type, not a crash or blank field', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', 'steps', 'Step 1') }, ['Root'])

    const wrapper = mount(WidgetField, {
      props: { nodeId: 'Root', fieldKey: 'steps', widgetType: 'steps' },
    })

    expect(wrapper.find('.fallback-widget').exists()).toBe(true)
    expect(wrapper.text()).toContain('Step 1')
  })

  it('records editAttribution on the field when the user commits an edit (R16)', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', 'summary', 'Hello') }, ['Root'])

    const wrapper = mount(WidgetField, {
      props: { nodeId: 'Root', fieldKey: 'summary', widgetType: 'text', authorId: 'user-1' },
    })

    await wrapper.get('input').setValue('Edited')

    const node = knowledgeStore.getNode('Root')!
    expect(node.fields.summary.value).toBe('Edited')
    expect(node.fields.summary.editAttribution.author).toEqual({ kind: 'user', id: 'user-1' })
  })

  it('records no new editAttribution beyond parse-time state when the node is only loaded, not edited (R16)', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', 'summary', 'Hello') }, ['Root'])

    mount(WidgetField, {
      props: { nodeId: 'Root', fieldKey: 'summary', widgetType: 'text', authorId: 'user-1' },
    })

    const node = knowledgeStore.getNode('Root')!
    expect(node.fields.summary.editAttribution.author).toEqual({ kind: 'system', id: 'parser' })
    expect(knowledgeStore.isDirty('Root')).toBe(false)
  })
})
