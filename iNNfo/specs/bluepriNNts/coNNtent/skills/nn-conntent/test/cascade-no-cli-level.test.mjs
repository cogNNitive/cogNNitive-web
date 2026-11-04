#!/usr/bin/env node

/**
 * nn-conntent/test/cascade-no-cli-level.test.mjs
 *
 * Slice 4 tail: the blueprint's Universal Parameter Cascade has no `cli` level.
 * No command-line flag supplies a cascade parameter, so the resolver ignores a
 * `cli` bag and every retired model flag is refused instead of overriding a
 * document.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { SCOPE_ORDER, bagsToChain, resolve } from '../scripts/lib/video-scope.mjs';

const SCRIPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
const RETIRED_FLAGS = ['--image-model', '--tts-model', '--avatar-model'];

test('SCOPE_ORDER names no cli level', () => {
  assert.deepEqual(SCOPE_ORDER, ['layer', 'scene', 'video', 'kind', 'series', 'domain', 'blueprint']);
});

test('a cli bag supplies nothing: the nearest document wins', () => {
  const bags = { cli: { image_model: 'cli/model' }, video: { image_model: 'doc/model' } };
  assert.deepEqual(resolve('image_model', bags), { value: 'doc/model', source: 'video' });
});

test('bagsToChain drops a cli bag instead of folding it last', () => {
  const chain = bagsToChain({ cli: { image_model: 'cli/model' } });
  assert.equal(chain.nodes.some((node) => node.id === 'cli'), false);
  assert.equal(chain.nodes.length, 0);
});

test('compile refuses every retired model flag', () => {
  for (const flag of RETIRED_FLAGS) {
    const run = spawnSync(
      process.execPath,
      [path.join(SCRIPTS_DIR, 'lib', 'compile.mjs'), 'compile', 'episode_NN.md', flag, 'some/model'],
      { encoding: 'utf8' },
    );
    assert.equal(run.status, 1, flag);
    assert.ok(run.stderr.includes(`Unknown option ${flag}`), run.stderr);
  }
});

test('asset-cost-estimator refuses every retired model flag', () => {
  for (const flag of RETIRED_FLAGS) {
    const run = spawnSync(
      process.execPath,
      [path.join(SCRIPTS_DIR, 'asset-cost-estimator.mjs'), 'episode_NN.md', flag, 'some/model'],
      { encoding: 'utf8' },
    );
    assert.equal(run.status, 1, flag);
    assert.ok(run.stderr.includes(`Unknown option ${flag}`), run.stderr);
  }
});
