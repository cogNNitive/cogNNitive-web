import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';
import { resolveMediaLayers, findSeriesRoot } from '../scripts/video-engine-cli.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'inflacion-script.md');

const compile = (text, options = {}) => {
  const c = new RemotionSceneCompiler({});
  return c.compile(c.parseScript(text), options);
};

const script = (sceneProps) =>
  ['//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: T', '- video_fps: 30', '', '# Scenes', '', '## Scene 1: Uno', '@base Uno', sceneProps, '', 'Hola mundo.', ''].join('\n');

describe('per-scene background music track', () => {
  it('emits a loop track spanning exactly its scene with the declared volume', () => {
    const m = compile(script(['- scene_duration: 4', '- scene_background_audio: ../../shared/music/loop.m4a', '- scene_background_audio_volume: 0.35'].join('\n')));
    const music = m.tracks.audio.filter((a) => a.id.startsWith('bgmusic_'));
    assert.equal(music.length, 1);
    const scene = m.tracks.scenes[0];
    assert.equal(music[0].sceneId, scene.id);
    assert.equal(music[0].fromFrame, scene.fromFrame);
    assert.equal(music[0].durationInFrames, scene.durationInFrames);
    assert.equal(music[0].volume, 0.35);
    assert.equal(music[0].loop, true);
    assert.equal(music[0].kind, 'music');
    assert.equal(music[0].assetPath, '../../shared/music/loop.m4a');
  });

  it('defaults the volume to 0.2 when none is declared', () => {
    const m = compile(script(['- scene_duration: 4', '- scene_background_audio: m.m4a'].join('\n')));
    assert.equal(m.tracks.audio[0].volume, 0.2);
  });

  it('a scene without music emits no music track', () => {
    const m = compile(script('- scene_duration: 4'));
    assert.equal(m.tracks.audio.length, 0);
  });

  it('an explicit volume of 0 is honoured, not replaced by the default', () => {
    const m = compile(script(['- scene_duration: 4', '- scene_background_audio: m.m4a', '- scene_background_audio_volume: 0'].join('\n')));
    assert.equal(m.tracks.audio[0].volume, 0);
  });

  it('rejects an absolute music path', () => {
    assert.throws(() => compile(script(['- scene_duration: 4', '- scene_background_audio: C:/Windows/x.m4a'].join('\n'))), /background audio/i);
    assert.throws(() => compile(script(['- scene_duration: 4', '- scene_background_audio: /etc/x.m4a'].join('\n'))), /background audio/i);
  });

  it('narration tracks are unchanged next to the music track', () => {
    const text = script(['- scene_duration: 4', '- scene_background_audio: m.m4a'].join('\n'));
    const m = compile(text, { audioAssets: { scene_1_scene_1_uno: { assetPath: 'audio/n.mp3', sha256: 'abc', durationSeconds: 4 } } });
    const narr = m.tracks.audio.filter((a) => a.id.startsWith('audio_'));
    assert.equal(narr.length, 1);
    assert.equal(narr[0].volume, 1);
    assert.equal(narr[0].loop, undefined);
    assert.equal(narr[0].kind, undefined);
    assert.equal(m.tracks.audio.length, 2);
  });

  it('regression: every scene of the series fixture that declares music gets a track', () => {
    const text = fs.readFileSync(FIXTURE, 'utf8');
    const c = new RemotionSceneCompiler({});
    const parsed = c.parseScript(text);
    const m = c.compile(parsed, {});
    const declaring = parsed.scenes.filter((s) => s.properties.scene_background_audio);
    assert.ok(declaring.length >= 5);
    for (const sc of declaring) {
      const t = m.tracks.audio.find((a) => a.id === `bgmusic_${sc.id}`);
      assert.ok(t, `no music track for ${sc.id}`);
      const scene = m.tracks.scenes.find((s) => s.id === sc.id);
      assert.equal(t.fromFrame, scene.fromFrame);
      assert.equal(t.durationInFrames, scene.durationInFrames);
      assert.equal(t.volume, Number(sc.properties.scene_background_audio_volume ?? 0.2));
    }
    assert.equal(m.tracks.audio.filter((a) => a.kind === 'music').length, declaring.length);
  });
});

describe('music staging', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-'));
  const series = path.join(tmp, 'series');
  const epDir = path.join(series, 'assets', 'ep');
  fs.mkdirSync(path.join(series, 'shared', 'music'), { recursive: true });
  fs.mkdirSync(epDir, { recursive: true });
  fs.writeFileSync(path.join(series, 'series_rules.md'), '# rules');
  fs.writeFileSync(path.join(series, 'shared', 'music', 'a.m4a'), 'music-bytes');
  fs.writeFileSync(path.join(tmp, 'outside.m4a'), 'outside');
  const mk = (src) => ({ tracks: { scenes: [], overlays: [], audio: [{ id: 'bgmusic_x', kind: 'music', assetPath: src }] } });
  const publicDir = path.join(epDir, 'public');

  it('finds the series root by its rules file', () => {
    assert.equal(findSeriesRoot(epDir), series);
    assert.equal(findSeriesRoot(tmp), undefined);
  });

  it('stages an in-series relative music file into the public dir', () => {
    const m = mk('../../shared/music/a.m4a');
    const r = resolveMediaLayers(m, { scriptDir: epDir, publicDir, seriesRoot: series });
    assert.deepEqual(r.missing, []);
    assert.deepEqual(r.escaped, []);
    assert.ok(fs.existsSync(path.join(publicDir, m.tracks.audio[0].assetPath)));
  });

  it('a missing music file is reported as missing', () => {
    const r = resolveMediaLayers(mk('../../shared/music/nope.m4a'), { scriptDir: epDir, publicDir, seriesRoot: series });
    assert.deepEqual(r.missing, ['../../shared/music/nope.m4a']);
  });

  it('a music path escaping the series tree is rejected and not staged', () => {
    const m = mk('../../../outside.m4a');
    const r = resolveMediaLayers(m, { scriptDir: epDir, publicDir, seriesRoot: series });
    assert.deepEqual(r.escaped, ['../../../outside.m4a']);
    assert.equal(m.tracks.audio[0].assetPath, '../../../outside.m4a');
  });
});
