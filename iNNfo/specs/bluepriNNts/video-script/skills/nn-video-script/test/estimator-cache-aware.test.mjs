#!/usr/bin/env node

/**
 * nn-video-script/test/estimator-cache-aware.test.mjs
 *
 * The estimate is the spend gate: it must price what the run will charge. An item the
 * cache already satisfies costs $0 (same keys compile writes, cache opened read-only),
 * an image is quoted only when it has a prompt, and the plan text states only true things
 * (in-chat approval phrase, the resolved models, no checklist, no hard-coded tier).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estimateScriptCost, formatAssetPlanMarkdown } from '../scripts/asset-cost-estimator.mjs';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { loadKnowledgeModel } from '../scripts/lib/knowledge-model.mjs';
import { loadCascadeBags, withScriptPresets } from '../scripts/lib/video-scope.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';
import { buildTtsVoiceOptions, resolveRegisteredVoice } from '../scripts/lib/tts-options.mjs';
import { buildImageOptions } from '../scripts/lib/image-options.mjs';
import { collectAvatarJobs } from '../scripts/lib/avatar-jobs.mjs';
import { computePlanHash, checkApproval } from '../scripts/lib/plan-approval.mjs';

const TTS_MODEL = 'minimax/speech-2.8-hd';
const NARRATION = 'Welcome to the demo of the cache aware estimator.';

const doc = (narration = NARRATION, voice = 'demo-voice', voiceModel = TTS_MODEL, layers = '') => `---
level: 3
parent_spec:
  name: "video-script_V_0-1-0"
  url: "https://example.invalid/video-script/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Demo Clip"
---

# NN Video

## NN Video: Demo Clip
slug:: demo-clip
title:: Demo Clip

# NN Scene

## NN Scene: Opening
slug:: opening
voice:: ${voice}
voice_model:: ${voiceModel}

${narration}

# NN Layer
${layers}`;

const PROMPT_LAYER = `
## NN Layer: Barn
slug:: barn
type:: background
prompt:: a red barn at dawn
`;

const ASSET_LAYER = `
## NN Layer: Photo
slug:: photo
type:: background
asset:: media/photo.png
`;

const AVATAR_LAYER = `
## NN Layer: Host
slug:: host
type:: presenter
asset:: media/face.jpeg
`;

function setup(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'est-cache-'));
  fs.mkdirSync(path.join(dir, 'media'));
  fs.writeFileSync(path.join(dir, 'media', 'face.jpeg'), Buffer.from('face'));
  const scriptPath = path.join(dir, 'script_NN.md');
  fs.writeFileSync(scriptPath, source, 'utf8');
  const cacheDir = path.join(dir, 'cache');
  const writer = new CacheManager({ baseDir: cacheDir });
  return { dir, scriptPath, cacheDir, writer };
}

/** The lowered script exactly as the estimator and compile see it (no CLI overrides). */
function lower(scriptPath) {
  const model = loadKnowledgeModel(scriptPath);
  const bags = withScriptPresets({ ...loadCascadeBags(path.dirname(scriptPath)), cli: {} }, model, scriptPath);
  return new SceneCompiler({}).lowerKnowledgeModel(model, { bags });
}

const config = { voices: {} };
const ttsKey = (cm, sc) => cm.computeHash(sc.narration.trim(), resolveRegisteredVoice(buildTtsVoiceOptions(sc, {}, {}), config));
const seedTts = (writer, scriptPath) => {
  const sc = lower(scriptPath).scenes[0];
  return writer.putSync(ttsKey(writer, sc), 'mp3', Buffer.from('tts-bytes'), 'tts');
};
const seedImage = (writer, scriptPath) => {
  const sc = lower(scriptPath).scenes[0];
  const layer = sc.layers.find((l) => l.properties.layer_prompt);
  return writer.putSync(writer.computeHash(layer.properties.layer_prompt, buildImageOptions(sc, layer, {})), 'png', Buffer.from('img'), 'images');
};
const listing = (dir) => fs.readdirSync(dir, { recursive: true }).sort();
const done = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test('uncached items are priced as before', () => {
  const { dir, scriptPath, cacheDir } = setup(doc(NARRATION, 'demo-voice', TTS_MODEL, PROMPT_LAYER));
  try {
    const est = estimateScriptCost(scriptPath, { cacheDir });
    assert.ok(est.summary.totalTtsCost > 0);
    assert.ok(est.summary.totalImageCost > 0);
    assert.equal(est.summary.grandTotalCost, est.summary.totalTtsCost + est.summary.totalImageCost);
  } finally {
    done(dir);
  }
});

test('a cached narration and a cached image are priced at $0 and drop the total', () => {
  const { dir, scriptPath, cacheDir, writer } = setup(doc(NARRATION, 'demo-voice', TTS_MODEL, PROMPT_LAYER));
  try {
    const before = estimateScriptCost(scriptPath, { cacheDir });
    seedTts(writer, scriptPath);
    const ttsOnly = estimateScriptCost(scriptPath, { cacheDir });
    assert.equal(ttsOnly.summary.totalTtsCost, 0);
    assert.equal(ttsOnly.scenes[0].ttsCached, true);
    assert.equal(ttsOnly.summary.grandTotalCost, before.summary.totalImageCost);
    seedImage(writer, scriptPath);
    const all = estimateScriptCost(scriptPath, { cacheDir });
    assert.equal(all.summary.totalImageCost, 0);
    assert.equal(all.scenes[0].imageCached, 1);
    assert.equal(all.summary.grandTotalCost, 0);
  } finally {
    done(dir);
  }
});

