/**
 * nn-conntent/test/animatic.test.mjs
 *
 * The preview animatic profile and its render seam (tasks 3b-2.6/3b-2.7).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANIMATIC_FPS,
  ANIMATIC_WIDTH,
  animaticName,
  animaticProfile,
  renderAnimatic,
} from '../scripts/lib/animatic.mjs';

test('the animatic is 640 px wide, 15 fps, at the master aspect', () => {
  assert.equal(ANIMATIC_WIDTH, 640);
  assert.equal(ANIMATIC_FPS, 15);
  assert.deepEqual(animaticProfile({ masterWidth: 1920, masterHeight: 1080 }), {
    width: 640,
    height: 360,
    fps: 15,
  });
  assert.deepEqual(animaticProfile({ masterWidth: 1920, masterHeight: 1920 }), {
    width: 640,
    height: 640,
    fps: 15,
  });
});

test('the animatic name carries the slug and the low-res dimensions', () => {
  assert.equal(animaticName({ slug: 'probe', width: 640, height: 360 }), 'probe_animatic_640x360.mp4');
});

test('renderAnimatic renders the low-res profile as an animatic', async () => {
  const captured = [];
  await renderAnimatic({
    scriptPath: 'series/s/episodes/e/e_coNNtent_NN.md',
    masterWidth: 1920,
    masterHeight: 1080,
    render: async (options) => {
      captured.push(options);
      return { outputVideoPath: 'x' };
    },
  });
  assert.deepEqual(captured[0], {
    scriptPath: 'series/s/episodes/e/e_coNNtent_NN.md',
    width: 640,
    height: 360,
    fps: 15,
    kind: 'animatic',
  });
});
