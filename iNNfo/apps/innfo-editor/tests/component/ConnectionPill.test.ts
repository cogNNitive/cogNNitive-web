import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ConnectionPill from '../../src/components/editor/ConnectionPill.vue'
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

describe('ConnectionPill.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders target Pill and relationship role in compact outgoing mode', async () => {
    const modelStore = useModelStore()
    const target = makeNode('Procedures/Pasaporte', { name: 'Pasaporte', type: 'Artifact' })
    modelStore.setGraph({ 'Procedures/Pasaporte': target }, ['Procedures/Pasaporte'])

    const wrapper = mount(ConnectionPill, {
      props: {
        targetId: 'Procedures/Pasaporte',
        value: 'Validates',
        mode: 'compact',
        direction: 'outgoing',
      },
    })

    expect(wrapper.text()).toContain('Validates')
    expect(wrapper.text()).toContain('Pasaporte')
    expect(wrapper.text()).toContain('>')
  })

  it('renders source Pill and relationship role in compact incoming mode', async () => {
    const modelStore = useModelStore()
    const source = makeNode('Procedures/Task1', { name: 'Task1', type: 'Task' })
    modelStore.setGraph({ 'Procedures/Task1': source }, ['Procedures/Task1'])

    const wrapper = mount(ConnectionPill, {
      props: {
        sourceId: 'Procedures/Task1',
        value: 'Responsible',
        mode: 'compact',
        direction: 'incoming',
      },
    })

    expect(wrapper.text()).toContain('Task1')
    expect(wrapper.text()).toContain('Responsible')
    expect(wrapper.text()).toContain('<')
  })

  it('renders both source and target Pills when mode is full', async () => {
    const modelStore = useModelStore()
    const source = makeNode('Procedures/Task1', { name: 'Task1', type: 'Task' })
    const target = makeNode('Procedures/Pasaporte', { name: 'Pasaporte', type: 'Artifact' })
    modelStore.setGraph(
      { 'Procedures/Task1': source, 'Procedures/Pasaporte': target },
      ['Procedures/Task1'],
    )

    const wrapper = mount(ConnectionPill, {
      props: {
        sourceId: 'Procedures/Task1',
        targetId: 'Procedures/Pasaporte',
        value: 'Validates',
        mode: 'full',
      },
    })

    expect(wrapper.text()).toContain('Task1')
    expect(wrapper.text()).toContain('Validates')
    expect(wrapper.text()).toContain('Pasaporte')
  })

  it('resolves relative node name to full store node ID', async () => {
    const modelStore = useModelStore()
    const source = makeNode('models_test.md/Preparación el día previo (T-1)', {
      name: 'Preparación el día previo (T-1)',
      type: 'Task',
      rawContent: 'Paso previo a realizar.',
    })
    modelStore.setGraph(
      { 'models_test.md/Preparación el día previo (T-1)': source },
      ['models_test.md/Preparación el día previo (T-1)'],
    )

    const wrapper = mount(ConnectionPill, {
      props: {
        sourceId: 'Preparación el día previo (T-1)',
        value: 'Accountable',
        mode: 'compact',
        direction: 'incoming',
      },
    })

    expect(wrapper.text()).toContain('Preparación el día previo (T-1)')
    expect(wrapper.text()).toContain('Accountable')
    expect(wrapper.text()).not.toContain('Empty')
  })
})

