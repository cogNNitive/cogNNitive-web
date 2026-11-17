/**
 * nn-conntent/test/safe-area.test.mjs
 *
 * Per-canvas safe area (spec S6; risks R1, M11): captions, overlays, authored animations
 * and `placement:: inset` media lay out in the safe area of the canvas they are rendered
 * on, and QA measures overlays in that same region. There is no central square of a
 * master any more.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeArea, safeAreaCssVars } from '../scripts/lib/safe-area.mjs';
import { buildProject } from '../scripts/scene-project.mjs';
import { buildHyperframesProject } from '../scripts/hyperframes-render.mjs';
import { overlayCropRegion } from '../scripts/lib/qa.mjs';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const PACKAGE = path.resolve(SKILL, '..', '..');
const NAMES = ['lower-third', 'caption', 'title', 'quote', 'watermark', 'b-roll'];
const CANVASES = [
  [1920, 1080],
  [1080, 1920],
  [1080, 1080],
];

const sources = () => [
  ...NAMES.map((n) => [`slots/${n}.html`, path.join(SKILL, 'slots', `${n}.html`)]),
  ...NAMES.map((n) => [`library/components/${n}`, path.join(PACKAGE, 'library', 'components', n, 'index.html')]),
];

test('the safe area is title-safe on every canvas and clears the vertical interface bands', () => {
  assert.deepEqual(
    (({ x, y, width, height }) => ({ x, y, width, height }))(safeArea({ width: 1920, height: 1080 })),
    { x: 192, y: 108, width: 1536, height: 864 },
  );
  assert.deepEqual(
    (({ x, y, width, height }) => ({ x, y, width, height }))(safeArea({ width: 1080, height: 1920 })),
    { x: 108, y: 269, width: 864, height: 979 },
  );
  assert.deepEqual(
    (({ x, y, width, height }) => ({ x, y, width, height }))(safeArea({ width: 1080, height: 1080 })),
    { x: 108, y: 108, width: 864, height: 864 },
  );
  assert.throws(() => safeArea({ width: 0, height: 1080 }), /positive width and height/);
});

test('every overlay component lays out in the safe-area variables, never a fixed square', () => {
  for (const [label, file] of sources()) {
    const html = fs.readFileSync(file, 'utf8');
    const root = /#root\s*\{([^}]*)\}/.exec(html)?.[1] ?? '';
    for (const side of ['top', 'right', 'bottom', 'left']) {
      assert.match(root, new RegExp(`${side}:\\s*var\\(--safe-${side}\\b`), `${label}: #root ${side} reads --safe-${side}`);
    }
    assert.match(root, /overflow:\s*visible/, `${label}: overflow visible`);
    assert.doesNotMatch(html, /21\.875%/, `${label}: no central-square inset`);
    assert.doesNotMatch(html, /data-width="1080"|data-height="1080"/, `${label}: no hard-coded 1080 canvas`);
  }
});

const manifestFor = (width, height, layer = null) => ({
  fps: 30,
  width,
  height,
  totalDurationInFrames: 90,
  totalDurationInSeconds: 3,
  compositionId: 'demo',
  tracks: {
    scenes: [{ id: 'scene_one', slug: 'one', fromFrame: 0, durationInFrames: 90, props: { layers: layer ? [layer] : [] } }],
    overlays: [{ id: 'cap_1', type: 'captions', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 30, config: { text: 'hi', position: 'bottom' } }],
    audio: [],
  },
  metadata: {},
});

test('each project root declares the safe area of its own canvas', () => {
  for (const [w, h] of CANVASES) {
    const { indexHtml } = buildProject(manifestFor(w, h), {});
    const vars = safeAreaCssVars({ width: w, height: h });
    assert.ok(indexHtml.includes(vars), `${w}x${h}: root declares ${vars}`);
  }
});

test('a staged overlay component carries the canvas size of the project it is staged into', () => {
  for (const [w, h] of CANVASES) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-safe-stage-'));
    try {
      const gsap = path.join(dir, 'g.js');
      fs.writeFileSync(gsap, '//');
      const projectDir = path.join(dir, 'hyperframes', `${w}x${h}`);
      buildHyperframesProject(manifestFor(w, h), projectDir, { gsapPath: gsap });
      const staged = fs.readFileSync(path.join(projectDir, 'components', 'caption.html'), 'utf8');
      const root = /<div\s[^>]*id="root"[^>]*>/.exec(staged)?.[0] ?? '';
      assert.match(root, new RegExp(`data-width="${w}"`), `${w}x${h}: staged root width`);
      assert.match(root, new RegExp(`data-height="${h}"`), `${w}x${h}: staged root height`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('QA measures an overlay inside the same safe area the components lay out in', () => {
  for (const [w, h] of CANVASES) {
    const safe = safeArea({ width: w, height: h });
    for (const overlay of [
      { type: 'captions', config: { position: 'bottom' } },
      { type: 'title', config: { position: 'top' } },
      { type: 'quote', config: {} },
      { type: 'watermark', config: {} },
    ]) {
      const crop = overlayCropRegion({ overlay, canvasWidth: w, canvasHeight: h });
      assert.ok(crop.x >= safe.x && crop.x + crop.width <= safe.x + safe.width, `${w}x${h} ${overlay.type}: x inside`);
      assert.ok(crop.y >= safe.y && crop.y + crop.height <= safe.y + safe.height, `${w}x${h} ${overlay.type}: y inside`);
    }
  }
});

const sceneHtml = (manifest) => buildProject(manifest, {}).compositions.find((c) => c.slug === 'one').html;
const mediaLayer = (extra = {}) => ({ layer_asset_source: 'a.jpg', layer_z_index: 1, layer_position: 'center', ...extra });

test('placement:: inset places a media layer in the safe area of each canvas', () => {
  const html = sceneHtml(manifestFor(1080, 1920, mediaLayer({ layer_placement: 'inset' })));
  assert.match(
    html,
    /<img id="media-one-1" class="clip nn-media"[^>]*style="z-index:1;inset:auto;left:108px;top:269px;width:864px;height:979px;object-position:center center;"><\/img>/,
  );
  const wide = sceneHtml(manifestFor(1920, 1080, mediaLayer({ layer_placement: 'inset' })));
  assert.match(wide, /inset:auto;left:192px;top:108px;width:1536px;height:864px;/);
});

test('placement:: inset classifies fit against the inset box, not the canvas', () => {
  // A 864x979 asset is native to the vertical safe box and a mismatch on the 1080x1920 canvas.
  const layer = mediaLayer({ layer_placement: 'inset', layer_fit: { native: 'cover', mismatch: 'blur' }, layer_asset_width: 864, layer_asset_height: 979 });
  const html = sceneHtml(manifestFor(1080, 1920, layer));
  assert.doesNotMatch(html, /nn-media-backdrop/, 'native to the box: no blur backdrop');
  const full = sceneHtml(manifestFor(1080, 1920, { ...layer, layer_placement: undefined }));
  assert.match(full, /nn-media-backdrop/, 'the same asset on the full canvas is a mismatch');
});

test('placement:: inset keeps blur and card inside the box', () => {
  const blur = sceneHtml(manifestFor(1920, 1080, mediaLayer({ layer_placement: 'inset', layer_fit: 'blur' })));
  for (const id of ['media-one-1-backdrop', 'media-one-1']) {
    assert.match(blur, new RegExp(`id="${id}"[^>]*inset:auto;left:192px;top:108px;width:1536px;height:864px;`), `${id} sits in the box`);
  }
  const card = sceneHtml(
    manifestFor(1920, 1080, mediaLayer({ layer_placement: 'inset', layer_fit: 'card', layer_asset_width: 1000, layer_asset_height: 1000 })),
  );
  // Box 1536x864 at (192,108): card inset 5% of 864 = 43; side 778; centered at x 571, y 151.
  assert.match(card, /class="clip nn-media nn-media-card"[^>]*left:571px;top:151px;width:778px;height:778px;/);
});

test('placement:: full emits exactly what it emitted before (no box geometry)', () => {
  const html = sceneHtml(manifestFor(1920, 1080, mediaLayer({})));
  assert.match(html, /<img id="media-one-1" class="clip nn-media" data-start="0" data-duration="3" data-track-index="1"  src="assets\/a\.jpg" style="z-index:1;object-position:center center;"><\/img>/);
});

test('placement lowers into the model only when it is inset, so full keeps the review hash', () => {
  const compiler = new SceneCompiler();
  const lower = (placement) =>
    compiler.lowerLayer({ name: 'L', slug: 'l', fields: { type: 'media', asset: 'media/a.png', placement } }, 'scene_one', 0, {}).properties;
  assert.equal(lower('inset').layer_placement, 'inset');
  assert.equal('layer_placement' in lower('full'), false);
  assert.equal('layer_placement' in lower(undefined), false);
});
