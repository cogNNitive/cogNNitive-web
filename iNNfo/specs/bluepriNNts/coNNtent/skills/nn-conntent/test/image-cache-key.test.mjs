#!/usr/bin/env node

/**
 * nn-conntent/test/image-cache-key.test.mjs
 *
 * The image cache identity follows the cascaded `image_model` and never the display
 * title (cognnitive-video-engine "Image Cache Key Follows The Cascaded Model").
 * Renaming a scene or a layer must not re-bill; changing the model must.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CacheManager } from '../scripts/cache-manager.mjs';
import { buildImageOptions } from '../scripts/lib/image-options.mjs';

function cache() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-cache-key-'));
  const manager = new CacheManager({ baseDir: dir });
  return { manager, dir };
}

const scene = (name) => ({ name });
const layer = (name) => ({ name, properties: { layer_prompt: 'a red barn at dawn' } });

const keyFor = (manager, sc, l, model) =>
  manager.computeHash('a red barn at dawn', buildImageOptions(sc, l, { image: model }));

test('changing the cascaded image model changes the key', () => {
  const { manager, dir } = cache();
  try {
    const a = keyFor(manager, scene('Scene A'), layer('Barn'), 'wavespeed-ai/z-image/turbo');
    const b = keyFor(manager, scene('Scene A'), layer('Barn'), 'wavespeed-ai/flux-kontext-pro');
    assert.notEqual(a, b);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('renaming the scene or the layer does not re-bill', () => {
  const { manager, dir } = cache();
  try {
    const model = 'wavespeed-ai/z-image/turbo';
    const before = keyFor(manager, scene('Scene A'), layer('Barn'), model);
    const after = keyFor(manager, scene('Scene B renamed'), layer('Barn renamed'), model);
    assert.equal(before, after);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the options never carry the display title', () => {
  const options = buildImageOptions(scene('Scene A'), layer('Barn'), { image: 'wavespeed-ai/z-image/turbo' });
  assert.equal('title' in options, false);
  assert.equal(options.model, 'wavespeed-ai/z-image/turbo');
  assert.equal(options.provider, 'wavespeed');
  assert.ok(options.accentColor);
});

test('an unset model falls back to the documented blueprint default', () => {
  const options = buildImageOptions(scene('Scene A'), layer('Barn'));
  assert.equal(options.model, 'wavespeed-v1-flux');
});

test('the resolved image size is part of the key', () => {
  const { manager, dir } = cache();
  try {
    const model = 'wavespeed-ai/z-image/turbo';
    const square = manager.computeHash(
      'a red barn at dawn',
      buildImageOptions(scene('S'), layer('L'), { image: model, imageSize: '1024x1024' }),
    );
    const wide = manager.computeHash(
      'a red barn at dawn',
      buildImageOptions(scene('S'), layer('L'), { image: model, imageSize: '1920x1080' }),
    );
    assert.notEqual(square, wide, 'changing image_size is a cache miss');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
