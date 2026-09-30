import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { parseModel, serializeModel } from '../src/parser/index.js'

/**
 * Requirement 1 (round-trip identity) and Requirement 2 (idempotency) of
 * `model-document-fidelity`, enforced over the real shipped corpus.
 *
 * This is the test that keeps the serializer honest. Every defect it guards
 * against was a silent data loss on save: dropped frontmatter keys, dropped
 * banner text, dropped marker columns, reordered sections, destroyed tag
 * casing, and indentation that compounded on every cycle.
 */

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(here, '..', '..', '..', '..')

function findModelDocuments(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...findModelDocuments(full))
    else if (entry.name.endsWith('_NN.md')) found.push(full)
  }
  return found
}

/** Every shipped document: the sample workspace, plus each template's own samples. */
function corpus(): string[] {
  const samples = findModelDocuments(join(REPO_ROOT, '_samples_nn'))
  const templateSamples = findModelDocuments(join(REPO_ROOT, 'iNNfo', 'specs', 'bluepriNNts')).filter(
    (f) => /[\\/]samples[\\/]/.test(f),
  )
  return [...samples, ...templateSamples]
}

/** First differing line, as `L<n>: <original> -> <serialized>`, for a readable failure. */
function firstDifference(original: string, serialized: string): string {
  const a = original.split('\n')
  const b = serialized.split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return `L${i}: ${JSON.stringify(a[i])} -> ${JSON.stringify(b[i])}`
    }
  }
  return 'no line differs (trailing whitespace only)'
}

describe('round-trip fidelity over the shipped corpus', () => {
  const files = corpus()

  it('finds the shipped corpus', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('parse -> serialize is byte-identical for every shipped document', () => {
    const mismatches: string[] = []
    for (const file of files) {
      const original = readFileSync(file, 'utf-8')
      const serialized = serializeModel(parseModel(original))
      if (serialized !== original) {
        mismatches.push(`${relative(REPO_ROOT, file)} — ${firstDifference(original, serialized)}`)
      }
    }
    expect(mismatches).toEqual([])
  })

  it('serializing twice changes nothing further', () => {
    const notIdempotent: string[] = []
    for (const file of files) {
      const once = serializeModel(parseModel(readFileSync(file, 'utf-8')))
      const twice = serializeModel(parseModel(once))
      if (twice !== once) {
        notIdempotent.push(`${relative(REPO_ROOT, file)} — ${firstDifference(once, twice)}`)
      }
    }
    expect(notIdempotent).toEqual([])
  })
})
