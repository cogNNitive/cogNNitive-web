/**
 * nn-conntent/test/voice-clone-catalog.test.mjs
 *
 * `voice-clone.mjs` writes the cloned voice as a catalog `Voice` element in the
 * workspace `model-catalog_NN.md` carrying `model`, `voice_id` and a required
 * `language` (ISO 639-1 lowercase); runs without `--language` fail before any provider
 * call with `voice-language-required` and write nothing. The command never edits a
 * `CHARACTER.md`. (capability conntent-character "Voice Cloning Writes A Voice With
 * Its Language"; task 2b.5 — RED: no language, no catalog write.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { cloneVoice, VOICE_LANGUAGE_REQUIRED } from '../scripts/voice-clone.mjs';

const CATALOG_FILENAME = 'model-catalog_NN.md';

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-vcc-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  fs.writeFileSync(
    path.join(root, CATALOG_FILENAME),
    '# NN Catalog\n\n# NN Provider\n\n## NN Provider: p\nslug:: p\nname:: P\napi_base:: https://example.invalid\n',
    'utf8',
  );
  const sample = path.join(root, 'sample.wav');
  fs.writeFileSync(sample, 'wav', 'utf8');
  return { root, sample };
}

test('a clone without --language fails with voice-language-required and writes no Voice', async () => {
  const { root, sample } = workspace();
  await assert.rejects(
    () => cloneVoice({ name: 'lucas', samplePath: sample, series: 's', startDir: root, language: undefined, client: { cloneVoice: async () => ({ voiceId: 'vk_1' }) } }),
    (err) => {
      assert.equal(err.code, VOICE_LANGUAGE_REQUIRED);
      assert.match(err.message, /language/i);
      return true;
    },
  );
  const text = fs.readFileSync(path.join(root, CATALOG_FILENAME), 'utf8');
  assert.doesNotMatch(text, /## NN Voice:/, 'no Voice element was written');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a clone with --language es writes a catalog Voice with model voice_id and language', async () => {
  const { root, sample } = workspace();
  const res = await cloneVoice({
    name: 'lucas',
    samplePath: sample,
    series: 's',
    startDir: root,
    language: 'es',
    client: { cloneVoice: async () => ({ voiceId: 'vk_es_1' }) },
  });
  assert.ok(res.voiceId);
  const text = fs.readFileSync(path.join(root, CATALOG_FILENAME), 'utf8');
  assert.match(text, /## NN Voice: lucas/, 'a Voice element for the clone exists');
  assert.match(text, /model:: minimax\/voice-clone/, 'the Voice carries the clone model');
  assert.match(text, /voice_id:: vk_es_1/, 'the Voice carries the returned voice id');
  assert.match(text, /language:: es/, 'the Voice carries the given language');
  // The record round-trips through the catalog parser.
  const { parseCatalog, validateCatalogVoices } = await import('../scripts/lib/catalog.mjs');
  const parsed = parseCatalog(text);
  assert.equal(parsed.voices.lucas.voice_id, 'vk_es_1');
  assert.equal(parsed.voices.lucas.language, 'es');
  validateCatalogVoices(parsed);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a failed provider call writes no Voice element', async () => {
  const { root, sample } = workspace();
  await assert.rejects(
    () => cloneVoice({ name: 'lucas', samplePath: sample, series: 's', startDir: root, language: 'es', client: { cloneVoice: async () => { throw new Error('boom'); } } }),
    /boom/,
  );
  const text = fs.readFileSync(path.join(root, CATALOG_FILENAME), 'utf8');
  assert.doesNotMatch(text, /## NN Voice:/, 'no Voice element on failure');
  fs.rmSync(root, { recursive: true, force: true });
});
