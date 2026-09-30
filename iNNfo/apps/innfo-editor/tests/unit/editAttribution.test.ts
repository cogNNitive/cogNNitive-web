import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { commitFieldValue } from '../../src/shared/editAttribution'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(id: string): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    storageMode: 'FILE',
    type: 'text',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
  }
}

describe('edit-attribution commit hook (R16)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('records editAttribution on the field when the user commits a new value', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root') }, ['Root'])

    commitFieldValue(knowledgeStore, 'Root', 'summary', 'Edited value', { kind: 'user', id: 'user-1' })

    const node = knowledgeStore.getNode('Root')!
    expect(node.fields.summary.value).toBe('Edited value')
    expect(node.fields.summary.editAttribution.author).toEqual({ kind: 'user', id: 'user-1' })
    expect(node.fields.summary.editAttribution.timestamp).toBeTruthy()
  })

  it('marks the node dirty when a field is committed', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root') }, ['Root'])

    commitFieldValue(knowledgeStore, 'Root', 'summary', 'Edited value', { kind: 'user', id: 'user-1' })

    expect(knowledgeStore.isDirty('Root')).toBe(true)
  })

  it('records no new editAttribution beyond parse-time state when no edit is made (loading a node)', () => {
    const knowledgeStore = useKnowledgeStore()
    const node = makeNode('Root')
    node.fields.summary = {
      value: 'Original',
      editAttribution: {
        author: { kind: 'system', id: 'parser' },
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    }
    knowledgeStore.setGraph({ Root: node }, ['Root'])

    // Simply reading the node (loading it into a form) must not mutate editAttribution.
    const read = knowledgeStore.getNode('Root')!
    expect(read.fields.summary.editAttribution.author).toEqual({ kind: 'system', id: 'parser' })
    expect(knowledgeStore.isDirty('Root')).toBe(false)
  })

  it('uses a fresh ISO-8601 timestamp per commit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'))

    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph({ Root: makeNode('Root') }, ['Root'])
    commitFieldValue(knowledgeStore, 'Root', 'summary', 'v1', { kind: 'user', id: 'user-1' })

    const node = knowledgeStore.getNode('Root')!
    expect(node.fields.summary.editAttribution.timestamp).toBe('2025-06-01T12:00:00.000Z')

    vi.useRealTimers()
  })
})
