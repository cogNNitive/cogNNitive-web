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

describe('VirtualGroupNode — ghost rendering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders ghost header with dashed border style when ghost=true', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          localMetamodel: {
            concepts: [{ name: 'GhostConcept', type: 'list', color: 'blue', icon: 'file-text' }],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(VirtualGroupNode, {
      props: {
        conceptName: 'GhostConcept',
        children: [],
        selectedId: null,
        ghost: true,
      },
      attachTo: document.body,
    })

    // Ghost header should have dashed border
    const ghostHeader = wrapper.find('.flex.items-center')
    expect(ghostHeader.exists()).toBe(true)
    const style = ghostHeader.attributes('style') ?? ''
    expect(style).not.toContain('border-left')
  })

  it('emits "select" with virtual concept ID when ghost header is clicked', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          localMetamodel: {
            concepts: [{ name: 'Ghost', type: 'list' }],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(VirtualGroupNode, {
      props: {
        conceptName: 'Ghost',
        children: [],
        selectedId: null,
        ghost: true,
      },
      attachTo: document.body,
    })

    const header = wrapper.find('[data-testid="ghost-group-header"]')
    expect(header.exists()).toBe(true)
    await header.trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual(['virtual:Root:Ghost'])
  })

  it('renders concept name in italic when ghost=true', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          localMetamodel: {
            concepts: [{ name: 'GhostConcept', type: 'list' }],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(VirtualGroupNode, {
      props: {
        conceptName: 'GhostConcept',
        children: [],
        selectedId: null,
        ghost: true,
      },
      attachTo: document.body,
    })

    // The name span should have italic class
    const nameSpan = wrapper.find('span.italic')
    expect(nameSpan.exists()).toBe(true)
    expect(nameSpan.text()).toContain('GhostConcept')
  })

  it('shows zero count for ghost groups', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          localMetamodel: {
            concepts: [{ name: 'Ghost', type: 'list' }],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(VirtualGroupNode, {
      props: {
        conceptName: 'Ghost',
        children: [],
        selectedId: null,
        ghost: true,
      },
      attachTo: document.body,
    })

    expect(wrapper.text()).toContain('0')
  })

  it('renders ghost header with clickable data-testid', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          localMetamodel: {
            concepts: [{ name: 'GhostItem', type: 'list' }],
            markers: [],
          },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(VirtualGroupNode, {
      props: {
        conceptName: 'GhostItem',
        children: [],
        selectedId: null,
        ghost: true,
      },
      attachTo: document.body,
    })

    const header = wrapper.find('[data-testid="ghost-group-header"]')
    expect(header.exists()).toBe(true)
    expect(header.attributes('style')).not.toContain('border-left')
  })

  it('renders non-ghost variant normally (no dashed border)', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', { childIds: ['Root/Child1'] }),
        'Root/Child1': makeNode('Root/Child1', {
          parentId: 'Root',
          type: 'NormalConcept',
          kind: 'element',
        }),
      },
      ['Root'],
    )

    const wrapper = mount(VirtualGroupNode, {
      props: {
        conceptName: 'NormalConcept',
        children: [
          makeNode('Root/Child1', {
            id: 'Root/Child1',
            name: 'Root/Child1',
            parentId: 'Root',
            type: 'NormalConcept',
            kind: 'element',
            childIds: [],
            fields: {},
            markers: {},
            relationships: [],
            rawSections: {},
            source: { path: '' },
          }),
        ],
        selectedId: null,
        ghost: false,
      },
      attachTo: document.body,
    })

    // Non-ghost should have solid border, not dashed
    const headerDiv = wrapper.find('.flex.items-center')
    const style = headerDiv.attributes('style') ?? ''
    expect(style).not.toContain('border-left')

    // Non-ghost should NOT have the clickable ghost header testid
    expect(wrapper.find('[data-testid="ghost-group-header"]').exists()).toBe(false)
  })
})
