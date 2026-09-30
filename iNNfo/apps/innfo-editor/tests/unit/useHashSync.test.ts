import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '../../src/stores/uiStore'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { useHashSync } from '../../src/composables/useHashSync'

/**
 * E7 — `useHashSync` router state. The synchronous `hashchange` handler sets
 * `updating = true`, calls `selectNode`, then clears `updating` and returns
 * BEFORE the `watch(selectedNodeId)` callback runs in a microtask — so the
 * watcher fires an extra `pushState('#sameHash')`. The fix: `syncStoreToHash`
 * returns when the target hash already equals `window.location.hash`.
 */

let pushCount = 0
let currentHash = ''
let historyEntries: string[] = []

const originalAddEventListener = window.addEventListener
const originalRemoveEventListener = window.removeEventListener
const originalHistory = window.history
const originalLocation = window.location

function mockWindowApi() {
  historyEntries = []
  pushCount = 0
  currentHash = ''

  const location = {
    hash: '',
    pathname: '/editor',
    search: '',
  }

  const history = {
    pushState: (_data: unknown, _unused: string, url: string) => {
      pushCount++
      const newHash = url.startsWith('#') ? url : `#${url}`
      historyEntries.push(newHash)
      currentHash = newHash
      location.hash = newHash
    },
    replaceState: vi.fn(),
    back: vi.fn(),
  }

  Object.defineProperty(window, 'history', { value: history, writable: true, configurable: true })
  Object.defineProperty(window, 'location', {
    value: location,
    writable: true,
    configurable: true,
  })

  const listeners: Array<() => void> = []
  const addEventListener = vi.fn((_evt: string, cb: () => void) => listeners.push(cb))
  const removeEventListener = vi.fn()

  Object.defineProperty(window, 'addEventListener', { value: addEventListener, writable: true, configurable: true })
  Object.defineProperty(window, 'removeEventListener', {
    value: removeEventListener,
    writable: true,
    configurable: true,
  })

  const getHash = () => currentHash
  const getPushCount = () => pushCount
  const getEntries = () => [...historyEntries]
  const setHash = (h: string) => {
    currentHash = h
    location.hash = h
    for (const cb of listeners) cb()
  }

  return {
    getHash,
    getPushCount,
    getEntries,
    setHash,
    setSearch: (s: string) => {
      location.search = s
    },
  }
}

function makeNode(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id.split('/').pop()!,
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

/** Host component so `useHashSync`'s onMounted/onUnmounted run for real. */
const HashSyncHost = defineComponent({
  setup() {
    useHashSync()
    return () => null
  },
})

function mountHost() {
  return mount(HashSyncHost, { attachTo: document.body })
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('useHashSync (E7: no duplicate pushState)', () => {
  let api: ReturnType<typeof mockWindowApi>
  let wrapper: ReturnType<typeof mountHost> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    api = mockWindowApi()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    Object.defineProperty(window, 'addEventListener', { value: originalAddEventListener, writable: true, configurable: true })
    Object.defineProperty(window, 'removeEventListener', { value: originalRemoveEventListener, writable: true, configurable: true })
    Object.defineProperty(window, 'history', { value: originalHistory, writable: true, configurable: true })
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
    vi.restoreAllMocks()
  })

  it('A → B → C pushes one history entry per navigation, Back to #B does not re-push', async () => {
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()

    const doc = makeNode('doc', { kind: 'root', type: 'document' })
    const nodeA = makeNode('doc/Alpha', { kind: 'element', type: 'Task', parentId: 'doc' })
    const nodeB = makeNode('doc/Beta', { kind: 'element', type: 'Task', parentId: 'doc' })
    const nodeC = makeNode('doc/Gamma', { kind: 'element', type: 'Task', parentId: 'doc' })

    knowledgeStore.setGraph({ doc, 'doc/Alpha': nodeA, 'doc/Beta': nodeB, 'doc/Gamma': nodeC } as any, [
      'doc',
    ])

    wrapper = mountHost()
    await tick()

    uiStore.selectNode('doc/Alpha')
    await tick()
    const afterA = api.getPushCount()

    uiStore.selectNode('doc/Beta')
    await tick()
    const afterB = api.getPushCount()

    uiStore.selectNode('doc/Gamma')
    await tick()
    const afterC = api.getPushCount()

    expect(afterB - afterA).toBe(1) // one entry per navigation
    expect(afterC - afterB).toBe(1)

    // Simulate the browser Back to `#Beta` (the hash that B pushed).
    const betaHash = api.getEntries()[1]
    expect(betaHash).toContain('Beta')

    api.setHash(betaHash) // fires hashchange → syncHashToStore → selectNode(B)
    await tick()

    // The watch fires once more for selectNode(B), but the hash already equals
    // the target — it MUST NOT push a duplicate entry (E7).
    const afterBack = api.getPushCount()
    expect(afterBack - afterC).toBe(0)

    // Forward history preserved: no extra entries were pushed.
    expect(api.getEntries().length).toBe(afterC)
  })

  it('leaves a genuinely different hash untouched and pushes it', async () => {
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()

    const doc = makeNode('doc', { kind: 'root', type: 'document' })
    const nodeA = makeNode('doc/Alpha', { kind: 'element', type: 'Task', parentId: 'doc' })
    knowledgeStore.setGraph({ doc, 'doc/Alpha': nodeA } as any, ['doc'])

    wrapper = mountHost()
    await tick()

    uiStore.selectNode('doc/Alpha')
    await tick()

    expect(api.getPushCount()).toBe(1)
    expect(api.getHash()).toContain('Alpha')
  })

  it('preserves an existing ?ku= query param across store-driven hash pushes', async () => {
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()

    const doc = makeNode('doc', { kind: 'root', type: 'document' })
    const nodeA = makeNode('doc/Alpha', { kind: 'element', type: 'Task', parentId: 'doc' })
    knowledgeStore.setGraph({ doc, 'doc/Alpha': nodeA } as any, ['doc'])

    api.setSearch('?ku=models%2Fx.md')
    wrapper = mountHost()
    await tick()

    uiStore.selectNode('doc/Alpha')
    await tick()

    expect(api.getHash()).toContain('Alpha')
    expect(window.location.search).toBe('?ku=models%2Fx.md')
  })
})
