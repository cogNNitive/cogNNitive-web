#!/usr/bin/env node

/**
 * scripts/blueprint-catalog.test.mjs
 *
 * Unit tests for scripts/blueprint-catalog.mjs (plain node, zero deps —
 * matches the repo's actioNN .test.js convention).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const GENERATOR = path.join(SCRIPT_DIR, 'blueprint-catalog.mjs');

function runGenerator(args) {
  return spawnSync(process.execPath, [GENERATOR, ...args], { encoding: 'utf-8' });
}

function fixtureTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blueprint-catalog-test-'));
  const t = path.join(root, 'templates');
  fs.mkdirSync(path.join(t, 'business'), { recursive: true });
  fs.mkdirSync(path.join(t, 'business', 'samples'), { recursive: true });
  fs.mkdirSync(path.join(t, 'documentation'), { recursive: true });
  fs.mkdirSync(path.join(t, 'draft'), { recursive: true });
  fs.mkdirSync(path.join(t, 'cogNNitive'), { recursive: true });
  fs.mkdirSync(path.join(t, 'base'), { recursive: true });

  const spec = (url, level, tv) =>
    `---\nspec_version: "V_0-2-1"\nlevel: ${level}\nspec_url: "${url}"\n` +
    (tv == null ? '' : `template_version: "${tv}"\n`) +
    `title: "T"\n---\n`;

  // Canonical unversioned filenames; version is the authoritative frontmatter
  // `template_version`, not the path.
  fs.writeFileSync(path.join(t, 'business', 'spec_NN.md'), spec('https://x/business/spec_NN.md', 2, 'V_0-2-1'));
  // a leftover historical file in the same dir still aggregates by frontmatter version
  fs.writeFileSync(path.join(t, 'business', 'business_V_0-1-0_NN.md'), spec('https://x/business/business_V_0-1-0_NN.md', 2, 'V_0-1-0'));
  // sample model (level 3) must be excluded
  fs.writeFileSync(path.join(t, 'business', 'samples', 'Ghostbusters_V_0-2-0_business_NN.md'), spec('https://x/Ghostbusters_V_0-2-0_business_NN.md', 3, 'V_0-2-0'));
  // flat canonical subdir template
  fs.writeFileSync(path.join(t, 'documentation', 'spec_NN.md'), spec('https://x/documentation/spec_NN.md', 2, 'V_0-2-0'));
  // root workspace spec — canonical bare filename, discovered as `workspace`
  fs.writeFileSync(path.join(t, 'workspace_spec_NN.md'), spec('https://x/workspace_spec_NN.md', 2, 'V_0-3-0'));
  // level-2 template with no frontmatter template_version — skipped with a warning
  fs.writeFileSync(path.join(t, 'draft', 'spec_NN.md'), spec('https://x/draft/spec_NN.md', 2, null));
  // frozen lineage templates — cogNNitive + base must land in `frozen`, not `templates`
  fs.writeFileSync(path.join(t, 'cogNNitive', 'spec_NN.md'), spec('https://x/cogNNitive/spec_NN.md', 2, 'V_0-2-0'));
  fs.writeFileSync(path.join(t, 'base', 'spec_NN.md'), spec('https://x/base/spec_NN.md', 2, 'V_0-1-0'));
  return root;
}

async function runTests() {
  console.log('Running blueprint-catalog unit tests...');
  const root = fixtureTree();
  const t = path.join(root, 'templates');
  const out = path.join(root, 'catalog.json');
  try {
    // Test 1: generator produces a correct catalog
    {
      const res = runGenerator(['--root', t, '--out', out]);
      assert.strictEqual(res.status, 0, res.stderr);
      const catalog = JSON.parse(fs.readFileSync(out, 'utf-8'));

      assert.deepStrictEqual(
        catalog.blueprints.business.versions.map((v) => v.template_version),
        ['V_0-1-0', 'V_0-2-1'],
        'business versions come from frontmatter template_version, sorted ascending',
      );
      assert.strictEqual(catalog.blueprints.business.adopted, 'V_0-2-1', 'adopted = highest version');
      assert.strictEqual(catalog.blueprints.business.versions[1].url, 'https://x/business/spec_NN.md');
      assert.strictEqual(catalog.blueprints.business.versions.length, 2, 'level-3 sample excluded');

      assert.deepStrictEqual(
        catalog.blueprints.documentation.versions.map((v) => v.template_version),
        ['V_0-2-0'],
        'flat canonical subdir template discovered by frontmatter version',
      );

      assert.ok('workspace' in catalog.blueprints, 'root workspace_spec_NN.md discovered as workspace');
      assert.strictEqual(catalog.blueprints.workspace.adopted, 'V_0-3-0');

      assert.ok(!('draft' in catalog.blueprints), 'level-2 file without template_version is not catalogued');
      assert.ok(
        catalog.warnings.some((w) => w.includes('draft/spec_NN.md')),
        'missing template_version produces a warning',
      );
      console.log('✔ generator emits correct catalog (frontmatter versions, adopted, level-3 excluded, canonical names)');
    }

    // Test 1a: frozen partition — cogNNitive + base under `frozen`, absent from `templates`
    {
      const catalog = JSON.parse(fs.readFileSync(out, 'utf-8'));
      assert.ok('frozen' in catalog, 'catalog carries a top-level frozen partition');
      assert.ok('cogNNitive' in catalog.frozen, 'cogNNitive recorded under frozen');
      assert.ok('base' in catalog.frozen, 'base recorded under frozen');
      assert.ok(!('cogNNitive' in catalog.blueprints), 'cogNNitive dropped from templates');
      assert.ok(!('base' in catalog.blueprints), 'base dropped from templates');
      assert.strictEqual(catalog.frozen.cogNNitive.adopted, 'V_0-2-0', 'frozen cogNNitive adopted version preserved');
      assert.strictEqual(catalog.frozen.base.adopted, 'V_0-1-0', 'frozen base adopted version preserved');
      console.log('✔ frozen partition emits cogNNitive + base and drops them from templates');
    }

    // Test 2: --check passes on a fresh catalog
    {
      const res = runGenerator(['--check', '--root', t, '--out', out]);
      assert.strictEqual(res.status, 0, res.stderr);
      console.log('✔ --check passes when catalog is fresh');
    }

    // Test 3: --check exits 1 on drift
    {
      const before = fs.readFileSync(out, 'utf-8');
      fs.writeFileSync(out, before + '\n// tampered\n');
      const res = runGenerator(['--check', '--root', t, '--out', out]);
      assert.strictEqual(res.status, 1, 'stale catalog must exit 1');
      assert.ok(res.stderr.includes('DRIFT'), 'drift report present');
      console.log('✔ --check exits 1 with a drift report on a stale catalog');
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log('All blueprint-catalog tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});