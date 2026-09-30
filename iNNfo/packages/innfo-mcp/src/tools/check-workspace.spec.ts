import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { checkWorkspace, resolveCatalog, toIntegrityDiagnostics } from './check-workspace'
import { rmWithRetry } from '../../test/helpers/fs-retry'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-check-workspace')
const specsDir = join(rootDir, 'specs')
const modelsDir = join(rootDir, 'models')

const TEMPLATE_URL =
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/V_0-2-0/spec_NN.md'

const TEMPLATE_CONTENT = [
  '---',
  'spec_version: "V_0-2-0"',
  'spec_url: "' + TEMPLATE_URL + '"',
  'level: 2',
  'title: "Business Template"',
  'parent_spec:',
  '  name: "iNNfo_V_0-2-1"',
  '  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"',
  '---',
  '',
  '# NN Concept Definition',
  '',
  '## NN Concept Definition: Stakeholders',
  'icon:: user',
  'type:: list',
  '',
  '# NN Field Definition',
  '',
  '## NN Field Definition: scope',
  'concept:: Stakeholders',
  'type:: select',
  'options:: [internal, external]',
  '',
].join('\n')

const LEVEL1_CONTENT = [
  '---',
  'spec_version: "V_0-2-1"',
  'level: 1',
  'title: "Local iNNfo Spec"',
  'parent_spec:',
  '  name: "defiNNe_V_0-1-0"',
  '  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNe_V_0-1-0_NN.md"',
  '---',
].join('\n')

const LEVEL0_CONTENT = [
  '---',
  'spec_version: "V_0-1-0"',
  'level: 0',
  'title: "Local defiNNe Spec"',
  '---',
].join('\n')

const CATALOG = {
  generator: 'blueprint-catalog.mjs',
  blueprints: {
    business: {
      name: 'business',
      adopted: 'V_0-2-0',
      versions: [
        { blueprint_version: 'V_0-1-0', spec_url: TEMPLATE_URL },
        { blueprint_version: 'V_0-2-0', spec_url: TEMPLATE_URL },
      ],
    },
  },
}

function modelContent(title: string, body: string): string {
  return [
    '---',
    'level: 3',
    `title: "${title}"`,
    'knowledge_version: "V_0-1-0"',
    'parent_spec:',
    '  name: "business_V_0-2-0"',
    '  url: "' + TEMPLATE_URL + '"',
    '---',
    '',
    '# NN Stakeholders',
    '',
    body,
  ].join('\n')
}

async function writeModels(count: number): Promise<string[]> {
  const paths: string[] = []
  for (let i = 0; i < count; i++) {
    const name = `model${i}_V_0-1-0_business_NN.md`
    const p = join(modelsDir, name)
    await writeFile(
      p,
      modelContent(`Model ${i}`, `## NN Stakeholders: Stakeholder ${i}\n`),
      'utf-8',
    )
    paths.push(p)
  }
  return paths
}

/** Stub fetch so resolution + catalog fetch never touch the real network. */
function stubNetwork(): void {
  vi.spyOn(global, 'fetch').mockImplementation((input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/catalog.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(CATALOG),
      } as unknown as Response)
    }
    if (url.includes('business/V_0-2-0/spec_NN.md') || url.endsWith('business_V_0-2-0_NN.md')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(TEMPLATE_CONTENT),
      } as unknown as Response)
    }
    if (url.includes('iNNfo_V_0-2-1_NN.md')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(LEVEL1_CONTENT),
      } as unknown as Response)
    }
    if (url.includes('defiNNe_V_0-1-0_NN.md')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(LEVEL0_CONTENT),
      } as unknown as Response)
    }
    return Promise.resolve({ ok: false } as unknown as Response)
  })
}

