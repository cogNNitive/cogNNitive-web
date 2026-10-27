/**
 * nn-video-script/test/model-params.test.mjs
 *
 * RED→GREEN tests for the parameter-specific model names (design D10/D20):
 * the presenter Layer override is `avatar_model::`, the Template TTS override is
 * `tts_model::`, and the Template `tool` is never used as a model. The TTS cache
 * key stays stable across the `model::` → `tts_model::` rename and is untouched by
 * a presenter Layer's `avatar_model::`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { loadTemplateModels } from '../scripts/lib/knowledge-model.mjs';
import { buildTtsVoiceOptions } from '../scripts/lib/tts-options.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';

const compiler = new SceneCompiler({ fps: 30, width: 1920, height: 1080 });

/**
 * A script directory nested deep enough that `loadTemplateModels`' four-level
 * ancestor walk cannot reach the shared temp root (which holds sibling tests'
 * leftovers) and mistake them for this fixture's Templates.
 */
function scriptDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-model-params-'));
  const dir = path.join(root, 'a', 'b', 'c', 'd');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** A one-scene model referencing the `Voice` Template instance. */
function model({ avatarModel, sceneFields = {} } = {}) {
  return {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V' } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: 'Same narration words here.', fields: sceneFields }],
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

/** An L3 Template document declaring one Template with the given field/value. */
function templateDoc(fieldName, value) {
  return [
    '---',
    'level: 3',
    'title: "Series"',
    '---',
    '',
    '# NN Template',
    '',
    '## NN Template: Voice',
    'slug:: voice',
    'voice:: Ana',
    `${fieldName}:: ${value}`,
    '',
  ].join('\n');
}

test('the TTS cache key is unchanged when the Template model:: becomes tts_model::', () => {
  const cache = new CacheManager({ baseDir: os.tmpdir() });
  const keyFor = (fieldName) => {
    const dir = scriptDir();
    fs.writeFileSync(path.join(dir, 'templates_V_0-1-0_demo_NN.md'), templateDoc(fieldName, 'minimax/speech-2.8-hd'));
    const templates = loadTemplateModels(dir);
    const lowered = compiler.lowerKnowledgeModel(model({ sceneFields: { template: '[[Series :: Voice]]' } }), { templates });
    return cache.computeHash(lowered.scenes[0].narration, buildTtsVoiceOptions(lowered.scenes[0], {}));
  };
  assert.equal(keyFor('model'), keyFor('tts_model'));
});

test('the Template tool is never used as the TTS model', () => {
  const templates = { Voice: { tool: 'wavespeed', voice: 'Ana' } };
  const lowered = compiler.lowerKnowledgeModel(model({ sceneFields: { template: '[[Series :: Voice]]' } }), { templates });
  const opts = buildTtsVoiceOptions(lowered.scenes[0], {});
  assert.notEqual(opts.model, 'wavespeed');
});

test('a presenter avatar_model:: does not change the TTS cache key', () => {
  const cache = new CacheManager({ baseDir: os.tmpdir() });
  const templates = { Voice: { tool: 'wavespeed', voice: 'Ana', model: 'minimax/speech-2.8-hd' } };
  const keyFor = (avatarModel) => {
    const lowered = compiler.lowerKnowledgeModel(
      model({ avatarModel, sceneFields: { template: '[[Series :: Voice]]' } }),
      { templates },
    );
    return cache.computeHash(lowered.scenes[0].narration, buildTtsVoiceOptions(lowered.scenes[0], {}));
  };
  const base = keyFor('wavespeed-ai/infinitetalk');
  assert.equal(keyFor('wavespeed-ai/infinitetalk-fast'), base);
  // Positive control: the key reacts to the narration, so it is not constant.
  const other = compiler.lowerKnowledgeModel(model({ sceneFields: { template: '[[Series :: Voice]]' } }), { templates });
  assert.notEqual(base, cache.computeHash('A different narration line entirely.', buildTtsVoiceOptions(other.scenes[0], {})));
});

test('the presenter avatar_model:: lowers to layer_avatar_model', () => {
  const lowered = compiler.lowerKnowledgeModel(model({ avatarModel: 'wavespeed-ai/infinitetalk' }));
  assert.equal(lowered.scenes[0].layers[0].properties.layer_avatar_model, 'wavespeed-ai/infinitetalk');
});
