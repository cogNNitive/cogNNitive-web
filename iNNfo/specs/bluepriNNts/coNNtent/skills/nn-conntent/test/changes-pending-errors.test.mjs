/**
 * nn-conntent/test/changes-pending-errors.test.mjs
 *
 * #606 defect 4, real engine: `applyPendingHumanChangesets` carries the engine's
 * rejection errors, so `produce` intake can print the real code and message instead of
 * only `(rejected)`. An accepted changeset carries an empty error list.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { applyPendingHumanChangesets } from '../scripts/lib/changes.mjs';

const HASH = 'a'.repeat(64);

// A review verdict signed by the console's placeholder name names nobody: the engine
// rejects it with GATE_REVIEWER_REQUIRED.
const changeset = (reviewer) => `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: changes
  url: "https://example.invalid/changes/spec_NN.md"
blueprint_version: "0.1.0"
status: proposed
title: "Console review"
author: "${reviewer}"
author_kind: human
origin: console
reviewer: "${reviewer}"
---

# NN index

* [[Change]]

# NN Change

## NN Change: fb-001
op:: review_gate
target:: s/e@one
gate:: script
verdict:: approved
reviewed_hash:: ${HASH}
`;

function workspace(reviewer) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-pending-errors-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '---\nname: "Probe"\n---\n\n# NN DomaiNN\n', 'utf8');
  fs.mkdirSync(path.join(root, 'changes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'changes', 'probe_ana_1_changes_NN.md'), changeset(reviewer), 'utf8');
  return root;
}

test('a rejected pending human changeset carries the engine error code and message', async () => {
  const root = workspace('reviewer');
  try {
    const [outcome] = await applyPendingHumanChangesets(root);
    assert.equal(outcome.success, false);
    assert.ok(Array.isArray(outcome.errors) && outcome.errors.length > 0, 'the errors reach the caller');
    assert.equal(outcome.errors[0].code, 'GATE_REVIEWER_REQUIRED');
    assert.match(String(outcome.errors[0].message), /must name a reviewer/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
