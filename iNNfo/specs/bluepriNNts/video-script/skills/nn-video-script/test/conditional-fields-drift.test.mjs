#!/usr/bin/env node

/**
 * nn-video-script/test/conditional-fields-drift.test.mjs
 *
 * Drift guard: the compiler's `DEFAULT_CONDITIONAL_FIELDS` is a vendored copy of
 * the `video-script` blueprint's `validation.conditional_fields` (the zero-dependency
 * installed skill cannot read the blueprint at runtime, so the contract is hardcoded).
 * This test asserts the two stay identical, so a blueprint edit that forgets the
 * compiler copy fails loudly. Skipped when the blueprint is not adjacent (standalone
 * install).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONDITIONAL_FIELDS } from '../scripts/remotion-scene-compiler.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// test/ -> nn-video-script/ -> skills/ -> video-script/ (spec_NN.md)
const blueprintPath = path.resolve(here, '..', '..', '..', 'spec_NN.md');

if (!fs.existsSync(blueprintPath)) {
  console.log('ℹ blueprint spec not adjacent (standalone install); skipping conditional_fields drift guard');
} else {
  const blueprint = fs.readFileSync(blueprintPath, 'utf8');
  // Extract `validation.conditional_fields`: indented `key: [a, b]` lines that
  // follow the `conditional_fields:` key, stopping at the first non-list line.
  const declared = {};
  let inBlock = false;
  for (const line of blueprint.split(/\r?\n/)) {
    if (/^\s*conditional_fields:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    const m = /^\s*([A-Za-z0-9_-]+):\s*\[([^\]]*)\]/.exec(line);
    if (!m) break;
    declared[m[1]] = m[2].split(',').map((s) => s.trim()).filter(Boolean);
  }

  assert.deepStrictEqual(
    DEFAULT_CONDITIONAL_FIELDS,
    declared,
    'DEFAULT_CONDITIONAL_FIELDS must stay in sync with the blueprint validation.conditional_fields',
  );
  console.log('✔ conditional_fields contract matches the blueprint validation.conditional_fields');
}
