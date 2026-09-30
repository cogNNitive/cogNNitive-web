import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ModelInfoPanel from '../../src/components/editor/ModelInfoPanel.vue'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { useModelStore } from '../../src/stores/modelStore'
import type { ModelNode } from '../../src/model/types'
import { buildFakeTree } from '../helpers/fakeFs'

function makeNode(id: string, overrides: Partial<ModelNode> = {}): ModelNode {
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

// Same model content for all cases: it pins `analysis_V_0-2-1`. `analysis`
// ships V_0-2-1 in SHIPPED_BLUEPRINT_VERSIONS, so whether the badge fires depends only on what
// the workspace scan says is newest (see each test's handle setup below).
const rootContent = `---
spec_version: "V_0-3-0"
parent_spec:
  name: "analysis_V_0-3-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/analysis/analysis_V_0-3-0_NN.md"
knowledge_version: "V_1-0-0"
title: "StartupValidation"
---

# NN StartupValidation
`

const oldPinContent = `---
spec_version: "V_0-3-0"
parent_spec:
  name: "analysis_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/analysis/analysis_V_0-2-1_NN.md"
knowledge_version: "V_1-0-0"
title: "StartupValidation"
---

# NN StartupValidation
`

describe('ModelInfoPanel.vue — Template Version Badge (D3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the badge and copyable prompt when the workspace has a newer template version', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: [],
          rawContent: oldPinContent,
          source: { path: 'Ghostbusters_V_0-1-2_business_NN.md' },
        }),
      },
      ['Root'],
    )

    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = buildFakeTree('workspace', {
      specs: {
        bluepriNNts: {
          analysis: {
            'analysis_V_0-3-0_NN.md': '---\nlevel: 2\n---\n',
          },
        },
      },
    }) as any
    workspaceStore.hasHandle = true

    const wrapper = mount(ModelInfoPanel, {
      props: { rootNodeId: 'Root' },
    })
    await flushPromises()

    const badge = wrapper.find('[data-testid="template-version-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('V_0-3-0')
    expect(badge.text()).toContain('V_0-2-1')

    const copyButton = wrapper.find('[data-testid="template-version-copy-prompt"]')
    expect(copyButton.exists()).toBe(true)
  })

  it('does not show the badge when the model already pins the newest known template version', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: [],
          rawContent: rootContent,
          source: { path: 'Ghostbusters_NN.md' },
        }),
      },
      ['Root'],
    )

    // No newer version anywhere: the bundled SHIPPED_BLUEPRINT_VERSIONS map
    // also pins "analysis" at V_0-2-1 (see config/samples.ts), matching the
    // model's own pinned version.
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = buildFakeTree('workspace', {
      specs: {
        bluepriNNts: {
          analysis: {
            'analysis_V_0-3-0_NN.md': '---\nlevel: 2\n---\n',
          },
        },
      },
    }) as any
    workspaceStore.hasHandle = true

    const wrapper = mount(ModelInfoPanel, {
      props: { rootNodeId: 'Root' },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="template-version-badge"]').exists()).toBe(false)
  })

  it('does not show the badge when no workspace handle is connected and no newer shipped version exists', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: [],
          rawContent: rootContent,
          source: { path: 'Ghostbusters_NN.md' },
        }),
      },
      ['Root'],
    )
    // Deliberately no handle connected — demo mode.

    const wrapper = mount(ModelInfoPanel, {
      props: { rootNodeId: 'Root' },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="template-version-badge"]').exists()).toBe(false)
  })
})
