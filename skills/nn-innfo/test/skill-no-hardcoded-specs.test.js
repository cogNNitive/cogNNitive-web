#!/usr/bin/env node

/**
 * skills/nn-innfo/test/skill-no-hardcoded-specs.test.js
 *
 * nn-innfo resolves specifications through the MCP (`get_spec` / `get_blueprint`)
 * and a model's `parent_spec.url`. Hardcoded versioned spec URLs rot as soon as
 * the repo layout or a spec version changes, so SKILL.md must not carry any.
 *
 *   node skills/nn-innfo/test/skill-no-hardcoded-specs.test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', 'SKILL.md');
const skill = fs.readFileSync(SKILL_PATH, 'utf-8');

// A spec URL/path: a repo URL or `iNNfo/specs/` path ending in `_V_x-y-z_..._NN.md`.
// Model-file naming examples (`Master_V_0-1-0_NN.md`) are not spec references.
const VERSIONED_SPEC_REF = /(?:https?:\/\/\S*|iNNfo\/specs\/\S*)_V_\d+-\d+-\d+_NN\.md/g;

assert.deepStrictEqual(
  skill.match(VERSIONED_SPEC_REF) || [],
  [],
  'nn-innfo/SKILL.md must not hardcode versioned spec URLs; resolve via get_spec / get_blueprint',
);

assert.ok(
  /get_spec/.test(skill) && /get_blueprint/.test(skill) && /parent_spec\.url/.test(skill),
  'nn-innfo/SKILL.md must point to get_spec / get_blueprint and parent_spec.url for spec resolution',
);

console.log('nn-innfo SKILL.md: no hardcoded versioned spec URLs');
