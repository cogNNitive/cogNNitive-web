#!/usr/bin/env node

/**
 * scripts/tag-pin-freshness.test.js
 *
 * Plain-node tests for the tag/pin freshness guard
 * (scripts/lib/tag-pin-freshness.js): a diff touching skills/ or a canonical
 * templates spec_NN.md file must also touch manifest/source.yaml. Uses a
 * disposable git repository fixture so the diff is exercised against real
 * git metadata, not a mock.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { checkTagPinFreshness } = require('./lib/tag-pin-freshness.js');

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Creates a repo with one baseline commit tagged `base`, returns the dir. */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-pin-freshness-'));
  git('init', dir);
  git('config user.email "test@example.com"', dir);
  git('config user.name "Test"', dir);
  fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\n', 'utf8');
  git('add README.md', dir);
  git('commit -m baseline', dir);
  git('tag base', dir);
  return dir;
}

function writeFile(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

function commitAll(dir, message) {
  git('add -A', dir);
  git(`commit -m "${message}"`, dir);
}

function main() {
  console.log('Running tag-pin-freshness unit tests...');

  // 1. No skills/template changes -> ok.
  {
    const dir = makeRepo();
    try {
      writeFile(dir, 'docs/notes.md', 'unrelated change\n');
      commitAll(dir, 'unrelated');
      const r = checkTagPinFreshness(dir, { base: 'base', head: 'HEAD' });
      assert.strictEqual(r.ok, true, r.errors.join('; '));
      assert.deepStrictEqual(r.errors, []);
      console.log('✔ Unrelated change passes');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 2. skills/ changed AND manifest/source.yaml changed -> ok.
  {
    const dir = makeRepo();
    try {
      writeFile(dir, 'skills/nn-example/SKILL.md', '---\nname: nn-example\n---\n');
      writeFile(dir, 'manifest/source.yaml', 'channels: {}\n');
      commitAll(dir, 'skills change with re-pin');
      const r = checkTagPinFreshness(dir, { base: 'base', head: 'HEAD' });
      assert.strictEqual(r.ok, true, r.errors.join('; '));
      console.log('✔ skills/ change with manifest re-pin passes');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 3. skills/ changed, manifest NOT changed -> fails.
  {
    const dir = makeRepo();
    try {
      writeFile(dir, 'skills/nn-example/SKILL.md', '---\nname: nn-example\n---\n');
      commitAll(dir, 'skills change without re-pin');
      const r = checkTagPinFreshness(dir, { base: 'base', head: 'HEAD' });
      assert.strictEqual(r.ok, false);
      assert.ok(r.errors.some((e) => e.includes('skills/')), r.errors.join('; '));
      console.log('✔ skills/ change without manifest re-pin fails');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 4. Template spec_NN.md changed, manifest NOT changed -> fails.
  {
    const dir = makeRepo();
    try {
      writeFile(dir, 'iNNfo/specs/bluepriNNts/business/spec_NN.md', '---\ntemplate_version: "0.2.0"\n---\n');
      commitAll(dir, 'template spec bump without re-pin');
      const r = checkTagPinFreshness(dir, { base: 'base', head: 'HEAD' });
      assert.strictEqual(r.ok, false);
      assert.ok(r.errors.some((e) => e.includes('spec_NN.md')), r.errors.join('; '));
      console.log('✔ Template spec_NN.md change without manifest re-pin fails');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 5. Template spec_NN.md changed AND manifest changed -> ok.
  {
    const dir = makeRepo();
    try {
      writeFile(dir, 'iNNfo/specs/bluepriNNts/business/spec_NN.md', '---\ntemplate_version: "0.2.0"\n---\n');
      writeFile(dir, 'manifest/source.yaml', 'channels: {}\n');
      commitAll(dir, 'template spec bump with re-pin');
      const r = checkTagPinFreshness(dir, { base: 'base', head: 'HEAD' });
      assert.strictEqual(r.ok, true, r.errors.join('; '));
      console.log('✔ Template spec_NN.md change with manifest re-pin passes');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 6. Unresolvable ref (no such base) -> skipped, does not throw or fail.
  {
    const dir = makeRepo();
    try {
      const r = checkTagPinFreshness(dir, { base: 'origin/main', head: 'HEAD' });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.skipped, true);
      assert.deepStrictEqual(r.errors, []);
      console.log('✔ Unresolvable ref is skipped, not failed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log('All tag-pin-freshness unit tests passed successfully!');
}

main();
