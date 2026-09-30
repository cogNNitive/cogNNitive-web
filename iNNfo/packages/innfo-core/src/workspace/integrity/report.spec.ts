import { describe, it, expect, vi } from 'vitest'
import {
  buildWorkspaceIntegrityReport,
  summarizeWorkspaceIntegrity,
  type WorkspaceIntegrityPorts,
  type WorkspaceModelRef,
  type ModelIntegrityReport,
  type TemplateResolutionResult,
  type IntegrityDiagnostic,
} from './report.js'
import type { TemplateCatalog } from './versionStatus.js'

const CANON = 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts'

const CATALOG: TemplateCatalog = {
  blueprints: {
    business: {
      name: 'business',
      adopted: 'V_0-2-0',
      versions: [{ blueprint_version: 'V_0-1-0' }, { blueprint_version: 'V_0-2-0' }],
    },
  },
}

function model(path: string, version: string | null): WorkspaceModelRef {
  return {
    path,
    id: path.replace(/\.md$/, ''),
    parentUrl: version ? `${CANON}/business/business_${version}_NN.md` : null,
    parentName: version ? 'business' : null,
  }
}

type DiagnosticMap = Map<
  string,
  { errors: IntegrityDiagnostic[]; warnings: IntegrityDiagnostic[] }
>

interface FakePortOptions {
  models?: WorkspaceModelRef[]
  diagnostics?: DiagnosticMap
  catalog?: TemplateCatalog | null
  catalogSource?: 'in-repo' | 'remote' | 'offline'
  withResolve?: boolean
  withFreshness?: boolean
  freshnessResult?: 'fresh' | 'stale' | 'unknown'
}

function fakePorts(opts: FakePortOptions = {}): WorkspaceIntegrityPorts {
  const models = opts.models ?? [
    model('models/A_V_0-2-0_business_NN.md', 'V_0-2-0'),
    model('models/B_V_0-1-0_business_NN.md', 'V_0-1-0'),
  ]
  const ports: WorkspaceIntegrityPorts = {
    discoverModels: async () => models,
    validateAll: async () =>
      opts.diagnostics ??
      new Map(models.map((m) => [m.path, { errors: [], warnings: [] }])),
    fetchCatalog: async () => ({
      catalog: opts.catalog === undefined ? CATALOG : opts.catalog,
      source: opts.catalogSource ?? (opts.catalog === null ? 'offline' : 'remote'),
    }),
  }
  if (opts.withResolve) {
    ports.resolveBlueprint = async (m): Promise<TemplateResolutionResult> => ({
      outcome: 'resolved',
      tier: 'workspace-flat',
      localContent: `bytes:${m.parentUrl}`,
    })
  }
  if (opts.withFreshness) {
    ports.checkFreshness = async () => opts.freshnessResult ?? 'fresh'
  }
  return ports
}

