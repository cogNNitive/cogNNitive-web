/**
 * nn-conntent/test/produce-allow-model.test.mjs
 *
 * The guard and the avatar stage tell the reader to "pass `--allow-model <name>` for this
 * run", and `produce` — the command that actually runs the pipeline — rejected that flag with
 * its usage text and exit 1. Advice that the entry point refuses is a dead end.
 *
 * `produce` now parses `--allow-model` (repeatable, also `--allow-model=<id>`) and forwards it
 * to the estimate, the avatar stage and the render, which are the stages that mention it.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

import { parseFlags } from '../scripts/produce.mjs'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('produce parses --allow-model both as a separate value and with =', () => {
  assert.deepEqual(
    parseFlags(['e', '--dry-run', '--allow-model', 'acme/talker', '--allow-model=y', '--no-open']),
    {
      _: ['e'],
      dryRun: true,
      noOpen: true,
      allowModels: ['acme/talker', 'y'],
    },
  )
})

test('produce names a missing --allow-model value instead of swallowing the next flag', () => {
  assert.throws(
    () => parseFlags(['e', '--allow-model', '--dry-run']),
    /--allow-model needs a model id/,
  )
})

test('the CLI accepts --allow-model instead of printing usage', () => {
  // No episode document: a rejected flag exits 1 with usage, an accepted one gets as far as
  // "no episode" and exits 1 with the usage text too — so assert on the flag, not the code.
  const res = spawnSync(
    process.execPath,
    [path.join(SKILL, 'scripts', 'produce.mjs'), '--allow-model', 'acme/talker'],
    {
      encoding: 'utf8',
    },
  )
  assert.doesNotMatch(res.stderr, /Unknown option --allow-model/)
})
