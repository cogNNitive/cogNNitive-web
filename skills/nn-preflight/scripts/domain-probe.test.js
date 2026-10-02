/**
 * skills/nn-preflight/scripts/domain-probe.test.js
 *
 * Unit and integration tests for domain-probe.js covering P1–P5.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { runProbe } = require('./domain-probe');

async function runTests() {
  console.log('Running domain-probe unit tests...');
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✔ ${name}`);
      passed++;
    } catch (err) {
      console.error(`✖ ${name}`);
      console.error(err);
      failed++;
    }
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-probe-test-'));

  try {
    await test('probes an empty workspace cleanly', async () => {
      const ws = path.join(tmpDir, 'empty-ws');
      fs.mkdirSync(ws, { recursive: true });
      const res = await runProbe({ workspaceDir: ws, skipPreflight: true });
      assert.strictEqual(res.version, '1.0.0');
      assert.strictEqual(res.knowledge.count, 0);
      assert.strictEqual(res.sources.pending_count, 0);
      assert.strictEqual(res.procedures.domain_count, 0);
      assert.strictEqual(res.procedures.blueprint_count, 0);
    });

    await test('computes pending sources via hash comparison (P2)', async () => {
      const ws = path.join(tmpDir, 'sources-ws');
      fs.mkdirSync(path.join(ws, 'sources', 'import'), { recursive: true });
      fs.mkdirSync(path.join(ws, 'sources', 'nn'), { recursive: true });
      fs.mkdirSync(path.join(ws, 'kNNowledge'), { recursive: true });

      const rawContent = 'Hello raw content';
      const rawHash = crypto.createHash('sha256').update(rawContent).digest('hex');
      const rawFile = path.join(ws, 'sources', 'import', 'doc.txt');
      fs.writeFileSync(rawFile, rawContent);

      // Unnormalized: no sources/nn counterpart
      let res = await runProbe({ workspaceDir: ws, skipPreflight: true });
      assert.strictEqual(res.sources.pending_count, 1, 'Expected 1 pending unnormalized source');

      // Normalized with matching sha256
      const normFile = path.join(ws, 'sources', 'nn', 'doc.md');
      fs.writeFileSync(
        normFile,
        `---\nsource_file: sources/import/doc.txt\nsha256: ${rawHash}\n---\n# Normalized\n`,
      );

      res = await runProbe({ workspaceDir: ws, skipPreflight: true });
      assert.strictEqual(res.sources.pending_count, 0, 'Expected 0 pending sources after matching normalization');
    });

    await test('probes a canonical workspace layout with knowledge items and sources', async () => {
      const ws = path.join(tmpDir, 'canonical-ws');
      fs.mkdirSync(path.join(ws, 'kNNowledge'), { recursive: true });
      fs.mkdirSync(path.join(ws, 'sources', 'import'), { recursive: true });
      fs.mkdirSync(path.join(ws, 'procedures'), { recursive: true });
      fs.mkdirSync(path.join(ws, 'specs', 'bluepriNNts', 'bp1', 'procedures'), { recursive: true });

      fs.writeFileSync(path.join(ws, 'domaiNN_NN.md'), '---\nlevel: 3\n---\n');
      fs.writeFileSync(path.join(ws, 'kNNowledge', 'Item_V_1-0-0_NN.md'), '---\nlevel: 3\n---\n');
      fs.writeFileSync(path.join(ws, 'sources', 'import', 'doc.txt'), 'binary');
      fs.writeFileSync(path.join(ws, 'procedures', 'proc1.md'), '# Proc 1');
      fs.writeFileSync(path.join(ws, 'specs', 'bluepriNNts', 'bp1', 'procedures', 'bp_proc.md'), '# BP Proc');

      const res = await runProbe({ workspaceDir: ws, skipPreflight: true });
      assert.strictEqual(res.layout, 'current');
      assert.strictEqual(res.knowledge.count, 1);
      assert.deepStrictEqual(res.knowledge.items, ['Item_V_1-0-0_NN.md']);
      assert.strictEqual(res.sources.pending_count, 1);
      assert.strictEqual(res.procedures.domain_count, 1);
      assert.strictEqual(res.procedures.blueprint_count, 1);
    });

    await test('counts procedures in versioned blueprint packages (issue #106)', async () => {
      const ws = path.join(tmpDir, 'versioned-bp-ws');
      fs.mkdirSync(path.join(ws, 'specs', 'bluepriNNts', 'video', 'V_0-6-0', 'procedures'), { recursive: true });
      fs.mkdirSync(path.join(ws, 'specs', 'bluepriNNts', 'metrics', 'procedures'), { recursive: true });
      fs.writeFileSync(path.join(ws, 'specs', 'bluepriNNts', 'video', 'V_0-6-0', 'procedures', 'a.md'), '# A');
      fs.writeFileSync(path.join(ws, 'specs', 'bluepriNNts', 'video', 'V_0-6-0', 'procedures', 'b.md'), '# B');
      fs.writeFileSync(path.join(ws, 'specs', 'bluepriNNts', 'video', 'V_0-6-0', 'procedures', '.hidden.md'), '# X');
      fs.writeFileSync(path.join(ws, 'specs', 'bluepriNNts', 'metrics', 'procedures', 'c.md'), '# C');

      const res = await runProbe({ workspaceDir: ws, skipPreflight: true });
      assert.strictEqual(res.procedures.blueprint_count, 3, 'Expected flat + versioned procedures to be counted');
    });

    await test('detects legacy layout when models/ exists', async () => {
      const ws = path.join(tmpDir, 'legacy-ws');
      fs.mkdirSync(path.join(ws, 'models'), { recursive: true });
      fs.writeFileSync(path.join(ws, 'workspace_NN.md'), '---\nlevel: 3\n---\n');
      fs.writeFileSync(path.join(ws, 'models', 'Old_V_1-0-0_NN.md'), '---\nlevel: 3\n---\n');

      const res = await runProbe({ workspaceDir: ws, skipPreflight: true });
      assert.strictEqual(res.layout, 'legacy');
      assert.strictEqual(res.knowledge.count, 0, 'models/ is not counted as canonical kNNowledge (P5)');
    });

    await test('extracts preflight diagnostic warnings without drop (P1)', async () => {
      const ws = path.join(tmpDir, 'preflight-warn-ws');
      fs.mkdirSync(path.join(ws, 'sources', 'import'), { recursive: true });
      fs.mkdirSync(path.join(ws, 'kNNowledge'), { recursive: true });
      fs.writeFileSync(path.join(ws, 'sources', 'import', 'unnormalized.txt'), 'needs scan');

      const res = await runProbe({ workspaceDir: ws, skipPreflight: false, offline: true });
      assert.ok(res.preflight.warnings.length > 0, 'Expected preflight warnings to be captured (P1)');
      const unnorm = res.preflight.warnings.find((w) => w.type === 'source-integrity' || w.status === 'unnormalized');
      assert.ok(unnorm, 'Expected unnormalized source integrity warning in preflight.warnings');
    });

    console.log(`\nAll domain-probe tests finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
