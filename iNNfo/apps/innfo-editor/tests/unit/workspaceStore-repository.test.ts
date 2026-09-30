import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import type { IndexedDbWorkspaceRepository } from '../../src/repositories/IndexedDbWorkspaceRepository'
import { buildFakeTree } from '../helpers/fakeFs'

class MockWorkspaceRepository {
  storeHandle = vi.fn().mockResolvedValue(undefined)
  loadStoredHandle = vi.fn().mockResolvedValue(null)
  getSessionState = vi.fn().mockResolvedValue({})
  setSessionState = vi.fn().mockResolvedValue(undefined)
  setTreeState = vi.fn().mockResolvedValue(undefined)
  getTreeState = vi.fn().mockResolvedValue(new Map())
}

describe('workspaceStore Repository Delegation (TDD)', () => {
  let mockRepo: MockWorkspaceRepository

  beforeEach(() => {
    setActivePinia(createPinia())
    mockRepo = new MockWorkspaceRepository()
  })

  it('delegates handle storage and session persistence to the repository on open()', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.repository = mockRepo as unknown as IndexedDbWorkspaceRepository

    const handle = buildFakeTree('workspace', {
      'domaiNN_NN.md': `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---
# NN index
* [[kNNowledge/Doc_NN.md]]
`,
      kNNowledge: {
        'Doc_NN.md': `---
spec_version: "V_0-3-0"
knowledge_version: "V_1-0-0"
title: "Doc"
---
# NN index
`,
      },
    })

    await workspaceStore.open(handle)

    expect(mockRepo.storeHandle).toHaveBeenCalledWith(handle)
    expect(mockRepo.setSessionState).toHaveBeenCalledWith('lastOpenedAt', expect.any(String))
  })

  it('delegates handle recovery and session retrieval to the repository on recoverHandle()', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.repository = mockRepo as unknown as IndexedDbWorkspaceRepository
    const handle = buildFakeTree('workspace', {})
    mockRepo.loadStoredHandle.mockResolvedValue(handle)
    mockRepo.getSessionState.mockResolvedValue({
      selectedNodeId: 'Node1',
      activeView: 'graph',
    })

    const recovered = await workspaceStore.recoverHandle()

    expect(recovered).toBe(handle)
    expect(mockRepo.loadStoredHandle).toHaveBeenCalled()
  })

  it('delegates tree state persistence to the repository on persistTreeState()', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.repository = mockRepo as unknown as IndexedDbWorkspaceRepository

    await workspaceStore.persistTreeState('Node1', true)

    expect(mockRepo.setTreeState).toHaveBeenCalledWith('Node1', true)
  })

  it('delegates tree state restoration to the repository on restoreTreeState()', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.repository = mockRepo as unknown as IndexedDbWorkspaceRepository
    const expectedMap = new Map([['Node1', true]])
    mockRepo.getTreeState.mockResolvedValue(expectedMap)

    const state = await workspaceStore.restoreTreeState()

    expect(state).toEqual(expectedMap)
    expect(mockRepo.getTreeState).toHaveBeenCalled()
  })
})
