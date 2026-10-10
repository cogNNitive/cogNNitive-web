#!/usr/bin/env node

/**
 * nn-video-script/test/plan-approval.test.mjs
 *
 * In-chat (delegated) plan approval: the human replies with a phrase that MUST
 * carry the plan hash, and compile/synthesize-avatar honor it by default.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  APPROVAL_FILENAME,
  computePlanHash,
  parsePlanMarkdown,
  formatStamp,
  writeApproval,
  checkApproval,
  delegatedPhraseIsValid,
} from '../scripts/lib/plan-approval.mjs';

const SCRIPT = '# NN Video\n\n## NN Scene: One\n\nHello world.\n';

function withPlan(planHash, totalUsd, models) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-plan-approval-'));
  const planPath = path.join(dir, 'asset_plan.md');
  fs.writeFileSync(planPath, formatStamp({ planHash, totalUsd, models }) + '\n\n# Plan\n', 'utf8');
  return { dir, planPath, approvalPath: path.join(dir, APPROVAL_FILENAME) };
}

describe('delegatedPhraseIsValid', () => {
  it('requires the phrase to contain the plan hash prefix (case-insensitive)', () => {
    const hash = 'd0505d350afed2e81027172292008ba0750e6550e9c7a1f1e8db91498dbb9a5f';
    assert.equal(delegatedPhraseIsValid('approve the plan d0505d35', hash), true);
    assert.equal(delegatedPhraseIsValid('approve the plan D0505D35', hash), true);
    assert.equal(delegatedPhraseIsValid('approve the plan', hash), false);
    assert.equal(delegatedPhraseIsValid('approve the plan 00000000', hash), false);
    assert.equal(delegatedPhraseIsValid('', hash), false);
  });
});

describe('in-chat approval honored by default', () => {
  it('accepts a delegated approval when allowDelegated is true', () => {
    const hash = computePlanHash(SCRIPT, {});
    const { approvalPath, planPath } = withPlan(hash, 1.7, ['minimax/speech-2.8-hd']);
    writeApproval(approvalPath, {
      planHash: hash,
      totalUsd: 1.7,
      allowedModels: ['minimax/speech-2.8-hd'],
      delegated: true,
      delegatedPhrase: 'approve the plan ' + hash.slice(0, 8),
    });
    const res = checkApproval({ scriptContent: SCRIPT, approvalPath, allowDelegated: true });
    assert.equal(res.ok, true);
    assert.equal(res.approval.delegated, true);
    assert.equal(res.approval.delegatedPhrase, 'approve the plan ' + hash.slice(0, 8));
    assert.ok(planPath);
  });

  it('refuses a delegated approval when allowDelegated is false', () => {
    const hash = computePlanHash(SCRIPT, {});
    const { approvalPath } = withPlan(hash, 1.7, ['minimax/speech-2.8-hd']);
    writeApproval(approvalPath, {
      planHash: hash,
      totalUsd: 1.7,
      allowedModels: ['minimax/speech-2.8-hd'],
      delegated: true,
      delegatedPhrase: 'approve the plan ' + hash.slice(0, 8),
    });
    const res = checkApproval({ scriptContent: SCRIPT, approvalPath, allowDelegated: false });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'delegated-not-allowed');
  });

  it('still honors a plain (TTY) approval regardless of the delegated flag', () => {
    const hash = computePlanHash(SCRIPT, {});
    const { approvalPath } = withPlan(hash, 1.7, ['minimax/speech-2.8-hd']);
    writeApproval(approvalPath, { planHash: hash, totalUsd: 1.7, allowedModels: ['minimax/speech-2.8-hd'] });
    assert.equal(checkApproval({ scriptContent: SCRIPT, approvalPath, allowDelegated: false }).ok, true);
  });
});

describe('plan stamp round-trip', () => {
  it('parses the hash, total and models back off the first line', () => {
    const hash = computePlanHash(SCRIPT, {});
    const stamp = parsePlanMarkdown(formatStamp({ planHash: hash, totalUsd: 1.6948, models: ['a', 'b'] }));
    assert.equal(stamp.planHash, hash);
    assert.equal(stamp.totalUsd, 1.6948);
    assert.deepEqual(stamp.models, ['a', 'b']);
  });
});
