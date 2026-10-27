import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildProject, emitHyperframesProject } from '../scripts/scene-project.mjs';

function fixture() {
  return {
    version: '1.0.0',
    compositionId: 'demo-video',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: 240,
    totalDurationInSeconds: 8,
    tracks: {
      scenes: [
        {
          id: 'scene_intro',
          slug: 'intro',
          fromFrame: 0,
          durationInFrames: 90,
          transition: { type: 'fade', durationInFrames: 15, easing: 'power2.out' },
          props: {
            layers: [
              { layer_type: 'image', layer_asset_source: 'bg_intro_abc.jpg', layer_level: 0 },
              { layer_type: 'talking_avatar', layer_asset_source: 'avatar_lucas_def.png', layer_level: 50 },
            ],
          },
        },
        {
          id: 'scene_body',
          slug: 'body',
          fromFrame: 90,
          durationInFrames: 150,
          transition: { type: 'none' },
          props: { layers: [{ layer_type: 'video', layer_asset_source: 'clip_ghi.mp4', layer_level: 0 }] },
        },
      ],
      audio: [
        { id: 'audio_scene_intro', sceneId: 'scene_intro', assetPath: 'vo_intro.mp3', fromFrame: 0, durationInFrames: 90, volume: 1 },
        { id: 'audio_scene_body', sceneId: 'scene_body', assetPath: 'vo_body.mp3', fromFrame: 90, durationInFrames: 150, volume: 1 },
        { id: 'bgmusic_scene_intro', sceneId: 'scene_intro', kind: 'music', assetPath: 'jazz.mp3', fromFrame: 0, durationInFrames: 90, volume: 0.4, loop: true },
      ],
      overlays: [],
    },
    metadata: { generator: 'cogNNitive Video Engine' },
  };
}

test('root declares the total duration and one scene host per Scene', () => {
  const { indexHtml } = buildProject(fixture());
  assert.match(indexHtml, /id="root"[^>]*data-duration="8"/);
  assert.match(indexHtml, /id="scene-intro"[^>]*data-start="0"[^>]*data-duration="3"/);
  assert.match(indexHtml, /id="scene-body"[^>]*data-start="3"[^>]*data-duration="5"/);
});

test('every audio element lives at the root; no Sub-composition nests audio', () => {
  const { indexHtml, compositions } = buildProject(fixture());
  const audioIds = [...indexHtml.matchAll(/<audio id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(audioIds, ['audio_scene_intro', 'audio_scene_body', 'bgmusic_scene_intro']);
  for (const c of compositions) assert.doesNotMatch(c.html, /<audio/);
});

test('scene layers are emitted in paint order by z-index', () => {
  const { compositions } = buildProject(fixture());
  const intro = compositions.find((c) => c.slug === 'intro').html;
  const bg = intro.indexOf('z-index:0');
  const avatar = intro.indexOf('z-index:50');
  assert.ok(bg >= 0 && avatar >= 0 && bg < avatar, 'background renders before the avatar');
  assert.match(intro, /<img[^>]*src="assets\/bg_intro_abc\.jpg"/);
});

test('every media layer carries a stable id (HyperFrames Studio edit target)', () => {
  const { compositions } = buildProject(fixture());
  const intro = compositions.find((c) => c.slug === 'intro').html;
  assert.match(intro, /<img id="media-intro-1"[^>]*src="assets\/bg_intro_abc\.jpg"/);
  assert.match(intro, /<img id="media-intro-2"[^>]*src="assets\/avatar_lucas_def\.png"/);
  const body = compositions.find((c) => c.slug === 'body').html;
  assert.match(body, /<video id="media-body-1"/);
});

test('a declared transition is emitted on the wrapper; none emits none', () => {
  const { compositions } = buildProject(fixture());
  const intro = compositions.find((c) => c.slug === 'intro').html;
  const body = compositions.find((c) => c.slug === 'body').html;
  assert.match(intro, /window\.__timelines\["intro"\]/);
  assert.match(intro, /tl\.fromTo\('#root'.*opacity/s);
  assert.doesNotMatch(body, /tl\.fromTo/);
});

test('emission is deterministic (same manifest, byte-identical files)', () => {
  assert.equal(JSON.stringify(buildProject(fixture())), JSON.stringify(buildProject(fixture())));
});

test('emitHyperframesProject writes the tree and is idempotent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-proj-'));
  const r1 = emitHyperframesProject(fixture(), { projectDir: dir });
  assert.ok(fs.existsSync(r1.indexHtml));
  assert.equal(r1.compositions.length, 2);
  const first = fs.readFileSync(r1.indexHtml, 'utf8');
  emitHyperframesProject(fixture(), { projectDir: dir });
  assert.equal(fs.readFileSync(r1.indexHtml, 'utf8'), first);
  assert.ok(fs.existsSync(path.join(dir, 'hyperframes.json')));
  fs.rmSync(dir, { recursive: true, force: true });
});
