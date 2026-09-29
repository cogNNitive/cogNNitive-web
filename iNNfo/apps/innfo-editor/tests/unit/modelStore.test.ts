import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useModelStore } from '../../src/stores/modelStore'
import type { ModelNode } from '../../src/model/types'

function makeNode(id: string, overrides: Partial<ModelNode> = {}): ModelNode {
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

describe('modelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('holds exactly one normalized graph as the source of truth', () => {
    const modelStore = useModelStore()
    const root = makeNode('Root')
    modelStore.setGraph({ Root: root }, ['Root'])

    expect(modelStore.getRoots()).toEqual([root])
    expect(modelStore.getNode('Root')).toEqual(root)
  })

  it('exposes selectors for children lookup via parentId/childIds', () => {
    const modelStore = useModelStore()
    const child = makeNode('Root/Child', { parentId: 'Root' })
    const root = makeNode('Root', { childIds: ['Root/Child'] })
    modelStore.setGraph({ Root: root, 'Root/Child': child }, ['Root'])

    expect(modelStore.getChildren('Root')).toEqual([child])
  })

  it('tracks dirty nodes independently per node', () => {
    const modelStore = useModelStore()
    modelStore.setGraph({ Root: makeNode('Root') }, ['Root'])

    expect(modelStore.isDirty('Root')).toBe(false)
    modelStore.markDirty('Root')
    expect(modelStore.isDirty('Root')).toBe(true)
    modelStore.clearDirty('Root')
    expect(modelStore.isDirty('Root')).toBe(false)
  })

  it('resolves parent specifications locally first from specs/ directory handle', async () => {
    const { buildFakeTree } = await import('../helpers/fakeFs')

    const domainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---
# NN index
* [[kNNowledge/model_NN.md]]
`
    const modelMd = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'parent_spec:',
      '  name: "test-template_V_1-0-0"',
      '  url: "https://example.com/network-fallback-url-should-not-be-called"',
      'knowledge_version: "V_0-0-1"',
      'title: "My Model"',
      '---',
      '',
      '# NN index',
      '* [[Market]]',
      '',
      '# NN Market',
      '## NN Market: Test Market',
    ].join('\n')

    const specMd = [
      '---',
      'specification_version: "V_1-0-0"',
      'specification_url: "https://example.com/test-template"',
      'level: 2',
      'title: "Test Template"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Market',
      'type:: weight',
      'color:: blue',
      '',
      '# Test Template',
      '## Market',
      '### Summary',
      'Test summary.',
      '### Description',
      'Test description.',
      '### Methodologies',
      '*No methodologies*',
      '### Prompts',
      '*No prompts*',
    ].join('\n')

    const fakeTree = buildFakeTree('workspace', {
      'domaiNN_NN.md': domainMd,
      kNNowledge: {
        'model_NN.md': modelMd,
      },
      specs: {
        'test-template_V_1-0-0_NN.md': specMd,
      },
    })

    const modelStore = useModelStore()

    // We expect parseFromHandle to resolve parent_spec from the local specs/ directory handle
    await modelStore.parseFromHandle(fakeTree)

    // Verify that the synthetic spec node was created and populated with rawContent from local file
    const specNode = modelStore.getNode('spec:test-template_V_1-0-0')
    expect(specNode).toBeDefined()
    expect(specNode!.name).toBe('test-template_V_1-0-0')
    expect(specNode!.rawContent).toBe(specMd)

    // Verify concept attributes were mapped correctly
    expect(specNode!.localMetamodel?.concepts).toHaveLength(1)
    expect(specNode!.localMetamodel?.concepts[0].name).toBe('Market')
    expect(specNode!.localMetamodel?.concepts[0].color).toBe('blue')
  })

  it('does not emit elements in index when serialized (Level 3 spec)', async () => {
    const { buildFakeTree } = await import('../helpers/fakeFs')
    const { recursiveSerialize } = await import('../../src/model/recursiveSerializer')

    const domainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---
# NN index
* [[kNNowledge/model_NN.md]]
`
    const modelMd = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "My Model"',
      '---',
      '',
      '# NN Problems',
      '## NN Problems: Problem One',
    ].join('\n')

    const fakeTree = buildFakeTree('workspace', {
      'domaiNN_NN.md': domainMd,
      kNNowledge: {
        'model_NN.md': modelMd,
      },
    })

    const modelStore = useModelStore()
    await modelStore.parseFromHandle(fakeTree)

    // Locate the root node
    const rootId = 'model'
    const rootNode = modelStore.getNode(rootId)
    expect(rootNode).toBeDefined()

    // Run serialization on the root node using recursiveSerialize
    await recursiveSerialize(modelStore.nodes, new Set([rootId]))
    const serialized = rootNode!.rawContent ?? ''

    expect(serialized).toContain('## NN Problems: Problem One')
    expect(serialized).not.toContain('# NN index')
  })

  it('saves newly created element when serialized', async () => {
    const { buildFakeTree } = await import('../helpers/fakeFs')
    const { recursiveSerialize } = await import('../../src/model/recursiveSerializer')

    const domainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---
# NN index
* [[kNNowledge/model_NN.md]]
`
    const modelMd = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "My Model"',
      '---',
      '',
      '# NN Problems',
      '## NN Problems: Problem One',
    ].join('\n')

    const fakeTree = buildFakeTree('workspace', {
      'domaiNN_NN.md': domainMd,
      kNNowledge: {
        'model_NN.md': modelMd,
      },
    })

    const modelStore = useModelStore()
    await modelStore.parseFromHandle(fakeTree)

    const rootId = 'model'

    // Create a new child under the concept 'Problems'
    const newId = modelStore.createChild(rootId, 'Problem Two', 'Problems', 'element')
    expect(newId).toBe(`${rootId}/Problem Two`)

    // Run serialization on the root node using recursiveSerialize
    await recursiveSerialize(modelStore.nodes, new Set([rootId]))
    const serialized = modelStore.getNode(rootId)!.rawContent ?? ''

    expect(serialized).toContain('## NN Problems: Problem One')
    expect(serialized).toContain('## NN Problems: Problem Two')
    expect(serialized).not.toContain('# NN index')
  })

  it('C1: follows a type:: model field via the warmed template cache during parseFromHandle', async () => {
    const { buildFakeTree } = await import('../helpers/fakeFs')

    const domainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---
# NN index
* [[kNNowledge/model_NN.md]]
* [[kNNowledge/sub_model_NN.md]]
`
    const modelMd = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'parent_spec:',
      '  name: "test-template"',
      '  url: "https://example.com/network-fallback-url-should-not-be-called"',
      'knowledge_version: "V_0-0-1"',
      'title: "My Model"',
      '---',
      '',
      '# NN index',
      '* [[Market]]',
      '',
      '# NN Market',
      '## NN Market: Test Market',
      'submodel_ref:: sub_model_NN.md',
    ].join('\n')

    const specMd = [
      '---',
      'specification_version: "V_1-0-0"',
      'specification_url: "https://example.com/test-template"',
      'level: 2',
      'title: "Test Template"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Market',
      'type:: weight',
      'color:: blue',
      '',
      '# NN Field Definition',
      '',
      '## NN Field Definition: submodel_ref',
      'concept:: Market',
      'type:: model',
      'target_template:: sub_template',
    ].join('\n')

    const subModelMd = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Sub Model"',
      '---',
      '',
      '# NN index',
      '* [[Notes]]',
      '',
      '# NN Notes',
      '## NN Notes: Entry',
    ].join('\n')

    const fakeTree = buildFakeTree('workspace', {
      'domaiNN_NN.md': domainMd,
      kNNowledge: {
        'model_NN.md': modelMd,
        'sub_model_NN.md': subModelMd,
      },
      specs: {
        'test-template_V_1-0-0_NN.md': specMd,
      },
    })

    const modelStore = useModelStore()
    await modelStore.parseFromHandle(fakeTree)

    const subNode = Object.values(modelStore.nodes).find((n) => n.name === 'sub_model')
    expect(subNode).toBeDefined()
  })

  describe('scaffoldSubmodel', () => {
    it('scaffolds Level 3 starter markdown content with valid YAML frontmatter', () => {
      const modelStore = useModelStore()
      const newId = modelStore.scaffoldSubmodel({
        path: 'kNNowledge/sub_business_NN.md',
        template: 'business',
        title: 'My Business Submodel',
        knowledgeVersion: '0.1.0',
      })

      const node = modelStore.getNode(newId)
      expect(node).toBeDefined()
      expect(node?.name).toBe('My Business Submodel')
      expect(node?.kind).toBe('root')
      expect(node?.rawContent).toContain('level: 3')
      expect(node?.rawContent).toContain('parent_spec:')
      expect(node?.rawContent).toContain('name: "business"')
      expect(node?.rawContent).toContain('knowledge_version: "0.1.0"')
      expect(node?.rawContent).toContain('title: "My Business Submodel"')
      expect(node?.rawContent).toContain('# NN index')
      expect(node?.rawContent).toContain('* [[Business]]')
      expect(node?.rawContent).toContain('# NN Business')
      expect(node?.rawContent).toContain('## NN Business: Example')
    })

    it('writes spec_version/spec_url and an explicit parent_spec.url when provided', () => {
      const modelStore = useModelStore()
      const newId = modelStore.scaffoldSubmodel({
        path: 'kNNowledge/sub_business_NN.md',
        template: 'business',
        templateUrl:
          'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/spec_NN.md',
      })

      const node = modelStore.getNode(newId)
      expect(node?.rawContent).toContain('spec_version: "V_0-3-0"')
      expect(node?.rawContent).toContain(
        'url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/spec_NN.md"',
      )
      expect(node?.rawContent).toMatch(/knowledge_version: "V_\d+-\d+-\d+"/)
    })

    it('normalizes backslashes to forward slashes in node id and source.path', () => {
      const modelStore = useModelStore()
      const newId = modelStore.scaffoldSubmodel({
        path: 'kNNowledge\\nested\\sub_business_NN.md',
        template: 'business',
      })

      expect(newId).toBe('kNNowledge/nested/sub_business_NN.md')
      const node = modelStore.getNode(newId)
      expect(node?.id).toBe('kNNowledge/nested/sub_business_NN.md')
      expect(node?.source.path).toBe('kNNowledge/nested/sub_business_NN.md')
    })

    it('registers node in modelStore.nodes and appends id to modelStore.rootIds', () => {
      const modelStore = useModelStore()
      const newId = modelStore.scaffoldSubmodel({
        path: 'kNNowledge/another_NN.md',
        template: 'procedures',
      })

      expect(modelStore.nodes[newId]).toBeDefined()
      expect(modelStore.rootIds).toContain(newId)
    })

    it('marks the newly created submodel node as dirty', () => {
      const modelStore = useModelStore()
      const newId = modelStore.scaffoldSubmodel({
        path: 'kNNowledge/dirty_test_NN.md',
        template: 'procedures',
      })

      expect(modelStore.isDirty(newId)).toBe(true)
      expect(modelStore.dirtyIds.has(newId)).toBe(true)
    })
  })
})
