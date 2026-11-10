/**
 * nn-conntent/test/new-fields.test.mjs
 *
 * The 2b.6 fields: `captions`/`caption_model` (render class), `thumbnail_formats`,
 * `thumbnail_base`, `thumbnail_title`, `thumbnail_badge` and `review_gates` (video
 * class) exist in the registry with the right scope classes and allowed levels; the
 * retired `script_review` is gone from both the registry and the blueprint package
 * (`rg script_review BP/` returns nothing). The shipped defaults carry `review_gates::`
 * and `captions::` and no `voice::` (there is no package default voice, Q4).
 * (capability conntent-field-registry; two-phase-thumbnail; conntent-review removed;
 * task 2b.6 — RED: fields missing.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRegistry } from '../scripts/build-field-registry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.resolve(here, '../../../spec_NN.md');
const bpsRoot = path.resolve(here, '../../..'); // coNNtent blueprint package

const specText = fs.readFileSync(specPath, 'utf8');
const registry = buildRegistry(specText);

test('the 2b.6 fields exist with the right scope class', () => {
  const expect = {
    captions: 'render',
    caption_model: 'render',
    thumbnail_formats: 'video',
    thumbnail_base: 'video',
    thumbnail_title: 'video',
    thumbnail_badge: 'video',
    review_gates: 'video',
  };
  for (const [name, scope] of Object.entries(expect)) {
    const field = registry.fields[name];
    assert.ok(field, `field "${name}" must exist in the registry`);
    assert.equal(field.scope, scope, `field "${name}" must be class ${scope}`);
    assert.ok(Array.isArray(field.levels) && field.levels.length > 0, `${name} must list allowed levels`);
  }
});

test('script_review is retired: absent from registry and from the blueprint', () => {
  assert.equal(registry.fields.script_review, undefined, 'script_review must not be in the registry');
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      // /test/ is excluded: tests assert the absence of the retired name by spelling it.
      if (entry.isDirectory()) {
        if (entry.name === 'test') continue;
        walk(full).forEach((x) => out.push(x));
      } else if (entry.isFile() && !full.includes(`${path.sep}node_modules${path.sep}`)) out.push(full);
    }
    return out;
  };
  const offenders = [];
  for (const file of walk(bpsRoot)) {
    if (!/\.(md|mjs|json)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('script_review')) offenders.push(path.relative(bpsRoot, file));
  }
  assert.deepEqual(offenders, [], 'no blueprint file may still reference script_review');
});

test('the shipped defaults carry review_gates and captions and no package voice', () => {
  const defaultsPath = path.resolve(bpsRoot, 'defaults/video-defaults_NN.md');
  const text = fs.readFileSync(defaultsPath, 'utf8');
  assert.match(text, /review_gates::\s*\[script, preview\]/, 'defaults declare review_gates [script, preview]');
  assert.match(text, /captions::\s*off/, 'defaults declare captions off');
  assert.match(text, /thumbnail_formats::\s*\[2560x1440, 1080x1920\]/, 'defaults declare thumbnail_formats');
  assert.doesNotMatch(text, /(^|\n)voice::/, 'the package ships no default voice (Q4)');
  assert.doesNotMatch(text, /script_review/, 'defaults no longer carry script_review');
});
