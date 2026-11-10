/**
 * nn-conntent/test/preview-subject.test.mjs
 *
 * The preview subject per scene: script hash, TTS key, image keys, alignment key and
 * the still (capability conntent-review-gates "Preview gate hash..."; task 3b-2.1).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { previewSubjectsFromScenes } from '../scripts/lib/preview-subject.mjs';

const cacheManager = {
  computeHash: (text, options) => `h:${text}:${JSON.stringify(options || {})}`,
};

const scene = (overrides = {}) => ({
  id: 'scene_one',
  slug: 'one',
  narration: 'Hola mundo',
  layers: [{ type: 'image', slug: 'a', properties: { layer_prompt: 'hero' } }],
  ...overrides,
});

const options = (extra = {}) => ({
  cacheManager,
  config: {},
  models: {},
  bags: {},
  ...extra,
});

test('the preview subject carries the script hash, the TTS key and the image keys', () => {
  const script = { one: { hash: 'a'.repeat(64) } };
  const [entry] = previewSubjectsFromScenes([scene()], script, options());
  assert.equal(entry.scene, 'one');
  assert.equal(entry.subject.script_hash, 'a'.repeat(64));
  assert.match(entry.subject.tts_key, /^h:Hola mundo:/);
  assert.equal(entry.subject.image_keys.length, 1);
  assert.match(entry.subject.image_keys[0], /^h:hero:/);
  assert.equal(entry.subject.alignment_key, null);
  assert.equal(entry.subject.still, null);
  assert.match(entry.hash, /^[0-9a-f]{64}$/);
});

test('a changed script, narration, prompt or still changes the preview hash', () => {
  const script = { one: { hash: 'a'.repeat(64) } };
  const base = previewSubjectsFromScenes([scene()], script, options())[0].hash;
  const changes = [
    ['script', { one: { hash: 'b'.repeat(64) } }, {}],
    ['narration', script, { scenes: [scene({ narration: 'Otra' })] }],
    ['prompt', script, { scenes: [scene({ layers: [{ type: 'image', properties: { layer_prompt: 'other' } }] })] }],
    ['still', script, { stills: { one: 'c'.repeat(64) } }],
  ];
  for (const [name, scriptHashes, extra] of changes) {
    const scenes = extra.scenes || [scene()];
    const hash = previewSubjectsFromScenes(scenes, scriptHashes, options({ stills: extra.stills }))[0].hash;
    assert.notEqual(hash, base, name);
  }
});

test('captions off has a null alignment key and stays stable', () => {
  const script = { one: { hash: 'a'.repeat(64) } };
  const first = previewSubjectsFromScenes([scene()], script, options())[0].hash;
  const second = previewSubjectsFromScenes([scene()], script, options())[0].hash;
  assert.equal(first, second);
});

test('the avatar clip key is not an input', () => {
  const script = { one: { hash: 'a'.repeat(64) } };
  const base = previewSubjectsFromScenes([scene()], script, options())[0].hash;
  const withClip = previewSubjectsFromScenes([scene()], script, options({ avatarClips: { one: 'clip-1' } }))[0].hash;
  assert.equal(withClip, base);
});
