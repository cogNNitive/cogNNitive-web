import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { useModelStore } from '../../src/stores/modelStore'
import { useGraphData, ORIGIN_COLORS } from '../../src/components/editor/composables/useGraphData'
import GraphViewer from '../../src/components/editor/GraphViewer.vue'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    name: id.split('/').pop() || id,
    parentId: null,
    childIds: [],
    type: 'Task',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
    ...overrides,
  }
}

describe('useGraphData and GraphViewer relationship origins (R10)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('builds GEdges with origin and origin-specific color for all four origins', () => {
    const modelStore = useModelStore()
    const nodeA = makeNode('Root/A', {
      name: 'A',
      relationships: [
        { targetId: 'Root/B', label: 'matrix_rel', origin: 'matrix' },
        { targetId: 'Root/B', label: 'field_rel', origin: 'field' },
        { targetId: 'Root/B', label: 'mentions', origin: 'mention' },
        { targetId: 'Root/B', label: 'graph_rel', origin: 'graph_edge' },
      ],
    })
    const nodeB = makeNode('Root/B', { name: 'B' })

    modelStore.setGraph({ 'Root/A': nodeA, 'Root/B': nodeB }, ['Root/A'])

    const localNodeId = ref('')
    const { allEdges } = useGraphData(localNodeId)

    expect(allEdges.value).toHaveLength(4)

    const matrixEdge = allEdges.value.find((e) => e.origin === 'matrix')
    const fieldEdge = allEdges.value.find((e) => e.origin === 'field')
    const mentionEdge = allEdges.value.find((e) => e.origin === 'mention')
    const graphEdge = allEdges.value.find((e) => e.origin === 'graph_edge')

    expect(matrixEdge).toBeDefined()
    expect(matrixEdge!.color).toBe(ORIGIN_COLORS.matrix)

    expect(fieldEdge).toBeDefined()
    expect(fieldEdge!.color).toBe(ORIGIN_COLORS.field)

    expect(mentionEdge).toBeDefined()
    expect(mentionEdge!.color).toBe(ORIGIN_COLORS.mention)

    expect(graphEdge).toBeDefined()
    expect(graphEdge!.color).toBe(ORIGIN_COLORS.graph_edge)
  })

  it('renders a 4-entry origin legend in GraphViewer header', () => {
    const wrapper = mount(GraphViewer, {
      props: { inline: false },
    })

    const legend = wrapper.find('[data-testid="origin-legend"]')
    expect(legend.exists()).toBe(true)

    const text = legend.text()
    expect(text).toContain('Matrix')
    expect(text).toContain('Field')
    expect(text).toContain('Mention')
    expect(text).toContain('Graph Edge')

    const matrixItem = legend.find('[data-origin="matrix"]')
    const fieldItem = legend.find('[data-origin="field"]')
    const mentionItem = legend.find('[data-origin="mention"]')
    const graphItem = legend.find('[data-origin="graph_edge"]')

    expect(matrixItem.exists()).toBe(true)
    expect(fieldItem.exists()).toBe(true)
    expect(mentionItem.exists()).toBe(true)
    expect(graphItem.exists()).toBe(true)
  })
})
