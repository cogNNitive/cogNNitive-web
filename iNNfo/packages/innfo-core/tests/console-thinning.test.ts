import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const templatesDir = join(here, '..', '..', '..', 'specs', 'templates')
const repoRoot = join(here, '..', '..', '..', '..')

const assets = {
  viewer: join(templatesDir, 'business', 'assets', 'model_viewer.html'),
  timeline: join(templatesDir, 'metrics', 'assets', 'timeline.html'),
  console: join(templatesDir, 'workspace', 'assets', 'model_console.html'),
}

// Markers that would indicate a duplicated inline copy of the shared runtime.
// Static <script src="...innfo-runtime.js"> tags are REQUIRED (not markers).
const INLINE_RUNTIME_MARKERS = [
  'INNFO_RUNTIME_INLINE',
  'innfo-runtime-inline',
  'window.InnfoConsole=',
  'window.InnfoConsole =',
]

function readAsset(path: string): string {
  return readFileSync(path, 'utf8')
}

describe.each([
  ['viewer', assets.viewer],
  ['timeline', assets.timeline],
  ['console', assets.console],
])('%s console asset', (_name, path) => {
  it('declares an innfo-config block with a needs[] capability list', () => {
    const html = readAsset(path)
    expect(html).toContain('id="innfo-config"')
    const match = html.match(/<script[^>]*id="innfo-config"[^>]*>([\s\S]*?)<\/script>/)
    expect(match).not.toBe(null)
    const config = JSON.parse((match as RegExpMatchArray)[1]) as { needs: string[] }
    expect(Array.isArray(config.needs)).toBe(true)
    expect(config.needs.length).toBeGreaterThan(0)
  })

  it('loads a shared runtime via static script tags', () => {
    const html = readAsset(path)
    expect(html).toMatch(/innfo-(runtime|console\.bundle)\.js/)
    expect(html).not.toContain('type="module"')
  })

  it('ships no duplicated inline runtime block', () => {
    const html = readAsset(path)
    for (const marker of INLINE_RUNTIME_MARKERS) {
      expect(html).not.toContain(marker)
    }
  })
})

describe('viewer slot payloads', () => {
  it('keeps the #innfo-schema and #innfo-model slots', () => {
    const html = readAsset(assets.viewer)
    expect(html).toContain('id="innfo-schema"')
    expect(html).toContain('id="innfo-model"')
  })

  it('stays byte-unchanged by the console-citation-icons change (C2-C4 create a workspace-level copy instead)', () => {
    const tracked = execFileSync(
      'git',
      ['show', 'HEAD:iNNfo/specs/bluepriNNts/business/assets/model_viewer.html'],
      { cwd: repoRoot, encoding: 'utf8' },
    )
    const onDisk = readAsset(assets.viewer)
    expect(onDisk).toBe(tracked)
  })
})

// The workspace-level console asset is the citation-aware sibling of the
// business viewer shell: same renderer contract, plus the native citation
// dialog and icon colour rules, plus the shared bundle (not the split
// innfo-runtime.js/render-model-viewer.js tags the business shell still
// uses).
describe('console (workspace) slot payloads', () => {
  it('keeps the #innfo-schema and #innfo-model slots', () => {
    const html = readAsset(assets.console)
    expect(html).toContain('id="innfo-schema"')
    expect(html).toContain('id="innfo-model"')
  })

  it('boots the shared console bundle (not the legacy split runtime/renderer tags)', () => {
    const html = readAsset(assets.console)
    expect(html).toContain('innfo-console.bundle.js')
    expect(html).not.toContain('innfo-runtime.js')
    expect(html).not.toContain('render-model-viewer.js')
  })

  it('declares the native citation dialog and its colour-rule hooks', () => {
    const html = readAsset(assets.console)
    expect(html).toContain('id="innfo-citation-dialog"')
    expect(html).toContain('aria-label="Citation details"')
    for (const cls of ['.cite-icon.cite-agent', '.cite-icon.cite-human', '.cite-icon.cite-reviewer', '.cite-icon.cite-document', '.cite-icon.cite-error']) {
      expect(html).toContain(cls)
    }
  })

  it('widens the innfo-ref-dialog CSS selectors to also cover innfo-citation-dialog', () => {
    const html = readAsset(assets.console)
    expect(html).toContain('#innfo-ref-dialog, #innfo-citation-dialog')
  })
})

// The timeline asset is a template blue-print shell: it declares the shared
// console bundle (innfo-console.bundle.js), NOT the legacy innfo-runtime.js,
// and carries the two shell JSON slots. Inline dashboard engine markers
// (MODEL_DATA/FORMULAS/DEPS/SERIES/SEASON as code) must not survive.
describe('timeline slot payloads', () => {
  it('boots the shared console bundle (not the legacy innfo-runtime.js)', () => {
    const html = readAsset(assets.timeline)
    expect(html).toContain('innfo-console.bundle.js')
    expect(html).not.toContain('innfo-runtime.js')
  })

  it('keeps the innfo-schema and innfo-model shell slots', () => {
    const html = readAsset(assets.timeline)
    expect(html).toContain('id="innfo-schema"')
    expect(html).toContain('id="innfo-model"')
  })

  it('ships no inline dashboard engine blocks', () => {
    const html = readAsset(assets.timeline)
    for (const marker of [
      'const MODEL_DATA',
      'const FORMULAS',
      'const DEPS',
      'const SERIES',
      'const SEASON',
      'new uPlot',
    ]) {
      expect(html).not.toContain(marker)
    }
  })
})
