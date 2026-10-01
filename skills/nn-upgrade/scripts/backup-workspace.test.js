#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/backup-workspace.test.js
 *
 * Unit tests for backup-workspace.js. Zero external test framework deps.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { backupWorkspace, isInside } = require('./backup-workspace');

function buildWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-ws-'));
  fs.mkdirSync(path.join(ws, 'models'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'sources', 'nn'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'procedures'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'models', 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'models', 'A_V_0-1-0_business_NN.md'), '# model');
  fs.writeFileSync(path.join(ws, 'models', 'node_modules', 'X.md'), '# noise');
  fs.writeFileSync(path.join(ws, 'specs', 'business_V_0-2-0_NN.md'), '# spec');
  fs.writeFileSync(path.join(ws, 'sources', 'nn', 'doc.md'), '# norm');
  fs.writeFileSync(path.join(ws, 'domaiNN_NN.md'), '# domain root');
  fs.writeFileSync(path.join(ws, 'workspace_NN.md'), '# legacy root');
  fs.writeFileSync(path.join(ws, 'index.md'), '# index');
  fs.writeFileSync(path.join(ws, 'backups', 'old.zip'), 'junk');
  return ws;
}

async function runTests() {
  console.log('Running backup-workspace unit tests...');

  // Test 1: real backup copies full tree including root docs outside the workspace
  {
    const ws = buildWorkspace();
    const target = path.join(path.dirname(ws), `backup-test-${Date.now()}`);
    try {
      const manifest = backupWorkspace(ws, { target });
      assert.ok(manifest.files.includes('domaiNN_NN.md'), 'domaiNN_NN.md in manifest');
      assert.ok(manifest.files.includes('workspace_NN.md'), 'workspace_NN.md in manifest');
      assert.ok(manifest.files.includes('models/A_V_0-1-0_business_NN.md'), 'model in manifest');
      assert.ok(fs.existsSync(path.join(target, 'domaiNN_NN.md')), 'domaiNN_NN.md copied');
      assert.ok(fs.existsSync(path.join(target, 'workspace_NN.md')), 'workspace_NN.md copied');
      assert.ok(fs.existsSync(path.join(target, 'models', 'A_V_0-1-0_business_NN.md')), 'model copied');
      assert.ok(fs.existsSync(path.join(target, 'manifest.sha256')), 'manifest.sha256 generated');
      assert.ok(!fs.existsSync(path.join(target, 'models', 'node_modules')), 'noise dir skipped');
      assert.ok(!fs.existsSync(path.join(target, 'backups')), 'backups dir skipped');
      console.log('✔ backup copies full tree including root docs and skips noise');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  }

  // Test 2: minimal workspace
  {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-min-'));
    const target = path.join(path.dirname(ws), `backup-min-${Date.now()}`);
    try {
      fs.writeFileSync(path.join(ws, 'domaiNN_NN.md'), '# root');
      const manifest = backupWorkspace(ws, { target });
      assert.strictEqual(manifest.files.length, 1);
      assert.ok(fs.existsSync(path.join(target, 'domaiNN_NN.md')));
      console.log('✔ minimal workspace with root document backed up successfully');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  }

  // Test 3: dry-run writes nothing
  {
    const ws = buildWorkspace();
    const target = path.join(path.dirname(ws), `backup-dry-${Date.now()}`);
    try {
      const manifest = backupWorkspace(ws, { target, dryRun: true });
      assert.ok(manifest.files.length > 0, 'dry-run reports the file list');
      assert.ok(!fs.existsSync(target), 'dry-run creates nothing');
      console.log('✔ dry-run reports without creating anything');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  }

  // Test 4: target inside the workspace is rejected
  {
    const ws = buildWorkspace();
    try {
      assert.throws(() => backupWorkspace(ws, { target: path.join(ws, 'backups') }), /outside the workspace/);
      assert.throws(() => backupWorkspace(ws, { target: ws }), /outside the workspace/);
      console.log('✔ in-workspace backup targets are rejected');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
    }
  }

  // Test 5: isInside helper
  {
    assert.strictEqual(isInside('C:/a/b/c', 'C:/a/b'), true);
    assert.strictEqual(isInside('C:/a', 'C:/a'), true);
    assert.strictEqual(isInside('C:/a/b', 'C:/a/b/c'), false);
    console.log('✔ isInside enforces containment');
  }

  // Test 6: custom skipDirs option
  {
    const ws = buildWorkspace();
    fs.mkdirSync(path.join(ws, 'models', 'archive'), { recursive: true });
    fs.writeFileSync(path.join(ws, 'models', 'archive', 'x.md'), '# archived model');
    const target = path.join(path.dirname(ws), `backup-skipdirs-${Date.now()}`);
    try {
      const manifest = backupWorkspace(ws, {
        target,
        skipDirs: new Set(['.git', 'node_modules']),
      });
      assert.ok(manifest.files.includes('models/archive/x.md'), 'models/archive/x.md included with custom skipDirs');
      assert.ok(fs.existsSync(path.join(target, 'models', 'archive', 'x.md')));
      console.log('✔ custom skipDirs preserves archive/backups directories when configured');
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  }

  console.log('All backup-workspace tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});