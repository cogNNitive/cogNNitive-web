import { describe, it, expect } from 'vitest'
import {
  recursiveParse,
  validateTaxonomyHierarchy,
  validateDocument,
  extractBlueprintSchema,
  parseKnowledge,
  buildWorkspaceIndex,
} from '../src/index'
import type { BlueprintSchema, KnowledgeNode, RecursiveParseResult } from '../src/index'
import { normalizeElementsIntoGraph } from '../src/recursiveParser/normalize'
import type { DirectoryHandleLike, FileHandleLike } from '../src/fs-types'
import type { ParseContext } from '../src/recursiveParser/types'
import { IdentityRegistry } from '../src/identity'

function createFakeDirectoryHandle(files: Record<string, string>): DirectoryHandleLike {
  const fileHandles = new Map<string, FileHandleLike>()
  for (const [path, content] of Object.entries(files)) {
    const handle: FileHandleLike = {
      kind: 'file',
      name: path.split('/').pop()!,
      getFile: async () => ({ text: async () => content }) as File,
    }
    fileHandles.set(path, handle)
  }

  const handle: DirectoryHandleLike = {
    kind: 'directory',
    name: 'root',
    async getFileHandle(name: string) {
      if (fileHandles.has(name)) return fileHandles.get(name)!
      throw Object.assign(new Error(`file not found: ${name}`), { name: 'NotFoundError' })
    },
    async getDirectoryHandle(name: string) {
      const prefix = name + '/'
      const subFiles: Record<string, string> = {}
      let found = false
      for (const [k, v] of Object.entries(files)) {
        if (k.startsWith(prefix)) {
          found = true
          subFiles[k.slice(prefix.length)] = v
        }
      }
      if (found) return createFakeDirectoryHandle(subFiles)
      throw Object.assign(new Error(`directory not found: ${name}`), { name: 'NotFoundError' })
    },
    async *entries() {
      for (const [name] of Object.entries(files)) {
        if (!name.includes('/')) {
          yield [name, { kind: 'file', name }] as [string, FileHandleLike]
        }
      }
    },
  }
  return handle
}

