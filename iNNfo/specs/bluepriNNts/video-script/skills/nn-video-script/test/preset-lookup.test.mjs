/**
 * nn-video-script/test/preset-lookup.test.mjs
 *
 * Lookup and pre-compile errors (design D1-D3): bare-name list syntax, the
 * shape of the two readers, nearest-first shadowing, and the named errors that
 * stop a run before any spend.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PresetError,
  loadPresetIndex,
  lookupPreset,
  parsePresetList,
} from '../scripts/lib/presets.mjs';
import { resolve } from '../scripts/lib/video-scope.mjs';

test('a bracketed list keeps its order', () => {
  assert.deepEqual(parsePresetList('[Lucas, Studio Warm]'), ['Lucas', 'Studio Warm']);
});

test('a single bare name is accepted', () => {
  assert.deepEqual(parsePresetList('Lucas'), ['Lucas']);
});

test('the JSON array and the raw string shapes agree', () => {
  assert.deepEqual(parsePresetList(['Lucas', 'Studio Warm']), parsePresetList('[Lucas, Studio Warm]'));
});

test('an empty value lists nothing', () => {
  assert.deepEqual(parsePresetList(undefined), []);
  assert.deepEqual(parsePresetList('[]'), []);
});

test('a wiki-link reference is a preset-syntax error with the canonical hint', () => {
  for (const bad of ['[[Lucas]]', '[[Doc :: Lucas]]']) {
    assert.throws(
      () => parsePresetList(bad),
      (err) => err instanceof PresetError && err.code === 'preset-syntax' && /presets:: \[Lucas, Studio Warm\]/.test(err.message),
    );
  }
});

test('a name listed twice is an error', () => {
  assert.throws(() => parsePresetList('[Lucas, Lucas]'), (err) => err.code === 'preset-duplicate');
});

test('an unknown name names what was searched', () => {
  const index = loadPresetIndex([{ doc: '/d/video-defaults_NN.md', elements: {} }]);
  assert.throws(
    () => lookupPreset(index, 'Nobody'),
    (err) => err.code === 'unknown-preset' && /Nobody/.test(err.message) && /video-defaults_NN\.md/.test(err.message),
  );
});

test('lookup and reachability are case-insensitive by name and by slug', () => {
  const index = loadPresetIndex([
    { doc: 'script', elements: { Preset: [{ type: 'Preset', name: 'Studio Warm', slug: 'studio-warm', fields: {} }] } },
  ]);
  assert.equal(index.find('studio warm').name, 'Studio Warm');
  assert.equal(index.find('STUDIO-WARM').name, 'Studio Warm');
});

test('the nearest definition shadows an outer one', () => {
  const index = loadPresetIndex([
    { doc: 'script', elements: { Preset: [{ type: 'Preset', name: 'Lucas', slug: 'l', fields: { voice: 'inner' } }] } },
    { doc: '/domain/video-defaults_NN.md', elements: { Preset: [{ type: 'Preset', name: 'Lucas', slug: 'l', fields: { voice: 'outer' } }] } },
  ]);
  assert.equal(index.find('Lucas').values.voice, 'inner');
});

test('two Presets with the same name in one document are a duplicate', () => {
  assert.throws(
    () =>
      loadPresetIndex([
        {
          doc: 'script',
          elements: {
            Preset: [
              { type: 'Preset', name: 'Lucas', slug: 'l1', fields: {} },
              { type: 'Preset', name: 'Lucas', slug: 'l2', fields: {} },
            ],
          },
        },
      ]),
    (err) => err.code === 'preset-duplicate',
  );
});

test('a non-parameter key is a preset-field error', () => {
  for (const fields of [{ type: 'presenter' }, { asset: 'a.png' }, { presets: ['Other'] }, { title: 'X' }]) {
    assert.throws(
      () => loadPresetIndex([{ doc: 'script', elements: { Preset: [{ type: 'Preset', name: 'P', slug: 'p', fields }] } }]),
      (err) => err.code === 'preset-field',
    );
  }
});

test('tags and the reserved slug are accepted', () => {
  const index = loadPresetIndex([
    { doc: 'script', elements: { Preset: [{ type: 'Preset', name: 'Lucas', slug: 'lucas', fields: { tags: ['presenter'], voice: 'lucas-es' } }] } },
  ]);
  assert.equal(index.find('Lucas').values.voice, 'lucas-es');
});

test('an unknown Preset stops resolution before any spend', () => {
  const bags = { presetIndex: loadPresetIndex([{ doc: 'script', elements: {} }]) };
  assert.throws(
    () => resolve('voice', { ...bags, scene: { presets: ['Nobody'] } }),
    (err) => err.code === 'unknown-preset',
  );
});
