import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import WorkspaceExplorer from '../../src/components/layout/WorkspaceExplorer.vue'
import { useModelStore } from '../../src/stores/modelStore'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { useUiStore } from '../../src/stores/uiStore'
import type { ModelNode } from '../../src/model/types'

describe('WorkspaceExplorer Component (specs/workspace-file-explorer)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders filesystem explorer without category filter chips', async () => {
    const modelStore = useModelStore()
    const node: ModelNode = {
      id: 'system_01.md',
      name: 'System Architecture',
      parentId: null,
      childIds: [],
      type: 'text',
      fields: {},
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/system_01.md' },
      rawContent: '---\ntitle: "System Architecture"\n---\n# NN index\n',
    }
    modelStore.setGraph({ 'system_01.md': node }, ['system_01.md'])

    const wrapper = mount(WorkspaceExplorer)
    await flushPromises()

    // Explorer container is present
    expect(wrapper.find('[data-testid="workspace-explorer"]').exists()).toBe(true)

    // Category filter chips do NOT exist
    expect(wrapper.text()).not.toContain('Models')
    expect(wrapper.text()).not.toContain('Sources')
    expect(wrapper.text()).not.toContain('Artifacts')

    // Search bar is present
    expect(wrapper.find('input[placeholder="Filter files..."]').exists()).toBe(true)
  })

  it('filters visible items dynamically when search query is typed', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        'doc_01.md': {
          id: 'doc_01.md',
          name: 'Documentation',
          parentId: null,
          childIds: [],
          type: 'text',
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'docs/guide.md' },
        },
        'arch_01.md': {
          id: 'arch_01.md',
          name: 'Architecture',
          parentId: null,
          childIds: [],
          type: 'text',
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'kNNowledge/arch.md' },
        },
      },
      ['doc_01.md', 'arch_01.md'],
    )

    const wrapper = mount(WorkspaceExplorer)
    await flushPromises()

    expect(wrapper.text()).toContain('guide.md')
    expect(wrapper.text()).toContain('arch.md')

    const input = wrapper.find('input[placeholder="Filter files..."]')
    await input.setValue('arch')

    expect(wrapper.text()).toContain('arch.md')
    expect(wrapper.text()).not.toContain('guide.md')
  })

  it('selects model and sets activeView to editor when clicking a model file', async () => {
    const modelStore = useModelStore()
    const uiStore = useUiStore()

    const node: ModelNode = {
      id: 'system_01.md',
      name: 'System Architecture',
      parentId: null,
      childIds: [],
      type: 'text',
      fields: {},
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/system_01.md' },
    }
    modelStore.setGraph({ 'system_01.md': node }, ['system_01.md'])
    uiStore.setActiveView('info')

    const wrapper = mount(WorkspaceExplorer)
    await flushPromises()

    // Find the file node for system_01.md
    const fileRow = wrapper.find('.group.flex.items-center')
    expect(fileRow.exists()).toBe(true)

    // Trigger select on model file
    const fileTreeNode = wrapper.findComponent({ name: 'FileTreeNode' })
    expect(fileTreeNode.exists()).toBe(true)

    fileTreeNode.vm.$emit('select-file', {
      name: 'system_01.md',
      kind: 'file',
      path: 'kNNowledge/system_01.md',
    })

    expect(uiStore.selectedNodeId).toBe('system_01.md')
    expect(uiStore.activeView).toBe('editor')
  })
})
