/**
 * nn-video-script/test/preset-resolution.test.mjs
 *
 * Resolution order of the `presets` list (design D4, capability video-presets
 * "Per-Level Additive Expansion Order"): the last Preset of a list wins, an
 * element's explicit fields beat its own Presets, a nearer level beats every
 * outer level including that level's Presets, and `explain` names the Preset.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { loadPresetIndex } from '../scripts/lib/presets.mjs';
import { resolve } from '../scripts/lib/video-scope.mjs';

const compiler = new SceneCompiler({ fps: 30, width: 1920, height: 1920 });

function preset(name, fields) {
  return { type: 'Preset', name, slug: name.toLowerCase().replace(/\s+/g, '-'), fields };
}

function index(presets) {
  return loadPresetIndex([{ doc: 'script', elements: { Preset: presets } }]);
}

function model({ videoFields = {}, sceneFields = {} } = {}) {
  return {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V', ...videoFields } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: 'words here', fields: sceneFields }],
      Layer: [],
    },
  };
}

test('the last preset of a list wins', () => {
  const bags = {
    presetIndex: index([preset('A', { voice: 'from-a' }), preset('B', { voice: 'from-b' })]),
  };
  const lowered = compiler.lowerKnowledgeModel(model({ sceneFields: { presets: ['A', 'B'] } }), { bags });
  assert.equal(lowered.scenes[0].properties.scene_voice, 'from-b');
});

test("an element's explicit field beats its own presets", () => {
  const bags = { presetIndex: index([preset('A', { voice: 'from-a' })]) };
  const lowered = compiler.lowerKnowledgeModel(
    model({ sceneFields: { presets: ['A'], voice: 'own' } }),
    { bags },
  );
  assert.equal(lowered.scenes[0].properties.scene_voice, 'own');
});

test('an explicit Scene voice beats a Video preset', () => {
  const bags = { presetIndex: index([preset('A', { voice: 'from-a' })]) };
  const lowered = compiler.lowerKnowledgeModel(
    model({ videoFields: { presets: ['A'] }, sceneFields: { voice: 'own' } }),
    { bags },
  );
  assert.equal(lowered.scenes[0].properties.scene_voice, 'own');
});

test('a Video preset sits under explicit Video fields and above Series', () => {
  const bags = {
    presetIndex: index([preset('A', { voice: 'from-a' })]),
    series: { voice: 'series-voice' },
  };
  const lowered = compiler.lowerKnowledgeModel(model({ videoFields: { presets: ['A'] } }), { bags });
  assert.equal(lowered.scenes[0].properties.scene_voice, 'from-a');

  const explicit = compiler.lowerKnowledgeModel(
    model({ videoFields: { presets: ['A'], voice: 'video-voice' } }),
    { bags },
  );
  assert.equal(explicit.scenes[0].properties.scene_voice, 'video-voice');
});

test('a preset that omits a parameter does not reset it', () => {
  const bags = {
    presetIndex: index([
      preset('A', { voice_speed: '1.1', voice: 'from-a' }),
      preset('B', { voice: 'from-b' }),
    ]),
  };
  const lowered = compiler.lowerKnowledgeModel(model({ sceneFields: { presets: ['A', 'B'] } }), { bags });
  assert.equal(lowered.scenes[0].properties.scene_voice, 'from-b');
  assert.equal(lowered.scenes[0].properties.scene_voice_speed, 1.1);
});

test('explain names the supplying preset', () => {
  const bags = {
    presetIndex: index([preset('Lucas', { voice: 'lucas-voice' })]),
    series: { presets: ['Lucas'] },
  };
  const r = resolve('voice', { ...bags, video: { title: 'V' }, scene: {} });
  assert.equal(r.value, 'lucas-voice');
  assert.equal(r.source, 'series:preset:Lucas');
});

test('a scene-level preset wins over an outer explicit field', () => {
  const bags = {
    presetIndex: index([preset('B', { voice: 'from-b' })]),
    video: { voice: 'video-voice' },
  };
  const r = resolve('voice', { ...bags, scene: { presets: ['B'] } });
  assert.equal(r.value, 'from-b');
  assert.equal(r.source, 'scene:preset:B');
});
