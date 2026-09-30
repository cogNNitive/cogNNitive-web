import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, '..')
const distIndex = join(packageRoot, 'dist', 'index.js')

/**
 * Regression test for the Node ESM "unspecified module specifier" defect:
 * `tsc` with `moduleResolution: "bundler"` used to emit extensionless
 * relative imports (e.g. `export * from './types'`), which plain Node ESM
 * refuses to resolve — especially when both `dist/types.js` and
 * `dist/types/` exist on disk (ERR_UNSUPPORTED_DIR_IMPORT).
 *
 * This MUST run the built `dist/` output in a real, separate Node process —
 * never through Vitest's own module resolver. Vitest (like Vite and tsup)
 * is itself a bundler and silently tolerates extensionless specifiers,
 * which is exactly what hid this defect from every existing test suite.
 */
describe('Node ESM consumability (built dist/, real Node process)', () => {
  it('dist/ has been built', () => {
    expect(existsSync(distIndex)).toBe(true)
  })

  it('imports under plain Node ESM and exposes the documented public API', () => {
    const distIndexUrl = pathToFileURL(distIndex).href
    const script = `
      import('${distIndexUrl}')
        .then((m) => {
          const required = ['parseKnowledge', 'serializeKnowledge', 'applyMutation', 'validateDocument']
          const missing = required.filter((name) => typeof m[name] !== 'function')
          if (missing.length > 0) {
            console.error('MISSING:' + missing.join(','))
            process.exit(1)
          }
          console.log('OK')
        })
        .catch((err) => {
          console.error('IMPORT_FAILED:' + (err && err.code) + ':' + (err && err.message))
          process.exit(1)
        })
    `

    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
    })

    expect(output.trim()).toBe('OK')
  })
})
