/**
 * nn-conntent/test/review-hash.test.mjs
 *
 * One canonical implementation of the review subjects and their hashes, shared by the
 * engine and the console data module (capability conntent-review-gates, tasks
 * 3b-1.1/3b-1.2; design D-P1, C3).
 *
 * Table-driven: every case is a scenario pair. The subjects are computed from
 * already-resolved input on purpose, so the hash tests do not need a workspace.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalJson,
  scriptSubject,
  previewSubject,
  reviewHash,
} from '../scripts/lib/review-hash.mjs';
import { planSliceHash, episodePlanHash } from '../scripts/lib/plan.mjs';

const HEX64 = /^[0-9a-f]{64}$/;

/** A resolved scene view, as the engine hands it to the subjects. */
function view(overrides = {}) {
  const { params, layers, ...rest } = overrides;
  return {
    scene: 's1',
    language: 'es',
    narration: 'Hola mundo',
    layers: layers ?? [{ type: 'image', prompt: 'a hero', resolved: { asset: { name: 'hero', sha256: 'a'.repeat(64) } } }],
    params: params ?? { voice: 'ana-es', avatar: 'lucas', captions: 'words' },
    ...rest,
  };
}

test('canonical JSON sorts keys and drops insignificant whitespace', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
  assert.equal(
    reviewHash({ b: 1, a: 2 }),
    reviewHash({ a: 2, b: 1 }),
    'key order must not change a hash',
  );
  assert.match(reviewHash({ a: 1 }), HEX64);
});

test('the script hash covers narration, layer fields, resolved params and language', () => {
  const base = reviewHash(scriptSubject(view()));
  const cases = [
    ['narration edit', view({ narration: 'Hola mundos' })],
    ['layer prompt edit', view({ layers: [{ type: 'image', prompt: 'another hero' }] })],
    ['resolved parameter edit', view({ params: { voice: 'bea-es', avatar: 'lucas', captions: 'words' } })],
    ['language edit', view({ language: 'en' })],
    ['layer order', view({ layers: [{ type: 'image' }, { type: 'text' }] })],
    ['layer order reversed', view({ layers: [{ type: 'text' }, { type: 'image' }] })],
  ]
  for (const [name, changed] of cases) {
    assert.notEqual(reviewHash(scriptSubject(changed)), base, name);
  }
  // The last two differ from each other as well: order is content.
  assert.notEqual(
    reviewHash(scriptSubject(view({ layers: [{ type: 'image' }, { type: 'text' }] }))),
    reviewHash(scriptSubject(view({ layers: [{ type: 'text' }, { type: 'image' }] }))),
  );
});

test('the script hash excludes review, status, titles, sources and their shadows', () => {
  const base = reviewHash(scriptSubject(view()));
  const ignored = [
    ['review mirror', { review: 'approved' }],
    ['status', { status: 'draft' }],
    ['title', { title: 'Chapter one' }],
    ['sources', { sources: 'sources/interview.md@## Vision' }],
    ['source shadow', { narration_source: 'sources/interview.md@## Vision' }],
  ];
  for (const [name, extra] of ignored) {
    const changed = view({
      params: { ...view().params, ...extra },
      layers: [{ ...view().layers[0], ...extra }],
    });
    assert.equal(reviewHash(scriptSubject(changed)), base, `${name} must not change the hash`);
  }
});

test('a translation carries the original scene hash, and only a translation does', () => {
  const plain = scriptSubject(view());
  assert.equal('source' in plain, false, 'an ordinary scene has no source: its hash cannot move');
  const translated = scriptSubject({
    ...view(),
    source: { scene: 's1', hash: 'a'.repeat(64) },
  });
  assert.deepEqual(translated.source, { scene: 's1', hash: 'a'.repeat(64) });
  assert.notEqual(reviewHash(translated), reviewHash(plain), 'the original hash joins the subject');
  const changed = scriptSubject({ ...view(), source: { scene: 's1', hash: 'b'.repeat(64) } });
  assert.notEqual(reviewHash(changed), reviewHash(translated), 'a moved original re-opens the scene');
});

