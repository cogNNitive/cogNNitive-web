import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { recursiveParse } from '../../src/model/recursiveParser'
import { recursiveSerialize } from '../../src/model/recursiveSerializer'
import { buildFakeTree } from '../helpers/fakeFs'
import type { ParsedKnowledge, KnowledgeDriver } from '@cognnitive/innfo-core'
import type { KnowledgeNode } from '../../src/model/types'

// Frozen fixtures (see recursiveParser.models.golden.test.ts).
const modelsDir = join(import.meta.dirname!, '..', 'fixtures', 'models')
const fixtureFiles = readdirSync(modelsDir).filter((f) => f.endsWith('.md'))

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

describe('recursiveSerializer golden round-trip: frozen kNNowledge/* fixtures', () => {
  for (const fileName of fixtureFiles) {
    it(`parse -> serialize -> re-parse is structurally equivalent for ${fileName}`, async () => {
      const content = readFileSync(join(modelsDir, fileName), 'utf-8')
      // Map legacy _NN.md suffix to _NN.md for the virtual tree
      const nnName = fileName.replace(/_F\.md$/i, '_NN.md')
      const tree = { 'domaiNN_NN.md': makeIndex([nnName]), [nnName]: content }
      const root = buildFakeTree('models', tree)

      const firstParse = await recursiveParse(root)
      // Issues include identity collisions (duplicate names now throw),
      // cross-model name warnings, and slug collision warnings.
      // Any of these are acceptable for legacy _NN.md fixtures.

      // Use a capturing driver for round-trip
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

      // Re-parse the captured content
      const rewrittenTree = { 'domaiNN_NN.md': makeIndex([nnName]), [nnName]: capturedContent! }
      const rewrittenRoot = buildFakeTree('models', rewrittenTree)
      const secondParse = await recursiveParse(rewrittenRoot)
      const secondCollisionIssues = secondParse.issues.filter(
        (i) =>
          i.message.includes('Duplicate sibling name') ||
          i.message.includes('consider renaming') ||
          i.message.includes('Duplicate element name') ||
          i.message.includes('Slug collision'),
      )
      expect(secondParse.issues.length).toBe(secondCollisionIssues.length)

      expect(structureOf(secondParse.nodes, secondParse.rootIds)).toEqual(
        structureOf(firstParse.nodes, firstParse.rootIds),
      )
    })
  }
})
