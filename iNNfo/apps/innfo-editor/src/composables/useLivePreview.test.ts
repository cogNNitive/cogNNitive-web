import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { KnowledgeNode } from '../model/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

vi.mock('./useUrlDocLoader', () => ({
  useUrlDocLoader: () => ({ fetch: fetchMock }),
}))

import { useLivePreview } from './useLivePreview'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useUiStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  closed = false
  private listeners: Record<string, Array<(ev: MessageEvent) => void>> = {}

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: (ev: MessageEvent) => void): void {
    ;(this.listeners[type] ||= []).push(cb)
  }

  close(): void {
    this.closed = true
  }

  emit(type: string, payload: unknown): void {
    for (const cb of this.listeners[type] ?? []) {
      cb({ data: JSON.stringify(payload) } as MessageEvent)
    }
  }
}

function node(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    name: id,
    kind: 'element',
    type: 'Work',
    parentId: null,
    childIds: [],
    fields: {},
    markers: {},
    tags: [],
    relationships: [],
    source: { path: `${id}.md` },
    rawSections: {},
    ...overrides,
  }
}

describe('useLivePreview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    MockEventSource.instances = []
    fetchMock.mockReset()
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks the workspace read-only and opens the SSE stream on start', () => {
    const live = useLivePreview()
    live.start({ live: 'http://127.0.0.1:5555', token: 'abc' })

    expect(useWorkspaceStore().previewReadOnly).toBe(true)
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toBe('http://127.0.0.1:5555/events?token=abc')
  })

  it('re-fetches the named model and replaces its nodes on an event', async () => {
    const knowledge = useKnowledgeStore()
    knowledge.setGraph(
      { Model: node('Model', { kind: 'root', childIds: ['Model/Element'] }), 'Model/Element': node('Model/Element') },
      ['Model'],
    )

    fetchMock.mockResolvedValue({
      nodes: {
        Model: node('Model', { kind: 'root', childIds: ['Model/Element', 'Model/Review'] }),
        'Model/Element': node('Model/Element'),
        'Model/Review': node('Model/Review'),
      },
      rootIds: ['Model'],
      sourceUrl: 'http://127.0.0.1:5555/model/Model?token=abc',
      error: null,
    })

    const live = useLivePreview()
    live.start({ live: 'http://127.0.0.1:5555', token: 'abc' })
    MockEventSource.instances[0].emit('model-changed', { model: 'Model', op: 'apply_change' })

    await vi.waitFor(() => {
      expect(knowledge.getNode('Model/Review')).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5555/model/Model?token=abc')
  })

  it('preserves the selected node when it survives the re-render', async () => {
    const knowledge = useKnowledgeStore()
    const ui = useUiStore()
    knowledge.setGraph(
      { Model: node('Model', { kind: 'root', childIds: ['Model/Element'] }), 'Model/Element': node('Model/Element') },
      ['Model'],
    )
    ui.selectNode('Model/Element')

    fetchMock.mockResolvedValue({
      nodes: {
        Model: node('Model', { kind: 'root', childIds: ['Model/Element'] }),
        'Model/Element': node('Model/Element'),
      },
      rootIds: ['Model'],
      sourceUrl: '',
      error: null,
    })

    const live = useLivePreview()
    await live.applyModelChanged('Model', { live: 'http://127.0.0.1:5555', token: 'abc' })

    expect(ui.selectedNodeId).toBe('Model/Element')
  })

  it('closes the stream on stop', () => {
    const live = useLivePreview()
    live.start({ live: 'http://127.0.0.1:5555', token: 'abc' })
    live.stop()
    expect(MockEventSource.instances[0].closed).toBe(true)
  })

  it('does not throw when a malformed frame arrives', () => {
    const live = useLivePreview()
    live.start({ live: 'http://127.0.0.1:5555', token: 'abc' })
    expect(() => MockEventSource.instances[0].emit('model-changed', {})).not.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
