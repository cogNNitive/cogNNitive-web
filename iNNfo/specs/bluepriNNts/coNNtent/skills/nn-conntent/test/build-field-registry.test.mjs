/**
 * nn-conntent/test/build-field-registry.test.mjs
 *
 * The registry generator emits a `scope` class (`render|video|domain|record`) and its
 * allowed `levels` for every Field Definition, and FAILS when a cascade parameter lists
 * a Concept its class does not allow (`scope-concept-mismatch`) or declares no class
 * (`scope-missing`). (capability conntent-field-registry "Every Field Declares One
 * Scope Class"; task 2a.1 — RED: no `scope` emitted.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRegistry } from '../scripts/build-field-registry.mjs';

const field = (name, lines) => `## NN Field Definition: ${name}\n${lines}`;

function specWith(fields) {
  return `---
blueprint_name: "coNNtent"
blueprint_version: "V_0-16-0"
level: 3
knowledge_version: "V_0-1-0"
---

# NN index

* [[Video]]

# NN Concept Definition

## NN Concept Definition: Video
slug:: video

${fields}
`;
}

test('the registry carries scope and levels for every field', () => {
  const text = specWith([
    '## NN Field Definition: transition',
    '  concept:: [Video Defaults, Series, Scene Kind, Preset, Video, Scene]',
    '  scope:: render',
    '  type:: select',
    '  options:: [fade, wipe]',
    '',
  ].join('\n'));
  const registry = buildRegistry(text);
  const f = registry.fields['transition'];
  assert.equal(f.scope, 'render');
  assert.ok(Array.isArray(f.levels) && f.levels.length > 0, 'levels must be present');
});

test('a record field is not a cascade parameter and has scope record', () => {
  const text = specWith([
    '## NN Field Definition: translation_of',
    '  concept:: [Video]',
    '  type:: string',
    "  scope:: record",
    '',
  ].join('\n'));
  const registry = buildRegistry(text);
  const f = registry.fields['translation_of'];
  assert.equal(f.scope, 'record');
  assert.equal(f.cascade, false);
});

test('a concept outside the class fails generation with scope-concept-mismatch', () => {
  const text = specWith([
    '## NN Field Definition: language',
    '  concept:: [Video Defaults, Series, Video, Scene]', // Scene not allowed for class video
    '  scope:: video',
    '  type:: string',
    '',
  ].join('\n'));
  assert.throws(() => buildRegistry(text), /scope-concept-mismatch/);
});

test('a cascade parameter without scope:: fails generation with scope-missing', () => {
  const text = specWith([
    '## NN Field Definition: voice',
    '  concept:: [Video Defaults, Series, Scene Kind, Preset, Video, Scene]',
    '  type:: string',
    '',
  ].join('\n'));
  assert.throws(() => buildRegistry(text), /scope-missing/);
});