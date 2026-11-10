/**
 * nn-conntent/test/gates.test.mjs
 *
 * Gate state is derived from applied human console verdicts and the current content
 * hash, never from a `review::` field (capability conntent-review-gates, tasks
 * 3b-1.3..3b-1.5; design D-P1, D-P2, D-P8).
 *
 * Table-driven: each case is one state transition. Reading a workspace is covered in
 * the last block with a handful of real changeset files.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  GATE_ORDER,
  countsAsVerdict,
  evaluateGate,
  gateState,
  readAppliedVerdicts,
} from '../scripts/lib/gates.mjs';

const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

/** One verdict as `readAppliedVerdicts` returns it. */
function verdict(overrides = {}) {
  return {
    scene: 's1',
    gate: 'script',
    verdict: 'approved',
    reviewedHash: H1,
    planHash: null,
    notes: null,
    reviewer: 'Ana',
    authorKind: 'human',
    origin: 'console',
    appliedAt: '2026-11-09T10:00:00.000Z',
    changeset: 'changes/ws_ana_1_changes_NN.md',
    ...overrides,
  };
}

const evaluate = (overrides = {}, gateOverrides = {}) =>
  evaluateGate({
    gate: 'script',
    scene: 's1',
    currentHash: H1,
    planHash: null,
    verdicts: [verdict(overrides)],
    ...gateOverrides,
  });

test('no counting verdict leaves the gate open: a review:: field approves nothing', () => {
  const state = evaluateGate({ gate: 'script', scene: 's1', currentHash: H1, verdicts: [] });
  assert.equal(state.state, 'open');
  assert.equal(state.reviewer, null);
});

test('a matching approval approves; a different hash reopens', () => {
  assert.equal(evaluate().state, 'approved');
  assert.equal(evaluate().reviewer, 'Ana');
  assert.equal(evaluate({}, { currentHash: H2 }).state, 'reopened');
});

test('needs-change on current content is needs-change and carries its notes', () => {
  const state = evaluate({ verdict: 'needs-change', notes: 'too long' });
  assert.equal(state.state, 'needs-change');
  assert.equal(state.notes, 'too long');
});

test('the later applied verdict supersedes an earlier one', () => {
  const verdicts = [
    verdict({ verdict: 'needs-change', notes: 'fix' }),
    verdict({ reviewedHash: H2, appliedAt: '2026-11-10T10:00:00.000Z' }),
  ];
  assert.equal(
    evaluateGate({ gate: 'script', scene: 's1', currentHash: H2, verdicts }).state,
    'approved',
  );
});

test('a verdict from an agent, an engine, another origin or the default name is ignored', () => {
  const rejected = [
    ['agent author', { authorKind: 'agent' }],
    ['engine author', { authorKind: 'engine' }],
    ['non-console origin', { origin: 'mcp' }],
    ['empty reviewer', { reviewer: '  ' }],
    ['default pseudonym', { reviewer: 'reviewer' }],
  ];
  for (const [name, overrides] of rejected) {
    const state = evaluate(overrides);
    assert.equal(state.state, 'open', name);
    assert.equal(state.ignored.length, 1, `${name} must be reported`);
  }
  assert.equal(countsAsVerdict(verdict()), true);
  assert.equal(countsAsVerdict(verdict({ authorKind: 'agent' })), false);
});

test('preview needs a plan hash and a current slice hash to approve', () => {
  const preview = (overrides = {}) =>
    evaluateGate({
      gate: 'preview',
      scene: 's1',
      currentHash: H1,
      planHash: 'p1',
      verdicts: [verdict({ gate: 'preview', planHash: 'p1', ...overrides })],
    });

  assert.equal(preview().state, 'approved');
  assert.equal(preview({ planHash: null }).state, 'open', 'missing plan_hash is ignored');
  assert.equal(preview({ planHash: null }).ignored[0].reason, 'missing-plan-hash');
  assert.equal(preview({ planHash: 'p0' }).state, 'reopened', 'a stale slice reopens');
  assert.equal(preview({ planHash: 'p0' }).cause.kind, 'plan-changed');

  // The avatar clip key is never an input, so a generated clip cannot reopen preview.
  assert.equal(preview().state, 'approved');
});

test('gateState evaluates script before budget before preview regardless of input order', () => {
  const states = gateState({
    targets: [
      { gate: 'preview', scene: 's1', currentHash: H1, planHash: 'p1' },
      { gate: 'budget', scene: null, currentHash: 'p1', planHash: 'p1' },
      { gate: 'script', scene: 's1', currentHash: H1 },
    ],
    verdicts: [],
  });
  assert.deepEqual(states.map((s) => s.gate), ['script', 'budget', 'preview']);
  assert.deepEqual(GATE_ORDER, ['script', 'budget', 'preview']);
});

/* ── Reading a workspace ─────────────────────────────────────────────────────── */

function changeset({ reviewer = 'Ana', authorKind = 'human', origin = 'console', status = 'proposed', changeStatus, target = 'acme@scene-1', hash = H1 } = {}) {
  return `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: changes
  url: "https://example.invalid/changes/spec_NN.md"
blueprint_version: "0.1.0"
status: ${status}
title: "Verdicts"
author_kind: ${authorKind}
origin: ${origin}
reviewer: ${reviewer}
---

# NN index

* [[Change]]

# NN Change

## NN Change: c-01
op:: review_gate
target:: ${target}
gate:: script
verdict:: approved
reviewed_hash:: ${hash}${changeStatus ? `\nstatus:: ${changeStatus}` : ''}
`;
}

function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-gates-'));
  fs.mkdirSync(path.join(root, 'changes'), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, 'changes', name), content, 'utf8');
  }
  return root;
}

test('readAppliedVerdicts sees applied human verdicts only, in applied order', () => {
  const root = workspace({
    'ws_ana_1_changes_NN.md': changeset({ status: 'applied' }),
    'ws_ana_2_changes_NN.md': changeset({ status: 'applied', hash: H2 }),
    'ws_agent_1_changes_NN.md': changeset({ status: 'proposed', authorKind: 'agent' }),
    'ws_ana_3_changes_NN.md': changeset({ status: 'rejected' }),
    'ws_ana_4_changes_NN.md': changeset({ status: 'partially_applied', changeStatus: 'conflict' }),
  });
  try {
    const verdicts = readAppliedVerdicts(root, 'acme');
    assert.equal(verdicts.length, 2, 'only the two applied verdicts count');
    assert.deepEqual(verdicts.map((v) => v.reviewedHash), [H1, H2], 'applied order');
    assert.equal(verdicts[0].reviewer, 'Ana');
    assert.equal(verdicts[0].authorKind, 'human');
    assert.equal(verdicts[0].origin, 'console');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a verdict for another model is not read', () => {
  const root = workspace({ 'ws_ana_1_changes_NN.md': changeset({ status: 'applied', target: 'other@scene-1' }) });
  try {
    assert.deepEqual(readAppliedVerdicts(root, 'acme'), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
