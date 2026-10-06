import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AvatarBatchError, OutstandingJobError, synthesizeAvatars } from '../scripts/synthesize-avatar.mjs';
import { AssetSynthesizer, BillingFailureError } from '../scripts/asset-synthesizer.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';
import { compileVideo } from '../scripts/video-engine-cli.mjs';
import { estimateScriptCost } from '../scripts/asset-cost-estimator.mjs';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';
import { appendPending, readPending } from '../scripts/lib/pending-predictions.mjs';
import { buildTtsVoiceOptions, resolveRegisteredVoice } from '../scripts/lib/tts-options.mjs';
import { needsFaststart } from '../scripts/lib/faststart.mjs';
import {
  ApprovalRequiredError,
  BudgetExceededError,
  DEFAULT_GUARD,
  GUARD_FILENAME,
  ModelBlockedError,
  SpendGuard,
  appendLedger,
  readLedger,
  sumLedgerSince,
} from '../scripts/lib/video-guard.mjs';
import { APPROVAL_FILENAME, writeApproval } from '../scripts/lib/plan-approval.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'scripts', 'synthesize-avatar.mjs');
const FAST = 'wavespeed-ai/infinitetalk-fast';
const SLOW = 'wavespeed-ai/infinitetalk';
const MP4_RAW = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisomRAW-MOOV-AT-END')]);

function makeScript({ model = FAST, scenes = 1, image = 'media/avatar.jpeg', duration = '4.0' } = {}) {
  const body = [];
  for (let i = 1; i <= scenes; i++) {
    body.push(
      '## Scene ' + i + ': Part ' + i, '@base Intro', 'Hello there, this is narration number ' + i + ' for the avatar.',
      ...(duration ? ['- scene_duration: ' + duration] : []), '',
      '@@ Avatar Host', '- layer_type: talking_avatar', '- layer_level: 50', '- layer_avatar_model: ' + model,
      '  ![media](' + image + ')', '',
    );
  }
  return ['//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: Avatar Demo', '- video_fps: 30', '', '# Scenes', ''].concat(body).join('\n');
}

/** Workspace whose staged audio is consistent with the TTS cache, like a real `compile` leaves it. */
function workspace({ guard = {}, script = makeScript(), audio = true, distinctAudio = false } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'synth-avatar-')));
  fs.writeFileSync(path.join(root, GUARD_FILENAME), JSON.stringify({ version: 1, ...guard }));
  const dir = path.join(root, 'series', 's', 'assets', 'ep');
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'media', 'avatar.jpeg'), Buffer.from('fake-jpeg-bytes'));
  const scriptPath = path.join(dir, 'script.md');
  fs.writeFileSync(scriptPath, script);
  const scenes = new RemotionSceneCompiler({}).parseScript(script).scenes;
  const ids = scenes.map((s) => s.id);
  const ws = { root, dir, scriptPath, ids, script, scenes, approvalPath: path.join(dir, APPROVAL_FILENAME) };
  if (audio) scenes.forEach((sc, i) => seedAudio(ws, sc, distinctAudio ? 'audio-bytes-' + i : 'same-audio-bytes'));
  return ws;
}

function seedAudio(ws, sc, bytes) {
  const cache = new CacheManager({ baseDir: path.join(ws.root, '.cognnitive', 'cache', 'video') });
  const config = { ...structuredClone(DEFAULT_GUARD), ...JSON.parse(fs.readFileSync(path.join(ws.root, GUARD_FILENAME), 'utf8')) };
  const key = cache.computeHash(sc.narration.trim(), resolveRegisteredVoice(buildTtsVoiceOptions(sc, {}), config));
  cache.putSync(key, 'mp3', Buffer.from(bytes), 'tts');
  fs.writeFileSync(path.join(ws.dir, 'audio', sc.id + '_voiceover.mp3'), Buffer.from(bytes));
}

function approve(ws, { allowModels = [], factor = 1, models = {} } = {}) {
  const e = estimateScriptCost(ws.script, { defaultAvatarModel: models.avatar });
  writeApproval(ws.approvalPath, { planHash: e.planHash, totalUsd: e.summary.grandTotalCost * factor, allowedModels: e.planModels, allowModels });
  return e;
}

