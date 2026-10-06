import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileVideo } from '../scripts/video-engine-cli.mjs';
import { estimateScriptCost } from '../scripts/asset-cost-estimator.mjs';
import {
  ApprovalRequiredError,
  BudgetExceededError,
  ModelBlockedError,
  GUARD_FILENAME,
  appendLedger,
  readLedger,
} from '../scripts/lib/video-guard.mjs';
import { APPROVAL_FILENAME, writeApproval } from '../scripts/lib/plan-approval.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'scripts', 'video-engine-cli.mjs');

const header = ['//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: Gate Demo', '- video_fps: 30', '', '# Scenes', ''];
function scene(n, narration, { voice, model = 'wavespeed-ai/z-image/turbo' } = {}) {
  return [
    '## Scene ' + n + ': Part ' + n,
    '@base Intro',
    narration,
    '- scene_duration: 3.0',
    ...(voice ? ['- scene_voice: ' + voice] : []),
    '',
    '@@ Backdrop',
    '- layer_type: image',
    '- layer_level: 10',
    '- layer_prompt: "Diagram number ' + n + '"',
    '- layer_generation_model: ' + model,
    '',
  ].join('\n');
}
const makeScript = (opts2 = {}) =>
  header.join('\n') + scene(1, 'Learn how artificial neural networks process vectors.') + '\n' +
  scene(2, 'Layers of interconnected weights extract features.', opts2);
const script = makeScript();

/** Workspace with a video-guard.json and series/s/assets/ep/script.md. */
function workspace(guardOverrides = {}, text = script) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'compile-gate-')));
  fs.writeFileSync(path.join(root, GUARD_FILENAME), JSON.stringify({ version: 1, ...guardOverrides }));
  const dir = path.join(root, 'series', 's', 'assets', 'ep');
  fs.mkdirSync(dir, { recursive: true });
  const scriptPath = path.join(dir, 'script.md');
  fs.writeFileSync(scriptPath, text);
  return { root, dir, scriptPath, text, approvalPath: path.join(dir, APPROVAL_FILENAME) };
}

/** What a human approval of the estimator plan records. */
function approve(ws, { models = {}, allowModels = [], totalFactor = 1 } = {}) {
  const estimate = estimateScriptCost(ws.text, {
    defaultImageModel: models.image,
    defaultTtsModel: models.tts,
    defaultAvatarModel: models.avatar,
  });
  writeApproval(ws.approvalPath, {
    planHash: estimate.planHash,
    totalUsd: estimate.summary.grandTotalCost * totalFactor,
    allowedModels: estimate.planModels,
    allowModels,
  });
  return estimate;
}

function fakeProvider() {
  const state = { posts: [], bodies: [] };
  const fetch = async (url, init = {}) => {
    const u = String(url);
    if (init.method === 'POST') {
      state.posts.push(u);
      state.bodies.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ data: { id: 't' } }) };
    }
    if (u.includes('/predictions/')) {
      return { ok: true, status: 200, json: async () => ({ data: { status: 'completed', outputs: ['https://cdn.fake/o'] } }) };
    }
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(2048).buffer };
  };
  return { state, fetch };
}

function paid(provider, extra = {}) {
  return {
    synthesizerOptions: {
      env: { WAVESPEED_API_KEY: 'fake-key-not-real' },
      fetch: provider.fetch,
      sleep: async () => {},
      ttsProvider: 'minimax',
    },
    ...extra,
  };
}

const PROVIDER_ENV = ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'ELEVENLABS_API_KEY', 'TTS_PROVIDER', 'MEDIA_PROVIDER'];
function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const k of PROVIDER_ENV) delete env[k];
  return { ...env, ...extra };
}
const started = (root) => readLedger(root).filter((e) => e.outcome === 'started');

