import { describe, it, expect } from 'vitest'
import type { DirectoryHandleLike, FileHandleLike } from '../src/fs-types'
import type { ModelDriver } from '../src/types'
import type { ParsedModel } from '../src/types'
import type { TemplateSchema } from '../src/schema'
import type { TemplateSchemaResolver } from '../src/recursiveParser/types'
import { recursiveParse, normalizeSingleModel, readWorkspaceId } from '../src/recursiveParser'
import { validateDocument } from '../src/validator'

/* ── Fake handle helpers ─────────────────────────────────────── */

type DirEntries = Array<[string, FileHandleLike | DirectoryHandleLike]>

function fakeDir(name: string, entries: DirEntries): DirectoryHandleLike {
  const fileMap = new Map<string, FileHandleLike>()
  const dirMap = new Map<string, DirectoryHandleLike>()
  for (const [entryName, entry] of entries) {
    if (entry.kind === 'file') {
      fileMap.set(entryName, entry)
    } else {
      dirMap.set(entryName, entry)
    }
  }
  return {
    kind: 'directory',
    name,
    entries: async function* () {
      for (const e of entries) yield e
    },
    getFileHandle: async (fileName: string) => {
      const found = fileMap.get(fileName)
      if (!found) throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
      return found
    },
    getDirectoryHandle: async (dirName: string) => {
      const found = dirMap.get(dirName)
      if (!found) throw Object.assign(new Error('Directory not found'), { code: 'ENOENT' })
      return found
    },
  }
}

function fakeFile(name: string, content: string): FileHandleLike {
  return {
    kind: 'file',
    name,
    getFile: async () => ({ text: async () => content }),
  }
}

function md(frontmatter: Record<string, unknown>, body?: string): string {
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')
  return `---\n${fm}\n---\n${body ?? ''}`
}

const BASE_FM = {
  spec_version: 'V_0-1-2',
  level: 3,
  knowledge_version: 'V_0-0-1',
  parent: { name: 'business_V_0-1-1', url: 'https://example.com/business' },
}

function makeModel(title: string, body?: string): string {
  return md({ ...BASE_FM, title }, body)
}

function makeIndex(wikilinks: string[]): string {
  const items = wikilinks.map((w) => `* [[${w}]]`).join('\n')
  return `---\nspec_version: "V_0-1-2"\nlevel: 0\ntitle: "Workspace Index"\n---\n\n# NN index\n\n${items}\n`
}

function makeIndexWithMdLinks(links: string[]): string {
  const items = links.map((p) => `* [${p}](./${p})`).join('\n')
  return `---\nspec_version: "V_0-1-2"\nlevel: 0\ntitle: "Workspace Index"\n---\n\n# NN index\n\n${items}\n`
}

function makeWorkspaceEntrypoint(workspaceId?: string): string {
  const fm: Record<string, unknown> = { ...BASE_FM, title: 'Root Workspace' }
  if (workspaceId !== undefined) fm.workspace_id = workspaceId
  return md(fm, '\n# NN index\n')
}

/* ── Tests ───────────────────────────────────────────────────── */

