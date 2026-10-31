/**
 * nn-video-script/test/sound-events.test.mjs
 *
 * RED→GREEN tests for sound effects bound to engine events (design D6/D12/D21):
 * every supported key is timed from the manifest (video-start at 0, video-end at
 * total minus the probed sound length, scene boundaries skip scene 0, overlay
 * enter/exit, layer-enter.<type>); a key the cascade never resolves is silent; a
 * user-level name with no file fails pre-compile with `MissingAssetError`, a
 * blueprint-only name is skipped with one warning; a sound effect carries no
 * `data-duration`; and no concrete sound name lives in the engine scripts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject } from '../scripts/scene-project.mjs';
import {
  compileVideo,
  soundEventFrames,
  resolveSounds,
  resolveSoundFiles,
  SUPPORTED_SOUND_KEYS,
} from '../scripts/video-engine-cli.mjs';
import { MissingAssetError, resetMissingAssetWarnings } from '../scripts/lib/missing-asset.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A manifest with three scenes, a title/lower-third/b-roll overlay and a presenter layer. */
function manifestFixture() {
  return {
    compositionId: 'demo',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: 300,
    totalDurationInSeconds: 10,
    tracks: {
      scenes: [
        { id: 'scene_a', slug: 'a', fromFrame: 0, durationInFrames: 90, props: { layers: [] } },
        {
          id: 'scene_b',
          slug: 'b',
          fromFrame: 90,
          durationInFrames: 90,
          props: { layers: [{ layer_type: 'talking_avatar', layer_asset_source: 'presenter.png' }] },
        },
        { id: 'scene_c', slug: 'c', fromFrame: 180, durationInFrames: 120, props: { layers: [] } },
      ],
      audio: [],
      overlays: [
        { id: 'ov_title', type: 'kineticTitle', fromFrame: 90, durationInFrames: 60, config: { heading: 'Hi' } },
        { id: 'ov_lt', type: 'lowerThird', fromFrame: 90, durationInFrames: 60, config: { title: 'X' } },
        { id: 'ov_br', type: 'broll', fromFrame: 200, durationInFrames: 40, config: { assetPath: 'clip.mp4' } },
      ],
    },
  };
}

/** Writes a `sounds/<name>.mp3` file for every name and returns the episode dir. */
function soundsFixture(names) {
  const root = tmp('nn-sound-events-');
  const soundsDir = path.join(root, 'sounds');
  fs.mkdirSync(soundsDir, { recursive: true });
  for (const name of names) fs.writeFileSync(path.join(soundsDir, `${name}.mp3`), `data:${name}`, 'utf8');
  return root;
}

test('the engine supports exactly the documented sound keys', () => {
  assert.deepEqual(SUPPORTED_SOUND_KEYS, [
    'video-start',
    'video-end',
    'scene-boundary',
    'overlay-enter.title',
    'overlay-enter.lower-third',
    'overlay-enter.caption',
    'overlay-enter.quote',
    'overlay-enter.watermark',
    'overlay-exit.title',
    'overlay-exit.lower-third',
    'overlay-exit.caption',
    'overlay-exit.quote',
    'overlay-exit.watermark',
    'layer-enter.b-roll',
    'layer-enter.animation',
    'layer-enter.presenter',
  ]);
});

test('each key is timed from the manifest: video-start 0, boundaries skip scene 0, enter/exit, layer-enter', () => {
  const frames = soundEventFrames(manifestFixture());
  assert.deepEqual(frames.get('video-start'), [0]);
  assert.deepEqual(frames.get('video-end'), [300], 'the end frame; the start is total minus the probed length');
  assert.deepEqual(frames.get('scene-boundary'), [90, 180], 'scene 0 has no boundary');
  assert.deepEqual(frames.get('overlay-enter.title'), [90]);
  assert.deepEqual(frames.get('overlay-exit.title'), [150]);
  assert.deepEqual(frames.get('overlay-enter.lower-third'), [90]);
  assert.deepEqual(frames.get('overlay-exit.lower-third'), [150]);
  assert.deepEqual(frames.get('layer-enter.presenter'), [90]);
  assert.deepEqual(frames.get('layer-enter.b-roll'), [200]);
  assert.equal(frames.has('overlay-enter.caption'), false, 'an absent event has no time');
});

