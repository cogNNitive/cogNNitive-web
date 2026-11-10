/**
 * nn-conntent/test/production-hierarchy.test.mjs
 *
 * The production hierarchy is three levels: domaiNN -> Series -> Video (episode). An
 * episode declares its owning Series by its location (`series/<s>/episodes/<slug>/`),
 * read through the scope chain — never through a `subject` value. The `coNNtent`
 * blueprint has no `Subject` Concept and no `subject` Field.
 *
 * (capability conntent-production-hierarchy "Three-Level Production Hierarchy";
 * task 1a.8.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertLayout } from '../scripts/lib/layout.mjs';
import { loadSeriesFor } from '../scripts/lib/series-doc.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BP = path.resolve(here, '..', '..', '..');

function makeDomain() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hierarchy-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  fs.mkdirSync(path.join(root, 'series', 'X', 'episodes', 'e'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'series', 'X', 'X_coNNtent_NN.md'),
    '---\nlevel: 3\nscope: true\ntitle: "X"\n---\n\n# NN Series\n\n## NN Series: X\nslug:: X\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'series', 'X', 'episodes', 'e', 'e_coNNtent_NN.md'),
    '---\nlevel: 3\ntitle: "E"\n---\n\n# NN Video\n\n## NN Video: E\nslug:: e\n',
    'utf8',
  );
  return root;
}

test('the hierarchy is domaiNN -> Series -> Video, and the episode resolves its series by location', () => {
  const root = makeDomain();
  try {
    const script = path.join(root, 'series', 'X', 'episodes', 'e', 'e_coNNtent_NN.md');
    const series = loadSeriesFor(script);
    assert.equal(series.slug, 'X');
    assert.equal(assertLayout(root).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the blueprint has no Subject Concept and no subject Field', () => {
  const spec = fs.readFileSync(path.join(BP, 'spec_NN.md'), 'utf8');
  assert.doesNotMatch(spec, /## NN Concept Definition: Subject/);
  assert.doesNotMatch(spec, /subject::/);
  // Skill scripts and references must not implement a Subject production level either
  // (exclude the test dir, whose assertions quote the tokens under test).
  const skillRoot = path.join(BP, 'skills', 'nn-conntent');
  const files = walk(skillRoot).filter((f) => !f.includes(path.join('skills', 'nn-conntent', 'test')));
  for (const f of files) {
    if (!/\.(mjs|md)$/.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /subject::/);
    assert.doesNotMatch(text, /\bsubject\b.*Concept/i);
  }
});

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (!/node_modules|\.git/.test(p)) out.push(p);
  }
  return out;
}