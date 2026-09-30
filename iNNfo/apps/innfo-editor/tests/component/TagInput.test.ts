import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import TagInput from '../../src/components/ui/TagInput.vue'
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

describe('TagInput.vue — Component tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders chips for existing modelValue tags', () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: ['frontend', 'ui'],
      },
    })

    const chips = wrapper.findAll('.tag-chip')
    expect(chips).toHaveLength(2)
    expect(chips[0].text()).toContain('frontend')
    expect(chips[1].text()).toContain('ui')
  })

  it('handles undefined modelValue safely without throwing', () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: undefined,
      },
    })

    const chips = wrapper.findAll('.tag-chip')
    expect(chips).toHaveLength(0)
  })

  it('emits update:modelValue with new tag on enter', async () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: ['existing'],
      },
    })

    const input = wrapper.find('input')
    await input.setValue('new-tag')
    await input.trigger('keydown.enter')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted![0]).toEqual([['existing', 'new-tag']])
  })

  it('emits update:modelValue with removed tag on remove click', async () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: ['tag-a', 'tag-b'],
      },
    })

    const removeButtons = wrapper.findAll('.tag-remove')
    expect(removeButtons).toHaveLength(2)
    await removeButtons[0].trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted![0]).toEqual([['tag-b']])
  })

  it('suggests tags from modelStore.allTags', async () => {
    const modelStore = useModelStore()
    const node1 = makeNode('Node1', { tags: ['backend', 'database'] })
    modelStore.setGraph({ Node1: node1 }, ['Node1'])

    const wrapper = mount(TagInput, {
      props: {
        modelValue: [],
      },
    })

    const input = wrapper.find('input')
    await input.trigger('focus')
    await input.setValue('data')

    const dropdown = wrapper.find('.tag-dropdown')
    expect(dropdown.exists()).toBe(true)
    const options = wrapper.findAll('.tag-option')
    expect(options).toHaveLength(1)
    expect(options[0].text()).toBe('database')

    await options[0].trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted![0]).toEqual([['database']])
  })
})
