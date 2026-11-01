/**
 * nn-video-script/test/preset-cache-identity.test.mjs
 *
 * The TTS cache identity is unchanged by the public renames (design D5): the
 * internal option keys stay `model`, `voice`, `speed`, `emotion`,
 * `modelOverride`; an undeclared delivery value adds nothing to the key; a
 * Preset and an equivalent explicit field produce the same hash; `voice_tone`
 * never enters the key.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { buildTtsVoiceOptions } from '../scripts/lib/tts-options.mjs';
import { loadPresetIndex } from '../scripts/lib/presets.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';

const compiler = new SceneCompiler({ fps: 30, width: 1920, height: 1920 });
const cache = new CacheManager({ baseDir: 'C:/tmp/nn-cache-identity' });
const NARRATION = 'Same narration words here.';

function model(sceneFields = {}) {
  return {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V' } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: NARRATION, fields: sceneFields }],
      Layer: [],
    },
  };
}

const fullDelivery = {
  voice: 'Ana',
  voice_model: 'minimax/speech-2.8-hd',
  voice_speed: '1.1',
  voice_emotion: ' calm ',
};

const bags = {
  presetIndex: loadPresetIndex([
    { doc: 'script', elements: { Preset: [{ type: 'Preset', name: 'Lucas', slug: 'lucas', fields: fullDelivery }] } },
  ]),
};

test('a Preset and the equivalent explicit fields produce the same key', () => {
  const fromPreset = compiler.lowerKnowledgeModel(model({ presets: ['Lucas'] }), { bags });
  const explicit = compiler.lowerKnowledgeModel(model({ ...fullDelivery }), { bags });
  const a = cache.computeHash(NARRATION, buildTtsVoiceOptions(fromPreset.scenes[0], {}));
  const b = cache.computeHash(NARRATION, buildTtsVoiceOptions(explicit.scenes[0], {}));
  assert.equal(a, b);
});

test('the internal option keys keep their historical names', () => {
  const lowered = compiler.lowerKnowledgeModel(model({ presets: ['Lucas'] }), { bags });
  const opts = buildTtsVoiceOptions(lowered.scenes[0], {});
  assert.deepEqual(Object.keys(opts).sort(), ['emotion', 'model', 'speed', 'voice']);
  assert.equal(opts.speed, 1.1, 'speed is a number, not the string "1.1"');
  assert.equal(opts.emotion, 'calm', 'emotion is trimmed');
  assert.equal(opts.model, 'minimax/speech-2.8-hd');
});

test('undeclared delivery values add nothing to the key', () => {
  const plainBags = {
    presetIndex: loadPresetIndex([
      { doc: 'script', elements: { Preset: [{ type: 'Preset', name: 'Plain', slug: 'plain', fields: { voice: 'Ana' } }] } },
    ]),
  };
  const lowered = compiler.lowerKnowledgeModel(model({ presets: ['Plain'] }), { bags: plainBags });
  const opts = buildTtsVoiceOptions(lowered.scenes[0], {});
  assert.equal('speed' in opts, false);
  assert.equal('emotion' in opts, false);
});

test('voice_tone never reaches the TTS options', () => {
  const toneBags = {
    presetIndex: loadPresetIndex([
      {
        doc: 'script',
        elements: {
          Preset: [{ type: 'Preset', name: 'Warm', slug: 'warm', fields: { voice: 'Ana', voice_tone: 'warm' } }],
        },
      },
    ]),
  };
  const lowered = compiler.lowerKnowledgeModel(model({ presets: ['Warm'] }), { bags: toneBags });
  const opts = buildTtsVoiceOptions(lowered.scenes[0], {});
  assert.equal('tone' in opts, false);
  assert.equal(Object.values(opts).includes('warm'), false);
});

test('a presenter avatar_model does not change the TTS key', () => {
  const withLayer = (avatarModel) => ({
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V' } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: NARRATION, fields: { presets: ['Lucas'] } }],
      Layer: [
        {
          type: 'Layer',
          name: 'p',
          slug: 'p',
          parentSlug: 's1',
          fields: { type: 'presenter', asset: 'p.png', avatar_model: avatarModel },
        },
      ],
    },
  });
  const keyFor = (m) => {
    const lowered = compiler.lowerKnowledgeModel(withLayer(m), { bags });
    return cache.computeHash(NARRATION, buildTtsVoiceOptions(lowered.scenes[0], {}));
  };
  assert.equal(keyFor('wavespeed-ai/infinitetalk'), keyFor('wavespeed-ai/infinitetalk-fast'));
});
