'use strict';

/**
 * S4a gate (change-provenance: the record is deleted; replacement before
 * deletion).
 *
 * The nn-sources CLI no longer has a lineage record: the three record flags are
 * unknown options, no command refreshes a record, the record/provenance modules
 * are gone, and the watch-root machinery (scanner, digest) is deleted.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const INDEX = path.join(__dirname, '..', '..', 'scripts', 'index.js');
const LIB = path.join(__dirname, '..', '..', 'scripts');
const watchDigestStore = require('../../scripts/lib/watch-digest-store');

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

function cli(root, args) {
  return spawnSync('node', [INDEX, ...args], { encoding: 'utf8', cwd: root });
}

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-s4a-'));
  fs.mkdirSync(path.join(root, 'sources', 'import'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'domaiNN_NN.md'),
    '---\nlevel: 3\n---\n\n# NN index\n',
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'sources', 'import', 'a.txt'), 'hello\n', 'utf8');
  return root;
}

async function run() {
  console.log('\n\t-- S4a: the record is gone --');

  ok(!fs.existsSync(path.join(LIB, 'provenance.js')), 'scripts/provenance.js is deleted');
  ok(!fs.existsSync(path.join(LIB, 'lib', 'lineage-check.js')), 'lib/lineage-check.js is deleted');
  ok(
    !fs.existsSync(path.join(LIB, 'lib', 'provenance-knowledge.js')),
    'lib/provenance-knowledge.js is deleted',
  );

  const root = workspace();
  try {
    for (const flag of ['--lineage', '--provenance', '--check']) {
      const run = cli(root, [flag]);
      const combined = (run.stdout || '') + (run.stderr || '');
      ok(
        run.status !== 0 || /unknown|not found|Usage/i.test(combined),
        `${flag} is not a recognised command`,
      );
    }

    // No command writes a record any more.
    cli(root, ['--scan']);
    cli(root, ['--cognitivize', 'sources/import/a.txt']);
    const records = fs
      .readdirSync(root)
      .filter((name) => /_cogNNitive_NN\.md$/i.test(name));
    ok(records.length === 0, 'no lineage record is written by --scan or --cognitivize');

    // The watch-root machinery is gone; only the convergence state I/O survives.
    ok(!fs.existsSync(path.join(LIB, 'lib', 'external-scanner.js')), 'lib/external-scanner.js is deleted');
    ok(
      ['decide', 'buildDigest', 'findItemByKey', 'digestKey'].every((fn) => watchDigestStore[fn] === undefined),
      'the watch digest functions are deleted',
    );
    for (const flag of ['--scan-external', '--watch-digest', '--digest-decide']) {
      const run = cli(root, [flag]);
      ok(run.status !== 0 && /unknown option/i.test(run.stderr), flag + ' is an unknown option');
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };
