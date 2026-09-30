import { describe, it, expect } from 'vitest'
import { recursiveParse } from '../../src/model/recursiveParser'
import { recursiveSerialize } from '../../src/model/recursiveSerializer'
import { buildFakeTree } from '../helpers/fakeFs'
import type { ParsedKnowledge, KnowledgeDriver } from '@cognnitive/innfo-core'
import type { KnowledgeNode } from '../../src/model/types'

const fileDocMd = `---
spec_version: "V_0-1-1"
spec_url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
level: 3
parent:
  name: "business_V_0-1-1"
  url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-0-1"
title: "Single File Model"
---

# _NN index

* [[Problems]]

# _NN Problems

* _NN Problems: Problem One
  A synthetic problem used to exercise round-trip.
`

const indexMd = `---
spec_version: "V_0-1-2"
level: 0
title: "Workspace Index"
---

# _NN index

* [[Doc_NN.md]]
`

function structureOf(nodes: Record<string, KnowledgeNode>, rootIds: string[]) {
  const nodeSummaries = Object.values(nodes)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      fieldKeys: Object.keys(n.fields).sort(),
      childCount: n.childIds.length,
    }))
  return {
    rootIds: [...rootIds].sort(),
    nodeCount: Object.keys(nodes).length,
    nodes: nodeSummaries,
  }
}

async function assertRoundTripStable(
  index: string,
  modelFile: string,
  modelContent: string,
): Promise<void> {
  const tree = { 'domaiNN_NN.md': index, [modelFile]: modelContent }
  const root = buildFakeTree('workspace', tree)
  const firstParse = await recursiveParse(root)
  expect(firstParse.issues).toHaveLength(0)

  let capturedContent: string | null = null
  const capturingDriver: KnowledgeDriver = {
    readModel: async () => {
      throw new Error('not expected')
    },
    writeModel: async (_uri: string, model: ParsedKnowledge) => {
      capturedContent = model.rawContent
    },
    listChildren: async () => [],
    listAssets: async () => [],
  }

  const rootIds = Object.values(firstParse.nodes)
    .filter((n) => n.rawContent !== undefined)
    .map((n) => n.id)

  await recursiveSerialize(firstParse.nodes, new Set(rootIds), capturingDriver)
  expect(capturedContent).not.toBeNull()

  const rewrittenTree = { 'domaiNN_NN.md': index, [modelFile]: capturedContent! }
  const rewrittenRoot = buildFakeTree('workspace', rewrittenTree)
  const secondParse = await recursiveParse(rewrittenRoot)
  expect(secondParse.issues).toHaveLength(0)

  expect(structureOf(secondParse.nodes, secondParse.rootIds)).toEqual(
    structureOf(firstParse.nodes, firstParse.rootIds),
  )
}

describe('recursiveSerializer golden round-trip: synthetic single-file fixture', () => {
  it('parse -> serialize -> re-parse is structurally stable for single-file model', async () => {
    await assertRoundTripStable(indexMd, 'Doc_NN.md', fileDocMd)
  })
})
