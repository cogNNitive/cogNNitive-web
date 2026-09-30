import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const runtimePath = join(
  here,
  '..',
  '..',
  '..',
  'specs',
  'bluepriNNts',
  'console',
  'innfo-runtime.js',
)

// nodeRequire aliases Node's require so the browser-first UMD bundle loads in tests.
const nodeRequire = createRequire(import.meta.url)

interface RuntimeNaming {
  slugify: (value: string) => string
  buildFeedbackFilename: (model: string, version: string, slug: string, when?: Date) => string
  parseFeedbackFilename: (filename: string) => {
    model: string
    version: string
    slug: string
    stamp: string
  } | null
}

function loadNaming(): RuntimeNaming {
  return nodeRequire(runtimePath) as RuntimeNaming
}

describe('slugify (export identifier to feedback_slug)', () => {
  it('lowercases and hyphenates a human identifier', () => {
    expect(loadNaming().slugify('Round 2 Review')).toBe('round-2-review')
  })

  it('collapses separators and strips edge hyphens', () => {
    expect(loadNaming().slugify('  Client -- feedback!! ')).toBe('client-feedback')
  })

  it('falls back to "feedback" for empty identifiers', () => {
    expect(loadNaming().slugify('')).toBe('feedback')
    expect(loadNaming().slugify('!!!')).toBe('feedback')
  })
})

describe('buildFeedbackFilename', () => {
  it('matches {Model}_V_{version}_{slug}_feedback_{YYYYMMDD-HHMMSS}.json', () => {
    const name = loadNaming().buildFeedbackFilename(
      'Ghostbusters',
      '0-2-1',
      'round-2',
      new Date('2026-09-09T12:00:00Z'),
    )
    expect(name).toBe('Ghostbusters_V_0-2-1_round-2_feedback_20260909-120000.json')
  })

  it('slugifies the human identifier before embedding it', () => {
    const name = loadNaming().buildFeedbackFilename(
      'Ghostbusters',
      '0-2-1',
      'Round 2 Review',
      new Date('2026-09-09T12:00:00Z'),
    )
    expect(name).toBe('Ghostbusters_V_0-2-1_round-2-review_feedback_20260909-120000.json')
  })

  it('throws on a malformed model version', () => {
    expect(() => loadNaming().buildFeedbackFilename('Ghostbusters', '0.2.1', 'round-2')).toThrow()
  })
})

describe('parseFeedbackFilename', () => {
  it('round-trips a built filename into its parts', () => {
    const built = loadNaming().buildFeedbackFilename(
      'Ghostbusters',
      '0-2-1',
      'round-2',
      new Date('2026-09-09T12:00:00Z'),
    )
    expect(loadNaming().parseFeedbackFilename(built)).toEqual({
      model: 'Ghostbusters',
      version: '0-2-1',
      slug: 'round-2',
      stamp: '20260909-120000',
    })
  })

  it('returns null for names outside the contract', () => {
    expect(loadNaming().parseFeedbackFilename('random.json')).toBe(null)
    expect(loadNaming().parseFeedbackFilename('Ghostbusters_V_0-2-1_round-2.json')).toBe(null)
  })
})
