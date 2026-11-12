/**
 * nn-conntent/test/intake-rejection-reason.test.mjs
 *
 * #606 defect 4: `produce` applies the pending human console changesets first; a
 * rejected one used to print only `intake: applied pending <file> (rejected)`, so the
 * author retried blind. The intake now prints the rejection code and message of every
 * error the engine reported, and an applied changeset still prints its one line.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { produce } from '../scripts/produce.mjs';

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-intake-reason-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '---\nname: "Probe"\n---\n\n# NN DomaiNN\n', 'utf8');
  const episode = path.join(root, 'series', 's', 'episodes', 'e');
  fs.mkdirSync(episode, { recursive: true });
  const scriptPath = path.join(episode, 'e_coNNtent_NN.md');
  // Not producible on purpose: the run stops right after the intake lines we read.
  fs.writeFileSync(scriptPath, '---\nlevel: 3\ntitle: "E"\n---\n\n# NN Video\n', 'utf8');
  return { root, scriptPath };
}

async function intakeLines(outcomes) {
  const ws = workspace();
  const lines = [];
  try {
    await produce({
      episodePath: ws.scriptPath,
      noOpen: true,
      deps: {
        applyPending: async () => outcomes,
        writeConsole: async () => ({ status: 'unchanged', path: 'x' }),
        log: (line) => lines.push(String(line)),
      },
    }).catch(() => {});
  } finally {
    fs.rmSync(ws.root, { recursive: true, force: true });
  }
  return lines.filter((line) => line.startsWith('intake:'));
}

test('a rejected pending changeset prints the code and message of each engine error', async () => {
  const lines = await intakeLines([
    {
      changeset: 'e_ana_1_changes_NN.md',
      success: false,
      status: 'rejected',
      errors: [
        {
          path: 's/e@one',
          code: 'GATE_REVIEWER_REQUIRED',
          message: 'a changeset with a review_gate must name a reviewer',
        },
        {
          path: 'e_coNNtent@two',
          code: 'MODEL_ADDRESSED_BY_STEM',
          message: '"e_coNNtent" is a filename stem, not a model id; address "s/e" instead',
        },
      ],
    },
  ]);
  const text = lines.join('\n');
  assert.match(text, /intake: applied pending e_ana_1_changes_NN\.md \(rejected\)/);
  assert.match(text, /GATE_REVIEWER_REQUIRED: a changeset with a review_gate must name a reviewer/);
  assert.match(text, /MODEL_ADDRESSED_BY_STEM: "e_coNNtent" is a filename stem/);
});

test('a rejection without a reported error still says so instead of printing nothing', async () => {
  const lines = await intakeLines([
    { changeset: 'x_changes_NN.md', success: false, status: 'rejected' },
  ]);
  assert.match(lines.join('\n'), /changeset-rejected: no rejection reason reached the intake/);
});

test('an applied pending changeset keeps its single intake line', async () => {
  const lines = await intakeLines([
    { changeset: 'ok_changes_NN.md', success: true, status: 'applied', errors: [] },
  ]);
  assert.deepEqual(lines, ['intake: applied pending ok_changes_NN.md (applied)']);
});

test('a real produce run prints the engine code of a rejected console changeset', async () => {
  const ws = workspace();
  fs.mkdirSync(path.join(ws.root, 'changes'), { recursive: true });
  // Signed by the console placeholder: the engine rejects it with GATE_REVIEWER_REQUIRED.
  fs.writeFileSync(
    path.join(ws.root, 'changes', 'e_reviewer_1_changes_NN.md'),
    `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: changes
  url: "https://example.invalid/changes/spec_NN.md"
blueprint_version: "0.1.0"
status: proposed
title: "Console review"
author: "reviewer"
author_kind: human
origin: console
reviewer: "reviewer"
---

# NN index

* [[Change]]

# NN Change

## NN Change: fb-001
op:: review_gate
target:: s/e@one
gate:: script
verdict:: approved
reviewed_hash:: ${'a'.repeat(64)}
`,
    'utf8',
  );
  const lines = [];
  try {
    await produce({
      episodePath: ws.scriptPath,
      noOpen: true,
      deps: {
        writeConsole: async () => ({ status: 'unchanged', path: 'x' }),
        log: (line) => lines.push(String(line)),
      },
    }).catch(() => {});
  } finally {
    fs.rmSync(ws.root, { recursive: true, force: true });
  }
  const text = lines.filter((line) => line.startsWith('intake:')).join('\n');
  assert.match(text, /intake: applied pending e_reviewer_1_changes_NN\.md \(rejected\)/);
  assert.match(text, /intake: {3}GATE_REVIEWER_REQUIRED: .*must name a reviewer/);
});
