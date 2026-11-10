/**
 * nn-conntent/test/missing-voice.test.mjs
 *
 * A scene with a narration but no resolved Voice fails before spend with
 * `missing-voice` (there is no package default `voice`); a scene with no narration
 * needs no voice. (capability conntent-model Kafka "One Language Per Episode" D-K6,
 * Q4 answer; task 2b.2 — RED.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { assertVoiceResolved, MISSING_VOICE } from '../scripts/lib/catalog.mjs';

test('a narrated scene with no resolved voice fails with missing-voice', () => {
  assert.throws(
    () => assertVoiceResolved({ narration: 'Hello', voiceSlug: null }),
    (err) => {
      assert.equal(err.code, MISSING_VOICE);
      assert.match(err.message, /missing-voice/i);
      return true;
    },
  );
});

test('an empty voice slug with no narration needs no voice', () => {
  assert.equal(assertVoiceResolved({ narration: '', voiceSlug: null }), true);
});

test('a voiced scene validates even with narration', () => {
  assert.equal(assertVoiceResolved({ narration: 'Hi', voiceSlug: 'lucas-es' }), true);
});