test('changing narration, voice or voice_model makes the entry a miss again', () => {
  const base = doc(NARRATION);
  const { dir, scriptPath, cacheDir, writer } = setup(base);
  try {
    seedTts(writer, scriptPath);
    assert.equal(estimateScriptCost(scriptPath, { cacheDir }).summary.totalTtsCost, 0);
    for (const changed of [doc(NARRATION + ' More.'), doc(NARRATION, 'other-voice'), doc(NARRATION, 'demo-voice', 'minimax/speech-2.8-turbo')]) {
      fs.writeFileSync(scriptPath, changed, 'utf8');
      assert.ok(estimateScriptCost(scriptPath, { cacheDir }).summary.totalTtsCost > 0);
    }
  } finally {
    done(dir);
  }
});

test('a --tts-model override joins the key: the default-key entry no longer matches', () => {
  const { dir, scriptPath, cacheDir, writer } = setup(doc());
  try {
    seedTts(writer, scriptPath);
    const est = estimateScriptCost(scriptPath, { cacheDir, defaultTtsModel: 'minimax/speech-2.8-turbo' });
    assert.ok(est.summary.totalTtsCost > 0);
  } finally {
    done(dir);
  }
});

test('the estimator reads the cache read-only and writes nothing', () => {
  const { dir, scriptPath, cacheDir, writer } = setup(doc(NARRATION, 'demo-voice', TTS_MODEL, PROMPT_LAYER));
  try {
    seedTts(writer, scriptPath);
    const before = listing(dir);
    estimateScriptCost(scriptPath, { cacheDir });
    assert.deepEqual(listing(dir), before);
    // A cache dir that does not exist is not created by an estimate.
    const missing = path.join(dir, 'no-such-cache');
    estimateScriptCost(scriptPath, { cacheDir: missing });
    assert.equal(fs.existsSync(missing), false);
  } finally {
    done(dir);
  }
});

test('an image layer without a prompt is not quoted', () => {
  const { dir, scriptPath, cacheDir } = setup(doc(NARRATION, 'demo-voice', TTS_MODEL, ASSET_LAYER));
  try {
    const est = estimateScriptCost(scriptPath, { cacheDir });
    assert.equal(est.summary.totalImageCost, 0);
    assert.equal(est.summary.totalImages, 0);
  } finally {
    done(dir);
  }
});

test('an avatar whose clip is cached is not charged', () => {
  const { dir, scriptPath, cacheDir, writer } = setup(doc(NARRATION, 'demo-voice', TTS_MODEL, AVATAR_LAYER));
  try {
    const uncached = estimateScriptCost(scriptPath, { cacheDir });
    assert.ok(uncached.summary.totalAvatarCost > 0);
    const audioPath = seedTts(writer, scriptPath);
    // Audio cached but no clip yet: the avatar is still charged.
    assert.ok(estimateScriptCost(scriptPath, { cacheDir }).summary.totalAvatarCost > 0);
    const { jobs } = collectAvatarJobs({ parsed: lower(scriptPath), scriptDir: dir, cacheManager: writer, config, models: {}, bags: {} });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].audioPath, audioPath);
    writer.putSync(jobs[0].cacheKey, 'mp4', Buffer.from('clip'), 'temp');
    const est = estimateScriptCost(scriptPath, { cacheDir });
    assert.equal(est.summary.totalAvatarCost, 0);
    assert.equal(est.scenes[0].avatarCached, true);
    assert.equal(est.summary.grandTotalCost, 0);
  } finally {
    done(dir);
  }
});

test('the plan text is truthful: in-chat phrase, resolved models, no checklist or hard-coded tier', () => {
  const { dir, scriptPath, cacheDir } = setup(doc(NARRATION, 'demo-voice', TTS_MODEL, PROMPT_LAYER));
  try {
    const est = estimateScriptCost(scriptPath, { cacheDir });
    const md = formatAssetPlanMarkdown(est);
    const hash8 = est.planHash.slice(0, 8);
    assert.ok(md.includes('approve the plan ' + hash8));
    assert.ok(!md.includes('approve-plan.mjs <this file>'));
    assert.ok(!md.includes('- [ ]'));
    assert.ok(!md.includes('Recommended'));
    assert.ok(!md.includes('Speech 2.5 HD'));
    assert.ok(md.includes(TTS_MODEL), 'lists the TTS model that actually resolved');
    for (const m of est.planModels) assert.ok(md.includes('`' + m + '`'), m);
  } finally {
    done(dir);
  }
});

test('the checkApproval hint carries the same in-chat phrase', () => {
  const script = doc();
  const res = checkApproval({ scriptContent: script, approvalPath: path.join(os.tmpdir(), 'est-cache-missing', 'x.json') });
  assert.equal(res.ok, false);
  assert.ok(res.message.includes('approve the plan ' + computePlanHash(script, {}).slice(0, 8)));
});
