import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProject } from '../scripts/scene-project.mjs';

function fixture() {
  return {
    compositionId: 'demo',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: 90,
    totalDurationInSeconds: 3,
    tracks: {
      scenes: [{ id: 'scene_a', slug: 'a', fromFrame: 0, durationInFrames: 90, transition: { type: 'none' }, props: { layers: [] } }],
      audio: [],
      overlays: [],
    },
    metadata: {},
  };
}

test('scene hosts mount their composition via data-composition-src', () => {
  const { indexHtml } = buildProject(fixture());
  assert.match(indexHtml, /data-composition-src="compositions\/a\.html"/);
  assert.match(indexHtml, /data-width="1080" data-height="1080"/);
});

test('the scene root declares its composition id and loads gsap', () => {
  const { compositions } = buildProject(fixture());
  assert.match(compositions[0].html, /<div id="root" data-composition-id="a"/);
  assert.match(compositions[0].html, /gsap\.min\.js/);
});

test('the root registers its timeline and loads gsap', () => {
  const { indexHtml } = buildProject(fixture());
  assert.match(indexHtml, /gsap\.min\.js/);
  assert.match(indexHtml, /window\.__timelines\["demo"\]/);
});
