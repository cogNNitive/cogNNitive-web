import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
  APPROVAL_FILENAME,
  checkApproval,
  computePlanHash,
  formatStamp,
  parsePlanMarkdown,
  writeApproval,
} from '../scripts/lib/plan-approval.mjs';
import { approvePlan, confirmApproval } from '../scripts/approve-plan.mjs';
import { estimateScriptCost, formatAssetPlanMarkdown } from '../scripts/asset-cost-estimator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPROVE_CLI = path.join(__dirname, '..', 'scripts', 'approve-plan.mjs');
const ESTIMATOR_CLI = path.join(__dirname, '..', 'scripts', 'asset-cost-estimator.mjs');

const script = `//ANYDEO_SPEC: V_0-3-3
# Video
- video_title: Demo

# Scenes

## Scene 1: Intro
@base Intro
Hello there, this is the narration.
- scene_duration: 3.0
`;

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'plan-approval-'));
const hash64 = 'a'.repeat(64);
const covering = { totalUsd: 0.5, allowedModels: ['minimax/speech-2.8-hd'], allowModels: [] };
const CR = String.fromCharCode(13);

describe('computePlanHash', () => {
  it('is stable across CRLF, lone CR, trailing whitespace and surrounding blank lines', () => {
    const a = computePlanHash(script, {});
    assert.equal(a, computePlanHash('\n' + script.replace(/\n/g, '  ' + CR + '\n') + '\n\n', {}));
    assert.equal(a, computePlanHash(script.replace(/\n/g, CR), {}));
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('treats NFC and NFD text as the same script (like the cache key)', () => {
    const nfc = script + 'Cancion mañana.\n';
    const nfd = nfc.normalize('NFD');
    assert.notEqual(nfc, nfd);
    assert.equal(computePlanHash(nfc, {}), computePlanHash(nfd, {}));
  });

  it('changes with the script and with chosen models, independent of key order', () => {
    assert.notEqual(computePlanHash(script, {}), computePlanHash(script + 'More.\n', {}));
    const base = computePlanHash(script, { image: 'a', tts: 'b' });
    assert.notEqual(base, computePlanHash(script, { image: 'a', tts: 'c' }));
    assert.equal(base, computePlanHash(script, { tts: 'b', image: 'a' }));
  });
});

describe('plan stamp', () => {
  it('estimator stamps hash, total and models on the first line of the plan', () => {
    const estimate = estimateScriptCost(script, {});
    const md = formatAssetPlanMarkdown(estimate);
    assert.ok(md.startsWith('<!-- plan_hash: '));
    const parsed = parsePlanMarkdown(md);
    assert.equal(parsed.planHash, estimate.planHash);
    assert.equal(parsed.totalUsd, estimate.summary.grandTotalCost);
    assert.deepEqual(parsed.models, estimate.planModels);
    assert.ok(estimate.planModels.includes('minimax/speech-2.8-hd'));
  });

  it('hashes explicitly chosen models into the plan', () => {
    const a = estimateScriptCost(script, {});
    const b = estimateScriptCost(script, { defaultImageModel: 'replicate/flux-pro' });
    assert.notEqual(a.planHash, b.planHash);
  });

  it('ignores plan_hash and total_usd text anywhere but the leading stamp', () => {
    const forged = '# Plan\n\nplan_hash: ' + hash64 + '\ntotal_usd: 0.01\n';
    assert.deepEqual(parsePlanMarkdown(forged), { planHash: null, totalUsd: null, models: null });
    const stamp = formatStamp({ planHash: hash64, totalUsd: 1, models: [] });
    assert.equal(parsePlanMarkdown(stamp + '\n# x\ntotal_usd: 0.0001\n').totalUsd, 1);
  });

  it('rejects a non-finite or malformed total (1.2.3, NaN, Infinity)', () => {
    for (const bad of ['1.2.3', 'NaN', 'Infinity', '-1', '1e999']) {
      const md = '<!-- plan_hash: ' + hash64 + ' total_usd: ' + bad + ' models: a/b -->\n';
      assert.equal(parsePlanMarkdown(md).totalUsd, null, bad);
    }
  });
});

describe('checkApproval', () => {
  const approvalFor = (extra = {}) => {
    const dir = tmp();
    const approvalPath = path.join(dir, APPROVAL_FILENAME);
    writeApproval(approvalPath, { planHash: computePlanHash(script, {}), ...covering, ...extra });
    return approvalPath;
  };

  it('reports missing when no approved.json exists', () => {
    const approvalPath = path.join(tmp(), APPROVAL_FILENAME);
    const res = checkApproval({ scriptContent: script, models: {}, approvalPath });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'missing');
    assert.match(res.message, /approve-plan/);
  });

  it('reports mismatch when the script changed after approval', () => {
    const res = checkApproval({ scriptContent: script + 'Edited.\n', models: {}, approvalPath: approvalFor() });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'mismatch');
  });

  it('accepts a matching approval and returns its recorded data', () => {
    const res = checkApproval({ scriptContent: script, models: {}, approvalPath: approvalFor() });
    assert.equal(res.ok, true);
    assert.equal(res.approval.totalUsd, 0.5);
    assert.deepEqual(res.approval.allowedModels, ['minimax/speech-2.8-hd']);
    assert.ok(!Number.isNaN(Date.parse(res.approval.approvedAt)));
  });

  it('treats corrupt or incomplete approval files as invalid, never as approval', () => {
    const approvalPath = path.join(tmp(), APPROVAL_FILENAME);
    const good = { plan_hash: computePlanHash(script, {}), totalUsd: 1, allowedModels: [], allowModels: [] };
    const variants = [
      'not json',
      JSON.stringify({ plan_hash: good.plan_hash }),
      JSON.stringify({ ...good, totalUsd: null }),
      JSON.stringify({ ...good, totalUsd: 'NaN' }),
      JSON.stringify({ ...good, allowedModels: 'x' }),
    ];
    for (const v of variants) {
      fs.writeFileSync(approvalPath, v);
      assert.equal(checkApproval({ scriptContent: script, models: {}, approvalPath }).ok, false, v);
    }
  });

  it('refuses a run --allow-model that the approval did not record', () => {
    const approvalPath = approvalFor({ allowModels: ['wavespeed-ai/infinitetalk'] });
    const base = { scriptContent: script, models: {}, approvalPath };
    assert.equal(checkApproval({ ...base, allowModels: ['wavespeed-ai/infinitetalk'] }).ok, true);
    const res = checkApproval({ ...base, allowModels: ['other/model'] });
    assert.equal(res.ok, false);
    assert.match(res.message, /other\/model/);
  });
});