/** Fake WaveSpeed with a controllable task lifecycle and a fake clock. Never touches the network. */
function fakeEnv(o = {}) {
  const { doneAfterPolls = 1, status = 'completed', pendingFile, pollThrows = [], downloadThrows = false, submitStatus, submitThrows = false,
    numericId = false, downloadBody = MP4_RAW, downloadDelayMs = 0 } = o;
  const st = { posts: [], bodies: [], urls: [], polls: 0, t: 0, inFlight: 0, peak: 0, journalAtPost: [], pendingSeenAtFirstPoll: null };
  let n = 0;
  const fetch = async (url, init = {}) => {
    const u = String(url);
    st.urls.push(u);
    if (init.method === 'POST') {
      st.posts.push(u);
      st.bodies.push(JSON.parse(init.body));
      st.journalAtPost.push(pendingFile && fs.existsSync(pendingFile) ? fs.readFileSync(pendingFile, 'utf8') : '');
      if (submitThrows) throw new Error('ECONNRESET');
      if (submitStatus) return { ok: false, status: submitStatus, text: async () => '{"error":"image could not be decoded"}' };
      n++;
      st.inFlight++;
      st.peak = Math.max(st.peak, st.inFlight);
      return { ok: true, status: 200, json: async () => ({ data: { id: numericId ? 12345 + n : 'task-' + n } }) };
    }
    if (u.includes('/predictions/')) {
      st.polls++;
      if (st.pendingSeenAtFirstPoll === null && pendingFile) st.pendingSeenAtFirstPoll = fs.existsSync(pendingFile);
      if (pollThrows === 'all' || pollThrows.includes(st.polls)) throw new Error('socket hang up');
      const done = st.polls >= doneAfterPolls;
      const body = done ? { data: { status, outputs: ['https://cdn.fake/avatar.mp4'] } } : { data: { status: 'processing' } };
      return { ok: true, status: 200, json: async () => body };
    }
    if (downloadThrows) throw new Error('download reset');
    if (downloadDelayMs) await new Promise((r) => setTimeout(r, downloadDelayMs));
    st.inFlight--;
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(downloadBody).buffer };
  };
  const sleep = async (ms) => { st.t += ms; };
  const now = () => st.t;
  return { st, fetch, sleep, now };
}

const env = { WAVESPEED_API_KEY: 'fake-key-not-real' };
const measure = async () => 4;
const okFfmpeg = (calls = []) => async (args) => {
  calls.push(args);
  fs.writeFileSync(args[args.length - 1], Buffer.from('FASTSTART-MP4'));
  return { status: 0 };
};

function opts(ws, fe, extra = {}) {
  return { scriptPath: ws.scriptPath, env, fetch: fe.fetch, sleep: fe.sleep, now: fe.now, measureDuration: measure, ffmpegRun: okFfmpeg(), warn: () => {}, ...extra };
}
const started = (root) => readLedger(root).filter((e) => e.outcome === 'started');
const tempDir = (root) => path.join(root, '.cognnitive', 'cache', 'video', 'temp');
const clips = (root) => (fs.existsSync(tempDir(root)) ? fs.readdirSync(tempDir(root)).filter((f) => f.endsWith('.mp4')) : []);
const pendingFile = (ws) => path.join(ws.root, '.cognnitive', 'pending-predictions.jsonl');
const failure = (p) => p.then(() => null, (e) => e);

describe('dry run and pricing', () => {
  it('prints per-scene seconds and estimate, writes nothing, rejects --resume', async () => {
    const ws = workspace({ script: makeScript({ scenes: 2 }), distinctAudio: true });
    const fe = fakeEnv();
    const snapshot = () => fs.readdirSync(ws.root, { recursive: true }).sort();
    const before = snapshot();
    const res = await synthesizeAvatars(opts(ws, fe, { dryRun: true }));
    assert.equal(res.dryRun, true);
    assert.equal(res.jobs.length, 2);
    for (const j of res.jobs) {
      assert.equal(j.seconds, 4);
      assert.ok(Math.abs(j.estUsd - 0.06) < 1e-9, String(j.estUsd));
    }
    assert.ok(Math.abs(res.plan.totalUsd - 0.12) < 1e-9);
    assert.equal(res.plan.approval.ok, false);
    assert.equal(fe.st.posts.length, 0);
    assert.deepEqual(snapshot(), before);
    await assert.rejects(synthesizeAvatars(opts(ws, fe, { dryRun: true, resume: 'task-1' })), /dry-run.*resume/i);
  });

  it('bills ceil(measured seconds) and agrees with the estimator when scene_duration equals the audio', async () => {
    const ws = workspace();
    const estimate = estimateScriptCost(ws.script, {});
    const res = await synthesizeAvatars(opts(ws, fakeEnv(), { dryRun: true }));
    assert.ok(Math.abs(res.plan.totalUsd - estimate.summary.totalAvatarCost) < 1e-9);
    const fractional = await synthesizeAvatars(opts(ws, fakeEnv(), { dryRun: true, measureDuration: async () => 3.2 }));
    assert.ok(Math.abs(fractional.plan.totalUsd - 0.06) < 1e-9, 'ceil(3.2) = 4 seconds');
  });

  it('without an explicit scene_duration the estimator guesses (words/2.5) and the measured audio wins', async () => {
    const ws = workspace({ script: makeScript({ duration: '' }) });
    const estimate = estimateScriptCost(ws.script, {});
    const res = await synthesizeAvatars(opts(ws, fakeEnv(), { dryRun: true, measureDuration: async () => 9 }));
    assert.ok(Math.abs(res.plan.totalUsd - 9 * 0.015) < 1e-9);
    assert.notEqual(estimate.summary.totalAvatarCost, res.plan.totalUsd, 'documented gap: estimate vs measured');
  });

  it('refuses audio longer than maxAvatarSeconds, before any spend', async () => {
    const ws = workspace({ guard: { maxAvatarSeconds: 30 } });
    approve(ws);
    const fe = fakeEnv();
    const err = await failure(synthesizeAvatars(opts(ws, fe, { measureDuration: async () => 31 })));
    assert.match(err.message, /maxAvatarSeconds/);
    assert.equal(fe.st.posts.length, 0);
  });

  it('de-duplicates repeated --scene ids', async () => {
    const ws = workspace();
    const res = await synthesizeAvatars(opts(ws, fakeEnv(), { dryRun: true, scenes: [ws.ids[0], ws.ids[0]] }));
    assert.equal(res.jobs.length, 1);
    assert.deepEqual(res.jobs[0].sceneIds, [ws.ids[0]]);
  });
});

