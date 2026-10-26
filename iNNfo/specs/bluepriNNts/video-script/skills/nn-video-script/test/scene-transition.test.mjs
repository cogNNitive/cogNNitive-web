import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneTransitionFragment, SUPPORTED_TRANSITIONS } from '../scripts/scene-transition.mjs';

test('fade returns an opacity tween on the inner wrapper, not the .clip', () => {
  const f = sceneTransitionFragment({ type: 'fade', durationInFrames: 15 }, 30);
  assert.ok(f);
  assert.equal(f.type, 'fade');
  assert.equal(f.seconds, 0.5);
  assert.match(f.js, /tl\.fromTo\('#root'/);
  assert.match(f.js, /opacity/);
  assert.doesNotMatch(f.js, /class|\.clip/);
  assert.doesNotMatch(f.js, /autoAlpha|visibility|display:/);
});

test('slide-left and slide-right tween x', () => {
  const l = sceneTransitionFragment({ type: 'slide-left', durationInFrames: 15 }, 30);
  const r = sceneTransitionFragment({ type: 'slide-right', durationInFrames: 15 }, 30);
  assert.match(l.js, /xPercent/);
  assert.match(r.js, /xPercent/);
  assert.notEqual(l.js, r.js);
});

test('wipe uses clip-path', () => {
  const f = sceneTransitionFragment({ type: 'wipe', durationInFrames: 15 }, 30);
  assert.match(f.js, /clipPath/);
});

test('none and unknown emit no tween', () => {
  assert.equal(sceneTransitionFragment({ type: 'none' }, 30), null);
  assert.equal(sceneTransitionFragment(null, 30), null);
  assert.equal(sceneTransitionFragment({ type: 'crossfade' }, 30), null);
});

test('duration defaults to 0.5s and honours the manifest easing', () => {
  const f = sceneTransitionFragment({ type: 'fade' }, 30);
  assert.equal(f.seconds, 0.5);
  const g = sceneTransitionFragment({ type: 'fade', durationInFrames: 9, easing: 'linear' }, 30);
  assert.equal(g.seconds, 0.3);
  assert.match(g.js, /ease: 'linear'/);
});

test('the supported set is explicit', () => {
  assert.deepEqual(SUPPORTED_TRANSITIONS, ['fade', 'slide-left', 'slide-right', 'wipe', 'none']);
});