describe('Workspace Taxonomy and Submodels (Phase 1 innfo-core)', () => {
  describe('4.1 Core Parser: Entrypoint resolution & Models path extraction', () => {
    it('loads primary workspace_01.md entrypoint and extracts Models path submodels', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
> [!NOTE]
> Workspace root document.

# NN Models

## NN Models: Subsystem A
path:: kNNowledge/subsystem_a_01.md
status:: active
`,
        'kNNowledge/subsystem_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: subsystem_spec_01
  url: https://example.com/subsystem_spec_01.md
knowledge_version: V_0-1-0
title: Subsystem A
---
# NN Components
## NN Components: Engine
description:: Core engine component.
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)

      expect(Object.keys(result.nodes).length).toBeGreaterThan(0)
      const rootNode = Object.values(result.nodes).find((n) => n.name === 'domaiNN')
      expect(rootNode).toBeDefined()
      const subNode = Object.values(result.nodes).find((n) => n.name === 'subsystem_a_01')
      expect(subNode).toBeDefined()
      expect(result.issues.filter((i) => i.message.includes('No index.md'))).toHaveLength(0)
    })

    it('falls back to index.md when workspace_NN.md is absent', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Legacy Index Workspace
---
# NN index
* [[kNNowledge/subsystem_b_01.md]]
`,
        'kNNowledge/subsystem_b_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Subsystem B
---
# NN Components
## NN Components: Widget
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)

      const subNode = Object.values(result.nodes).find((n) => n.name === 'subsystem_b_01')
      expect(subNode).toBeDefined()
    })

    it('falls back to root directory scan when neither workspace_NN.md nor index.md exists', async () => {
      const files: Record<string, string> = {
        'standalone_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Standalone Model
---
# NN Components
## NN Components: Solo
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)

      const soloNode = Object.values(result.nodes).find((n) => n.name === 'standalone_01')
      expect(soloNode).toBeDefined()
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].message).toContain('No domaiNN_NN.md found')
    })
  })

  describe('4.2 Core Validation: type:: knowledge concepts and fields', () => {
    it('parses type:: knowledge concept and field definitions cleanly in extractBlueprintSchema', () => {
      const templateContent = `---
spec_version: V_1-0-0
level: 2
parent_spec:
  name: iNNfo_V_0-1-0
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md
title: Workspace Template
---
# NN Concept Definition

## NN Concept Definition: Models
type:: knowledge
description:: Submodel reference primitive.

# NN Field Definition

## NN Field Definition: submodel_path
concept:: Models
type:: knowledge
description:: Path to submodel file.
`

      const schema = extractBlueprintSchema(parseKnowledge(templateContent))
      const modelRefConcept = schema.concepts.find((c) => c.name === 'Models')
      expect(modelRefConcept).toBeDefined()
      expect(modelRefConcept?.type).toBe('knowledge')

      const pathField = modelRefConcept?.fields?.find((f) => f.name === 'submodel_path')
      expect(pathField).toBeDefined()
      expect(pathField?.type).toBe('knowledge')
    })

    it('validates document containing type:: knowledge fields without unknown-type errors', () => {
      const templateDoc = {
        name: 'workspace_spec_01',
        level: 2 as const,
        frontmatter: {
          spec_version: 'V_1-0-0',
          level: 2,
          parent_spec: { name: 'iNNfo_V_0-1-0', url: 'https://example.com' },
          title: 'Workspace Spec',
        },
        rawContent: `---
spec_version: V_1-0-0
level: 2
parent_spec:
  name: iNNfo_V_0-1-0
  url: https://example.com
title: Workspace Spec
---
# NN Concept Definition
## NN Concept Definition: Models
type:: knowledge

# NN Field Definition
## NN Field Definition: path
concept:: Models
type:: knowledge
`,
      }

      const modelContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com
knowledge_version: V_0-1-0
title: Workspace Model
---
> [!NOTE]
> Workspace model.

# NN Models
## NN Models: Engine
path:: kNNowledge/engine_01.md
`

      const res = validateDocument(modelContent, {
        fileName: 'domaiNN_NN.md',
        template: templateDoc,
      })

      expect(
        res.errors.filter(
          (e) =>
            e.message.includes('Invalid concept type') || e.message.includes('Dangling reference'),
        ),
      ).toHaveLength(0)
    })
  })

  describe('4.3 Core Taxonomy: Index-free Level 3 models inheriting parent template taxonomy', () => {
    it('inherits taxonomy from parent template in normalizeElementsIntoGraph when # NN index is absent', () => {
      const modelContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com
knowledge_version: V_0-1-0
title: Index-Free Model
---
# NN Component
## NN Component: System Core

# NN Subcomponent
## NN Subcomponent: Subsystem Alpha
`

      const parsed = parseKnowledge(modelContent)
      expect(parsed.taxonomy).toHaveLength(0) // No # NN index section

      const parentTemplateTaxonomy = [{ parent: 'Component', child: 'Subcomponent' }]

      const ctx: ParseContext = { nodes: {}, identity: new IdentityRegistry(), issues: [] }
      normalizeElementsIntoGraph(parsed, 'root_1', 'model_01.md', ctx, parentTemplateTaxonomy)

      const alphaNode = Object.values(ctx.nodes).find((n) => n.name === 'Subsystem Alpha')
      expect(alphaNode).toBeDefined()
    })

    it('validates taxonomy hierarchy cleanly against parent template taxonomy when model has no index section', () => {
      const parsedModel = parseKnowledge(`---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com
knowledge_version: V_0-1-0
title: Model
---
# NN Component
## NN Component: C1

# NN Subcomponent
## NN Subcomponent: S1
parent_component:: C1
`)

      const templateConcepts = [
        { name: 'Component', type: 'weight' },
        { name: 'Subcomponent', type: 'weight' },
      ]

      const templateTaxonomy = [{ parent: 'Component', child: 'Subcomponent' }]

      const diags = validateTaxonomyHierarchy(parsedModel, templateConcepts, templateTaxonomy)
      expect(diags).toHaveLength(0)
    })
  })

  describe('4.4 Diamond vs cycle: sidebar graph shape stability', () => {
    it('sidebar-graph-shape-stable: a diamond workspace still yields exactly one root and every node reachable from it', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models

## NN Models: Model A
path:: model_a_01.md

## NN Models: Model B
path:: model_b_01.md
`,
        'model_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model A
---
# NN Components
## NN Components: Widget
`,
        'model_b_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model B
---
# NN Models
## NN Models: Model A ref
path:: model_a_01.md
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)

      expect(result.rootIds).toHaveLength(1)
      expect(result.issues.filter((i) => i.code === 'CYCLE_DETECTED')).toHaveLength(0)

      const reachable = new Set<string>()
      const stack = [...result.rootIds]
      while (stack.length > 0) {
        const id = stack.pop()!
        if (reachable.has(id)) continue
        reachable.add(id)
        for (const childId of result.nodes[id]?.childIds ?? []) stack.push(childId)
      }

      const modelANode = Object.values(result.nodes).find((n) => n.name === 'model_a_01')
      const modelBNode = Object.values(result.nodes).find((n) => n.name === 'model_b_01')
      expect(modelANode).toBeDefined()
      expect(modelBNode).toBeDefined()
      expect(reachable.has(modelANode!.id)).toBe(true)
      expect(reachable.has(modelBNode!.id)).toBe(true)
    })
  })

  describe('buildWorkspaceIndex', () => {
    it('index-basic-maps: a 3-model workspace populates pathToNodeId, titleToNodeIds, fileNameToNodeIds, nodeTemplate', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models

## NN Models: Model A
path:: model_a_01.md

## NN Models: Model B
path:: model_b_01.md
`,
        'model_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model A
---
# NN Components
## NN Components: Widget
`,
        'model_b_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model B
---
# NN Components
## NN Components: Gadget
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)
      const index = buildWorkspaceIndex(result)

      const rootNode = Object.values(result.nodes).find((n) => n.name === 'domaiNN')!
      const aNode = Object.values(result.nodes).find((n) => n.name === 'model_a_01')!
      const bNode = Object.values(result.nodes).find((n) => n.name === 'model_b_01')!

      expect(index.pathToNodeId['domainn_nn.md']).toBe(rootNode.id)
      expect(index.pathToNodeId['model_a_01.md']).toBe(aNode.id)
      expect(index.pathToNodeId['model_b_01.md']).toBe(bNode.id)

      expect(index.titleToNodeIds['root workspace']).toEqual([rootNode.id])
      expect(index.titleToNodeIds['model a']).toEqual([aNode.id])
      expect(index.titleToNodeIds['model b']).toEqual([bNode.id])

      expect(index.fileNameToNodeIds['domainn']).toEqual([rootNode.id])
      expect(index.fileNameToNodeIds['model_a_01']).toEqual([aNode.id])
      expect(index.fileNameToNodeIds['model_b_01']).toEqual([bNode.id])

      expect(index.nodeTemplate[rootNode.id]).toEqual({
        name: 'workspace_spec_01',
        url: 'https://example.com/workspace_spec_01.md',
      })
      expect(index.nodeTemplate[aNode.id]).toEqual({
        name: 'spec_01',
        url: 'https://example.com/spec.md',
      })
    })

    it('index-duplicate-title-error: two models sharing a title are both indexed and flagged as an error issue', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models

## NN Models: Org One
path:: org_one_01.md

## NN Models: Org Two
path:: org_two_01.md
`,
        'org_one_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Acme Org
---
# NN Components
## NN Components: Widget
`,
        'org_two_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Acme Org
---
# NN Components
## NN Components: Gadget
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)
      const index = buildWorkspaceIndex(result)

      const orgOneNode = Object.values(result.nodes).find((n) => n.name === 'org_one_01')!
      const orgTwoNode = Object.values(result.nodes).find((n) => n.name === 'org_two_01')!

      expect(index.titleToNodeIds['acme org']).toHaveLength(2)
      expect(index.titleToNodeIds['acme org']).toEqual(
        expect.arrayContaining([orgOneNode.id, orgTwoNode.id]),
      )

      const duplicateIssues = index.issues.filter((i) =>
        i.message.includes('Duplicate model title'),
      )
      expect(duplicateIssues).toHaveLength(1)
      expect(duplicateIssues[0].severity).toBe('error')
      expect(duplicateIssues[0].message).toContain('org_one_01.md')
      expect(duplicateIssues[0].message).toContain('org_two_01.md')
    })

    it('index-filename-repeat-is-not-an-error: same basename in different directories is ambiguity, not an error', () => {
      // Two distinct root nodes deliberately share the same source basename
      // (`biz_01.md`) under different directories, constructed directly
      // against a synthetic RecursiveParseResult. Reaching this shape via
      // recursiveParse() itself is blocked by an unrelated, pre-existing
      // constraint: IdentityRegistry.register(null, name) throws
      // DuplicateNameError for two root-level files that share a derived
      // model name regardless of directory (identity.ts:30-32) — a parser
      // limitation orthogonal to buildWorkspaceIndex's own derivation rules,
      // which this test exercises directly.
      const nodeA: KnowledgeNode = {
        id: 'biz-a',
        name: 'biz_01',
        parentId: null,
        childIds: [],
        type: 'document',
        kind: 'root',
        fields: {
          title: {
            value: 'Biz In A',
            editAttribution: { author: { kind: 'system', id: 'test' }, timestamp: '' },
          },
        },
        markers: {},
        relationships: [],
        rawSections: {},
        source: { path: 'a/biz_01.md' },
      }
      const nodeB: KnowledgeNode = {
        id: 'biz-b',
        name: 'biz_01',
        parentId: null,
        childIds: [],
        type: 'document',
        kind: 'root',
        fields: {
          title: {
            value: 'Biz In B',
            editAttribution: { author: { kind: 'system', id: 'test' }, timestamp: '' },
          },
        },
        markers: {},
        relationships: [],
        rawSections: {},
        source: { path: 'b/biz_01.md' },
      }
      const syntheticResult: RecursiveParseResult = {
        nodes: { [nodeA.id]: nodeA, [nodeB.id]: nodeB },
        rootIds: [nodeA.id, nodeB.id],
        issues: [],
      }

      const index = buildWorkspaceIndex(syntheticResult)

      expect(index.fileNameToNodeIds['biz_01']).toHaveLength(2)
      expect(index.fileNameToNodeIds['biz_01']).toEqual(
        expect.arrayContaining([nodeA.id, nodeB.id]),
      )
      expect(index.issues).toHaveLength(0)
    })

    it('index-extra-parents-from-diamond: the second-encountered parent of a diamond child is surfaced in extraParents', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models

## NN Models: Model A
path:: model_a_01.md

## NN Models: Model B
path:: model_b_01.md
`,
        'model_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model A
---
# NN Components
## NN Components: Widget
`,
        'model_b_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model B
---
# NN Models
## NN Models: Model A ref
path:: model_a_01.md
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)
      const index = buildWorkspaceIndex(result)

      const rootNode = Object.values(result.nodes).find((n) => n.name === 'domaiNN')!
      const modelANode = Object.values(result.nodes).find((n) => n.name === 'model_a_01')!
      const modelBNode = Object.values(result.nodes).find((n) => n.name === 'model_b_01')!

      expect(modelANode.parentId).toBe(rootNode.id)
      expect(index.extraParents[modelANode.id]).toEqual([modelBNode.id])
    })

    it('index-missing-from-parse-issues: a referenced but unresolved path is surfaced in missing, de-duplicated', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models

## NN Models: Ghost
path:: ghost_business_01.md
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)
      const index = buildWorkspaceIndex(result)

      expect(result.issues.some((i) => i.code === 'MODEL_NOT_FOUND')).toBe(true)
      expect(index.missing).toEqual(['ghost_business_01.md'])
    })

    it('index-node-schema-from-stash: a resolver supplied to recursiveParse stashes the schema, and buildWorkspaceIndex surfaces it without its own fallback resolver', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models

## NN Models: Model A
path:: model_a_01.md
`,
        'model_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model A
---
# NN Components
## NN Components: Widget
`,
      }

      const composedSchema: BlueprintSchema = {
        concepts: [],
        markers: [],
        matrices: [],
        taxonomy: [],
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle, undefined, {
        resolveBlueprintSchema: () => composedSchema,
      })
      const index = buildWorkspaceIndex(result)

      const modelANode = Object.values(result.nodes).find((n) => n.name === 'model_a_01')!
      expect(index.nodeSchema[modelANode.id]).toBe(composedSchema)
    })

    it('index-node-schema-from-fallback-resolver: without a stashed schema, buildWorkspaceIndex falls back to its own resolveBlueprintSchema argument', () => {
      const fallbackSchema: BlueprintSchema = {
        concepts: [],
        markers: [],
        matrices: [],
        taxonomy: [],
      }

      const rootNode: KnowledgeNode = {
        id: 'root-1',
        name: 'workspace_01',
        parentId: null,
        childIds: [],
        type: 'document',
        kind: 'root',
        fields: {},
        markers: {},
        relationships: [],
        rawSections: {},
        rawContent: '---\ntitle: Root Workspace\n---\n',
        source: { path: 'domaiNN_NN.md' },
      }
      const syntheticResult: RecursiveParseResult = {
        nodes: { [rootNode.id]: rootNode },
        rootIds: [rootNode.id],
        issues: [],
      }

      const index = buildWorkspaceIndex(syntheticResult, () => fallbackSchema)

      expect(index.nodeSchema[rootNode.id]).toBe(fallbackSchema)
    })

    it('index-element-concepts-normalized: an element name with a typographic dash resolves via both its exact and separator-normalized keys', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Rooms

## NN Rooms: Salón–Comedor
description:: Living-dining room.
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)
      const index = buildWorkspaceIndex(result)

      const rootNode = Object.values(result.nodes).find((n) => n.name === 'domaiNN')!
      const exactKey = 'salón–comedor'
      const normalizedKey = 'salón-comedor'

      expect(index.nodeElementConcepts[rootNode.id][exactKey]).toEqual(['Rooms'])
      expect(index.nodeElementConcepts[rootNode.id][normalizedKey]).toEqual(['Rooms'])
    })

    it('index-workspace-id: the entrypoint frontmatter workspace_id is surfaced on the index', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
workspace_id: acme-portfolio
---
# NN Models

## NN Models: Model A
path:: model_a_01.md
`,
        'model_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model A
---
# NN Components
## NN Components: Widget
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)
      const index = buildWorkspaceIndex(result)

      expect(index.workspaceId).toBe('acme-portfolio')
    })

    it('index-workspace-id absent: an entrypoint without workspace_id leaves the field undefined', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models

## NN Models: Model A
path:: model_a_01.md
`,
        'model_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model A
---
# NN Components
## NN Components: Widget
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)
      const index = buildWorkspaceIndex(result)

      expect(index.workspaceId).toBeUndefined()
    })

    it('never mutates the result it derives from', async () => {
      const files: Record<string, string> = {
        'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models

## NN Models: Model A
path:: model_a_01.md
`,
        'model_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec_01
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Model A
---
# NN Components
## NN Components: Widget
`,
      }

      const rootHandle = createFakeDirectoryHandle(files)
      const result = await recursiveParse(rootHandle)
      const snapshot = JSON.parse(JSON.stringify(result))

      buildWorkspaceIndex(result)

      expect(JSON.parse(JSON.stringify(result))).toEqual(snapshot)
    })
  })
})
