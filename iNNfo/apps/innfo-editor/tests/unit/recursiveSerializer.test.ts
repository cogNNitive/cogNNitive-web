import { describe, it, expect } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { recursiveParse } from '../../src/model/recursiveParser'
import { recursiveSerialize } from '../../src/model/recursiveSerializer'
import { useModelStore } from '../../src/stores/modelStore'
import { buildFakeTree, type FakeTree } from '../helpers/fakeFs'
import type { ModelNode } from '../../src/model/types'
import type { ParsedModel, ModelDriver } from '@cognnitive/innfo-core'

const fileDocMd = `---
spec_version: "V_0-3-0"
spec_url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
level: 3
parent_spec:
  name: "business"
  url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-0-1"
title: "Serializer File Doc"
---

# NN index

* [[Problems]]

# NN Problems

## NN Problems: Problem One
A problem used to exercise the serializer.
`

const domainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---

# NN index

* [[kNNowledge/Doc_NN.md]]
`

describe('recursiveSerializer', () => {
  it('returns write reports for dirty nodes', async () => {
    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': fileDocMd },
    }
    const root = buildFakeTree('workspace', tree)
    const parsed = await recursiveParse(root)

    const docId = Object.values(parsed.nodes).find((n) => n.name === 'Doc')!.id
    const dirty = new Set([docId])

    const report = await recursiveSerialize(parsed.nodes, dirty)
    expect(report).toHaveLength(1)
    expect(report[0].nodeId).toBe(docId)
    expect(report[0].path).toBe('kNNowledge/Doc_NN.md')
    expect(['exact', 'canonical']).toContain(report[0].fidelity)
  })

  it('returns empty report when no dirty nodes', async () => {
    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': fileDocMd },
    }
    const root = buildFakeTree('workspace', tree)
    const parsed = await recursiveParse(root)

    const report = await recursiveSerialize(parsed.nodes, new Set())
    expect(report).toHaveLength(0)
  })

  it('writes through driver when provided', async () => {
    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': fileDocMd },
    }
    const root = buildFakeTree('workspace', tree)
    const parsed = await recursiveParse(root)

    let writtenContent: string | null = null
    const mockDriver: ModelDriver = {
      readModel: async (_uri: string) => {
        throw new Error('not expected')
      },
      writeModel: async (_uri: string, model: ParsedModel) => {
        writtenContent = model.rawContent
      },
      listChildren: async () => [],
      listAssets: async () => [],
    }

    const docId = Object.values(parsed.nodes).find((n) => n.name === 'Doc')!.id
    const report = await recursiveSerialize(parsed.nodes, new Set([docId]), mockDriver)

    expect(report).toHaveLength(1)
    expect(writtenContent).not.toBeNull()
    expect(writtenContent!).toContain('Serializer File Doc')
    expect(writtenContent!).toContain('Problem One')
  })

  it('throws for dirty node without rawContent', async () => {
    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': fileDocMd },
    }
    const root = buildFakeTree('workspace', tree)
    const parsed = await recursiveParse(root)

    // Create a node without rawContent
    const nodeWithoutContent = Object.values(parsed.nodes).find((n) => n.name === 'Problem One')!
    expect(nodeWithoutContent.rawContent).toBeUndefined()

    // Marking a non-root node dirty should produce no report entries (filtered by rawContent check)
    const report = await recursiveSerialize(parsed.nodes, new Set([nodeWithoutContent.id]))
    expect(report).toHaveLength(0)
  })

  it('preserves node identity after parse -> serialize report -> re-parse round-trip', async () => {
    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': fileDocMd },
    }
    const root = buildFakeTree('workspace', tree)
    const firstParse = await recursiveParse(root)
    const idsBefore = Object.keys(firstParse.nodes).sort()

    // Since we have no root handle in the serializer, round-trip through driver
    let roundtripContent: string | null = null
    const capturingDriver: ModelDriver = {
      readModel: async (_uri: string) => {
        throw new Error('not expected')
      },
      writeModel: async (_uri: string, model: ParsedModel) => {
        roundtripContent = model.rawContent
      },
      listChildren: async () => [],
      listAssets: async () => [],
    }

    const docId = Object.values(firstParse.nodes).find((n) => n.name === 'Doc')!.id
    await recursiveSerialize(firstParse.nodes, new Set([docId]), capturingDriver)
    expect(roundtripContent).not.toBeNull()

    // Re-parse from the written content
    const tree2: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': roundtripContent! },
    }
    const root2 = buildFakeTree('workspace', tree2)
    const secondParse = await recursiveParse(root2)
    const idsAfter = Object.keys(secondParse.nodes).sort()

    expect(idsAfter).toEqual(idsBefore)
  })

  it('persists matrix cell edits from node.fields to serialized markdown and re-parses them', async () => {
    const docWithMatrix = `---
spec_version: "V_0-3-0"
level: 3
title: "Matrix Test"
matrices:
  - name: "Problems-Values Matrix"
    source: "Problems"
    target: "Values"
---

# NN index

* [[Problems]]
* [[Values]]

# NN Problems

## NN Problems: Problem 1

# NN Values

