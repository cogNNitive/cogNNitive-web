import { describe, it, expect, beforeAll } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

// Task 3.1 + sample pilot (3.2): exercise the REAL harness CLI
// (verify.harness.js) against the generated Ghostbusters console.
//   --check-slots : static validation — needs[] resolution, required meta
//                   keys (fail-fast naming), pure-data series, zero inline
//                   runtime blocks.
//   default mode  : file:// render check — zero pageerrors + real slot render
//                   (banner, cards, matrices). Requires a discoverable
//                   Chromium (CHROME_EXE env, common install paths, or
//                   Playwright-managed browsers); skipped otherwise.
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
const samplesDir = join(here, '..', '..', '..', 'specs', 'bluepriNNts', 'metrics', 'samples')
const sampleConsole = 'Ghostbusters_V_0-1-0_console.html'

const CHROME_CANDIDATES = [
  process.env.CHROME_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)

function discoverChrome(): string | null {
  return CHROME_CANDIDATES.find((c) => existsSync(c)) ?? null
}

function runHarness(args: string[], env?: Record<string, string>) {
  const result = spawnSync(process.execPath, [harnessPath, ...args], {
    env: { ...process.env, ...(env || {}) },
  })
  return {
    status: result.status,
    stdout: result.stdout.toString('utf8'),
    stderr: result.stderr.toString('utf8'),
  }
}

