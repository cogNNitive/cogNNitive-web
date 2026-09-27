import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile, readdir } from 'node:fs/promises'
import { resolveSources, EXCERPT_CHAR_CAP } from './resolve-sources'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-resolve-sources')
const specsDir = join(rootDir, 'specs')

/** Local level-1/level-0 chain so template resolution never hits the network. */
async function stubSpecChain() {
  await writeFile(
    join(specsDir, 'iNNfo_V_0-1-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-1-0"',
      'level: 1',
      'title: "Local iNNfo Spec"',
      'parent_spec:',
      '  name: "defiNNe_V_0-1-0"',
      '  url: "https://example.com/defiNNe_V_0-1-0_NN.md"',
      '---',
    ].join('\n'),
    'utf-8',
  )
  await writeFile(
    join(specsDir, 'defiNNe_V_0-1-0_NN.md'),
    ['---', 'spec_version: "V_0-1-0"', 'level: 0', 'title: "Local defiNNe Spec"', '---'].join('\n'),
    'utf-8',
  )
}

/** A local level-2 template declaring `precio_source` as `type:: citation`. */
async function stubPricingTemplate() {
  await writeFile(
    join(specsDir, 'pricing_V_0-1-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-1-0"',
      'level: 2',
      'title: "Local Pricing Template"',
      'parent_spec:',
      '  name: "iNNfo_V_0-1-0"',
      '  url: "https://example.com/iNNfo_V_0-1-0_NN.md"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Producto',
      'type:: category',
      '',
      '# NN Field Definition',
      '',
      '## NN Field Definition: precio_source',
      'concept:: Producto',
      'type:: citation',
      '',
    ].join('\n'),
    'utf-8',
  )
  await stubSpecChain()
}

async function writeWorkspace(): Promise<void> {
  await mkdir(join(rootDir, 'models'), { recursive: true })
  await mkdir(join(rootDir, 'sources', 'nn'), { recursive: true })

  await writeFile(
    join(rootDir, 'models', 'Plan_V_1-0-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-1-0"',
      'level: 3',
      'model_version: "V_1-0-0"',
      'parent_spec:',
      '  name: "pricing_V_0-1-0"',
      '  url: "https://example.com/pricing_V_0-1-0_NN.md"',
      '---',
      '',
      '# NN Producto',
      '',
      '## NN Producto: Widget',
      'sources:: sources/nn/pricing.md@## Q3 Pricing',
      'precio_source:: sources/nn/pricing.md@## Q3 Pricing',
      'dangling_source:: sources/nn/missing.md@## Ghost',
      'unknown_anchor_source:: sources/nn/report.md@## Nonexistent Heading',
      'long_source:: sources/nn/long.md@## Long Section',
      'short_source:: sources/nn/short.md@## Short Section',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'pricing.md'),
    [
      '---',
      'sha256: "abc123"',
      '---',
      '',
      '## Q3 Pricing',
      'Widget priced at $42 for Q3.',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'report.md'),
    ['---', 'sha256: "def456"', '---', '', '## Some Other Heading', 'Unrelated content.', ''].join(
      '\n',
    ),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'long.md'),
    ['---', 'sha256: "longhash"', '---', '', '## Long Section', 'x'.repeat(2000), ''].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'short.md'),
    ['---', 'sha256: "shorthash"', '---', '', '## Short Section', 'y'.repeat(120), ''].join('\n'),
    'utf-8',
  )
}

describe('resolve_sources', () => {
  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(specsDir, { recursive: true })
    await writeWorkspace()
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('resolves a valid citation with excerpt and sha256', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'sources',
    })
    expect(results).toHaveLength(1)
    expect(results[0].path).toBe('sources/nn/pricing.md')
    expect(results[0].anchor).toBe('q3-pricing')
    expect(results[0].exists).toBe(true)
    expect(results[0].sha256).toBe('abc123')
    expect(results[0].excerpt).toContain('Widget priced at $42 for Q3.')
    expect(results[0].excerpt!.length).toBeLessThanOrEqual(EXCERPT_CHAR_CAP)
  })

  it('filters by fieldName so only that field is resolved', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'precio_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].path).toBe('sources/nn/pricing.md')
  })

  it('reports a dangling file without throwing', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'dangling_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].exists).toBe(false)
    expect(results[0].error).toBe('DANGLING_FILE')
    expect(results[0].excerpt).toBeUndefined()
    expect(results[0].sha256).toBeUndefined()
    expect(results[0].version).toBeUndefined()
  })

  it('reports an unknown anchor within an existing file', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'unknown_anchor_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].exists).toBe(true)
    expect(results[0].error).toBe('UNKNOWN_ANCHOR')
  })

  it('resolves a schema-typed non-sources field with an explicit fieldName, standalone (no A3 schema needed)', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'precio_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].exists).toBe(true)
  })

  it('resolves schema-typed citation fields when fieldName is omitted, without any network fetch or file writes', async () => {
    await stubPricingTemplate()
    const fetchSpy = vi.spyOn(global, 'fetch')
    const before = await snapshotFiles()

    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    const after = await snapshotFiles()
    expect(after).toEqual(before)

    const paths = results.map((r) => r.path)
    // Both the name-based `sources` field and the schema-typed `precio_source`
    // field resolve to the same target here, so the same path appears twice —
    // once per field — proving both selection paths fired.
    expect(paths.filter((p) => p === 'sources/nn/pricing.md')).toHaveLength(2)
  })

  it('truncates a long section to the excerpt cap', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'long_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].excerpt!.length).toBeLessThanOrEqual(EXCERPT_CHAR_CAP)
    expect(results[0].truncated).toBe(true)
  })

  it('returns a short section in full, uncapped', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'short_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].excerpt).toContain('y'.repeat(120))
    expect(results[0].excerpt!.length).toBeLessThan(EXCERPT_CHAR_CAP)
    expect(results[0].truncated).toBeUndefined()
  })
})

async function snapshotFiles(): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else out.push(full)
    }
  }
  await walk(rootDir)
  return out.sort()
}
