'use strict';

/**
 * Producer payloads (change-provenance A9 / apc: Producers emit ready payloads).
 *
 * A producer that writes an artifact prints a ready `propose_changeset` payload
 * with exactly one `produce_artifact` change and applies nothing. A read-only
 * command (`--scan`, cognitivize, import) emits no payload.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const INDEX = path.join(__dirname, '..', '..', 'scripts', 'index.js');

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}`);
  }
}

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label} (expected ${e}, got ${a})`);
  }
}

/** Extracts the JSON block that follows the producer marker, or null. */
function payloadOf(stdout) {
  const marker = 'propose_changeset payload (produce_artifact):';
  const at = stdout.indexOf(marker);
  if (at === -1) return null;
  const rest = stdout.slice(at + marker.length);
  const start = rest.indexOf('{');
  let depth = 0;
  for (let i = start; i < rest.length; i++) {
    if (rest[i] === '{') depth++;
    else if (rest[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(rest.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-producer-payload-'));
  fs.mkdirSync(path.join(root, 'sources', 'import'), { recursive: true });
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '---\nlevel: 3\n---\n\n# NN index\n');
  fs.writeFileSync(path.join(root, 'sources', 'import', 'views.csv'), 'video_id,views\nabc,100\ndef,200\n');
  return root;
}

function cli(root, args) {
  return spawnSync('node', [INDEX, ...args], { encoding: 'utf8', cwd: root });
}

function changesetsOf(root) {
  const dir = path.join(root, 'changes');
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

async function run() {
  console.log('\n\t-- Producer payloads --');

  const root = workspace();
  try {
    const curated = cli(root, ['--curate-csv', 'sources/import/views.csv', '--key', 'video_id']);
    const payload = payloadOf(curated.stdout || '');
    ok(payload, 'curate-csv prints a marked propose_changeset payload');
    eq(payload && payload.tool, 'propose_changeset', 'payload names propose_changeset');
    const operations = (payload && payload.arguments && payload.arguments.operations) || [];
    eq(operations.length, 1, 'exactly one operation');
    eq(operations[0] && operations[0].op, 'produce_artifact', 'the operation is produce_artifact');
    ok(
      operations[0] && /^artifacts\/curated\/views/.test(operations[0].target),
      'target is the curated artifact',
    );
    eq(operations[0] && operations[0].author, 'curate-csv', 'author is the procedure');
    eq(changesetsOf(root), [], 'nothing was applied (no changeset written)');

    const scan = cli(root, ['--scan']);
    ok(!payloadOf(scan.stdout || ''), '--scan emits no producer payload');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };
