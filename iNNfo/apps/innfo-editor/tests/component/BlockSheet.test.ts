import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import BlockSheet from '../../src/components/editor/BlockSheet.vue'
import { useModelStore } from '../../src/stores/modelStore'
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

describe('BlockSheet.vue — Redesigned layout & assets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Header and Layout', () => {
    it('renders element title with concept name and element name without tabs', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      const element = makeNode('Root/Task1', {
        name: 'Task1',
        parentId: 'Root',
        type: 'Task',
      })
      modelStore.setGraph({ Root: root, 'Root/Task1': element }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: { id: 'Root/Task1', name: 'Task1', description: 'Sample description' },
          kind: 'instance',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: false,
        },
      })

      expect(wrapper.text()).toContain('Task')
      expect(wrapper.text()).toContain('Task1')
      expect(wrapper.text()).toContain('Sample description')
      // Ensure tab buttons are removed
      expect(wrapper.find('button[class*="border-b-2"]').exists()).toBe(false)
    })

    it('renders unified connections section when node has relationships', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      const element = makeNode('Root/Task1', {
        name: 'Task1',
        parentId: 'Root',
        type: 'Task',
        relationships: [{ label: 'depends_on', targetId: 'Root/Task2', origin: 'matrix' }],
      })
      modelStore.setGraph({ Root: root, 'Root/Task1': element }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: { id: 'Root/Task1', name: 'Task1', description: '' },
          kind: 'instance',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: false,
        },
      })

      expect(wrapper.text()).toContain('Connections & Relationships')
      expect(wrapper.text()).toContain('depends_on')
      expect(wrapper.text()).toContain('Task2')
    })

    it('renders the Connections section for a node that is only a reference target (no outgoing edges)', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      const platform = makeNode('Root/youtube.com', {
        name: 'youtube.com',
        parentId: 'Root',
        type: 'Platform',
      })
      const resource = makeNode('Root/Video', {
        name: 'Video',
        parentId: 'Root',
        type: 'Resource',
        fields: { platform: '[[youtube.com]]' },
      })
      modelStore.setGraph(
        { Root: root, 'Root/youtube.com': platform, 'Root/Video': resource },
        ['Root'],
      )

      const wrapper = mount(BlockSheet, {
        props: {
          block: { id: 'Root/youtube.com', name: 'youtube.com', description: '' },
          kind: 'instance',
          conceptType: 'Platform',
          conceptName: 'Platform',
          collapsed: false,
          isEditing: false,
        },
      })

      expect(wrapper.text()).toContain('Connections & Relationships')
      expect(wrapper.text()).toContain('platform')
      expect(wrapper.text()).toContain('Video')
    })
  })

  describe('Fields Schema (concept layout)', () => {
    it('renders field metadata (type badge, options, targets) in the Fields Schema section', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      modelStore.setGraph({ Root: root }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: { id: '', name: 'Topic', description: '' },
          kind: 'concept',
          conceptType: 'topic',
          conceptName: 'Topic',
          conceptFields: [
            { name: 'status', type: 'select', options: ['active', 'inactive'] },
            { name: 'owner', type: 'reference', target_concepts: ['Persona'] },
          ],
          collapsed: false,
          isEditing: false,
        },
      })

      expect(wrapper.text()).toContain('Fields Schema')
      expect(wrapper.find('[data-testid="field-schema-view"]').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid="field-type-badge"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('active')
      expect(wrapper.text()).toContain('inactive')
      expect(wrapper.text()).toContain('Persona')
    })

    it('shows "No fields defined" when the concept declares no fields', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      modelStore.setGraph({ Root: root }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: { id: '', name: 'Topic', description: '' },
          kind: 'concept',
          conceptType: 'topic',
          conceptName: 'Topic',
          conceptFields: [],
          collapsed: false,
          isEditing: false,
        },
      })

      expect(wrapper.text()).toContain('Fields Schema')
      expect(wrapper.text()).toContain('No fields defined')
    })
  })

  describe('assetItems (Media & Attachments)', () => {
    it('renders declared node.assets as attachment items in NodeMedia', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      const element = makeNode('Root/Task1', {
        parentId: 'Root',
        type: 'Task',
        assets: ['docs/report.pdf'],
      })
      modelStore.setGraph({ Root: root, 'Root/Task1': element }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: { id: 'Root/Task1', name: 'Task1', description: '' },
          kind: 'instance',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: false,
        },
      })

      await flushPromises()

      const mediaSection = wrapper.find('[data-testid="node-media"]')
      expect(mediaSection.exists()).toBe(true)
      expect(mediaSection.text()).toContain('report.pdf')
    })

    it('shows the empty-state message when the node has no assets', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      const element = makeNode('Root/Task2', { parentId: 'Root', type: 'Task' })
      modelStore.setGraph({ Root: root, 'Root/Task2': element }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: { id: 'Root/Task2', name: 'Task2', description: '' },
          kind: 'instance',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: false,
        },
      })

      await flushPromises()

      expect(wrapper.text()).toContain('No media or attachments.')
    })
  })

  describe('Inherited Concepts (OpenCode Prompt Helper)', () => {
    it('renders the warning banner and the OpenCode prompt copy box when editing an inherited concept', async () => {
      const modelStore = useModelStore()

      // Setup mock root node with a parent_spec
      const root = makeNode('Root', {
        rawContent: '---\nspec_version: V_0-1-5\nparent_spec:\n  name: "business_V_0-1-1"\n  url: "https://example.com/spec"\n---\n',
      })

      // Setup mock spec node
      const specTemplate = makeNode('spec:business_V_0-1-1', {
        rawContent: '# Business Template\nThis is the template content.',
        source: { path: 'specs/business_V_0-1-1_NN.md' },
      })

      // Setup concept node under Root
      const conceptNode = makeNode('Root/MyConcept', {
        name: 'MyConcept',
        parentId: 'Root',
        type: 'MyConcept',
      })

      modelStore.setGraph({
        Root: root,
        'spec:business_V_0-1-1': specTemplate,
        'Root/MyConcept': conceptNode,
      }, ['Root', 'spec:business_V_0-1-1'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: { id: 'Root/MyConcept', name: 'MyConcept', description: '' },
          kind: 'concept',
          conceptType: 'MyConcept',
          conceptName: 'MyConcept',
          collapsed: false,
          isEditing: true,
        },
      })

      // Verificar que se muestre la advertencia
      expect(wrapper.text()).toContain('These fields are inherited from the template')

      // Verificar que se renderice la caja del prompt para OpenCode
      expect(wrapper.text()).toContain('OpenCode Prompt (AI Editor)')
      expect(wrapper.text()).toContain('business_V_0-1-1_NN.md')

      // Buscar el textarea y verificar que tenga el prompt generado
      const textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(true)
      expect(textarea.element.value).toContain('I need to edit the concept "MyConcept"')
      expect(textarea.element.value).toContain('business_V_0-1-1_NN.md')
      expect(textarea.element.value).toContain('specs/business_V_0-1-1_NN.md')
      expect(textarea.element.value).toContain('Root')
    })
  })

  describe('Tags viewing and authoring', () => {
    it('renders element tags as chips in read mode', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      const element = makeNode('Root/Task1', {
        name: 'Task1',
        parentId: 'Root',
        type: 'Task',
        tags: ['frontend', 'urgent'],
      })
      modelStore.setGraph({ Root: root, 'Root/Task1': element }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: {
            id: 'Root/Task1',
            name: 'Task1',
            description: 'Task description',
            tags: ['frontend', 'urgent'],
          },
          kind: 'instance',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: false,
        },
      })

      const tagsSection = wrapper.find('[data-testid="block-sheet-tags-read"]')
      expect(tagsSection.exists()).toBe(true)
      expect(tagsSection.text()).toContain('#frontend')
      expect(tagsSection.text()).toContain('#urgent')
    })

    it('does not render element tags section when tags are empty or undefined', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      const element = makeNode('Root/Task1', {
        name: 'Task1',
        parentId: 'Root',
        type: 'Task',
        tags: [],
      })
      modelStore.setGraph({ Root: root, 'Root/Task1': element }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: {
            id: 'Root/Task1',
            name: 'Task1',
            description: 'Task description',
            tags: [],
          },
          kind: 'instance',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: false,
        },
      })

      expect(wrapper.find('[data-testid="block-sheet-tags-read"]').exists()).toBe(false)
    })

    it('renders TagInput in edit mode and synchronizes tag additions to modelStore', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', { rawContent: '---\nspec_version: V_0-1-5\n---\n' })
      const element = makeNode('Root/Task1', {
        name: 'Task1',
        parentId: 'Root',
        type: 'Task',
        tags: ['existing'],
      })
      modelStore.setGraph({ Root: root, 'Root/Task1': element }, ['Root'])

      const wrapper = mount(BlockSheet, {
        props: {
          block: {
            id: 'Root/Task1',
            name: 'Task1',
            description: 'Task description',
            tags: ['existing'],
          },
          kind: 'instance',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: true,
        },
      })

      const editor = wrapper.find('[data-testid="block-sheet-tags-editor"]')
      expect(editor.exists()).toBe(true)
      expect(editor.text()).toContain('Tags')
      expect(editor.text()).toContain('existing')

      // Type a new tag and press Enter
      const tagInput = editor.find('input')
      await tagInput.setValue('new-tag')
      await tagInput.trigger('keydown.enter')

      const updatedNode = modelStore.getNode('Root/Task1')
      expect(updatedNode?.tags).toEqual(['existing', 'new-tag'])
      expect(modelStore.isDirty('Root/Task1')).toBe(true)
    })

    it('renders and allows editing concept tags', async () => {
      const modelStore = useModelStore()
      const root = makeNode('Root', {
        rawContent: '---\nspec_version: V_0-1-5\n---\n',
        conceptTags: { Task: ['strategy'] },
      })
      const concept = makeNode('Root/Task', {
        name: 'Task',
        parentId: 'Root',
        type: 'Task',
      })
      modelStore.setGraph({ Root: root, 'Root/Task': concept }, ['Root'])

      // Read mode test
      const readWrapper = mount(BlockSheet, {
        props: {
          block: { id: 'Root/Task', name: 'Task', description: '' },
          kind: 'concept',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: false,
        },
      })

      const conceptTagsRead = readWrapper.find('[data-testid="concept-tags-read"]')
      expect(conceptTagsRead.exists()).toBe(true)
      expect(conceptTagsRead.text()).toContain('#strategy')

      // Edit mode test
      const editWrapper = mount(BlockSheet, {
        props: {
          block: { id: 'Root/Task', name: 'Task', description: '' },
          kind: 'concept',
          conceptType: 'Task',
          conceptName: 'Task',
          collapsed: false,
          isEditing: true,
        },
      })

      const conceptTagsEditor = editWrapper.find('[data-testid="concept-tags-editor"]')
      expect(conceptTagsEditor.exists()).toBe(true)
      expect(conceptTagsEditor.text()).toContain('strategy')

      const input = conceptTagsEditor.find('input')
      await input.setValue('priority')
      await input.trigger('keydown.enter')

      const updatedRoot = modelStore.getNode('Root')
      expect(updatedRoot?.conceptTags?.Task).toEqual(['strategy', 'priority'])
      expect(modelStore.isDirty('Root')).toBe(true)
    })
  })
})
