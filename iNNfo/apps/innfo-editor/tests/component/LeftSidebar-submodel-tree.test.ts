import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LeftSidebar from '../../src/components/layout/LeftSidebar.vue'
import { useModelStore } from '../../src/stores/modelStore'
import { useUiStore } from '../../src/stores/uiStore'
import type { ModelNode } from '../../src/model/types'

function makeModelRootNode(
  id: string,
  path: string,
  overrides: Partial<ModelNode> = {},
): ModelNode {
  return {
    id,
    name: id,
    kind: 'root',
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
    ...overrides,
  }
}

describe('LeftSidebar — Submodel Tree Filtering (ADR-02 / Phase 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('excludes submodels referenced by domain elements via type:: knowledge from visibleRootIds in Workspace Mode', () => {
    const modelStore = useModelStore()
    const uiStore = useUiStore()

    const innovationRoot = makeModelRootNode(
      'kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md',
      'kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md',
      {
        childIds: ['kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md/initiative_01'],
        localMetamodel: {
          concepts: [
            {
              name: 'Initiative',
              type: 'group',
              fields: [
                {
                  name: 'business_model',
                  type: 'model',
                  target_blueprint: 'business',
                },
              ],
            },
          ],
          markers: [],
          relationshipTypes: [],
        },
      },
    )

    const initiativeElement: ModelNode = {
      id: 'kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md/initiative_01',
      name: 'Municipal Franchise Expansion',
      kind: 'element',
      type: 'Initiative',
      parentId: innovationRoot.id,
      childIds: [],
      fields: {
        business_model: {
          value: '[[kNNowledge/Ghostbusters_V_0-2-0_business_NN.md]]',
        },
      },
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md' },
    }

    const businessSubmodel = makeModelRootNode(
      'kNNowledge/Ghostbusters_V_0-2-0_business_NN.md',
      'kNNowledge/Ghostbusters_V_0-2-0_business_NN.md',
    )

    modelStore.setGraph(
      {
        [innovationRoot.id]: innovationRoot,
        [initiativeElement.id]: initiativeElement,
        [businessSubmodel.id]: businessSubmodel,
      },
      [innovationRoot.id, businessSubmodel.id],
    )

    expect(uiStore.sidebarMode).toBe('workspace')

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    // In Workspace Mode, business submodel should be excluded from top-level root list
    const text = wrapper.text()
    expect(text).toContain('Ghostbusters_V_0-2-0_innovation_NN.md')
    expect(text).not.toContain('Ghostbusters_V_0-2-0_business_NN.md')
  })

  it('keeps standalone root models not owned by any element visible in visibleRootIds', () => {
    const modelStore = useModelStore()
    const uiStore = useUiStore()

    const standaloneA = makeModelRootNode('kNNowledge/standalone_A_NN.md', 'kNNowledge/standalone_A_NN.md')
    const standaloneB = makeModelRootNode('kNNowledge/standalone_B_NN.md', 'kNNowledge/standalone_B_NN.md')

    modelStore.setGraph(
      {
        [standaloneA.id]: standaloneA,
        [standaloneB.id]: standaloneB,
      },
      [standaloneA.id, standaloneB.id],
    )

    expect(uiStore.sidebarMode).toBe('workspace')

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    const text = wrapper.text()
    expect(text).toContain('standalone_A_NN.md')
    expect(text).toContain('standalone_B_NN.md')
  })

  it('retains standard focused model display when switching to Focused Model mode', async () => {
    const modelStore = useModelStore()
    const uiStore = useUiStore()

    const rootModel = makeModelRootNode('kNNowledge/root_NN.md', 'kNNowledge/root_NN.md', {
      childIds: ['kNNowledge/root_NN.md/elem_01'],
      localMetamodel: {
        concepts: [
          {
            name: 'Elem',
            type: 'group',
            fields: [
              {
                name: 'sub',
                type: 'model',
              },
            ],
          },
        ],
        markers: [],
        relationshipTypes: [],
      },
    })

    const elem: ModelNode = {
      id: 'kNNowledge/root_NN.md/elem_01',
      name: 'Element 1',
      kind: 'element',
      type: 'Elem',
      parentId: rootModel.id,
      childIds: [],
      fields: {
        sub: { value: 'kNNowledge/sub_NN.md' },
      },
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/root_NN.md' },
    }

    const subModel = makeModelRootNode('kNNowledge/sub_NN.md', 'kNNowledge/sub_NN.md')

    modelStore.setGraph(
      {
        [rootModel.id]: rootModel,
        [elem.id]: elem,
        [subModel.id]: subModel,
      },
      [rootModel.id, subModel.id],
    )

    uiStore.focusModel('kNNowledge/sub_NN.md')
    expect(uiStore.sidebarMode).toBe('focused_model')

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    // In focused_model mode, the focused submodel is visible as the active/focused root
    const text = wrapper.text()
    expect(text).toContain('sub_NN.md')
  })
})
