const assert = require('assert');
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
    const nnDir = path.join(tmpDir, 'sources', 'nn', 'import');
    fs.mkdirSync(nnDir, { recursive: true });

    // Two files with completely different raw_filename and different frontmatter raw sha256,
    // but identical markdown body
    const bodyText = '# Tutoring Sessions Summary\n\nAll session records for CRL-10.\n* Session 1: 20/04/2026\n* Session 2: 25/04/2026';

    const file1 = path.join(nnDir, 'CRL-10_2026-07.md');
    const file2 = path.join(nnDir, 'CRL-10_Backup.md');

    const content1 = `---\nsource_file: "sources/import/CRL-10 2026-07 YTD tutorías.xls"\nsha256: "1111111111111111111111111111111111111111111111111111111111111111"\n---\n${bodyText}`;
    const content2 = `---\nsource_file: "sources/import/Backups/CRL-10 copy.xls"\nsha256: "2222222222222222222222222222222222222222222222222222222222222222"\n---\n${bodyText}`;

    fs.writeFileSync(file1, content1, 'utf8');
    fs.writeFileSync(file2, content2, 'utf8');

    // 1. Test indexWorkspaceSources deduplication by body
    const index = guards.indexWorkspaceSources(tmpDir);
    eq(index.sources.length, 2, 'Discovered both normalized files');
    eq(index.canonicalSources.length, 1, 'Grouped identical bodies into 1 canonical source');
    eq(index.aliases.length, 1, 'Flagged duplicate body as 1 alias');

    const canon = index.canonicalSources[0];
    ok(canon.aliases.includes('sources/nn/import/CRL-10_Backup.md') || canon.aliases.includes('sources/nn/import/CRL-10_2026-07.md'), 'Alias list contains the duplicate file');

    // 2. Test detectDuplicates with incoming file
    const incomingFile = path.join(tmpDir, 'incoming.md');
    fs.writeFileSync(incomingFile, content1, 'utf8');

    const corpus = [
      { path: file2 }
    ];
    const dupResult = guards.detectDuplicates(incomingFile, corpus);
    eq(dupResult.exact.length, 1, 'detectDuplicates detected exact duplicate despite different raw hashes');
    eq(dupResult.exact[0], file2, 'Identified file2 as exact duplicate match by body');
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
