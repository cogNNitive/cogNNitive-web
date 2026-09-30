#!/usr/bin/env node
/**
 * scripts/lib/publish-diff.test.js — plain-node tests for the publish diff.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { diffTrees } = require('./publish-diff.js');

function mkTree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-diff-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return dir;
}

function testIdentical() {
  const src = mkTree({ 'index.html': 'a', 'x/y.md': 'b' });
  const dst = mkTree({ 'index.html': 'a', 'x/y.md': 'b' });
  const d = diffTrees(src, dst);
  assert.strictEqual(d.identical, true);
  assert.deepStrictEqual(d.added, []);
  assert.deepStrictEqual(d.modified, []);
  assert.deepStrictEqual(d.removed, []);
  console.log('PASS: identical trees are a no-op');
}

function testChanges() {
  const src = mkTree({ 'index.html': 'a2', 'new.md': 'n', 'x/y.md': 'b' });
  const dst = mkTree({ 'index.html': 'a', 'x/y.md': 'b', 'gone.md': 'g' });
  const d = diffTrees(src, dst);
  assert.strictEqual(d.identical, false);
  assert.deepStrictEqual(d.added, ['new.md']);
  assert.deepStrictEqual(d.modified, ['index.html']);
  assert.deepStrictEqual(d.removed, ['gone.md']);
  console.log('PASS: added/modified/removed reported');
}

function testExcludesGitAndNojekyll() {
  const src = mkTree({ 'index.html': 'a' });
  const dst = mkTree({ 'index.html': 'a', '.git/config': 'x', '.nojekyll': '' });
  const d = diffTrees(src, dst);
  assert.strictEqual(d.identical, true, '.git and .nojekyll must not count as removals');
  console.log('PASS: .git and .nojekyll are excluded');
}

function testMissingTargetIsAllAdded() {
  const src = mkTree({ 'index.html': 'a', 'x/y.md': 'b' });
  const missing = path.join(os.tmpdir(), 'publish-diff-does-not-exist-' + Date.now());
  const d = diffTrees(src, missing);
  assert.strictEqual(d.identical, false);
  assert.deepStrictEqual(d.added, ['index.html', 'x/y.md']);
  console.log('PASS: a missing target reports every source file as added');
}

function runAll() {
  try {
    testIdentical();
    testChanges();
    testExcludesGitAndNojekyll();
    testMissingTargetIsAllAdded();
    console.log('\nAll publish-diff tests passed.');
  } catch (err) {
    console.error(`\npublish-diff tests FAILED: ${err.message}`);
    process.exit(1);
  }
}

runAll();