describe('refusals happen before any request', () => {
  const attempt = async (ws, extra = {}) => {
    const fe = fakeEnv();
    return { err: await failure(synthesizeAvatars(opts(ws, fe, extra))), fe };
  };

  it('no approved plan', async () => {
    const ws = workspace();
    const { err, fe } = await attempt(ws);
    assert.ok(err instanceof ApprovalRequiredError);
    assert.equal(fe.st.posts.length, 0);
    assert.equal(started(ws.root).length, 0);
  });

  it('per-run budget, approved-total cap and rolling daily cap', async () => {
    const tiny = workspace({ guard: { budgetPerRunUsd: 0.01 } });
    approve(tiny);
    const a = await attempt(tiny);
    assert.ok(a.err instanceof BudgetExceededError);
    const capped = workspace({ guard: { budgetPerRunUsd: 50 } });
    approve(capped, { factor: 0.1 });
    assert.ok((await attempt(capped)).err instanceof BudgetExceededError);
    const daily = workspace({ guard: { budgetPerRunUsd: 50, dailyCapUsd: 0.1 } });
    approve(daily);
    appendLedger(daily.root, { kind: 'avatar', model: FAST, estUsd: 0.09, outcome: 'started' });
    const d = await attempt(daily);
    assert.ok(d.err instanceof BudgetExceededError && /Daily cap/.test(d.err.message));
    for (const x of [a, d]) assert.equal(x.fe.st.posts.length, 0);
  });

  it('the blocked non-fast model, also through the replicate/ alias', async () => {
    for (const model of [SLOW, 'replicate/' + SLOW]) {
      const ws = workspace({ script: makeScript({ model }) });
      approve(ws);
      const { err, fe } = await attempt(ws);
      assert.ok(err instanceof ModelBlockedError, model);
      assert.equal(fe.st.posts.length, 0);
    }
  });

  it('refuses the WHOLE batch before the first charge when only the second job would not fit', async () => {
    const ws = workspace({ script: makeScript({ scenes: 2 }), guard: { budgetPerRunUsd: 0.07 }, distinctAudio: true });
    approve(ws);
    const { err, fe } = await attempt(ws);
    assert.ok(err instanceof BudgetExceededError);
    assert.equal(fe.st.posts.length, 0);
    assert.equal(started(ws.root).length, 0);
  });
});

describe('input validation before spend', () => {
  const attempt = async (ws, extra = {}) => {
    const fe = fakeEnv();
    return { err: await failure(synthesizeAvatars(opts(ws, fe, extra))), fe };
  };

  it('missing audio, unmeasurable audio and a missing image', async () => {
    const noAudio = workspace({ audio: false });
    approve(noAudio);
    assert.match((await attempt(noAudio)).err.message, /audio/i);
    const unmeasurable = workspace();
    approve(unmeasurable);
    const u = await attempt(unmeasurable, { measureDuration: async () => 0 });
    assert.match(u.err.message, /duration/i);
    assert.equal(u.fe.st.posts.length, 0);
    const noImage = workspace({ script: makeScript({ image: 'media/nope.jpeg' }) });
    approve(noImage);
    assert.match((await attempt(noImage)).err.message, /image/i);
  });

  it('staged audio that no longer matches the current TTS entry is refused ("re-run compile first")', async () => {
    const ws = workspace();
    approve(ws);
    fs.writeFileSync(path.join(ws.dir, 'audio', ws.ids[0] + '_voiceover.mp3'), Buffer.from('stale-audio-from-an-old-narration'));
    const { err, fe } = await attempt(ws);
    assert.match(err.message, /Re-run compile first/);
    assert.equal(fe.st.posts.length, 0);
    // and a narration edit after staging is stale too
    const edited = workspace();
    fs.writeFileSync(edited.scriptPath, edited.script.replace('narration number 1', 'an EDITED narration'));
    assert.match((await attempt(edited)).err.message, /Re-run compile first/);
  });

  it('an unsupported image extension is refused', async () => {
    const ws = workspace({ script: makeScript({ image: 'media/avatar.gif' }) });
    fs.writeFileSync(path.join(ws.dir, 'media', 'avatar.gif'), 'x');
    approve(ws);
    assert.match((await attempt(ws)).err.message, /extension/i);
  });
});

