import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const consoleDir = join(here, '..', '..', '..', 'specs', 'templates', 'console')
const blueprintPath = join(consoleDir, 'artifact_blueprint.html')
const registryPath = join(consoleDir, 'needs-registry.json')
const runtimePath = join(consoleDir, 'innfo-runtime.js')

function readBlueprint(): string {
  return readFileSync(blueprintPath, 'utf8')
}

describe('artifact_blueprint.html (console shell)', () => {
  it('exists as a standalone file:// document', () => {
    expect(existsSync(blueprintPath)).toBe(true)
    expect(readBlueprint().toLowerCase()).toContain('<!doctype html>')
  })

  it('declares exactly the innfo-config block plus innfo-schema and innfo-model slots', () => {
    const html = readBlueprint()
    expect(html).toContain('id="innfo-config"')
    expect(html).toContain('id="innfo-schema"')
    expect(html).toContain('id="innfo-model"')
    const schemaSlots = (html.match(/id="innfo-schema"/g) ?? []).length
    const modelSlots = (html.match(/id="innfo-model"/g) ?? []).length
    expect(schemaSlots).toBe(1)
    expect(modelSlots).toBe(1)
  })

  it('declares needs[] inside innfo-config', () => {
    const html = readBlueprint()
    expect(html).toContain('"needs"')
  })

  it('loads the shared runtime via static script tags (no fetch, no modules)', () => {
    const html = readBlueprint()
    expect(html).toContain('innfo-runtime.js')
    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('fetch(')
  })

  it('provides the review banner and export modal containers', () => {
    const html = readBlueprint()
    expect(html).toContain('id="innfo-banner"')
    expect(html).toContain('id="innfo-export-modal"')
  })
})

describe('needs-registry.json (capability pins)', () => {
  it('exists, is versioned, and pins the shipped bundle CDN (bundle-vs-runtime reconciliation)', () => {
    expect(existsSync(registryPath)).toBe(true)
    const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
      version: string
      runtime: { cdn: string; fallback: string; vendored: string }
      needs: Record<string, { description: string }>
    }
    expect(typeof registry.version).toBe('string')
    expect(registry.runtime.cdn).toContain('cdn.jsdelivr.net')
    // Consoles load the single-file bundle (uPlot vendored) — the registry pins
    // must match what ships beside generated consoles for offline file://.
    expect(registry.runtime.cdn).toContain('innfo-console.bundle.js')
    expect(registry.runtime.vendored).toContain('innfo-console.bundle.js')
    expect(typeof registry.runtime.fallback).toBe('string')
  })

  it('registers the feedback-export capability', () => {
    const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
      needs: Record<string, { description: string }>
    }
    expect(Object.keys(registry.needs)).toContain('feedback-export')
    expect(registry.needs['feedback-export'].description.length).toBeGreaterThan(0)
  })

  it('registers the charts capability with a renderer pin', () => {
    const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
      needs: Record<string, { description?: string; renderer?: string }>
    }
    expect(Object.keys(registry.needs)).toContain('charts')
    expect(registry.needs['charts'].description).toBeDefined()
    expect(registry.needs['charts'].renderer).toBeDefined()
  })
})

describe('innfo-runtime.js (module hygiene)', () => {
  it('ships as UMD with no fetch() and no type=module', () => {
    const source = readFileSync(runtimePath, 'utf8')
    expect(source).toContain('InnfoConsole')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('type=module')
  })
})

describe('innfo-console.bundle.js (single-file distribution)', () => {
  const bundlePath = join(consoleDir, 'innfo-console.bundle.js')

  it('exists and embeds all four console globals in order', () => {
    expect(existsSync(bundlePath)).toBe(true)
    const bundle = readFileSync(bundlePath, 'utf8')
    expect(bundle).toContain('InnfoVisuals')
    expect(bundle).toContain('InnfoConsole')
    expect(bundle).toContain('InnfoModelViewer')
    expect(bundle).toContain('InnfoProcedureStepper')
  })

  it('keeps the no-fetch / no-module hygiene of the runtime', () => {
    const bundle = readFileSync(bundlePath, 'utf8')
    expect(bundle).not.toContain('fetch(')
    expect(bundle).not.toContain('type=module')
  })

  it('matches the runtime version stamp', () => {
    // Derive the expected version from manifest/source.yaml rather than
    // hardcoding it. A literal here was a fourth copy of the console version
    // and went stale silently: the bundle stamped 0.1.0 while the manifest
    // declared 0.2.0, and this assertion agreed with the stale bundle instead
    // of catching it. Derived, it now fails on exactly that drift.
    const repoRoot = join(here, '..', '..', '..', '..')
    const sourceYaml = readFileSync(join(repoRoot, 'manifest', 'source.yaml'), 'utf8')
    const consoleBlock = sourceYaml.split(/^console_assets:/m)[1] ?? ''
    const declared = consoleBlock.match(/version:\s*"([^"]+)"/)?.[1]

    expect(declared, 'manifest/source.yaml must declare a console_assets version').toBeTruthy()

    const bundle = readFileSync(bundlePath, 'utf8')
    expect(bundle).toContain(`Version ${declared}`)
  })
})
