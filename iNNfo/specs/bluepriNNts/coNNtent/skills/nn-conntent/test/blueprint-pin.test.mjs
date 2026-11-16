/**
 * nn-conntent/test/blueprint-pin.test.mjs
 *
 * #694: `produce` refused unless `blueprint_version` matched the installed blueprint,
 * while `export-console` warned that `parent_spec.name` was stale against a different
 * value. Two gates, two statements of one fact, so no single document could satisfy
 * both. The pin check now reads both and refuses with the ONE pair that does satisfy
 * both.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertProducible,
  assertBlueprintPin,
  expectedParentSpecName,
  versionOfSpecName,
  EpisodeError,
} from '../scripts/lib/episode.mjs';

const INSTALLED = 'V_0-22-0';
const scriptPath = '/domains/acme/series/s/assets/e/e_coNNtent_NN.md';

const episode = (over = {}) => ({
  scriptPath,
  status: 'approved',
  blueprintVersion: INSTALLED,
  parentSpec: { name: `coNNtent_${INSTALLED}` },
  ...over,
});

test('the expected parent_spec.name is the family plus the installed version', () => {
  assert.equal(expectedParentSpecName('coNNtent', INSTALLED), 'coNNtent_V_0-22-0');
  assert.equal(versionOfSpecName('coNNtent_V_0-22-0'), 'V_0-22-0');
  assert.equal(versionOfSpecName('coNNtent'), undefined);
});

test('a document whose pin and parent_spec.name both agree with the install is accepted', () => {
  assert.doesNotThrow(() => assertProducible(episode(), INSTALLED));
});

test('the unsatisfiable pair is refused and names the value both gates accept', () => {
  // Exactly the reported situation: the console said parent_spec.name was stale
  // against V_0-21-0 while produce demanded V_0-22-0.
  const err = (() => {
    try {
      assertProducible(episode({ parentSpec: { name: 'coNNtent_V_0-21-0' } }), INSTALLED);
      return null;
    } catch (e) {
      return e;
    }
  })();
  assert.ok(err instanceof EpisodeError);
  assert.equal(err.code, 'parent-spec-mismatch');
  assert.match(err.message, /coNNtent_V_0-21-0/);
  assert.match(err.message, /parent_spec\.name: coNNtent_V_0-22-0/, 'the expected value is spelled out');
  assert.match(err.message, /blueprint_version: V_0-22-0/);
});

test('an unversioned parent_spec.name is not treated as a version claim', () => {
  assert.doesNotThrow(() => assertProducible(episode({ parentSpec: { name: 'coNNtent' } }), INSTALLED));
  assert.doesNotThrow(() => assertProducible(episode({ parentSpec: undefined }), INSTALLED));
});

test('a pin that is not the install names both values to set', () => {
  const err = (() => {
    try {
      assertProducible(episode({ blueprintVersion: 'V_0-19-0', parentSpec: { name: 'coNNtent_V_0-19-0' } }), INSTALLED);
      return null;
    } catch (e) {
      return e;
    }
  })();
  assert.equal(err.code, 'blueprint-version-mismatch');
  assert.match(err.message, /V_0-19-0/);
  assert.match(err.message, /blueprint_version: V_0-22-0/);
  assert.match(err.message, /parent_spec\.name: coNNtent_V_0-22-0/);
});

test('a missing pin on a producible status is refused with the value to add', () => {
  const err = (() => {
    try {
      assertProducible(episode({ blueprintVersion: undefined }), INSTALLED);
      return null;
    } catch (e) {
      return e;
    }
  })();
  assert.equal(err.code, 'blueprint-version-missing');
  assert.match(err.message, /blueprint_version: V_0-22-0/);
});

test('a draft may omit the pin; an archived episode never produces', () => {
  assert.doesNotThrow(() => assertProducible(episode({ status: 'draft', blueprintVersion: undefined }), INSTALLED));
  assert.throws(
    () => assertProducible(episode({ status: 'archived' }), INSTALLED),
    (e) => e instanceof EpisodeError && e.code === 'refused-state',
  );
});

test('assertBlueprintPin is the pin-only half (no captions validator side effects)', () => {
  assert.doesNotThrow(() => assertBlueprintPin(episode(), INSTALLED));
  assert.throws(
    () => assertBlueprintPin(episode({ parentSpec: { name: 'coNNtent_V_0-20-0' } }), INSTALLED),
    (e) => e.code === 'parent-spec-mismatch',
  );
});
