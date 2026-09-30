import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import { normalizeId, listModels, readModel } from './list-read'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-list-read')

describe('normalizeId', () => {
  it('returns an empty string for empty input', () => {
    expect(normalizeId('')).toBe('')
  })

  it('strips a trailing .md extension', () => {
    expect(normalizeId('Model_V_1-0-0.md')).toBe('Model_V_1-0-0')
  })

  it('strips a trailing .markdown extension', () => {
    expect(normalizeId('Model.markdown')).toBe('Model')
  })

  it('strips a single trailing _NN suffix', () => {
    expect(normalizeId('Model_V_1-0-0_NN')).toBe('Model_V_1-0-0')
  })

  it('strips repeated trailing _NN suffixes', () => {
    expect(normalizeId('Model_NN_NN')).toBe('Model')
  })

  it('strips a trailing _NN suffix after removing the extension', () => {
    expect(normalizeId('Model_NN.md')).toBe('Model')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeId('  Model  ')).toBe('Model')
  })
})

describe('listModels', () => {
  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(rootDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('scans a directory and returns models sorted by id, excluding index.md', async () => {
    // H6: `list_models` requires `level: 3` + a resolvable `parent_spec`,
    // not just an `_NN.md` extension match.
    const modelFrontmatter = [
      '---',
      'level: 3',
      'parent_spec:',
      '  name: business_V_0-2-0',
      '  url: https://example.com/business_V_0-2-0_NN.md',
      '---',
      '',
    ].join('\n')
    await writeFile(join(rootDir, 'Beta_V_1-0-0_business_NN.md'), modelFrontmatter, 'utf-8')
    await writeFile(join(rootDir, 'Alpha_V_1-0-0_business_NN.md'), modelFrontmatter, 'utf-8')
    await writeFile(join(rootDir, 'index.md'), '', 'utf-8')
    await writeFile(join(rootDir, 'notes.txt'), '', 'utf-8')

    const models = await listModels(rootDir)

    expect(models.map((m) => m.id)).toEqual([
      'Alpha_V_1-0-0_business_NN',
      'Beta_V_1-0-0_business_NN',
    ])
    expect(models[0].version).toBe('1-0-0')
  })

  it('returns an empty array for a non-existent directory', async () => {
    const models = await listModels(join(rootDir, 'does-not-exist'))
    expect(models).toEqual([])
  })
})

describe('readModel', () => {
  const validContent = [
    '---',
    'spec_version: "V_0-2-0"',
    'level: 3',
    'title: "Readable Model"',
    '---',
    '',
    '# NN index',
  ].join('\n')

  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(rootDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('reads and parses a model located via the `_NN.md` candidate', async () => {
    await writeFile(join(rootDir, 'Sample_NN.md'), validContent, 'utf-8')
    const model = await readModel(rootDir, 'Sample')
    expect(model?.frontmatter.title).toBe('Readable Model')
  })

  it('reads and parses a model located via the plain `.md` candidate', async () => {
    await writeFile(join(rootDir, 'PlainOnly.md'), validContent, 'utf-8')
    const model = await readModel(rootDir, 'PlainOnly')
    expect(model?.frontmatter.title).toBe('Readable Model')
  })

  it('reads a model whose filename matches the id verbatim (no extension)', async () => {
    await writeFile(join(rootDir, 'VerbatimName'), validContent, 'utf-8')
    const model = await readModel(rootDir, 'VerbatimName')
    expect(model?.frontmatter.title).toBe('Readable Model')
  })

  it('returns null when no candidate file exists', async () => {
    const model = await readModel(rootDir, 'Missing')
    expect(model).toBeNull()
  })

  it('normalizes an id with a redundant _NN suffix before resolving candidates', async () => {
    await writeFile(join(rootDir, 'Sample_NN.md'), validContent, 'utf-8')
    const model = await readModel(rootDir, 'Sample_NN')
    expect(model?.frontmatter.title).toBe('Readable Model')
  })

  it('discovers domaiNN_NN.md entrypoints and parses type:: knowledge submodels', async () => {
    // H6: the workspace manifest follows the same `_NN.md` + `level: 3` +
    // `parent_spec` convention as any other discoverable model
    // (`domaiNN_NN.md`, per `iNNfo/specs/bluepriNNts/base/spec_NN.md`).
    const wsContent = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'title: "Root Workspace"',
      'parent_spec:',
      '  name: workspace_V_0-2-0',
      '  url: https://example.com/workspace_V_0-2-0_NN.md',
      '---',
      '',
      '# NN Models',
      '## NN Models: Auth Subsystem',
      'path:: models/auth_01.md',
      'type:: knowledge',
      '',
    ].join('\n')
    await writeFile(join(rootDir, 'domaiNN_NN.md'), wsContent, 'utf-8')

    const models = await listModels(rootDir)
    expect(models.some((m) => m.id === 'workspace_NN')).toBe(true)

    const model = await readModel(rootDir, 'workspace')
    expect(model?.frontmatter.title).toBe('Root Workspace')
    const modelRefs = model?.elements.get('Models')
    expect(modelRefs).toHaveLength(1)
    expect(modelRefs?.[0].fields['path']).toBe('models/auth_01.md')
  })
})

describe('readModel slices (llm-context-efficiency)', () => {
  const sliceRoot = join(import.meta.dirname!, '..', '..', 'temp-test-list-read-slice')

  function buildSlicedModelContent(): string {
    const lines = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'title: "Sliced Model"',
      '---',
      '',
      '# NN Alpha',
      '## NN Alpha: First',
      'field_a:: one',
    ]
    for (let i = 1; i <= 200; i++) lines.push(`note_${i}:: value ${i}`)
    lines.push('', '# NN Beta', '## NN Beta: Second', 'field_b:: two')
    return lines.join('\n')
  }

  beforeEach(async () => {
    await rm(sliceRoot, { recursive: true, force: true })
    await mkdir(sliceRoot, { recursive: true })
    await writeFile(join(sliceRoot, 'Sliced_NN.md'), buildSlicedModelContent(), 'utf-8')
  })

  afterEach(async () => {
    await rm(sliceRoot, { recursive: true, force: true })
  })

  it('surgical edit reads slices only: concept slice stays within the cap', async () => {
    const sliced = await readModel(sliceRoot, 'Sliced', { concept: 'Beta' })
    expect(sliced).not.toBeNull()
    expect(sliced?.elements.has('Beta')).toBe(true)
    expect(sliced?.elements.has('Alpha')).toBe(false)
    const lineCount = (sliced?.rawContent ?? '').split('\n').length
    expect(lineCount).toBeLessThanOrEqual(150)
    expect(sliced?.truncated).toBe(false)
  })

  it('caps enforced: oversized slice truncates at max_lines with truncated=true', async () => {
    const sliced = await readModel(sliceRoot, 'Sliced', { concept: 'Alpha', max_lines: 150 })
    expect(sliced).not.toBeNull()
    const lineCount = (sliced?.rawContent ?? '').split('\n').length
    expect(lineCount).toBeLessThanOrEqual(150)
    expect(sliced?.truncated).toBe(true)
  })

  it('override for wide context: override_reason includes the wider unit and records the override', async () => {
    const sliced = await readModel(sliceRoot, 'Sliced', {
      concept: 'Alpha',
      override_reason: 'Need full concept for migration audit',
    })
    expect(sliced).not.toBeNull()
    expect(sliced?.elements.has('Alpha')).toBe(true)
    const lineCount = (sliced?.rawContent ?? '').split('\n').length
    expect(lineCount).toBeGreaterThan(150)
    expect(sliced?.truncated).toBe(false)
    expect(sliced?.overrideRecorded).toBe('Need full concept for migration audit')
  })
})