describe('guard enforcement at run time (not only in pre-flight)', () => {
  it('approval revoked after pre-flight: authorize still refuses, nothing is sent', async () => {
    const ws = workspace();
    approve(ws);
    const fe = fakeEnv();
    const err = await failure(synthesizeAvatars(opts(ws, fe, { onPreflightPassed: () => fs.rmSync(ws.approvalPath) })));
    assert.ok(err instanceof AvatarBatchError);
    assert.ok(err.failures[0].error instanceof ApprovalRequiredError);
    assert.equal(fe.st.posts.length, 0);
  });

  it('daily cap bumped after pre-flight: authorize still refuses', async () => {
    const ws = workspace({ guard: { dailyCapUsd: 0.1, budgetPerRunUsd: 5 } });
    approve(ws);
    const fe = fakeEnv();
    const bump = () => appendLedger(ws.root, { kind: 'avatar', model: FAST, estUsd: 0.09, outcome: 'started' });
    const err = await failure(synthesizeAvatars(opts(ws, fe, { onPreflightPassed: bump })));
    assert.match(err.message, /Daily cap/);
    assert.equal(fe.st.posts.length, 0);
  });

  it('two processes sharing a workspace never run avatar jobs at the same time (slot lock)', async () => {
    const ws = workspace({ script: makeScript({ scenes: 2 }), distinctAudio: true, guard: { budgetPerRunUsd: 50 } });
    approve(ws);
    const fe = fakeEnv({ downloadDelayMs: 40 });
    const a = synthesizeAvatars(opts(ws, fe, { scenes: [ws.ids[0]] }));
    const b = synthesizeAvatars(opts(ws, fe, { scenes: [ws.ids[1]] }));
    await Promise.all([a, b]);
    assert.equal(fe.st.posts.length, 2);
    assert.equal(fe.st.peak, 1, 'maxAvatarConcurrency 1 must hold across processes');
  });

  it('maxAvatarConcurrency > 1 with the same key submits once (per-job lock)', async () => {
    const ws = workspace({ guard: { maxAvatarConcurrency: 2, budgetPerRunUsd: 50 } });
    approve(ws);
    const fe = fakeEnv({ downloadDelayMs: 40 });
    await Promise.all([synthesizeAvatars(opts(ws, fe)), synthesizeAvatars(opts(ws, fe))]);
    assert.equal(fe.st.posts.length, 1);
    assert.equal(started(ws.root).length, 1);
  });
});

