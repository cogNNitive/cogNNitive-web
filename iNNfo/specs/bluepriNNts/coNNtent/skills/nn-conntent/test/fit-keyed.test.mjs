/**
 * nn-conntent/test/fit-keyed.test.mjs
 *
 * Keyed `fit:: [native=<v>, mismatch=<v>]` (spec S2, V_0-25-0):
 *
 *   - a scalar `fit:: X` broadcasts to both keys, normalized BEFORE the keyed union
 *     (nn-core drops an item without `=`, M6);
 *   - each key merges independently through the cascade, Presets included, so an inner
 *     level setting one key keeps the outer value of the other;
 *   - an unknown key or value fails with a named error;
 *   - the lowered layer carries the format-independent map `{ native, mismatch }` (M5);
 *   - the projection classifies the asset against the scene canvas within a documented
 *     tolerance and emits the chosen treatment (cover, contain, blur, card, component).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveFit, normalizeFit, FitValueError, FIT_KEYS, FIT_BUILTINS } from '../scripts/lib/cascade.mjs';
import { loadPresetIndex } from '../scripts/lib/presets.mjs';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import {
  buildProject,
  classifyFit,
  fitBlurRadiusPx,
  FIT_ASPECT_TOLERANCE,
  FIT_BLUR_BRIGHTNESS,
} from '../scripts/scene-project.mjs';
import { readImageSize, probeAssetSize, AssetSizeUnknownError } from '../scripts/lib/image-size.mjs';
import { probeMediaLayerSizes, resolveFitComponents, FitComponentError } from '../scripts/lib/compile.mjs';
import { overlayMount } from '../scripts/overlay-blocks.mjs';

// ---------------------------------------------------------------- resolver

const preset = (name, fields) => ({ type: 'Preset', name, slug: name.toLowerCase().replace(/\s+/g, '-'), fields });
const presetIndex = (presets) => loadPresetIndex([{ doc: 'script', elements: { Preset: presets } }]);

test('the key set and the built-in values are the frozen ones', () => {
  assert.deepEqual(FIT_KEYS, ['native', 'mismatch']);
  assert.deepEqual(FIT_BUILTINS, ['cover', 'contain', 'blur', 'card']);
});

test('a scalar fit broadcasts to both keys', () => {
  assert.deepEqual(normalizeFit('contain'), { native: 'contain', mismatch: 'contain' });
  const r = resolveFit({ blueprint: { fit: 'blur' } });
  assert.deepEqual(r.value, { native: 'blur', mismatch: 'blur' });
  assert.deepEqual(r.source, { native: 'blueprint', mismatch: 'blueprint' });
});

test('every written form of the keyed list normalizes to the same map', () => {
  const want = { native: 'cover', mismatch: 'blur' };
  assert.deepEqual(normalizeFit(['native=cover', 'mismatch=blur']), want);
  assert.deepEqual(normalizeFit('[native=cover, mismatch=blur]'), want);
  assert.deepEqual(normalizeFit({ native: 'cover', mismatch: 'blur' }), want);
  assert.deepEqual(normalizeFit(['card']), { native: 'card', mismatch: 'card' });
  assert.equal(normalizeFit(undefined), null);
  assert.equal(normalizeFit(''), null);
});

test('an inner level setting one key keeps the outer value of the other', () => {
  const r = resolveFit({
    blueprint: { fit: ['native=cover', 'mismatch=blur'] },
    scene: { fit: ['mismatch=card'] },
    layer: { fit: ['native=contain'] },
  });
  assert.deepEqual(r.value, { native: 'contain', mismatch: 'card' });
  assert.deepEqual(r.source, { native: 'layer', mismatch: 'scene' });
});

test('a scalar at an inner level overrides both keys of an outer keyed list', () => {
  const r = resolveFit({ blueprint: { fit: ['native=cover', 'mismatch=blur'] }, video: { fit: 'contain' } });
  assert.deepEqual(r.value, { native: 'contain', mismatch: 'contain' });
});

test('presets merge per key with the same precedence as the cascade', () => {
  const r = resolveFit({
    presetIndex: presetIndex([preset('Shot', { fit: '[mismatch=card]' })]),
    blueprint: { fit: ['native=cover', 'mismatch=blur'] },
    scene: { presets: '[Shot]', fit: ['native=contain'] },
  });
  assert.deepEqual(r.value, { native: 'contain', mismatch: 'card' });
  assert.equal(r.source.mismatch, 'scene:preset:Shot');
  assert.equal(r.source.native, 'scene');
});

test('a key no level sets falls back to cover; nothing set resolves to null', () => {
  assert.deepEqual(resolveFit({ layer: { fit: ['mismatch=card'] } }).value, { native: 'cover', mismatch: 'card' });
  assert.equal(resolveFit({}).value, null);
});

test('an unknown key fails with a clear, named error', () => {
  assert.throws(
    () => resolveFit({ layer: { fit: ['screenshot=card'] } }),
    (err) => err instanceof FitValueError && err.code === 'FIT_INVALID' && /unknown key "screenshot"/.test(err.message),
  );
});

test('an unknown value fails with a clear, named error', () => {
  assert.throws(
    () => resolveFit({ scene: { fit: 'stretch' } }),
    (err) => err instanceof FitValueError && /unknown value "stretch"/.test(err.message) && /cover \| contain \| blur \| card \| component:<name>/.test(err.message),
  );
  assert.throws(() => normalizeFit('component:'), FitValueError);
});

test('a component value is namespaced and kept verbatim', () => {
  assert.deepEqual(normalizeFit('[mismatch=component:phone-frame]'), { mismatch: 'component:phone-frame' });
});

// ---------------------------------------------------------------- lowering

test('the lowered layer carries the format-independent map', () => {
  const compiler = new SceneCompiler({ fps: 30, width: 1920, height: 1080 });
  const bags = { blueprint: { fit: ['native=cover', 'mismatch=blur'] }, scene: { fit: ['mismatch=card'] } };
  const layer = { name: 'Shot', slug: 'shot', fields: { type: 'media', asset: 'media/a.png' } };
  const lowered = compiler.lowerLayer(layer, 'scene_one', 0, bags);
  assert.deepEqual(lowered.properties.layer_fit, { native: 'cover', mismatch: 'card' });
  // The same model lowered for another canvas yields the same map (M5: the review hash
  // never depends on the format).
  const other = new SceneCompiler({ fps: 30, width: 1080, height: 1920 }).lowerLayer(layer, 'scene_one', 0, bags);
  assert.deepEqual(other.properties.layer_fit, lowered.properties.layer_fit);
});

// ---------------------------------------------------------------- image headers

const u16be = (n) => [(n >> 8) & 0xff, n & 0xff];
const u16le = (n) => [n & 0xff, (n >> 8) & 0xff];
const u24le = (n) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const u32be = (n) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

export function pngOf(w, h) {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...u32be(w), ...u32be(h), 8, 2, 0, 0, 0]);
}
const gifOf = (w, h) => Buffer.from([...Buffer.from('GIF89a'), ...u16le(w), ...u16le(h), 0, 0, 0]);
const jpegOf = (w, h) =>
  Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc0, 0, 17, 8, ...u16be(h), ...u16be(w), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
  ]);
const riff = (chunk, body) => Buffer.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), ...Buffer.from(chunk), body.length, 0, 0, 0, ...body]);
const webpVp8x = (w, h) => riff('VP8X', [0, 0, 0, 0, ...u24le(w - 1), ...u24le(h - 1)]);
const webpVp8l = (w, h) => {
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  return riff('VP8L', [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff]);
};
const webpVp8 = (w, h) => riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(w), ...u16le(h)]);

test('image headers give the pixel size of PNG, JPEG, WebP and GIF', () => {
  assert.deepEqual(readImageSize(pngOf(1920, 1080)), { width: 1920, height: 1080 });
  assert.deepEqual(readImageSize(jpegOf(1280, 720)), { width: 1280, height: 720 });
  assert.deepEqual(readImageSize(gifOf(640, 480)), { width: 640, height: 480 });
  assert.deepEqual(readImageSize(webpVp8x(1080, 1920)), { width: 1080, height: 1920 });
  assert.deepEqual(readImageSize(webpVp8l(800, 600)), { width: 800, height: 600 });
  assert.deepEqual(readImageSize(webpVp8(1024, 1024)), { width: 1024, height: 1024 });
  assert.deepEqual(readImageSize(Buffer.from('<svg width="1920" height="1920" xmlns="http://www.w3.org/2000/svg"></svg>')), { width: 1920, height: 1920 });
});

test('an unreadable header gives null, never a guess', () => {
  assert.equal(readImageSize(Buffer.from([0x89, 0x50, 0x4e, 0x47])), null);
  assert.equal(readImageSize(Buffer.from('not an image')), null);
});

test('a video is probed with ffprobe through the injected runner', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-fit-probe-'));
  try {
    const clip = path.join(dir, 'clip.mp4');
    fs.writeFileSync(clip, 'mp4');
    const calls = [];
    const size = await probeAssetSize(clip, { run: (cmd, args) => (calls.push([cmd, args]), { status: 0, stdout: '1280,720\n' }) });
    assert.deepEqual(size, { width: 1280, height: 720 });
    assert.equal(calls[0][0], 'ffprobe');
    const png = path.join(dir, 'still.png');
    fs.writeFileSync(png, pngOf(300, 200));
    assert.deepEqual(await probeAssetSize(png, { run: () => assert.fail('an image is read from its header') }), { width: 300, height: 200 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A manifest scene whose staged layers live in `publicDir`. */
