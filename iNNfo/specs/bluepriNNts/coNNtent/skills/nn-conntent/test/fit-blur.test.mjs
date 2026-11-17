/**
 * nn-conntent/test/fit-blur.test.mjs
 *
 * `fit:: blur` on a media Layer: the whole asset stays visible (contain) over a
 * backdrop built from the SAME asset, filling the box and blurred. Acceptance for the
 * reported case is a 16:9 image in a 9:16 layer box rendering with the whole image
 * visible and no empty band, without introducing a new palette.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildProject, fitBlurRadiusPx, FIT_BLUR_REFERENCE_PX, FIT_BLUR_BRIGHTNESS } from '../scripts/scene-project.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.resolve(HERE, '..', 'scripts', 'lib', 'field-registry.generated.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));

/** A minimal manifest with one scene holding one media layer. */
function manifestWithLayer(asset, extraProps = {}) {
  return {
    fps: 30,
    width: 1080,
    height: 1920,
    totalDurationInFrames: 90,
    tracks: {
      scenes: [
        {
          id: 'scene_one',
          slug: 'one',
          fromFrame: 0,
          durationInFrames: 90,
          narration: '',
          props: {
            layers: [
              {
                layer_asset_source: asset,
                layer_z_index: 1,
                layer_position: 'center',
                ...extraProps,
              },
            ],
          },
        },
      ],
      overlays: [],
      audio: [],
    },
    metadata: {},
  };
}

const layerHtml = (manifest) => {
  const built = buildProject(manifest, {});
  const comp = built.compositions.find((c) => c.slug === 'one');
  const html = comp ? comp.html : built.indexHtml;
  return html;
};

test('fit is a keyed list validated by the engine, not a closed option set', () => {
  // V_0-25-0: `fit:: [native=<v>, mismatch=<v>]`. A select option list would reject
  // `native=cover`, so the engine resolver checks the values (fit-keyed.test.mjs).
  assert.equal(registry.fields.fit.multiple, true);
  assert.deepEqual(registry.fields.fit.options, []);
});

test('a 16:9 image in a 9:16 box emits a blurred backdrop and a contained foreground', () => {
  const html = layerHtml(manifestWithLayer('wide.jpg', { layer_fit: 'blur' }));
  assert.match(html, /id="media-one-1-backdrop"/);
  assert.match(html, /id="media-one-1"/);
  // Both elements are the same asset: no new image, no new palette.
  const srcs = [...html.matchAll(/src="assets\/([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(srcs, ['wide.jpg', 'wide.jpg']);
  // Backdrop fills and blurs with the documented radius, proportional to the box:
  // 13.5px on this 1080x1920 canvas (24px at a 1920 shorter side).
  assert.match(html, /object-fit:cover;filter:blur\(13\.5px\) brightness\(0\.82\)/);
  // Foreground keeps contain, so the whole image is visible and no band is empty.
  assert.match(html, /object-fit:contain/);
  assert.equal(fitBlurRadiusPx(1080, 1920), 13.5);
  assert.equal(FIT_BLUR_BRIGHTNESS, 0.82);
});

test('the backdrop is painted first so the foreground sits on top', () => {
  const html = layerHtml(manifestWithLayer('wide.jpg', { layer_fit: 'blur' }));
  const backdropAt = html.indexOf('media-one-1-backdrop');
  const foregroundAt = html.indexOf('id="media-one-1"');
  assert.ok(backdropAt > 0 && foregroundAt > 0);
  assert.ok(backdropAt < foregroundAt, 'the backdrop comes before the foreground in paint order');
});

test('a video asset gets the same backdrop treatment, with the backdrop muted', () => {
  const html = layerHtml(manifestWithLayer('clip.mp4', { layer_fit: 'blur' }));
  const backdrop = /<video id="media-one-1-backdrop"[\s\S]*?<\/video>/.exec(html);
  assert.ok(backdrop, 'the backdrop is a video element for a video asset');
  assert.match(backdrop[0], /muted playsinline/);
  assert.match(backdrop[0], /object-fit:cover;filter:blur/);
  assert.match(html, /<video id="media-one-1"[\s\S]*?object-fit:contain/);
});

test('cover stays the default and emits exactly one element, byte-compatible', () => {
  const html = layerHtml(manifestWithLayer('wide.jpg', { layer_fit: 'cover' }));
  assert.equal([...html.matchAll(/src="assets\/wide\.jpg"/g)].length, 1);
  assert.doesNotMatch(html, /backdrop/);
  assert.doesNotMatch(html, /filter:blur/);
});

test('an undeclared fit emits exactly what it emitted before', () => {
  const html = layerHtml(manifestWithLayer('wide.jpg'));
  assert.equal([...html.matchAll(/src="assets\/wide\.jpg"/g)].length, 1);
  assert.match(html, /style="z-index:1;object-position:center center;"/);
});

test('contain is untouched by the blur branch', () => {
  const html = layerHtml(manifestWithLayer('wide.jpg', { layer_fit: 'contain' }));
  assert.equal([...html.matchAll(/src="assets\/wide\.jpg"/g)].length, 1);
  assert.doesNotMatch(html, /backdrop|filter:blur/);
});

test('the documented radius is a CSS blur and names no retired derivation step', () => {
  const spec = fs.readFileSync(path.resolve(HERE, '..', '..', '..', 'spec_NN.md'), 'utf8');
  assert.match(spec, /it is a CSS blur\./);
  assert.doesNotMatch(spec, /render-formats|gblur/);
  assert.equal(FIT_BLUR_REFERENCE_PX, 24);
});
