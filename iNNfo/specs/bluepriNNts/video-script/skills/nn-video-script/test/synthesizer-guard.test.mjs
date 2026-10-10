import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AssetSynthesizer, BillingFailureError } from '../scripts/asset-synthesizer.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';
import { TTSGenerator } from '../scripts/tts-generator.mjs';
import {
  ApprovalRequiredError,
  BudgetExceededError,
  ModelBlockedError,
  SpendGuard,
  DEFAULT_GUARD,
  readLedger,
} from '../scripts/lib/video-guard.mjs';

const TTS = 'minimax/speech-2.8-hd';
const FAST = 'wavespeed-ai/infinitetalk-fast';
const SLOW = 'wavespeed-ai/infinitetalk';
const IMG = 'wavespeed-ai/z-image/turbo';
const approvedOk = () => ({ ok: true });

function setup(configOverrides = {}, guardOpts = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'synth-guard-')));
  const config = { ...structuredClone(DEFAULT_GUARD), ...configOverrides };
  const guard = new SpendGuard({ config, root, approval: approvedOk, ...guardOpts });
  const cacheManager = new CacheManager({ baseDir: path.join(root, 'cache') });
  return { root, guard, cacheManager };
}

const MP4_BYTES = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom0000')]);

/** Fake WaveSpeed/Replicate: records every request, never touches the network. */
function fakeProvider({ never = false, status = 'completed', holdUntilInFlight = 0 } = {}) {
  const state = { posts: [], bodies: [], urls: [], inFlight: 0, peak: 0 };
  const fetch = async (url, init = {}) => {
    const u = String(url);
    state.urls.push(u);
    if (init.method === 'POST') {
      state.posts.push(u);
      state.bodies.push(init.body ? JSON.parse(init.body) : null);
      state.inFlight++;
      state.peak = Math.max(state.peak, state.inFlight);
      return { ok: true, status: 200, json: async () => ({ data: { id: 'task-77' }, urls: { get: 'https://api.replicate.com/poll' } }) };
    }
    if (u.includes('/predictions/') || u.includes('replicate.com/poll')) {
      const body = never ? { data: { status: 'processing' } } : { data: { status, outputs: ['https://cdn.fake/out.bin'] } };
      return { ok: true, status: 200, json: async () => body };
    }
    // Keep the request in flight long enough for concurrency to be observable. A fixed 5 ms
    // window lost the race on CI (the lock layer sleeps 25 ms between retries), so a test that
    // asserts a peak can instead hold the download until that many requests overlap (bounded,
    // so a serializing guard still fails the assertion rather than hanging).
    const t0 = Date.now();
    do {
      await new Promise((r) => setTimeout(r, 5));
    } while (state.inFlight < holdUntilInFlight && Date.now() - t0 < 300);
    state.inFlight--;
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(MP4_BYTES).buffer };
  };
  return { state, fetch };
}

const env = { WAVESPEED_API_KEY: 'fake-key-not-real' };

/** Real (tiny) input files: avatar requests fail closed on missing files. */
const AV_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'synth-av-files-'));
const P = (name) => {
  const p = path.join(AV_DIR, name);
  if (!fs.existsSync(p)) fs.writeFileSync(p, 'x');
  return p;
};

function makeSynth(ctx, provider, extra = {}) {
  return new AssetSynthesizer({
    cacheManager: ctx.cacheManager,
    guard: ctx.guard,
    env,
    fetch: provider.fetch,
    sleep: async () => {},
    ttsProvider: 'minimax',
    ...extra,
  });
}

const started = (root) => readLedger(root).filter((e) => e.outcome === 'started');
const outcomes = (root) => readLedger(root).map((e) => e.outcome);