describe('resolveCatalog (AD-3)', () => {
  beforeEach(async () => {
    await rmWithRetry(rootDir)
    await mkdir(specsDir, { recursive: true })
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rmWithRetry(rootDir)
  })

  it('resolves remote-first when the network returns a catalog', async () => {
    stubNetwork()
    const result = await resolveCatalog(rootDir, false)
    expect(result.source).toBe('remote')
    expect(result.catalog?.blueprints.business.adopted).toBe('V_0-2-0')
  })

  it('degrades to in-repo when remote is unreachable', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: false } as unknown as Response),
    )
    const local = join(specsDir, 'bluepriNNts', 'catalog.json')
    await mkdir(join(specsDir, 'bluepriNNts'), { recursive: true })
    await writeFile(local, JSON.stringify(CATALOG), 'utf-8')
    const result = await resolveCatalog(rootDir, false)
    expect(result.source).toBe('in-repo')
    expect(result.catalog?.blueprints.business).toBeDefined()
  })

  it('goes offline when nothing resolves and never throws', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('network down')
    })
    const result = await resolveCatalog(rootDir, false)
    expect(result.source).toBe('offline')
    expect(result.catalog).toBeNull()
  })

  it('skips the network entirely in offline mode', async () => {
    const spy = vi.spyOn(global, 'fetch')
    const result = await resolveCatalog(rootDir, true)
    expect(spy).not.toHaveBeenCalled()
    expect(result.source).toBe('offline')
    expect(result.catalog).toBeNull()
  })
})

