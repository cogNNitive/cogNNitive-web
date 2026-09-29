#!/usr/bin/env node
/**
 * scripts/check-spec-version.test.mjs
 *
 * Unit tests for scripts/check-spec-version.mjs spec classification and URL integrity.
 */

import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function testSpecFilesExist() {
  const defPath = join(ROOT, 'iNNfo', 'specs', 'defiNNition_V_0-1-0_NN.md')
  const innfoPath = join(ROOT, 'iNNfo', 'specs', 'iNNfo_V_0-3-0_NN.md')

  assert.ok(existsSync(defPath), 'defiNNition_V_0-1-0_NN.md must exist on disk')
  assert.ok(existsSync(innfoPath), 'iNNfo_V_0-3-0_NN.md must exist on disk')

  const defContent = readFileSync(defPath, 'utf8')
  assert.match(defContent, /^spec_version:\s*["']V_0-1-0["']/m, 'defiNNition spec_version must be V_0-1-0')
  assert.match(defContent, /^level:\s*0/m, 'defiNNition level must be 0')

  const innfoContent = readFileSync(innfoPath, 'utf8')
  assert.match(innfoContent, /^spec_version:\s*["']V_0-3-0["']/m, 'iNNfo spec_version must be V_0-3-0')
  assert.match(innfoContent, /^level:\s*1/m, 'iNNfo level must be 1')
  assert.match(
    innfoContent,
    /^parent:\s*["']https:\/\/raw\.githubusercontent\.com\/cogNNitive\/cogNNitive\/main\/iNNfo\/specs\/defiNNition_V_0-1-0_NN\.md["']/m,
    'iNNfo V_0-3-0 parent must point to defiNNition_V_0-1-0_NN.md on main',
  )
  console.log('✔ Test 1: Level 0 defiNNition and Level 1 iNNfo V_0-3-0 spec files exist with correct frontmatter')
}

function testCheckSpecUrlsCommand() {
  const output = execFileSync(
    'node',
    [join(ROOT, 'scripts', 'check-spec-version.mjs'), '--check-urls'],
    { cwd: ROOT, encoding: 'utf8' },
  )
  assert.ok(
    output.includes('All hardcoded GitHub raw URLs point to existing files') && !output.includes('broken URL(s)'),
    `Expected clean URL check, got: ${output}`,
  )
  console.log('✔ Test 2: check-spec-version --check-urls passes cleanly')
}

function runAll() {
  testSpecFilesExist()
  testCheckSpecUrlsCommand()
  console.log('\nAll check-spec-version tests passed successfully.')
}

runAll()
