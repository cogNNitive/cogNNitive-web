/**
 * nn-conntent/test/language.test.mjs
 *
 * One language per episode, validated before spend: the resolved Voice's `language`
 * MUST equal the scene's resolved `language`, and a missing/unregistered voice fails.
 * (capability conntent-model-catalog "Voices Carry A Language And Must Match The
 * Episode"; D-K6; task 2b.1 — RED.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateVoiceLanguage, LANGUAGE_VOICE_MISMATCH, UNKNOWN_VOICE } from '../scripts/lib/catalog.mjs';

const voices = {
  'lucas-es': { slug: 'lucas-es', language: 'es' },
  'lucas-en': { slug: 'lucas-en', language: 'en' },
};

test('a matching voice language validates', () => {
  assert.equal(validateVoiceLanguage({ voices, language: 'es', voiceSlug: 'lucas-es' }), true);
});

test('a mismatched voice language fails naming both', () => {
  assert.throws(
    () => validateVoiceLanguage({ voices, language: 'en', voiceSlug: 'lucas-es' }),
    (err) => {
      assert.equal(err.code, LANGUAGE_VOICE_MISMATCH);
      assert.match(err.message, /lucas-es/);
      assert.match(err.message, /es/);
      assert.match(err.message, /en/);
      return true;
    },
  );
});

test('an unknown voice slug fails', () => {
  assert.throws(
    () => validateVoiceLanguage({ voices, language: 'es', voiceSlug: 'nobody' }),
    (err) => {
      assert.equal(err.code, UNKNOWN_VOICE);
      assert.match(err.message, /nobody/);
      return true;
    },
  );
});