describe('billable TTS through the guard', () => {
  it('ledgers started+ok per billable call, records the cache hit, and never regenerates', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    const line = 'Hola mundo, esto es una prueba.';
    const first = await synth.synthesizeTTS(line, { model: TTS }, { ref: 'scene-1' });
    assert.equal(first.fromCache, false);
    const second = await synth.synthesizeTTS(line, { model: TTS }, { ref: 'scene-1' });
    assert.equal(second.fromCache, true);
    assert.equal(provider.state.posts.length, 1, 'the identical line must not be regenerated');
    const lines = readLedger(ctx.root);
    assert.deepEqual(outcomes(ctx.root), ['started', 'ok', 'cache-hit']);
    assert.equal(started(ctx.root)[0].model, TTS);
    assert.equal(started(ctx.root)[0].ref, 'scene-1');
    assert.ok(started(ctx.root)[0].estUsd > 0);
    assert.equal(lines[2].cacheHit, true);
  });

  it('throws BudgetExceededError before any network call when the budget would be exceeded', async () => {
    const ctx = setup({ budgetPerRunUsd: 0.0001 });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    const text = 'Una linea de narracion suficientemente larga para costar algo.';
    await assert.rejects(synth.synthesizeTTS(text, { model: TTS }), BudgetExceededError);
    assert.equal(provider.state.posts.length, 0);
    assert.equal(started(ctx.root).length, 0);
  });

  it('refuses an unlisted model loudly (never swallowed by a fallback)', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    await assert.rejects(synth.synthesizeTTS('texto', { model: 'some/unlisted-tts' }), ModelBlockedError);
    assert.equal(provider.state.posts.length, 0);
  });

  it('is free and unledgered when no provider key is configured', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider, { env: {}, ttsProvider: 'local' });
    const res = await synth.synthesizeTTS('texto local');
    assert.equal(res.fromCache, false);
    assert.equal(provider.state.posts.length, 0);
    assert.equal(started(ctx.root).length, 0);
  });

  it('uses the default model flag when the call does not name a provider model', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider, { defaultModels: { tts: 'minimax/speech-2.8-hd' } });
    await synth.synthesizeTTS('linea sin modelo', { model: 'elevenlabs' });
    assert.ok(provider.state.posts[0].endsWith('/' + TTS));
    const other = setup({ allowedModels: [...DEFAULT_GUARD.allowedModels, 'custom/tts'] });
    const synth2 = makeSynth(other, provider, { defaultModels: { tts: 'custom/tts' } });
    await synth2.synthesizeTTS('linea sin modelo', { model: 'elevenlabs' });
    assert.ok(provider.state.posts[1].endsWith('/custom/tts'));
  });
});

describe('billing-safe failure handling', () => {
  it('a poll timeout throws with the task id, caches nothing and settles the ledger as failed', async () => {
    const ctx = setup();
    const provider = fakeProvider({ never: true });
    const synth = makeSynth(ctx, provider);
    await assert.rejects(
      synth.synthesizeTTS('linea que nunca termina', { model: TTS }),
      (err) => err instanceof BillingFailureError && err.taskId === 'task-77' && /task-77/.test(err.message),
    );
    assert.equal(fs.readdirSync(path.join(ctx.cacheManager.baseDir, 'tts')).length, 0, 'no stub may be cached');
    assert.deepEqual(outcomes(ctx.root), ['started', 'failed']);
    // a retry bills again only because the user retried; it is not auto-retried inside one call
    assert.equal(provider.state.posts.length, 1);
  });

  it('a failed task status throws instead of caching a placeholder', async () => {
    const ctx = setup();
    const provider = fakeProvider({ status: 'failed' });
    const synth = makeSynth(ctx, provider);
    await assert.rejects(synth.synthesizeTTS('linea fallida', { model: TTS }), BillingFailureError);
    assert.equal(fs.readdirSync(path.join(ctx.cacheManager.baseDir, 'tts')).length, 0);
  });

  it('an image timeout never falls through to a second provider or caches an SVG', async () => {
    const ctx = setup();
    const provider = fakeProvider({ never: true });
    const synth = makeSynth(ctx, provider, { env: { WAVESPEED_API_KEY: 'k', REPLICATE_API_TOKEN: 'r' } });
    await assert.rejects(synth.resolveMedia('a diagram', { model: IMG }), BillingFailureError);
    assert.equal(provider.state.posts.length, 1);
    assert.ok(provider.state.urls.every((u) => !u.includes('replicate.com')), 'no second provider call');
    assert.equal(fs.readdirSync(path.join(ctx.cacheManager.baseDir, 'images')).length, 0);
    assert.equal(started(ctx.root).length, 1);
  });

  it('single-flights concurrent identical TTS lines and identical images', async () => {
    const ctx = setup({ budgetPerRunUsd: 50 });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    await Promise.all([
      synth.synthesizeTTS('misma linea', { model: TTS }),
      synth.synthesizeTTS('misma linea', { model: TTS }),
      synth.synthesizeTTS('misma linea', { model: TTS }),
    ]);
    await Promise.all([synth.resolveMedia('same prompt', { model: IMG }), synth.resolveMedia('same prompt', { model: IMG })]);
    assert.equal(provider.state.posts.length, 2, 'one TTS and one image request');
    assert.equal(started(ctx.root).length, 2);
  });

  it('a media request without any key is free local composition', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider, { env: {} });
    const res = await synth.resolveMedia('local prompt', { model: IMG });
    assert.equal(res.fromCache, false);
    assert.equal(provider.state.posts.length, 0);
  });
});