describe('recursiveParse (index.md-driven)', () => {
  describe('FR-001: Workspace with valid index.md', () => {
    it('parses a single model listed in index.md', async () => {
      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['gb_NN.md']))],
        ['gb_NN.md', fakeFile('gb_NN.md', makeModel('Ghostbusters'))],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(1)
      const rootNode = result.nodes[result.rootIds[0]]
      expect(rootNode).toBeDefined()
      expect(rootNode.name).toBe('gb')
      expect(rootNode.kind).toBe('root')
      expect(result.issues).toHaveLength(0)
    })

    it('parses multiple models listed in index.md', async () => {
      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['modelA_NN.md', 'modelB_NN.md']))],
        ['modelA_NN.md', fakeFile('modelA_NN.md', makeModel('Model A'))],
        ['modelB_NN.md', fakeFile('modelB_NN.md', makeModel('Model B'))],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(2)
      const names = result.rootIds.map((id) => result.nodes[id].name).sort()
      expect(names).toEqual(['modelA', 'modelB'])
      expect(result.issues).toHaveLength(0)
    })

    it('parses models with elements into a normalized graph', async () => {
      const modelContent = makeModel(
        'Test Model',
        `
# NN index

* [[Problems]]

# NN Problems

## NN Problems: Problem One
  Description of problem one.
## NN Problems: Problem Two
  Description of problem two.
`,
      )

      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['test_NN.md']))],
        ['test_NN.md', fakeFile('test_NN.md', modelContent)],
      ])

      const result = await recursiveParse(root)
      expect(result.issues).toHaveLength(0)
      expect(Object.keys(result.nodes).length).toBeGreaterThan(1)

      // Elements should exist in the graph
      const problemOne = Object.values(result.nodes).find((n) => n.name === 'Problem One')
      expect(problemOne).toBeDefined()
      expect(problemOne!.kind).toBe('element')
    })
  })

  describe('FR-001: Missing domaiNN_NN.md', () => {
    it('scans for standalone _NN.md files when index.md is missing', async () => {
      const root = fakeDir('workspace', [
        ['gb_NN.md', fakeFile('gb_NN.md', makeModel('Ghostbusters'))],
      ])

      const result = await recursiveParse(root)
      // The model should still be loaded via the fallback scan
      expect(result.rootIds).toHaveLength(1)
      const rootNode = result.nodes[result.rootIds[0]]
      expect(rootNode).toBeDefined()
      expect(rootNode.name).toBe('gb')
      // The missing index.md issue is still reported as the first warning (downgraded when models found)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].message).toContain('No domaiNN_NN.md found')
    })

    it('loads multiple standalone _NN.md files when index.md is missing', async () => {
      const root = fakeDir('workspace', [
        ['modelA_NN.md', fakeFile('modelA_NN.md', makeModel('Model A'))],
        ['modelB_NN.md', fakeFile('modelB_NN.md', makeModel('Model B'))],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(2)
      const names = result.rootIds.map((id) => result.nodes[id].name).sort()
      expect(names).toEqual(['modelA', 'modelB'])
      expect(result.issues[0].message).toContain('No domaiNN_NN.md found')
    })

    it('returns empty when no .md files with iNNfo frontmatter exist and index.md is missing', async () => {
      const root = fakeDir('workspace', [['readme.md', fakeFile('readme.md', '# Just a readme')]])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(0)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].message).toContain('Missing domaiNN_NN.md')
    })

    it('loads models with plain .md filenames (no _NN suffix)', async () => {
      const root = fakeDir('workspace', [
        [
          'DeLorean_Time_Travel.md',
          fakeFile('DeLorean_Time_Travel.md', makeModel('Time Travel Procedure')),
        ],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(1)
      const rootNode = result.nodes[result.rootIds[0]]
      expect(rootNode.name).toBe('DeLorean_Time_Travel')
      expect(rootNode.type).toBe('Time Travel Procedure')
      expect(result.issues[0].message).toContain('No domaiNN_NN.md found')
    })

    it('skips .md files without iNNfo frontmatter (no spec_version)', async () => {
      const root = fakeDir('workspace', [
        [
          'not-a-model.md',
          fakeFile('not-a-model.md', '# Just markdown\n\nNo YAML frontmatter here.'),
        ],
        ['real-model.md', fakeFile('real-model.md', makeModel('Real Model'))],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(1)
      expect(result.nodes[result.rootIds[0]].name).toBe('real-model')
    })

    it('reports an issue when a _NN.md file exists but has invalid frontmatter', async () => {
      const root = fakeDir('workspace', [
        [
          'broken_V_1-0-0_business_NN.md',
          fakeFile(
            'broken_V_1-0-0_business_NN.md',
            'X---\nspec_version: "V_0-2-0"\ntitle: "Broken"\n---\n\n# NN Business summary\n\ntext',
          ),
        ],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(0)
      const brokenIssues = result.issues.filter((i) => i.message.includes('spec_version'))
      expect(brokenIssues).toHaveLength(1)
      expect(brokenIssues[0].path).toBe('broken_V_1-0-0_business_NN.md')
    })
  })

  describe('FR-001: Wikilink to non-existent model', () => {
    it('emits a warning and skips missing file', async () => {
      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['exists_NN.md', 'missing_NN.md']))],
        ['exists_NN.md', fakeFile('exists_NN.md', makeModel('Exists'))],
      ])

      const result = await recursiveParse(root)
      // Only one model should be loaded
      expect(result.rootIds).toHaveLength(1)
      expect(result.nodes[result.rootIds[0]].name).toBe('exists')

      // Warning for missing file
      const missingIssues = result.issues.filter((i) => i.message.includes('not found'))
      expect(missingIssues.length).toBeGreaterThan(0)
      expect(missingIssues[0].path).toBe('missing_NN.md')
    })
  })

  describe('FR-001: index.md references with nested paths', () => {
    it('resolves a wikilink pointing into a subdirectory', async () => {
      const modelsDir = fakeDir('kNNowledge', [
        ['nested_NN.md', fakeFile('nested_NN.md', makeModel('Nested Model'))],
      ])
      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['./models/nested_NN.md']))],
        ['kNNowledge', modelsDir],
      ])

      const result = await recursiveParse(root)
      expect(result.issues).toHaveLength(0)
      expect(result.rootIds).toHaveLength(1)
      expect(result.nodes[result.rootIds[0]].name).toBe('nested')
    })

    it('resolves markdown-link references with ./ paths (films index.md case)', async () => {
      const nnDir = fakeDir('nn', [
        [
          'Casablanca.md',
          fakeFile('Casablanca.md', '# Casablanca\n\nPlain source document, not a model.'),
        ],
        [
          'The_Goonies.md',
          fakeFile('The_Goonies.md', '# The Goonies\n\nPlain source document, not a model.'),
        ],
      ])
      const modelsDir = fakeDir('kNNowledge', [
        [
          'FilmCatalog_V_0-3-0_film_NN.md',
          fakeFile('FilmCatalog_V_0-3-0_film_NN.md', makeModel('Film Catalog')),
        ],
      ])
      const sourcesDir = fakeDir('sources', [['nn', nnDir]])
      const root = fakeDir('workspace', [
        [
          'domaiNN_NN.md',
          fakeFile(
            'domaiNN_NN.md',
            makeIndexWithMdLinks([
              'sources/nn/Casablanca.md',
              'sources/nn/The_Goonies.md',
              'models/FilmCatalog_V_0-3-0_film_NN.md',
            ]),
          ),
        ],
        ['sources', sourcesDir],
        ['kNNowledge', modelsDir],
      ])

      const result = await recursiveParse(root)
      // Plain source docs are skipped silently; only the real model is loaded.
      expect(result.issues).toHaveLength(0)
      expect(result.rootIds).toHaveLength(1)
      expect(result.nodes[result.rootIds[0]].name).toBe('FilmCatalog_V_0-3-0_film')
    })

    it('resolves `_source_NN.md` files inside a `sources/` subdirectory (current films workspace)', async () => {
      const sourcesDir = fakeDir('sources', [
        [
          'Singin_in_the_Rain_source_NN.md',
          fakeFile('Singin_in_the_Rain_source_NN.md', makeModel('Singin Source')),
        ],
        [
          'Casablanca_source_NN.md',
          fakeFile('Casablanca_source_NN.md', makeModel('Casablanca Source')),
        ],
        [
          'The_Goonies_source_NN.md',
          fakeFile('The_Goonies_source_NN.md', makeModel('Goonies Source')),
        ],
        [
          'Una_noche_en_la_opera_source_NN.md',
          fakeFile('Una_noche_en_la_opera_source_NN.md', makeModel('Opera Source')),
        ],
      ])
      const modelsDir = fakeDir('kNNowledge', [
        [
          'FilmCatalog_V_0-3-0_film_NN.md',
          fakeFile('FilmCatalog_V_0-3-0_film_NN.md', makeModel('Film Catalog')),
        ],
      ])
      const root = fakeDir('films', [
        [
          'domaiNN_NN.md',
          fakeFile(
            'domaiNN_NN.md',
            makeIndexWithMdLinks([
              'sources/Singin_in_the_Rain_source_NN.md',
              'sources/Casablanca_source_NN.md',
              'sources/The_Goonies_source_NN.md',
              'sources/Una_noche_en_la_opera_source_NN.md',
              'film_V_0-5-0_NN.md',
              'models/FilmCatalog_V_0-3-0_film_NN.md',
            ]),
          ),
        ],
        ['film_V_0-5-0_NN.md', fakeFile('film_V_0-5-0_NN.md', makeModel('Film Template'))],
        ['sources', sourcesDir],
        ['kNNowledge', modelsDir],
      ])

      const result = await recursiveParse(root)
      // No "Name is not allowed" — every nested reference resolves through its directory.
      expect(result.issues.filter((i) => i.message.includes('Name is not allowed'))).toHaveLength(0)
      // All 4 sources + template + catalog model register as roots.
      expect(result.rootIds).toHaveLength(6)
      const names = result.rootIds.map((id) => result.nodes[id].name)
      expect(names).toEqual(
        expect.arrayContaining([
          'Singin_in_the_Rain_source',
          'Casablanca_source',
          'The_Goonies_source',
          'Una_noche_en_la_opera_source',
          'FilmCatalog_V_0-3-0_film',
        ]),
      )
    })

    it('resolves backslash-separated references on the same shape as forward slashes', async () => {
      const modelsDir = fakeDir('kNNowledge', [
        ['nested_NN.md', fakeFile('nested_NN.md', makeModel('Nested Model'))],
      ])
      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['models\\nested_NN.md']))],
        ['kNNowledge', modelsDir],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(1)
      expect(result.nodes[result.rootIds[0]].name).toBe('nested')
    })

    it('reports a clear skip issue when a nested target directory is missing', async () => {
      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['./models/missing_NN.md']))],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(0)
      const missingIssue = result.issues.find((i) => i.message.includes('not found'))
      expect(missingIssue).toBeDefined()
      expect(missingIssue!.path).toBe('./models/missing_NN.md')
    })

    it('does not surface "Name is not allowed" for references that escape the root', async () => {
      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['../outside_NN.md']))],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(0)
      const messages = result.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('Name is not allowed'))).toBe(false)
      expect(messages.some((m) => m.includes('not found'))).toBe(true)
    })
  })

  describe('FR-005 / AD-7: Cross-model element identity is legal (shipped-sample-workspace R6)', () => {
    it('does NOT advise renaming when two models share an element name — shared identity is legal', async () => {
      const modelA = makeModel(
        'Model A',
        `
# NN index

* [[Database]]

# NN Components

## NN Components: Database
  The database component.
`,
      )

      const modelB = makeModel(
        'Model B',
        `
# NN index

* [[Database]]

# NN Components

## NN Components: Database
  Another database component.
`,
      )

      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['modelA_NN.md', 'modelB_NN.md']))],
        ['modelA_NN.md', fakeFile('modelA_NN.md', modelA)],
        ['modelB_NN.md', fakeFile('modelB_NN.md', modelB)],
      ])

      const result = await recursiveParse(root)

      // Both root nodes should exist
      expect(result.rootIds).toHaveLength(2)

      // The parser MUST NOT tell the user to rename the element — shared
      // identity across models is the intended shape of a multi-model
      // workspace, and `[[Model Title :: Element Name]]` already
      // disambiguates it (AD-7 / shipped-sample-workspace R6).
      const renameAdvice = result.issues.filter(
        (i) => i.message.includes('appears in both') && i.message.includes('consider renaming'),
      )
      expect(renameAdvice).toHaveLength(0)

      // It MAY record an info-level note naming the qualified-reference form.
      const infoNotes = result.issues.filter((i) => i.severity === 'info' && i.message.includes('Database'))
      for (const note of infoNotes) {
        expect(note.message).toContain('::')
      }
    })

    it('still flags a name collision within a single document (intra-model collisions keep their severity)', async () => {
      const modelA = makeModel(
        'Model A',
        `
# NN index

* [[Database]]

# NN Components

## NN Components: Database
  The database component.

# NN Storage

## NN Storage: Database
  A second element with the same name in the SAME model.
`,
      )

      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['modelA_NN.md']))],
        ['modelA_NN.md', fakeFile('modelA_NN.md', modelA)],
      ])

      const result = await recursiveParse(root)

      const duplicateIssues = result.issues.filter((i) =>
        i.message.toLowerCase().includes('duplicate element name'),
      )
      expect(duplicateIssues.length).toBeGreaterThan(0)
      expect(duplicateIssues[0].message).toContain('"Database"')
    })

    it('no collision when all element names are unique across models', async () => {
      const modelA = makeModel(
        'Model A',
        `
# NN index

* [[Users]]

# NN Components

## NN Components: Users
  User management.
`,
      )

      const modelB = makeModel(
        'Model B',
        `
# NN index

* [[Orders]]

# NN Components

## NN Components: Orders
  Order management.
`,
      )

      const root = fakeDir('workspace', [
        ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeIndex(['modelA_NN.md', 'modelB_NN.md']))],
        ['modelA_NN.md', fakeFile('modelA_NN.md', modelA)],
        ['modelB_NN.md', fakeFile('modelB_NN.md', modelB)],
      ])

      const result = await recursiveParse(root)
      expect(result.rootIds).toHaveLength(2)
      const elementNames = Object.values(result.nodes)
        .filter((n) => n.kind === 'element')
        .map((n) => n.name)
      expect(elementNames).toEqual(expect.arrayContaining(['Users', 'Orders']))
    })
  })
})