describe('compile approval gate and pre-flight', () => {
  it('refuses billable synthesis when no approved plan exists, before touching disk or provider', async () => {
    const ws = workspace();
    const provider = fakeProvider();
    await assert.rejects(
      compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) }),
      (err) => err instanceof ApprovalRequiredError && /approve-plan/.test(err.message),
    );
    assert.equal(provider.state.posts.length, 0);
    assert.ok(!fs.existsSync(path.join(ws.root, '.cognnitive')), 'nothing may be written before approval');
  });

  it('refuses when the approved plan hash no longer matches the script', async () => {
    const ws = workspace();
    approve(ws);
    fs.writeFileSync(ws.scriptPath, ws.text + '\nEdited after approval.\n');
    const provider = fakeProvider();
    await assert.rejects(
      compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) }),
      (err) => err instanceof ApprovalRequiredError && /does not match/.test(err.message),
    );
    assert.equal(provider.state.posts.length, 0);
  });

  it('synthesizes TTS and images with a valid approval, then serves repeats free without approval', async () => {
    const ws = workspace();
    approve(ws);
    const provider = fakeProvider();
    const first = await compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) });
    assert.equal(first.newAssetsSynthesized, 4);
    assert.equal(provider.state.posts.length, 4);
    assert.equal(started(ws.root).length, 4);

    fs.rmSync(ws.approvalPath);
    const second = await compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) });
    assert.equal(second.cachedAssetsUsed, 4);
    assert.equal(second.newAssetsSynthesized, 0);
    assert.equal(provider.state.posts.length, 4, 'cache hits must stay free');
  });

  it('refuses the WHOLE compile before the first charge when the total passes the budget', async () => {
    const ws = workspace({ budgetPerRunUsd: 0.0001 });
    approve(ws);
    const provider = fakeProvider();
    await assert.rejects(compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) }), BudgetExceededError);
    assert.equal(provider.state.posts.length, 0);
    assert.equal(started(ws.root).length, 0);
  });

  it('refuses the whole compile when only a LATER scene uses a model that is not allowed', async () => {
    const ws = workspace({}, makeScript({ model: 'some/unlisted-image' }));
    approve(ws);
    const provider = fakeProvider();
    await assert.rejects(compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) }), ModelBlockedError);
    assert.equal(provider.state.posts.length, 0, 'scene 1 must not be paid for either');
    assert.equal(started(ws.root).length, 0);
  });

  it('caps the run at 1.25x the approved total', async () => {
    const ws = workspace({ budgetPerRunUsd: 50 });
    approve(ws, { totalFactor: 0.5 });
    const provider = fakeProvider();
    await assert.rejects(compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) }), BudgetExceededError);
    assert.equal(provider.state.posts.length, 0);
  });

  it('refuses when the rolling 24h ledger plus the plan would pass dailyCapUsd', async () => {
    const ws = workspace({ budgetPerRunUsd: 50, dailyCapUsd: 1 });
    approve(ws);
    appendLedger(ws.root, { kind: 'tts', model: 'm', estUsd: 0.999999, outcome: 'started' });
    const provider = fakeProvider();
    await assert.rejects(compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) }), /Daily cap/);
    assert.equal(provider.state.posts.length, 0);
  });

  it('--allow-model needs a human-recorded approval for that model', async () => {
    const ws = workspace({}, makeScript({ model: 'some/unlisted-image' }));
    approve(ws);
    const provider = fakeProvider();
    const opts = { scriptPath: ws.scriptPath, allowModels: ['some/unlisted-image'], ...paid(provider) };
    await assert.rejects(compileVideo(opts), (err) => err instanceof ApprovalRequiredError && /not recorded/.test(err.message));
    approve(ws, { allowModels: ['some/unlisted-image'] });
    const res = await compileVideo(opts);
    assert.equal(res.newAssetsSynthesized, 4);
  });
});

describe('--tts-model / --image-model select the real models', () => {
  it('uses the chosen TTS model for the request, and the approval hash covers it', async () => {
    const ws = workspace({ allowedModels: ['custom/tts', 'minimax/speech-2.8-hd', 'wavespeed-ai/z-image/turbo'], budgetPerRunUsd: 50 });
    const models = { tts: 'custom/tts' };
    approve(ws, { models });
    const provider = fakeProvider();
    await compileVideo({ scriptPath: ws.scriptPath, models, ...paid(provider) });
    assert.ok(provider.state.posts.some((u) => u.endsWith('/custom/tts')));
    assert.ok(!provider.state.posts.some((u) => u.endsWith('/' + 'minimax/speech-2.8-hd')));
    await assert.rejects(compileVideo({ scriptPath: ws.scriptPath, ...paid(fakeProvider()) }), ApprovalRequiredError);
  });

  it('sends a registered voice id and fails before spending on an unregistered voice name', async () => {
    const withAna = workspace({ voices: { Ana: { voice_id: 'voice_ana_1', series: 's' } } }, makeScript({ voice: 'Ana' }));
    approve(withAna);
    const provider = fakeProvider();
    await compileVideo({ scriptPath: withAna.scriptPath, ...paid(provider) });
    const tts = provider.state.bodies.filter((b) => b.text);
    assert.deepEqual(tts.map((b) => b.voice_id).sort(), ['Friendly_Person', 'voice_ana_1']);

    const unknown = workspace({}, makeScript({ voice: 'Rachel' }));
    approve(unknown);
    const p2 = fakeProvider();
    await assert.rejects(compileVideo({ scriptPath: unknown.scriptPath, ...paid(p2) }), /not registered/);
    assert.equal(p2.state.posts.length, 0);
  });
});

