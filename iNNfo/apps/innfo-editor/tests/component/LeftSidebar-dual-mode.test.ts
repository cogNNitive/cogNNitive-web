import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LeftSidebar from '../../src/components/layout/LeftSidebar.vue'
import { useModelStore } from '../../src/stores/modelStore'
import { useUiStore } from '../../src/stores/uiStore'
import type { KnowledgeNode } from '../../src/model/types'

function makeModelRootNode(id: string, path: string): KnowledgeNode {
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
    source: { path },
    rawContent: `---
title: "${id}"
status: "active"
---
# NN index
`,
  }
}

describe('LeftSidebar — Dual Mode Navigation (R-DMS-01)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders Workspace Mode by default and displays compact inline metrics pill with tooltip', () => {
    const modelStore = useModelStore()
    const uiStore = useUiStore()
    modelStore.setGraph(
      {
        'workspace_01.md': makeModelRootNode('workspace_01.md', 'workspace_01.md'),
        'auth_01.md': makeModelRootNode('auth_01.md', 'kNNowledge/auth_01.md'),
      },
      ['workspace_01.md', 'auth_01.md'],
    )

    expect(uiStore.sidebarMode).toBe('workspace')

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    // Bulky overview panel should no longer exist
    expect(wrapper.find('[data-testid="workspace-overview-panel"]').exists()).toBe(false)

    // Compact metrics pill should be present in header
    const pill = wrapper.find('[data-testid="workspace-metrics-pill"]')
    expect(pill.exists()).toBe(true)
    expect(pill.find('[data-testid="metric-active-count"]').text()).toBe('2')
    expect(pill.find('[data-testid="metric-draft-count"]').exists()).toBe(false)
    expect(pill.attributes('title')).toBe('Workspace Models: 2 total (2 active, 0 draft)')
  })

  it('renders active and draft counts correctly in metrics pill when draft models exist', () => {
    const modelStore = useModelStore()
    const draftNode = makeModelRootNode('draft_01.md', 'kNNowledge/draft_01.md')
    draftNode.rawContent = `---
title: "draft_01.md"
status: "draft"
---
# Draft
`
    modelStore.setGraph(
      {
        'workspace_01.md': makeModelRootNode('workspace_01.md', 'workspace_01.md'),
        'draft_01.md': draftNode,
      },
      ['workspace_01.md', 'draft_01.md'],
    )

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    const pill = wrapper.find('[data-testid="workspace-metrics-pill"]')
    expect(pill.exists()).toBe(true)
    expect(pill.find('[data-testid="metric-active-count"]').text()).toBe('1')
    expect(pill.find('[data-testid="metric-draft-count"]').text()).toBe('1')
    expect(pill.attributes('title')).toBe('Workspace Models: 2 total (1 active, 1 draft)')
  })

  it('renders Focused Model Mode with top breadcrumb banner when a model is focused', async () => {
    const modelStore = useModelStore()
    const uiStore = useUiStore()
    modelStore.setGraph(
      {
        'workspace_01.md': makeModelRootNode('workspace_01.md', 'workspace_01.md'),
        'auth_01.md': makeModelRootNode('auth_01.md', 'kNNowledge/auth_01.md'),
      },
      ['workspace_01.md', 'auth_01.md'],
    )

    uiStore.focusModel('auth_01.md')
    expect(uiStore.sidebarMode).toBe('focused_model')

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    const breadcrumb = wrapper.find('[data-testid="breadcrumb-back-workspace"]')
    expect(breadcrumb.exists()).toBe(true)
    expect(breadcrumb.text()).toContain('Back to Workspace Overview')

    // Click breadcrumb back button
    await breadcrumb.trigger('click')
    expect(uiStore.sidebarMode).toBe('workspace')
  })
})
