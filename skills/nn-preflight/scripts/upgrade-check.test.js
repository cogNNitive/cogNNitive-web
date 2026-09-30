#!/usr/bin/env node

/**
 * skills/nn-preflight/scripts/upgrade-check.test.js
 *
 * Unit tests for upgrade-check.js. Zero external test framework dependencies
 * (runs with plain node), matching preflight-check.test.js.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');
const {
  gapKind,
  compareVersions,
  parsePinnedUrl,
  discoverModels,
  scanWorkspaceUpgrades,
} = require('./upgrade-check');

const script = path.join(__dirname, 'upgrade-check.js');

function runScriptAsync(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [script, ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

const CATALOG = {
  blueprints: {
    business: {
      name: 'business',
      adopted: 'V_0-2-0',
      versions: [
        { blueprint_version: 'V_0-1-0' },
        { blueprint_version: 'V_0-2-0' },
      ],
    },
  },
};

function buildWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-ws-'));
  fs.mkdirSync(path.join(ws, 'models'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'sources', 'nn'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'node_modules', 'pkg'), { recursive: true });
  const model = (file, url) => {
    fs.writeFileSync(path.join(ws, file), `---\nlevel: 3\nparent_spec:\n  name: "x"\n  url: "${url}"\nknowledge_version: "V_0-1-0"\n---\n# NN x\n`, 'utf-8');
  };
  model('models/Old_V_0-1-0_business_NN.md', 'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/business_V_0-1-0_NN.md');
  model('models/Current_V_0-2-0_business_NN.md', 'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/business_V_0-2-0_NN.md');
  model('models/Ahead_V_0-3-0_business_NN.md', 'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/business_V_0-3-0_NN.md');
  model('models/Custom_V_0-1-0_my_spec_NN.md', 'https://raw.githubusercontent.com/user/repo/main/specs/Custom_V_0-1-0_my_spec_NN.md');
  // Non-model files that must be ignored:
  fs.writeFileSync(path.join(ws, 'models', 'index.md'), '# nope');
  fs.writeFileSync(path.join(ws, 'node_modules', 'pkg', 'X_V_0-1-0_business_NN.md'), '---\nlevel: 3\nparent_spec:\n  name: "x"\n  url: "https://x/business_V_0-1-0_NN.md"\n---\n');
  fs.writeFileSync(path.join(ws, 'sources', 'nn', 'Y_V_0-1-0_business_NN.md'), '---\nlevel: 3\nparent_spec:\n  name: "x"\n  url: "https://x/business_V_0-1-0_NN.md"\n---\n');
  return ws;
}

async function runTests() {
  console.log('Running upgrade-check unit tests...');

  // Test 1: gapKind + compareVersions
  {
    assert.strictEqual(gapKind('V_0-1-0', 'V_0-2-0'), 'minor', '0.1 -> 0.2 is a minor gap (major digit unchanged)');
    assert.strictEqual(gapKind('V_0-1-0', 'V_0-1-1'), 'patch');
    assert.strictEqual(gapKind('V_1-0-0', 'V_1-1-0'), 'minor');
    assert.strictEqual(gapKind('V_0-1-0', 'V_1-0-0'), 'major');
    assert.strictEqual(gapKind('V_0-2-0', 'V_0-2-0'), 'same');
    assert.strictEqual(compareVersions('V_0-2-0', 'V_0-1-0'), 1);
    assert.strictEqual(compareVersions('V_0-10-0', 'V_0-9-0'), 1, 'numeric, not lexical');
    assert.strictEqual(compareVersions('V_0-1-0', 'V_0-2-0'), -1);
    console.log('✔ gapKind/compareVersions classify SemVer gaps numerically');
  }

  // Test 2: parsePinnedUrl handles flat + package layouts
  {
    assert.deepStrictEqual(
      parsePinnedUrl('https://x/main/iNNfo/specs/bluepriNNts/business/business_V_0-2-0_NN.md'),
      { name: 'business', version: 'V_0-2-0' },
    );
    assert.deepStrictEqual(
      parsePinnedUrl('https://x/main/iNNfo/specs/bluepriNNts/workspace_V_0-3-0_spec_NN.md'),
      { name: 'workspace', version: 'V_0-3-0' },
    );
    assert.deepStrictEqual(
      parsePinnedUrl('https://x/main/iNNfo/specs/bluepriNNts/documentation/V_0-2-0/spec_NN.md'),
      { name: 'documentation', version: 'V_0-2-0' },
    );
    assert.strictEqual(parsePinnedUrl('https://x/specs/Custom_V_0-1-0_my_spec_NN.md'), null);
    assert.strictEqual(parsePinnedUrl('https://x/specs/workspace_spec_NN.md'), null);
    console.log('✔ parsePinnedUrl resolves flat, package, and non-canonical URLs');
  }

  // Test 3: discoverModels filters to level-3, skips noise dirs
  {
    const ws = buildWorkspace();
    try {
      const models = discoverModels(ws);
      const rels = models.map((m) => m.rel).sort();
      assert.strictEqual(models.length, 4, 'node_modules and sources must be skipped');
      assert.deepStrictEqual(rels, [
        'models/Ahead_V_0-3-0_business_NN.md',
        'models/Current_V_0-2-0_business_NN.md',
        'models/Custom_V_0-1-0_my_spec_NN.md',
        'models/Old_V_0-1-0_business_NN.md',
      ]);
      console.log('✔ discoverModels finds only level-3 models outside noise dirs');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
    }
  }

  // Test 4: scanWorkspaceUpgrades classification
  {
    const ws = buildWorkspace();
    try {
      const result = scanWorkspaceUpgrades(ws, CATALOG);
      assert.strictEqual(result.summary.modelsScanned, 4);
      assert.strictEqual(result.summary.current, 1);
      assert.strictEqual(result.summary.upgradeAvailable, 1);
      assert.strictEqual(result.summary.ahead, 1);
      assert.strictEqual(result.summary.unlisted, 1);

      const byRel = Object.fromEntries(result.items.map((i) => [i.name, i]));
      const old = byRel['models/Old_V_0-1-0_business_NN.md'];
      assert.strictEqual(old.status, 'upgrade-available');
      assert.strictEqual(old.kind, 'minor');
      assert.strictEqual(old.adopted, 'V_0-2-0');

      assert.strictEqual(byRel['models/Current_V_0-2-0_business_NN.md'].status, 'current');
      assert.strictEqual(byRel['models/Ahead_V_0-3-0_business_NN.md'].status, 'ahead');
      assert.strictEqual(byRel['models/Custom_V_0-1-0_my_spec_NN.md'].status, 'unlisted');
      console.log('✔ scanWorkspaceUpgrades classifies current/upgrade/ahead/unlisted');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
    }
  }

  // Test 5: unpinned model reported without a parent url
  {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-unpinned-'));
    try {
      fs.mkdirSync(path.join(ws, 'models'), { recursive: true });
      fs.writeFileSync(path.join(ws, 'models', 'NoRef_V_0-1-0_business_NN.md'), '---\nlevel: 3\nknowledge_version: "V_0-1-0"\n---\n');
      const result = scanWorkspaceUpgrades(ws, CATALOG);
      assert.strictEqual(result.summary.unpinned, 1);
      assert.strictEqual(result.items[0].status, 'unpinned');
      console.log('✔ unpinned models are reported, not classified');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
    }
  }

  // Test 6: CLI mode with --json
  {
    const ws = buildWorkspace();
    const catalogFile = path.join(os.tmpdir(), `catalog-${process.pid}.json`);
    fs.writeFileSync(catalogFile, JSON.stringify(CATALOG));
    try {
      const res = await runScriptAsync(['--workspace-dir', ws, '--catalog-file', catalogFile, '--json']);
      assert.strictEqual(res.status, 0, res.stderr);
      const parsed = JSON.parse(res.stdout);
      assert.strictEqual(parsed.summary.upgradeAvailable, 1);
      console.log('✔ CLI emits a JSON classification report');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(catalogFile, { force: true });
    }
  }

  console.log('All upgrade-check tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});