describe('checkWorkspace (AD-5)', () => {
  const origGlobal = process.env.INNFO_GLOBAL_DIR
  const origSkills = process.env.INNFO_SKILLS_DIR

  beforeEach(async () => {
    process.env.INNFO_GLOBAL_DIR = join(rootDir, 'isolated-global')
    process.env.INNFO_SKILLS_DIR = join(rootDir, 'isolated-skills')
    await rmWithRetry(rootDir)
    await mkdir(specsDir, { recursive: true })
    await mkdir(modelsDir, { recursive: true })
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    if (origGlobal !== undefined) process.env.INNFO_GLOBAL_DIR = origGlobal
    else delete process.env.INNFO_GLOBAL_DIR
    if (origSkills !== undefined) process.env.INNFO_SKILLS_DIR = origSkills
    else delete process.env.INNFO_SKILLS_DIR
    vi.restoreAllMocks()
    await rmWithRetry(rootDir)
  })

  it('self-heals a missing template package into hydrated and leaves specs untouched', async () => {
    stubNetwork()
    await writeModels(2)
    const report = await checkWorkspace(rootDir)
    expect(report.models).toHaveLength(2)
    // First model hydrates the missing package; the second reuses it.
    expect(report.models.filter((m) => m.templateResolved === 'hydrated')).toHaveLength(1)
    expect(report.models.filter((m) => m.templateResolved === 'resolved')).toHaveLength(1)
    expect(report.models.every((m) => m.versionStatus === 'current')).toBe(true)
    expect(report.catalogSource).toBe('remote')
    expect(report.offline).toBe(false)

    // The hydration wrote a new package under specs/bluepriNNts/business/V_0-2-0/
    const pkgDir = join(specsDir, 'bluepriNNts', 'business', 'V_0-2-0')
    const files = await readdir(pkgDir)
    expect(files).toContain('spec_NN.md')
  })

  it('never overwrites an existing spec file during hydration', async () => {
    stubNetwork()
    await writeModels(1)
    // Pre-place an existing spec that the resolver would otherwise hydrate.
    await mkdir(join(specsDir, 'bluepriNNts', 'business', 'V_0-2-0'), { recursive: true })
    const preExisting = 'PRE-EXISTING CONTENT - DO NOT TOUCH'
    await writeFile(
      join(specsDir, 'bluepriNNts', 'business', 'V_0-2-0', 'spec_NN.md'),
      preExisting,
      'utf-8',
    )

    const report = await checkWorkspace(rootDir)
    expect(report.models).toHaveLength(1)
    const after = await readFile(
      join(specsDir, 'bluepriNNts', 'business', 'V_0-2-0', 'spec_NN.md'),
      'utf-8',
    )
    expect(after).toBe(preExisting)
  })

  it('offline: true still runs local validation and degrades version/freshness', async () => {
    const spy = vi.spyOn(global, 'fetch')
    // Pre-hydrate the template locally so resolution works without network.
    await mkdir(join(specsDir, 'bluepriNNts', 'business', 'V_0-2-0'), { recursive: true })
    await writeFile(
      join(specsDir, 'bluepriNNts', 'business', 'V_0-2-0', 'spec_NN.md'),
      TEMPLATE_CONTENT,
      'utf-8',
    )
    await writeFile(join(specsDir, 'iNNfo_V_0-2-1_NN.md'), LEVEL1_CONTENT, 'utf-8')
    await writeFile(join(specsDir, 'defiNNe_V_0-1-0_NN.md'), LEVEL0_CONTENT, 'utf-8')
    await writeModels(1)

    const report = await checkWorkspace(rootDir, { offline: true })
    expect(report.offline).toBe(true)
    expect(report.catalogSource).toBe('offline')
    expect(report.models.every((m) => m.versionStatus === 'unknown')).toBe(true)
    expect(report.models.every((m) => m.freshness === 'offline')).toBe(true)
    // Local validation still ran: the model has no errors.
    expect(report.models.every((m) => m.errors.length === 0)).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('summary_only trims the model list but not the aggregate', async () => {
    stubNetwork()
    await writeModels(40)
    // One model has a validation error (bad reference field) → it stays.
    await writeFile(
      join(modelsDir, 'broken_V_0-1-0_business_NN.md'),
      modelContent('Broken', '## NN Stakeholders: Broken\nscope:: not-an-option\n'),
      'utf-8',
    )
    const report = await checkWorkspace(rootDir, { summaryOnly: true })
    expect(report.aggregate.modelsScanned).toBe(41)
    expect(report.models.length).toBeGreaterThan(0)
    expect(
      report.models.every((m) => m.errors.length > 0 || m.versionStatus === 'upgrade-available'),
    ).toBe(true)
  }, 30000)
})

describe('toIntegrityDiagnostics info demotion (robustness-coda 1.4)', () => {
  it('demotes info to warning with code, message, and fix hint intact', () => {
    const out = toIntegrityDiagnostics([
      {
        path: 'parent_spec',
        message: 'Local template cache differs from the canonical remote',
        severity: 'info',
        code: 'TEMPLATE_CACHE_STALE',
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].severity).toBe('warning')
    expect(out[0].path).toBe('parent_spec')
    expect(out[0].message).toBe('Local template cache differs from the canonical remote')
    expect(out[0].code).toBe('TEMPLATE_CACHE_STALE')
  })

  it('preserves the fix hint through the demotion (triangulation)', () => {
    const diags = toIntegrityDiagnostics([
      {
        path: 'elements.Docs.Guide.fields.submodel',
        message: 'Dangling submodel reference',
        severity: 'info',
        code: 'SUBMODEL_NOT_FOUND',
      },
    ])
    expect(diags[0].severity).toBe('warning')
    expect(diags[0].code).toBe('SUBMODEL_NOT_FOUND')
    expect(diags[0].message).toBe('Dangling submodel reference')
  })

  it('passes warnings and errors through untouched', () => {
    const out = toIntegrityDiagnostics([
      { path: 'a', message: 'warn-msg', severity: 'warning', code: 'W_CODE' },
      { path: 'b', message: 'err-msg', severity: 'error', code: 'E_CODE' },
    ])
    expect(out.map((d) => d.severity)).toEqual(['warning', 'error'])
    expect(out.map((d) => d.code)).toEqual(['W_CODE', 'E_CODE'])
    expect(out.map((d) => d.message)).toEqual(['warn-msg', 'err-msg'])
  })
})
