import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

// Force the pre-write specs backup to fail.
vi.mock('../src/tools/spec-backup', () => ({
  createSpecsBackupZip: vi.fn(async () => {
    throw new Error('disk full')
  }),
}))

import { applyChange } from '../src/tools/mutate'

const MODEL = `---
spec_version: "V_0-2-0"
spec_url: "https://example.test/iNNfo_V_0-2-0_NN.md"
level: 3
parent_spec:
  name: "missing_V_0-2-0"
  url: "https://example.test/missing_V_0-2-0_NN.md"
knowledge_version: "V_0-1-0"
title: "Fixture"
---

# NN index
`

describe('bump_version aborts when a requested pre-write backup fails', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'innfo-mcp-bump-'))
  })
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns a failure and leaves the file untouched', async () => {
    const filePath = join(tempDir, 'fixture_V_0-1-0_business_NN.md')
    await writeFile(filePath, MODEL)

    const res = await applyChange(tempDir, 'fixture_V_0-1-0_business', 'bump_version', {
      backup: true,
    })

    expect(res.success).toBe(false)
    expect(res.errors?.[0]?.message).toMatch(/backup failed .* bump_version aborted/i)

    // The file on disk is unchanged and was not renamed.
    expect(await readFile(filePath, 'utf-8')).toBe(MODEL)
  })
})
