#!/usr/bin/env node

/**
 * nn-video-script/test/scene-media-types.test.mjs
 *
 * Guards the media-type coverage of the composition:
 *  1. `pickLayerPrimitive` maps every layer type to the right Remotion primitive.
 *  2. `resolveMediaLayers` stages in-dir AND out-of-dir assets into the public
 *     dir, rewrites both to unique bundle-relative names, and reports nothing
 *     missing.
 *  3. A referenced-but-absent asset is reported (so the CLI can fail loudly),
 *     never silently dropped.
 *  4. `compileVideo` throws a named VideoRenderError when a referenced asset is
 *     missing, and writes no manifest.
 *  5. `tryRemotionRender` passes `publicDir` from the manifest to `bundle()`.
 *
 * `resolveMediaLayers` imports no Remotion module, so this suite runs with no
 * renderer installed.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileVideo,
  renderVideo,
  resolveMediaLayers,
  tryRemotionRender,
  VideoRenderError,
} from '../scripts/video-engine-cli.mjs';
import {
  pickLayerPrimitive,
  IMAGE_PRIMITIVE,
  VIDEO_PRIMITIVE,
  AVATAR_PRIMITIVE,
} from '../scripts/scene/layer-primitive.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scene-media-types-test-'));
}

async function runTests() {
  console.log('Running scene media types tests...');

  // 1. Layer → primitive mapping.
  {
    assert.strictEqual(pickLayerPrimitive('video'), VIDEO_PRIMITIVE, 'video → OffthreadVideo');
    assert.strictEqual(pickLayerPrimitive('VIDEO'), VIDEO_PRIMITIVE, 'case-insensitive video');
    assert.strictEqual(pickLayerPrimitive('talking_avatar'), AVATAR_PRIMITIVE, 'talking_avatar → avatar frame');
    assert.strictEqual(pickLayerPrimitive('avatar'), AVATAR_PRIMITIVE, 'avatar alias');
    assert.strictEqual(pickLayerPrimitive('image'), IMAGE_PRIMITIVE, 'image → Img');
    assert.strictEqual(pickLayerPrimitive(undefined), IMAGE_PRIMITIVE, 'unknown → Img fallback');
    assert.strictEqual(pickLayerPrimitive('text'), IMAGE_PRIMITIVE, 'unmapped type → Img fallback');
    console.log('✔ every layer type maps to the correct Remotion primitive');
  }

  // 2. In-dir + out-of-dir staging and rewrite.
  {
    const tmpDir = makeTempDir();
    const scriptDir = path.join(tmpDir, 'automovil');
    const sharedDir = path.join(tmpDir, 'shared');
    const assetsDir = path.join(scriptDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.mkdirSync(sharedDir, { recursive: true });

    // Distinct content so the hash suffix differs; same basename is deliberate.
    fs.writeFileSync(path.join(assetsDir, 'clip.mp4'), Buffer.from([1, 2, 3, 4]));
    fs.writeFileSync(path.join(sharedDir, 'clip.mp4'), Buffer.from([9, 8, 7, 6]));
    fs.writeFileSync(path.join(assetsDir, 'avatar.jpeg'), Buffer.from([5, 5, 5]));

    const publicDir = path.join(scriptDir, 'public');
    const manifest = {
      tracks: {
        scenes: [
          {
            id: 'scene_1',
            props: {
              layers: [
                { name: 'In-dir video', layer_type: 'video', layer_asset_source: 'assets/clip.mp4' },
                { name: 'Out-of-dir video', layer_type: 'video', layer_asset_source: '../shared/clip.mp4' },
                { name: 'Avatar', layer_type: 'talking_avatar', layer_asset_source: 'assets/avatar.jpeg' },
                { name: 'Text', layer_type: 'text' },
              ],
            },
          },
        ],
        audio: [{ id: 'audio_1', assetPath: '../shared/clip.mp4' }],
      },
    };

    const res = resolveMediaLayers(manifest, { scriptDir, publicDir });

    assert.deepStrictEqual(res.missing, [], 'no missing assets expected');
    assert.ok(res.staged >= 3, `expected at least 3 staged files, got ${res.staged}`);

    const layers = manifest.tracks.scenes[0].props.layers;
    const inDir = layers[0].layer_asset_source;
    const outDir = layers[1].layer_asset_source;
    const avatar = layers[2].layer_asset_source;

    assert.ok(!inDir.includes('/') && !inDir.includes('..'), `staged name must be bundle-relative, got ${inDir}`);
    assert.ok(!outDir.includes('/') && !outDir.includes('..'), `staged name must be bundle-relative, got ${outDir}`);
    assert.notStrictEqual(inDir, outDir, 'same-basename sources must not collide');
    assert.ok(inDir.endsWith('.mp4') && outDir.endsWith('.mp4'), 'extensions preserved');

    assert.ok(fs.existsSync(path.join(publicDir, inDir)), `staged in-dir file missing: ${inDir}`);
    assert.ok(fs.existsSync(path.join(publicDir, outDir)), `staged out-of-dir file missing: ${outDir}`);
    assert.ok(fs.existsSync(path.join(publicDir, avatar)), `staged avatar file missing: ${avatar}`);

    // The out-of-dir staged bytes must be the shared source's bytes, not the in-dir one.
    assert.ok(
      fs.readFileSync(path.join(publicDir, outDir)).equals(Buffer.from([9, 8, 7, 6])),
      'out-of-dir source content must be preserved',
    );

    // Audio track rewritten to the same staged name (deduped by content).
    assert.strictEqual(manifest.tracks.audio[0].assetPath, outDir, 'audio reuses the identical staged name');

    // Text layer (no source) is untouched.
    assert.strictEqual(layers[3].layer_asset_source, undefined, 'sourceless layer untouched');
    console.log('✔ in-dir and out-of-dir assets stage to unique bundle-relative names');
  }

  // 3. Missing asset is reported, not silently dropped.
  {
    const tmpDir = makeTempDir();
    const scriptDir = path.join(tmpDir, 'video');
    fs.mkdirSync(scriptDir, { recursive: true });
    const publicDir = path.join(scriptDir, 'public');
    const manifest = {
      tracks: {
        scenes: [{ id: 's1', props: { layers: [{ layer_type: 'video', layer_asset_source: '../shared/nope.mp4' }] } }],
        audio: [],
      },
    };
    const res = resolveMediaLayers(manifest, { scriptDir, publicDir });
    assert.deepStrictEqual(res.missing, ['../shared/nope.mp4'], 'missing source reported');
    assert.strictEqual(manifest.tracks.scenes[0].props.layers[0].layer_asset_source, '../shared/nope.mp4', 'unresolved path left intact');
    console.log('✔ a missing asset is reported and never silently dropped');
  }

  // 4. compileVideo fails loudly (VideoRenderError) when a referenced asset is absent.
  {
    const tmpDir = makeTempDir();
    const scriptPath = path.join(tmpDir, 'script.md');
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(
      scriptPath,
      [
        '//ANYDEO_SPEC: V_0-3-3',
        '# Video',
        '- video_title: Missing Asset Demo',
        '- video_fps: 30',
        '# Scenes',
        '## Scene 1: One',
        '## Scene 1: Broken',
        '@base Intro',
        '- scene_duration: 2.0',
        '@@ Media',
        '- layer_type: video',
        '  ![media](../shared/does_not_exist.mp4)',
        '',
      ].join('\n'),
      'utf8',
    );

    await assert.rejects(
      () => compileVideo({ scriptPath, outputPath: manifestPath, synthesizeAssets: false }),
      (err) => err.name === 'VideoRenderError',
      'compileVideo must throw a named VideoRenderError for a missing asset',
    );
    assert.ok(!fs.existsSync(manifestPath), 'no manifest is written when staging fails');
    console.log('✔ compileVideo hard-fails on a missing asset and writes no manifest');
  }

  // 5. tryRemotionRender forwards the manifest publicDir to bundle().
  {
    const tmpDir = makeTempDir();
    const fakeEntry = path.join(tmpDir, 'remotion-entry.tsx');
    fs.writeFileSync(fakeEntry, '// fake remotion entry', 'utf8');
    const publicDir = path.join(tmpDir, 'public');
    fs.mkdirSync(publicDir, { recursive: true });

    let bundledWith = null;
    const fakeBundler = {
      bundle: async (options) => {
        bundledWith = options;
        return 'serve://bundle';
      },
    };
    const fakeRenderer = {
      selectComposition: async (options) => ({ id: options.id, fps: 30, width: 1920, height: 1080, durationInFrames: 30 }),
      renderMedia: async () => {},
    };
    const loadModule = async (id) => {
      if (id === '@remotion/bundler') return fakeBundler;
      if (id === '@remotion/renderer') return fakeRenderer;
      return null;
    };

    const res = await tryRemotionRender(
      {
        manifest: { compositionId: 'c', fps: 30, totalDurationInFrames: 30, metadata: { publicDir } },
        outputPath: path.join(tmpDir, 'out.mp4'),
      },
      { loadModule, scriptsDir: tmpDir },
    );

    assert.strictEqual(res.rendered, true);
    assert.strictEqual(bundledWith.publicDir, publicDir, 'bundle() must receive the manifest publicDir');
    console.log('✔ tryRemotionRender forwards the manifest publicDir to bundle()');
  }

  console.log('\nAll scene media types tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
