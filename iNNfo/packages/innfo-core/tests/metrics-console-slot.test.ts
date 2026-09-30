import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// RED phase for task 1.1 (Series-as-Data slot contract) and task 3.1 (harness
// slot validators). These tests reference the slot-contract helpers that the
// extended verify.harness.js MUST export. They FAIL until the harness ships
// them (import of missing exports -> TypeError) and then pin the real contract.
const here = dirname(fileURLToPath(import.meta.url))
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
const metricsDir = join(here, '..', '..', '..', 'specs', 'bluepriNNts', 'metrics')
const nodeRequire = createRequire(import.meta.url)

interface SlotContractApi {
  REQUIRED_META_KEYS: string[]
  MONTHS_CAP: number
  mapMetaToInnfoModel(meta: Record<string, unknown>): { ok: boolean; missing: string[] }
  guardPureDataSeries(series: Record<string, unknown>): {
    ok: boolean
    offenders: Array<{ chart: string; detail: string }>
  }
  guardExecutablePayload(obj: unknown): {
    ok: boolean
    offenders: Array<{ path: string; detail: string }>
  }
  scanInlineRuntime(html: string): { ok: boolean; blocks: string[] }
  parseSlotsFromHtml(html: string): {
    config: Record<string, unknown> | null
    schema: Record<string, unknown> | null
    model: Record<string, unknown> | null
  }
}

function loadContract(): SlotContractApi {
  return nodeRequire(harnessPath) as SlotContractApi
}

const REQUIRED_KEYS_EXPECTED = [
  'model',
  'knowledge_version',
  'source_model',
  'generated_at',
  'months',
  'historyMonths',
  'charts',
  'slug',
  'title',
  'startMonth',
  'startYear',
]