describe('readWorkspaceId', () => {
  it('workspace-id-read-from-entrypoint', async () => {
    const root = fakeDir('workspace', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeWorkspaceEntrypoint('acme'))],
    ])

    const result = await recursiveParse(root)
    expect(result.entrypointPath).toBe('domaiNN_NN.md')
    expect(readWorkspaceId(result)).toBe('acme')
  })

  it('workspace-id-absent-is-undefined', async () => {
    const root = fakeDir('workspace', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeWorkspaceEntrypoint())],
    ])

    const result = await recursiveParse(root)
    expect(result.issues).toHaveLength(0)
    expect(readWorkspaceId(result)).toBeUndefined()
  })
})

describe('diamond vs cycle (ancestorKeys)', () => {
  function makeWorkspaceRoot(wikilinks: string[]): string {
    const items = wikilinks.map((w) => `[[${w}]]`).join('\n')
    return `---\nspec_version: "V_0-1-2"\nlevel: 0\ntitle: "Workspace Root"\n---\n\n${items}\n`
  }

  it('diamond-no-issue-both-edges: a diamond reached via two independent parents links both edges and emits no issue', async () => {
    const root = fakeDir('workspace', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeWorkspaceRoot(['x_NN.md', 'p_NN.md']))],
      ['x_NN.md', fakeFile('x_NN.md', makeModel('X'))],
      ['p_NN.md', fakeFile('p_NN.md', makeModel('P', '\n[[x_NN.md]]\n'))],
    ])

    const result = await recursiveParse(root)

    const wNode = Object.values(result.nodes).find((n) => n.name === 'workspace')
    const xNodes = Object.values(result.nodes).filter((n) => n.name === 'x')
    const pNode = Object.values(result.nodes).find((n) => n.name === 'p')

    expect(wNode).toBeDefined()
    expect(pNode).toBeDefined()
    expect(xNodes).toHaveLength(1)

    const xNode = xNodes[0]
    expect(result.issues.filter((i) => i.code === 'CYCLE_DETECTED')).toHaveLength(0)
    expect(pNode!.childIds).toContain(xNode.id)
    expect(wNode!.childIds).toContain(xNode.id)
    expect(xNode.parentId).toBe(wNode!.id)
  })

  it('true-cycle-still-errors: a mutual reference through an ancestor chain is still flagged as a cycle', async () => {
    const root = fakeDir('workspace', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeWorkspaceRoot(['a_NN.md']))],
      ['a_NN.md', fakeFile('a_NN.md', makeModel('A', '\n[[b_NN.md]]\n'))],
      ['b_NN.md', fakeFile('b_NN.md', makeModel('B', '\n[[a_NN.md]]\n'))],
    ])

    const result = await recursiveParse(root)

    const cycleIssues = result.issues.filter((i) => i.code === 'CYCLE_DETECTED')
    expect(cycleIssues).toHaveLength(1)
    expect(cycleIssues[0].path).toContain('a_NN.md')
  })

  it('cycle-back-to-entrypoint: a reference chain looping back to the entrypoint is a cycle, proving ancestorKeys is seeded from it', async () => {
    const root = fakeDir('workspace', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeWorkspaceRoot(['a_NN.md']))],
      ['a_NN.md', fakeFile('a_NN.md', makeModel('A', '\n[[workspace_NN.md]]\n'))],
    ])

    const result = await recursiveParse(root)

    const cycleIssues = result.issues.filter((i) => i.code === 'CYCLE_DETECTED')
    expect(cycleIssues).toHaveLength(1)
  })

  it('self-ref-is-filtered-at-extraction: a model linking to itself produces no issue and no duplicate node', async () => {
    const root = fakeDir('workspace', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeWorkspaceRoot(['a_NN.md']))],
      ['a_NN.md', fakeFile('a_NN.md', makeModel('A', '\n[[./a_NN.md]]\n'))],
    ])

    const result = await recursiveParse(root)

    expect(result.issues).toHaveLength(0)
    const aNodes = Object.values(result.nodes).filter((n) => n.name === 'a')
    expect(aNodes).toHaveLength(1)
  })

  it('max-depth-boundary-with-diamond: the first arrival sets depth; a second parent that also exceeds MAX_DEPTH is a silent no-op, not a second issue', async () => {
    const entries: DirEntries = [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeWorkspaceRoot(['level_1_NN.md']))],
    ]
    for (let i = 1; i <= 8; i++) {
      entries.push([
        `level_${i}_NN.md`,
        fakeFile(`level_${i}_NN.md`, makeModel(`Level ${i}`, `\n[[level_${i + 1}_NN.md]]\n`)),
      ])
    }
    entries.push([
      'level_9_NN.md',
      fakeFile(
        'level_9_NN.md',
        makeModel('Level 9', '\n[[level_10a_NN.md]]\n[[level_10b_NN.md]]\n'),
      ),
    ])
    entries.push([
      'level_10a_NN.md',
      fakeFile('level_10a_NN.md', makeModel('Level 10a', '\n[[shared_11_NN.md]]\n')),
    ])
    entries.push([
      'level_10b_NN.md',
      fakeFile('level_10b_NN.md', makeModel('Level 10b', '\n[[shared_11_NN.md]]\n')),
    ])
    entries.push(['shared_11_NN.md', fakeFile('shared_11_NN.md', makeModel('Shared 11'))])

    const root = fakeDir('workspace', entries)
    const result = await recursiveParse(root)

    const depthIssues = result.issues.filter((i) => i.code === 'DEPTH_LIMIT')
    expect(depthIssues).toHaveLength(1)
    expect(result.issues.filter((i) => i.code === 'CYCLE_DETECTED')).toHaveLength(0)
    const sharedNode = Object.values(result.nodes).find((n) => n.name === 'shared_11')
    expect(sharedNode).toBeUndefined()
  })

  it('diamond-does-not-reparent: a diamond edge never overwrites the primary parentId', async () => {
    const root = fakeDir('workspace', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeWorkspaceRoot(['x_NN.md', 'p_NN.md']))],
      ['x_NN.md', fakeFile('x_NN.md', makeModel('X'))],
      ['p_NN.md', fakeFile('p_NN.md', makeModel('P', '\n[[x_NN.md]]\n'))],
    ])

    const result = await recursiveParse(root)

    const wNode = Object.values(result.nodes).find((n) => n.name === 'workspace')
    const xNode = Object.values(result.nodes).find((n) => n.name === 'x')
    const pNode = Object.values(result.nodes).find((n) => n.name === 'p')

    expect(pNode!.childIds).toContain(xNode!.id)
    expect(xNode!.parentId).toBe(wNode!.id)
  })
})

