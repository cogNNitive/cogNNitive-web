/**
 * nn-video-script/test/model-params.test.mjs
 *
 * Model selection stays cascade-only: the TTS model is a Preset or scope value
 * (`voice_model`), the presenter override is `avatar_model`, and neither the
 * retired `tool` field nor a presenter's avatar model can move the TTS cache
 * identity.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { buildTtsVoiceOptions } from '../scripts/lib/tts-options.mjs';
import { loadPresetIndex } from '../scripts/lib/presets.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';

const compiler = new SceneCompiler({ fps: 30, width: 1920, height: 1920 });
const cache = new CacheManager({ baseDir: 'C:/tmp/nn-model-params' });
const NARRATION = 'Same narration words here.';

function bagsWith(fields) {
  return {
    presetIndex: loadPresetIndex([
      { doc: 'script', elements: { Preset: [{ type: 'Preset', name: 'Voice', slug: 'voice', fields }] } },
    ]),
  };
}

function model({ avatarModel, sceneFields = {} } = {}) {
  return {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V' } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: NARRATION, fields: sceneFields }],
      Layer: [
        {
          type: 'Layer',
          name: 'p',
          slug: 'p',
          parentSlug: 's1',
          fields: { type: 'presenter', asset: 'p.png', ...(avatarModel ? { avatar_model: avatarModel } : {}) },
        },
      ],
    },
  };
}

test('voice_model from a Preset and from an explicit field give the same key', () => {
  const bags = bagsWith({ voice: 'Ana', voice_model: 'minimax/speech-2.8-hd' });
  const fromPreset = compiler.lowerKnowledgeModel(model({ sceneFields: { presets: ['Voice'] } }), { bags });
  const explicit = compiler.lowerKnowledgeModel(
    model({ sceneFields: { voice: 'Ana', voice_model: 'minimax/speech-2.8-hd' } }),
    { bags },
  );
  const key = (sc) => cache.computeHash(NARRATION, buildTtsVoiceOptions(sc, {}));
  assert.equal(key(fromPreset.scenes[0]), key(explicit.scenes[0]));
});

test('the retired tool field is not a preset parameter, so it can never become a model', () => {
  assert.throws(
    () =>
      loadPresetIndex([
        { doc: 'script', elements: { Preset: [{ type: 'Preset', name: 'Voice', slug: 'voice', fields: { tool: 'wavespeed' } }] } },
      ]),
    (err) => err.code === 'preset-field' && /tool/.test(err.message),
  );
});

test('a presenter avatar_model:: does not change the TTS cache key', () => {
  const bags = bagsWith({ voice: 'Ana', voice_model: 'minimax/speech-2.8-hd' });
  const keyFor = (avatarModel) => {
    const lowered = compiler.lowerKnowledgeModel(
      model({ avatarModel, sceneFields: { presets: ['Voice'] } }),
      { bags },
    );
    return cache.computeHash(NARRATION, buildTtsVoiceOptions(lowered.scenes[0], {}));
  };
  const base = keyFor('wavespeed-ai/infinitetalk');
  assert.equal(keyFor('wavespeed-ai/infinitetalk-fast'), base);
  // Positive control: the key reacts to different narration, so it is not constant.
  const lowered = compiler.lowerKnowledgeModel(model({ sceneFields: { presets: ['Voice'] } }), { bags });
  assert.notEqual(base, cache.computeHash('A different narration line entirely.', buildTtsVoiceOptions(lowered.scenes[0], {})));
});

test('the presenter avatar_model:: lowers to layer_avatar_model', () => {
  const bags = bagsWith({ voice: 'Ana' });
  const lowered = compiler.lowerKnowledgeModel(model({ avatarModel: 'wavespeed-ai/infinitetalk' }), { bags });
  assert.equal(lowered.scenes[0].layers[0].properties.layer_avatar_model, 'wavespeed-ai/infinitetalk');
});

test('a model id never comes from engine code', () => {
  const bags = bagsWith({ voice: 'Ana' });
  const lowered = compiler.lowerKnowledgeModel(model({ sceneFields: { presets: ['Voice'] } }), { bags });
  const opts = buildTtsVoiceOptions(lowered.scenes[0], {});
  assert.equal('model' in opts, false, 'no preset model and no blueprint default in the test bags means no model key');
});