describe('verify.harness.js --check-slots on the Ghostbusters console', () => {
  it('passes the thinned sample console (slot contract clean)', () => {
    const run = runHarness(['--check-slots', '--root', samplesDir, '--file', sampleConsole])
    expect(run.status).toBe(0)
    expect(run.stdout).toContain('SLOTS OK')
    expect(run.stdout).not.toContain('FAIL')
  })

  it('fails fast NAMING the missing meta key on a malformed console', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'proy-slots-'))
    const bad = join(tmp, 'bad-console.html')
    writeFileSync(
      bad,
      '<html>' +
        '<script type="application/json" id="innfo-config">{"needs":["feedback-export"]}</script>' +
        '<script type="application/json" id="innfo-schema">{}</script>' +
        '<script type="application/json" id="innfo-model">{"meta":{"title":"T"}}</script>' +
        '</html>',
      'utf8',
    )
    try {
      const run = runHarness(['--check-slots', '--root', tmp, '--file', 'bad-console.html'])
      expect(run.status).toBe(1)
      expect(run.stdout).toContain('SLOTS FAIL')
      expect(run.stdout).toContain('model')
      expect(run.stdout).toContain('missing required key')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('fails NAMING the offender when a series carries executable JS', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'proy-series-'))
    const bad = join(tmp, 'bad-series.html')
    writeFileSync(
      bad,
      '<html>' +
        '<script type="application/json" id="innfo-config">{"needs":["feedback-export"]}</script>' +
        '<script type="application/json" id="innfo-schema">{}</script>' +
        '<script type="application/json" id="innfo-model">' +
        JSON.stringify({
          meta: {
            model: 'm',
            knowledge_version: 'V_0-1-0',
            source_knowledge: 's',
            generated_at: '2026-09-11',
            months: 12,
            historyMonths: 0,
            charts: [],
            slug: 'x',
            title: 'T',
            startMonth: 3,
            startYear: 2026,
          },
          series: { net: ['eval("1+1")'] },
        }) +
        '</script></html>',
      'utf8',
    )
    try {
      const run = runHarness(['--check-slots', '--root', tmp, '--file', 'bad-series.html'])
      expect(run.status).toBe(1)
      expect(run.stdout).toContain('SLOTS FAIL')
      expect(run.stdout).toContain('net')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('rejects a console with an inlined dashboard runtime block', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'proy-inline-'))
    const bad = join(tmp, 'inline-console.html')
    writeFileSync(
      bad,
      '<html>' +
        '<script type="application/json" id="innfo-config">{"needs":["feedback-export"]}</script>' +
        '<script type="application/json" id="innfo-schema">{}</script>' +
        '<script type="application/json" id="innfo-model">{}</script>' +
        '<script>const MODEL_DATA = { meta: {} };</script>' +
        '</html>',
      'utf8',
    )
    try {
      const run = runHarness(['--check-slots', '--root', tmp, '--file', 'inline-console.html'])
      expect(run.status).toBe(1)
      expect(run.stdout).toContain('SLOTS FAIL')
      expect(run.stdout).toContain('const MODEL_DATA')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('rejects a console declaring charts but missing a series for a meta.charts id (names it)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'proy-shape-'))
    const bad = join(tmp, 'bad-shape.html')
    writeFileSync(
      bad,
      '<html>' +
        '<script type="application/json" id="innfo-config">{"needs":["charts"]}</script>' +
        '<script type="application/json" id="innfo-schema">{}</script>' +
        '<script type="application/json" id="innfo-model">' +
        JSON.stringify({
          meta: {
            model: 'm',
            knowledge_version: 'V_0-1-0',
            source_knowledge: 's',
            generated_at: '2026-09-11',
            months: 12,
            historyMonths: 0,
            charts: [{ id: 'flow', label: 'Cumulative' }],
            slug: 'x',
            title: 'T',
            startMonth: 3,
            startYear: 2026,
          },
          series: {},
        }) +
        '</script></html>',
      'utf8',
    )
    try {
      const run = runHarness(['--check-slots', '--root', tmp, '--file', 'bad-shape.html'])
      expect(run.status).toBe(1)
      expect(run.stdout).toContain('SLOTS FAIL')
      expect(run.stdout).toContain('flow')
      expect(run.stdout).toContain('without a series array')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('accepts a console declaring charts when the capability is registered in the registry', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'proy-reg-'))
    const bad = join(tmp, 'bad-reg.html')
    writeFileSync(
      bad,
      '<html>' +
        '<script type="application/json" id="innfo-config">{"needs":["charts"]}</script>' +
        '<script type="application/json" id="innfo-schema">{}</script>' +
        '<script type="application/json" id="innfo-model">' +
        JSON.stringify({
          meta: {
            model: 'm',
            knowledge_version: 'V_0-1-0',
            source_knowledge: 's',
            generated_at: '2026-09-11',
            months: 12,
            historyMonths: 0,
            charts: [{ id: 'flow', label: 'Cumulative' }],
            slug: 'x',
            title: 'T',
            startMonth: 3,
            startYear: 2026,
          },
          series: { flow: [1, 2, 3] },
        }) +
        '</script></html>',
      'utf8',
    )
    try {
      const run = runHarness(['--check-slots', '--root', tmp, '--file', 'bad-reg.html'])
      expect(run.status).toBe(0)
      expect(run.stdout).toContain('SLOTS OK')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('verify.harness.js file:// render check on the Ghostbusters console', () => {
  const chrome = discoverChrome()
  const renderable = chrome !== null
  beforeAll(() => {
    if (!renderable) {
      console.log(
        'no system Chromium/Chrome found — file:// render check SKIPPED (set CHROME_EXE or install Playwright browsers)',
      )
    }
  })

  it.skipIf(!renderable)(
    'renders the sample console over file:// with zero pageerrors and real content',
    { timeout: 180000 },
    () => {
      const env: Record<string, string> = { CHROME_EXE: chrome as string }
      const run = runHarness(['--root', samplesDir, '--file', sampleConsole], env)
      expect(run.status).toBe(0)
      expect(run.stdout).toContain('pageerrors: none')
      expect(run.stdout).toMatch(/"cards": [1-9]\d*/)
      expect(run.stdout).toMatch(/"matrices": [1-9]\d*/)
      expect(run.stdout).toMatch(/"charts": [1-9]\d*/)
      expect(run.stdout).toContain('"exportOpen": true')
    },
  )

  it.skipIf(!renderable)(
    'boots the shared bundle from the vendored copy with no inline runtime',
    { timeout: 180000 },
    () => {
      const run = runHarness(['--check-slots', '--root', samplesDir, '--file', sampleConsole])
      expect(run.stdout).toContain('SLOTS OK')
    },
  )
})
