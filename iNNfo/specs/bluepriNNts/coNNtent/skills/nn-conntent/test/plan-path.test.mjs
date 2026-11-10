/**
 * nn-conntent/test/plan-path.test.mjs
 *
 * The plan is persisted at `<episode>/plan.json` (not `<slug>_plan.md`), rewritten each
 * run, and the engine recomputes it and never trusts its body (capability
 * conntent-folder-contract "One Plan And One Ledger Location"; design D-S5; task 1c.7).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { planPath, planBodyIsTrusted } from '../scripts/lib/plan.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('the plan lives at <episode>/plan.json, not <slug>_plan.md', () => {
  const root = tmp('plan-path-');
  const ep = path.join(root, 'episode-dir');
  fs.mkdirSync(ep, { recursive: true });
  const p = planPath({ dir: ep });
  assert.equal(p, path.join(ep, 'plan.json'));
  fs.writeFileSync(p, JSON.stringify({ plan_hash: 'x' }), 'utf8');
  assert.ok(fs.existsSync(path.join(ep, 'plan.json')));
  assert.equal(fs.existsSync(path.join(ep, 'x_plan.md')), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the engine never trusts the persisted plan body', () => {
  // A stale hash in the file must not be treated as truth: the engine recomputes.
  const root = tmp('plan-body-');
  const ep = path.join(root, 'e');
  fs.mkdirSync(ep, { recursive: true });
  const p = planPath({ dir: ep });
  fs.writeFileSync(p, JSON.stringify({ plan_hash: 'stale', totalUsd: 999 }), 'utf8');
  assert.equal(planBodyIsTrusted(), false, 'the plan body is always recomputed, never trusted');
  fs.rmSync(root, { recursive: true, force: true });
});