describe('metrics slot contract: meta -> innfo-model map', () => {
  const api = loadContract()

  it('declares the exact required meta-key set from the design contract', () => {
    expect(api.REQUIRED_META_KEYS).toEqual(REQUIRED_KEYS_EXPECTED)
  })

  it('maps a complete meta object as ok with zero missing keys', () => {
    const meta = {
      model: 'kNNowledge/Ghostbusters_V_0-1-0_metrics_NN.md',
      knowledge_version: 'V_0-1-0',
      source_model: 'kNNowledge/source-figures_NN.md',
      generated_at: '2026-09-11',
      months: 12,
      historyMonths: 0,
      charts: [{ id: 'flow', label: 'Cumulative' }],
      slug: 'ghostbusters',
      title: 'Ghostbusters Containment Revenue Projection',
      startMonth: 3,
      startYear: 2026,
    }
    const result = api.mapMetaToInnfoModel(meta)
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('fails NAMING the missing key when one required meta key is absent', () => {
    const meta = {
      model: 'kNNowledge/Ghostbusters_V_0-1-0_metrics_NN.md',
      knowledge_version: 'V_0-1-0',
      source_model: 'kNNowledge/source-figures_NN.md',
      generated_at: '2026-09-11',
      months: 12,
      historyMonths: 0,
      slug: 'ghostbusters',
      title: 'Ghostbusters Containment Revenue Projection',
      startMonth: 3,
      startYear: 2026,
    }
    const result = api.mapMetaToInnfoModel(meta)
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['charts'])
  })

  it('reports every absent required key on an empty meta object', () => {
    const result = api.mapMetaToInnfoModel({})
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(REQUIRED_KEYS_EXPECTED)
  })

  it('MODEL_DATA.template.json meta already satisfies the innfo-model map', () => {
    const template = JSON.parse(
      readFileSync(join(metricsDir, 'assets', 'MODEL_DATA.template.json'), 'utf8'),
    ) as { meta: Record<string, unknown> }
    const result = api.mapMetaToInnfoModel(template.meta)
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })
})

describe('metrics slot contract: months cap', () => {
  it('caps the projected horizon at 120 months', () => {
    const api = loadContract()
    expect(api.MONTHS_CAP).toBe(120)
  })

  it('MODEL_DATA.template.json months stays within the cap', () => {
    const api = loadContract()
    const template = JSON.parse(
      readFileSync(join(metricsDir, 'assets', 'MODEL_DATA.template.json'), 'utf8'),
    ) as { meta: { months: number } }
    expect(template.meta.months).toBeGreaterThan(0)
    expect(template.meta.months).toBeLessThanOrEqual(api.MONTHS_CAP)
  })
})

describe('metrics slot contract: pure-data series guard', () => {
  const api = loadContract()

  it('accepts a series block holding only finite numbers', () => {
    const series = { net: [1917, 2050, 2200], flow: [1917, 3967, 6167] }
    expect(api.guardPureDataSeries(series).ok).toBe(true)
  })

  it('rejects a series whose values are executable JS strings, naming the chart', () => {
    const series = { net: [1917, 2050], bad: 'function () { return 1 }' }
    const result = api.guardPureDataSeries(series)
    expect(result.ok).toBe(false)
    expect(result.offenders[0].chart).toBe('bad')
  })

  it('rejects eval() smuggled into a series value', () => {
    const series = { net: ['eval("1+1")', 0] }
    const result = api.guardPureDataSeries(series)
    expect(result.ok).toBe(false)
    expect(result.offenders[0].chart).toBe('net')
  })

  it('rejects non-finite numbers and nested objects in series blocks', () => {
    const series = { net: [Number.NaN, 5], flow: { inner: [1, 2] } }
    const result = api.guardPureDataSeries(series)
    expect(result.ok).toBe(false)
    expect(result.offenders.map((o) => o.chart).sort()).toEqual(['flow', 'net'])
  })

  it('accepts null placeholders (empty months) as pure data', () => {
    const series = { net: [null, null, 123] }
    expect(api.guardPureDataSeries(series).ok).toBe(true)
  })
})

describe('metrics slot contract: executable payload guard', () => {
  const api = loadContract()

  it('accepts a plain JSON snapshot (meta + rows + series)', () => {
    const payload = {
      meta: { title: 'T' },
      rows: [{ id: 'a', label: 'A' }],
      series: { net: [1, 2] },
    }
    expect(api.guardExecutablePayload(payload).ok).toBe(true)
  })

  it('flags eval() anywhere in the payload with its path', () => {
    const payload = { rows: [{ id: 'a', formula: 'eval("x")' }] }
    const result = api.guardExecutablePayload(payload)
    expect(result.ok).toBe(false)
    expect(result.offenders[0].path).toContain('rows')
    expect(result.offenders[0].detail.toLowerCase()).toContain('eval')
  })

  it('flags arrow-function literals in slot payloads', () => {
    const payload = { series: { flow: '(m) => m * 2' } }
    const result = api.guardExecutablePayload(payload)
    expect(result.ok).toBe(false)
  })
})

describe('metrics slot contract: inline-runtime rejection', () => {
  const api = loadContract()

  it('names the offending block when a duplicated dashboard runtime is present', () => {
    const html = '<html><script>const MODEL_DATA = { meta: {} };</script></html>'
    const result = api.scanInlineRuntime(html)
    expect(result.ok).toBe(false)
    expect(result.blocks).toContain('const MODEL_DATA')
  })

  it('names the shared-runtime marker when the runtime is inlined, not loaded', () => {
    const html = '<html><script>window.InnfoConsole = factory()</script></html>'
    const result = api.scanInlineRuntime(html)
    expect(result.ok).toBe(false)
    expect(result.blocks).toContain('window.InnfoConsole =')
  })

  it('flags raw eval( blocks inside the artifact', () => {
    const html = '<html><script>const x = eval("1+1")</script></html>'
    const result = api.scanInlineRuntime(html)
    expect(result.ok).toBe(false)
    expect(result.blocks).toContain('eval(')
  })

  it('accepts a slots-only shell with static bundle tags and no runtime code', () => {
    const html =
      '<html><script type="application/json" id="innfo-config">{}</script>' +
      '<script src="./innfo-console.bundle.js"></script></html>'
    const result = api.scanInlineRuntime(html)
    expect(result.ok).toBe(true)
    expect(result.blocks).toEqual([])
  })
})

describe('metrics slot contract: slot parsing', () => {
  const api = loadContract()

  it('extracts innfo-config / innfo-schema / innfo-model JSON from a thinned console', () => {
    const html =
      '<html>' +
      '<script type="application/json" id="innfo-config">{"needs":["matrix-grids"]}</script>' +
      '<script type="application/json" id="innfo-schema">{"concepts":[]}</script>' +
      '<script type="application/json" id="innfo-model">{"meta":{"title":"T"}}</script>' +
      '</html>'
    const slots = api.parseSlotsFromHtml(html)
    expect(slots.config).not.toBe(null)
    expect(slots.schema).not.toBe(null)
    expect(slots.model).not.toBe(null)
    expect((slots.config as Record<string, string[]>).needs).toEqual(['matrix-grids'])
    expect((slots.model as Record<string, Record<string, string>>).meta.title).toBe('T')
  })

  it('returns null for corrupt slot JSON instead of crashing', () => {
    const html = '<html><script type="application/json" id="innfo-model">{not json}</script></html>'
    const slots = api.parseSlotsFromHtml(html)
    expect(slots.model).toBe(null)
  })
})

describe('metrics slot contract: MODEL_DATA.template.json series snapshot', () => {
  it('carries a pure-data series{} block', () => {
    const api = loadContract()
    const template = JSON.parse(
      readFileSync(join(metricsDir, 'assets', 'MODEL_DATA.template.json'), 'utf8'),
    ) as { series: Record<string, unknown> }
    const result = api.guardPureDataSeries(template.series)
    expect(result.ok).toBe(true)
    expect(result.offenders).toEqual([])
  })

  it('declares every series chart among meta.charts ids', () => {
    const template = JSON.parse(
      readFileSync(join(metricsDir, 'assets', 'MODEL_DATA.template.json'), 'utf8'),
    ) as { meta: { charts: Array<{ id: string }> }; series: Record<string, unknown> }
    const chartIds = template.meta.charts.map((c) => c.id)
    const seriesIds = Object.keys(template.series)
    expect(seriesIds.length).toBeGreaterThan(0)
    expect(seriesIds.every((id) => chartIds.includes(id))).toBe(true)
  })

  it('keeps an explicit growth rule on every row', () => {
    const template = JSON.parse(
      readFileSync(join(metricsDir, 'assets', 'MODEL_DATA.template.json'), 'utf8'),
    ) as { rows: Array<{ growth: { mode: string } }> }
    expect(template.rows.length).toBeGreaterThan(0)
    for (const row of template.rows) {
      expect(row.growth.mode).toMatch(/^(fixed|compound|additive)$/)
    }
  })
})

describe('metrics slot contract: generated console shape', () => {
  it('thinned timeline.html carries the shell slots and zero dashboard runtime', () => {
    const api = loadContract()
    const html = readFileSync(join(metricsDir, 'assets', 'timeline.html'), 'utf8')
    expect(html).toContain('id="innfo-config"')
    expect(html).toContain('id="innfo-schema"')
    expect(html).toContain('id="innfo-model"')
    expect(html).toContain('id="innfo-timeline-grid"')
    const scan = api.scanInlineRuntime(html)
    expect(scan.ok).toBe(true)
    expect(scan.blocks).toEqual([])
  })

  it('timeline.html declares the charts capability in needs[]', () => {
    const api = loadContract()
    const html = readFileSync(join(metricsDir, 'assets', 'timeline.html'), 'utf8')
    const slots = api.parseSlotsFromHtml(html)
    const needs = slots.config && Array.isArray(slots.config.needs) ? slots.config.needs : []
    expect(needs).toContain('charts')
  })
})