describe('a billed avatar job', () => {
  it('journals the intent BEFORE the POST and the task id BEFORE polling; stringifies numeric ids', async () => {
    const ws = workspace();
    approve(ws);
    const fe = fakeEnv({ doneAfterPolls: 3, pendingFile: pendingFile(ws), numericId: true });
    const calls = [];
    const res = await synthesizeAvatars(opts(ws, fe, { ffmpegRun: okFfmpeg(calls) }));
    assert.equal(fe.st.posts.length, 1);
    assert.ok(fe.st.posts[0].endsWith('/api/v3/' + FAST));
    assert.match(fe.st.bodies[0].image, /^data:image\/jpeg;base64,/);
    assert.match(fe.st.bodies[0].audio, /^data:audio\/mpeg;base64,/);
    assert.match(fe.st.journalAtPost[0], /"status":"submitting"/, 'the intent must be journaled before the POST');
    assert.equal(fe.st.pendingSeenAtFirstPoll, true);
    const journal = readPending(ws.root);
    assert.deepEqual(journal.map((r) => r.status), ['submitting', 'submitted', 'completed']);
    assert.equal(journal[1].taskId, '12346', 'a numeric id is stringified at the journal boundary');
    assert.match(journal[1].command, /--resume 12346/);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('+faststart') && calls[0].includes('copy'));
    assert.equal(fs.readFileSync(res.jobs[0].assetPath, 'utf8'), 'FASTSTART-MP4');
    assert.deepEqual(readLedger(ws.root).map((e) => e.outcome), ['started', 'ok']);
    assert.ok(Math.abs(started(ws.root)[0].estUsd - 0.06) < 1e-9);
  });

  it('keeps the raw clip and marks it when ffmpeg is missing; compile retries once ffmpeg exists', async () => {
    const ws = workspace();
    approve(ws);
    const warnings = [];
    const res = await synthesizeAvatars(opts(ws, fakeEnv(), {
      ffmpegRun: async () => ({ status: null, error: Object.assign(new Error('nope'), { code: 'ENOENT' }) }),
      warn: (m) => warnings.push(m),
    }));
    assert.ok(fs.readFileSync(res.jobs[0].assetPath).equals(MP4_RAW));
    assert.match(warnings.join(' '), /ffmpeg/i);
    assert.ok(needsFaststart(res.jobs[0].assetPath));
    const local = { synthesizerOptions: { env: {}, ttsProvider: 'local' }, ffmpegRun: okFfmpeg() };
    await compileVideo({ scriptPath: ws.scriptPath, ...local });
    assert.ok(!needsFaststart(res.jobs[0].assetPath), 'the marker is cleared after a successful retry');
    assert.equal(fs.readFileSync(res.jobs[0].assetPath, 'utf8'), 'FASTSTART-MP4');
  });

  it('a faststart that throws keeps the raw clip cached, the ledger ok, and a marker', async () => {
    const ws = workspace();
    approve(ws);
    const res = await synthesizeAvatars(opts(ws, fakeEnv(), { ffmpegRun: async () => { throw new Error('ffmpeg exploded'); } }));
    assert.ok(fs.readFileSync(res.jobs[0].assetPath).equals(MP4_RAW));
    assert.deepEqual(readLedger(ws.root).map((e) => e.outcome), ['started', 'ok']);
    assert.ok(needsFaststart(res.jobs[0].assetPath));
  });

  it('an identical re-run is a free cache hit; duplicate scenes dedupe to ONE job', async () => {
    const ws = workspace({ script: makeScript({ scenes: 3 }), guard: { budgetPerRunUsd: 50 } });
    approve(ws);
    const fe = fakeEnv();
    const res = await synthesizeAvatars(opts(ws, fe));
    assert.equal(fe.st.posts.length, 1);
    assert.equal(res.jobs.length, 1);
    assert.equal(res.jobs[0].sceneIds.length, 3);
    fs.rmSync(ws.approvalPath);
    const again = await synthesizeAvatars(opts(ws, fe));
    assert.equal(fe.st.posts.length, 1);
    assert.equal(again.jobs[0].status, 'cached');
    assert.equal(readLedger(ws.root).at(-1).cacheHit, true);
  });

  it('--scene limits the batch and rejects an unknown scene id', async () => {
    const ws = workspace({ script: makeScript({ scenes: 2 }), distinctAudio: true });
    const res = await synthesizeAvatars(opts(ws, fakeEnv(), { dryRun: true, scenes: [ws.ids[1]] }));
    assert.deepEqual(res.jobs.map((j) => j.sceneIds), [[ws.ids[1]]]);
    await assert.rejects(synthesizeAvatars(opts(ws, fakeEnv(), { dryRun: true, scenes: ['nope'] })), /scene/i);
  });
});

describe('double-submit protection (the journal is consulted before ANY submit)', () => {
  it('a re-run after a timeout is refused with the resume command; --force-resubmit overrides', async () => {
    const ws = workspace();
    approve(ws);
    const fe = fakeEnv({ doneAfterPolls: 10000 });
    const first = await failure(synthesizeAvatars(opts(ws, fe, { pollWindowMs: 60000 })));
    assert.ok(first instanceof AvatarBatchError);
    assert.equal(fe.st.posts.length, 1);

    const again = await failure(synthesizeAvatars(opts(ws, fe, { pollWindowMs: 60000 })));
    assert.ok(again instanceof OutstandingJobError, again?.message);
    assert.match(again.message, /--resume task-1/);
    assert.match(again.message, /force-resubmit/);
    assert.equal(fe.st.posts.length, 1, 'no second billed job');
    assert.equal(started(ws.root).length, 1);

    const forced = await failure(synthesizeAvatars(opts(ws, fe, { pollWindowMs: 60000, forceResubmit: true })));
    assert.ok(forced instanceof AvatarBatchError, 'the forced run submitted (and timed out) again');
    assert.equal(fe.st.posts.length, 2);
  });

  it('a journal left by a crash after submit blocks a new submit', async () => {
    const ws = workspace();
    approve(ws);
    const dry = await synthesizeAvatars(opts(ws, fakeEnv(), { dryRun: true }));
    appendPending(ws.root, { intentId: 'x', taskId: 'task-crashed', status: 'submitted', cacheKey: dry.jobs[0].cacheKey, sceneIds: ws.ids });
    const fe = fakeEnv();
    const err = await failure(synthesizeAvatars(opts(ws, fe)));
    assert.ok(err instanceof OutstandingJobError);
    assert.match(err.message, /task-crashed/);
    assert.equal(fe.st.posts.length, 0);
    assert.equal(started(ws.root).length, 0);
  });

  it('a submit that throws may have been billed: it is journaled as uncertain and blocks a re-run', async () => {
    const ws = workspace();
    approve(ws);
    const err = await failure(synthesizeAvatars(opts(ws, fakeEnv({ submitThrows: true }))));
    assert.match(err.message, /MAY HAVE BEEN BILLED/);
    assert.equal(err.exitCode, 1);
    assert.equal(readPending(ws.root).at(-1).status, 'submit-uncertain');
    const fe = fakeEnv();
    assert.ok((await failure(synthesizeAvatars(opts(ws, fe)))) instanceof OutstandingJobError);
    assert.equal(fe.st.posts.length, 0);
  });

  it('a 4xx before any task id is ledgered failed with the charge refunded, and does not block a re-run', async () => {
    const ws = workspace();
    approve(ws);
    const err = await failure(synthesizeAvatars(opts(ws, fakeEnv({ submitStatus: 400 }))));
    assert.match(err.message, /HTTP 400/);
    assert.match(err.message, /image could not be decoded/, 'the response body is part of the message');
    assert.equal(sumLedgerSince(ws.root, Date.now() - 60000), 0, 'nothing was billed, so nothing counts toward the daily cap');
    assert.equal(readLedger(ws.root).at(-1).outcome, 'failed');
    assert.equal(readPending(ws.root).at(-1).status, 'submit-rejected');
    const retry = await synthesizeAvatars(opts(ws, fakeEnv()));
    assert.equal(retry.jobs[0].status, 'synthesized');
  });
});

