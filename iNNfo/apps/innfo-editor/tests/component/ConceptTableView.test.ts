import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ConceptTableView from '../../src/components/editor/ConceptTableView.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { useToast } from '../../src/shared/useToast'
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

describe('ConceptTableView.vue — Reactivity and element addition', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a new row to the table reactively when addElement is called', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', {
      childIds: ['Root/ExistingItem'],
    })
    const existing = makeNode('Root/ExistingItem', {
      parentId: 'Root',
      name: 'ExistingItem',
      type: 'Problems',
      kind: 'element',
    })
    knowledgeStore.setGraph({ Root: root, 'Root/ExistingItem': existing }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [],
      },
    })

    // Initially, there should be 1 row in the table body (excluding empty state)
    const rowsBefore = wrapper.findAll('tbody tr')
    expect(rowsBefore).toHaveLength(1)
    expect(wrapper.text()).toContain('ExistingItem')

    // Click the "+" add element button in the header
    const plusBtn = wrapper.find('[data-testid="add-element-btn"]')
    expect(plusBtn.exists()).toBe(true)
    await plusBtn.trigger('click')

    // The table should reactively update to show 2 rows now
    const rowsAfter = wrapper.findAll('tbody tr')
    expect(rowsAfter).toHaveLength(2)
    expect(wrapper.text()).toContain('New Problems')
  })

  it('adds element using concept name instead of concept type when they differ', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('model', {
      childIds: ['model/Item1'],
    })
    const existing = makeNode('model/Item1', {
      parentId: 'model',
      name: 'Item1',
      type: 'Concepto_Peso',
      kind: 'element',
    })
    knowledgeStore.setGraph({ model: root, 'model/Item1': existing }, ['model'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:model:Concepto_Peso',
        conceptType: 'weight',
        conceptFields: [],
      },
    })

    const rowsBefore = wrapper.findAll('tbody tr')
    expect(rowsBefore).toHaveLength(1)
    expect(wrapper.text()).toContain('Item1')

    const plusBtn = wrapper.find('[data-testid="add-element-btn"]')
    await plusBtn.trigger('click')

    const rowsAfter = wrapper.findAll('tbody tr')
    expect(rowsAfter).toHaveLength(2)
    expect(wrapper.text()).toContain('New Concepto_Peso')
  })

  it('triggers drag and drop reordering', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', {
      childIds: ['Root/ItemA', 'Root/ItemB', 'Root/ItemC'],
    })
    const itemA = makeNode('Root/ItemA', { parentId: 'Root', name: 'ItemA', type: 'Problems', kind: 'element' })
    const itemB = makeNode('Root/ItemB', { parentId: 'Root', name: 'ItemB', type: 'Problems', kind: 'element' })
    const itemC = makeNode('Root/ItemC', { parentId: 'Root', name: 'ItemC', type: 'Problems', kind: 'element' })
    knowledgeStore.setGraph({ Root: root, 'Root/ItemA': itemA, 'Root/ItemB': itemB, 'Root/ItemC': itemC }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [],
      },
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)

    // Simulate drag start on ItemC (index 2)
    const dragStartEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: () => {},
      },
    } as unknown as DragEvent
    
    // Call drop on ItemA (index 0)
    const dropEvent = {
      preventDefault: () => {},
    } as unknown as DragEvent

    // Trigger drag start and drop
    await rows[2].trigger('dragstart', dragStartEvent)
    await rows[0].trigger('drop', dropEvent)

    // Check store reordered children:
    expect(knowledgeStore.nodes['Root'].childIds).toEqual(['Root/ItemC', 'Root/ItemA', 'Root/ItemB'])
  })

  it('opens FieldDetailModal on double click on a cell with a truncatable field type when not in edit mode', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', {
      childIds: ['Root/ItemA'],
    })
    const itemA = makeNode('Root/ItemA', {
      parentId: 'Root',
      name: 'ItemA',
      type: 'Problems',
      kind: 'element',
      fields: {
        description: {
          value: 'This is a very long description that should be truncated in the table cell view.',
        },
      },
    })
    knowledgeStore.setGraph({ Root: root, 'Root/ItemA': itemA }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [
          { name: 'description', type: 'string' }
        ],
      },
    })

    const cells = wrapper.findAll('tbody tr td')
    expect(cells).toHaveLength(4)

    const descriptionCell = cells[1]
    expect(descriptionCell.classes()).toContain('cursor-zoom-in')

    const modal = wrapper.findComponent({ name: 'FieldDetailModal' })
    expect(modal.exists()).toBe(true)
    expect(modal.props('isOpen')).toBe(false)

    await descriptionCell.trigger('dblclick')

    expect(modal.props('isOpen')).toBe(true)
    expect(modal.props('nodeId')).toBe('Root/ItemA')
    expect(modal.props('fieldKey')).toBe('description')
    expect(modal.props('fieldType')).toBe('string')
  })

  it('renders a model pillbadge in the corresponding table column for model-type fields', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', {
      childIds: ['Root/Item1'],
    })
    const item1 = makeNode('Root/Item1', {
      parentId: 'Root',
      name: 'Proyecto de JOSÉ LUIS OLMO MORA',
      type: 'Proyecto',
      kind: 'element',
      fields: {
        business_model: {
          value: './kNNowledge/proyectos/jose-luis-olmo-mora_V_0-1-0_business_NN.md',
        },
      },
    })
    knowledgeStore.setGraph({ Root: root, 'Root/Item1': item1 }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Proyecto',
        conceptType: 'Proyecto',
        conceptFields: [
          { name: 'business_model', type: 'model' },
        ],
      },
    })

    const modelPill = wrapper.find('[data-testid="model-field-pill"]')
    expect(modelPill.exists()).toBe(true)
    expect(modelPill.text()).toBe('jose-luis-olmo-mora_V_0-1-0_business_NN.md')
    expect(modelPill.attributes('title')).toBe('./kNNowledge/proyectos/jose-luis-olmo-mora_V_0-1-0_business_NN.md')
    expect(modelPill.classes()).toContain('bg-primary/10')
    expect(modelPill.classes()).toContain('text-primary')
  })

  it('renders element tags as chips in the Tags column', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', {
      childIds: ['Root/ItemA', 'Root/ItemB'],
    })
    const itemA = makeNode('Root/ItemA', {
      parentId: 'Root',
      name: 'ItemA',
      type: 'Problems',
      kind: 'element',
      tags: ['frontend', 'core'],
    })
    const itemB = makeNode('Root/ItemB', {
      parentId: 'Root',
      name: 'ItemB',
      type: 'Problems',
      kind: 'element',
      tags: [],
    })
    knowledgeStore.setGraph({ Root: root, 'Root/ItemA': itemA, 'Root/ItemB': itemB }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [],
      },
    })

    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers).toContain('Tags')

    const tagChips = wrapper.findAll('tbody tr td span.inline-flex')
    const chipTexts = tagChips.map((c) => c.text())
    expect(chipTexts).toContain('#frontend')
    expect(chipTexts).toContain('#core')

    // ItemB has no tags: its Tags cell renders no chips
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    const itemATagsCell = rows[0].findAll('td')[1]
    expect(itemATagsCell.text()).toContain('#frontend')
    const itemBTagsCell = rows[1].findAll('td')[1]
    expect(itemBTagsCell.text()).not.toContain('#')
  })

  it('updates element tags via TagInput in edit mode', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', {
      childIds: ['Root/ItemA'],
    })
    const itemA = makeNode('Root/ItemA', {
      parentId: 'Root',
      name: 'ItemA',
      type: 'Problems',
      kind: 'element',
      tags: ['existing'],
    })
    knowledgeStore.setGraph({ Root: root, 'Root/ItemA': itemA }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [],
      },
    })

    await wrapper.find('[data-testid="toggle-edit-btn"]').trigger('click')

    const tagInput = wrapper.findComponent({ name: 'TagInput' })
    expect(tagInput.exists()).toBe(true)
    expect(tagInput.props('modelValue')).toEqual(['existing'])

    const input = tagInput.find('input')
    await input.setValue('new-tag')
    await input.trigger('keydown.enter')

    const updated = knowledgeStore.getNode('Root/ItemA')
    expect(updated?.tags).toEqual(['existing', 'new-tag'])
  })

  it('bounds the table height so the sticky header has its own scroll port', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root', { childIds: [] }) }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [],
      },
    })

    const container = wrapper.find('.overflow-auto')
    expect(container.exists()).toBe(true)
    expect(container.classes()).toContain('max-h-[70vh]')
  })

  it('sorts rows by element name as a view-only lens, toggling direction', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', { childIds: ['Root/ItemB', 'Root/ItemA'] })
    const itemA = makeNode('Root/ItemA', { parentId: 'Root', name: 'ItemA', type: 'Problems', kind: 'element' })
    const itemB = makeNode('Root/ItemB', { parentId: 'Root', name: 'ItemB', type: 'Problems', kind: 'element' })
    knowledgeStore.setGraph({ Root: root, 'Root/ItemA': itemA, 'Root/ItemB': itemB }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [],
      },
    })

    const firstRowText = () => wrapper.findAll('tbody tr')[0].text()
    expect(firstRowText()).toContain('ItemB')

    await wrapper.find('[data-testid="sort-name"]').trigger('click')
    expect(firstRowText()).toContain('ItemA')

    await wrapper.find('[data-testid="sort-name"]').trigger('click')
    expect(firstRowText()).toContain('ItemB')

    // View-only lens: document order is untouched.
    expect(knowledgeStore.nodes['Root'].childIds).toEqual(['Root/ItemB', 'Root/ItemA'])
  })

  it('sorts numeric fields numerically, not lexicographically', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', { childIds: ['Root/Nine', 'Root/Ten'] })
    const nine = makeNode('Root/Nine', {
      parentId: 'Root',
      name: 'Nine',
      type: 'Problems',
      kind: 'element',
      fields: { priority: { value: 9 } },
    })
    const ten = makeNode('Root/Ten', {
      parentId: 'Root',
      name: 'Ten',
      type: 'Problems',
      kind: 'element',
      fields: { priority: { value: 10 } },
    })
    knowledgeStore.setGraph({ Root: root, 'Root/Nine': nine, 'Root/Ten': ten }, ['Root'])

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [{ name: 'priority', type: 'number' }],
      },
    })

    await wrapper.find('[data-testid="sort-priority"]').trigger('click')
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('Nine')
  })

  it('shows a success toast when an element is added at the end', async () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', { childIds: [] })
    knowledgeStore.setGraph({ Root: root }, ['Root'])

    const { toasts, clearAll } = useToast()
    clearAll()

    const wrapper = mount(ConceptTableView, {
      props: {
        nodeId: 'virtual:Root:Problems',
        conceptType: 'Problems',
        conceptFields: [],
      },
    })

    await wrapper.find('[data-testid="add-element-btn"]').trigger('click')

    expect(
      toasts.value.some((t) => t.type === 'success' && t.message.includes('New Problems')),
    ).toBe(true)
    clearAll()
  })
})