test('the scenes hash independently and the same value from another level is identical', () => {
  const one = reviewHash(scriptSubject(view({ scene: 's1' })));
  const two = reviewHash(scriptSubject(view({ scene: 's2', narration: 'Otra escena' })));
  assert.notEqual(one, two);

  // The subject carries resolved values only, so moving a value's source level
  // cannot change it (the cascade is what resolves it).
  const fromSeries = view({ params: { voice: 'ana-es' } });
  const fromScene = view({ params: { voice: 'ana-es' } });
  assert.equal(reviewHash(scriptSubject(fromSeries)), reviewHash(scriptSubject(fromScene)));
});

test('the preview hash covers script, tts, images, alignment and the still', () => {
  const base = previewSubject({
    scriptHash: 'a'.repeat(64),
    ttsKey: 'tts-1',
    imageKeys: ['img-1', 'img-2'],
    alignmentKey: 'cap-1',
    still: 'b'.repeat(64),
  });
  const baseHash = reviewHash(base);
  const changes = [
    ['script', { ...base, script_hash: 'c'.repeat(64) }],
    ['tts', { ...base, tts_key: 'tts-2' }],
    ['images', { ...base, image_keys: ['img-1', 'img-3'] }],
    ['image order', { ...base, image_keys: ['img-2', 'img-1'] }],
    ['alignment', { ...base, alignment_key: 'cap-2' }],
    ['still', { ...base, still: 'd'.repeat(64) }],
  ];
  for (const [name, changed] of changes) {
    assert.notEqual(reviewHash(changed), baseHash, name);
  }
});

test('the preview hash ignores an avatar clip key and stays stable with captions off', () => {
  const off = previewSubject({ scriptHash: 'a'.repeat(64), ttsKey: 't', imageKeys: [], alignmentKey: null, still: null });
  const offLater = previewSubject({ scriptHash: 'a'.repeat(64), ttsKey: 't', imageKeys: [], alignmentKey: null, still: null });
  assert.equal(reviewHash(off), reviewHash(offLater));
  assert.equal(off.alignment_key, null);

  // Avatar clips are the spend the gate authorizes, so they are never an input.
  const withClip = previewSubject({
    scriptHash: 'a'.repeat(64),
    ttsKey: 't',
    imageKeys: [],
    alignmentKey: null,
    still: null,
    avatarClip: 'clip-1',
  });
  assert.equal(reviewHash(withClip), reviewHash(off));
});

const item = (overrides = {}) => ({
  kind: 'tts',
  model: 'voice-provider',
  cache_key: 'tts-1',
  units: 1,
  unit_price: '0.10',
  price_date: '2026-10-01',
  ...overrides,
});

test('the plan slice hash covers the items and their prices', () => {
  const base = planSliceHash('s1', [item()]);
  assert.match(base, HEX64);
  assert.equal(base, planSliceHash('s1', [item()]), 'same inputs, same hash');
  assert.notEqual(base, planSliceHash('s1', [item({ unit_price: '0.20' })]), 'price change');
  assert.notEqual(base, planSliceHash('s1', [item({ model: 'other' })]), 'model change');
  assert.notEqual(base, planSliceHash('s1', [item({ cache_key: 'tts-2' })]), 'cache key change');
  assert.notEqual(base, planSliceHash('s2', [item()]), 'scene change');
});

test('the episode plan hash sorts slices and changes with any slice', () => {
  const s1 = { scene: 's1', slice_hash: 'a'.repeat(64) };
  const s2 = { scene: 's2', slice_hash: 'b'.repeat(64) };
  const one = episodePlanHash({ episode: 'e', blueprintVersion: 'V_0-17-0', slices: [s2, s1] });
  const two = episodePlanHash({ episode: 'e', blueprintVersion: 'V_0-17-0', slices: [s1, s2] });
  assert.equal(one, two, 'slice order must not matter');

  const edited = episodePlanHash({
    episode: 'e',
    blueprintVersion: 'V_0-17-0',
    slices: [s1, { scene: 's2', slice_hash: 'c'.repeat(64) }],
  });
  assert.notEqual(edited, one, 'one scene edit changes the episode hash');

  assert.equal(
    planSliceHash('s1', [item()]),
    planSliceHash('s1', [item()]),
    'the untouched slice is stable',
  );
});
