import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { useModelStore } from '../../src/stores/modelStore'
import { buildFakeTree } from '../helpers/fakeFs'

const domainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---

# NN index

* [[kNNowledge/Doc_NN.md]]
`

const validFormatMd = `---
spec_version: "V_0-3-0"
spec_url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
level: 3
parent_spec:
  name: "business"
  url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-0-1"
title: "Workspace Store Fixture"
---

# NN Business summary

Fixture used to exercise workspaceStore.open() integrity-check wiring.
`

describe('workspaceStore integrity check (AD-6)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('open() never awaits the integrity check and does not reject open()', async () => {
    const workspaceStore = useWorkspaceStore()
    const modelStore = useModelStore()
    const handle = buildFakeTree('workspace', {
      'domaiNN_NN.md': domainMd,
      kNNowledge: {
        'Doc_NN.md': validFormatMd,
      },
    })

    // Network is unavailable in tests → fetchCatalog degrades to offline.
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'))

    await expect(workspaceStore.open(handle)).resolves.toBeUndefined()
    expect(workspaceStore.hasParsed).toBe(true)
    expect(modelStore.rootIds.length).toBeGreaterThan(0)
  })

  it('a rejecting integrity check never sets the workspace error state', async () => {
    const workspaceStore = useWorkspaceStore()
    const handle = buildFakeTree('workspace', {
      'domaiNN_NN.md': domainMd,
      kNNowledge: {
        'Doc_NN.md': validFormatMd,
      },
    })

    // Simulate a catastrophic port failure inside the check builder.
    const module = await import('../../src/services/workspaceIntegrityPorts')
    vi.spyOn(module, 'createWorkspaceIntegrityPorts').mockImplementation(() => {
      throw new Error('ports exploded')
    })

    await workspaceStore.open(handle)
    expect(workspaceStore.error).toBeNull()
    expect(workspaceStore.hasParsed).toBe(true)
    await vi.waitFor(() => {
      expect(workspaceStore.integrityRunning).toBe(false)
    })
    expect(workspaceStore.integrityReport).toBeNull()
  })

  it('reset() clears integrityReport and integrityRunning', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.integrityReport = {
      schemaVersion: 1,
      generatedAt: '2026-04-18T00:00:00.000Z',
      verdict: 'clean',
      summary: { total: 1, clean: 1, warnings: 0, blockers: 0 },
      checks: [
        {
          id: 'catalog:business:freshness',
          category: 'catalog',
          severity: 'clean',
          title: 'Catalog entry fresh',
          message: 'Template business matches latest release',
          source: { kind: 'template', name: 'business', version: 'V_0-2-3' },
          remediation: 'none',
        },
      ],
    }
    workspaceStore.integrityRunning = true

    workspaceStore.reset()

    expect(workspaceStore.integrityReport).toBeNull()
    expect(workspaceStore.integrityRunning).toBe(false)
  })
})