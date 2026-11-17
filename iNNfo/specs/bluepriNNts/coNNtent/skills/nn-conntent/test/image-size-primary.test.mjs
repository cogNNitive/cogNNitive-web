#!/usr/bin/env node

/**
 * nn-conntent/test/image-size-primary.test.mjs
 *
 * Spec S4: AI images are generated in the primary format's aspect. Unless `image_size` is
 * set explicitly it derives from `output_formats[0]`; when the Model's catalog `sizes`
 * lack that aspect the nearest supported size is picked deterministically and disclosed
 * in the estimate. The provider request honors the resolved size (R2): WaveSpeed gets
 * `W*H`, Replicate the matching `aspect_ratio`, and the offline placeholder follows it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveImageSize, nearestImageSize, imageModelsFor, buildImageOptions } from '../scripts/lib/image-options.mjs';
import { translateIntent } from '../scripts/adapters/_intent.mjs';
import { AssetSynthesizer } from '../scripts/asset-synthesizer.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';
import { SpendGuard, DEFAULT_GUARD } from '../scripts/lib/video-guard.mjs';
import { readImageSize } from '../scripts/lib/image-size.mjs';
import { estimateScriptCost, formatAssetPlanMarkdown } from '../scripts/asset-cost-estimator.mjs';
import { loadMergedCatalog } from '../scripts/lib/catalog.mjs';

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) delete process.env[k];

const WIDE = { width: 1920, height: 1080 };
const TALL = { width: 1080, height: 1920 };
const SQUARE = { width: 1080, height: 1080 };

/** A catalog with one image Model per shape of `sizes` the resolver must handle. */
const catalog = {
  models: {
    multi: { slug: 'multi', api_id: 'v/multi', capability: 'image', controls: ['size'], sizes: ['1024x1024', '1344x768', '768x1344'] },
    square: { slug: 'square', api_id: 'v/square', capability: 'image', controls: ['size'], sizes: ['1024x1024'] },
    sizeless: { slug: 'sizeless', api_id: 'v/sizeless', capability: 'image', controls: [] },
  },
  allowed: ['multi', 'square', 'sizeless'],
};

test('an unset image_size derives the catalog size of the primary aspect', () => {
  assert.deepEqual(resolveImageSize({ imageModel: 'v/multi', catalog, primary: WIDE }), {
    size: '1344x768', source: 'derived', target: '1920x1080', nearest: false,
  });
  assert.equal(resolveImageSize({ imageModel: 'v/multi', catalog, primary: TALL }).size, '768x1344');
  assert.equal(resolveImageSize({ imageModel: 'v/multi', catalog, primary: SQUARE }).size, '1024x1024');
});

test('a Model without the primary aspect gets the nearest size, flagged for disclosure', () => {
  const r = resolveImageSize({ imageModel: 'v/square', catalog, primary: WIDE });
  assert.equal(r.size, '1024x1024');
  assert.equal(r.source, 'derived');
  assert.equal(r.nearest, true, 'the Model offers no 16:9 size: the estimate must say so');
});

test('the nearest size is deterministic: aspect distance, then the larger area', () => {
  assert.equal(nearestImageSize(['512x512', '1024x1024'], WIDE), '1024x1024');
  assert.equal(nearestImageSize(['1024x1024', '512x512'], WIDE), '1024x1024', 'input order never decides');
  assert.equal(nearestImageSize(['1024x1024', '1344x768', '1536x640'], WIDE), '1344x768');
});

test('an explicit image_size wins and is still validated against the catalog', () => {
  assert.deepEqual(resolveImageSize({ value: '1024x1024', imageModel: 'v/multi', catalog, primary: WIDE }), {
    size: '1024x1024', source: 'explicit', target: '1920x1080', nearest: false,
  });
  assert.throws(() => resolveImageSize({ value: '640x480', imageModel: 'v/multi', catalog, primary: WIDE }), /not offered/);
});

test('a derived size never breaks a Model without the size control', () => {
  const r = resolveImageSize({ imageModel: 'v/sizeless', catalog, primary: WIDE });
  assert.equal(r.size, undefined);
  assert.equal(r.reason, 'no-size-control');
  // The adapter translation of the resolved intent does not throw, and nothing is sent.
  assert.deepEqual(translateIntent({ image_size: r.size }, catalog.models.sizeless), {});
  assert.equal('size' in buildImageOptions({}, {}, { image: 'v/sizeless', imageSize: r.size }), false);
});

test('imageModelsFor reads the primary format from the lowered episode', () => {
  const bags = { domain: { image_model: 'v/multi' } };
  const tall = imageModelsFor({ bags, parsed: { outputFormats: [TALL, WIDE] }, catalog });
  assert.equal(tall.image, 'v/multi');
  assert.equal(tall.imageSize, '768x1344');
});

// ---------------------------------------------------------------------------------------
// Provider requests honor the resolved size (R2).

