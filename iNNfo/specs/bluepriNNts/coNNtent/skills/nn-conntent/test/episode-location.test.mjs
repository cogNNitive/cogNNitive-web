/**
 * nn-conntent/test/episode-location.test.mjs
 *
 * One layout, one identity (capability conntent-folder-contract).
 *
 * `references/folder-contract.md` declares `series/<series>/episodes/<slug>/` as the only
 * home of an episode model, and `scripts/lib/pipeline.mjs` `modelIdOf` is the one place its
 * Video instance model id is derived: every changeset `produce` writes targets
 * `<series>/<slug>`. So the derivation follows the contract wherever the episode lives, and
 * a document anywhere else — the legacy `series/<s>/assets/<slug>/`, a series root, a
 * domaiNN root — has no id at all: it is refused, never addressed by its file stem, because
 * a bare stem would silently make a second layout work.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

import { EXIT_ERROR, modelIdOf } from '../scripts/lib/pipeline.mjs'

const DOMAIN_ROOT = path.join(path.parse(process.cwd()).root, 'domain')
const docIn = (...segments) => path.join(DOMAIN_ROOT, ...segments, 'e_coNNtent_NN.md')

const CONTRACT_LOCATION_RE = /series\/<series>\/episodes\/<slug>\//

/** The refusal a misplaced episode gets, or null when it was not refused at all. */
function refusal(scriptPath) {
  try {
    modelIdOf(scriptPath)
    return null
  } catch (err) {
    return err
  }
}

test('an episode under series/<s>/episodes/<slug>/ is the instance model <s>/<slug>', () => {
  assert.equal(modelIdOf(docIn('series', 's', 'episodes', 'e')), 's/e')
})

test('a legacy series/<s>/assets/<slug>/ episode gets no id; it is refused by name', () => {
  const err = refusal(docIn('series', 's', 'assets', 'e'))
  assert.ok(err, 'the legacy assets/ layout must not derive an id')
  assert.equal(err.code, 'episode-outside-contract')
  assert.equal(err.exitCode, EXIT_ERROR)
  assert.match(err.message, CONTRACT_LOCATION_RE, 'names the contract location')
  assert.match(err.message, /assets/, 'names the legacy layout it replaced')
})

test('an episode at a series root is refused, not read by its file stem', () => {
  const err = refusal(docIn('series', 's', 'e'))
  assert.ok(err, 'a series root is not the contract location')
  assert.equal(err.code, 'episode-outside-contract')
  assert.match(err.message, /series\/<series>\/episodes\/<slug>\//)
})

test('an episode at the domaiNN root is refused, not read by its file stem', () => {
  const err = refusal(docIn('e'))
  assert.ok(err, 'the domaiNN root is not the contract location')
  assert.equal(err.code, 'episode-outside-contract')
  assert.match(err.message, /series\/<series>\/episodes\/<slug>\//)
})