test('resolveSounds emits one kind:sfx track per event and stages its file', async () => {
  const root = soundsFixture(['start', 'end', 'boundary', 'click', 'pop']);
  const publicDir = path.join(root, 'public');
  const bags = {
    blueprint: {
      sounds:
        '[video-start=start, video-end=end, scene-boundary=boundary, overlay-enter.title=click, layer-enter.presenter=pop]',
    },
  };
  const files = resolveSoundFiles({ bags, scriptDir: root, workspaceRoot: root, skillDir: SKILL_DIR });
  const tracks = await resolveSounds({
    manifest: manifestFixture(),
    files,
    scriptDir: root,
    publicDir,
    probe: async () => ({ seconds: 2, source: 'ffprobe' }),
  });

  const byKey = (key) => tracks.filter((t) => t.id.includes(key.replace(/[^a-z0-9]+/gi, '_')));
  assert.equal(tracks.length, 6, `expected 6 sfx tracks, got ${tracks.length}: ${tracks.map((t) => t.id).join(', ')}`);
  for (const t of tracks) assert.equal(t.kind, 'sfx');
  assert.equal(byKey('video_start')[0].fromFrame, 0);
  assert.equal(byKey('video_end')[0].fromFrame, 240, '10s video, 2s sound -> starts at 8s = 240 frames');
  assert.deepEqual(byKey('scene_boundary').map((t) => t.fromFrame).sort((a, b) => a - b), [90, 180]);
  assert.equal(byKey('overlay_enter_title')[0].fromFrame, 90);
  assert.equal(byKey('layer_enter_presenter')[0].fromFrame, 90);
  for (const t of tracks) {
    assert.ok(fs.existsSync(path.join(publicDir, t.assetPath)), `staged file missing for ${t.id}`);
    assert.ok(!path.isAbsolute(t.assetPath), 'assetPath must be a staged bundle-relative name');
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('a per-slot key plays for its slot only', async () => {
  const root = soundsFixture(['click']);
  const bags = { series: { sounds: '[overlay-enter.title=click]' }, blueprint: {} };
  const files = resolveSoundFiles({ bags, scriptDir: root, workspaceRoot: root, skillDir: SKILL_DIR });
  const tracks = await resolveSounds({
    manifest: manifestFixture(),
    files,
    scriptDir: root,
    publicDir: path.join(root, 'public'),
    probe: async () => ({ seconds: 0 }),
  });
  assert.equal(tracks.length, 1, 'only the title overlay enters with a sound');
  assert.equal(tracks[0].fromFrame, 90);
  fs.rmSync(root, { recursive: true, force: true });
});

test('an unresolved key is silent and warns about nothing', async () => {
  const root = tmp('nn-sound-silent-');
  const warnings = [];
  const orig = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    resetMissingAssetWarnings();
    const files = resolveSoundFiles({ bags: {}, scriptDir: root, workspaceRoot: root, skillDir: SKILL_DIR });
    assert.deepEqual(files, {});
    const tracks = await resolveSounds({
      manifest: manifestFixture(),
      files,
      scriptDir: root,
      publicDir: path.join(root, 'public'),
      probe: async () => ({ seconds: 0 }),
    });
    assert.deepEqual(tracks, []);
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = orig;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a user-level sound name with no file throws MissingAssetError (name, level, paths searched)', () => {
  const root = tmp('nn-sound-missing-');
  assert.throws(
    () =>
      resolveSoundFiles({
        bags: { series: { sounds: '[overlay-enter.title=ghost]' }, blueprint: {} },
        scriptDir: root,
        workspaceRoot: root,
        skillDir: SKILL_DIR,
      }),
    (err) => {
      assert.ok(err instanceof MissingAssetError);
      assert.match(err.message, /sound/);
      assert.match(err.message, /ghost/);
      assert.match(err.message, /series/);
      assert.match(err.message, /searched/i);
      return true;
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('a blueprint-only sound name with no file warns once and is skipped', () => {
  const root = tmp('nn-sound-blueprint-');
  const warnings = [];
  const orig = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    resetMissingAssetWarnings();
    const files = resolveSoundFiles({
      bags: { blueprint: { sounds: '[scene-boundary=whoosh]' } },
      scriptDir: root,
      workspaceRoot: root,
      skillDir: SKILL_DIR,
    });
    assert.deepEqual(files, {}, 'a blueprint-only name with no file is skipped');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /whoosh/);
  } finally {
    console.warn = orig;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const SCRIPT = `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "video-script_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
title: "Sound Demo"
---

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]

# NN Video

## NN Video: Sound Demo
slug:: sound-demo
title:: Sound Demo

# NN Scene

## NN Scene: Overview
slug:: overview

Learn how neural networks process multidimensional input vectors today
`;

function compileFixture() {
  const root = tmp('nn-sound-compile-');
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const ep = path.join(root, 'ep');
  fs.mkdirSync(ep, { recursive: true });
  const scriptPath = path.join(ep, 'script.md');
  fs.writeFileSync(scriptPath, SCRIPT, 'utf8');
  return { root, scriptPath };
}

test('compileVideo fails before any synthesis when a user-level sound name has no file', async () => {
  const { root, scriptPath } = compileFixture();
  await assert.rejects(
    compileVideo({
      scriptPath,
      synthesizeAssets: false,
      bags: { series: { sounds: '[overlay-enter.title=ghost]' }, blueprint: {} },
    }),
    (err) => {
      assert.ok(err instanceof MissingAssetError);
      assert.match(err.message, /sound/);
      assert.match(err.message, /ghost/);
      assert.match(err.message, /series/);
      assert.match(err.message, /searched/i);
      return true;
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('compileVideo warns once and succeeds for a blueprint-only sound name with no file', async () => {
  const { root, scriptPath } = compileFixture();
  const warnings = [];
  const orig = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    resetMissingAssetWarnings();
    const res = await compileVideo({
      scriptPath,
      synthesizeAssets: false,
      bags: { blueprint: { sounds: '[scene-boundary=whoosh]' } },
    });
    assert.ok(res.manifest, 'the render still succeeds');
    assert.equal(warnings.filter((w) => /whoosh/.test(w)).length, 1);
  } finally {
    console.warn = orig;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a sound effect rides the root audio track with no data-duration', () => {
  const manifest = manifestFixture();
  manifest.tracks.audio = [
    { id: 'audio_scene_a', sceneId: 'scene_a', assetPath: 'vo_a.mp3', fromFrame: 0, durationInFrames: 90, volume: 1 },
    { id: 'sfx_video_start_0', kind: 'sfx', assetPath: 'pop_abc.mp3', fromFrame: 0 },
  ];
  const { indexHtml } = buildProject(manifest);
  const narration = indexHtml.match(/<audio id="audio_scene_a"[^>]*>/)[0];
  const sfx = indexHtml.match(/<audio id="sfx_video_start_0"[^>]*>/)[0];
  assert.match(narration, /data-duration="3"/, 'narration keeps its data-duration');
  assert.doesNotMatch(sfx, /data-duration/, 'a sound effect carries no data-duration');
  assert.match(sfx, /data-start="0"/);
  assert.match(sfx, /src="assets\/pop_abc\.mp3"/);
});

test('no concrete sound name lives in the engine scripts', () => {
  const scriptsDir = path.join(SKILL_DIR, 'scripts');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(mjs|js|cjs)$/i.test(entry.name)) files.push(full);
    }
  };
  walk(scriptsDir);
  const offenders = files.filter((f) => /whoosh/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], 'the blueprint default sound name must not appear in engine code');
});

test('resolveSoundFiles falls back to shared/audio when sound is not in sounds/', () => {
  const root = tmp('nn-sound-fallback-');
  const sharedAudioDir = path.join(root, 'shared', 'audio');
  fs.mkdirSync(sharedAudioDir, { recursive: true });
  fs.writeFileSync(path.join(sharedAudioDir, 'custom-start.mp3'), 'audio-data', 'utf8');

  const bags = {
    series: { sounds: '[video-start=custom-start]' },
  };
  const files = resolveSoundFiles({
    bags,
    scriptDir: root,
    workspaceRoot: root,
    skillDir: SKILL_DIR,
  });

  assert.ok(files['video-start']);
  assert.match(files['video-start'].path, /shared[/\\]audio[/\\]custom-start\.mp3/);
  fs.rmSync(root, { recursive: true, force: true });
});
