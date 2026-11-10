/**
 * nn-conntent/test/scene-kind-direct-fields.test.mjs
 *
 * A Scene Kind element accepts direct cascade fields (its own field values, above
 * presets), so a kind-level value beats the series and loses to the video; a Chrome
 * `music` feeds `background_audio` at the kind level, so a video or scene
 * `background_audio` wins over it (Q3). These ride on `createCascade` with the kind
 * bag (capability conntent-scene-kinds; task 2a.5 — RED: no kind level.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCascade } from '../scripts/lib/cascade.mjs';

const bag = () => ({
  domain: {},
  series: {},
  kind: {},
  video: {},
  scene: {},
  layer: {},
  blueprint: {},
});

test('a Scene Kind direct field beats the series and loses to the video', () => {
  const bags = bag();
  bags.series.transition = 'fade';
  bags.kind.transition = 'wipe';
  bags.video.transition = 'cut';
  const c = createCascade({ bags });
  assert.equal(c.at('scene-1').get('transition').value, 'cut');
});

test('a Scene Kind direct field beats the series when the video does not set it', () => {
  const bags = bag();
  bags.series.transition = 'fade';
  bags.kind.transition = 'wipe';
  const c = createCascade({ bags });
  const r = c.at('scene-1').get('transition');
  assert.equal(r.value, 'wipe');
  assert.equal(r.source, 'kind');
});

test('Chrome music feeds background_audio at the kind level', () => {
  const bags = bag();
  bags.series.background_audio = 'series-bed';
  bags.kind.music = 'kind-chrome';
  const c = createCascade({ bags });
  assert.equal(c.at('scene-1').get('background_audio').value, 'kind-chrome');
});

test('an explicit video background_audio beats the Chrome music', () => {
  const bags = bag();
  bags.kind.music = 'kind-chrome';
  bags.video.background_audio = 'video-bed';
  const c = createCascade({ bags });
  assert.equal(c.at('scene-1').get('background_audio').value, 'video-bed');
});

test('no kind level (Libre scene) falls through to the series', () => {
  const bags = bag();
  bags.series.background_audio = 'series-bed';
  // Libre scenes carry no kind bag: the resolver never sees the Chrome music.
  const c = createCascade({ bags: { ...bags, kind: {} } });
  const r = c.at('scene-1').get('background_audio');
  assert.equal(r.value, 'series-bed');
  assert.equal(r.source, 'series');
});
