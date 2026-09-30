import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import BlockMatrixSummary from '../../src/components/editor/BlockMatrixSummary.vue'
import { useModelStore } from '../../src/stores/modelStore'
import type { KnowledgeNode } from '../../src/model/types'

/**
 * Helper: creates a minimal root node with rawContent containing
 * matrix definitions and cell values in the fields.
 */
function makeRootNode(
  matrices: Array<{ name: string; source: string; target: string }>,
  cellFields: Record<string, { value: string }> = {},
): KnowledgeNode {
  const frontmatter = `---
spec_version: V_0-1-5
name: TestRoot
concepts:
  - name: Task
    type: task
    color: blue
  - name: Phase
    type: phase
    color: green
matrices:
${matrices.map((m) => `  - name: ${m.name}\n    source: ${m.source}\n    target: ${m.target}`).join('\n')}
---
`

  return {
    id: 'Root',
    name: 'TestRoot',
    parentId: null,
    childIds: [],
    type: 'root',
    fields: Object.fromEntries(
      Object.entries(cellFields).map(([key, val]) => [
        key,
        {
          value: val.value,
          editAttribution: {
            author: { kind: 'system', id: 'test' },
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        },
      ]),
    ),
    markers: {},
    relationships: [],
    rawSections: {},
    rawContent: frontmatter,
    source: { path: 'Root' },
  }
}

function makeElementNode(id: string, name: string, conceptType: string): KnowledgeNode {
  return {
    id,
    name,
    parentId: 'Root',
    childIds: [],
    type: conceptType,
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
  }
}

describe('BlockMatrixSummary.vue — R-SC-04', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders a MatrixPill when the node participates as a row in a matrix', () => {
    const modelStore = useModelStore()
    const root = makeRootNode([{ name: 'M1', source: 'Task', target: 'Phase' }], {
      'M1||MyTask||Phase1': { value: 'active' },
    })
    const element = makeElementNode('Root/MyTask', 'MyTask', 'Task')
    modelStore.setGraph({ Root: root, 'Root/MyTask': element }, ['Root'])

    const wrapper = mount(BlockMatrixSummary, {
      props: {
        rootNodeId: 'Root',
        nodeConcept: 'Task',
        nodeId: 'Root/MyTask',
      },
    })

    expect(wrapper.find('[data-testid="matrix-pill-M1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Task')
    expect(wrapper.text()).toContain('Phase')
    expect(wrapper.find('[data-testid="matrix-pill-count-M1"]').text()).toBe('1')
  })

  it('renders a MatrixPill when the node participates as a column in a matrix', () => {
    const modelStore = useModelStore()
    const root = makeRootNode([{ name: 'M1', source: 'Task', target: 'Phase' }], {
      'M1||SomeTask||MyPhase': { value: 'done' },
    })
    const element = makeElementNode('Root/MyPhase', 'MyPhase', 'Phase')
    modelStore.setGraph({ Root: root, 'Root/MyPhase': element }, ['Root'])

    const wrapper = mount(BlockMatrixSummary, {
      props: {
        rootNodeId: 'Root',
        nodeConcept: 'Phase',
        nodeId: 'Root/MyPhase',
      },
    })

    expect(wrapper.find('[data-testid="matrix-pill-M1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Task')
    expect(wrapper.text()).toContain('Phase')
    expect(wrapper.find('[data-testid="matrix-pill-count-M1"]').text()).toBe('1')
  })

  it('counts cells with non-dash/empty values only', () => {
    const modelStore = useModelStore()
    const root = makeRootNode([{ name: 'M1', source: 'Task', target: 'Phase' }], {
      'M1||MyTask||P1': { value: 'active' },
      'M1||MyTask||P2': { value: '-' },
      'M1||MyTask||P3': { value: '' },
    })
    const element = makeElementNode('Root/MyTask', 'MyTask', 'Task')
    modelStore.setGraph({ Root: root, 'Root/MyTask': element }, ['Root'])

    const wrapper = mount(BlockMatrixSummary, {
      props: {
        rootNodeId: 'Root',
        nodeConcept: 'Task',
        nodeId: 'Root/MyTask',
      },
    })

    // Only one non-dash cell counted
    expect(wrapper.find('[data-testid="matrix-pill-count-M1"]').text()).toBe('1')
  })

  it('shows empty state when node does not participate in any matrix', () => {
    const modelStore = useModelStore()
    const root = makeRootNode([{ name: 'M1', source: 'Task', target: 'Phase' }])
    const element = makeElementNode('Root/Other', 'Other', 'OtherType')
    modelStore.setGraph({ Root: root, 'Root/Other': element }, ['Root'])

    const wrapper = mount(BlockMatrixSummary, {
      props: {
        rootNodeId: 'Root',
        nodeConcept: 'OtherType',
        nodeId: 'Root/Other',
      },
    })

    expect(wrapper.text()).toContain('No matrix connections.')
  })

  it('shows empty state when root node has no matrix definitions', () => {
    const modelStore = useModelStore()
    const root = makeRootNode([])
    const element = makeElementNode('Root/Task1', 'Task1', 'Task')
    modelStore.setGraph({ Root: root, 'Root/Task1': element }, ['Root'])

    const wrapper = mount(BlockMatrixSummary, {
      props: {
        rootNodeId: 'Root',
        nodeConcept: 'Task',
        nodeId: 'Root/Task1',
      },
    })

    expect(wrapper.text()).toContain('No matrix connections.')
  })

  it('handles multiple matrices with different concept participation', () => {
    const modelStore = useModelStore()
    const root = makeRootNode(
      [
        { name: 'M1', source: 'Task', target: 'Phase' },
        { name: 'M2', source: 'Task', target: 'Milestone' },
      ],
      {
        'M1||MyTask||P1': { value: 'active' },
        'M2||MyTask||MS1': { value: 'done' },
      },
    )
    const element = makeElementNode('Root/MyTask', 'MyTask', 'Task')
    modelStore.setGraph({ Root: root, 'Root/MyTask': element }, ['Root'])

    const wrapper = mount(BlockMatrixSummary, {
      props: {
        rootNodeId: 'Root',
        nodeConcept: 'Task',
        nodeId: 'Root/MyTask',
      },
    })

    expect(wrapper.find('[data-testid="matrix-pill-M1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="matrix-pill-M2"]').exists()).toBe(true)
  })
})
