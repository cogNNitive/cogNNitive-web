const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const guards = require('../../scripts/lib/duplicate-guards');

function run() {
  let passed = 0;
  let failed = 0;

  function ok(actual, msg) {
    try {
      assert.ok(actual);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg}`);
      failed++;
    }
  }

  function eq(actual, expected, msg) {
    try {
      assert.strictEqual(actual, expected);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
      failed++;
    }
  }

  console.log('test-duplicate-body-hash: Content-Based Normalized Body Deduplication');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'body-dup-test-'));
  try {
    const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
    const seed = (rel, bytes, body) => {
      const raw = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(raw), { recursive: true });
      fs.writeFileSync(raw, bytes);
      fs.writeFileSync(
        `${raw}_sidecar_NN.md`,
        `---\nlevel: 3\nparent_spec:\n  name: sidecar\nsource_file: ${rel}\nsha256: ${sha(bytes)}\nsize_bytes: ${bytes.length}\nnormalized_at: 2026-10-02T10:15:00Z\n---\n\n${body}\n`,
      );
    };

    // Two different binaries (different raw bytes) whose sidecars carry an identical normalized body.
    const bodyText = '# Tutoring Sessions Summary\n\nAll session records for CRL-10.\n* Session 1: 20/04/2026\n* Session 2: 25/04/2026';
    seed('sources/import/CRL-10_2026-07.xls', Buffer.from('xls-bytes-one'), bodyText);
    seed('sources/import/Backups/CRL-10 copy.xlsx', Buffer.from('xlsx-bytes-two'), bodyText);

    const index = guards.indexWorkspaceSources(tmpDir);
    eq(index.sources.length, 2, 'Discovered both raw files through their sidecars');
    eq(index.canonicalSources.length, 1, 'Grouped identical sidecar bodies into 1 canonical source');
    eq(index.aliases.length, 1, 'Flagged duplicate body as 1 alias');

    const canon = index.canonicalSources[0];
    eq(canon.aliases.length, 1, 'The canonical source lists the duplicate as its alias');
    ok(
      canon.aliases.includes('sources/import/CRL-10_2026-07.xls') || canon.aliases.includes('sources/import/Backups/CRL-10 copy.xlsx'),
      'Alias list contains the other raw file',
    );

    // detectDuplicates compares normalized bodies, ignoring frontmatter.
    const incomingFile = path.join(tmpDir, 'incoming.md');
    const sidecarA = path.join(tmpDir, 'sources/import/CRL-10_2026-07.xls_sidecar_NN.md');
    const sidecarB = path.join(tmpDir, 'sources/import/Backups/CRL-10 copy.xlsx_sidecar_NN.md');
    fs.writeFileSync(incomingFile, fs.readFileSync(sidecarA, 'utf8'), 'utf8');
    const dupResult = guards.detectDuplicates(incomingFile, [{ path: sidecarB }]);
    eq(dupResult.exact.length, 1, 'detectDuplicates detected exact duplicate despite different raw hashes');
    eq(dupResult.exact[0], sidecarB, 'Identified the other sidecar as exact duplicate match by body');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const result = run();
  process.exit(result.failed > 0 ? 1 : 0);
}
