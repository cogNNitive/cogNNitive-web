import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recursiveParse } from '../src/recursiveParser/index.js'
import { validateWorkspaceSources } from '../src/validator/workspaceSources.js'
import { extractHeadings } from '../src/sourceRef.js'
import { parseKnowledge } from '../src/parser/index.js'
import { resolveBlueprintSchema } from '../src/schema/index.js'
import type { DirectoryHandleLike } from '../src/types/index.js'

/**
 * `shipped-sample-workspace` Requirements 1, 2, 4 and 5, enforced against the
 * real `_samples_nn/` through the same code path the editor and MCP use.
 *
 * `_samples_nn/` is the first workspace a new user opens. Anything it reports
 * on load is something a first-time user sees on day one, so it must not be
 * allowed to regress silently.
 */

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(here, '..', '..', '..', '..')
const WS = join(REPO_ROOT, '_samples_nn')
const TEMPLATES = join(REPO_ROOT, 'iNNfo', 'specs', 'bluepriNNts')

/**
 * Minimal Node-backed `DirectoryHandleLike`. The recursive parser is written
 * against the File System Access API shape (the editor's runtime); this is the
 * Node mirror of it, so the test drives the same entry point a real host does.
 */
function nodeFileHandle(filePath: string, name: string) {
  return {
    kind: 'file' as const,
    name,
    getFile: async () => ({ name, text: async () => readFileSync(filePath, 'utf-8') }),
  }
}

function nodeHandle(dirPath: string, name = ''): DirectoryHandleLike {
  return {
    kind: 'directory',
    name: name || dirPath,
    async *entries() {
      for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const full = join(dirPath, entry.name)
        yield [entry.name, entry.isDirectory() ? nodeHandle(full, entry.name) : nodeFileHandle(full, entry.name)]
      }
    },
    async getDirectoryHandle(childName: string) {
      return nodeHandle(join(dirPath, childName), childName)
    },
    async getFileHandle(childName: string) {
      const full = join(dirPath, childName)
      readFileSync(full, 'utf-8') // throws exactly as the browser handle would
      return nodeFileHandle(full, childName)
    },
  } as unknown as DirectoryHandleLike
}

/** Compose every shipped template schema, keyed by slug, as the hosts do. */
function warmTemplateCache(): Map<string, unknown> {
  const cache = new Map<string, unknown>()
  for (const entry of readdirSync(TEMPLATES, { withFileTypes: true })) {
    const spec = entry.isDirectory()
      ? join(TEMPLATES, entry.name, 'spec_NN.md')
      : join(TEMPLATES, entry.name)
    if (!spec.endsWith('_NN.md') || !existsSync(spec)) continue
    const slug = entry.isDirectory() ? entry.name : entry.name.replace(/_NN\.md$/, '')
    try {
      const { schema } = resolveBlueprintSchema(readFileSync(spec, 'utf-8'), (ref: string) => {
        const included = join(TEMPLATES, ref, 'spec_NN.md')
        return existsSync(included) ? readFileSync(included, 'utf-8') : null
      })
      cache.set(slug.toLowerCase(), schema)
    } catch {
      // A template that fails to compose degrades that model to schema-less
      // parsing, exactly as a cold cache does in the editor.
    }
  }
  return cache
}

describe('the shipped sample workspace', () => {
  const templateCache = warmTemplateCache()

  it('resolves the shipped template schemas', () => {
    // Guard: an empty cache would silently degrade every check below to
    // schema-less parsing, and Requirement 2 would pass for the wrong reason.
    expect(templateCache.size).toBeGreaterThan(5)
    expect(templateCache.has('documentation')).toBe(true)
  })

  async function openWorkspace() {
    return recursiveParse(nodeHandle(WS), undefined, {
      resolveBlueprintSchema: ({ frontmatter }: { frontmatter?: { parent_spec?: { name?: string } } }) => {
        const declared = frontmatter?.parent_spec?.name
        if (!declared) return null
        const key = declared.toLowerCase()
        // Models declare `<slug>_V_x-y-z`; the cache is keyed by slug.
        return (templateCache.get(key) ??
          templateCache.get(key.replace(/_v_\d+-\d+-\d+$/, '')) ??
          null) as never
      },
    })
  }

  it('Requirement 1: loads with no error or warning diagnostics', async () => {
    const parsed = await openWorkspace()
    // `info` notes are deliberate: AD-7 makes an element name that resolves
    // across several models legal, and records a note naming the qualified
    // `[[Model :: Element]]` form. They are not defects and must not be
    // counted here, or this test would forbid the design decision.
    const actionable = parsed.issues
      .filter((i) => i.severity !== 'info')
      .map((i) => `${i.severity ?? 'unspecified'}: ${i.path} — ${i.message}`)
    expect(actionable).toEqual([])
  })

  it('Requirement 2: every citation resolves to a file the workspace ships', async () => {
    const parsed = await openWorkspace()
    const diagnostics = validateWorkspaceSources(parsed, (refPath: string) => {
      const full = join(WS, refPath)
      if (!existsSync(full)) return { exists: false }
      const content = readFileSync(full, 'utf-8')
      return { exists: true, content, headings: extractHeadings(content).map((h) => h.slug) }
    })
    const errors = diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => `${d.code}: ${d.path}`)
    expect(errors).toEqual([])
  })

  it('Requirement 4: every artifact the workspace declares exists', () => {
    const workspaceDoc = readFileSync(join(WS, 'domaiNN_NN.md'), 'utf-8')
    const declared = [...workspaceDoc.matchAll(/^path:: (artifacts\/\S+)$/gm)].map((m) => m[1])
    expect(declared.filter((p) => !existsSync(join(WS, p)))).toEqual([])
  })

  it('Requirement 5: no shipped sample reports a slug collision', () => {
    const modelsDir = join(WS, 'kNNowledge')
    const offenders: string[] = []
    for (const file of readdirSync(modelsDir).filter((f) => f.endsWith('.md'))) {
      const parsed = parseKnowledge(readFileSync(join(modelsDir, file), 'utf-8'))
      for (const collision of parsed.slugCollisions ?? []) {
        offenders.push(`${file}: "${collision.slug}" (${collision.elements.join(', ')})`)
      }
      for (const warning of parsed.parseWarnings ?? []) {
        offenders.push(`${file}: ${warning}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