describe('overview root entrypoint (OVERVIEW_ROOT_RE, PR6/A2)', () => {
  function makeOverviewRoot(manifestRef: string, provenanceRef: string): string {
    return `---\nspec_version: "V_0-1-2"\nlevel: 3\nknowledge_version: "V_0-1-0"\ntitle: "Overview"\nparent_spec:\n  name: "base_V_0-1-0"\n  url: "https://example.test/base_V_0-1-0_spec_NN.md"\n---\n\n# NN Overview\n\n## NN Overview: Ghostbusters\nmanifest:: ${manifestRef}\nprovenance:: ${provenanceRef}\n`
  }

  function fakeParsedModel(content: string): ParsedModel {
    return {
      frontmatter: {} as ParsedModel['frontmatter'],
      taxonomy: [],
      elements: new Map(),
      matrices: [],
      nodeMarkers: {},
      rawContent: content,
    }
  }

  function fakeDriver(files: Record<string, string>): ModelDriver {
    return {
      async readModel(uri: string) {
        const content = files[uri]
        if (content === undefined) {
          throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
        }
        return fakeParsedModel(content)
      },
      async writeModel() {
        throw new Error('not implemented in fakeDriver')
      },
      async listChildren(uri: string) {
        if (uri !== '') return []
        return Object.keys(files).map((name) => ({ name, uri: name, kind: 'element' as const }))
      },
      async listAssets() {
        return []
      },
    }
  }

  const overviewRootSchema: TemplateSchema = {
    concepts: [
      {
        name: 'Overview',
        type: 'text',
        fields: [
          { name: 'manifest', type: 'model', target_blueprint: 'workspace_V_0-2-0' },
          { name: 'provenance', type: 'model', target_blueprint: 'cogNNitive_V_0-2-0' },
        ],
      },
    ],
    markers: [],
    matrices: [],
    taxonomy: [],
  }

  const overviewRootResolver: TemplateSchemaResolver = ({ frontmatter }) => {
    const name = (frontmatter as { parent_spec?: { name?: string } } | undefined)?.parent_spec
      ?.name
    return name === 'base_V_0-1-0' ? overviewRootSchema : null
  }

  it('base-root-takes-precedence: an overview root and a workspace manifest both exist — overview root wins', async () => {
    const root = fakeDir('workspace', [
      [
        'gb_base_NN.md',
        fakeFile('gb_base_NN.md', makeOverviewRoot('domaiNN_NN.md', 'gb_cognnitive_NN.md')),
      ],
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeModel('Ghostbusters Workspace'))],
    ])

    const result = await recursiveParse(root, undefined, {
      resolveTemplateSchema: overviewRootResolver,
    })

    const overviewNode = Object.values(result.nodes).find((n) => n.name === 'gb_base')
    const manifestNode = Object.values(result.nodes).find((n) => n.name === 'workspace')
    expect(overviewNode).toBeDefined()
    expect(overviewNode!.parentId).toBeNull()
    // the manifest is reached as the overview root's CHILD, not as a second root
    expect(manifestNode).toBeDefined()
    expect(manifestNode!.parentId).toBe(overviewNode!.id)
    expect(result.rootIds).toHaveLength(1)
    expect(result.rootIds[0]).toBe(overviewNode!.id)
  })

  it('no-base-root-unchanged: only workspace*.md exists — resolves exactly as before this capability existed', async () => {
    const root = fakeDir('workspace', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeModel('Plain Workspace'))],
    ])

    const result = await recursiveParse(root)

    expect(result.rootIds).toHaveLength(1)
    const rootNode = result.nodes[result.rootIds[0]]
    expect(rootNode.name).toBe('workspace')
    expect(result.issues).toHaveLength(0)
  })

  it('base-root-driver-path: the same precedence holds via the ModelDriver code path', async () => {
    const driver = fakeDriver({
      'gb_base_NN.md': makeOverviewRoot('domaiNN_NN.md', 'gb_cognnitive_NN.md'),
      'domaiNN_NN.md': makeModel('Ghostbusters Workspace'),
    })
    // The plain-handle root is irrelevant when a driver is supplied, but recursiveParse
    // still requires one; an empty directory is sufficient since the driver serves reads.
    const root = fakeDir('workspace', [])

    const result = await recursiveParse(root, driver, {
      resolveTemplateSchema: overviewRootResolver,
    })

    const overviewNode = Object.values(result.nodes).find((n) => n.name === 'gb_base')
    const manifestNode = Object.values(result.nodes).find((n) => n.name === 'workspace')
    expect(overviewNode).toBeDefined()
    expect(overviewNode!.parentId).toBeNull()
    expect(manifestNode).toBeDefined()
    expect(manifestNode!.parentId).toBe(overviewNode!.id)
    expect(result.rootIds).toHaveLength(1)
  })

  it('base-root-in-ignored-dir-ignored: an overview-root-shaped file nested under archive/ is not discovered as the entrypoint', async () => {
    const archiveDir = fakeDir('archive', [
      ['x_base_NN.md', fakeFile('x_base_NN.md', makeOverviewRoot('domaiNN_NN.md', 'x_cognnitive_NN.md'))],
    ])
    const root = fakeDir('workspace', [
      ['archive', archiveDir],
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeModel('Plain Workspace'))],
    ])

    const result = await recursiveParse(root)

    // The nested overview-root-shaped file never surfaces as a node at all —
    // only the root-level workspace manifest is discovered as the entrypoint.
    expect(Object.values(result.nodes).some((n) => n.name === 'x_base')).toBe(false)
    expect(result.rootIds).toHaveLength(1)
    expect(result.nodes[result.rootIds[0]].name).toBe('workspace')
  })

  it('overview-root-children: parsing an overview root reaches both its manifest and provenance children via type:: knowledge traversal', async () => {
    const root = fakeDir('workspace', [
      [
        'gb_base_NN.md',
        fakeFile('gb_base_NN.md', makeOverviewRoot('domaiNN_NN.md', 'gb_cognnitive_NN.md')),
      ],
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', makeModel('Ghostbusters Workspace'))],
      ['gb_cognnitive_NN.md', fakeFile('gb_cognnitive_NN.md', makeModel('Ghostbusters Provenance'))],
    ])

    const result = await recursiveParse(root, undefined, {
      resolveTemplateSchema: overviewRootResolver,
    })

    const overviewNode = Object.values(result.nodes).find((n) => n.name === 'gb_base')
    const manifestNode = Object.values(result.nodes).find((n) => n.name === 'workspace')
    const provenanceNode = Object.values(result.nodes).find((n) => n.name === 'gb_cognnitive')

    expect(overviewNode).toBeDefined()
    expect(manifestNode).toBeDefined()
    expect(provenanceNode).toBeDefined()
    expect(overviewNode!.childIds).toContain(manifestNode!.id)
    expect(overviewNode!.childIds).toContain(provenanceNode!.id)
    expect(manifestNode!.parentId).toBe(overviewNode!.id)
    expect(provenanceNode!.parentId).toBe(overviewNode!.id)
    expect(result.issues.filter((i) => i.code === 'CYCLE_DETECTED')).toHaveLength(0)
  })
})