## NN Values: Value A
`
    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': docWithMatrix },
    }
    const root = buildFakeTree('workspace', tree)
    const parsed = await recursiveParse(root)

    const docNode = Object.values(parsed.nodes).find((n) => n.name === 'Doc')!
    const problem1 = Object.values(parsed.nodes).find((n) => n.name === 'Problem 1')!
    const valueA = Object.values(parsed.nodes).find((n) => n.name === 'Value A')!

    // Simulate user editing a cell in MatricesGrid. The in-memory cell key is
    // id-based (\`matrixName||<rowId>||<colId>\`, E1); the serializer resolves
    // ids back to display names for the on-disk matrix table.
    docNode.fields[`Problems-Values Matrix||${problem1.id}||${valueA.id}`] = { value: 'X' }

    let writtenContent: string | null = null
    const capturingDriver: ModelDriver = {
      readModel: async () => {
        throw new Error('not expected')
      },
      writeModel: async (_uri: string, model: ParsedModel) => {
        writtenContent = model.rawContent
      },
      listChildren: async () => [],
      listAssets: async () => [],
    }

    await recursiveSerialize(parsed.nodes, new Set([docNode.id]), capturingDriver)
    expect(writtenContent).not.toBeNull()
    expect(writtenContent!).toContain('# NN matrices: Problems-Values Matrix')
    expect(writtenContent!).toContain('| Problem 1 | X |')

    // Re-parse the written content and verify the cell is restored into
    // node.fields under the id-based key.
    const tree2: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': writtenContent! },
    }
    const root2 = buildFakeTree('workspace', tree2)
    const secondParse = await recursiveParse(root2)
    const reparsedDocNode = Object.values(secondParse.nodes).find((n) => n.name === 'Doc')!
    const reparsedProblem1 = Object.values(secondParse.nodes).find((n) => n.name === 'Problem 1')!
    const reparsedValueA = Object.values(secondParse.nodes).find((n) => n.name === 'Value A')!

    expect(
      reparsedDocNode.fields[`Problems-Values Matrix||${reparsedProblem1.id}||${reparsedValueA.id}`]
        ?.value,
    ).toBe('X')
  })

  it('persists dynamic relational matrix definitions from node.fields to serialized markdown', async () => {
    const docWithoutMatrix = `---
spec_version: "V_0-3-0"
level: 1
title: "Matrix Definitions Test"
---

# NN index

* [[Problems]]
* [[Values]]

# NN Problems

## NN Problems: Problem 1

# NN Values

## NN Values: Value A
`
    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: { 'Doc_NN.md': docWithoutMatrix },
    }
    const root = buildFakeTree('workspace', tree)
    const parsed = await recursiveParse(root)

    const docNode = Object.values(parsed.nodes).find((n) => n.name === 'Doc')!

    // Simulate user editing/adding matrix definitions (writing to node.fields[__matrix_defs])
    docNode.fields['__matrix_defs'] = {
      value: [
        {
          name: 'My Custom Matrix',
          source: 'Problems',
          target: 'Values',
          widgetType: 'scale',
          params: 'min:1;max:5',
          description: 'A scale matrix.',
        },
      ],
    }

    let writtenContent: string | null = null
    const capturingDriver: ModelDriver = {
      readModel: async () => {
        throw new Error('not expected')
      },
      writeModel: async (_uri: string, model: ParsedModel) => {
        writtenContent = model.rawContent
      },
      listChildren: async () => [],
      listAssets: async () => [],
    }

    await recursiveSerialize(parsed.nodes, new Set([docNode.id]), capturingDriver)
    expect(writtenContent).not.toBeNull()
    expect(writtenContent!).toContain('matrices:')
    expect(writtenContent!).toContain('  - name: "My Custom Matrix"')
    expect(writtenContent!).toContain('    source: "Problems"')
    expect(writtenContent!).toContain('    target: "Values"')
    expect(writtenContent!).toContain('    params: "min:1;max:5"')
    expect(writtenContent!).toContain('    widget: "scale"')
    expect(writtenContent!).toContain('    description: "A scale matrix."')
  })

  it('does not duplicate an element reachable through two concept parents (diamond)', async () => {
    setActivePinia(createPinia())
    const modelStore = useModelStore()

    const sharedElement: ModelNode = {
      id: 'Root/Shared',
      name: 'Shared Item',
      parentId: 'ConceptA',
      childIds: [],
      type: 'Problems',
      kind: 'element',
      fields: {},
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/Doc_NN.md' },
    }
    const conceptA: ModelNode = {
      id: 'ConceptA',
      name: 'ConceptA',
      parentId: 'Root',
      childIds: ['Root/Shared'],
      type: 'Problems',
      kind: 'concept',
      fields: {},
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/Doc_NN.md' },
    }
    const conceptB: ModelNode = {
      id: 'ConceptB',
      name: 'ConceptB',
      parentId: 'Root',
      // Diamond: the same element id is also reachable through ConceptB.
      childIds: ['Root/Shared'],
      type: 'Values',
      kind: 'concept',
      fields: {},
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/Doc_NN.md' },
    }
    const root: ModelNode = {
      id: 'Root',
      name: 'Doc',
      parentId: null,
      childIds: ['ConceptA', 'ConceptB'],
      type: 'root',
      kind: 'root',
      fields: {},
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/Doc_NN.md' },
      rawContent: fileDocMd,
    }

    const nodes: Record<string, ModelNode> = {
      Root: root,
      ConceptA: conceptA,
      ConceptB: conceptB,
      'Root/Shared': sharedElement,
    }
    modelStore.setGraph(nodes, ['Root'])

    let writtenContent: string | null = null
    const capturingDriver: ModelDriver = {
      readModel: async () => {
        throw new Error('not expected')
      },
      writeModel: async (_uri: string, model: ParsedModel) => {
        writtenContent = model.rawContent
      },
      listChildren: async () => [],
      listAssets: async () => [],
    }

    await recursiveSerialize(nodes, new Set(['Root']), capturingDriver)
    expect(writtenContent).not.toBeNull()

    // Count the element's own section header, not raw name occurrences —
    // the name legitimately also appears once in the `# NN index` bullet
    // list, so a bare substring count would over-report duplication.
    const occurrences = writtenContent!.split('## NN Problems: Shared Item').length - 1
    expect(occurrences).toBe(1)
  })
})
