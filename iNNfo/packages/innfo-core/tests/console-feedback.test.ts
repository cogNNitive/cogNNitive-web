import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const consoleDir = join(here, '..', '..', '..', 'specs', 'bluepriNNts', 'console')
const schemaPath = join(consoleDir, 'feedback.schema.json')
const runtimePath = join(consoleDir, 'innfo-runtime.js')

// nodeRequire aliases Node's require so the browser-first UMD bundle loads in tests.
const nodeRequire = createRequire(import.meta.url)

function loadRuntime(): Record<string, never> {
  return nodeRequire(runtimePath) as Record<string, never>
}

function loadSchema(): Record<string, unknown> {
  return JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>
}

function validFeedback(): Record<string, unknown> {
  return {
    meta: {
      source_model: 'Ghostbusters',
      source_knowledge_version: 'V_0-2-1',
      artifact: 'Ghostbusters_V_0-2-1_console.html',
      artifact_version: '0.1.0',
      exported_at: '2026-09-09T12:00:00Z',
      author: 'Reviewer',
      feedback_slug: 'round-2',
      viewer: 'innfo-console/0.1.0',
    },
    items: [
      {
        id: 'fb-001',
        kind: 'correction',
        target: {
          concept: 'Problems',
          element: 'Paranormal Infestation',
          field: 'severity',
        },
        original: 'low',
        proposed: 'high',
        status: 'pending',
      },
      {
        id: 'fb-002',
        kind: 'comment',
        target: { element_id: 'problems-paranormal-infestation' },
        comment: 'Check wording',
        status: 'pending',
      },
    ],
  }
}

describe('feedback.schema.json (canonical contract)', () => {
  it('exists and parses as JSON with a schema identifier', () => {
    expect(existsSync(schemaPath)).toBe(true)
    const schema = loadSchema()
    expect(typeof schema['$schema']).toBe('string')
    expect(typeof schema['title']).toBe('string')
  })

  it('requires meta and items at the document root', () => {
    const schema = loadSchema()
    const required = (schema['required'] ?? []) as string[]
    expect(required).toContain('meta')
    expect(required).toContain('items')
  })

  it('restricts item kind to correction|comment|new|delete (no rewrite)', () => {
    const schema = loadSchema()
    const text = JSON.stringify(schema)
    expect(text).toContain('correction')
    expect(text).toContain('comment')
    expect(text).not.toContain('rewrite')
  })

  it('restricts item status to pending|applied|rejected', () => {
    const schema = loadSchema()
    const text = JSON.stringify(schema)
    expect(text).toContain('pending')
    expect(text).toContain('applied')
    expect(text).toContain('rejected')
  })

  it('documents the export filename pattern', () => {
    const schema = loadSchema()
    const text = JSON.stringify(schema)
    expect(text).toContain('_feedback_')
  })
})

describe('validateFeedback (runtime validator)', () => {
  it('accepts a valid export with zero errors', () => {
    const { validateFeedback } = loadRuntime() as unknown as {
      validateFeedback: (doc: unknown) => { ok: boolean; errors: string[] }
    }
    const result = validateFeedback(validFeedback())
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects kind:rewrite and names the offending id', () => {
    const { validateFeedback } = loadRuntime() as unknown as {
      validateFeedback: (doc: unknown) => { ok: boolean; errors: string[] }
    }
    const doc = validFeedback()
    const items = doc['items'] as Array<Record<string, unknown>>
    items[0] = { ...items[0], kind: 'rewrite' }
    const result = validateFeedback(doc)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('fb-001'))).toBe(true)
  })

  it('rejects a malformed source_knowledge_version', () => {
    const { validateFeedback } = loadRuntime() as unknown as {
      validateFeedback: (doc: unknown) => { ok: boolean; errors: string[] }
    }
    const doc = validFeedback()
    const meta = doc['meta'] as Record<string, unknown>
    meta['source_knowledge_version'] = '0.2.1'
    const result = validateFeedback(doc)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('source_knowledge_version'))).toBe(true)
  })

  it('rejects exported_at without seconds precision', () => {
    const { validateFeedback } = loadRuntime() as unknown as {
      validateFeedback: (doc: unknown) => { ok: boolean; errors: string[] }
    }
    const doc = validFeedback()
    const meta = doc['meta'] as Record<string, unknown>
    meta['exported_at'] = '2026-09-09T12:00Z'
    const result = validateFeedback(doc)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('exported_at'))).toBe(true)
  })

  it('rejects malformed item ids', () => {
    const { validateFeedback } = loadRuntime() as unknown as {
      validateFeedback: (doc: unknown) => { ok: boolean; errors: string[] }
    }
    const doc = validFeedback()
    const items = doc['items'] as Array<Record<string, unknown>>
    items[1] = { ...items[1], id: 'item-2' }
    const result = validateFeedback(doc)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('item-2'))).toBe(true)
  })

  it('ignores unknown draft fields instead of failing', () => {
    const { validateFeedback } = loadRuntime() as unknown as {
      validateFeedback: (doc: unknown) => { ok: boolean; errors: string[] }
    }
    const doc = validFeedback()
    const items = doc['items'] as Array<Record<string, unknown>>
    items[0] = { ...items[0], draft_note: 'wip', ui_state: { open: true } }
    const result = validateFeedback(doc)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })
})
