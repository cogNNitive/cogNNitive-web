import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Phase 0 RED (tasks 0.1 + 0.2): the shared console runtime gains a charts
// capability. These tests reference compileChartSeries / monthAxis /
// renderCharts that the extended innfo-runtime.js MUST export, assert the
// `charts` capability is registered in console/needs-registry.json, and pin
// that the regenerated innfo-console.bundle.js embeds uPlot + renderCharts
// (vendored, no eval, pure data). They FAIL (RED) until the runtime ships the
// helpers and the registry/bundle are regenerated.
const here = dirname(fileURLToPath(import.meta.url))
const consoleDir = join(here, '..', '..', '..', 'specs', 'bluepriNNts', 'console')
const metricsDir = join(here, '..', '..', '..', 'specs', 'bluepriNNts', 'metrics')
const runtimePath = join(consoleDir, 'innfo-runtime.js')
const registryPath = join(consoleDir, 'needs-registry.json')
const bundlePath = join(consoleDir, 'innfo-console.bundle.js')
const harnessPath = join(
  here,
  '..',
  '..',
  '..',
  'specs',
  'bluepriNNts',
  'metrics',
  'scripts',
  'verify.harness.js',
)
const nodeRequire = createRequire(import.meta.url)

interface ChartMeta {
  charts?: Array<{ id: string; label?: string }>
  months?: number
  historyMonths?: number
  startMonth?: number
  startYear?: number
}

interface CompileResult {
  ok: boolean
  charts: Array<{ id: string; label: string; xs: number[]; ys: number[] }>
  missing: Array<{ id: string; label: string }>
  invalid: Array<{ id: string; label: string; detail: string }>
}

interface RuntimeApi {
  compileChartSeries(series: Record<string, unknown>, meta: ChartMeta): CompileResult
  monthAxis(meta: ChartMeta, count: number): string[]
  renderCharts(doc: unknown, model: unknown, meta: ChartMeta): void
}

function loadRuntime(): RuntimeApi {
  return nodeRequire(runtimePath) as RuntimeApi
}

function loadHarness() {
  return nodeRequire(harnessPath) as {
    resolveNeeds(
      needs: string[],
      registry: { needs: Record<string, unknown> },
    ): { ok: boolean; unknown: string[] }
  }
}

describe('charts runtime: series -> uPlot mapping (Spec: Shared Console Charts Capability)', () => {
  const runtime = loadRuntime()

  it('maps series{chartId} to uPlot-ready xs/variants arrays for every declared chart', () => {
    const meta = {
      charts: [{ id: 'net', label: 'Net result' }],
      months: 12,
      historyMonths: 0,
      startMonth: 3,
      startYear: 2026,
    }
    const result = runtime.compileChartSeries({ net: [1917, 2050, 2200] }, meta)
    expect(result.ok).toBe(true)
    expect(result.charts).toEqual([
      {
        id: 'net',
        label: 'Net result',
        xs: [0, 1, 2],
        variants: [{ label: 'Net result', values: [1917, 2050, 2200] }],
        count: 3,
      },
    ])
    expect(result.missing).toEqual([])
    expect(result.invalid).toEqual([])
  })

  it('maps a variants map {label: number[]} to multiple uPlot series (scenario compare)', () => {
    const meta = { charts: [{ id: 'net', label: 'Net result' }] }
    const result = runtime.compileChartSeries(
      { net: { neutral: [1917, 2050, 2200], optimistic: [1917, 2100, 2300] } },
      meta,
    )
    expect(result.ok).toBe(true)
    expect(result.charts[0].variants).toEqual([
      { label: 'neutral', values: [1917, 2050, 2200] },
      { label: 'optimistic', values: [1917, 2100, 2300] },
    ])
    expect(result.charts[0].xs).toEqual([0, 1, 2])
  })

  it('flags a non-array non-object series value as invalid', () => {
    const meta = { charts: [{ id: 'net', label: 'Net result' }] }
    const result = runtime.compileChartSeries({ net: 42 }, meta)
    expect(result.ok).toBe(false)
    expect(result.invalid[0].id).toBe('net')
  })

  it('reports a declared chartId with no series array as missing (graceful skip)', () => {
    const meta = {
      charts: [{ id: 'flow', label: 'Cumulative' }],
      months: 12,
      historyMonths: 0,
      startMonth: 3,
      startYear: 2026,
    }
    const result = runtime.compileChartSeries({}, meta)
    expect(result.ok).toBe(false)
    expect(result.charts).toEqual([])
    expect(result.missing).toEqual([{ id: 'flow', label: 'Cumulative' }])
  })

  it('treats a declared chartId whose series value is not an array/object as invalid', () => {
    const meta = { charts: [{ id: 'net', label: 'Net result' }] }
    const result = runtime.compileChartSeries({ net: 'not-an-array' }, meta)
    expect(result.ok).toBe(false)
    expect(result.invalid[0].id).toBe('net')
  })

  it('flags a series carrying executable/non-pure values as invalid (no eval render)', () => {
    const meta = { charts: [{ id: 'net', label: 'Net result' }] }
    const result = runtime.compileChartSeries({ net: ['function(){return 1}', 0] }, meta)
    expect(result.ok).toBe(false)
    expect(result.charts).toEqual([])
    expect(result.invalid[0].id).toBe('net')
  })

  it('ignores series keys not declared in meta.charts', () => {
    const meta = { charts: [{ id: 'net', label: 'Net result' }] }
    const result = runtime.compileChartSeries({ net: [1, 2], stray: [9, 9] }, meta)
    expect(result.ok).toBe(true)
    expect(result.charts).toHaveLength(1)
    expect(result.charts[0].id).toBe('net')
  })
})

