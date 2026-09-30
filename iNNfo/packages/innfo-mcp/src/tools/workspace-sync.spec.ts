import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { syncWorkspaceManifest, buildUnifiedDiff } from './workspace-sync'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-workspace-sync')

function modelFrontmatter(overrides: Record<string, string> = {}): string {
  const lines = [
    '---',
    'level: 3',
    'parent_spec:',
    '  name: "business_V_0-2-0"',
    'title: "Acme Business Model"',
    '---',
    '',
    '# NN Workspace',
    'placeholder',
  ]
  return lines.join('\n')
}

describe('syncWorkspaceManifest', () => {
  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(rootDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('reports zero changes and does not write when no manifest is found', async () => {
    const result = await syncWorkspaceManifest(rootDir, { dry_run: true })
    expect(result.manifest_path).toBe('')
    expect(result.changes).toEqual([])
    expect(result.written).toBe(false)
  })

  it('dry-run reports discovered model as an "added" change without writing the manifest', async () => {
    await writeFile(join(rootDir, 'domaiNN_NN.md'), ['# NN Models', ''].join('\n'), 'utf-8')
    await writeFile(join(rootDir, 'acme_business_NN.md'), modelFrontmatter(), 'utf-8')

    const before = await readFile(join(rootDir, 'domaiNN_NN.md'), 'utf-8')
    const result = await syncWorkspaceManifest(rootDir, { dry_run: true })

    expect(result.dry_run).toBe(true)
    expect(result.written).toBe(false)
    expect(result.changes).toEqual([
      { kind: 'added', path: 'acme_business_NN.md', name: 'Acme Business Model' },
    ])
    expect(result.diff).toBeDefined()
    expect(result.diff).toContain('acme_business_NN.md')

    const after = await readFile(join(rootDir, 'domaiNN_NN.md'), 'utf-8')
    expect(after).toBe(before)
  })

  it('dry_run: false writes the reconciled content to disk', async () => {
    await writeFile(join(rootDir, 'domaiNN_NN.md'), ['# NN Models', ''].join('\n'), 'utf-8')
    await writeFile(join(rootDir, 'acme_business_NN.md'), modelFrontmatter(), 'utf-8')

    const result = await syncWorkspaceManifest(rootDir, { dry_run: false })

    expect(result.written).toBe(true)
    const after = await readFile(join(rootDir, 'domaiNN_NN.md'), 'utf-8')
    expect(after).toContain('## NN Models: Acme Business Model')
    expect(after).toContain('<!-- nn:auto -->')
  })

  it('defaults dry_run to true when omitted', async () => {
    await writeFile(join(rootDir, 'domaiNN_NN.md'), ['# NN Models', ''].join('\n'), 'utf-8')
    await writeFile(join(rootDir, 'acme_business_NN.md'), modelFrontmatter(), 'utf-8')

    const before = await readFile(join(rootDir, 'domaiNN_NN.md'), 'utf-8')
    const result = await syncWorkspaceManifest(rootDir, {})

    expect(result.dry_run).toBe(true)
    expect(result.written).toBe(false)
    const after = await readFile(join(rootDir, 'domaiNN_NN.md'), 'utf-8')
    expect(after).toBe(before)
  })

  it('does not write when the only changes are skipped-not-owned', async () => {
    const manifestBody = [
      '# NN Models',
      '',
      '## NN Models: Manual Entry',
      'path:: gone_NN.md',
      'status:: active',
      '',
    ].join('\n')
    await writeFile(join(rootDir, 'domaiNN_NN.md'), manifestBody, 'utf-8')

    const result = await syncWorkspaceManifest(rootDir, { dry_run: false })

    expect(result.changes).toEqual([
      {
        kind: 'skipped-not-owned',
        path: 'gone_NN.md',
        name: 'Manual Entry',
        reason: 'file missing, entry not tool-owned',
      },
    ])
    expect(result.written).toBe(false)
    const after = await readFile(join(rootDir, 'domaiNN_NN.md'), 'utf-8')
    expect(after).toBe(manifestBody)
  })

  it('excludes cogNNitive-templated models and the manifest itself from discovery', async () => {
    await writeFile(join(rootDir, 'domaiNN_NN.md'), ['# NN Models', ''].join('\n'), 'utf-8')
    await writeFile(
      join(rootDir, 'acme_cogNNitive_NN.md'),
      ['---', 'level: 3', 'parent_spec:', '  name: "cogNNitive_V_0-2-0"', '---'].join('\n'),
      'utf-8',
    )

    const result = await syncWorkspaceManifest(rootDir, { dry_run: true })
    expect(result.changes).toEqual([])
  })

  it('excludes workspace-conforming lineage records from discovery', async () => {
    await writeFile(join(rootDir, 'domaiNN_NN.md'), ['# NN Models', ''].join('\n'), 'utf-8')
    await writeFile(
      join(rootDir, 'acme_V_0-2-0_domaiNN_NN.md'),
      ['---', 'level: 3', 'parent_spec:', '  name: "workspace_V_0-3-0_spec_NN"', '---'].join('\n'),
      'utf-8',
    )

    const result = await syncWorkspaceManifest(rootDir, { dry_run: true })
    expect(result.changes).toEqual([])
  })

  it('regression: procedure/sources/artifacts catalogs never become ## NN Models entries', async () => {
    const manifestBody = [
      '# NN Models',
      '',
      '# NN Procedures',
      '',
      '## NN Procedures: Master Procedures Catalog',
      'path:: procedures/procedures_NN.md',
      '',
    ].join('\n')
    await writeFile(join(rootDir, 'domaiNN_NN.md'), manifestBody, 'utf-8')
    await mkdir(join(rootDir, 'procedures'), { recursive: true })
    await writeFile(
      join(rootDir, 'procedures', 'procedures_NN.md'),
      ['---', 'level: 3', 'parent_spec:', '  name: "procedures"', 'title: "Procedures Catalog"', '---'].join(
        '\n',
      ),
      'utf-8',
    )
    await writeFile(
      join(rootDir, 'procedures', 'generar_guion_video_V_0-1-0_procedures_NN.md'),
      ['---', 'level: 3', 'parent_spec:', '  name: "procedures"', 'title: "Generar guion"', '---'].join(
        '\n',
      ),
      'utf-8',
    )
    await writeFile(
      join(rootDir, 'sources_NN.md'),
      ['---', 'level: 3', 'parent_spec:', '  name: "sources"', 'title: "Sources Catalog"', '---'].join(
        '\n',
      ),
      'utf-8',
    )

    const result = await syncWorkspaceManifest(rootDir, { dry_run: true })
    expect(result.changes).toEqual([])
    expect(result.written).toBe(false)

    const after = await readFile(join(rootDir, 'domaiNN_NN.md'), 'utf-8')
    expect(after).toBe(manifestBody)
  })
})

describe('buildUnifiedDiff', () => {
  it('returns an empty string when contents are identical', () => {
    expect(buildUnifiedDiff('same', 'same', 'domaiNN_NN.md')).toBe('')
  })

  it('produces a single-hunk diff around the changed region', () => {
    const oldContent = ['a', 'b', 'c'].join('\n')
    const newContent = ['a', 'b', 'c', 'd'].join('\n')
    const diff = buildUnifiedDiff(oldContent, newContent, 'domaiNN_NN.md')
    expect(diff).toContain('--- a/domaiNN_NN.md')
    expect(diff).toContain('+++ b/domaiNN_NN.md')
    expect(diff).toContain('+d')
  })
})
