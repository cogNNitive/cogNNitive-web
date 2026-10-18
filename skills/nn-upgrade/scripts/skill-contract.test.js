#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/skill-contract.test.js
 *
 * Doc contract for SKILL.md: Flow B, --freeze-slugs and the new-domain pointer are
 * documented; the retired in-place flows and retired-path literals are not.
 */

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const SKILL = fs.readFileSync(path.join(__dirname, '..', 'SKILL.md'), 'utf8')

function run() {
  console.log('Running nn-upgrade SKILL.md contract tests...')

  for (const required of ['Flow B', '--freeze-slugs', '--import-as-source', 'new domain']) {
    assert.ok(SKILL.includes(required), `SKILL.md must describe "${required}"`)
  }
  console.log('✔ SKILL.md describes Flow B, --freeze-slugs and the new-domain pointer')

  assert.ok(
    /nn-innfo/.test(SKILL) && /MARKERS_REMOVED/.test(SKILL),
    'SKILL.md must link a marker-bearing model to the nn-innfo MARKERS_REMOVED recipe',
  )
  assert.ok(
    /Do NOT ask marker mapping questions/i.test(SKILL),
    'SKILL.md must tell the agent not to ask marker mapping questions',
  )
  console.log('✔ SKILL.md links the MARKERS_REMOVED recipe instead of asking marker mapping')

  const retiredFlows = [/Flow A/, /Flow C/, /batch-update/, /--layout-only/, /--restore/, /--migrate-references/, /Layout Migration/i]
  for (const re of retiredFlows) {
    assert.ok(!re.test(SKILL), `SKILL.md must not mention the retired ${re}`)
  }
  console.log('✔ SKILL.md names no Flow A, Flow C or in-place migration option')

  // "workspace_NN.md" is matched only as a whole file name: the procedure's own name ends with it.
  const retiredPaths = [/models\//, /specs\/templates/, /sources\/nn\//, /sources\/original\//, /(?<![A-Za-z_])workspace_NN\.md/]
  for (const re of retiredPaths) {
    assert.ok(!re.test(SKILL), `SKILL.md must not name the retired path ${re}`)
  }
  console.log('✔ SKILL.md carries no retired-path literal')

  for (const term of ['Dry run', 'planHash', 'Rehydration', 'backup']) {
    assert.ok(new RegExp(term, 'i').test(SKILL), `glossary must define "${term}"`)
  }
  console.log('✔ SKILL.md keeps the glossary (dry run, planHash, rehydration, backup)')

  console.log('All nn-upgrade SKILL.md contract tests passed successfully!\n')
}

run()
