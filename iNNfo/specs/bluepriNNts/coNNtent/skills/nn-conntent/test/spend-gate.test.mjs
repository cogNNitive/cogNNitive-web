/**
 * nn-conntent/test/spend-gate.test.mjs
 *
 * Spend authorization is one mechanism (capability conntent-review-gates "Spend
 * authorization is one mechanism"; design D-P1, D-P7; tasks 3b-2.3/3b-2.4).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { budgetGateTarget, spendPlan } from '../scripts/lib/spend-gate.mjs';

const H = 'a'.repeat(64);

test('an unset budget stops with exit 11 only when the plan costs something', () => {
  const unset = spendPlan({ reviewGates: ['script', 'preview'], total: 1.2, budget: null, planHash: H });
  assert.equal(unset.stop.code, 'budget-unset');
  assert.equal(unset.stop.exitCode, 11);
  assert.match(unset.stop.message, /budget/);

  const cached = spendPlan({ reviewGates: [], total: 0, budget: null, planHash: H });
  assert.equal(cached.stop, null);
  assert.equal(cached.budgetGate, false);
});

test('within budget needs no gate and no approval', () => {
  for (const reviewGates of [[], ['script', 'preview'], ['script']]) {
    const plan = spendPlan({ reviewGates, total: 1.2, budget: 2, prePreviewSubtotal: 0.5, planHash: H });
    assert.equal(plan.stop, null);
    assert.equal(plan.budgetGate, false, JSON.stringify(reviewGates));
  }
});

test('preview off and over budget inserts exactly one budget gate', () => {
  const plan = spendPlan({ reviewGates: [], total: 3, budget: 2, prePreviewSubtotal: 1, planHash: H });
  assert.equal(plan.budgetGate, true);
  assert.equal(plan.stop, null);
});

test('preview on and over budget asks at preview, not at budget', () => {
  const plan = spendPlan({ reviewGates: ['script', 'preview'], total: 3, budget: 2, prePreviewSubtotal: 0.5, planHash: H });
  assert.equal(plan.budgetGate, false);
  assert.equal(plan.stop, null);
});

test('preview on but the pre-preview subtotal alone is over budget inserts the budget gate first (Q1)', () => {
  const plan = spendPlan({ reviewGates: ['script', 'preview'], total: 3, budget: 2, prePreviewSubtotal: 2.5, planHash: H });
  assert.equal(plan.budgetGate, true);
});

test('the budget gate carries the episode plan hash as both hashes', () => {
  assert.deepEqual(budgetGateTarget({ modelId: 'serie/ep', planHash: H }), {
    gate: 'budget',
    scene: null,
    currentHash: H,
    planHash: H,
    modelId: 'serie/ep',
  });
});
