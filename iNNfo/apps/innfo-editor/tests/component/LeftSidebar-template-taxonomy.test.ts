import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LeftSidebar from '../../src/components/layout/LeftSidebar.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
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
    source: { path: id },
    ...overrides,
  }
}

// Finds the group wrapper whose OWN header text includes `name` — since
// nested VirtualGroupNode DOM is rendered inside its parent's wrapper div,
// document order puts the outer/parent group first, so `.find` naturally
// returns the outer wrapper rather than a nested descendant.
function findGroupWrapper(wrappers: any[], name: string) {
  return wrappers.find((w) => w.text().includes(name))
}

describe('LeftSidebar — concept hierarchy inherited from template (R-TAX-INHERIT)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('nests a model with no own index according to its resolved template index', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        'model.md': makeNode('model.md', {
          source: { path: 'model.md' },
          childIds: ['bravo1'],
          rawContent: `---
level: 3
parent_spec:
  name: "biz_template_V_0-1-0_NN"
title: My Business
---

> [!NOTE]
> This is an **iNNfo document**.

# NN Bravo
## NN Bravo: First Bravo
`,
        }),
        bravo1: makeNode('bravo1', {
          name: 'First Bravo',
          parentId: 'model.md',
          type: 'Bravo',
          kind: 'element',
          source: { path: 'model.md' },
        }),
        'spec:biz_template_V_0-1-0': makeNode('spec:biz_template_V_0-1-0', {
          name: 'biz_template_V_0-1-0',
          kind: 'root' as const,
          sourceMode: 'structural' as const,
          localMetamodel: {
            concepts: [
              { name: 'Alpha', type: 'category' },
              { name: 'Bravo', type: 'weight' },
            ],
            markers: [],
            // `{ parent: '', child: 'Alpha' }` mirrors what parseIndexBlock()
            // emits for a real top-level `* [[Alpha]]` bullet in a `# NN
            // index` block — the empty-string parent marks Alpha as a root.
            taxonomy: [
              { parent: '', child: 'Alpha' },
              { parent: 'Alpha', child: 'Bravo' },
            ],
          },
        }),
      },
      ['model.md', 'spec:biz_template_V_0-1-0'],
    )

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    // Models start collapsed by default (feature: "collapsed initial state");
    // expand the model header, then Groups start collapsed too
    // (expandedGeneration starts at -1) — expand all so nested sub-groups
    // actually render into the DOM.
    await wrapper.find('[data-testid="model-header-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="expand-all"]').trigger('click')
    await wrapper.vm.$nextTick()

    const groups = wrapper.findAll('[data-testid="virtual-group-node"]')
    const alphaGroup = findGroupWrapper(groups as any, 'Alpha')
    expect(alphaGroup).toBeTruthy()
    // Bravo's DOM must be nested INSIDE Alpha's wrapper (per the template's
    // index), not rendered as a separate top-level sibling group.
    expect(alphaGroup!.text()).toContain('Bravo')
  })

  it('uses the resolved (specialized) template index, not another template present in the graph', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        'model.md': makeNode('model.md', {
          source: { path: 'model.md' },
          childIds: ['bravo1'],
          rawContent: `---
level: 3
parent_spec:
  name: "specialized_V_0-1-0_NN"
title: My Specialized Business
---

> [!NOTE]
> This is an **iNNfo document**.

# NN Bravo
## NN Bravo: First Bravo
`,
        }),
        bravo1: makeNode('bravo1', {
          name: 'First Bravo',
          parentId: 'model.md',
          type: 'Bravo',
          kind: 'element',
          source: { path: 'model.md' },
        }),
        // The "canonical" base template — declares a DIFFERENT index
        // (Alpha -> Gamma). Present in the graph, but NOT what this model's
        // parent_spec resolves to.
        'spec:base_V_0-1-0': makeNode('spec:base_V_0-1-0', {
          name: 'base_V_0-1-0',
          kind: 'root' as const,
          sourceMode: 'structural' as const,
          localMetamodel: {
            concepts: [
              { name: 'Alpha', type: 'category' },
              { name: 'Gamma', type: 'weight' },
            ],
            markers: [],
            taxonomy: [
              { parent: '', child: 'Alpha' },
              { parent: 'Alpha', child: 'Gamma' },
            ],
          },
        }),
        // The specialized fork this model actually resolves as its parent —
        // declares its own complete index (Alpha -> Bravo).
        'spec:specialized_V_0-1-0': makeNode('spec:specialized_V_0-1-0', {
          name: 'specialized_V_0-1-0',
          kind: 'root' as const,
          sourceMode: 'structural' as const,
          localMetamodel: {
            concepts: [
              { name: 'Alpha', type: 'category' },
              { name: 'Bravo', type: 'weight' },
            ],
            markers: [],
            taxonomy: [
              { parent: '', child: 'Alpha' },
              { parent: 'Alpha', child: 'Bravo' },
            ],
          },
        }),
      },
      ['model.md', 'spec:base_V_0-1-0', 'spec:specialized_V_0-1-0'],
    )

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    // Models start collapsed by default (feature: "collapsed initial state").
    await wrapper.find('[data-testid="model-header-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="expand-all"]').trigger('click')
    await wrapper.vm.$nextTick()

    const text = wrapper.text()
    // The base template's concept never appears — proving no merging with
    // any grandparent/other template happened.
    expect(text).not.toContain('Gamma')

    const groups = wrapper.findAll('[data-testid="virtual-group-node"]')
    const alphaGroup = findGroupWrapper(groups as any, 'Alpha')
    expect(alphaGroup).toBeTruthy()
    expect(alphaGroup!.text()).toContain('Bravo')
  })

  it('does not treat a model file as a template even if it ends with _spec_NN.md, if level: 3 is declared', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        'DeLoreanTimeTravel_V_0-1-0_spec_NN.md': makeNode('DeLoreanTimeTravel_V_0-1-0_spec_NN.md', {
          source: { path: 'kNNowledge/DeLoreanTimeTravel_V_0-1-0_spec_NN.md' },
          childIds: ['bravo1'],
          rawContent: `---
level: 3
parent_spec:
  name: "biz_template_V_0-1-0_NN"
title: DeLorean Time Travel Ventures
---

> [!NOTE]
> This is an **iNNfo document**.

# NN Bravo
## NN Bravo: First Bravo
`,
        }),
        bravo1: makeNode('bravo1', {
          name: 'First Bravo',
          parentId: 'DeLoreanTimeTravel_V_0-1-0_spec_NN.md',
          type: 'Bravo',
          kind: 'element',
          source: { path: 'kNNowledge/DeLoreanTimeTravel_V_0-1-0_spec_NN.md' },
        }),
        'spec:biz_template_V_0-1-0': makeNode('spec:biz_template_V_0-1-0', {
          name: 'biz_template_V_0-1-0',
          kind: 'root' as const,
          sourceMode: 'structural' as const,
          localMetamodel: {
            concepts: [
              { name: 'Alpha', type: 'category' },
              { name: 'Bravo', type: 'weight' },
            ],
            markers: [],
            taxonomy: [
              { parent: '', child: 'Alpha' },
              { parent: 'Alpha', child: 'Bravo' },
            ],
          },
        }),
      },
      ['DeLoreanTimeTravel_V_0-1-0_spec_NN.md', 'spec:biz_template_V_0-1-0'],
    )

    const wrapper = mount(LeftSidebar, {
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="expand-all"]').trigger('click')
    await wrapper.vm.$nextTick()

    // It should render the model in the sidebar
    expect(wrapper.text()).toContain('DeLoreanTimeTravel_V_0-1-0_spec_NN.md')
  })
})
