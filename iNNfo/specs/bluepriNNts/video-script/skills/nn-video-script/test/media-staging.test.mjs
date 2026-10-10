#!/usr/bin/env node

/**
 * nn-video-script/test/media-staging.test.mjs
 *
 * Media staging: every media reference in a compiled manifest — drawable layers,
 * audio, AND overlay tracks (b-roll) — is copied into the Remotion-served public
 * dir and rewritten to its staged, bundle-relative name.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveMediaLayers } from '../scripts/video-engine-cli.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nn-media-staging-'));
}

describe('resolveMediaLayers', () => {
  it('stages overlay b-roll assets (config.assetPath) into public and rewrites the name', () => {
    const dir = makeTempDir();
    const scriptDir = path.join(dir, 'assets', 'video');
    const publicDir = path.join(scriptDir, 'public');
    fs.mkdirSync(path.join(scriptDir, 'media'), { recursive: true });
    fs.writeFileSync(path.join(scriptDir, 'media', 'broll.png'), 'PNGDATA', 'utf8');

    const manifest = {
      tracks: {
        scenes: [],
        audio: [],
        overlays: [{ id: 'o1', type: 'broll', config: { assetPath: 'media/broll.png', fit: 'cover' } }],
      },
    };

    const res = resolveMediaLayers(manifest, { scriptDir, publicDir });

    assert.equal(res.staged, 1);
    assert.deepEqual(res.missing, []);
    const staged = manifest.tracks.overlays[0].config.assetPath;
    assert.notEqual(staged, 'media/broll.png', 'assetPath must be rewritten to the staged name');
    assert.ok(fs.existsSync(path.join(publicDir, staged)), 'the staged file must exist in public');
  });

  it('stages drawable layer assets and audio, and reports missing sources without throwing', () => {
    const dir = makeTempDir();
    const scriptDir = path.join(dir, 'video');
    const publicDir = path.join(scriptDir, 'public');
    fs.mkdirSync(scriptDir, { recursive: true });
    fs.writeFileSync(path.join(scriptDir, 'bg.png'), 'IMG', 'utf8');

    const manifest = {
      tracks: {
        scenes: [{ props: { layers: [{ layer_asset_source: 'bg.png' }] } }],
        audio: [{ id: 'a1', assetPath: 'missing.mp3' }],
        overlays: [],
      },
    };

    const res = resolveMediaLayers(manifest, { scriptDir, publicDir });
    assert.equal(res.staged, 1);
    assert.deepEqual(res.missing, ['missing.mp3']);
    assert.notEqual(manifest.tracks.scenes[0].props.layers[0].layer_asset_source, 'bg.png');
  });
});