describe('approval, caps and fail-closed default', () => {
  const notApproved = () => ({ ok: false, reason: 'missing', message: 'No approved plan found. Run approve-plan.' });

  it('refuses a cache miss without approval, spending nothing', async () => {
    const ctx = setup({}, { approval: notApproved });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    await assert.rejects(
      synth.synthesizeTTS('linea nueva', { model: TTS }),
      (err) => err instanceof ApprovalRequiredError && /approve-plan/.test(err.message),
    );
    assert.equal(provider.state.posts.length, 0);
    assert.equal(started(ctx.root).length, 0);
  });

  it('still serves cache hits without approval', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    await makeSynth(ctx, provider).synthesizeTTS('linea cacheada', { model: TTS });
    const gated = setup({}, { approval: notApproved });
    const synth = makeSynth({ ...ctx, guard: gated.guard }, provider);
    const res = await synth.synthesizeTTS('linea cacheada', { model: TTS });
    assert.equal(res.fromCache, true);
  });

  it('caps the run at 1.25x the approved total', async () => {
    const approval = () => ({ ok: true, approval: { totalUsd: 0.001, allowedModels: [TTS], allowModels: [] } });
    const ctx = setup({ budgetPerRunUsd: 50 }, { approval });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    const text = 'x'.repeat(2000);
    await assert.rejects(synth.synthesizeTTS(text, { model: TTS }), BudgetExceededError);
    assert.equal(provider.state.posts.length, 0);
  });

  it('refuses a model that the approval did not cover', async () => {
    const approval = () => ({ ok: true, approval: { totalUsd: 10, allowedModels: [TTS], allowModels: [] } });
    const ctx = setup({}, { approval });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    await assert.rejects(synth.resolveMedia('a prompt', { model: IMG }), ApprovalRequiredError);
    assert.equal(provider.state.posts.length, 0);
  });

  it('TTSGenerator without an explicit guard fails closed on billable calls', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tts-gen-')));
    const provider = fakeProvider();
    const gen = new TTSGenerator({ baseDir: path.join(root, 'cache'), env, fetch: provider.fetch, sleep: async () => {}, ttsProvider: 'minimax' });
    await assert.rejects(gen.generate('hola', { model: TTS }), ApprovalRequiredError);
    assert.equal(provider.state.posts.length, 0);
  });

  it('a bare AssetSynthesizer also fails closed, but stays free without keys', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bare-synth-')));
    const cacheManager = new CacheManager({ baseDir: path.join(root, 'cache') });
    const provider = fakeProvider();
    const paid = new AssetSynthesizer({ cacheManager, env, fetch: provider.fetch, sleep: async () => {}, ttsProvider: 'minimax' });
    await assert.rejects(paid.synthesizeTTS('hola', { model: TTS }), ApprovalRequiredError);
    const free = new AssetSynthesizer({ cacheManager, env: {}, fetch: provider.fetch });
    assert.equal((await free.synthesizeTTS('hola gratis')).fromCache, false);
    assert.equal(provider.state.posts.length, 0);
  });
});

describe('dry run', () => {
  it('lists billable work, spends nothing and writes nothing', async () => {
    const ctx = setup({}, { dryRun: true });
    const readOnly = new CacheManager({ baseDir: path.join(ctx.root, 'ro-cache'), readOnly: true });
    const provider = fakeProvider();
    const before = fs.readdirSync(ctx.root);
    const synth = makeSynth({ ...ctx, cacheManager: readOnly }, provider);
    const res = await synth.synthesizeTTS('linea para planear', { model: TTS }, { ref: 's1' });
    assert.equal(res.dryRun, true);
    assert.equal(provider.state.posts.length, 0);
    assert.deepEqual(fs.readdirSync(ctx.root), before, 'a dry run must not create any file or directory');
    assert.equal(ctx.guard.planned.length, 1);
    assert.equal(ctx.guard.planned[0].ref, 's1');
    assert.ok(ctx.guard.plannedTotalUsd > 0);
  });

  it('plans a repeated line once (it would be a cache hit after the first synthesis)', async () => {
    const ctx = setup({}, { dryRun: true });
    const synth = makeSynth(ctx, fakeProvider());
    await synth.synthesizeTTS('misma linea', { model: TTS });
    await synth.synthesizeTTS('misma linea', { model: TTS });
    assert.equal(ctx.guard.planned.length, 1);
  });

  it('reports a blocked model instead of throwing', async () => {
    const ctx = setup({}, { dryRun: true });
    const synth = makeSynth(ctx, fakeProvider());
    await synth.resolveTalkingAvatar(P('img.png'), P('a.mp3'), { model: SLOW, durationSeconds: 5 });
    assert.match(ctx.guard.planned[0].blocked, /blocked/);
  });
});

