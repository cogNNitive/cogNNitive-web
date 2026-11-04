#!/usr/bin/env node

/**
 * nn-conntent/test/catalog.test.mjs
 *
 * The merged model catalog (capability video-model-catalog): reference + domaiNN overlay
 * merged per Model slug with the overlay winning, the allowlist, loud failures for unknown,
 * disallowed, blocked and unpriced models, price staleness, and adapter ↔ catalog control
 * parity with intent translation.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  CatalogError,
  assertModelAllowed,
  isPriceStale,
  loadMergedCatalog,
  mergeCatalog,
  parseCatalog,
  resolveModel,
} from '../scripts/lib/catalog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADAPTERS = path.resolve(HERE, '..', 'scripts', 'adapters');

const reference = `---
level: 3
title: "Reference"
---

# NN Model

## NN Model: alpha
slug:: alpha
provider:: wavespeed
api_id:: vendor/alpha
capability:: tts
controls:: [speed, emotion]
adapter:: minimax-speech
price:: 0.02
price_unit:: per_1k_chars
price_date:: 2026-11-02
status:: active

## NN Model: beta
slug:: beta
provider:: wavespeed
api_id:: vendor/beta
capability:: image
controls:: [size]
sizes:: [1024x1024]
adapter:: wavespeed-image
price:: 0.005
price_unit:: per_image
price_date:: 2026-11-02
status:: active
`;

const overlay = `---
level: 3
title: "Overlay"
---

# NN Model

## NN Model: alpha
slug:: alpha
allowed:: true
price:: 0.031
price_source:: invoice
price_date:: 2026-11-01
`;

const ref = parseCatalog(reference);

test('the reference catalog parses by Model slug and keeps api_id', () => {
  assert.deepEqual(Object.keys(ref.models).sort(), ['alpha', 'beta']);
  assert.equal(ref.models.alpha.api_id, 'vendor/alpha');
  assert.deepEqual(ref.models.beta.sizes, ['1024x1024']);
});

test('the overlay wins per slug and defines the allowlist', () => {
  const merged = mergeCatalog(ref, parseCatalog(overlay));
  assert.equal(merged.models.alpha.price, 0.031);
  assert.equal(merged.models.alpha.price_source, 'invoice');
  assert.equal(merged.models.alpha.api_id, 'vendor/alpha', 'unspecified fields come from the reference');
  assert.deepEqual(merged.allowed, ['alpha'], 'only allowed:: true models are allowed');
});

test('with no overlay the active reference models are allowed', () => {
  assert.deepEqual(mergeCatalog(ref).allowed, ['alpha', 'beta']);
});

test('an overlay-only model must declare every required field', () => {
  const partial = parseCatalog(`---
level: 3
title: "Overlay"
---

# NN Model

## NN Model: gamma
slug:: gamma
allowed:: true
price:: 1
`);
  assert.throws(() => mergeCatalog(ref, partial), (err) => {
    assert.ok(err instanceof CatalogError);
    assert.equal(err.code, 'incomplete-model');
    assert.match(err.message, /gamma/);
    return true;
  });
});

test('unknown, disallowed, blocked and unpriced models fail before spend', () => {
  const merged = mergeCatalog(ref, parseCatalog(overlay));
  assert.throws(() => resolveModel(merged, 'nope'), /unknown-model|not in the merged catalog/);
  assert.throws(() => assertModelAllowed(merged, 'beta'), (err) => err.code === 'model-not-allowed');

  const blockedDoc = parseCatalog(`---
level: 3
title: "Blocked"
---

# NN Model

## NN Model: beta
slug:: beta
allowed:: true
status:: blocked
`);
  const mergedBlocked = mergeCatalog(ref, blockedDoc);
  assert.throws(() => assertModelAllowed(mergedBlocked, 'beta'), (err) => err.code === 'model-blocked');

  const unpriced = mergeCatalog(parseCatalog(reference.replace('price:: 0.02', '')), null);
  assert.throws(() => assertModelAllowed(unpriced, 'alpha'), (err) => err.code === 'unpriced-model');
});

test('a price older than the threshold is stale, a fresh one is not', () => {
  const now = new Date('2026-11-02T00:00:00Z');
  assert.equal(isPriceStale('2026-10-31', { now, staleAfterDays: 90 }), false);
  assert.equal(isPriceStale('2026-06-01', { now, staleAfterDays: 90 }), true);
  assert.equal(isPriceStale('not-a-date', { now }), true);
});

test('the shipped catalog is complete and every model names a real adapter with the same controls', async () => {
  const catalog = loadMergedCatalog({ overlay: null });
  assert.ok(Object.keys(catalog.models).length >= 8, 'the reference catalog ships the allowed models');
  assert.ok(catalog.allowed.includes('infinitetalk-fast'), 'infinitetalk is an active, allowed avatar model');
  for (const model of Object.values(catalog.models)) {
    assert.ok(model.adapter, `${model.slug} names an adapter`);
    const file = path.join(ADAPTERS, `${model.adapter}.mjs`);
    assert.ok(fs.existsSync(file), `adapter file for ${model.slug} exists`);
    const { default: adapter } = await import(pathToFileURL(file).href);
    assert.equal(adapter.capability, String(model.capability), `${model.slug}: capability matches`);
    assert.deepEqual(
      [...adapter.controls].sort(),
      [...(model.controls || [])].map(String).sort(),
      `${model.slug}: adapter controls equal the catalog controls`,
    );
  }
});

test('intent translation maps declared controls and refuses an undeclared one', async () => {  const catalog = loadMergedCatalog({ overlay: null });
  const tts = catalog.models['minimax-speech-2-8-hd'];
  const { default: speech } = await import(pathToFileURL(path.join(ADAPTERS, 'minimax-speech.mjs')).href);
  assert.deepEqual(speech.translate({ voice_speed: '1.1', voice_emotion: 'calm' }, tts), { speed: 1.1, emotion: 'calm' });
  assert.throws(
    () => speech.translate({ image_size: '1024x1024' }, tts),
    /unsupported-control/,
    'an image size is not a control of a TTS model',
  );
  assert.throws(() => speech.translate({ scene_duration: '5' }, tts), /unsupported-intent/);
});

test('an image size the model does not offer is refused before spend', async () => {
  const { assertImageSize } = await import('../scripts/lib/catalog.mjs');
  const catalog = loadMergedCatalog({ overlay: null });
  assert.equal(assertImageSize(catalog, 'wavespeed-ai/z-image/turbo', '1024x1024'), '1024x1024');
  assert.throws(
    () => assertImageSize(catalog, 'wavespeed-ai/z-image/turbo', '4096x4096'),
    (err) => err.code === 'unsupported-size' && /4096x4096/.test(err.message),
  );
});
