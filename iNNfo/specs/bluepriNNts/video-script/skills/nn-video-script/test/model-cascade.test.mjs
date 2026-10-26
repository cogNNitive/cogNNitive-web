import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel, resolveModels, resolveEngineModel, SCOPE_ORDER } from '../scripts/lib/model-cascade.mjs';

test('the scope order is the documented chain', () => {
  assert.deepEqual(SCOPE_ORDER, ['cli', 'layer', 'scene', 'video', 'series', 'workspace', 'blueprint']);
});

test('the most specific scope wins for every kind', () => {
  const scope = {
    cli: { avatar: 'cli-av' },
    layer: { avatar: 'layer-av' },
    scene: { tts: 'scene-tts', avatar: 'scene-av' },
    video: { tts: 'video-tts', image: 'video-img', avatar: 'video-av' },
    series: { tts: 'series-tts', image: 'series-img', avatar: 'series-av' },
    workspace: { tts: 'ws-tts', image: 'ws-img', avatar: 'ws-av' },
    blueprint: { tts: 'bp-tts', image: 'bp-img', avatar: 'bp-av' },
  };
  assert.deepEqual(resolveModel({ kind: 'avatar', scope }), { id: 'cli-av', source: 'cli' });
  assert.deepEqual(resolveModel({ kind: 'tts', scope }), { id: 'scene-tts', source: 'scene' });
  assert.deepEqual(resolveModel({ kind: 'image', scope }), { id: 'video-img', source: 'video' });
});

test('without a cli override the layer/scene scope still wins', () => {
  const scope = { layer: { avatar: 'layer-av' }, series: { avatar: 'series-av' } };
  assert.deepEqual(resolveModel({ kind: 'avatar', scope }), { id: 'layer-av', source: 'layer' });
});

test('falls through to the blueprint default', () => {
  assert.deepEqual(
    resolveModel({ kind: 'tts', scope: { blueprint: { tts: 'minimax/speech' } } }),
    { id: 'minimax/speech', source: 'blueprint' },
  );
});

test('empty or absent values are ignored', () => {
  const scope = { scene: { tts: '   ' }, series: { tts: 'series-tts' } };
  assert.deepEqual(resolveModel({ kind: 'tts', scope }), { id: 'series-tts', source: 'series' });
  assert.deepEqual(resolveModel({ kind: 'tts', scope: {} }), { id: null, source: null });
});

test('resolveModels resolves several kinds', () => {
  const r = resolveModels({ kinds: ['tts', 'avatar'], scope: { series: { tts: 's-tts', avatar: 's-av' } } });
  assert.equal(r.tts.id, 's-tts');
  assert.equal(r.avatar.id, 's-av');
});

test('resolveEngineModel keeps plan and execution in lockstep and honors cli > scene', () => {
  assert.equal(resolveEngineModel('tts', { cliModel: 'cli', sceneModel: 'scene', defaultModel: 'bp' }), 'cli');
  assert.equal(resolveEngineModel('tts', { sceneModel: 'scene', defaultModel: 'bp' }), 'scene');
  assert.equal(resolveEngineModel('image', { defaultModel: 'bp' }), 'bp');
});
