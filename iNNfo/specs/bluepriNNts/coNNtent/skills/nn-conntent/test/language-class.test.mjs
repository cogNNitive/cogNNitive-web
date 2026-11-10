/**
 * nn-conntent/test/language-class.test.mjs
 *
 * `language` is a `video` class cascade parameter (Video, Series, Video Defaults,
 * Chrome) and `translation_of` is a Video-only `record` field; the TTS cache key
 * changes with the episode language (a different language is a different synthesis,
 * so a different key) and never hard-codes a Spanish fallback. (capability
 * conntent-model "One Language Per Episode", conntent-model-catalog; task 2b.3 —
 * RED: classes not declared, key ignores language.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import registryJson from '../scripts/lib/field-registry.generated.json' with { type: 'json' };
import { buildTtsVoiceOptions, mapTtsLanguage } from '../scripts/lib/tts-options.mjs';

test('language is a video class cascade parameter and translation_of a record field', () => {
  const language = registryJson.fields.language;
  assert.ok(language, 'language is declared');
  assert.equal(language.scope, 'video');
  assert.deepEqual([...language.levels].sort(), ['domain', 'series', 'video'].sort());
  assert.ok(language.concepts.includes('Chrome'), 'Chrome carries a language');

  const translation = registryJson.fields.translation_of;
  assert.ok(translation, 'translation_of is declared');
  assert.equal(translation.scope, 'record');
  assert.equal(translation.cascade, false);
  assert.deepEqual(translation.concepts, ['Video'], 'translation_of is Video-only');
});

test('the TTS voice options differ between languages and have no Spanish fallback', () => {
  // The voice options carry the raw code, so the synthesis cache key differs per
  // language; the provider-facing mapping happens in the synthesizer via mapTtsLanguage.
  const es = buildTtsVoiceOptions({ properties: { scene_language: 'es' }, layers: [] });
  const en = buildTtsVoiceOptions({ properties: { scene_language: 'en' }, layers: [] });
  assert.equal(es.language, 'es');
  assert.equal(en.language, 'en');
  assert.equal(mapTtsLanguage('es'), 'Spanish');
  assert.equal(mapTtsLanguage('en'), 'English');
  // Unmapped languages are passed through, never defaulted to Spanish.
  const fr = buildTtsVoiceOptions({ properties: { scene_language: 'fr' }, layers: [] });
  assert.equal(fr.language, 'fr');
  assert.equal(mapTtsLanguage('fr'), 'auto');
});
