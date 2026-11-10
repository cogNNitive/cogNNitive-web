/**
 * nn-conntent/test/source-trace.test.mjs
 *
 * Every resolved value carries `{ value, source, document, overridden }`: `resolve`
 * and `createCascade().at().get()` return the winning scope, the winning document and
 * the lost sources (nearest first); the persisted plan and the validate output print
 * the level for every resolved value. No consumer re-derives the level by other means.
 * (capability conntent-field-registry "Every Resolved Value Carries A Source Trace";
 * task 2a.8 — RED: trace lacks document/overridden.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCascade, resolve } from '../scripts/lib/cascade.mjs';
import { formatStamp, parsePlanMarkdown, computePlanHash } from '../scripts/lib/plan.mjs';

const bags = (over = {}) => ({
  domain: {},
  series: { voice_speed: 1.1, ...(over.series || {}) },
  kind: {},
  video: { ...(over.video || {}) },
  scene: {},
  layer: {},
  blueprint: {},
});

test('resolve returns the trace: value, source, document and overridden', () => {
  const b = bags({ video: { voice_speed: 1.4 } });
  b.series = { voice_speed: 1.1, __doc: 'series.md' };
  const r = resolve('voice_speed', b);
  assert.equal(r.value, 1.4);
  assert.equal(r.source, 'video');
  assert.ok('document' in r, 'the trace carries the document');
  assert.ok(Array.isArray(r.overridden), 'the trace carries the overridden list');
  // The lost series source is reported.
  const lost = r.overridden.find((o) => o.source === 'series');
  assert.ok(lost, 'the series that lost is listed');
});

test('createCascade get carries the same trace', () => {
  const b = bags({ video: { voice_speed: 1.4 } });
  const r = createCascade({ bags: b }).at('scene-1').get('voice_speed');
  assert.equal(r.value, 1.4);
  assert.equal(r.source, 'video');
  assert.ok('document' in r && Array.isArray(r.overridden));
});

test('the plan stamp prints the resolved models (levels feed the plan identity)', () => {
  // The persisted plan carries the plan_hash, which folds in the resolved models; the
  // estimator stamps the hash and the tiles display the per-scene resolved models with
  // their provider. Here we assert the identity plumbing prints a stable hash and that
  // distinct resolution levels change it.
  const h1 = computePlanHash('script', { image: 'wavespeed-ai/z-image/turbo' });
  const stamp = formatStamp({ planHash: h1, totalUsd: 1.25, models: ['wavespeed-ai/z-image/turbo'] });
  const parsed = parsePlanMarkdown(stamp);
  assert.equal(parsed.planHash, h1);
  assert.equal(parsed.totalUsd, 1.25);
  assert.deepEqual(parsed.models, ['wavespeed-ai/z-image/turbo']);
  const h2 = computePlanHash('script', { image: 'replicate/flux-1-pro' });
  assert.notEqual(h1, h2, 'a different resolved model changes the printed hash');
});

test('no consumer re-derives the level except the resolver shape', () => {
  // The frame/transition/voice resolution used by the compiler must come from the
  // cascade resolver, not from hand-rolled per-level checks. This pins the exported
  // resolver surface so a future duplicated path breaks the consumers guard.
  assert.equal(typeof resolve, 'function');
  assert.deepEqual(Object.keys(resolve('fit', bags())).sort(), ['document', 'overridden', 'source', 'value']);
});