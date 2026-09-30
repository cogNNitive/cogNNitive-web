import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SearchResultsView from '../../src/components/editor/SearchResultsView.vue'
import { useModelStore } from '../../src/stores/modelStore'
import { useUiStore } from '../../src/stores/uiStore'
import type { KnowledgeNode } from '../../src/model/types'

function makeNode(partial: Partial<KnowledgeNode> & { id: string }): KnowledgeNode {
  return {
    name: partial.id,
    parentId: null,
    childIds: [],
    type: 'text',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    ...partial,
  } as KnowledgeNode
}

/**
 * Concept-level tags (`tags::` on a `# NN concept:` section) are stored on the
 * document root as `conceptTags`, not on each element. Search has to read them
 * off the active root and union them with the element's own tags, otherwise
 * filtering by a concept-level tag silently returns nothing.
 */
describe('SearchResultsView — concept-level tag filtering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function seedGraph() {
    const modelStore = useModelStore()
    const uiStore = useUiStore()

    modelStore.setGraph(
      {
        'model_01.md': makeNode({
          id: 'model_01.md',
          kind: 'root',
          conceptTags: { Task: ['urgent'] },
          childIds: ['Task/Alpha', 'Note/Beta'],
          source: { path: 'model_01.md' },
          rawContent: '# NN index\n',
        }),
        'Task/Alpha': makeNode({
          id: 'Task/Alpha',
          name: 'Alpha',
          kind: 'element',
          type: 'Task',
          parentId: 'model_01.md',
        }),
        'Note/Beta': makeNode({
          id: 'Note/Beta',
          name: 'Beta',
          kind: 'element',
          type: 'Note',
          parentId: 'model_01.md',
        }),
      },
      ['model_01.md'],
    )

    uiStore.setActiveModel('model_01.md')
    return { modelStore, uiStore }
  }

  function mountView() {
    return mount(SearchResultsView, {
      global: {
        stubs: { BlockSheet: { name: 'BlockSheet', template: '<div class="block-sheet" />' } },
      },
    })
  }

  it('matches an element that carries the tag only through its concept', () => {
    const { uiStore } = seedGraph()
    uiStore.selectedTagFilters = ['urgent']

    const wrapper = mountView()
    const results = wrapper.findAllComponents({ name: 'BlockSheet' })

    // Alpha has no tags of its own — it matches purely via conceptTags.Task.
    expect(results).toHaveLength(1)
    expect(wrapper.text()).toContain('1 resultado')
  })

  it('does not match elements whose concept lacks the tag', () => {
    const { uiStore } = seedGraph()
    uiStore.selectedTagFilters = ['nonexistent']

    const wrapper = mountView()

    expect(wrapper.findAllComponents({ name: 'BlockSheet' })).toHaveLength(0)
  })

  it('unions concept-level tags with the element own tags', () => {
    const { modelStore, uiStore } = seedGraph()
    modelStore.nodes['Task/Alpha'].tags = ['mine']
    uiStore.selectedTagFilters = ['urgent', 'mine']

    const wrapper = mountView()

    // Both filters must hold: 'mine' from the element, 'urgent' from the concept.
    expect(wrapper.findAllComponents({ name: 'BlockSheet' })).toHaveLength(1)
  })
})
