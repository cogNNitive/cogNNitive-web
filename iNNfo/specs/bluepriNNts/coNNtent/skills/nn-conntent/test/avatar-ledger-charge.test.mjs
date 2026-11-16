/**
 * nn-conntent/test/avatar-ledger-charge.test.mjs
 *
 * A completed avatar job must be visible as spend (#690). The provider charges the
 * avatar model per billed second (ceil of the measured audio), so the settled ledger
 * line carries that charge; it is never written as $0. The rolling 24h window and the
 * produce-side daily ceiling both read the same append-only ledger, so a settled job
 * has to raise their total exactly once.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DEFAULT_GUARD, SpendGuard, readLedger, sumLedgerSince } from '../scripts/lib/video-guard.mjs';
import { sumLedgerSpend } from '../scripts/lib/facts.mjs';
import { estimateCallUsd } from '../scripts/asset-cost-estimator.mjs';

const AVATAR = 'wavespeed-ai/infinitetalk-fast';
const DAY_MS = 24 * 3600 * 1000;

function workspace() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-charge-')));
}

function guardFor(root, overrides = {}) {
  const config = {
    ...DEFAULT_GUARD,
    budgetPerRunUsd: 10,
    dailyCapUsd: 100,
    allowedModels: [AVATAR],
    blockedModels: [],
    ...overrides,
  };
  return new SpendGuard({ config, root, approval: () => ({ ok: true }) });
}

/** The charge the provider really bills: ceil(seconds) x the model per-second price. */
function chargedUsd(seconds) {
  return estimateCallUsd('avatar', AVATAR, { seconds });
}

test('the price of a 3.4s avatar clip is 4 billed seconds, not 3.4', () => {
  const price = chargedUsd(3.4);
  assert.equal(price, Math.round(4 * (price / 4) * 1e6) / 1e6, 'price is a whole number of billed seconds');
  assert.ok(price > 0, 'the catalog prices this model per second');
});

test('a completed avatar job settles with the charged amount, never $0', async () => {
  const root = workspace();
  try {
    const guard = guardFor(root);
    const est = chargedUsd(3.4);
    const ticket = await guard.authorize({ kind: 'avatar', model: AVATAR, estUsd: est, ref: 'scene_1/avatar' });
    ticket.settle('ok');

    const settled = readLedger(root).filter((row) => row.outcome === 'ok');
    assert.equal(settled.length, 1, 'one settled line');
    assert.equal(settled[0].estUsd, est, 'the settled line carries the charge');
    assert.ok(settled[0].estUsd > 0, 'a completed avatar job is never recorded as free');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a completed avatar job raises the rolling 24h total exactly once', async () => {
  const root = workspace();
  try {
    const before = sumLedgerSince(root, Date.now() - DAY_MS);
    assert.equal(before, 0, 'a fresh workspace has spent nothing');

    const guard = guardFor(root);
    const est = chargedUsd(3.4);
    const ticket = await guard.authorize({ kind: 'avatar', model: AVATAR, estUsd: est, ref: 'scene_1/avatar' });
    ticket.settle('ok');

    const after = sumLedgerSince(root, Date.now() - DAY_MS);
    assert.equal(after, est, 'the total grew by the charge, with no double count');
    assert.ok(after > before, 'the rolling total increased');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the produce-side ceiling reader sees the same charge from the same ledger', async () => {
  const root = workspace();
  try {
    const guard = guardFor(root);
    const est = chargedUsd(5.2);
    const ticket = await guard.authorize({ kind: 'avatar', model: AVATAR, estUsd: est, ref: 'scene_2/avatar' });
    ticket.settle('ok');

    // Both ceilings (the guard's rolling cap and produce's daily_budget check) must
    // read one ledger through one reducer; when each summed its own field name the
    // produce side read zero for every avatar charge.
    assert.equal(sumLedgerSpend(root, Date.now() - DAY_MS), est, 'produce-side ceiling reader');
    assert.equal(sumLedgerSince(root, Date.now() - DAY_MS), est, 'guard-side rolling cap');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a job that failed before any task was created nets to zero', async () => {
  const root = workspace();
  try {
    const guard = guardFor(root);
    const est = chargedUsd(3.4);
    const ticket = await guard.authorize({ kind: 'avatar', model: AVATAR, estUsd: est, ref: 'scene_1/avatar' });
    ticket.settle('failed', 'not submitted', { refundUsd: est });

    assert.equal(sumLedgerSince(root, Date.now() - DAY_MS), 0, 'nothing was billed, nothing is counted');
    assert.equal(sumLedgerSpend(root, Date.now() - DAY_MS), 0, 'the daily ceiling also nets it out');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
