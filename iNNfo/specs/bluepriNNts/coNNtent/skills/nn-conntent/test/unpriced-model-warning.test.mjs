#!/usr/bin/env node

/**
 * nn-conntent/test/unpriced-model-warning.test.mjs
 *
 * Every allowed model without a catalog price emits exactly one warning at the start of a
 * run and the run continues (cognnitive-video-engine "Allowed Models Must Be Priced",
 * Slice 0 interim). `infinitetalk` stays allowed and priced, so it is silent.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  estimateScriptCost,
  findCatalogEntry,
  unpricedAllowedModels,
  warnUnpricedAllowedModels,
} from '../scripts/asset-cost-estimator.mjs';

const ALLOWED = [
  'minimax/speech-2.8-hd', // priced
  'acme/unpriced-image', // unpriced
];

test('the check lists only allowed models with no catalog price', () => {
  assert.deepEqual(unpricedAllowedModels({ allowedModels: ALLOWED }), ['acme/unpriced-image']);
  assert.deepEqual(unpricedAllowedModels({ allowedModels: ['minimax/speech-2.8-hd'] }), []);
});

test('each unpriced allowed model warns once and the list is deduplicated', () => {
  const seen = [];
  const models = warnUnpricedAllowedModels(
    { allowedModels: ['acme/unpriced-image', 'acme/unpriced-image'] },
    (msg) => seen.push(msg),
  );
  assert.deepEqual(models, ['acme/unpriced-image']);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /acme\/unpriced-image/);
});

test('the shipped avatar model is priced in the catalog, so the allowlist is silent', () => {
  const entry = findCatalogEntry('avatar', 'wavespeed-ai/infinitetalk-fast');
  assert.ok(entry, 'infinitetalk stays an allowed, priced avatar model');
  assert.equal(entry.unitPricePerSecond, 0.015);
});

const script = `---
level: 3
title: "Unpriced guard"
---

# NN Video

## NN Video: Unpriced guard
slug:: unpriced-guard
title:: Unpriced guard

# NN Scene

## NN Scene: Opening
slug:: opening

A short narration for the estimate.
`;

test('an estimate over an unpriced allowed model warns and still completes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unpriced-warning-'));
  const scriptPath = path.join(dir, 'unpriced-guard_NN.md');
  fs.writeFileSync(
    path.join(dir, 'video-guard.json'),
    JSON.stringify({ ...defaultGuard(), allowedModels: ALLOWED }),
    'utf8',
  );
  fs.writeFileSync(scriptPath, script, 'utf8');
  const seen = [];
  const original = console.warn;
  console.warn = (msg) => seen.push(String(msg));
  try {
    const result = estimateScriptCost(scriptPath, { scriptDir: dir });
    assert.ok(result, 'the estimate is produced');
  } finally {
    console.warn = original;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(seen.filter((m) => /acme\/unpriced-image/.test(m)).length, 1);
});

function defaultGuard() {
  // Shape of the default guard without importing a second copy of its values.
  return {
    version: 1,
    budgetPerRunUsd: 2,
    dailyCapUsd: 5,
    maxAvatarConcurrency: 1,
    maxAvatarSeconds: 300,
    allowedModels: ['minimax/speech-2.8-hd'],
    blockedModels: [],
    voices: {},
    systemVoices: ['Friendly_Person'],
  };
}
