#!/usr/bin/env node

/**
 * nn-conntent/test/avatar-primary-fit.test.mjs
 *
 * Spec S4 & M7: The avatar is generated once in the primary format. Across all rendered
 * formats, other formats consume it with centered `cover` (not fit/blur). When cached
 * avatars are applied, the layer keeps an origin flag (`layer_avatar_origin: true`) and
 * `layer_fit: { native: 'cover', mismatch: 'cover' }` so `chosenFit` selects `cover` on
 * every canvas without requiring probed dimensions.
 * The engine checks the upscale factor across all configured output formats and warns
 * when any format requires > 3.0x scaling (`checkAvatarUpscale`).
 */

import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  applyCachedAvatars,
  checkAvatarUpscale,
  checkAvatarAssetAspect,
  DEFAULT_MAX_AVATAR_UPSCALE,
} from '../scripts/lib/avatar-jobs.mjs';
import { chosenFit } from '../scripts/scene-project.mjs';

test('checkAvatarUpscale warns when scale factor exceeds threshold', () => {
  const formats = [
    { width: 1920, height: 1080, size: '1920x1080' },
    { width: 1080, height: 1920, size: '1080x1920' },
    { width: 1080, height: 1080, size: '1080x1080' },
  ];
  // 640x352 avatar clip (typical InfiniteTalk):
  // 1920x1080: max(1920/640, 1080/352) = 3.068x (> 3.0x)
  // 1080x1920: max(1080/640, 1920/352) = 5.455x (> 3.0x)
  // 1080x1080: max(1080/640, 1080/352) = 3.068x (> 3.0x)
  const warnings = checkAvatarUpscale({
    width: 640,
    height: 352,
    formats,
    maxUpscale: 3.0,
    label: 'Scene 1: avatar',
  });
  assert.equal(warnings.length, 3);
  assert.match(warnings[1], /5\.45x upscale to cover 1080x1920/);
  assert.match(warnings[1], /threshold: 3x/);
});

test('checkAvatarUpscale produces no warning when scale is within threshold', () => {
  const formats = [
    { width: 1920, height: 1080, size: '1920x1080' },
    { width: 1080, height: 1920, size: '1080x1920' },
  ];
  // 1280x720 avatar clip:
  // 1920x1080: 1.5x
  // 1080x1920: 1920/720 = 2.67x
  const warnings = checkAvatarUpscale({
    width: 1280,
    height: 720,
    formats,
    maxUpscale: 3.0,
  });
  assert.equal(warnings.length, 0);
});

test('chosenFit returns cover for avatar layers across native and mismatch canvases', () => {
  const avatarLayer = {
    name: 'avatar',
    layer_avatar_origin: true,
    layer_fit: { native: 'cover', mismatch: 'cover' },
  };
  const wideBox = { width: 1920, height: 1080 };
  const tallBox = { width: 1080, height: 1920 };
  const squareBox = { width: 1080, height: 1080 };

  // Should return 'cover' on all canvases without needing layer_asset_width/height:
  assert.equal(chosenFit(avatarLayer, wideBox), 'cover');
  assert.equal(chosenFit(avatarLayer, tallBox), 'cover');
  assert.equal(chosenFit(avatarLayer, squareBox), 'cover');
});

test('chosenFit returns cover for avatar layers even if layer_fit specifies mismatch=blur', () => {
  const avatarLayerWithBlur = {
    name: 'avatar',
    layer_avatar_origin: true,
    layer_fit: { native: 'cover', mismatch: 'blur' },
  };
  const tallBox = { width: 1080, height: 1920 };
  // S4: Centered cover wins over fit[mismatch]
  assert.equal(chosenFit(avatarLayerWithBlur, tallBox), 'cover');
});

test('applyCachedAvatars tags layers with layer_avatar_origin and layer_fit cover', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-fit-'));
  try {
    const img = path.join(dir, 'a.png');
    fs.writeFileSync(img, Buffer.from('img'));
    const aud = path.join(dir, 'a.mp3');
    fs.writeFileSync(aud, Buffer.from('aud'));
    const layer = {
      name: 'avatar-layer',
      type: 'presenter',
      properties: {
        layer_type: 'talking_avatar',
        layer_asset_source: img,
        layer_avatar_model: 'wavespeed-ai/infinitetalk-fast',
      },
    };
    const parsed = {
      scenes: [
        {
          id: 's1',
          slug: 's1',
          narration: 'Hello world',
          layers: [layer],
        },
      ],
    };
    const fakeCache = {
      computeHash: (c, o) => 'hash',
      getSync(key, ext, cat) {
        if (cat === 'tts') return aud;
        return '/path/to/cached/avatar.mp4';
      },
    };
    const config = { voices: {} };

    const res = applyCachedAvatars({
      parsed,
      scriptDir: dir,
      cacheManager: fakeCache,
      config,
      models: { avatar: 'wavespeed-ai/infinitetalk-fast' },
      bags: {},
    });

    assert.equal(res.applied, 1);
    assert.equal(layer.properties.layer_type, 'video');
    assert.equal(layer.properties.layer_asset_source, '/path/to/cached/avatar.mp4');
    assert.equal(layer.properties.layer_avatar_origin, true);
    assert.deepEqual(layer.properties.layer_fit, { native: 'cover', mismatch: 'cover' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
