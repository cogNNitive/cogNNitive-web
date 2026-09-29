#!/usr/bin/env node

/**
 * scripts/build-preflight-primitives.mjs
 *
 * Bundles the platform-neutral primitives from `@cognnitive/innfo-core` into
 * committed, zero-dependency CommonJS artifacts that distributed skills can `require()`.
 *
 * Targets:
 *   1. skills/nn-preflight/scripts/lib/version-status.generated.cjs (versionStatus.ts)
 *   2. skills/nn-preflight/scripts/lib/legacy-detect.generated.cjs (legacy/detect.ts)
 *   3. skills/nn-upgrade/scripts/lib/legacy-migrate.generated.cjs (legacy/index.ts)
 *
 * Usage:
 *   node scripts/build-preflight-primitives.mjs [--check]
 *
 *   --check   render all bundles and compare to committed files; exit 1 on drift.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

const BUNDLE_TARGETS = [
  {
    name: 'version-status',
    entry: path.join(
      REPO_ROOT,
      'iNNfo',
      'packages',
      'innfo-core',
      'src',
      'workspace',
      'integrity',
      'versionStatus.ts',
    ),
    out: path.join(
      REPO_ROOT,
      'skills',
      'nn-preflight',
      'scripts',
      'lib',
      'version-status.generated.cjs',
    ),
    banner:
      '/**\n' +
      ' * GENERATED FILE — DO NOT EDIT.\n' +
      ' * Source: iNNfo/packages/innfo-core/src/workspace/integrity/versionStatus.ts\n' +
      ' * Regenerate: node scripts/build-preflight-primitives.mjs\n' +
      ' * Drift-guarded by scripts/verify.js (build-preflight-primitives --check).\n' +
      ' */',
  },
  {
    name: 'legacy-detect',
    entry: path.join(
      REPO_ROOT,
      'iNNfo',
      'packages',
      'innfo-core',
      'src',
      'legacy',
      'detect.ts',
    ),
    out: path.join(
      REPO_ROOT,
      'skills',
      'nn-preflight',
      'scripts',
      'lib',
      'legacy-detect.generated.cjs',
    ),
    banner:
      '/**\n' +
      ' * GENERATED FILE — DO NOT EDIT.\n' +
      ' * Source: iNNfo/packages/innfo-core/src/legacy/detect.ts\n' +
      ' * Regenerate: node scripts/build-preflight-primitives.mjs\n' +
      ' * Drift-guarded by scripts/verify.js (build-preflight-primitives --check).\n' +
      ' */\n' +
      '// ' +
      'legacy:' +
      'nn-rename/detector',
  },
  {
    name: 'legacy-migrate',
    entry: path.join(
      REPO_ROOT,
      'iNNfo',
      'packages',
      'innfo-core',
      'src',
      'legacy',
      'index.ts',
    ),
    out: path.join(
      REPO_ROOT,
      'skills',
      'nn-upgrade',
      'scripts',
      'lib',
      'legacy-migrate.generated.cjs',
    ),
    banner:
      '/**\n' +
      ' * GENERATED FILE — DO NOT EDIT.\n' +
      ' * Source: iNNfo/packages/innfo-core/src/legacy/index.ts\n' +
      ' * Regenerate: node scripts/build-preflight-primitives.mjs\n' +
      ' * Drift-guarded by scripts/verify.js (build-preflight-primitives --check).\n' +
      ' */\n' +
      '// ' +
      'legacy:' +
      'nn-rename/quarantine',
  },
]

/** Resolve esbuild from the hoisted iNNfo workspace (root has no node_modules). */
function loadEsbuild() {
  for (const base of [path.join(REPO_ROOT, 'iNNfo'), REPO_ROOT]) {
    try {
      return require(require.resolve('esbuild', { paths: [base] }))
    } catch {
      // try the next base
    }
  }
  throw new Error(
    'esbuild not found. Run `npm ci` in iNNfo/ so the hoisted esbuild/tsup dependency is available.',
  )
}

async function renderTarget(target) {
  const esbuild = loadEsbuild()
  const result = await esbuild.build({
    entryPoints: [target.entry],
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    target: 'node20',
    write: false,
    legalComments: 'none',
    banner: { js: target.banner },
  })
  return result.outputFiles[0].text.replace(/\r\n/g, '\n')
}

async function main() {
  const check = process.argv.includes('--check')
  let driftCount = 0

  for (const target of BUNDLE_TARGETS) {
    const rel = path.relative(REPO_ROOT, target.out) || target.out
    const rendered = await renderTarget(target)

    if (check) {
      const committed = fs.existsSync(target.out)
        ? fs.readFileSync(target.out, 'utf-8').replace(/\r\n/g, '\n')
        : null
      if (rendered !== committed) {
        console.error(
          `build-preflight-primitives: DRIFT — ${rel} is stale. Re-run without --check.`,
        )
        driftCount++
      } else {
        console.log(`build-preflight-primitives: OK — ${rel} is up to date.`)
      }
    } else {
      fs.mkdirSync(path.dirname(target.out), { recursive: true })
      fs.writeFileSync(target.out, rendered, 'utf-8')
      console.log(`build-preflight-primitives: wrote ${rel}.`)
    }
  }

  if (check && driftCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err)
  process.exit(2)
})