describe('normalizeSingleModel', () => {
  it('parses a single model file directly and returns normalized nodes and issues', () => {
    const modelContent = makeModel(
      'Standalone Model',
      `
# NN index

* [[SingleNode]]

# NN Concepts

## NN Concepts: SingleNode
  Description of single node.
`,
    )
    const { nodes, issues } = normalizeSingleModel(
      modelContent,
      'standalone_NN.md',
      'standalone_NN',
    )
    expect(issues).toHaveLength(0)

    const rootId = 'standalone_NN'
    expect(nodes[rootId]).toBeDefined()
    expect(nodes[rootId].kind).toBe('root')
    expect(nodes[rootId].name).toBe('standalone_NN')

    const elementNode = Object.values(nodes).find((n) => n.name === 'SingleNode')
    expect(elementNode).toBeDefined()
    expect(elementNode!.kind).toBe('element')
  })

  it('returns empty nodes when content is not a model (missing spec_version)', () => {
    const plainMarkdown =
      '# Standalone Document\n\nThis is not a model because it has no spec_version in frontmatter.'
    const { nodes, issues } = normalizeSingleModel(plainMarkdown, 'doc.md', 'doc')
    expect(issues).toHaveLength(0)
    expect(Object.keys(nodes)).toHaveLength(0)
  })

  it('propagates text-concept content into the root node rawSections', () => {
    const modelContent = makeModel(
      'Text Model',
      `
# NN index

* [[Market size]]

# NN Market size

En España fallecieron 439.146 personas en 2024 (INE).

**TAM:** ~500.000 procesos de reparto anuales.
`,
    )
    const { nodes, issues } = normalizeSingleModel(modelContent, 'text_NN.md', 'text_NN')
    expect(issues).toHaveLength(0)

    const rootNode = nodes['text_NN']
    expect(rootNode).toBeDefined()
    expect(rootNode.rawSections).toBeDefined()
    expect(rootNode.rawSections!['Market size']).toContain(
      'En España fallecieron 439.146 personas en 2024 (INE).',
    )
  })

  it('reports an issue when a _NN-named file lacks valid iNNfo frontmatter', () => {
    const broken =
      'X---\nspec_version: "V_0-1-2"\ntitle: "Broken"\n---\n\n# NN Business summary\n\ntext'
    const { nodes, issues } = normalizeSingleModel(broken, 'broken_NN.md', 'broken_NN')
    expect(Object.keys(nodes)).toHaveLength(0)
    expect(issues.some((i) => i.message.includes('spec_version'))).toBe(true)
    expect(issues.some((i) => i.path === 'broken_NN.md')).toBe(true)
  })

  it('resolves a matrix relationship whose header differs only by dash character, emitting a warning issue (Fix 3)', () => {
    const modelContent =
      '---\n' +
      'spec_version: "V_0-1-2"\n' +
      'level: 3\n' +
      'knowledge_version: "V_0-0-1"\n' +
      'title: "Dash Test"\n' +
      'parent: { name: "business_V_0-1-1", url: "https://example.com/business" }\n' +
      'matrices:\n' +
      '  - name: "revenue-roles matrix"\n' +
      '    source: "Work"\n' +
      '    target: "Roles"\n' +
      '---\n' +
      '\n' +
      '# NN index\n' +
      '* [[Revenue-Cost Structure]]\n' +
      '* [[Reviewer]]\n' +
      '\n' +
      '# NN Work\n' +
      '## NN Work: Revenue-Cost Structure\n' +
      '\n' +
      '# NN Roles\n' +
      '## NN Roles: Reviewer\n' +
      '\n' +
      '# NN matrices: revenue-roles matrix\n' +
      '| Work \\ Roles | Reviewer |\n' +
      '| --- | --- |\n' +
      '| Revenue—Cost Structure | ✅ |\n'

    const { nodes, issues } = normalizeSingleModel(modelContent, 'dash_NN.md', 'dash_NN')

    const warning = issues.find((i) => i.message.includes('separator character differs'))
    expect(warning).toBeDefined()
    expect(issues.some((i) => i.message.toLowerCase().includes('dangling'))).toBe(false)

    const sourceNode = Object.values(nodes).find((n) => n.name === 'Revenue-Cost Structure')
    expect(sourceNode).toBeDefined()
    expect(sourceNode!.relationships.length).toBeGreaterThan(0)
    expect(sourceNode!.relationships[0].label).toBe('revenue-roles matrix')
  })
})