describe('buildWorkspaceIntegrityReport', () => {
  it('produces one per-model row per discovered model with all required fields', async () => {
    const report = await buildWorkspaceIntegrityReport(fakePorts())
    expect(report.models.map((m) => m.path)).toEqual([
      'models/A_V_0-2-0_business_NN.md',
      'models/B_V_0-1-0_business_NN.md',
    ])
    for (const row of report.models) {
      expect(row).toHaveProperty('versionStatus')
      expect(row).toHaveProperty('gap')
      expect(row).toHaveProperty('templateResolved')
      expect(row).toHaveProperty('freshness')
      expect(Array.isArray(row.errors)).toBe(true)
      expect(Array.isArray(row.warnings)).toBe(true)
    }
  })

  it('classifies each model through the shared classifier', async () => {
    const report = await buildWorkspaceIntegrityReport(fakePorts())
    const byPath = Object.fromEntries(report.models.map((m) => [m.path, m]))
    expect(byPath['models/A_V_0-2-0_business_NN.md'].versionStatus).toBe('current')
    expect(byPath['models/B_V_0-1-0_business_NN.md'].versionStatus).toBe('upgrade-available')
    expect(byPath['models/B_V_0-1-0_business_NN.md'].gap).toBe('minor')
  })

  it('reports the aggregate with per-status counts and an error count', async () => {
    const diagnostics: DiagnosticMap = new Map([
      [
        'models/A_V_0-2-0_business_NN.md',
        {
          errors: [{ path: 'models/A', message: 'boom', severity: 'error' as const }],
          warnings: [],
        },
      ],
      [
        'models/B_V_0-1-0_business_NN.md',
        {
          errors: [],
          warnings: [{ path: 'models/B', message: 'meh', severity: 'warning' as const }],
        },
      ],
    ])
    const report = await buildWorkspaceIntegrityReport(fakePorts({ diagnostics }))
    expect(report.aggregate.modelsScanned).toBe(2)
    expect(report.aggregate.invalid).toBe(1)
    expect(report.aggregate.withWarnings).toBe(1)
    expect(report.aggregate.versionStatus.current).toBe(1)
    expect(report.aggregate.versionStatus['upgrade-available']).toBe(1)
  })

  it('carries validation diagnostics unfiltered onto each per-model row', async () => {
    const diagnostics: DiagnosticMap = new Map([
      [
        'models/A_V_0-2-0_business_NN.md',
        {
          errors: [
            { path: 'models/A', message: 'broken ref to B', severity: 'error' as const },
          ],
          warnings: [],
        },
      ],
      ['models/B_V_0-1-0_business_NN.md', { errors: [], warnings: [] }],
    ])
    const report = await buildWorkspaceIntegrityReport(fakePorts({ diagnostics }))
    const a = report.models.find((m) => m.path === 'models/A_V_0-2-0_business_NN.md')!
    expect(a.errors).toHaveLength(1)
    expect((a.errors[0] as { message: string }).message).toBe('broken ref to B')
  })

  it('degrades optional ports to not-checked and records why in degraded[]', async () => {
    const report = await buildWorkspaceIntegrityReport(fakePorts())
    expect(report.models.every((m) => m.templateResolved === 'not-checked')).toBe(true)
    expect(report.models.every((m) => m.freshness === 'not-checked')).toBe(true)
    expect(report.degraded.join(' ')).toMatch(/resolution/i)
    expect(report.degraded.join(' ')).toMatch(/freshness/i)
  })

  it('uses the resolveBlueprint outcome and tier when the port is present', async () => {
    const report = await buildWorkspaceIntegrityReport(fakePorts({ withResolve: true }))
    expect(report.models.every((m) => m.templateResolved === 'resolved')).toBe(true)
    expect(report.models.every((m) => m.templateTier === 'workspace-flat')).toBe(true)
  })

  it('marks the pass offline and every model unknown when the catalog is null', async () => {
    const report = await buildWorkspaceIntegrityReport(
      fakePorts({ catalog: null, catalogSource: 'offline' }),
    )
    expect(report.offline).toBe(true)
    expect(report.catalogSource).toBe('offline')
    expect(report.models.every((m) => m.versionStatus === 'unknown')).toBe(true)
    expect(report.models.every((m) => m.gap === 'none')).toBe(true)
    expect(report.aggregate.versionStatus.unknown).toBe(2)
  })

  it('degrades freshness to offline when the catalog is null even with the freshness port', async () => {
    const report = await buildWorkspaceIntegrityReport(
      fakePorts({ catalog: null, withResolve: true, withFreshness: true }),
    )
    expect(report.models.every((m) => m.freshness === 'offline')).toBe(true)
  })

  it('never rejects when validateAll throws — it degrades instead', async () => {
    const ports = fakePorts()
    ports.validateAll = async () => {
      throw new Error('parser exploded')
    }
    const report = await buildWorkspaceIntegrityReport(ports)
    expect(report.models).toHaveLength(2)
    expect(report.models.every((m) => m.errors.length === 0)).toBe(true)
    expect(report.degraded.join(' ')).toMatch(/valid/i)
  })

  it('never rejects when fetchCatalog throws — it falls back to offline', async () => {
    const ports = fakePorts()
    ports.fetchCatalog = async () => {
      throw new Error('network down')
    }
    const report = await buildWorkspaceIntegrityReport(ports)
    expect(report.offline).toBe(true)
    expect(report.catalogSource).toBe('offline')
    expect(report.models.every((m) => m.versionStatus === 'unknown')).toBe(true)
  })

  it('never rejects when resolveBlueprint throws — that model is unresolved', async () => {
    const ports = fakePorts({ withResolve: true })
    ports.resolveBlueprint = async () => {
      throw new Error('resolver blew up')
    }
    const report = await buildWorkspaceIntegrityReport(ports)
    expect(report.models.every((m) => m.templateResolved === 'unresolved')).toBe(true)
  })

  it('never rejects when checkFreshness throws — that URL is unknown', async () => {
    const ports = fakePorts({ withResolve: true, withFreshness: true })
    ports.checkFreshness = async () => {
      throw new Error('fetch failed')
    }
    const report = await buildWorkspaceIntegrityReport(ports)
    expect(report.models.every((m) => m.freshness === 'unknown')).toBe(true)
  })

  it('deduplicates freshness fetches by template URL', async () => {
    const models = [
      model('models/A_V_0-1-0_business_NN.md', 'V_0-1-0'),
      model('models/B_V_0-1-0_business_NN.md', 'V_0-1-0'),
      model('models/C_V_0-2-0_business_NN.md', 'V_0-2-0'),
      model('models/D_V_0-2-0_business_NN.md', 'V_0-2-0'),
      model('models/E_V_0-1-0_business_NN.md', 'V_0-1-0'),
      model('models/F_V_0-2-0_business_NN.md', 'V_0-2-0'),
    ]
    const ports = fakePorts({ models, withResolve: true, withFreshness: true })
    const spy = vi.fn(async (url: string) =>
      url.includes('V_0-1-0') ? ('stale' as const) : ('fresh' as const),
    )
    ports.checkFreshness = spy
    const report = await buildWorkspaceIntegrityReport(ports)
    // 6 models, 2 distinct URLs → at most 2 fetches
    expect(spy).toHaveBeenCalledTimes(2)
    const byPath = Object.fromEntries(report.models.map((m) => [m.path, m]))
    expect(byPath['models/A_V_0-1-0_business_NN.md'].freshness).toBe('stale')
    expect(byPath['models/C_V_0-2-0_business_NN.md'].freshness).toBe('fresh')
  })

  it('caps freshness concurrency at the configured limit', async () => {
    const models = Array.from({ length: 12 }, (_, i) => ({
      path: `models/M${i}_V_0-1-0_business_NN.md`,
      parentUrl: `${CANON}/t${i}/t${i}_V_0-1-0_NN.md`,
      parentName: `t${i}`,
    }))
    const ports = fakePorts({ models, withResolve: true, withFreshness: true })
    let inFlight = 0
    let maxInFlight = 0
    ports.checkFreshness = async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 10))
      inFlight--
      return 'fresh'
    }
    await buildWorkspaceIntegrityReport(ports, { freshnessConcurrency: 3 })
    expect(maxInFlight).toBeLessThanOrEqual(3)
    expect(maxInFlight).toBeGreaterThan(1)
  })

  it('defaults freshness concurrency to 4', async () => {
    const models = Array.from({ length: 12 }, (_, i) => ({
      path: `models/M${i}_V_0-1-0_business_NN.md`,
      parentUrl: `${CANON}/t${i}/t${i}_V_0-1-0_NN.md`,
      parentName: `t${i}`,
    }))
    const ports = fakePorts({ models, withResolve: true, withFreshness: true })
    let inFlight = 0
    let maxInFlight = 0
    ports.checkFreshness = async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 10))
      inFlight--
      return 'fresh'
    }
    await buildWorkspaceIntegrityReport(ports)
    expect(maxInFlight).toBeLessThanOrEqual(4)
    expect(maxInFlight).toBeGreaterThan(1)
  })

  it('stamps generatedAt from the injected clock', async () => {
    const fixed = new Date('2026-09-07T12:00:00.000Z')
    const report = await buildWorkspaceIntegrityReport(fakePorts(), { now: () => fixed })
    expect(report.generatedAt).toBe('2026-09-07T12:00:00.000Z')
    expect(report.schemaVersion).toBe(1)
  })
})

