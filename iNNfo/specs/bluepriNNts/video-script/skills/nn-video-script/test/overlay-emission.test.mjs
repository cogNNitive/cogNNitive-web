import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProject } from '../scripts/scene-project.mjs';

function fixture() {
  return {
    compositionId: 'demo',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: 180,
    totalDurationInSeconds: 6,
    tracks: {
      scenes: [
        { id: 'scene_a', slug: 'a', fromFrame: 0, durationInFrames: 90, transition: { type: 'none' }, props: { layers: [{ layer_type: 'image', layer_asset_source: 'bg.jpg', layer_level: 0 }] } },
        { id: 'scene_b', slug: 'b', fromFrame: 90, durationInFrames: 90, transition: { type: 'none' }, props: { layers: [] } },
      ],
      audio: [{ id: 'audio_scene_a', sceneId: 'scene_a', assetPath: 'vo_a.mp3', fromFrame: 0, durationInFrames: 90, volume: 1 }],
      overlays: [
        { id: 'overlay_scene_a_1', type: 'lowerThird', fromFrame: 0, durationInFrames: 90, config: { text: 'Lucas Cervera', position: 'bottom-left' } },
        { id: 'overlay_scene_a_2', type: 'watermark', fromFrame: 0, durationInFrames: 90, config: { text: 'generado con IA', position: 'bottom' } },
      ],
    },
    metadata: {},
  };
}

test('scene overlays are emitted inside their Scene Sub-composition, not at the root', () => {
  const { indexHtml, compositions } = buildProject(fixture());
  const sceneA = compositions.find((c) => c.slug === 'a').html;
  assert.match(sceneA, /overlay_scene_a_1/);
  assert.match(sceneA, /data-block="lower-third"/);
  assert.match(sceneA, /data-overlay-type="watermark"/);
  assert.doesNotMatch(indexHtml, /overlay_scene_a_1/, 'overlays do not live at the root');
  const sceneB = compositions.find((c) => c.slug === 'b').html;
  assert.doesNotMatch(sceneB, /overlay_scene_a_1/, 'an overlay belongs only to its scene');
});

test('the overlay host anchor is always present as a stable insertion point', () => {
  const { compositions } = buildProject(fixture());
  for (const c of compositions) assert.match(c.html, /nn-overlay-host/);
});

test('a series frame override is honored in the emitted block', () => {
  const { compositions } = buildProject(fixture(), { seriesFrame: { blocks: { lowerThird: 'serie-lower' } } });
  const sceneA = compositions.find((c) => c.slug === 'a').html;
  assert.match(sceneA, /data-block="serie-lower"/);
});

test('narration captions are a single root host only when enabled', () => {
  const off = buildProject(fixture());
  assert.doesNotMatch(off.indexHtml, /data-track-kind="captions"/);

  const on = buildProject(fixture(), { narrationCaptions: true });
  const hosts = [...on.indexHtml.matchAll(/data-track-kind="captions"/g)];
  assert.equal(hosts.length, 1, 'exactly one captions host');
  for (const c of on.compositions) assert.doesNotMatch(c.html, /data-track-kind="captions"/);
});
