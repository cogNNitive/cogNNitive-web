import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { useUiStore } from '../../src/stores/uiStore'
import { buildFakeTree } from '../helpers/fakeFs'
import { setSessionState, getSessionState, dbClear } from '../../src/utils/db'

const testModelContent = `---
spec_version: "V_0-3-0"
spec_url: "https://example.test/specs/V_0-3-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Session Test"
---

# NN Session Test Model

A model used to test session persistence.
`

const testTree = {
  'domaiNN_NN.md': `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---

# NN index

* [[kNNowledge/Session-Test_V_1-0-0_Template_NN.md]]
`,
  kNNowledge: {
    'Session-Test_V_1-0-0_Template_NN.md': testModelContent,
  },
}

describe('workspaceStore — Session persistence (R-SP-06)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await dbClear('session')
    await dbClear('treeState')
  })

  it('open() persists lastFile and lastOpenedAt after successful parse', async () => {
    const workspaceStore = useWorkspaceStore()
    const handle = buildFakeTree('workspace', testTree)

    await workspaceStore.open(handle)

    // Verify session was persisted
    const session = await getSessionState()
    expect(session.lastFile).toBeDefined()
    expect(typeof session.lastFile).toBe('string')
    expect(session.lastOpenedAt).toBeDefined()
    expect(typeof session.lastOpenedAt).toBe('string')
    // lastOpenedAt should be an ISO-8601 string
    expect(new Date(session.lastOpenedAt as string).toISOString()).toBe(session.lastOpenedAt)
  })

  it('recoverHandle() restores uiStore state from session', async () => {
    const workspaceStore = useWorkspaceStore()
    const handle = buildFakeTree('workspace', testTree)

    // First, open a workspace to populate the handle store
    await workspaceStore.open(handle)

    // Manually set session state as if it was persisted from a previous session
    await setSessionState('selectedNodeId', 'kNNowledge/Session-Test_V_1-0-0_Template_NN.md/Root')
    await setSessionState('activeView', 'graph')

    // Reset the pinia stores to simulate page reload
    setActivePinia(createPinia())
    const freshWorkspaceStore = useWorkspaceStore()
    const freshUiStore = useUiStore()

    // Recover handle — this should restore uiStore state
    const recovered = await freshWorkspaceStore.recoverHandle()
    expect(recovered).toBeDefined()

    // Verify uiStore state was restored
    expect(freshUiStore.selectedNodeId).toBe('kNNowledge/Session-Test_V_1-0-0_Template_NN.md/Root')
    expect(freshUiStore.activeView).toBe('graph')
  })

  it('recoverHandle() does not overwrite state if no session exists', async () => {
    const workspaceStore = useWorkspaceStore()
    const handle = buildFakeTree('workspace', testTree)

    // Open workspace to populate handle store
    await workspaceStore.open(handle)

    // Clear session store so getSessionState returns empty
    await dbClear('session')

    // Reset the pinia stores
    setActivePinia(createPinia())
    const freshWorkspaceStore = useWorkspaceStore()
    const freshUiStore = useUiStore()

    const recovered = await freshWorkspaceStore.recoverHandle()
    expect(recovered).toBeDefined()

    // uiStore state should remain at defaults
    expect(freshUiStore.selectedNodeId).toBeNull()
    expect(freshUiStore.activeView).toBe('editor')
  })
})
