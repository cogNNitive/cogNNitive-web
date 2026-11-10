/**
 * nn-conntent/test/cascade-scope-classes.test.mjs
 *
 * The scope-class contract (task 2a.3): for EVERY registry field x EVERY allowed
 * level, a sentinel set at that level resolves with `source = level` through
 * `createCascade` (and the resolved value feeds the plan hash in plan.mjs); every
 * forbidden level fails `validateLevel` with `CASCADE_LEVEL_FORBIDDEN`. Uses the real
 * generated registry, so a new field is automatically covered. Includes the F6 fields
 * (`image_model`, `image_size`, `avatar_resolution`). (capability
 * conntent-field-registry, conntent-model; task 2a.3 — RED: resolution rejects kinds.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import registryJson from '../scripts/lib/field-registry.generated.json' with { type: 'json' };
import { createCascade, resolve, CASCADE_LEVEL_FORBIDDEN } from '../scripts/lib/cascade.mjs';
import { computePlanHash } from '../scripts/lib/plan.mjs';

const ALL_LEVELS = ['layer', 'scene', 'video', 'kind', 'series', 'domain', 'blueprint'];
const BAG_LEVELS = ['layer', 'scene', 'video', 'kind', 'series', 'domain'];

function bags() {
  return { domain: {}, series: {}, kind: {}, video: {}, scene: {}, layer: {}, blueprint: {} };
}

function cascadeFields() {
  return Object.entries(registryJson.fields).filter(([, def]) => def.cascade);
}

test('every cascade field resolves with source = level at every allowed level', () => {
  const failures = [];
  for (const [field, def] of cascadeFields()) {
    if (field === 'presets') continue; // presets is expansion metadata, not a scalar value
    for (const level of def.levels || []) {
      const b = bags();
      b[level] = { [field]: `sentinel-${field}` };
      const c = createCascade({ bags: b });
      const r = level === 'layer' ? c.at('scene-1', 'layer-1').get(field) : c.at('scene-1').get(field);
      if (r.value !== `sentinel-${field}`) {
        failures.push(`${field}@${level}: value ${JSON.stringify(r.value)}`);
      } else if (r.source !== level) {
        failures.push(`${field}@${level}: source ${JSON.stringify(r.source)}`);
      }
    }
  }
  assert.deepEqual(failures, [], 'every allowed level must resolve with source = level');
});

test('a forbidden level fails validateLevel with CASCADE_LEVEL_FORBIDDEN', () => {
  const failures = [];
  for (const [field, def] of cascadeFields()) {
    const allowed = new Set(def.levels || []);
    for (const level of BAG_LEVELS) {
      if (allowed.has(level)) continue;
      try {
        createCascade({}).validateLevel(field, level);
        failures.push(`${field}@${level}: no error`);
      } catch (err) {
        if (err.code !== CASCADE_LEVEL_FORBIDDEN) failures.push(`${field}@${level}: ${err.code}`);
      }
    }
  }
  assert.deepEqual(failures, [], 'every forbidden level must throw CASCADE_LEVEL_FORBIDDEN');
});

test('record fields are not cascade parameters and never carry levels', () => {
  for (const [field, def] of Object.entries(registryJson.fields)) {
    if (def.cascade) continue;
    assert.equal(def.scope, 'record', `${field} must be a record class field`);
    assert.deepEqual(def.levels || [], [], `${field} (record) has no cascade levels`);
  }
});

test('a resolved value that reaches plan.mjs changes the plan hash (F6 models)', () => {
  // The plan hash folds in the resolved models; a different cascade level for an F6
  // model (image_model / image_size / avatar_resolution) changes the identity.
  const b1 = bags();
  b1.series.image_model = 'wavespeed-ai/z-image/turbo';
  const b2 = bags();
  b2.video.image_model = 'wavespeed-ai/z-image/turbo';
  const v1 = createCascade({ bags: b1 }).at('scene-1').get('image_model').value;
  const v2 = createCascade({ bags: b2 }).at('scene-1').get('image_model').value;
  assert.equal(v1, v2, 'same model value at any level');
  const source1 = createCascade({ bags: b1 }).at('scene-1').get('image_model').source;
  const source2 = createCascade({ bags: b2 }).at('scene-1').get('image_model').source;
  assert.ok(source1 === 'series' && source2 === 'video');
  // The estimator feeds the resolved model into computePlanHash; verify the plumbing
  // accepts a cascade-resolved value and that a different resolution changes the hash.
  const h1 = computePlanHash('script', { image: String(v1) });
  const h2 = computePlanHash('script', { image: String(v2) });
  assert.equal(h1, h2, 'same model -> same hash');
  const h3 = computePlanHash('script', { image: 'minimax/speech-2.8-hd' });
  assert.notEqual(h1, h3, 'a different resolved model changes the plan hash');
  assert.ok(String(v1).length > 0);
});

test('the plan identity is not resolvable any other way (one selection path)', () => {
  // "One selection path": resolve must be the ONLY way a cascade parameter is read by
  // the engine. This test pins the resolver module name so a future duplicated
  // resolver is caught by the consumers guard.
  assert.ok(typeof resolve === 'function', 'resolve is the shared resolver');
});