describe('avatar jobs', () => {
  it('refuses the blocked non-fast model unless explicitly allowed', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    const opts = { model: SLOW, durationSeconds: 5 };
    await assert.rejects(synth.resolveTalkingAvatar(P('img.png'), P('a.mp3'), opts), ModelBlockedError);
    assert.equal(provider.state.posts.length, 0);
    const allowed = setup({}, { allowModels: [SLOW] });
    const res = await makeSynth(allowed, provider).resolveTalkingAvatar(P('img.png'), P('a.mp3'), opts);
    assert.equal(res.fromCache, false);
    assert.equal(provider.state.posts.length, 1);
  });

  it('runs concurrent avatar jobs one at a time (maxAvatarConcurrency 1)', async () => {
    const ctx = setup({ budgetPerRunUsd: 50, dailyCapUsd: 50 });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    const jobs = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) =>
      synth.resolveTalkingAvatar(P('img.png'), P(n + '.mp3'), { model: FAST, durationSeconds: 4 }),
    );
    await Promise.all(jobs);
    assert.equal(provider.state.posts.length, 6);
    assert.equal(provider.state.peak, 1);
  });

  it('honours a higher maxAvatarConcurrency', async () => {
    const ctx = setup({ budgetPerRunUsd: 50, dailyCapUsd: 50, maxAvatarConcurrency: 2 });
    const provider = fakeProvider({ holdUntilInFlight: 2 });
    const synth = makeSynth(ctx, provider);
    const names = ['a', 'b', 'c', 'd'];
    await Promise.all(names.map((n) => synth.resolveTalkingAvatar(P('img.png'), P(n + '.mp3'), { model: FAST, durationSeconds: 4 })));
    assert.equal(provider.state.peak, 2);
  });

  it('serializes avatar jobs across separate guards (processes) sharing a workspace root', async () => {
    const a = setup({ budgetPerRunUsd: 50, dailyCapUsd: 50 });
    const b = setup({ budgetPerRunUsd: 50, dailyCapUsd: 50 });
    const guardB = new SpendGuard({ config: b.guard.config, root: a.root, approval: approvedOk });
    const provider = fakeProvider();
    const s1 = makeSynth(a, provider);
    const s2 = makeSynth({ ...b, guard: guardB }, provider);
    const opts = { model: FAST, durationSeconds: 4 };
    await Promise.all([
      s1.resolveTalkingAvatar(P('img.png'), P('x.mp3'), opts),
      s2.resolveTalkingAvatar(P('img.png'), P('y.mp3'), opts),
      s1.resolveTalkingAvatar(P('img.png'), P('z.mp3'), opts),
      s2.resolveTalkingAvatar(P('img.png'), P('w.mp3'), opts),
    ]);
    assert.equal(provider.state.posts.length, 4);
    assert.equal(provider.state.peak, 1);
  });

  it('does not double-bill two concurrent requests for the same avatar', async () => {
    const ctx = setup({ budgetPerRunUsd: 50 });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    const args = [P('img.png'), P('same.mp3'), { model: FAST, durationSeconds: 4 }];
    await Promise.all([synth.resolveTalkingAvatar(...args), synth.resolveTalkingAvatar(...args)]);
    assert.equal(provider.state.posts.length, 1);
  });
});

describe('registered voices', () => {
  const withVoices = (voices) => setup({ voices });

  it('sends the registered voice id instead of the default voice', async () => {
    const ctx = withVoices({ Ana: { voice_id: 'voice_ana_1', series: 's' } });
    const provider = fakeProvider();
    await makeSynth(ctx, provider).synthesizeTTS('hola', { model: TTS, voice: 'Ana' });
    assert.equal(provider.state.bodies[0].voice_id, 'voice_ana_1');
  });

  it('keeps the default voice when no voice is named, and fails loudly for an unknown or pending name', async () => {
    const ctx = withVoices({ Pend: { voice_id: '', series: 's', pending: true } });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    await synth.synthesizeTTS('hola', { model: TTS, voice: 'default' });
    assert.equal(provider.state.bodies[0].voice_id, 'Friendly_Person');
    await assert.rejects(synth.synthesizeTTS('otra', { model: TTS, voice: 'Nobody' }), /not registered/);
    await assert.rejects(synth.synthesizeTTS('otra mas', { model: TTS, voice: 'Pend' }), /pending/);
    assert.equal(provider.state.posts.length, 1);
  });

  it('a re-cloned voice id changes the cache key (no stale audio from the old voice)', async () => {
    const one = withVoices({ Ana: { voice_id: 'v1', series: 's' } });
    const two = { ...one, guard: new SpendGuard({ config: { ...one.guard.config, voices: { Ana: { voice_id: 'v2', series: 's' } } }, root: one.root, approval: approvedOk }) };
    const provider = fakeProvider();
    await makeSynth(one, provider).synthesizeTTS('hola', { model: TTS, voice: 'Ana' });
    const res = await makeSynth(two, provider).synthesizeTTS('hola', { model: TTS, voice: 'Ana' });
    assert.equal(res.fromCache, false);
    assert.equal(provider.state.bodies[1].voice_id, 'v2');
  });
});

