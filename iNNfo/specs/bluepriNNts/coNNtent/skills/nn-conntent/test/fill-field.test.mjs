/**
 * nn-conntent/test/fill-field.test.mjs
 *
 * `fill::` is the delivery concern that decides how a derived format reframes the
 * square master. It must default to `crop` — the destinations this pipeline serves
 * re-frame a padded file themselves — and a document that declares nothing must
 * produce today's output.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolve } from '../scripts/lib/cascade.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.resolve(HERE, '..', 'scripts', 'lib', 'field-registry.generated.json');
const PARAMETERS = path.resolve(HERE, '..', 'references', 'parameters.md');

const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));

test('fill is declared on Video, Series and Video Defaults as a delivery field', () => {
  const field = registry.fields.fill;
  assert.ok(field, 'the field registry carries fill');
  assert.equal(field.scope, 'video');
  assert.deepEqual([...field.options].sort(), ['blur', 'crop', 'pad']);
  assert.deepEqual([...field.concepts].sort(), ['Series', 'Video', 'Video Defaults']);
  for (const level of ['domain', 'series', 'video']) {
    assert.ok(field.levels.includes(level), `settable at the ${level} level`);
  }
});

test('an undeclared fill resolves to nothing, so crop stays the default', () => {
  const nothing = resolve('fill', {});
  assert.equal(nothing.value, null);
});

test('a declared fill wins from the nearest scope', () => {
  assert.equal(resolve('fill', { video: { fill: 'blur' } }).value, 'blur');
  assert.equal(resolve('fill', { series: { fill: 'pad' }, video: { fill: 'blur' } }).value, 'blur', 'the video level wins');
  assert.equal(resolve('fill', { series: { fill: 'pad' } }).value, 'pad');
});

test('the generated parameters page documents fill and its crop default', () => {
  const doc = fs.readFileSync(PARAMETERS, 'utf8');
  assert.match(doc, /fill/);
  assert.match(doc, /crop/);
  assert.match(doc, /_pad/, 'the pad suffix is documented');
  assert.match(doc, /re-frame|reframe/i, 'the rationale for the crop default is in the field description');
});