function stagedManifest(layers) {
  return { width: 1920, height: 1080, tracks: { scenes: [{ id: 'scene_one', props: { layers } }], overlays: [], audio: [] } };
}

test('compile records the probed asset size on every layer whose fit needs it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-fit-stage-'));
  try {
    fs.writeFileSync(path.join(dir, 'wide.png'), pngOf(1920, 1080));
    fs.writeFileSync(path.join(dir, 'tall.png'), pngOf(1080, 1920));
    const manifest = stagedManifest([
      { layer_asset_source: 'wide.png', layer_fit: { native: 'cover', mismatch: 'blur' } },
      { layer_asset_source: 'tall.png', layer_fit: { native: 'card', mismatch: 'card' } },
    ]);
    await probeMediaLayerSizes(manifest, { publicDir: dir });
    const [a, b] = manifest.tracks.scenes[0].props.layers;
    assert.equal(a.layer_asset_width, 1920);
    assert.equal(a.layer_asset_height, 1080);
    assert.equal(b.layer_asset_width, 1080);
    assert.equal(b.layer_asset_height, 1920);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('unknown asset dimensions fail explicitly, naming the asset', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-fit-stage-'));
  try {
    fs.writeFileSync(path.join(dir, 'broken.png'), 'not a png');
    const manifest = stagedManifest([{ layer_asset_source: 'broken.png', layer_fit: { native: 'cover', mismatch: 'blur' } }]);
    await assert.rejects(
      probeMediaLayerSizes(manifest, { publicDir: dir }),
      (err) => err instanceof AssetSizeUnknownError && err.code === 'ASSET_SIZE_UNKNOWN' && /broken\.png/.test(err.message),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a fit that is the same for both keys needs no probe', async () => {
  const manifest = stagedManifest([{ layer_asset_source: 'whatever.png', layer_fit: { native: 'cover', mismatch: 'cover' } }, { layer_asset_source: 'x.png' }]);
  await probeMediaLayerSizes(manifest, { publicDir: '/nonexistent', probe: () => assert.fail('no probe needed') });
  assert.equal(manifest.tracks.scenes[0].props.layers[0].layer_asset_width, undefined);
});

// ---------------------------------------------------------------- projection

function manifestWith(layer, { width = 1920, height = 1080 } = {}) {
  return {
    fps: 30,
    width,
    height,
    totalDurationInFrames: 90,
    tracks: {
      scenes: [{ id: 'scene_one', slug: 'one', fromFrame: 0, durationInFrames: 90, narration: '', props: { layers: [{ layer_asset_source: 'a.jpg', layer_z_index: 1, layer_position: 'center', ...layer }] } }],
      overlays: [],
      audio: [],
    },
    metadata: {},
  };
}
const sceneHtml = (manifest) => buildProject(manifest, {}).compositions.find((c) => c.slug === 'one').html;
const KEYED = (native, mismatch) => ({ layer_fit: { native, mismatch } });

test('the aspect tolerance is 5% and the boundary is inclusive', () => {
  assert.equal(FIT_ASPECT_TOLERANCE, 0.05);
  // box 16:9 (1.7778); 1.05x = 1.8667, 0.95x = 1.6889
  assert.equal(classifyFit(1867, 1000, 1920, 1080), 'mismatch');
  assert.equal(classifyFit(1866, 1000, 1920, 1080), 'native');
  assert.equal(classifyFit(1690, 1000, 1920, 1080), 'native');
  assert.equal(classifyFit(1688, 1000, 1920, 1080), 'mismatch');
  assert.equal(classifyFit(1080, 1920, 1920, 1080), 'mismatch');
});

test('an undeclared fit emits exactly the cover markup of V_0-24-0', () => {
  const html = sceneHtml(manifestWith({}));
  assert.match(html, /<img id="media-one-1" class="clip nn-media" data-start="0" data-duration="3" data-track-index="1"  src="assets\/a\.jpg" style="z-index:1;object-position:center center;"><\/img>/);
});

test('a native asset under the default map renders byte-identical to an undeclared fit', () => {
  const undeclared = sceneHtml(manifestWith({}));
  const keyed = sceneHtml(manifestWith({ ...KEYED('cover', 'blur'), layer_asset_width: 3840, layer_asset_height: 2160 }));
  assert.equal(keyed, undeclared);
});

test('a mismatched asset takes the mismatch value', () => {
  const html = sceneHtml(manifestWith({ ...KEYED('cover', 'blur'), layer_asset_width: 1080, layer_asset_height: 1920 }));
  assert.match(html, /media-one-1-backdrop/);
});

test('contain is explicit object-fit:contain, never a silent cover', () => {
  const html = sceneHtml(manifestWith({ ...KEYED('contain', 'contain') }));
  assert.match(html, /style="z-index:1;object-position:center center;object-fit:contain;"/);
  assert.doesNotMatch(html, /backdrop/);
});

test('a scalar layer_fit in a manifest still means both keys', () => {
  const html = sceneHtml(manifestWith({ layer_fit: 'contain' }));
  assert.match(html, /object-fit:contain;/);
});

test('the blur radius scales with the shorter side of the box', () => {
  assert.equal(fitBlurRadiusPx(1920, 1920), 24);
  assert.equal(fitBlurRadiusPx(1920, 1080), 13.5);
  assert.equal(fitBlurRadiusPx(1080, 1920), 13.5);
  assert.equal(fitBlurRadiusPx(1080, 1080), 13.5);
  const big = sceneHtml(manifestWith(KEYED('blur', 'blur'), { width: 1920, height: 1920 }));
  assert.match(big, /object-fit:cover;filter:blur\(24px\) brightness\(0\.82\)/);
  const small = sceneHtml(manifestWith(KEYED('blur', 'blur'), { width: 1920, height: 1080 }));
  assert.match(small, /filter:blur\(13\.5px\) brightness\(0\.82\)/);
  assert.equal(FIT_BLUR_BRIGHTNESS, 0.82);
});

test('card shows the whole asset as a framed card over the blurred self-backdrop', () => {
  // A 9:16 screenshot on a 16:9 canvas: inset 5% of the shorter side (54px), so the
  // card is 972px tall and 547px wide (972 * 9/16 rounded), centered.
  const html = sceneHtml(manifestWith({ ...KEYED('cover', 'card'), layer_asset_width: 1080, layer_asset_height: 1920 }));
  assert.match(html, /id="media-one-1-backdrop"[^>]*filter:blur\(13\.5px\)/);
  const card = /<img id="media-one-1" class="clip nn-media nn-media-card"[^>]*style="([^"]+)"/.exec(html);
  assert.ok(card, 'the card foreground is emitted');
  assert.match(card[1], /left:687px;top:54px;width:547px;height:972px;/);
  assert.match(card[1], /object-fit:contain;/);
  assert.match(card[1], /border-radius:22px;/);
  assert.match(card[1], /box-shadow:0 13px 43px rgba\(0,0,0,0\.45\)/);
  assert.ok(html.indexOf('media-one-1-backdrop') < html.indexOf('id="media-one-1"'), 'backdrop painted first');
});

