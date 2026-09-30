import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { recursiveParse } from '../../src/model/recursiveParser'
import { buildFakeTree } from '../helpers/fakeFs'

// Frozen snapshot of the top-level `kNNowledge/*` FILE fixtures, sourced from
// committed HEAD. Each fixture is wrapped with an index.md for the new parser.
// Legacy _NN.md filenames are mapped to _NN.md in the virtual tree so the
// V_0-1-0 suffix check recognizes them. The disk files remain untouched.
const modelsDir = join(import.meta.dirname!, '..', 'fixtures', 'models')
const fixtureFiles = readdirSync(modelsDir).filter((f) => f.endsWith('.md'))

function makeIndex(wikilinks: string[]): string {
  const items = wikilinks.map((w) => `* [[${w}]]`).join('\n')
  return `---\nspec_version: "V_0-1-2"\nlevel: 0\ntitle: "Workspace Index"\n---\n\n# _NN index\n\n${items}\n`
}

describe('recursiveParser golden: frozen kNNowledge/* fixtures', () => {
  for (const fileName of fixtureFiles) {
    it(`parses ${fileName} into a normalized graph snapshot`, async () => {
      const content = readFileSync(join(modelsDir, fileName), 'utf-8')
      // Map legacy _NN.md suffix to _NN.md for the virtual tree
      const nnName = fileName.replace(/_F\.md$/i, '_NN.md')
      const root = buildFakeTree('models', {
        'index.md': makeIndex([nnName]),
        [nnName]: content,
      })

      const result = await recursiveParse(root)

      const snapshot = summarize(result)
      expect(snapshot).toMatchSnapshot()
    })
  }
})

function summarize(result: Awaited<ReturnType<typeof recursiveParse>>) {
  const nodeSummaries = Object.values(result.nodes)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      type: n.type,
      fieldKeys: Object.keys(n.fields).sort(),
      markerKeys: Object.keys(n.markers).sort(),
      childCount: n.childIds.length,
    }))
  return {
    rootIds: [...result.rootIds].sort(),
    nodeCount: Object.keys(result.nodes).length,
    issueCount: result.issues.length,
    nodes: nodeSummaries,
  }
}
