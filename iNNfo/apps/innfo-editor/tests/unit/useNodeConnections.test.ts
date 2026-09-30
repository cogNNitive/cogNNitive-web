import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNodeConnections } from '../../src/composables/useNodeConnections'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
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

describe('useNodeConnections.ts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('extracts field connections from key:: [[Target]] syntax', () => {
    const knowledgeStore = useKnowledgeStore()
    const nodeA = makeNode('Procedures/Task1', {
      name: 'Task1',
      fields: { depends_on: '[[Task2]]' },
    })
    const nodeB = makeNode('Procedures/Task2', { name: 'Task2' })
    knowledgeStore.setGraph({ 'Procedures/Task1': nodeA, 'Procedures/Task2': nodeB }, ['Procedures/Task1'])

    const { fieldConnections } = useNodeConnections({
      rootNodeId: 'Procedures/Task1',
      nodeConcept: 'Task',
      nodeId: 'Procedures/Task1',
    })

    expect(fieldConnections.value.length).toBe(1)
    expect(fieldConnections.value[0].targetId).toBe('Task2')
    expect(fieldConnections.value[0].origin).toBe('field')
    expect(fieldConnections.value[0].direction).toBe('outgoing')
  })

  it('extracts mention connections from Markdown [[Wikilinks]]', () => {
    const knowledgeStore = useKnowledgeStore()
    const nodeA = makeNode('Procedures/Task1', {
      name: 'Task1',
      rawContent: 'Check [[Passport]] for validity.',
    })
    knowledgeStore.setGraph({ 'Procedures/Task1': nodeA }, ['Procedures/Task1'])

    const { mentionConnections } = useNodeConnections({
      rootNodeId: 'Procedures/Task1',
      nodeConcept: 'Task',
      nodeId: 'Procedures/Task1',
    })

    expect(mentionConnections.value.length).toBe(1)
    expect(mentionConnections.value[0].targetId).toBe('Passport')
    expect(mentionConnections.value[0].origin).toBe('mention')
  })
})
