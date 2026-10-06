import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_GUARD, SpendGuard, readLedger, sumLedgerSince, validateConfig } from '../scripts/lib/video-guard.mjs';
import { estimateCallUsd, estimateScriptCost, formatAssetPlanMarkdown, PROVIDER_PRICING_CATALOG } from '../scripts/asset-cost-estimator.mjs';
import { collectAvatarJobs, isAvatarLayer, sceneAudioPath } from '../scripts/lib/avatar-jobs.mjs';
import { buildAvatarRequest, MAX_AVATAR_AUDIO_BYTES, MAX_AVATAR_IMAGE_BYTES } from '../scripts/lib/avatar-request.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-hard-')));
const FAST = 'wavespeed-ai/infinitetalk-fast';

describe('maxAvatarSeconds config', () => {
  it('defaults to 300 and is validated', () => {
    assert.equal(DEFAULT_GUARD.maxAvatarSeconds, 300);
    for (const bad of [0, -1, '300', Infinity, null]) {
      assert.throws(() => validateConfig({ ...DEFAULT_GUARD, maxAvatarSeconds: bad }, 'x'), /maxAvatarSeconds/);
    }
  });
});

describe('avatar pricing', () => {
  it('bills ceil(seconds) and prices the non-fast catalog entries at the real rate', () => {
    assert.equal(estimateCallUsd('avatar', FAST, { seconds: 2.1 }), 0.045);
    assert.equal(estimateCallUsd('avatar', FAST, { seconds: 3 }), 0.045);
    assert.equal(PROVIDER_PRICING_CATALOG.avatar['wavespeed-ai/infinitetalk'].unitPricePerSecond, 0.06);
    assert.equal(PROVIDER_PRICING_CATALOG.avatar['wavespeed/infinitetalk'].unitPricePerSecond, 0.06);
  });

  it('an estimator avatar line is labelled an estimate', () => {
    const script = [
      '//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: T', '', '# Scenes', '',
      '## Scene 1: A', '@base Intro', 'Short line.', '',
      '@@ Host', '- layer_type: talking_avatar', '- layer_avatar_model: ' + FAST, '  ![media](media/a.jpeg)', '',
    ].join('\n');
    const md = formatAssetPlanMarkdown(estimateScriptCost(script, {}));
    assert.match(md, /estimate/i);
    assert.match(md, /synthesize-avatar/);
  });
});

describe('isAvatarLayer', () => {
  it('never treats an explicitly typed image or video layer as an avatar, whatever its name', () => {
    assert.equal(isAvatarLayer({ name: 'Avatar Intro', properties: { layer_type: 'video' } }), false);
    assert.equal(isAvatarLayer({ name: 'Avatar Still', properties: { layer_type: 'image' } }), false);
    assert.equal(isAvatarLayer({ name: 'Host Avatar', properties: {} }), false, 'a name alone is not enough');
    assert.equal(isAvatarLayer({ name: 'Host', properties: { layer_type: 'talking_avatar' } }), true);
  });

  it('the estimator does not bill or double-count a video layer named Avatar Intro', () => {
    const script = [
      '//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: T', '', '# Scenes', '',
      '## Scene 1: A', '@base Intro', 'Narration here for the scene.', '- scene_duration: 3.0', '',
      '@@ Avatar Intro', '- layer_type: video', '  ![media](../shared/intro.mp4)', '',
    ].join('\n');
    const e = estimateScriptCost(script, {});
    assert.equal(e.summary.totalAvatars, 0);
    assert.ok(!e.planModels.includes(FAST));
  });
});

