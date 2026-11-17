/**
 * nn-conntent/test/names.test.mjs
 *
 * One name per document and deliverable (design D-S2; capability conntent-asset-pipeline
 * "Canonical Asset Naming Pattern", two-phase-thumbnail, conntent-publication-description,
 * cognnitive-conntent-engine). Every output format is `<slug>_<W>x<H>.mp4` at the episode
 * root (spec S8: no `formats/` folder), thumbnail `<slug>_thumbnail_<W>x<H>.png`, description
 * `<slug>_description.md`, animatic `<slug>_animatic_<W>x<H>.mp4`; working files are
 * `plan.json`/`qa.json`; the HyperFrames composition id is the episode slug.
 *
 * Task 1c.1 — RED: current names.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { deliverableNamesFor, slugFromOutput } from '../scripts/lib/render.mjs';
import { compositionIdOf } from '../scripts/scene-compiler.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('deliverable names carry the slug and true dimensions', () => {
  const names = deliverableNamesFor({ slug: 'gas-pump', width: 1920, height: 1080 });
  assert.equal(names.output, 'gas-pump_1920x1080.mp4');
  assert.equal(names.master, undefined, 'there is no master deliverable');
  assert.equal(names.apng, 'gas-pump_thumbnail_1920x1080.png');
  assert.equal(names.description, 'gas-pump_description.md');
  assert.equal(names.animatic, 'gas-pump_animatic_1920x1080.mp4');
  assert.equal(names.plan, 'plan.json');
  assert.equal(names.qa, 'qa.json');
});

test('every output name strips back to the slug', () => {
  for (const name of ['gas-pump_1920x1080.mp4', 'gas-pump_1080x1920.mp4', 'gas-pump_animatic_640x360.mp4']) {
    assert.equal(slugFromOutput(name), 'gas-pump');
  }
});

test('the HyperFrames composition id is the episode slug, never the title', () => {
  assert.equal(compositionIdOf({ slug: 'gas-pump', title: 'Why founders fail' }), 'gas-pump');
  assert.equal(compositionIdOf({ title: 'Why founders fail' }), 'why-founders-fail');
  assert.equal(compositionIdOf('gas-pump'), 'gas-pump');
});