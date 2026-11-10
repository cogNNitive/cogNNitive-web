/**
 * nn-conntent/test/missing-character-voice.test.mjs
 *
 * The Character voice for a scene MUST be `voices[<resolved language>]`; when the
 * resolved language has no entry, validation fails before any spend with
 * `missing-character-voice` naming the Character and the language, and the engine
 * does NOT fall back to another language's voice or to a domaiNN voice
 * (capability conntent-character "Voice Follows The Episode Language"; task 2d.5 —
 * RED: falls back silently.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { assertCharacterVoice } from '../scripts/lib/characters.mjs';

test('a character with the language voice validates', () => {
  assert.equal(
    assertCharacterVoice({ name: 'lucas', voices: { es: 'lucas-es' } }, 'es'),
    'lucas-es',
  );
});

test('a missing language voice fails with missing-character-voice naming both', () => {
  assert.throws(
    () => assertCharacterVoice({ name: 'lucas', voices: { es: 'lucas-es' } }, 'en'),
    (err) => {
      assert.equal(err.code, 'missing-character-voice');
      assert.match(err.message, /lucas/);
      assert.match(err.message, /en/);
      assert.doesNotMatch(err.message, /lucas-es/, 'no fallback to another language voice');
      return true;
    },
  );
});

test('an empty voices map fails for any language', () => {
  assert.throws(() => assertCharacterVoice({ name: 'lucas', voices: {} }, 'es'), /missing-character-voice/);
});