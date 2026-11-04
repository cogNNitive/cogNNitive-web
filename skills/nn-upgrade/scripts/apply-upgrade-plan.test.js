#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/apply-upgrade-plan.test.js
 *
 * Unit tests for apply-upgrade-plan.js (distributed-storage S4b.2).
 * Plain node, matching the sibling skill tests.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { applyUpgradePlan, repinContent } = require('./apply-upgrade-plan');
const upgrade = require('../../nn-preflight/scripts/upgrade-check');

const CATALOG = {
  blueprints: {
    'coNNtent': {
      name: 'coNNtent',
      adopted: 'V_0-15-0',
      versions: [{ blueprint_version: 'V_0-14-1' }, { blueprint_version: 'V_0-15-0' }],
    },
  },
};

const URL_OLD =
  'https://x/main/iNNfo/specs/bluepriNNts/coNNtent/coNNtent_V_0-14-1_NN.md';

/**
 * A domaiNN with `count` Videos of one Series, all pinned at `version`.
 * `dryRun` backups are written next to the temp dir, never inside the workspace.
 */
function buildDomain(count, version = 'V_0-14-1') {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-plan-'));
  for (let i = 0; i < count; i++) {
    const slug = `v${String(i).padStart(2, '0')}`;
    const dir = path.join(ws, 'series', 'villa', 'assets', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${slug}_coNNtent_NN.md`),
      [
        '---',
        'level: 3',
        `title: "Video ${i}"`,
        'parent_spec:',
        `  name: "coNNtent_${version}"`,
        `  url: "${URL_OLD.replace('V_0-14-1', version)}"`,
        '---',
        '',
        '# NN Video',
        '',
        `## NN Video: ${slug}`,
        '',
      ].join('\n'),
      'utf-8',
    );
  }
  return ws;
}

const readAll = (ws) => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('_NN.md')) out.push([full, fs.readFileSync(full, 'utf-8')]);
    }
  };
  walk(ws);
  return out;
};

function runTests() {
  console.log('Running apply-upgrade-plan unit tests...');

  // Test 1: repinContent rewrites only the pin
  {
    const before = [
      '---',
      'level: 3',
      'title: "Video 0"',
      'parent_spec:',
      '  name: "coNNtent_V_0-14-1"',
      `  url: "${URL_OLD}"`,
      '---',
      '',
      '## NN Video: v00',
      '',
    ].join('\n');
    const after = repinContent(before, 'coNNtent', 'V_0-15-0');
    assert.ok(after.includes('name: "coNNtent_V_0-15-0"'), after);
    assert.ok(after.includes('coNNtent_V_0-15-0_NN.md'), after);
    assert.ok(after.includes('## NN Video: v00'), 'the body is untouched');
    assert.ok(after.includes('title: "Video 0"'), 'the title is untouched');
    console.log('✔ repinContent rewrites the pin and nothing else');
  }

  // Test 2: no consent, no writes
  {
    const ws = buildDomain(3);
    try {
      const plan = upgrade.planUpgrade(ws, CATALOG);
      const before = readAll(ws);
      const result = applyUpgradePlan({ workspaceDir: ws, catalog: CATALOG, plan });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, 'CONSENT_REQUIRED');
      assert.strictEqual(result.models, 3, 'the refusal states the model count');
      assert.deepStrictEqual(readAll(ws), before, 'no file is written before consent');
      console.log('✔ nothing is written before consent, and consent names the count');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
    }
  }

  // Test 3: a stale plan aborts with no writes
  {
    const ws = buildDomain(3);
    try {
      const plan = upgrade.planUpgrade(ws, CATALOG);
      // A model added between planning and applying.
      const extra = path.join(ws, 'series', 'villa', 'assets', 'v99')
      fs.mkdirSync(extra, { recursive: true })
      fs.writeFileSync(
        path.join(extra, 'v99_coNNtent_NN.md'),
        fs.readFileSync(path.join(ws, 'series', 'villa', 'assets', 'v00', 'v00_coNNtent_NN.md'), 'utf-8'),
        'utf-8',
      );
      const result = applyUpgradePlan({
        workspaceDir: ws,
        catalog: CATALOG,
        plan,
        consent: true,
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, 'PLAN_STALE');
      assert.ok(readAll(ws).every(([, content]) => content.includes('V_0-14-1')), 'no write happened');
      console.log('✔ a plan the workspace outgrew aborts before writing');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true })
    }
  }

  // Test 4: 24 instances repin together, and the mapping is asked ONCE
  {
    const ws = buildDomain(24);
    const backupTarget = path.join(os.tmpdir(), `apply-plan-backup-${process.pid}`);
    try {
      const plan = upgrade.planUpgrade(ws, CATALOG);
      assert.strictEqual(plan.units[0].count, 24);
      let asked = 0;
      const result = applyUpgradePlan({
        workspaceDir: ws,
        catalog: CATALOG,
        plan,
        consent: true,
        backupTarget,
        concepts: ['Video'],
        onMapping: (concepts) => {
          asked++;
          assert.deepStrictEqual(concepts, ['Video']);
          return { Video: 'Clip' };
        },
      });
      assert.strictEqual(result.ok, true, JSON.stringify(result));
      assert.strictEqual(result.written, 24);
      assert.strictEqual(asked, 1, 'one mapping question for the whole unit');
      const contents = readAll(ws);
      assert.strictEqual(contents.length, 24);
      assert.ok(contents.every(([, c]) => c.includes('coNNtent_V_0-15-0')), 'every pin moved');
      assert.ok(contents.every(([, c]) => c.includes('## NN Clip:')), 'the one answer reached all 24');
      assert.ok(fs.existsSync(path.join(backupTarget, 'manifest.sha256')), 'a backup precedes the writes');
      console.log('✔ 24 instances repin as one unit and the mapping is asked once');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(backupTarget, { recursive: true, force: true });
    }
  }

  // Test 5: all-or-none - one failing member restores all 24 and names it
  {
    const ws = buildDomain(24);
    const backupTarget = path.join(os.tmpdir(), `apply-plan-backup-fail-${process.pid}`);
    try {
      const plan = upgrade.planUpgrade(ws, CATALOG);
      const before = readAll(ws);
      const failingRel = 'series/villa/assets/v13/v13_coNNtent_NN.md';
      const result = applyUpgradePlan({
        workspaceDir: ws,
        catalog: CATALOG,
        plan,
        consent: true,
        backupTarget,
        validate: (abs) => {
          if (abs.endsWith(path.join('v13', 'v13_coNNtent_NN.md'))) return false;
          return true;
        },
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, 'UNIT_REVALIDATION_FAILED');
      assert.strictEqual(result.rolledBack, 24, 'every member is restored, not just the unit');
      assert.strictEqual(result.failing.length, 1);
      assert.ok(result.failing[0].path.includes(failingRel), JSON.stringify(result.failing));
      assert.deepStrictEqual(readAll(ws), before, 'the workspace is byte-identical after the rollback');
      console.log('✔ one member failing re-validation restores all 24 and names the failing model');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(backupTarget, { recursive: true, force: true });
    }
  }

  console.log('All apply-upgrade-plan tests passed successfully!\n');
}

runTests();
