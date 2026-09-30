import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import KnowledgeInfoPanel from '../../src/components/editor/KnowledgeInfoPanel.vue'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import type { KnowledgeNode } from '../../src/model/types'
import { buildFakeTree } from '../helpers/fakeFs'

function makeNode(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    storageMode: 'FILE' as const,
    type: 'text',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
    ...overrides,
  }
}

describe('KnowledgeInfoPanel.vue — Embedded Workspace File Explorer (specs/workspace-file-explorer)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders embedded WorkspaceExplorer inside Workspace Directory section', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: [],
          rawContent: '---\ntitle: "My Architecture"\n---\n# NN index\n',
          source: { path: 'kNNowledge/arch_NN.md' },
        }),
      },
      ['Root'],
    )

    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = buildFakeTree('workspace', {
      models: {
        'arch_NN.md': '---\ntitle: "My Architecture"\n---\n',
      },
      docs: {
        'readme.md': '# Readme\n',
      },
    }) as any
    workspaceStore.hasHandle = true

    const wrapper = mount(KnowledgeInfoPanel, {
      props: { rootNodeId: 'Root' },
    })
    await flushPromises()

    const explorerContainer = wrapper.find('[data-testid="embedded-workspace-explorer"]')
    expect(explorerContainer.exists()).toBe(true)

    const explorerComponent = wrapper.find('[data-testid="workspace-explorer"]')
    expect(explorerComponent.exists()).toBe(true)
    expect(explorerComponent.text()).toContain('Explorer')
  })
})