test('card without a known asset size fails instead of guessing', () => {
  assert.throws(() => sceneHtml(manifestWith(KEYED('card', 'card'))), /asset size/);
});

test('a classification without a known asset size fails instead of guessing', () => {
  assert.throws(() => sceneHtml(manifestWith(KEYED('cover', 'blur'))), /asset size/);
});

test('a component fit mounts a root-level host with the asset variables', () => {
  const manifest = manifestWith({ ...KEYED('cover', 'component:phone-frame'), layer_asset_width: 1080, layer_asset_height: 1920 });
  manifest.tracks.scenes[0].fromFrame = 30;
  const built = buildProject(manifest, {});
  const scene = built.compositions.find((c) => c.slug === 'one').html;
  assert.doesNotMatch(scene, /id="media-one-1"/, 'the scene does not draw the layer itself');
  const host = /<div id="fit-one-1"[^>]*><\/div>/.exec(built.indexHtml);
  assert.ok(host, 'a root host mounts the component');
  assert.match(host[0], /data-composition-id="phone-frame"/);
  assert.match(host[0], /data-composition-src="components\/phone-frame\.html"/);
  assert.match(host[0], /data-start="1" data-duration="3"/);
  const values = JSON.parse(/data-variable-values='([^']+)'/.exec(host[0])[1].replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  assert.deepEqual(values, { src: 'assets/a.jpg', width: 1920, height: 1080, asset_width: 1080, asset_height: 1920 });
  assert.ok(built.assets.includes('a.jpg'), 'the asset is still staged');
});