describe('summarizeWorkspaceIntegrity', () => {
  it('is pure and re-summarises a filtered model list', () => {
    const rows: ModelIntegrityReport[] = [
      {
        path: 'a',
        template: 'business',
        pinnedVersion: 'V_0-1-0',
        adoptedVersion: 'V_0-2-0',
        versionStatus: 'upgrade-available',
        gap: 'minor',
        templateResolved: 'resolved',
        freshness: 'fresh',
        errors: [{ path: 'a', message: 'x', severity: 'error' }],
        warnings: [],
      },
      {
        path: 'b',
        template: 'business',
        pinnedVersion: 'V_0-2-0',
        adoptedVersion: 'V_0-2-0',
        versionStatus: 'current',
        gap: 'same',
        templateResolved: 'not-checked',
        freshness: 'not-checked',
        errors: [],
        warnings: [{ path: 'b', message: 'y', severity: 'warning' }],
      },
    ]
    const agg = summarizeWorkspaceIntegrity(rows)
    expect(agg.modelsScanned).toBe(2)
    expect(agg.invalid).toBe(1)
    expect(agg.withWarnings).toBe(1)
    expect(agg.versionStatus['upgrade-available']).toBe(1)
    expect(agg.versionStatus.current).toBe(1)
    expect(agg.templateResolution.resolved).toBe(1)
    expect(agg.templateResolution['not-checked']).toBe(1)
    expect(agg.freshness.fresh).toBe(1)

    // filtered re-summary
    const filtered = summarizeWorkspaceIntegrity(rows.filter((r) => r.errors.length > 0))
    expect(filtered.modelsScanned).toBe(1)
    expect(filtered.invalid).toBe(1)
  })
})
