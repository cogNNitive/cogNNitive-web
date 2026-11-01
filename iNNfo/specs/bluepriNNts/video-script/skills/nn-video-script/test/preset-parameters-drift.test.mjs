#!/usr/bin/env node

/**
 * nn-video-script/test/preset-parameters-drift.test.mjs
 *
 * Drift guard: `PRESET_PARAMETERS` (the only keys a Preset element may carry) is a
 * vendored copy of the blueprint Fields whose `concept::` lists `Preset`. The
 * zero-dependency installed skill cannot read the blueprint at runtime, so this test
 * asserts the two stay identical. Skipped when the blueprint is not adjacent
 * (standalone install).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESET_PARAMETERS } from '../scripts/lib/presets.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// test/ -> nn-video-script/ -> skills/ -> video-script/ (spec_NN.md)
const blueprintPath = path.resolve(here, '..', '..', '..', 'spec_NN.md');

/** Names of the `## NN Field Definition:` blocks whose `concept::` list includes `Preset`. */
export function presetSettableFields(specText) {
  const names = [];
  let current = null;
  for (const line of specText.split(/\r?\n/)) {
    const heading = /^## NN Field Definition: (\S+)\s*$/.exec(line);
    if (heading) {
      current = heading[1];
      continue;
    }
    if (/^#{1,2} /.test(line)) {
      current = null;
      continue;
    }
    const concept = current && /^concept::\s*\[?(.*?)\]?\s*$/.exec(line);
    if (concept && concept[1].split(',').map((s) => s.trim()).includes('Preset')) names.push(current);
  }
  return names.sort();
}

if (!fs.existsSync(blueprintPath)) {
  console.log('ℹ blueprint spec not adjacent (standalone install); skipping preset parameters drift guard');
} else {
  const declared = presetSettableFields(fs.readFileSync(blueprintPath, 'utf8'));
  assert.ok(declared.length > 0, 'the blueprint must declare Preset-settable Fields');

  assert.deepStrictEqual(
    [...PRESET_PARAMETERS].sort(),
    declared,
    'PRESET_PARAMETERS must stay in sync with the blueprint Fields whose concept:: includes Preset',
  );
  console.log(`✔ PRESET_PARAMETERS matches the ${declared.length} Preset-settable blueprint Fields`);
}