describe('collectAvatarJobs input checks (all before any spend)', () => {
  const setup = (layerLines) => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'media'));
    fs.mkdirSync(path.join(dir, 'audio'));
    fs.writeFileSync(path.join(dir, 'media', 'a.gif'), 'x');
    fs.writeFileSync(path.join(dir, 'media', 'a.jpeg'), 'x');
    const script = ['//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: T', '', '# Scenes', '', '## Scene 1: A', '@base Intro', 'Hello.', '',
      '@@ Host', '- layer_type: talking_avatar', ...layerLines, ''].join('\n');
    const parsed = new RemotionSceneCompiler({}).parseScript(script);
    fs.writeFileSync(path.join(dir, 'audio', parsed.scenes[0].id + '_voiceover.mp3'), 'audio');
    const cacheManager = new CacheManager({ baseDir: path.join(dir, 'cache') });
    return { dir, parsed, cacheManager, resolveModel: () => FAST };
  };

  it('rejects an image whose extension is not jpg/jpeg/png/webp', () => {
    const c = setup(['  ![media](media/a.gif)']);
    const { problems } = collectAvatarJobs({ ...c, scriptDir: c.dir });
    assert.match(problems.join(' '), /extension|jpg|png/i);
  });

  it('explains that a prompt-only avatar layer needs its image generated first', () => {
    const c = setup(['- layer_prompt: "a friendly host"']);
    const { problems } = collectAvatarJobs({ ...c, scriptDir: c.dir });
    assert.match(problems.join(' '), /prompt/i);
    assert.match(problems.join(' '), /compile/i);
  });

  it('uses the staged TTS audio first when the scene has narration, else the explicit source', () => {
    const c = setup(['  ![media](media/a.jpeg)']);
    const sc = c.parsed.scenes[0];
    const withProp = { ...sc, properties: { ...sc.properties, audio_asset_source: 'other.mp3' } };
    assert.equal(sceneAudioPath({ ...withProp, narration: 'Hello.' }, c.dir), path.join(c.dir, 'audio', sc.id + '_voiceover.mp3'));
    assert.equal(sceneAudioPath({ ...withProp, narration: '' }, c.dir), path.join(c.dir, 'other.mp3'));
  });
});

describe('buildAvatarRequest', () => {
  const files = () => {
    const dir = tmp();
    const image = path.join(dir, 'a.jpeg');
    const audio = path.join(dir, 'a.mp3');
    fs.writeFileSync(image, 'imagebytes');
    fs.writeFileSync(audio, 'audiobytes');
    return { dir, image, audio };
  };

  it('inlines both files as data URIs with the right MIME and the resolution', () => {
    const f = files();
    const body = buildAvatarRequest({ imagePath: f.image, audioPath: f.audio, resolution: '720p' });
    assert.match(body.image, /^data:image\/jpeg;base64,/);
    assert.match(body.audio, /^data:audio\/mpeg;base64,/);
    assert.equal(body.resolution, '720p');
  });

  it('rejects unknown extensions, missing files and oversized inputs with clear errors', () => {
    const f = files();
    const odd = path.join(f.dir, 'a.xyz');
    fs.writeFileSync(odd, 'x');
    const base = { audioPath: f.audio, resolution: '720p' };
    assert.throws(() => buildAvatarRequest({ ...base, imagePath: odd }), /MIME|extension/i);
    assert.throws(() => buildAvatarRequest({ ...base, imagePath: path.join(f.dir, 'nope.jpg') }), /not found/i);
    assert.throws(() => buildAvatarRequest({ ...base, imagePath: f.image, limits: { imageBytes: 3, audioBytes: 99 } }), /too large|limit/i);
    assert.ok(MAX_AVATAR_IMAGE_BYTES > 0 && MAX_AVATAR_AUDIO_BYTES > 0);
  });
});

describe('pre-task rejection refund', () => {
  it('a refunded failure does not count toward the daily cap or the run budget', async () => {
    const root = tmp();
    const config = { ...structuredClone(DEFAULT_GUARD), budgetPerRunUsd: 5, dailyCapUsd: 5 };
    const guard = new SpendGuard({ config, root, approval: () => ({ ok: true }) });
    const ticket = await guard.authorize({ kind: 'avatar', model: FAST, estUsd: 0.5, ref: 'x' });
    assert.equal(guard.budget.totalUsd, 0.5);
    ticket.settle('failed', 'HTTP 400', { refundUsd: 0.5 });
    assert.equal(sumLedgerSince(root, Date.now() - 1000), 0);
    assert.equal(guard.budget.totalUsd, 0);
    assert.equal(readLedger(root).at(-1).outcome, 'failed');
  });
});
