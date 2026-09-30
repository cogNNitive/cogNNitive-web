#!/usr/bin/env node

/**
 * scripts/build-preflight-primitives.test.mjs
 *
 * Unit tests for scripts/build-preflight-primitives.mjs (plain node, matches the
 * repo's zero-framework .test convention).
 */

import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const BUILDER = path.join(SCRIPT_DIR, 'build-preflight-primitives.mjs')

const COMMITTED_TARGETS = [
  path.join(SCRIPT_DIR, '..', 'skills', 'nn-preflight', 'scripts', 'lib', 'version-status.generated.cjs'),
  path.join(SCRIPT_DIR, '..', 'skills', 'nn-preflight', 'scripts', 'lib', 'legacy-detect.generated.cjs'),
  path.join(SCRIPT_DIR, '..', 'skills', 'nn-upgrade', 'scripts', 'lib', 'legacy-migrate.generated.cjs'),
]

function run(args) {
  return spawnSync(process.execPath, [BUILDER, ...args], { encoding: 'utf-8' })
}

async function runTests() {
  console.log('Running build-preflight-primitives unit tests...')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-primitives-'))
  try {
    // Test 1: render mode writes all requireable CJS bundles
    {
      const res = run([])
      assert.strictEqual(res.status, 0, res.stderr)
      for (const target of COMMITTED_TARGETS) {
        assert.ok(fs.existsSync(target), `bundle written: ${path.basename(target)}`)
        const mod = require(target)
        if (target.endsWith('version-status.generated.cjs')) {
          assert.strictEqual(typeof mod.classifyAgainstCatalog, 'function', 'exports classifyAgainstCatalog')
          assert.strictEqual(typeof mod.parsePinnedUrl, 'function', 'exports parsePinnedUrl')
          assert.strictEqual(typeof mod.gapKind, 'function', 'exports gapKind')
          assert.strictEqual(typeof mod.compareVersions, 'function', 'exports compareVersions')
        } else if (target.endsWith('legacy-detect.generated.cjs')) {
          assert.strictEqual(typeof mod.detectLegacy, 'function', 'exports detectLegacy')
        } else if (target.endsWith('legacy-migrate.generated.cjs')) {
          assert.strictEqual(typeof mod.detectLegacy, 'function', 'exports detectLegacy')
          assert.strictEqual(typeof mod.planMigration, 'function', 'exports planMigration')
        }
      }
      console.log('✔ render mode emits all requireable CJS bundles (version-status, legacy-detect, legacy-migrate)')
    }

    // Test 2: --check passes when all artifacts are in sync
    {
      const res = run(['--check'])
      assert.strictEqual(res.status, 0, res.stderr)
      console.log('✔ --check passes when all artifacts are in sync')
    }

    // Test 3: --check exits 1 on drift in any bundle
    {
      const targetToTamper = COMMITTED_TARGETS[1]
      const original = fs.readFileSync(targetToTamper, 'utf-8')
      try {
        fs.writeFileSync(targetToTamper, original + '\n// tampered\n')
        const res = run(['--check'])
        assert.strictEqual(res.status, 1, '--check must exit 1 on a stale artifact')
        assert.ok(res.stderr.includes('DRIFT'), 'drift report present')
        console.log('✔ --check exits 1 with a drift report on a stale artifact')
      } finally {
        fs.writeFileSync(targetToTamper, original)
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  console.log('All build-preflight-primitives tests passed successfully!\n')
}

runTests().catch((err) => {
  console.error('Test failure:', err)
  process.exit(1)
})
