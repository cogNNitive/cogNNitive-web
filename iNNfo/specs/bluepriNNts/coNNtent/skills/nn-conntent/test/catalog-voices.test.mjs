/**
 * nn-conntent/test/catalog-voices.test.mjs
 *
 * Every catalog `Voice` carries a required `language` as an ISO 639-1 lowercase
 * two-letter code: `parseCatalog` fails with `voice-language-required` when it is
 * absent and with `invalid-language-code` when it is not such a code, both naming the
 * Voice. The shipped reference catalog validates and ships at least one `en` and one
 * `es` Voice. (capability conntent-model-catalog "The Reference Catalog Ships Voices
 * For English And Spanish"; task 2b.5 — RED: language not validated, no es voice.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseCatalog, validateCatalogVoices, REFERENCE_CATALOG } from '../scripts/lib/catalog.mjs';

const VOICE = (extra = '') => `---
# NN Catalog

# NN Voice

## NN Voice: lucas-es
slug:: lucas-es
model:: minimax/speech-2.8-hd
voice_id:: lucas_es_01
${extra}
`;

test('a Voice without a language fails naming the Voice and the field', () => {
  assert.throws(
    () => validateCatalogVoices(parseCatalog(VOICE())),
    (err) => {
      assert.equal(err.code, 'voice-language-required');
      assert.match(err.message, /lucas-es/);
      assert.match(err.message, /language/);
      return true;
    },
  );
});

test('a non-code language fails naming the Voice and the ISO 639-1 form', () => {
  assert.throws(
    () => validateCatalogVoices(parseCatalog(VOICE('language:: Spanish\n'))),
    (err) => {
      assert.equal(err.code, 'invalid-language-code');
      assert.match(err.message, /lucas-es/);
      assert.match(err.message, /iso 639-1/i);
      return true;
    },
  );
});

test('a valid ISO language validates', () => {
  const parsed = parseCatalog(VOICE('language:: es\n'));
  assert.equal(validateCatalogVoices(parsed), true);
});

test('the shipped reference catalog validates and ships en and es voices', () => {
  const text = fs.readFileSync(REFERENCE_CATALOG, 'utf8');
  const parsed = parseCatalog(text);
  assert.equal(validateCatalogVoices(parsed), true);
  const langs = Object.values(parsed.voices).map((v) => v.language);
  assert.ok(langs.includes('en'), 'the reference catalog ships an en voice');
  assert.ok(langs.includes('es'), 'the reference catalog ships an es voice');
});
