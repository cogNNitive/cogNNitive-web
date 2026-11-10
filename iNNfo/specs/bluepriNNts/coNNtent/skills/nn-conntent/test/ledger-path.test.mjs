/**
 * nn-conntent/test/ledger-path.test.mjs
 *
 * ONE ledger: `.cognnitive/video/ledger.jsonl`, written and read through the same
 * constant. The legacy `.cognnitive/video-ledger.jsonl` path is rejected by
 * `assertLayout`. (capability conntent-folder-contract "One Plan And One Ledger
 * Location"; conntent-run-facts "Single ledger"; task 1c.3 — RED.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { assertLayout } from '../scripts/lib/layout.mjs';
import { ledgerPath, appendLedgerRow, readLedgerRows } from '../scripts/lib/facts.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('the writer and the reader agree on one ledger path', () => {
  const root = tmp('ledger-');
  const p = ledgerPath(root);
  assert.equal(p, path.join(root, '.cognnitive', 'video', 'ledger.jsonl'));
  appendLedgerRow(root, { ts: 1, kind: 'tts', model: 'm', estUsd: 0.25 });
  appendLedgerRow(root, { ts: 2, kind: 'tts', model: 'm', estUsd: 0.5 });
  const rows = readLedgerRows(root);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].estUsd, 0.5);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the legacy video-ledger.jsonl is rejected by assertLayout', () => {
  const root = tmp('ledger-legacy-');
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  fs.mkdirSync(path.join(root, '.cognnitive'), { recursive: true });
  fs.writeFileSync(path.join(root, '.cognnitive', 'video-ledger.jsonl'), '{}', 'utf8');
  const hit = assertLayout(root).find((f) => /video-ledger\.jsonl/.test(f.path));
  assert.ok(hit, 'expected a legacy-layout finding for video-ledger.jsonl');
  assert.match(hit.message, /video\/ledger\.jsonl/);
  fs.rmSync(root, { recursive: true, force: true });
});