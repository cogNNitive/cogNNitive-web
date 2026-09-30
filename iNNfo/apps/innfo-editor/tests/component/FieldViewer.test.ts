import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FieldViewer from '../../src/components/editor/FieldViewer.vue'
import FileRefPill from '../../src/components/editor/FileRefPill.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { useUiStore } from '../../src/stores/uiStore'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(id: string, fieldValues: Record<string, unknown>): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    type: 'text',
    fields: Object.fromEntries(
      Object.entries(fieldValues).map(([key, value]) => [
        key,
        {
          value,
          editAttribution: {
            author: { kind: 'system', id: 'parser' },
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        },
      ]),
    ),
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
  }
}

describe('FieldViewer.vue — R-SC-06', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const fieldDefs = [
    { name: 'status', type: 'select', options: ['active', 'inactive'] },
    { name: 'summary', type: 'string' },
    { name: 'count', type: 'number' },
    { name: 'is_enabled', type: 'boolean' },
  ]

  it('renders field labels and values in read mode', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          status: 'active',
          summary: 'Hello world',
          count: 42,
          is_enabled: true,
        }),
      },
      ['Root'],
    )

    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: fieldDefs,
        readonly: true,
      },
    })

    const text = wrapper.text().toLowerCase()
    // Labels use CSS `uppercase` — happy-dom does not apply CSS transforms,
    // so we assert against the raw field name (before CSS transform).
    expect(text).toContain('status')
    expect(text).toContain('active')
    expect(text).toContain('summary')
    expect(text).toContain('hello world')
    expect(text).toContain('count')
    expect(text).toContain('42')
    // Field label replaces underscore with space: is_enabled → "is enabled"
    expect(text).toContain('is enabled')
  })

  it('shows emerald Yes for boolean true fields', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', { is_enabled: true }) }, ['Root'])

    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: [{ name: 'is_enabled', type: 'boolean' }],
        readonly: true,
      },
    })

    expect(wrapper.text()).toContain('Yes')
  })

  it('shows em dash placeholder for empty field values', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', { status: '' }) }, ['Root'])

    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: [{ name: 'status', type: 'select' }],
        readonly: true,
      },
    })

    // The em dash (—) replaces empty values
    expect(wrapper.text()).toContain('—')
  })

  it('renders WidgetField in edit mode (non-readonly)', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', { summary: 'Hello' }) }, ['Root'])

    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: [{ name: 'summary', type: 'string' }],
        readonly: false,
      },
    })

    // In edit mode, WidgetField renders an input tag
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.element.value).toBe('Hello')
  })

  it('shows empty state when no field definitions provided', () => {
    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: [],
        readonly: true,
      },
    })

    expect(wrapper.text()).toContain('No fields defined for this concept.')
  })

  it('renders a select badge for select-type fields in read mode', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', { status: 'active' }) }, ['Root'])

    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: [{ name: 'status', type: 'select', options: ['active', 'inactive'] }],
        readonly: true,
      },
    })

    // Select values render as badge chips in read mode
    expect(wrapper.text()).toContain('active')
  })

  it('resolves reference fields with WikiLink syntax to BlockPill', () => {
    const knowledgeStore = useKnowledgeStore()
    const targetNode = makeNode('Salón-Comedor', {})
    targetNode.name = 'Salón-Comedor'
    targetNode.type = 'Component'
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', { location: '[[Salón-Comedor]]' }),
        'Salón-Comedor': targetNode,
      },
      ['Root', 'Salón-Comedor'],
    )

    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: [{ name: 'location', type: 'reference', target_concepts: ['Component'] }],
        readonly: true,
      },
    })

    // Should resolve the node and render BlockPill with name 'Salón-Comedor'
    expect(wrapper.findComponent({ name: 'Pill' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('Salón-Comedor')
  })

  it('renders one FileRefPill per item for a multi-value sources:: field', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          sources: [
            'sources/nn/The_Goonies.md#opening-scene',
            'sources/nn/interviews/interview.md#background',
          ],
        }),
      },
      ['Root'],
    )

    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: [{ name: 'sources', type: 'string' }],
        readonly: true,
      },
    })

    const pills = wrapper.findAllComponents(FileRefPill)
    expect(pills).toHaveLength(2)
    expect(wrapper.text()).toContain('The_Goonies.md')
    expect(wrapper.text()).toContain('interview.md')
  })

  it('renders interactive model pill for type:: knowledge field and triggers focusModel on click', async () => {
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          submodel: 'kNNowledge/auth_01.md',
        }),
      },
      ['Root'],
    )

    const wrapper = mount(FieldViewer, {
      props: {
        nodeId: 'Root',
        fieldDefinitions: [{ name: 'submodel', type: 'model' }],
        readonly: true,
      },
    })

    const modelPill = wrapper.find('[data-testid="model-field-pill"]')
    expect(modelPill.exists()).toBe(true)
    expect(modelPill.text()).toContain('kNNowledge/auth_01.md')

    await modelPill.trigger('click')
    expect(uiStore.sidebarMode).toBe('focused_model')
    expect(uiStore.focusedModelId).toBe('kNNowledge/auth_01.md')
  })
})
