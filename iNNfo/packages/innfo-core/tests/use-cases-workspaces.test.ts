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

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(here, '..', '..', '..', '..')
const USE_CASES_ROOT = join(REPO_ROOT, 'docs', 'cognitive_nn', 'use-cases')
const TEMPLATES = join(REPO_ROOT, 'iNNfo', 'specs', 'bluepriNNts')

const USE_CASE_SLUGS = [
  'startup-founder',
  'consulting-sales',
  'freelance-designer',
  'youtube-creator',
] as const

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
      readFileSync(full, 'utf-8')
      return nodeFileHandle(full, childName)
    },
  } as unknown as DirectoryHandleLike
}

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
      // Degrades if not resolved
    }
  }
  return cache
}

describe('Canonical Use Case Workspaces', () => {
  const templateCache = warmTemplateCache()

  for (const slug of USE_CASE_SLUGS) {
    describe(`Workspace: ${slug}`, () => {
      const wsPath = join(USE_CASES_ROOT, slug)

      it('manifest and catalogs exist on disk', () => {
        expect(existsSync(join(wsPath, 'domaiNN_NN.md'))).toBe(true)
        expect(existsSync(join(wsPath, 'sources_NN.md'))).toBe(true)
        expect(existsSync(join(wsPath, 'procedures_NN.md'))).toBe(true)
        expect(existsSync(join(wsPath, 'artifacts_NN.md'))).toBe(true)
      })

      it('has no legacy export/ directory', () => {
        expect(existsSync(join(wsPath, 'export'))).toBe(false)
        expect(existsSync(join(wsPath, 'artifacts'))).toBe(true)
      })

      it('parses recursively with no error or fatal diagnostics', async () => {
        const parsed = await recursiveParse(nodeHandle(wsPath), undefined, {
          resolveBlueprintSchema: ({ frontmatter }: { frontmatter?: { parent_spec?: { name?: string } } }) => {
            const declared = frontmatter?.parent_spec?.name
            if (!declared) return null
            const key = declared.toLowerCase()
            return (templateCache.get(key) ??
              templateCache.get(key.replace(/_v_\d+-\d+-\d+$/, '')) ??
              null) as never
          },
        })

        const errors = parsed.issues
          .filter((i) => i.severity === 'error')
          .map((i) => `${i.severity}: ${i.path} — ${i.message}`)
        expect(errors).toEqual([])
      })

      it('citations resolve to existing source files', async () => {
        const parsed = await recursiveParse(nodeHandle(wsPath), undefined)
        const diagnostics = validateWorkspaceSources(parsed, (refPath: string) => {
          // Check both sources/nn/ and sources/import/ or direct path
          let full = join(wsPath, refPath)
          if (!existsSync(full)) full = join(wsPath, 'sources', 'nn', refPath)
          if (!existsSync(full)) full = join(wsPath, 'sources', 'import', refPath)
          if (!existsSync(full)) return { exists: false }
          const content = readFileSync(full, 'utf-8')
          return { exists: true, content, headings: extractHeadings(content).map((h) => h.slug) }
        })

        const errors = diagnostics
          .filter((d) => d.severity === 'error')
          .map((d) => `${d.code}: ${d.path}`)
        expect(errors).toEqual([])
      })

      it('all declared models have zero slug collisions', () => {
        const modelsDir = join(wsPath, 'kNNowledge')
        if (!existsSync(modelsDir)) return
        const offenders: string[] = []
        for (const file of readdirSync(modelsDir).filter((f) => f.endsWith('.md'))) {
          const parsed = parseKnowledge(readFileSync(join(modelsDir, file), 'utf-8'))
          for (const collision of parsed.slugCollisions ?? []) {
            offenders.push(`${file}: "${collision.slug}" (${collision.elements.join(', ')})`)
          }
        }
        expect(offenders).toEqual([])
      })
    })
  }
})
