/**
 * nn-conntent/test/cascade.test.mjs
 *
 * `lib/cascade.mjs#createCascade({model, scriptPath})` returns `.at(scene?, layer?)` →
 * `.get(field)` → `{ value, source, trace }`. Node order outer→inner per level is
 * presets (list order) → character node → explicit fields; the kind level holds Scene
 * Kind direct fields and kind presets; Chrome `music` feeds `background_audio` at the
 * kind level; a field set at a level its class forbids → `CASCADE_LEVEL_FORBIDDEN`.
 * (capability conntent-field-registry; design D-K2; task 2a.4 — RED: module missing.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createCascade, CASCADE_LEVEL_FORBIDDEN } from '../scripts/lib/cascade.mjs';
import { loadPresetIndex, presetSourceFromFile } from '../scripts/lib/presets.mjs';

function bag() {
  return {
    domain: {},
    series: {},
    kind: {},
    video: {},
    scene: {},
    layer: {},
    blueprint: {},
  };
}

test('resolves a series value with source and trace', () => {
  const bags = bag();
  bags.series.voice_speed = 1.1;
  const c = createCascade({ bags });
  const r = c.at('scene-1').get('voice_speed');
  assert.equal(r.value, 1.1);
  assert.equal(r.source, 'series');
  assert.ok(Array.isArray(r.trace) && r.trace.length >= 1);
});

test('node order is presets then explicit; nearer wins', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-preset-'));
  const doc = path.join(dir, 's_coNNtent_NN.md');
  fs.writeFileSync(
    doc,
    `---
level: 3
---
# NN Series

## NN Series: S
slug:: s
presets:: [Lucas]

# NN Preset

## NN Preset: Lucas
voice_speed:: 0.9
`,
    'utf8',
  );
  const bags = bag();
  bags.series.presets = ['Lucas'];
  bags.series.voice_speed = 1.1;
  bags.presetIndex = loadPresetIndex([presetSourceFromFile(doc)]);
  // The series explicit value (1.1) beats its own preset (0.9).
  const c = createCascade({ bags });
  assert.equal(c.at('scene-1').get('voice_speed').value, 1.1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a scene overrides the series', () => {
  const bags = bag();
  bags.series.voice_speed = 1.1;
  bags.scene.voice_speed = 1.4;
  const c = createCascade({ bags });
  assert.equal(c.at('scene-1').get('voice_speed').value, 1.4);
});

test('kind holds direct fields below series and above video', () => {
  const bags = bag();
  bags.series.transition = 'fade';
  bags.kind.transition = 'wipe';
  bags.video.transition = 'cut';
  const c = createCascade({ bags });
  assert.equal(c.at('scene-1').get('transition').value, 'cut');
});

test('Chrome music feeds background_audio at the kind level', () => {
  const bags = bag();
  bags.series.background_audio = 'series-bed';
  bags.kind.music = 'kind-chrome';
  const c = createCascade({ bags });
  const r = c.at('scene-1').get('background_audio');
  assert.equal(r.value, 'kind-chrome');
  assert.equal(r.source, 'kind');
});

test('a layer bag is the innermost level', () => {
  const bags = bag();
  bags.scene.fit = 'cover';
  bags.layer.fit = 'contain';
  const c = createCascade({ bags });
  assert.equal(c.at('scene-1', 'layer-1').get('fit').value, 'contain');
});

test('an explicit empty list at a nearer level overrides a farther value', () => {
  // `review_gates: []` is autopilot: it must beat the blueprint default and any
  // farther list, not be treated as "unset" (conntent-review-gates, 3b-1.8).
  const bags = bag();
  bags.blueprint.review_gates = ['script', 'preview'];
  bags.series.review_gates = [];
  const c = createCascade({ bags });
  const atSeries = c.at('scene-1').get('review_gates');
  assert.deepEqual(atSeries.value, [], 'the series empty list wins');
  assert.equal(atSeries.source, 'series');

  bags.video.review_gates = ['script'];
  const atVideo = c.at('scene-1').get('review_gates');
  assert.deepEqual(atVideo.value, ['script']);
  assert.equal(atVideo.source, 'video');
});