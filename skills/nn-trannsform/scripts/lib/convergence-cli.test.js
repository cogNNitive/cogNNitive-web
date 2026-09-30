#!/usr/bin/env node
/**
 * convergence-cli.test.js — end-to-end tests for `nn-trannsform --converge`.
 *
 * Spawns the real CLI against a disposable workspace and asserts the read-only
 * proposal contract, key validation, idempotence, and the no-source-writes
 * guarantee. Zero external dependencies.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const INDEX = path.join(__dirname, '..', 'index.js');

const FROM_CSV = 'video_id,views\nabc,100\ndef,200\nghi,300\n';
const TO_CSV = 'video_id,views\nabc,150\ndef,200\njkl,400\n';

function write(rel, content) {
  const full = path.join(CURRENT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function cli(args) {
  return spawnSync('node', [INDEX, ...args], { encoding: 'utf8' });
}

let CURRENT = '';

function testConvergeProposal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-cli-'));
  CURRENT = dir;
  try {
    write(
      'domaiNN_NN.md',
      [
        '---',
        'level: 3',
        '---',
        '',
        '# NN kNNowledge',
        '',
        '## NN Source Family: youtube_monthly',
        'strategy:: upsert',
        'key:: video_id',
        '',
      ].join('\n'),
    );
    const fromPath = write('sources/nn/import/youtube_monthly_20260101-000000.csv', FROM_CSV);
    const toPath = write('sources/nn/import/youtube_monthly_20260201-000000.csv', TO_CSV);

    const beforeFrom = fs.readFileSync(fromPath);
    const beforeTo = fs.readFileSync(toPath);

    const run = cli(['--converge', 'youtube_monthly', '--src', dir, '--json']);
    assert.strictEqual(run.status, 0, run.stderr);
    const proposal = JSON.parse(run.stdout);
    assert.strictEqual(proposal.empty, false);
    assert.deepStrictEqual(proposal.added, [{ key: 'jkl', fields: { views: '400' } }]);
    assert.deepStrictEqual(proposal.changed, [{ key: 'abc', field: 'views', from: '100', to: '150' }]);
    assert.deepStrictEqual(proposal.removed, [{ key: 'ghi' }]);

    // Read-only guarantee: sources are byte-unchanged.
    assert.ok(fs.readFileSync(fromPath).equals(beforeFrom), 'from snapshot unchanged');
    assert.ok(fs.readFileSync(toPath).equals(beforeTo), 'to snapshot unchanged');

    // Idempotence: mark applied -> empty proposal.
    const mark = cli(['--converge-mark', 'youtube_monthly', '--version', 'V_0-2-0', '--src', dir]);
    assert.strictEqual(mark.status, 0, mark.stderr);
    const second = cli(['--converge', 'youtube_monthly', '--src', dir, '--json']);
    assert.strictEqual(second.status, 0, second.stderr);
    assert.strictEqual(JSON.parse(second.stdout).empty, true);
    console.log('PASS: converge proposal + read-only + idempotence');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testInvalidKeyAborts() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-cli-key-'));
  CURRENT = dir;
  try {
    write('domaiNN_NN.md', '## NN Source Family: fam\nstrategy:: upsert\nkey:: missing_col\n');
    write('sources/nn/import/fam_20260101-000000.csv', FROM_CSV);
    write('sources/nn/import/fam_20260201-000000.csv', TO_CSV);
    const run = cli(['--converge', 'fam', '--src', dir, '--json']);
    assert.strictEqual(run.status, 1, 'invalid key exits non-zero');
    assert.match(run.stderr, /Invalid convergence key/);
    console.log('PASS: invalid key aborts with non-zero exit');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testCiteOnlyEmitsNothing() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-cli-cite-'));
  CURRENT = dir;
  try {
    write('domaiNN_NN.md', '## NN Source Family: prose\nstrategy:: cite-only\n');
    write('sources/nn/import/prose_20260101-000000.csv', FROM_CSV);
    write('sources/nn/import/prose_20260201-000000.csv', TO_CSV);
    const run = cli(['--converge', 'prose', '--src', dir, '--json']);
    assert.strictEqual(run.status, 0, run.stderr);
    const proposal = JSON.parse(run.stdout);
    assert.strictEqual(proposal.empty, true);
    assert.strictEqual(proposal.reason, 'cite-only');
    console.log('PASS: cite-only emits nothing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runAll() {
  try {
    testConvergeProposal();
    testInvalidKeyAborts();
    testCiteOnlyEmitsNothing();
    console.log('\nAll convergence-cli tests passed.');
  } catch (err) {
    console.error(`\nconvergence-cli tests FAILED: ${err.message}`);
    process.exit(1);
  }
}

runAll();