describe('long jobs: timeout, resume, failures', () => {
  it('a timeout carries the task id and a COMPLETE resume command; resume never re-submits or re-charges', async () => {
    const ws = workspace();
    approve(ws, { models: { avatar: FAST } });
    const fe = fakeEnv({ doneAfterPolls: 10000 });
    const cacheDir = path.join(ws.root, 'my-cache');
    fs.cpSync(path.join(ws.root, '.cognnitive', 'cache', 'video'), cacheDir, { recursive: true }); // the TTS cache lives where --cache-dir points
    const input = { pollWindowMs: 60000, cacheDir, approvalPath: ws.approvalPath, models: { avatar: FAST }, allowModels: [] };
    const err = await failure(synthesizeAvatars(opts(ws, fe, input)));
    assert.ok(err instanceof AvatarBatchError);
    assert.equal(err.exitCode, 3);
    const f = err.failures[0];
    assert.ok(f.error instanceof BillingFailureError && f.error.taskId === 'task-1' && f.error.timedOut);
    for (const part of [process.execPath, 'synthesize-avatar.mjs', ws.scriptPath, '--scene ' + ws.ids[0], '--resume task-1', '--cache-dir', cacheDir,
      '--approval', ws.approvalPath, '--avatar-model ' + FAST, '--poll-window 1']) {
      assert.ok(f.resumeCommand.includes(part), 'resume command is missing: ' + part + '\n' + f.resumeCommand);
    }
    assert.equal(fe.st.posts.length, 1);
    assert.equal(fs.readdirSync(path.join(cacheDir, 'temp')).filter((n) => n.endsWith('.mp4')).length, 0, 'no stub is cached');
    assert.equal(readPending(ws.root).at(-1).status, 'timeout');

    fe.st.polls = 10000; // the provider finished meanwhile
    const res = await synthesizeAvatars(opts(ws, fe, { ...input, resume: 'task-1' }));
    assert.equal(fe.st.posts.length, 1, 'resume must not submit again');
    assert.equal(res.jobs[0].status, 'resumed');
    assert.equal(started(ws.root).length, 1, 'resume must not charge again');
    assert.equal(readPending(ws.root).at(-1).status, 'completed');
  });

  it('polls with growing delays inside the configured window', async () => {
    const ws = workspace();
    approve(ws);
    const fe = fakeEnv({ doneAfterPolls: 10000 });
    const delays = [];
    const sleep = async (ms) => { delays.push(ms); fe.st.t += ms; };
    await failure(synthesizeAvatars(opts(ws, fe, { sleep, pollWindowMs: 120000 })));
    assert.ok(delays.length >= 3);
    assert.ok(delays[1] > delays[0] && delays.at(-1) >= delays[1]);
    assert.ok(fe.st.t <= 120000 + Math.max(...delays));
  });

  it('a transient fetch exception mid-poll is tolerated; persistent ones time out WITH the task id', async () => {
    const ws = workspace();
    approve(ws);
    const ok = await synthesizeAvatars(opts(ws, fakeEnv({ doneAfterPolls: 3, pollThrows: [1, 2] })));
    assert.equal(ok.jobs[0].status, 'synthesized');
    const ws2 = workspace();
    approve(ws2);
    const err = await failure(synthesizeAvatars(opts(ws2, fakeEnv({ pollThrows: 'all' }), { pollWindowMs: 60000 })));
    assert.equal(err.failures[0].error.taskId, 'task-1');
    assert.equal(err.failures[0].error.timedOut, true);
  });

  it('a download failure is recoverable (exit 3, task id, journal failed-after-submit); resume downloads again', async () => {
    const ws = workspace();
    approve(ws);
    const err = await failure(synthesizeAvatars(opts(ws, fakeEnv({ downloadThrows: true }))));
    const f = err.failures[0];
    assert.equal(f.error.taskId, 'task-1');
    assert.equal(f.error.retryable, true);
    assert.ok(f.resumeCommand);
    assert.equal(err.exitCode, 3);
    assert.equal(readPending(ws.root).at(-1).status, 'failed-after-submit');
    assert.deepEqual(readLedger(ws.root).map((e) => e.outcome), ['started', 'failed']);
    assert.equal(clips(ws.root).length, 0);
    const fe = fakeEnv();
    fe.st.polls = 10;
    const res = await synthesizeAvatars(opts(ws, fe, { resume: 'task-1' }));
    assert.equal(res.jobs[0].status, 'resumed');
    assert.equal(fe.st.posts.length, 0);
  });

  it('a terminal task failure has NO resume command, exits 1, is ledgered failed and caches nothing', async () => {
    const ws = workspace();
    approve(ws);
    const err = await failure(synthesizeAvatars(opts(ws, fakeEnv({ status: 'failed' }))));
    const f = err.failures[0];
    assert.ok(f.error instanceof BillingFailureError && f.error.taskId === 'task-1');
    assert.equal(f.resumeCommand, undefined);
    assert.equal(err.exitCode, 1);
    assert.deepEqual(readLedger(ws.root).map((e) => e.outcome), ['started', 'failed']);
    assert.equal(clips(ws.root).length, 0);
    assert.equal(readPending(ws.root).at(-1).status, 'failed');
  });

  it('an HTML 200 is never cached as a clip', async () => {
    const ws = workspace();
    approve(ws);
    const err = await failure(synthesizeAvatars(opts(ws, fakeEnv({ downloadBody: Buffer.from('<html>Access denied</html>') }))));
    assert.match(err.message, /not an MP4/);
    assert.equal(clips(ws.root).length, 0);
    assert.equal(err.failures[0].error.taskId, 'task-1');
  });

  it('every failure is collected (two timed-out jobs, two resume commands)', async () => {
    const ws = workspace({ script: makeScript({ scenes: 2 }), distinctAudio: true, guard: { budgetPerRunUsd: 50 } });
    approve(ws);
    const err = await failure(synthesizeAvatars(opts(ws, fakeEnv({ doneAfterPolls: 10000 }), { pollWindowMs: 30000 })));
    assert.equal(err.failures.length, 2);
    assert.ok(err.failures.every((f) => f.resumeCommand));
    assert.equal(err.exitCode, 3);
  });

  it('resuming an unknown task id is refused', async () => {
    const ws = workspace();
    approve(ws);
    await assert.rejects(synthesizeAvatars(opts(ws, fakeEnv(), { resume: 'task-404' })), /task-404/);
  });
});