describe('AD-06: per-file validator still bypasses qualified cross-model refs', () => {
  it('per-file-validator-still-bypasses-qualified: validateDocument emits no dangling-reference diagnostic for a qualified `[[A :: B]]` value', () => {
    const templateDoc = {
      name: 'person_spec_01',
      level: 2 as const,
      frontmatter: {
        spec_version: 'V_1-0-0',
        level: 2,
        parent_spec: { name: 'iNNfo_V_0-1-0', url: 'https://example.com' },
        title: 'Person Spec',
      },
      rawContent: `---
spec_version: V_1-0-0
level: 2
parent_spec:
  name: iNNfo_V_0-1-0
  url: https://example.com
title: Person Spec
---
# NN Concept Definition
## NN Concept Definition: Person
type:: text

# NN Field Definition
## NN Field Definition: contact
concept:: Person
type:: reference
`,
    }

    const modelContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: person_spec_01
  url: https://example.com
knowledge_version: V_0-1-0
title: Person Model
---
# NN Person
## NN Person: Jane Doe
contact:: [[Acme Org :: Jane Doe]]
`

    const res = validateDocument(modelContent, {
      fileName: 'person_01.md',
      template: templateDoc,
    })

    const danglingDiagnostics = [...res.errors, ...res.warnings].filter((d) =>
      d.message.toLowerCase().includes('dangling'),
    )
    expect(danglingDiagnostics).toHaveLength(0)
  })
})