describe('compile --dry-run', () => {
  it('plans TTS AND image items for every scene, spends nothing and writes nothing', async () => {
    const ws = workspace();
    const provider = fakeProvider();
    const snapshot = () => fs.readdirSync(ws.root, { recursive: true }).sort();
    const before = snapshot();
    const res = await compileVideo({ scriptPath: ws.scriptPath, dryRun: true, ...paid(provider) });
    assert.equal(res.dryRun, true);
    const kinds = res.plan.items.map((i) => i.kind).sort();
    assert.deepEqual(kinds, ['image', 'image', 'tts', 'tts']);
    assert.ok(res.plan.totalUsd > 0);
    assert.equal(res.plan.approval.ok, false);
    assert.equal(provider.state.posts.length, 0);
    assert.deepEqual(snapshot(), before, 'dry run must not create ANY file or directory');
  });

  it('reports blocked models in the plan instead of throwing', async () => {
    const ws = workspace({}, makeScript({ model: 'some/unlisted-image' }));
    const res = await compileVideo({ scriptPath: ws.scriptPath, dryRun: true, ...paid(fakeProvider()) });
    assert.ok(res.plan.items.some((i) => i.blocked));
  });

  it('estimator total equals what the guard would charge for the same script', async () => {
    const ws = workspace();
    const estimate = estimateScriptCost(ws.text, {});
    const res = await compileVideo({ scriptPath: ws.scriptPath, dryRun: true, ...paid(fakeProvider()) });
    assert.ok(Math.abs(res.plan.totalUsd - estimate.summary.grandTotalCost) < 0.0005,
      'plan ' + res.plan.totalUsd + ' vs estimator ' + estimate.summary.grandTotalCost);
  });

  it('CLI exits 0, prints image and TTS items, and treats a following positional as the script', () => {
    const ws = workspace();
    const env = cleanEnv({ WAVESPEED_API_KEY: 'fake-key-not-real', TTS_PROVIDER: 'minimax' });
    const res = spawnSync(process.execPath, [CLI, 'compile', '--dry-run', ws.scriptPath], { encoding: 'utf8', env });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /Dry run/);
    assert.match(res.stdout, /minimax\/speech-2\.8-hd/);
    assert.match(res.stdout, /wavespeed-ai\/z-image\/turbo/);
    assert.ok(!fs.existsSync(path.join(ws.root, '.cognnitive')));
  });
});

describe('CLI flag handling', () => {
  const run = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: cleanEnv() });

  it('rejects --dry-run on render and preview (it must never be silently ignored)', () => {
    for (const cmd of ['render', 'preview']) {
      const res = run([cmd, 'x.md', '--dry-run', '--output', 'o.mp4']);
      assert.notEqual(res.status, 0, cmd);
      assert.match(res.stderr, /--dry-run is only supported by compile/);
    }
  });

  it('errors when a value flag is missing its value, and on unknown options', () => {
    assert.match(run(['compile', 'x.md', '--approval']).stderr, /requires a value/);
    assert.match(run(['compile', 'x.md', '--allow-model']).stderr, /requires a value/);
    assert.match(run(['compile', 'x.md', '--bogus']).stderr, /Unknown option/);
  });

  it('accepts --flag=value and lists every new flag in the usage banner', () => {
    const ws = workspace();
    const ok = run(['compile', ws.scriptPath, '--dry-run', '--allow-model=a/b', '--approval=' + ws.approvalPath]);
    assert.equal(ok.status, 0, ok.stderr);
    const usage = run(['compile']);
    for (const flag of ['--dry-run', '--allow-model', '--approval', '--image-model', '--tts-model', '--avatar-model', '--cache-dir']) {
      assert.ok(usage.stderr.includes(flag), flag);
    }
  });
});

