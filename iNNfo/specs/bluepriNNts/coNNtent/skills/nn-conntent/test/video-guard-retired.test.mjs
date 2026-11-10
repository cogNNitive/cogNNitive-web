/**
 * nn-conntent/test/video-guard-retired.test.mjs
 *
 * `video-guard.json` is retired: the per-run cap comes from the cascade `budget`,
 * the daily cap from `daily_budget`, blocked models via Model `allowed:: false`,
 * per-avatar limits via Model `max_seconds`/`max_concurrency`, voices from the catalog.
 * `--allow-model` is rejected, and a present `video-guard.json` is `legacy-layout`.
 * (capability conntent-model-catalog "No Spend Guard File"; D-S4; task 1c.5 — RED.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { assertLayout } from '../scripts/lib/layout.mjs';
import { SpendGuard, spendGuardFromDocuments } from '../scripts/lib/video-guard.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('a present video-guard.json is a legacy-layout finding naming model-catalog_NN.md', () => {
  const root = tmp('guard-retired-');
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  fs.writeFileSync(path.join(root, 'video-guard.json'), '{}', 'utf8');
  const hit = assertLayout(root).find((f) => /video-guard\.json/.test(f.path));
  assert.ok(hit, 'expected a legacy-layout finding');
  assert.match(hit.message, /model-catalog_NN\.md/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('SpendGuard is built from the cascade budget and the catalog, not a guard file', async () => {
  const root = tmp('guard-cascade-');
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  // Document-level budget flows through the cascade; no video-guard.json exists.
  const guard = spendGuardFromDocuments({
    root,
    budget: 2.5,
    dailyBudget: 5,
    catalog: { models: [{ slug: 'minimax/speech-2.8-hd', allowed: false }] },
  });
  assert.equal(guard.config.budgetPerRunUsd, 2.5);
  fs.rmSync(root, { recursive: true, force: true });
});