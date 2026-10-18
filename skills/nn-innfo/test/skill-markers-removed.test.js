#!/usr/bin/env node

/**
 * skills/nn-innfo/test/skill-markers-removed.test.js
 *
 * The Marker primitive is retired (fields-replace-markers-and-tags): a flag
 * marker is a `tags` Field value, a valued marker is a normal Field. nn-innfo
 * must ship the "Recipe: MARKERS_REMOVED" remediation and must not teach any
 * live Marker authoring.
 *
 *   node skills/nn-innfo/test/skill-markers-removed.test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', 'SKILL.md');
const skill = fs.readFileSync(SKILL_PATH, 'utf-8');

// 1. The remediation recipe is present with its five steps and its operations.
assert.ok(
  /^## 8e-bis\. Recipe: MARKERS_REMOVED/m.test(skill),
  'nn-innfo must ship the "Recipe: MARKERS_REMOVED" section',
);
for (const step of [
  '**Run validation and read `meta`**',
  '**Classify each marker**',
  '**Build ONE changeset**',
  '**Level-2 vs Level-3**',
  '**Propose with `propose_changeset`**',
]) {
  assert.ok(skill.includes(step), `recipe step present: ${step}`);
}
for (const op of ['propose_changeset', 'update_field', 'update_concept_field', 'remove_matrix']) {
  assert.ok(skill.includes(op), `recipe must name the ${op} operation`);
}
assert.ok(
  /scores? with no declared Field (?:is|are) dropped|dropped, not silently remapped/i.test(skill),
  'recipe must state which numeric scores are dropped',
);

// 2. No live Marker authoring remains.
assert.ok(!/need Markers/.test(skill), 'the wizard must not ask about Markers');
assert.ok(!/Coexistence with Markers/.test(skill), 'section 8e must not frame tags as marker precursors');
assert.ok(
  !/promoted to a formal Level 2 `Marker Definition`/.test(skill),
  'section 8e must not promote a tag to a Marker Definition',
);
assert.ok(!/applies_to::/.test(skill), 'no Marker Definition authoring grammar remains');
assert.ok(
  /Defines the 3 root primitives/.test(skill) && !/4 root primitives/.test(skill),
  'the level summary lists 3 root primitives, not 4',
);

console.log('nn-innfo SKILL.md: MARKERS_REMOVED recipe present, no live Marker authoring');