test('a b-roll overlay passes the native value as its CSS fit', () => {
  const html = overlayMount({ id: 'br', type: 'broll', fromFrame: 0, durationInFrames: 30, config: { assetPath: 'b.png', fit: { native: 'contain', mismatch: 'blur' } } });
  assert.match(html, /"fit":"contain"/);
  const blur = overlayMount({ id: 'br', type: 'broll', fromFrame: 0, durationInFrames: 30, config: { assetPath: 'b.png', fit: { native: 'blur', mismatch: 'blur' } } });
  assert.match(blur, /"fit":"contain"/, 'a treatment the slot cannot draw keeps the whole asset visible');
});

// ---------------------------------------------------------------- component pre-spend

test('a component fit with no component folder fails before any spend', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-fit-comp-'));
  try {
    fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n');
    const scenes = [{ id: 'scene_one', layers: [{ properties: { layer_fit: { native: 'cover', mismatch: 'component:phone-frame' } } }] }];
    assert.throws(
      () => resolveFitComponents({ scenes, scriptDir: root, workspaceRoot: root }),
      (err) => err instanceof FitComponentError && /component "phone-frame"/.test(err.message),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a component fit resolves its folder and checks it declares the fit variables', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-fit-comp-'));
  try {
    fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n');
    const folder = path.join(root, 'library', 'components', 'phone-frame');
    fs.mkdirSync(folder, { recursive: true });
    const vars = (ids) => `<div id="root" data-composition-id="phone-frame" data-composition-variables='${JSON.stringify(ids.map((id) => ({ id, type: 'string' })))}'></div>`;
    fs.writeFileSync(path.join(folder, 'index.html'), `<template>${vars(['src', 'width', 'height', 'asset_width', 'asset_height'])}</template>`);
    const scenes = [{ id: 'scene_one', layers: [{ properties: { layer_fit: { native: 'component:phone-frame', mismatch: 'component:phone-frame' } } }] }];
    const found = resolveFitComponents({ scenes, scriptDir: root, workspaceRoot: root });
    assert.equal(found['phone-frame'].name, 'phone-frame');
    assert.equal(path.resolve(found['phone-frame'].path), path.resolve(folder, 'index.html'));

    fs.writeFileSync(path.join(folder, 'index.html'), `<template>${vars(['src'])}</template>`);
    assert.throws(() => resolveFitComponents({ scenes, scriptDir: root, workspaceRoot: root }), /asset_width/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- through compileVideo

import { compileVideo } from '../scripts/lib/compile.mjs';

const EPISODE = (layerFit) => `---
level: 3
title: "Fit"
---

# NN Video

## NN Video: Fit
slug:: fit
title:: Fit

# NN Scene

## NN Scene: One
slug:: one

one two three four five

### NN Layer: Shot
slug:: shot
type:: background
asset:: media/shot.png
${layerFit}
`;

function episodeFixture(layerFit, png) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-fit-compile-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  const series = path.join(root, 'series', 's');
  const episode = path.join(series, 'assets', 'e');
  fs.mkdirSync(path.join(episode, 'media'), { recursive: true });
  fs.writeFileSync(path.join(series, 's_coNNtent_NN.md'), '---\nlevel: 3\nscope: true\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\n', 'utf8');
  fs.writeFileSync(path.join(episode, 'media', 'shot.png'), png);
  const scriptPath = path.join(episode, 'e_coNNtent_NN.md');
  fs.writeFileSync(scriptPath, EPISODE(layerFit), 'utf8');
  return { root, episode, scriptPath, cacheDir: path.join(root, 'cache') };
}

const compileBags = { blueprint: { output_formats: ['1920x1080'], fit: ['native=cover', 'mismatch=blur'], transition: 'none' } };

test('compile probes the asset and the manifest carries the map and the size', async () => {
  const ep = episodeFixture('', pngOf(1080, 1920));
  try {
    const { manifest } = await compileVideo({ scriptPath: ep.scriptPath, bags: compileBags, synthesizeAssets: false, cacheDir: ep.cacheDir });
    const layer = manifest.tracks.scenes[0].props.layers[0];
    assert.deepEqual(layer.layer_fit, { native: 'cover', mismatch: 'blur' });
    assert.equal(layer.layer_asset_width, 1080);
    assert.equal(layer.layer_asset_height, 1920);
  } finally {
    fs.rmSync(ep.root, { recursive: true, force: true });
  }
});

test('compile fails with asset-size-unknown when the size cannot be read', async () => {
  const ep = episodeFixture('', Buffer.from('not a png'));
  try {
    await assert.rejects(
      compileVideo({ scriptPath: ep.scriptPath, bags: compileBags, synthesizeAssets: false, cacheDir: ep.cacheDir }),
      (err) => err.code === 'ASSET_SIZE_UNKNOWN',
    );
  } finally {
    fs.rmSync(ep.root, { recursive: true, force: true });
  }
});

test('compile refuses a missing fit component before anything is synthesized or written', async () => {
  const ep = episodeFixture('fit:: [mismatch=component:phone-frame]', pngOf(1080, 1920));
  try {
    await assert.rejects(
      compileVideo({ scriptPath: ep.scriptPath, bags: compileBags, cacheDir: ep.cacheDir }),
      (err) => err instanceof FitComponentError,
    );
    assert.equal(fs.existsSync(path.join(ep.episode, 'hyperframes')), false, 'nothing was emitted');
    assert.equal(fs.existsSync(ep.cacheDir), false, 'nothing was synthesized');
  } finally {
    fs.rmSync(ep.root, { recursive: true, force: true });
  }
});
