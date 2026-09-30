import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recursiveParse } from '../../src/model/recursiveParser'
import { recursiveSerialize } from '../../src/model/recursiveSerializer'
import { buildFakeTree } from '../helpers/fakeFs'
import type { FakeTree } from '../helpers/fakeFs'
import type { ParsedKnowledge, KnowledgeDriver } from '@cognnitive/innfo-core'
import type { KnowledgeNode } from '../../src/model/types'

// The frozen fixtures under tests/fixtures/kNNowledge/ are LF-only (git
// normalizes line endings on checkout), so the golden round-trip suite
// never exercises a CRLF source document. This suite takes an existing LF
// fixture and converts it to CRLF IN-MEMORY (never committing a CRLF file)
// to confirm the app's recursive parser + serializer handle CRLF input
// with the same fidelity as its LF twin.
const modelsDir = join(import.meta.dirname!, '..', 'fixtures', 'models')
const fixtureFile = 'mini-file_V_0-0-1_business_NN.md'
const nnFixtureName = fixtureFile.replace(/_F\.md$/i, '_NN.md')

/** Migrate legacy _F content to _NN on the fly for V_0-1-0+ parser. */
function toNnContent(content: string): string {
  return content
    .replace(/(\s*_F\s+)/g, (m) => m.replace('_F', '_NN'))
    .replace(/(\* _F\s)/g, '* _NN ')
    .replace(/(\/\/ _F)/g, '// _NN')
}

function makeIndex(wikilinks: string[]): string {
  const items = wikilinks.map((w) => `* [[${w}]]`).join('\n')
  return `---\nspec_version: "V_0-1-2"\nlevel: 0\ntitle: "Workspace Index"\n---\n\n# _NN index\n\n${items}\n`
}

/** Structural summary used to compare two parses without noise from
 *  volatile fields (provenance timestamps, etc). */
function structureOf(nodes: Record<string, KnowledgeNode>, rootIds: string[]) {
  const nodeSummaries = Object.values(nodes)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      type: n.type,
      fieldKeys: Object.keys(n.fields).sort(),
      fieldValues: Object.fromEntries(
        Object.entries(n.fields)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, v.value]),
      ),
      markers: n.markers,
      childCount: n.childIds.length,
    }))
  return {
    rootIds: [...rootIds].sort(),
    nodeCount: Object.keys(nodes).length,
    nodes: nodeSummaries,
  }
}

describe('recursiveParser/Serializer CRLF fidelity', () => {
  it('parses a CRLF twin of an LF fixture into the same structure as the LF original', async () => {
    const lfRaw = readFileSync(join(modelsDir, fixtureFile), 'utf-8')
    const lfContent = toNnContent(lfRaw).replace(/\r\n/g, '\n')
    const crlfContent = lfContent.replace(/\n/g, '\r\n')

    const indexMd = makeIndex([nnFixtureName])

    const lfRoot = buildFakeTree('models', { 'domaiNN_NN.md': indexMd, [nnFixtureName]: lfContent })
    const crlfRoot = buildFakeTree('models', { 'domaiNN_NN.md': indexMd, [nnFixtureName]: crlfContent })

    const lfParse = await recursiveParse(lfRoot)
    const crlfParse = await recursiveParse(crlfRoot)

    expect(lfParse.issues).toHaveLength(0)
    expect(crlfParse.issues).toHaveLength(0)
    expect(structureOf(crlfParse.nodes, crlfParse.rootIds)).toEqual(
      structureOf(lfParse.nodes, lfParse.rootIds),
    )
  })

  it('round-trips a CRLF source cleanly through parse -> serialize -> re-parse', async () => {
    const lfRaw = readFileSync(join(modelsDir, fixtureFile), 'utf-8')
    const lfContent = toNnContent(lfRaw).replace(/\r\n/g, '\n')
    const crlfContent = lfContent.replace(/\n/g, '\r\n')
    const indexMd = makeIndex([nnFixtureName])

    const tree: FakeTree = { 'domaiNN_NN.md': indexMd, [nnFixtureName]: crlfContent }
    const root = buildFakeTree('models', tree)

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

    const dirtyIds = new Set(
      Object.values(firstParse.nodes)
        .filter((n) => n.rawContent !== undefined)
        .map((n) => n.id),
    )
    await recursiveSerialize(firstParse.nodes, dirtyIds, capturingDriver)
    expect(capturedContent).toBeDefined()

    const rewrittenTree: FakeTree = { 'domaiNN_NN.md': indexMd, [nnFixtureName]: capturedContent! }
    const rewrittenRoot = buildFakeTree('models', rewrittenTree)
    const secondParse = await recursiveParse(rewrittenRoot)
    expect(secondParse.issues).toHaveLength(0)

    expect(structureOf(secondParse.nodes, secondParse.rootIds)).toEqual(
      structureOf(firstParse.nodes, firstParse.rootIds),
    )
  })
})