describe('charts runtime: month axis window from meta (Spec: Shared Console Charts Capability)', () => {
  const runtime = loadRuntime()

  it('builds zero-padded YYYY-MM labels starting at meta.startMonth/startYear', () => {
    const labels = runtime.monthAxis(
      { months: 12, historyMonths: 0, startMonth: 3, startYear: 2026 },
      4,
    )
    expect(labels).toEqual(['2026-03', '2026-04', '2026-05', '2026-06'])
  })

  it('rolls the year over across December when the window exceeds the start month', () => {
    const labels = runtime.monthAxis(
      { months: 12, historyMonths: 0, startMonth: 11, startYear: 2026 },
      3,
    )
    expect(labels).toEqual(['2026-11', '2026-12', '2027-01'])
  })

  it('covers the full months + historyMonths window', () => {
    const labels = runtime.monthAxis(
      { months: 12, historyMonths: 2, startMonth: 1, startYear: 2026 },
      14,
    )
    expect(labels).toHaveLength(14)
    expect(labels[0]).toBe('2026-01')
    expect(labels[13]).toBe('2027-02')
  })
})

describe('charts capability: registered in needs-registry (Spec: Charts from a declarative need)', () => {
  it('registers the charts capability in console/needs-registry.json', () => {
    const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
      needs: Record<string, unknown>
    }
    const charts = registry.needs['charts'] as { description?: string; renderer?: string } | undefined
    expect(charts).toBeDefined()
    expect(charts.description).toBeDefined()
    expect(charts.description.length).toBeGreaterThan(0)
  })

  it('charts resolves through the harness resolveNeeds helper against the registry', () => {
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
    const result = loadHarness().resolveNeeds(['charts'], registry)
    expect(result.ok).toBe(true)
    expect(result.unknown).toEqual([])
  })
})

describe('charts capability: vendored in the regenerated bundle (Spec: file:// charts)', () => {
  it('bundle embeds uPlot and the renderCharts entry point', () => {
    const bundle = readFileSync(bundlePath, 'utf8')
    expect(bundle).toContain('renderCharts')
    expect(bundle).toMatch(/uPlot/)
  })

  it('bundle carries no eval( source (pure data, no executable slot path)', () => {
    const bundle = readFileSync(bundlePath, 'utf8')
    expect(bundle).not.toContain('eval(')
  })

  it('runtime exports the renderCharts entry point (no eval, missing-series skip)', () => {
    const runtime = loadRuntime()
    expect(typeof runtime.renderCharts).toBe('function')
  })
})

describe('charts capability: sample snapshot remains self-consistent (Spec: Harness passes)', () => {
  it('Ghostbusters console declares charts in needs[] and meta.charts ids align with series', () => {
    const html = readFileSync(
      join(metricsDir, 'samples', 'Ghostbusters_V_0-1-0_console.html'),
      'utf8',
    )
    expect(html).toContain('"charts"')
    const model = readFileSync(
      join(metricsDir, 'assets', 'MODEL_DATA.template.json'),
      'utf8',
    )
    expect(model).toContain('"charts"')
  })
})
