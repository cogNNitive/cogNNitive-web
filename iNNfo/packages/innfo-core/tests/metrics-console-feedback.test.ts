import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Task 3.3 — export → scan → Apply Feedback round-trip support on the sample:
// the feedback fixtures must validate against the console schema, the
// staleness check must block a stale base naming BOTH versions, and the
// procedure must run Apply Feedback instead of Version-And-Archive.
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
const samplesDir = join(here, '..', '..', '..', 'specs', 'bluepriNNts', 'metrics', 'samples')
const procedurePath = join(
  here,
  '..',
  '..',
  '..',
  'specs',
  'bluepriNNts',
  'metrics',
  'procedures',
  'create_timeline_NN.md',
)
const applyProcedurePath = join(
  here,
  '..',
  '..',
  '..',
  'specs',
  'bluepriNNts',
  'metrics',
  'procedures',
  'apply_feedback_NN.md',
)
const nodeRequire = createRequire(import.meta.url)

interface ApplyFeedbackRuntime {
  validateFeedback(doc: unknown): { ok: boolean; errors: string[] }
  checkStaleness(feedbackVersion: string, liveVersion: string): { stale: boolean; report: string }
}

function loadRuntime(): ApplyFeedbackRuntime {
  return nodeRequire(runtimePath) as ApplyFeedbackRuntime
}

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(samplesDir, 'feedback', name), 'utf8'))
}

describe('apply feedback: export fixture conforms to the console schema', () => {
  it('accepts the fresh round-1 export', () => {
    const result = loadRuntime().validateFeedback(
      fixture('Ghostbusters_V_0-1-0_round-1_feedback_20260911-120000.json'),
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('accepts the stale export (schema-valid but pinned to an old version)', () => {
    const result = loadRuntime().validateFeedback(
      fixture('Ghostbusters_V_0-0-9_stale_feedback_20260910-090000.json'),
    )
    expect(result.ok).toBe(true)
  })
})

describe('apply feedback: staleness block (Spec: Stale feedback blocked)', () => {
  const runtime = loadRuntime()

  it('proceeds when feedback matches the live model version', () => {
    const result = runtime.checkStaleness('V_0-1-0', 'V_0-1-0')
    expect(result.stale).toBe(false)
    expect(result.report).toContain('V_0-1-0')
  })

  it('blocks naming BOTH versions when feedback is pinned to an older base', () => {
    const result = runtime.checkStaleness('V_0-0-9', 'V_0-1-0')
    expect(result.stale).toBe(true)
    expect(result.report).toContain('V_0-0-9')
    expect(result.report).toContain('V_0-1-0')
  })
})

describe('apply feedback replaces the version-and-archive step', () => {
  it('create_timeline_NN.md runs Apply Feedback and never Version-And-Archive', () => {
    const procedure = readFileSync(procedurePath, 'utf8')
    expect(procedure).toContain('Apply Feedback')
    expect(procedure).not.toContain('Version And Archive')
  })

  it('create_timeline_NN.md encodes the Apply Feedback sequence', () => {
    const procedure = readFileSync(procedurePath, 'utf8').toLowerCase()
    expect(procedure).toContain('staleness')
    expect(procedure).toContain('apply_change')
    expect(procedure).toContain('validate_model')
    expect(procedure).toContain('bump the patch version')
    expect(procedure).toContain('{model}_v_{version}_console.html')
  })

  it('points the Apply Feedback step at the apply_feedback procedure', () => {
    const procedure = readFileSync(procedurePath, 'utf8')
    expect(procedure).toContain('apply_feedback_NN.md')
    expect(readFileSync(applyProcedurePath, 'utf8')).toContain('Staleness')
  })
})