describe('synthesizer-level failure handling after submit', () => {
  const setupSynth = (cacheManagerOverride) => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'synth-lvl-')));
    const config = { ...structuredClone(DEFAULT_GUARD), budgetPerRunUsd: 5, dailyCapUsd: 5 };
    const guard = new SpendGuard({ config, root, approval: () => ({ ok: true }) });
    const cacheManager = cacheManagerOverride?.(root) || new CacheManager({ baseDir: path.join(root, 'cache') });
    const img = path.join(root, 'a.jpeg');
    const aud = path.join(root, 'a.mp3');
    fs.writeFileSync(img, 'i');
    fs.writeFileSync(aud, 'a');
    const fe = fakeEnv();
    const synth = new AssetSynthesizer({ cacheManager, guard, env, fetch: fe.fetch, sleep: fe.sleep, now: fe.now });
    const call = (meta) => synth.resolveTalkingAvatar(img, aud, { model: FAST }, { durationSeconds: 4, windowMs: 60000, cacheKey: 'k'.repeat(64), ...meta });
    return { root, fe, call };
  };

  it('onSubmitted throwing still carries the task id (the job was billed)', async () => {
    const { fe, call, root } = setupSynth();
    const err = await failure(call({ pending: { onSubmitted: () => { throw new Error('disk full'); } } }));
    assert.ok(err instanceof BillingFailureError);
    assert.equal(err.taskId, 'task-1');
    assert.match(err.message, /journal/i);
    assert.equal(fe.st.posts.length, 1);
    assert.equal(readLedger(root).at(-1).outcome, 'failed');
  });

  it('onSubmitting throwing sends nothing and refunds the charge', async () => {
    const { fe, call, root } = setupSynth();
    const err = await failure(call({ pending: { onSubmitting: () => { throw new Error('read-only fs'); } } }));
    assert.match(err.message, /nothing was sent/);
    assert.equal(fe.st.posts.length, 0);
    assert.equal(sumLedgerSince(root, Date.now() - 60000), 0);
  });

  it('a cache write that fails never leaves the ledger ok, and the error carries the task id', async () => {
    class BrokenCache extends CacheManager {
      async put() { throw new Error('ENOSPC'); }
    }
    const { call, root } = setupSynth((r) => new BrokenCache({ baseDir: path.join(r, 'cache') }));
    const err = await failure(call({}));
    assert.ok(err instanceof BillingFailureError && err.taskId === 'task-1' && err.retryable);
    assert.deepEqual(readLedger(root).map((e) => e.outcome), ['started', 'failed']);
  });

  it('without a cacheKey meta and with missing inputs the request fails closed before any spend', async () => {
    const { root, fe } = setupSynth();
    const config = { ...structuredClone(DEFAULT_GUARD) };
    const guard = new SpendGuard({ config, root, approval: () => ({ ok: true }) });
    const synth = new AssetSynthesizer({ cacheManager: new CacheManager({ baseDir: path.join(root, 'c2') }), guard, env, fetch: fe.fetch, sleep: fe.sleep });
    const err = await failure(synth.resolveTalkingAvatar('img.png', 'a.mp3', { model: FAST, durationSeconds: 4 }));
    assert.match(err.message, /not found/);
    assert.equal(fe.st.posts.length, 0);
    assert.equal(readLedger(root).length, 0);
  });
});