function synth(env, fetch) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'img-size-synth-')));
  const guard = new SpendGuard({ config: structuredClone(DEFAULT_GUARD), root, approval: () => ({ ok: true }) });
  const cacheManager = new CacheManager({ baseDir: path.join(root, 'cache') });
  return { root, s: new AssetSynthesizer({ cacheManager, guard, env, fetch, sleep: async () => {} }) };
}

const PNG_1x1 = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

function recordingFetch() {
  const bodies = [];
  const fetch = async (url, init = {}) => {
    const u = String(url);
    if (init.method === 'POST') {
      bodies.push({ url: u, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ data: { id: 't1' }, urls: { get: 'https://api.replicate.com/poll' } }) };
    }
    if (u.includes('replicate.com/poll')) return { ok: true, status: 200, json: async () => ({ status: 'succeeded', output: ['https://cdn.fake/o.png'] }) };
    if (u.includes('/predictions/')) return { ok: true, status: 200, json: async () => ({ data: { status: 'completed', outputs: ['https://cdn.fake/o.png'] } }) };
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(PNG_1x1).buffer };
  };
  return { bodies, fetch };
}

test('WaveSpeed receives W*H from the resolved size', async () => {
  const p = recordingFetch();
  const { root, s } = synth({ WAVESPEED_API_KEY: 'k' }, p.fetch);
  try {
    await s.resolveMedia('a barn', { model: 'wavespeed-ai/z-image/turbo', size: '768x1344' }, { model: 'wavespeed-ai/z-image/turbo' });
    assert.equal(p.bodies[0].body.size, '768*1344');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WaveSpeed without a resolved size sends no size instead of a square fallback', async () => {
  const p = recordingFetch();
  const { root, s } = synth({ WAVESPEED_API_KEY: 'k' }, p.fetch);
  try {
    await s.resolveMedia('a barn', { model: 'wavespeed-ai/z-image/turbo' }, { model: 'wavespeed-ai/z-image/turbo' });
    assert.equal('size' in p.bodies[0].body, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Replicate receives the aspect ratio of the resolved size, not a hard-coded 16:9', async () => {
  for (const [size, aspect] of [['768x1344', '9:16'], ['1024x1024', '1:1'], ['1344x768', '16:9']]) {
    const p = recordingFetch();
    const { root, s } = synth({ REPLICATE_API_TOKEN: 'r' }, p.fetch);
    try {
      await s.resolveMedia('a barn ' + size, { model: 'black-forest-labs/flux-schnell', size });
      assert.equal(p.bodies[0].body.input.aspect_ratio, aspect, size);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('the offline placeholder is drawn at the resolved size, else the primary canvas', async () => {
  const { root, s } = synth({}, async () => { throw new Error('no network offline'); });
  try {
    const sized = await s.resolveMedia('offline barn', { model: 'm', size: '768x1344' });
    assert.deepEqual(readImageSize(fs.readFileSync(sized.assetPath)), { width: 768, height: 1344 });
    const canvas = await s.resolveMedia('offline barn 2', { model: 'm' }, { canvas: { width: 1080, height: 1920 } });
    assert.deepEqual(readImageSize(fs.readFileSync(canvas.assetPath)), { width: 1080, height: 1920 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------
// The estimate discloses the derived size.

const EPISODE = (formats, extra = '') => `---
level: 3
title: "Demo"
---

# NN Video

## NN Video: Demo
slug:: demo
title:: Demo
output_formats:: ${formats}
image_model:: wavespeed-ai/z-image/turbo
${extra}

# NN Scene

## NN Scene: Opening
slug:: opening
voice:: demo-voice
voice_model:: minimax/speech-2.8-hd

Welcome to the demo.

# NN Layer

## NN Layer: Barn
slug:: barn
type:: background
prompt:: a red barn at dawn
`;

function estimate(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-size-est-'));
  const scriptPath = path.join(dir, 'script_NN.md');
  fs.writeFileSync(scriptPath, source, 'utf8');
  try {
    const est = estimateScriptCost(scriptPath, { cacheDir: path.join(dir, 'cache') });
    return { est, md: formatAssetPlanMarkdown(est) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the estimate discloses the derived image size and the nearest-size fallback', () => {
  const sizes = loadMergedCatalog({ overlay: null }).models['z-image-turbo'].sizes;
  const { est, md } = estimate(EPISODE('[1920x1080, 1080x1920]'));
  const expected = nearestImageSize(sizes, WIDE);
  assert.equal(est.imageSizing.size, expected);
  assert.equal(est.imageSizing.source, 'derived');
  assert.equal(est.imageSizing.target, '1920x1080');
  assert.match(md, new RegExp(`Image size\\*\\*: ${expected}`));
  assert.match(md, /derived from the primary format 1920x1080/);
  if (est.imageSizing.nearest) assert.match(md, /nearest supported size/);
});
