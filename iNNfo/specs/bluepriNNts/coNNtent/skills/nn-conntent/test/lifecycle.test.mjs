/**
 * nn-conntent/test/lifecycle.test.mjs
 *
 * The episode lifecycle ends at `delivered`; `published`/`scripting`/`rendering` are
 * gone; `failed_qa` is recoverable; status follows the derived gate state (capability
 * conntent-episode-lifecycle, tasks 3b-1.6/3b-1.7).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EPISODE_STATUSES,
  assertProducible,
  reconcileStatus,
  statusNeedsWrite,
} from '../scripts/lib/episode.mjs';

const episode = (overrides = {}) => ({
  scriptPath: 'series/s/episodes/e/e_coNNtent_NN.md',
  status: 'draft',
  blueprintVersion: 'V_0-17-0',
  ...overrides,
});

const approved = (scene) => ({ scene, gate: 'script', state: 'approved' });

test('the lifecycle is exactly the seven states, with no published value', () => {
  assert.deepEqual(EPISODE_STATUSES, [
    'idea',
    'draft',
    'approved',
    'produced',
    'failed_qa',
    'delivered',
    'archived',
  ]);
  for (const retired of ['published', 'scripting', 'rendering']) {
    assert.equal(EPISODE_STATUSES.includes(retired), false, retired);
  }
});

test('every non-archived state is producible', () => {
  for (const status of ['idea', 'draft', 'approved', 'produced', 'failed_qa', 'delivered']) {
    assert.doesNotThrow(() => assertProducible(episode({ status }), 'V_0-17-0'), status);
  }
});

test('archived, an unknown state and a stale pin are refused by name', () => {
  const cases = [
    ['archived', episode({ status: 'archived' }), /archived/],
    ['published', episode({ status: 'published' }), /not an Episode status/],
    ['stale pin', episode({ blueprintVersion: 'V_0-16-0' }), /pins blueprint_version/],
  ];
  for (const [name, input, pattern] of cases) {
    assert.throws(() => assertProducible(input, 'V_0-17-0'), pattern, name);
  }
});

test('status follows the derived gate state', () => {
  const cases = [
    ['all gates approved', 'approved', [approved('s1'), approved('s2')], 'approved'],
    ['one gate open', 'approved', [approved('s1'), { scene: 's2', gate: 'script', state: 'open' }], 'draft'],
    ['needs-change', 'produced', [approved('s1'), { scene: 's2', gate: 'script', state: 'needs-change' }], 'draft'],
    ['reopened', 'delivered', [approved('s1'), { scene: 's2', gate: 'script', state: 'reopened' }], 'draft'],
    ['autopilot has no gate to satisfy', 'draft', [], 'approved'],
    ['delivered stays delivered when nothing changed', 'delivered', [approved('s1')], 'delivered'],
    ['failed_qa becomes producible again', 'failed_qa', [approved('s1')], 'approved'],
    ['archived is terminal', 'archived', [approved('s1')], 'archived'],
  ];
  for (const [name, current, gates, expected] of cases) {
    assert.equal(reconcileStatus(current, gates), expected, name);
  }
});

test('the engine writes a status only when it changes', () => {
  assert.equal(statusNeedsWrite('draft', 'draft'), false);
  assert.equal(statusNeedsWrite('draft', 'approved'), true);
});

test('the shipped blueprint offers exactly the lifecycle states', () => {
  const spec = fs.readFileSync(
    path.join(import.meta.dirname, '..', '..', '..', 'spec_NN.md'),
    'utf8',
  );
  const line = /^options:: \[(.*)\]$/m.exec(
    /## NN Field Definition: status\n(?:.*\n)*?options:: \[[^\]]*\]/.exec(spec)[0],
  );
  assert.ok(line, 'the status field declares options');
  const options = line[1].split(',').map((option) => option.trim());
  assert.deepEqual(options.sort(), [...EPISODE_STATUSES].sort());
  assert.equal(spec.includes('published_url'), false, 'published_url is retired');
});