describe('Replicate image path', () => {
  it('is authorized as its own billable call and fails loudly on timeout (no SVG cached)', async () => {
    const ctx = setup({}, {});
    const provider = fakeProvider({ never: true });
    const synth = makeSynth(ctx, provider, { env: { REPLICATE_API_TOKEN: 'fake-token-not-real' } });
    await assert.rejects(synth.resolveMedia('a diagram', {}), BillingFailureError);
    assert.equal(started(ctx.root)[0].model, 'black-forest-labs/flux-schnell');
    assert.equal(fs.readdirSync(path.join(ctx.cacheManager.baseDir, 'images')).length, 0);
  });
});

describe('system voices and lookup by voice_id', () => {
  const run = async (voices, voice, extraConfig = {}) => {
    const ctx = setup({ voices, ...extraConfig });
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    await synth.synthesizeTTS('hola', { model: TTS, voice });
    return provider.state.bodies[0].voice_id;
  };

  it('sends provider-native system voices as-is, without registration', async () => {
    for (const v of ['Friendly_Person', 'Wise_Woman', 'Deep_Voice_Man', 'English_Deep-VoicedGentleman']) {
      assert.equal(await run({}, v), v);
    }
  });

  it('honours a custom systemVoices list (exact names and a trailing * glob)', async () => {
    assert.equal(await run({}, 'Narrator_7', { systemVoices: ['Narrator_*'] }), 'Narrator_7');
    await assert.rejects(run({}, 'Friendly_Person', { systemVoices: ['Narrator_*'] }), /not registered/);
  });

  it('still fails for a name that is neither a system voice nor registered, and for pending entries', async () => {
    await assert.rejects(run({}, 'Nobody'), /not registered/);
    await assert.rejects(run({ Pend: { voice_id: '', series: 's', pending: true } }, 'Pend'), /pending/);
    await assert.rejects(run({ Pend: { voice_id: 'x1', series: 's', pending: true } }, 'x1'), /pending|not registered/);
  });

  it('resolves a script voice by registry key OR by an entry voice_id (exact, case-sensitive)', async () => {
    const voices = { Presenter01: { voice_id: 'voiceId01', series: 's' } };
    assert.equal(await run(voices, 'Presenter01'), 'voiceId01');
    assert.equal(await run(voices, 'voiceId01'), 'voiceId01');
    await assert.rejects(run(voices, 'VOICEID01'), /not registered/);
  });

  it('keeps the cache key of system voices unchanged (no re-billing of cached lines)', async () => {
    const ctx = setup({});
    const provider = fakeProvider();
    const synth = makeSynth(ctx, provider);
    const options = { model: TTS, voice: 'Friendly_Person' };
    const first = await synth.synthesizeTTS('misma', options);
    assert.equal(first.sha256, ctx.cacheManager.computeHash('misma', options));
  });
});

describe('model aliases in the synthesizer', () => {
  it('calls the normalized WaveSpeed route for a replicate/-prefixed TTS model and ledgers it', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    await makeSynth(ctx, provider).synthesizeTTS('hola', { model: 'replicate/minimax/speech-2.8-hd' });
    assert.ok(provider.state.posts[0].endsWith('/api/v3/minimax/speech-2.8-hd'), provider.state.posts[0]);
    assert.equal(started(ctx.root)[0].model, TTS);
  });

  it('a replicate/-prefixed alias of a blocked model is still blocked', async () => {
    const ctx = setup();
    const provider = fakeProvider();
    const opts = { model: 'replicate/wavespeed-ai/infinitetalk', durationSeconds: 5 };
    await assert.rejects(makeSynth(ctx, provider).resolveTalkingAvatar(P('img.png'), P('a.mp3'), opts), ModelBlockedError);
    assert.equal(provider.state.posts.length, 0);
  });
});
