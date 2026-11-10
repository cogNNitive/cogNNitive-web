/**
 * nn-conntent/test/review-subject.test.mjs
 *
 * Builds the per-scene review subjects from the compiler's lowered scenes, so the
 * engine and the console hash the same values (capability conntent-review-gates;
 * tasks 3b-1.1, 3b-2.1).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { scriptGateStates, scriptSubjectsFromScenes } from '../scripts/lib/review-subject.mjs';

function scene(overrides = {}) {
  return {
    id: 'scene_one',
    slug: 'one',
    name: 'One',
    narration: 'Hola mundo',
    properties: { scene_language: 'es', scene_voice_model: 'ana' },
    layers: [
      { id: 'layer_a', type: 'image', name: 'A', slug: 'a', properties: { layer_prompt: 'hero' } },
    ],
    ...overrides,
  };
}

const verdict = (overrides = {}) => ({
  scene: 'one',
  gate: 'script',
  verdict: 'approved',
  reviewedHash: overrides.reviewedHash,
  planHash: null,
  notes: null,
  reviewer: 'Ana',
  authorKind: 'human',
  origin: 'console',
  appliedAt: '2026-11-09T10:00:00.000Z',
  changeset: 'changes/x_changes_NN.md',
  ...overrides,
});

test('a lowered scene becomes a script subject with its layers and params', () => {
  const [entry] = scriptSubjectsFromScenes([scene()], 'es');
  assert.equal(entry.scene, 'one');
  assert.equal(entry.subject.scene, 'one');
  assert.equal(entry.subject.language, 'es');
  assert.equal(entry.subject.narration, 'Hola mundo');
  assert.deepEqual(entry.subject.layers, [{ type: 'image', layer_prompt: 'hero' }]);
  assert.equal(entry.subject.params.scene_voice_model, 'ana');
  assert.match(entry.hash, /^[0-9a-f]{64}$/);
});

test('the episode language is the fallback when the scene declares none', () => {
  const [entry] = scriptSubjectsFromScenes([scene({ properties: {} })], 'en');
  assert.equal(entry.subject.language, 'en');
});

test('scenes hash independently and a narration edit changes only that hash', () => {
  const scenes = [scene(), scene({ id: 'scene_two', slug: 'two', narration: 'Otra' })];
  const first = scriptSubjectsFromScenes(scenes, 'es');
  const edited = scriptSubjectsFromScenes([scenes[0], { ...scenes[1], narration: 'Otra cosa' }], 'es');
  assert.equal(first[0].hash, edited[0].hash);
  assert.notEqual(first[1].hash, edited[1].hash);
});

test('scriptGateStates approves only with a matching applied human verdict', () => {
  const [entry] = scriptSubjectsFromScenes([scene()], 'es');
  assert.equal(scriptGateStates([entry], [])[0].state, 'open');
  assert.equal(scriptGateStates([entry], [verdict({ reviewedHash: entry.hash })])[0].state, 'approved');

  const agent = scriptGateStates([entry], [verdict({ reviewedHash: entry.hash, authorKind: 'agent' })]);
  assert.equal(agent[0].state, 'open', 'an agent verdict approves nothing');
  assert.equal(agent[0].ignored.length, 1);

  assert.equal(
    scriptGateStates([entry], [verdict({ reviewedHash: 'b'.repeat(64) })])[0].state,
    'reopened',
    'a stale hash reopens',
  );
});
