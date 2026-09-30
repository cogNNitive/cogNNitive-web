import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import Header from '../../src/components/layout/Header.vue'
import { useModelStore } from '../../src/stores/modelStore'
import { useUiStore } from '../../src/stores/uiStore'
import type { KnowledgeNode } from '../../src/model/types'
import pkg from '../../package.json'

function makeNode(id: string, fields: Record<string, any>): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    type: 'document',
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        {
          value,
          editAttribution: {
            author: { kind: 'system', id: 'parser' },
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        },
      ]),
    ),
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: 'path/to/model.md' },
  }
}

describe('Header.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders iNNfo Modeler title and version badge', () => {
    const wrapper = mount(Header)
    const text = wrapper.text()

    expect(text).toContain('iNNfo Modeler')
    const versionBadge = wrapper.find('[data-testid="header-version-badge"]')
    expect(versionBadge.exists()).toBe(true)
    expect(versionBadge.text()).toContain(`v${pkg.version}`)
  })

  it('does not render Spec, Template, Model pills in header directly', () => {
    const modelStore = useModelStore()
    modelStore.rootIds = ['Root']
    modelStore.nodes = {
      Root: makeNode('Root', {
        spec_version: 'V_0-1-9',
        blueprint_name: 'CustomTemplate',
        blueprint_version: 'V_2-0-0',
        knowledge_version: 'V_1-2-3',
      }),
    }

    const wrapper = mount(Header)
    const text = wrapper.text()

    // Spec, Template, Model pills are moved to ModelInfoPanel
    expect(text).not.toContain('iNNfo_V_0-1-9_NN.md')
    expect(text).not.toContain('CustomTemplate_V_2-0-0')
    const infoButton = wrapper.find('[data-testid="header-info-button"]')
    expect(infoButton.exists()).toBe(true)
  })

  it('triggers 5-second blinking animation on validation icon when warnings or errors exist', () => {
    const modelStore = useModelStore()
    modelStore.rootIds = ['Root']
    modelStore.nodes = {
      Root: makeNode('Root', {}),
    }
    modelStore.validationReport = {
      checks: [],
      summary: { total: 1, passed: 0, errors: 1, warnings: 0 },
    }

    const wrapper = mount(Header)
    const valButton = wrapper.find('button[title*="Model is incorrect"]')
    expect(valButton.exists()).toBe(true)
    expect(valButton.classes()).toContain('animate-header-blink')
  })

  describe('Search & Filter wrapper status badges', () => {
    function setupModelWithNodes() {
      const modelStore = useModelStore()
      const uiStore = useUiStore()

      modelStore.rootIds = ['Root']
      modelStore.nodes = {
        Root: makeNode('Root', {
          spec_version: 'V_0-1-0',
          title: 'Test Model',
        }),
        'concept-1': {
          ...makeNode('concept-1', {}),
          kind: 'concept',
          name: 'Task',
          type: 'concept',
        },
        'concept-2': {
          ...makeNode('concept-2', {}),
          kind: 'concept',
          name: 'Note',
          type: 'concept',
        },
        'tag-node-1': {
          ...makeNode('tag-node-1', {
            color: '#ef4444',
            icon: 'alert-circle',
            description: 'Urgent tag',
          }),
          kind: 'element',
          name: 'urgent',
          type: 'Tag',
        },
        'node-elem': {
          ...makeNode('node-elem', {}),
          kind: 'element',
          name: 'Element 1',
          tags: ['urgent', 'secondary-tag'],
        },
      }
      return { modelStore, uiStore }
    }

    it('renders Concepts All and Tags All when all are selected', () => {
      const { uiStore, modelStore } = setupModelWithNodes()
      uiStore.selectedConceptFilters = ['all']
      uiStore.selectedTagFilters = [...modelStore.allTags]

      const wrapper = mount(Header)
      const conceptBadge = wrapper.find('[data-testid="header-concept-status-badge"]')
      const tagBadge = wrapper.find('[data-testid="header-tag-status-badge"]')

      expect(conceptBadge.exists()).toBe(true)
      expect(conceptBadge.text()).toBe('Concepts All')
      expect(tagBadge.exists()).toBe(true)
      expect(tagBadge.text()).toBe('Tags All')
      // When all tags are selected, primary tag badges should NOT be rendered
      expect(wrapper.findAll('[data-testid="header-primary-tag-badge"]')).toHaveLength(0)
    })

    it('renders partial count for concepts when not all are selected', () => {
      const { uiStore } = setupModelWithNodes()
      uiStore.selectedConceptFilters = ['Task']

      const wrapper = mount(Header)
      const conceptBadge = wrapper.find('[data-testid="header-concept-status-badge"]')
      expect(conceptBadge.text()).toBe('1 Concepts')
    })

    it('renders primary tag badge and Tags some when a primary tag is selected partially', () => {
      const { uiStore } = setupModelWithNodes()
      // Select only the workspace primary tag 'urgent'
      uiStore.selectedTagFilters = ['urgent']

      const wrapper = mount(Header)
      const tagBadge = wrapper.find('[data-testid="header-tag-status-badge"]')
      expect(tagBadge.text()).toBe('Tags some')

      const primaryBadges = wrapper.findAll('[data-testid="header-primary-tag-badge"]')
      expect(primaryBadges).toHaveLength(1)
      expect(primaryBadges[0].text()).toContain('urgent')
    })

    it('renders count of tags when partial tags are selected without primary tags', () => {
      const { uiStore } = setupModelWithNodes()
      // Select only 'secondary-tag' which is not in workspaceTagsMap
      uiStore.selectedTagFilters = ['secondary-tag']

      const wrapper = mount(Header)
      const tagBadge = wrapper.find('[data-testid="header-tag-status-badge"]')
      expect(tagBadge.text()).toBe('1 Tags')

      const primaryBadges = wrapper.findAll('[data-testid="header-primary-tag-badge"]')
      expect(primaryBadges).toHaveLength(0)
    })

    it('toggles search popup when clicking anywhere in the wrapper', async () => {
      setupModelWithNodes()
      const wrapper = mount(Header)
      const searchWrapper = wrapper.find('[data-testid="header-search-button"]')

      expect(wrapper.find('[data-testid="header-search-popup"]').exists()).toBe(false)
      await searchWrapper.trigger('click')
      expect(wrapper.find('[data-testid="header-search-popup"]').exists()).toBe(true)
      await searchWrapper.trigger('click')
      expect(wrapper.find('[data-testid="header-search-popup"]').exists()).toBe(false)
    })
  })

  describe('Use AI button', () => {
    it('toggles activeView between ai-guide and editor', async () => {
      const uiStore = useUiStore()
      uiStore.setActiveView('editor')

      const wrapper = mount(Header)
      const aiBtn = wrapper.find('[data-testid="header-use-ai-button"]')
      expect(aiBtn.exists()).toBe(true)

      // First click: editor -> ai-guide
      await aiBtn.trigger('click')
      expect(uiStore.activeView).toBe('ai-guide')

      // Second click: ai-guide -> editor
      await aiBtn.trigger('click')
      expect(uiStore.activeView).toBe('editor')
    })
  })

  describe('Primary Workspace View Switcher', () => {
    function setupRootModel() {
      const modelStore = useModelStore()
      const uiStore = useUiStore()
      modelStore.rootIds = ['Root']
      modelStore.nodes = {
        Root: makeNode('Root', {
          title: 'Workspace Model',
        }),
      }
      return { modelStore, uiStore }
    }

    it('does not render view switcher when no root node is present', () => {
      const wrapper = mount(Header)
      expect(wrapper.find('[data-testid="header-view-switcher"]').exists()).toBe(false)
    })

    it('renders view switcher with editor, graph, and consoles buttons when root node exists', () => {
      setupRootModel()
      const wrapper = mount(Header)

      expect(wrapper.find('[data-testid="header-view-switcher"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="header-view-editor"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="header-view-graph"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="header-view-consoles"]').exists()).toBe(true)
    })

    it('clicking view buttons switches uiStore.activeView to graph, consoles, and editor', async () => {
      const { uiStore } = setupRootModel()
      const wrapper = mount(Header)

      expect(uiStore.activeView).toBe('editor')

      await wrapper.find('[data-testid="header-view-graph"]').trigger('click')
      expect(uiStore.activeView).toBe('graph')

      await wrapper.find('[data-testid="header-view-consoles"]').trigger('click')
      expect(uiStore.activeView).toBe('consoles')

      await wrapper.find('[data-testid="header-view-editor"]').trigger('click')
      expect(uiStore.activeView).toBe('editor')
    })

    it('active view button receives active styling while others receive inactive styling', async () => {
      const { uiStore } = setupRootModel()
      const wrapper = mount(Header)

      const editorBtn = wrapper.find('[data-testid="header-view-editor"]')
      const graphBtn = wrapper.find('[data-testid="header-view-graph"]')
      const consolesBtn = wrapper.find('[data-testid="header-view-consoles"]')

      // Editor is active by default
      expect(editorBtn.classes()).toContain('text-primary')
      expect(graphBtn.classes()).toContain('text-slate-500')
      expect(consolesBtn.classes()).toContain('text-slate-500')

      // Switch to graph
      await graphBtn.trigger('click')
      expect(graphBtn.classes()).toContain('text-primary')
      expect(editorBtn.classes()).toContain('text-slate-500')
      expect(consolesBtn.classes()).toContain('text-slate-500')

      // Switch to consoles
      await consolesBtn.trigger('click')
      expect(consolesBtn.classes()).toContain('text-primary')
      expect(editorBtn.classes()).toContain('text-slate-500')
      expect(graphBtn.classes()).toContain('text-slate-500')
    })
  })
})