describe('render pickup contract (compile uses the cached avatar video)', () => {
  const local = { synthesizerOptions: { env: {}, ttsProvider: 'local' } };
  const layersOf = (m) => m.tracks.scenes.flatMap((s) => s.props.layers || []);

  it('before synthesis the layer stays a still talking_avatar; after, it becomes a muted video from the cache', async () => {
    const ws = workspace({ audio: false });
    const first = await compileVideo({ scriptPath: ws.scriptPath, ...local });
    assert.ok(layersOf(first.manifest).some((l) => l.layer_type === 'talking_avatar'));
    assert.deepEqual([first.avatarVideos.applied, first.avatarVideos.missing], [0, 1]);

    approve(ws);
    const fe = fakeEnv();
    await synthesizeAvatars(opts(ws, fe));
    const second = await compileVideo({ scriptPath: ws.scriptPath, ...local });
    assert.equal(second.avatarVideos.applied, 1);
    const layer = layersOf(second.manifest).find((l) => l.layer_type === 'video');
    assert.ok(layer, 'the avatar layer is now a video layer');
    assert.equal(layer.layer_muted, true, 'narration is bound separately; the clip must not echo it');
    assert.ok(fs.existsSync(path.join(ws.dir, 'public', layer.layer_asset_source)));
    assert.equal(fe.st.posts.length, 1, 'compile spends nothing for avatars');
  });

  it('non-avatar video layers keep layer_muted undefined', async () => {
    const script = makeScript().replace('# Scenes\n', '# Scenes\n') + '\n@@ Intro Clip\n- layer_type: video\n- layer_level: 10\n  ![media](media/clip.mp4)\n';
    const ws = workspace({ script, audio: false });
    fs.writeFileSync(path.join(ws.dir, 'media', 'clip.mp4'), MP4_RAW);
    const res = await compileVideo({ scriptPath: ws.scriptPath, ...local });
    const clip = layersOf(res.manifest).find((l) => l.layer_type === 'video');
    assert.ok(clip, 'the plain video layer is present');
    assert.equal(clip.layer_muted, undefined);
  });

  it('a layer named Avatar but typed video is neither an avatar job nor picked up', async () => {
    const script = makeScript().replace('@@ Avatar Host\n- layer_type: talking_avatar', '@@ Avatar Host\n- layer_type: video');
    const ws = workspace({ script, audio: false });
    const err = await failure(synthesizeAvatars(opts(ws, fakeEnv(), { dryRun: true })));
    assert.match(err.message, /No talking-avatar layers/);
  });
});

describe('provider key and CLI', () => {
  const run = (args) =>
    spawnSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      env: { ...process.env, WAVESPEED_API_KEY: '', REPLICATE_API_TOKEN: '', ELEVENLABS_API_KEY: '' },
    });

  it('a real run without WAVESPEED_API_KEY is refused and produces no placeholder', async () => {
    const ws = workspace();
    approve(ws);
    await assert.rejects(synthesizeAvatars(opts(ws, fakeEnv(), { env: {} })), /WAVESPEED_API_KEY/);
    assert.equal(clips(ws.root).length, 0);
  });

  it('prints a usage banner with every flag, and errors on a missing flag value', () => {
    const usage = run([]);
    assert.notEqual(usage.status, 0);
    for (const f of ['--scene', '--dry-run', '--resume', '--force-resubmit', '--allow-model', '--approval', '--cache-dir', '--poll-window', '--avatar-model', '--tts-model', '--image-model']) {
      assert.ok(usage.stderr.includes(f), f);
    }
    assert.match(run(['x.md', '--resume']).stderr, /requires a value/);
    assert.match(run(['x.md', '--poll-window', '0']).stderr, /poll-window/);
  });

  it('rejects --dry-run together with --resume as a usage error', () => {
    const res = run(['x.md', '--dry-run', '--resume', 'task-1']);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /cannot be combined/);
  });

  it('refuses to price audio it cannot measure (exit 1, nothing written)', () => {
    const ws = workspace();
    const res = run([ws.scriptPath, '--dry-run']);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /Cannot measure the audio duration|refusing/);
    assert.ok(!fs.existsSync(path.join(ws.root, '.cognnitive')) || !fs.existsSync(pendingFile(ws)));
  });
});