describe('compile cache dir', () => {
  const local = { synthesizerOptions: { env: {}, ttsProvider: 'local' } };

  it('defaults to <workspaceRoot>/.cognnitive/cache/video regardless of cwd', async () => {
    const ws = workspace();
    await compileVideo({ scriptPath: ws.scriptPath, ...local });
    const ttsDir = path.join(ws.root, '.cognnitive', 'cache', 'video', 'tts');
    assert.ok(fs.readdirSync(ttsDir).length >= 1, 'TTS assets must be cached under the workspace root');
  });

  it('an explicit cacheDir still wins', async () => {
    const ws = workspace();
    const cacheDir = path.join(ws.root, 'custom-cache');
    await compileVideo({ scriptPath: ws.scriptPath, cacheDir, ...local });
    assert.ok(fs.readdirSync(path.join(cacheDir, 'tts')).length >= 1);
    assert.ok(!fs.existsSync(path.join(ws.root, '.cognnitive', 'cache', 'video', 'tts')));
  });
});

describe('compile progress + accumulated cost', () => {
  it('emits plan first, then [i/N] per asset with item cost and accumulated spend', async () => {
    const ws = workspace();
    approve(ws);
    const provider = fakeProvider();
    const events = [];
    const res = await compileVideo({ scriptPath: ws.scriptPath, ...paid(provider), onProgress: (e) => events.push(e) });

    assert.equal(events[0].phase, 'plan');
    assert.equal(events[0].ttsTotal, 2);
    assert.equal(events[0].mediaTotal, 2);
    assert.ok(events[0].totalUsd > 0);
    assert.equal(res.plannedTotalUsd, events[0].totalUsd);

    const tts = events.filter((e) => e.phase === 'tts-done');
    const media = events.filter((e) => e.phase === 'media-done');
    assert.deepEqual(tts.map((e) => [e.done, e.total]), [[1, 2], [2, 2]]);
    assert.deepEqual(media.map((e) => [e.done, e.total]), [[1, 2], [2, 2]]);
    assert.ok(tts.every((e) => e.fromCache === false && e.itemCostUsd > 0));

    const dones = events.filter((e) => e.phase === 'tts-done' || e.phase === 'media-done');
    const sum = Math.round(dones.reduce((n, e) => n + e.itemCostUsd, 0) * 1e6) / 1e6;
    assert.equal(res.spentUsd, sum);
    assert.equal(dones.at(-1).spentUsd, res.spentUsd);
    assert.ok(Math.abs(res.spentUsd - res.plannedTotalUsd) < 0.0005, 'first run spends the whole plan');
  });

  it('a repeat run reports cache hits at $0 and spends nothing', async () => {
    const ws = workspace();
    approve(ws);
    const provider = fakeProvider();
    await compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) });
    const events = [];
    const res = await compileVideo({ scriptPath: ws.scriptPath, ...paid(provider), onProgress: (e) => events.push(e) });
    assert.equal(res.spentUsd, 0);
    const dones = events.filter((e) => e.phase === 'tts-done' || e.phase === 'media-done');
    assert.equal(dones.length, 4);
    assert.ok(dones.every((e) => e.fromCache === true && e.itemCostUsd === 0 && e.spentUsd === 0));
  });
});

describe('replicate/-prefixed model names in scripts', () => {
  const aliased = () => {
    const extra = '- scene_tts_model: replicate/minimax/speech-2.8-hd\n- replicate/minimax/speech-2.8-hd/voice_id: Ana\n- scene_duration: 3.0';
    return makeScript().split('- scene_duration: 3.0').join(extra);
  };

  it('plans without BLOCKED items and sends the normalized route and the property-key voice', async () => {
    const ws = workspace({ voices: { Ana: { voice_id: 'voice_ana_1', series: 's' } } }, aliased());
    const dry = await compileVideo({ scriptPath: ws.scriptPath, dryRun: true, ...paid(fakeProvider()) });
    assert.ok(dry.plan.items.every((i) => !i.blocked), JSON.stringify(dry.plan.items.map((i) => i.blocked)));
    assert.ok(dry.plan.items.filter((i) => i.kind === 'tts').every((i) => i.model === 'minimax/speech-2.8-hd'));
    approve(ws);
    const provider = fakeProvider();
    await compileVideo({ scriptPath: ws.scriptPath, ...paid(provider) });
    assert.ok(provider.state.posts.some((u) => u.endsWith('/api/v3/minimax/speech-2.8-hd')));
    assert.ok(provider.state.posts.every((u) => !u.includes('/replicate/')));
    const voices = provider.state.bodies.filter((b) => b.text).map((b) => b.voice_id);
    assert.deepEqual(voices, ['voice_ana_1', 'voice_ana_1']);
    assert.ok(started(ws.root).every((e) => !e.model.startsWith('replicate/')));
  });
});
