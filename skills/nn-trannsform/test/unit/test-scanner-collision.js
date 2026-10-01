const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const core = require('../../scripts/lib/scanner-core');

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

  console.log('test-scanner-collision: Destination Collision Guard');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collision-test-'));
  try {
    const sourcesDir = path.join(tmpDir, 'sources');
    const importDir = path.join(sourcesDir, 'import');
    const nnDir = path.join(sourcesDir, 'nn');
    const madDir = path.join(importDir, 'MAD-11');
    const virDir = path.join(importDir, 'VIR-3');

    fs.mkdirSync(madDir, { recursive: true });
    fs.mkdirSync(virDir, { recursive: true });
    fs.mkdirSync(nnDir, { recursive: true });

    const madRaw = path.join(madDir, 'Tutorias.txt');
    const virRaw = path.join(virDir, 'Tutorias.txt');

    fs.writeFileSync(madRaw, 'MAD-11 Tutoring Session Data 2026-07', 'utf8');
    fs.writeFileSync(virRaw, 'VIR-3 Tutoring Session Data 2026-09', 'utf8');

    const destPath = path.join(nnDir, 'import', 'Tutorias.md');
    const displayOutPath = 'import/Tutorias.md';

    // 1. Ingest MAD-11 into import/Tutorias.md
    const entry1 = core.processOkFile(
      '.txt',
      madRaw,
      'sources/import/MAD-11/Tutorias.txt',
      destPath,
      displayOutPath,
      true,
      {}
    );

    eq(entry1.outcome, 'processed', 'First raw file processed successfully');
    ok(fs.existsSync(destPath), 'Destination normalized file created');
    const destContent1 = fs.readFileSync(destPath, 'utf8');
    ok(destContent1.includes('sources/import/MAD-11/Tutorias.txt'), 'Frontmatter records MAD-11 as source_file');
    ok(destContent1.includes('MAD-11 Tutoring Session Data'), 'Body contains MAD-11 data');

    // 2. Attempt to ingest colliding VIR-3 into the same destination
    const entry2 = core.processOkFile(
      '.txt',
      virRaw,
      'sources/import/VIR-3/Tutorias.txt',
      destPath,
      displayOutPath,
      true,
      {}
    );

    eq(entry2.outcome, 'failed', 'Colliding raw rejected with failed outcome');
    eq(entry2.status, '❌ Collision', 'Status is collision');
    eq(entry2.collision, true, 'Collision flag is true');
    eq(entry2.existingSource, 'sources/import/MAD-11/Tutorias.txt', 'Names existing owner source');
    eq(entry2.incomingSource, 'sources/import/VIR-3/Tutorias.txt', 'Names incoming colliding source');

    // Verify destination was NOT overwritten
    const destContentAfterCollision = fs.readFileSync(destPath, 'utf8');
    ok(destContentAfterCollision.includes('MAD-11 Tutoring Session Data'), 'Destination content was preserved intact');
    ok(!destContentAfterCollision.includes('VIR-3'), 'Colliding VIR-3 content was NOT written');

    // 3. Update MAD-11 with new data (same source_file, different hash)
    fs.writeFileSync(madRaw, 'MAD-11 Tutoring Session Data 2026-07 (Updated)', 'utf8');
    const entry3 = core.processOkFile(
      '.txt',
      madRaw,
      'sources/import/MAD-11/Tutorias.txt',
      destPath,
      displayOutPath,
      true,
      {}
    );

    eq(entry3.outcome, 'processed', 'Same source_file updating content processes successfully');
    const destContentUpdated = fs.readFileSync(destPath, 'utf8');
    ok(destContentUpdated.includes('(Updated)'), 'Updated content written to destination');

    // 4. Same unchanged file returns up to date
    const entry4 = core.processOkFile(
      '.txt',
      madRaw,
      'sources/import/MAD-11/Tutorias.txt',
      destPath,
      displayOutPath,
      true,
      {}
    );
    eq(entry4.outcome, 'processed', 'Unchanged file processed');
    ok(entry4.action.includes('Already up to date'), 'Unchanged file reported up to date');
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
