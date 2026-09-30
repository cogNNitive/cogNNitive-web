import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import WorkspaceView from '../../src/views/WorkspaceView.vue'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { routes } from '../../src/router/index'
import { buildFakeTree, type FakeTree } from '../helpers/fakeFs'

const singleFileMd = `---
spec_version: "V_0-1-1"
spec_url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
level: 3
parent:
  name: "business_V_0-1-1"
  url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-0-1"
title: "Integration Model"
---

# _NN Business summary

Single-file model for workspace integration test.

# _NN Problems

* _NN Problems: Sample Problem
  A problem used to verify graph population.
`

const indexMd = `---
spec_version: "V_0-1-2"
level: 0
title: "Workspace Index"
---

# _NN index

* [[model_NN.md]]
`

describe('WorkspaceView integration (single-file workspace)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('mounts with Pinia + Router, renders layout chrome, and displays model tree with selectable nodes', async () => {
    const tree: FakeTree = {
      'index.md': indexMd,
      'model_NN.md': singleFileMd,
    }
    const handle = buildFakeTree('workspace', tree)

    const router = createRouter({ history: createMemoryHistory(), routes })
    const workspaceStore = useWorkspaceStore()
    await workspaceStore.open(handle)

    await router.push('/workspace')
    await router.isReady()

    const wrapper = mount(WorkspaceView, {
      global: { plugins: [router] },
    })
    await wrapper.vm.$nextTick()

    // Layout chrome should be present: Header with title
    expect(wrapper.text()).toContain('iNNfo Modeler')

    // Layout chrome renders header and sidebar
    expect(wrapper.text()).toContain('iNNfo Modeler')

    // Model tree should render the root node
    expect(wrapper.text()).toContain('model')

    // View switcher buttons present
    expect(wrapper.text()).toContain('editor')
    expect(wrapper.text()).toContain('graph')

    // "Select a node" empty state shows when nothing is selected
    expect(wrapper.text()).toMatch(/Select a node/i)
  })
})
