import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import ConceptTreeNode from '../../src/components/layout/ConceptTreeNode.vue'
import { useModelStore } from '../../src/stores/modelStore'
import { useUiStore } from '../../src/stores/uiStore'
import type { ModelNode } from '../../src/model/types'

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

describe('ConceptTreeNode.vue — Instance counter (R-TN-02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows instance count badge when node has children', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: ['Root/Child1', 'Root/Child2', 'Root/Child3'],
        }),
        'Root/Child1': makeNode('Root/Child1', { parentId: 'Root', kind: 'element' }),
        'Root/Child2': makeNode('Root/Child2', { parentId: 'Root', kind: 'element' }),
        'Root/Child3': makeNode('Root/Child3', { parentId: 'Root', kind: 'element' }),
      },
      ['Root'],
    )

    const wrapper = mount(ConceptTreeNode, {
      props: {
        nodeId: 'Root',
        selectedId: null,
      },
      attachTo: document.body,
    })

    // Should show "3" in a counter badge
    expect(wrapper.text()).toContain('3')
  })

  it('does not show counter badge when node has no children', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', { kind: 'concept', childIds: [] }),
      },
      ['Root'],
    )

    const wrapper = mount(ConceptTreeNode, {
      props: {
        nodeId: 'Root',
        selectedId: null,
      },
    })

    // Should NOT show a "0" counter badge
    expect(wrapper.text()).not.toContain('0')
  })
})

describe('ConceptTreeNode.vue — Ghost appearance (R-TN-04)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('applies opacity 0.45 on row when node is empty (no content, no fields, no children)', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', { kind: 'concept', childIds: [], rawContent: '' }),
      },
      ['Root'],
    )

    const wrapper = mount(ConceptTreeNode, {
      props: {
        nodeId: 'Root',
        selectedId: null,
      },
      attachTo: document.body,
    })

    // The row style (with opacity) is on the inner flex div, not the root .select-none div
    const row = wrapper.find('.flex.items-center')
    expect((row.element as HTMLElement).style.opacity).toBe('0.45')
  })

  it('does NOT apply reduced opacity when node has children', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', { kind: 'concept', childIds: ['Root/Child1'] }),
        'Root/Child1': makeNode('Root/Child1', { parentId: 'Root', kind: 'element' }),
      },
      ['Root'],
    )

    const wrapper = mount(ConceptTreeNode, {
      props: {
        nodeId: 'Root',
        selectedId: null,
      },
    })

    const row = wrapper.find('.flex.items-center')
    expect((row.element as HTMLElement).style.opacity).not.toBe('0.45')
  })

  it('does NOT apply reduced opacity when node has fallback description in rawSections', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'element',
          childIds: [],
          rawContent: '',
          rawSections: { description: 'This is a description' },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(ConceptTreeNode, {
      props: {
        nodeId: 'Root',
        selectedId: null,
      },
    })

    const row = wrapper.find('.flex.items-center')
    expect((row.element as HTMLElement).style.opacity).not.toBe('0.45')
  })
})

describe('ConceptTreeNode.vue — BlockPill integration (R-TN-01)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the BlockPill component inside the tree row', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', { kind: 'concept', childIds: [] }),
      },
      ['Root'],
    )

    const wrapper = mount(ConceptTreeNode, {
      props: {
        nodeId: 'Root',
        selectedId: null,
      },
    })

    // BlockPill should be rendered within the tree row
    expect(wrapper.findComponent({ name: 'Pill' }).exists()).toBe(true)
  })

  it('passes the node name to BlockPill', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: { ...makeNode('Root', { kind: 'concept', childIds: [] }), name: 'MyConcept' },
      },
      ['Root'],
    )

    const wrapper = mount(ConceptTreeNode, {
      props: {
        nodeId: 'Root',
        selectedId: null,
      },
    })

    expect(wrapper.text()).toContain('MyConcept')
  })

  it('renders italic styling for empty nodes without literal "Empty" text', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', { kind: 'concept', childIds: [], rawContent: '' }),
      },
      ['Root'],
    )

    const wrapper = mount(ConceptTreeNode, {
      props: {
        nodeId: 'Root',
        selectedId: null,
      },
      attachTo: document.body,
    })

    const italicSpan = wrapper.find('span.italic')
    expect(italicSpan.exists()).toBe(true)
    expect(italicSpan.text()).toContain('Root')
  })
})

