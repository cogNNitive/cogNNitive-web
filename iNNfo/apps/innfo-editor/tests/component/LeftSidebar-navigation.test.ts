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

describe('LeftSidebar — Dedicated Content Tree Navigation (specs/editor-navigation)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does NOT render view switcher tabs (editor, graph, consoles, explorer)', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        'workspace_01.md': makeModelRootNode('workspace_01.md', 'workspace_01.md'),
      },
      ['workspace_01.md'],
    )

    const wrapper = mount(LeftSidebar)

    // Verify view switcher buttons do NOT exist in LeftSidebar
    expect(wrapper.find('[data-testid="view-switcher-editor"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="view-switcher-graph"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="view-switcher-consoles"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="view-switcher-explorer"]').exists()).toBe(false)
  })

  it('permanently renders semantic model header and tree structure', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        'workspace_01.md': makeModelRootNode('workspace_01.md', 'workspace_01.md'),
      },
      ['workspace_01.md'],
    )

    const wrapper = mount(LeftSidebar)

    expect(wrapper.find('[data-testid="model-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="model-header-name"]').text()).toContain('workspace_01.md')
  })

  it('preserves tree accessibility regardless of uiStore.activeView', async () => {
    const modelStore = useModelStore()
    const uiStore = useUiStore()
    modelStore.setGraph(
      {
        'workspace_01.md': makeModelRootNode('workspace_01.md', 'workspace_01.md'),
      },
      ['workspace_01.md'],
    )

    const wrapper = mount(LeftSidebar)

    // Tree is rendered in editor view
    uiStore.setActiveView('editor')
    expect(wrapper.find('[data-testid="model-header"]').exists()).toBe(true)

    // Tree remains rendered in graph view
    uiStore.setActiveView('graph')
    expect(wrapper.find('[data-testid="model-header"]').exists()).toBe(true)

    // Tree remains rendered in consoles view
    uiStore.setActiveView('consoles')
    expect(wrapper.find('[data-testid="model-header"]').exists()).toBe(true)
  })
})