describe('approve-plan', () => {
  const makePlan = () => {
    const dir = tmp();
    const planPath = path.join(dir, 'asset_plan.md');
    const estimate = estimateScriptCost(script, {});
    fs.writeFileSync(planPath, formatAssetPlanMarkdown(estimate));
    return { dir, planPath, estimate };
  };

  it('approvePlan writes the approval with total, approved models and allow-models', () => {
    const { dir, planPath, estimate } = makePlan();
    approvePlan(planPath, { allowModels: ['x/y'] });
    const saved = JSON.parse(fs.readFileSync(path.join(dir, APPROVAL_FILENAME), 'utf8'));
    assert.equal(saved.plan_hash, estimate.planHash);
    assert.equal(saved.totalUsd, estimate.summary.grandTotalCost);
    assert.deepEqual(saved.allowedModels, estimate.planModels);
    assert.deepEqual(saved.allowModels, ['x/y']);
  });

  it('refuses a plan without a valid stamp', () => {
    const dir = tmp();
    const planPath = path.join(dir, 'asset_plan.md');
    fs.writeFileSync(planPath, '# Old plan\nplan_hash: ' + hash64 + '\ntotal_usd: 0.01\n');
    assert.throws(() => approvePlan(planPath), /stamp/);
    assert.ok(!fs.existsSync(path.join(dir, APPROVAL_FILENAME)));
  });

  it('the CLI refuses a non-interactive stdin and has no --yes flag', () => {
    const { dir, planPath } = makePlan();
    const res = spawnSync(process.execPath, [APPROVE_CLI, planPath], { encoding: 'utf8', input: 'APPROVE\n' });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /interactive/i);
    const yes = spawnSync(process.execPath, [APPROVE_CLI, planPath, '--yes'], { encoding: 'utf8' });
    assert.notEqual(yes.status, 0);
    assert.match(yes.stderr, /Unknown option/);
    assert.ok(!fs.existsSync(path.join(dir, APPROVAL_FILENAME)));
  });

  it('confirmApproval requires the typed confirmation on a TTY', async () => {
    const run = async (typed, isTTY = true) => {
      const input = new PassThrough();
      const output = new PassThrough();
      const p = confirmApproval({ input, output, isTTY, expected: 'a1b2c3d4' });
      input.write(typed + '\n');
      return p;
    };
    assert.equal(await run('a1b2c3d4'), true);
    assert.equal(await run('yes'), false);
    assert.equal(await run('a1b2c3d4', false), false);
  });
});

describe('estimator CLI', () => {
  it('runs from a path with spaces (main detection via fileURLToPath)', () => {
    const dir = path.join(tmp(), 'dir with spaces');
    fs.mkdirSync(dir);
    const scriptPath = path.join(dir, 'script.md');
    fs.writeFileSync(scriptPath, script);
    const out = path.join(dir, 'asset_plan.md');
    const res = spawnSync(process.execPath, [ESTIMATOR_CLI, scriptPath, '--out=' + out], { encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    assert.ok(parsePlanMarkdown(fs.readFileSync(out, 'utf8')).planHash);
  });

  it('errors on a missing option value and lists every flag in its usage', () => {
    const res = spawnSync(process.execPath, [ESTIMATOR_CLI, 'x.md', '--tts-model'], { encoding: 'utf8' });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /requires a value/);
    const usage = spawnSync(process.execPath, [ESTIMATOR_CLI], { encoding: 'utf8' });
    for (const flag of ['--out', '--json', '--image-model', '--tts-model', '--avatar-model']) {
      assert.ok(usage.stderr.includes(flag), flag);
    }
  });
});