describe('ConceptTreeNode.vue — Diamond child renders once (R8)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  /**
   * Mounts two sibling ConceptTreeNode subtrees inside labeled containers,
   * simulating the sidebar rendering two parents that both reference the
   * same diamond child via `childIds` (PR1's diamond-vs-cycle fix allows
   * this — the child keeps a single primary `parentId`).
   */
  function mountTwoTrees(rootAId: string, rootBId: string) {
    const TwoTrees = defineComponent({
      components: { ConceptTreeNode },
      template: `
        <div>
          <div data-testid="tree-a"><ConceptTreeNode :node-id="'${rootAId}'" :selected-id="null" /></div>
          <div data-testid="tree-b"><ConceptTreeNode :node-id="'${rootBId}'" :selected-id="null" /></div>
        </div>
      `,
    })
    return mount(TwoTrees, { attachTo: document.body })
  }

  it('renders a diamond child only under its primary parent (ParentA), not under both', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        ParentA: makeNode('ParentA', { kind: 'concept', childIds: ['Diamond'] }),
        ParentB: makeNode('ParentB', { kind: 'concept', childIds: ['Diamond'] }),
        Diamond: makeNode('Diamond', {
          parentId: 'ParentA',
          kind: 'element',
          name: 'DiamondChild',
        }),
      },
      ['ParentA', 'ParentB'],
    )

    const wrapper = mountTwoTrees('ParentA', 'ParentB')

    const treeA = wrapper.find('[data-testid="tree-a"]')
    const treeB = wrapper.find('[data-testid="tree-b"]')

    expect(treeA.text()).toContain('DiamondChild')
    expect(treeB.text()).not.toContain('DiamondChild')
  })

  it('renders a diamond child only under its primary parent (ParentB) — triangulation with the opposite primary parent', () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        ParentA: makeNode('ParentA', { kind: 'concept', childIds: ['Diamond'] }),
        ParentB: makeNode('ParentB', { kind: 'concept', childIds: ['Diamond'] }),
        Diamond: makeNode('Diamond', {
          parentId: 'ParentB',
          kind: 'element',
          name: 'DiamondChild',
        }),
      },
      ['ParentA', 'ParentB'],
    )

    const wrapper = mountTwoTrees('ParentA', 'ParentB')

    const treeA = wrapper.find('[data-testid="tree-a"]')
    const treeB = wrapper.find('[data-testid="tree-b"]')

    expect(treeB.text()).toContain('DiamondChild')
    expect(treeA.text()).not.toContain('DiamondChild')
  })

  describe('Element-Owned Submodel Nesting (ADR-01/03 & Phase 3)', () => {
    it('renders nested child submodel node when element has a type:: knowledge field', () => {
      const modelStore = useModelStore()
      const rootNode = makeNode('kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md', {
        kind: 'root',
        source: { path: 'kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md' },
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
      })
      const elementNode = makeNode('kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md/initiative_01', {
        name: 'Municipal Franchise Expansion',
        parentId: rootNode.id,
        kind: 'element',
        type: 'Initiative',
        fields: {
          business_model: {
            value: '[[kNNowledge/Ghostbusters_V_0-2-0_business_NN.md]]',
          },
        },
      })
      const submodelNode = makeNode('kNNowledge/Ghostbusters_V_0-2-0_business_NN.md', {
        name: 'Ghostbusters Inc. Municipal Franchise Business Model',
        kind: 'root',
        source: { path: 'kNNowledge/Ghostbusters_V_0-2-0_business_NN.md' },
      })

      modelStore.setGraph(
        {
          [rootNode.id]: rootNode,
          [elementNode.id]: elementNode,
          [submodelNode.id]: submodelNode,
        },
        [rootNode.id, submodelNode.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      const nested = wrapper.find('[data-testid="nested-submodel-node"]')
      expect(nested.exists()).toBe(true)
    })

    it('displays submodel name, Boxes icon, and target_blueprint badge', () => {
      const modelStore = useModelStore()
      const rootNode = makeNode('kNNowledge/root_NN.md', {
        kind: 'root',
        source: { path: 'kNNowledge/root_NN.md' },
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
      })
      const elementNode = makeNode('kNNowledge/root_NN.md/elem_01', {
        name: 'Initiative 1',
        parentId: rootNode.id,
        kind: 'element',
        type: 'Initiative',
        fields: {
          business_model: {
            value: 'kNNowledge/sub_business_NN.md',
          },
        },
      })
      const submodelNode = makeNode('kNNowledge/sub_business_NN.md', {
        name: 'Sub Business Model',
        kind: 'root',
        source: { path: 'kNNowledge/sub_business_NN.md' },
      })

      modelStore.setGraph(
        {
          [rootNode.id]: rootNode,
          [elementNode.id]: elementNode,
          [submodelNode.id]: submodelNode,
        },
        [rootNode.id, submodelNode.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      const nested = wrapper.find('[data-testid="nested-submodel-node"]')
      expect(nested.text()).toContain('Sub Business Model')
      const badge = wrapper.find('[data-testid="nested-submodel-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe('business')
    })

    it('renders nested submodel fallback node without isolate jump on click', async () => {
      const modelStore = useModelStore()
      const uiStore = useUiStore()
      const focusSpy = vi.spyOn(uiStore, 'focusModel')

      const rootNode = makeNode('kNNowledge/root_NN.md', {
        kind: 'root',
        source: { path: 'kNNowledge/root_NN.md' },
        localMetamodel: {
          concepts: [
            {
              name: 'Initiative',
              type: 'group',
              fields: [{ name: 'sub', type: 'model' }],
            },
          ],
          markers: [],
          relationshipTypes: [],
        },
      })
      const elementNode = makeNode('kNNowledge/root_NN.md/elem_01', {
        name: 'Initiative 1',
        parentId: rootNode.id,
        kind: 'element',
        type: 'Initiative',
        fields: { sub: { value: 'kNNowledge/sub_NN.md' } },
      })
      const submodelNode = makeNode('kNNowledge/sub_NN.md', {
        name: 'Sub Model',
        kind: 'root',
        source: { path: 'kNNowledge/sub_NN.md' },
      })

      modelStore.setGraph(
        {
          [rootNode.id]: rootNode,
          [elementNode.id]: elementNode,
          [submodelNode.id]: submodelNode,
        },
        [rootNode.id, submodelNode.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      const nested = wrapper.find('[data-testid="nested-submodel-node"]')
      expect(nested.exists()).toBe(true)
      await nested.trigger('click')

      expect(focusSpy).not.toHaveBeenCalled()
      focusSpy.mockRestore()
    })

    it('collapsing parent element hides nested submodels', async () => {
      const modelStore = useModelStore()
      const rootNode = makeNode('kNNowledge/root_NN.md', {
        kind: 'root',
        source: { path: 'kNNowledge/root_NN.md' },
        localMetamodel: {
          concepts: [
            {
              name: 'Initiative',
              type: 'group',
              fields: [{ name: 'sub', type: 'model' }],
            },
          ],
          markers: [],
          relationshipTypes: [],
        },
      })
      const elementNode = makeNode('kNNowledge/root_NN.md/elem_01', {
        name: 'Initiative 1',
        parentId: rootNode.id,
        kind: 'element',
        type: 'Initiative',
        fields: { sub: { value: 'kNNowledge/sub_NN.md' } },
      })
      const submodelNode = makeNode('kNNowledge/sub_NN.md', {
        name: 'Sub Model',
        kind: 'root',
        source: { path: 'kNNowledge/sub_NN.md' },
      })

      modelStore.setGraph(
        {
          [rootNode.id]: rootNode,
          [elementNode.id]: elementNode,
          [submodelNode.id]: submodelNode,
        },
        [rootNode.id, submodelNode.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      expect(wrapper.find('[data-testid="nested-submodel-node"]').exists()).toBe(true)

      // Click collapse button
      const collapseBtn = wrapper.find('button[title="Collapse"]')
      await collapseBtn.trigger('click')

      expect(wrapper.find('[data-testid="nested-submodel-node"]').exists()).toBe(false)
    })

    it('empty or unresolved submodel references do not render phantom child nodes', () => {
      const modelStore = useModelStore()
      const rootNode = makeNode('kNNowledge/root_NN.md', {
        kind: 'root',
        source: { path: 'kNNowledge/root_NN.md' },
        localMetamodel: {
          concepts: [
            {
              name: 'Initiative',
              type: 'group',
              fields: [
                { name: 'empty_sub', type: 'model' },
                { name: 'missing_sub', type: 'model' },
              ],
            },
          ],
          markers: [],
          relationshipTypes: [],
        },
      })
      const elementNode = makeNode('kNNowledge/root_NN.md/elem_01', {
        name: 'Initiative 1',
        parentId: rootNode.id,
        kind: 'element',
        type: 'Initiative',
        fields: {
          empty_sub: { value: '' },
          missing_sub: { value: 'kNNowledge/non_existent_NN.md' },
        },
      })

      modelStore.setGraph(
        {
          [rootNode.id]: rootNode,
          [elementNode.id]: elementNode,
        },
        [rootNode.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      expect(wrapper.find('[data-testid="nested-submodel-node"]').exists()).toBe(false)
    })

    it('does not render quick open model button on node row referencing a submodel', async () => {
      const modelStore = useModelStore()

      const rootNode = makeNode('kNNowledge/root_NN.md', {
        kind: 'root',
        source: { path: 'kNNowledge/root_NN.md' },
        localMetamodel: {
          concepts: [
            {
              name: 'Models',
              type: 'model',
              fields: [{ name: 'path', type: 'model' }],
            },
          ],
          markers: [],
          relationshipTypes: [],
        },
      })
      const elementNode = makeNode('kNNowledge/root_NN.md/elem_01', {
        name: 'Diagnóstico y Especificación Técnica',
        parentId: rootNode.id,
        kind: 'element',
        type: 'Models',
        fields: {
          path: { value: 'kNNowledge/rehabilitacion_reja_pozuelo_V_0-1-0_rejas_rehabilitacion_NN.md' },
        },
      })
      const targetModel = makeNode('kNNowledge/rehabilitacion_reja_pozuelo_V_0-1-0_rejas_rehabilitacion_NN.md', {
        name: 'Rehabilitación Reja Pozuelo',
        kind: 'root',
        source: { path: 'kNNowledge/rehabilitacion_reja_pozuelo_V_0-1-0_rejas_rehabilitacion_NN.md' },
      })

      modelStore.setGraph(
        {
          [rootNode.id]: rootNode,
          [elementNode.id]: elementNode,
          [targetModel.id]: targetModel,
        },
        [rootNode.id, targetModel.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      const openBtn = wrapper.find('[data-testid="tree-node-open-model"]')
      expect(openBtn.exists()).toBe(false)
    })

    it('does not render quick open model button on Level-3 workspace element without localMetamodel', async () => {
      const modelStore = useModelStore()

      const workspaceRoot = makeNode('workspace_NN.md', {
        kind: 'root',
        source: { path: 'workspace_NN.md' },
      })
      const elementNode = makeNode('workspace_NN.md/elem_01', {
        name: 'Diagnóstico y Especificación Técnica',
        parentId: workspaceRoot.id,
        kind: 'element',
        type: 'Models',
        fields: {
          path: { value: 'kNNowledge/rehabilitacion_reja_pozuello_V_0-1-0_rejas_rehabilitacion_NN.md' },
        },
      })
      modelStore.setGraph(
        {
          [workspaceRoot.id]: workspaceRoot,
          [elementNode.id]: elementNode,
        },
        [workspaceRoot.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      const openBtn = wrapper.find('[data-testid="tree-node-open-model"]')
      expect(openBtn.exists()).toBe(false)
    })

    it('does not render quick open model button when element has "model ref" or "model_ref" field', async () => {
      const modelStore = useModelStore()

      const workspaceRoot = makeNode('workspace_NN.md', {
        kind: 'root',
        source: { path: 'workspace_NN.md' },
      })
      const elementNode = makeNode('workspace_NN.md/elem_discografia', {
        name: 'Discografia',
        parentId: workspaceRoot.id,
        kind: 'element',
        type: 'Models',
        fields: {
          'model ref': { value: 'kNNowledge/discografia_V_0-1-0_discografia_NN.md' },
        },
      })
      modelStore.setGraph(
        {
          [workspaceRoot.id]: workspaceRoot,
          [elementNode.id]: elementNode,
        },
        [workspaceRoot.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      const openBtn = wrapper.find('[data-testid="tree-node-open-model"]')
      expect(openBtn.exists()).toBe(false)
    })

    it('recursively unfolds submodel concepts directly when submodel node exists in store', async () => {
      const modelStore = useModelStore()

      const workspaceRoot = makeNode('workspace_NN.md', {
        kind: 'root',
        source: { path: 'workspace_NN.md' },
      })
      const elementNode = makeNode('workspace_NN.md/elem_discografia', {
        name: 'Discografia',
        parentId: workspaceRoot.id,
        kind: 'element',
        type: 'Models',
        fields: {
          'model ref': { value: 'kNNowledge/discografia_V_0-1-0_discografia_NN.md' },
        },
      })
      const submodelRoot = makeNode('kNNowledge/discografia_V_0-1-0_discografia_NN.md', {
        kind: 'root',
        source: { path: 'kNNowledge/discografia_V_0-1-0_discografia_NN.md' },
        childIds: ['kNNowledge/discografia_V_0-1-0_discografia_NN.md/disco_1'],
        localMetamodel: {
          concepts: [
            { name: 'Disco', type: 'concept', icon: 'disc', color: 'blue' },
          ],
          taxonomy: [{ parent: '', child: 'Disco' }],
          conceptFields: {},
          markers: [],
        },
      })
      const discoElement = makeNode('kNNowledge/discografia_V_0-1-0_discografia_NN.md/disco_1', {
        name: 'Appetite for Destruction',
        parentId: submodelRoot.id,
        kind: 'element',
        type: 'Disco',
      })

      modelStore.setGraph(
        {
          [workspaceRoot.id]: workspaceRoot,
          [elementNode.id]: elementNode,
          [submodelRoot.id]: submodelRoot,
          [discoElement.id]: discoElement,
        },
        [workspaceRoot.id, submodelRoot.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      // The tree node for Discografia should show chevron and contain the submodel's concept Disco
      expect(wrapper.text()).toContain('Discografia')
      expect(wrapper.text()).toContain('Disco')
      expect(wrapper.text()).toContain('Appetite for Destruction')
    })

    it('unfolds submodel concepts when element references a model via wikilink format in business_model field', async () => {
      const modelStore = useModelStore()

      const projectRoot = makeNode('kNNowledge/programa_V_0-1-0_NN.md', {
        kind: 'root',
        source: { path: 'kNNowledge/programa_V_0-1-0_NN.md' },
      })
      const elementNode = makeNode('kNNowledge/programa_V_0-1-0_NN.md/elem_containment', {
        name: 'Proyecto de High-Voltage Containment',
        parentId: projectRoot.id,
        kind: 'element',
        type: 'Proyecto',
        fields: {
          'business_model': { value: '[[containment-facility_V_0-1-0_business_NN.md]]' },
        },
      })
      const submodelRoot = makeNode('kNNowledge/containment-facility_V_0-1-0_business_NN.md', {
        name: 'Containment Facility Business Model',
        kind: 'root',
        source: { path: 'kNNowledge/containment-facility_V_0-1-0_business_NN.md' },
        childIds: ['kNNowledge/containment-facility_V_0-1-0_business_NN.md/initiative_1'],
        localMetamodel: {
          concepts: [
            { name: 'Propuesta', type: 'concept', icon: 'lightbulb', color: 'emerald' },
          ],
          taxonomy: [{ parent: '', child: 'Propuesta' }],
          conceptFields: {},
          markers: [],
        },
      })
      const subElement = makeNode('kNNowledge/containment-facility_V_0-1-0_business_NN.md/initiative_1', {
        name: 'Servicio de Mitigacion Espectral',
        parentId: submodelRoot.id,
        kind: 'element',
        type: 'Propuesta',
      })

      modelStore.setGraph(
        {
          [projectRoot.id]: projectRoot,
          [elementNode.id]: elementNode,
          [submodelRoot.id]: submodelRoot,
          [subElement.id]: subElement,
        },
        [projectRoot.id, submodelRoot.id],
      )

      const wrapper = mount(ConceptTreeNode, {
        props: {
          nodeId: elementNode.id,
          selectedId: null,
        },
        attachTo: document.body,
      })

      expect(wrapper.text()).toContain('Proyecto de High-Voltage Containment')
      expect(wrapper.text()).toContain('Propuesta')
      expect(wrapper.text()).toContain('Servicio de Mitigacion Espectral')
    })
  })
})

