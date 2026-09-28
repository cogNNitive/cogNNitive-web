#!/usr/bin/env node

/**
 * nn-trannsform — Test Runner
 *
 * Runs unit tests (Node assert, zero deps) and exits with code 0/1.
 *
 * Usage:
 *   node test/run.js              # run all tests
 *   node test/run.js unit         # unit tests only
 *   node test/run.js integration  # integration tests only
 */

const path = require('path');

const TEST_DIR = __dirname;

function printBanner(title) {
  console.log('');
  console.log('═'.repeat(50));
  console.log(`  ${title}`);
  console.log('═'.repeat(50));
}

async function main() {
  const mode = process.argv[2] || 'all';
  let totalPassed = 0;
  let totalFailed = 0;

  if (mode === 'all' || mode === 'unit') {
    printBanner('Unit Tests');

    const configTest = require('./unit/test-config');
    const configResult = await configTest.run();
    totalPassed += configResult.passed;
    totalFailed += configResult.failed;

    const bootstrapTest = require('./unit/test-bootstrap-recursive');
    const bootstrapResult = await bootstrapTest.run();
    totalPassed += bootstrapResult.passed;
    totalFailed += bootstrapResult.failed;

    const noSpanishTest = require('./unit/test-no-spanish');
    const noSpanishResult = await noSpanishTest.run();
    totalPassed += noSpanishResult.passed;
    totalFailed += noSpanishResult.failed;

    const slugParityTest = require('./unit/test-slug-parity');
    const slugParityResult = await slugParityTest.run();
    totalPassed += slugParityResult.passed;
    totalFailed += slugParityResult.failed;

    const scannerTest = require('./unit/test-scanner');
    const scannerResult = await scannerTest.run();
    totalPassed += scannerResult.passed;
    totalFailed += scannerResult.failed;

    const provenanceTest = require('./unit/test-provenance');
    const provenanceResult = await provenanceTest.run();
    totalPassed += provenanceResult.passed;
    totalFailed += provenanceResult.failed;

    const lineageSyncTest = require('./unit/test-lineage-sync');
    const lineageSyncResult = await lineageSyncTest.run();
    totalPassed += lineageSyncResult.passed;
    totalFailed += lineageSyncResult.failed;

    const lineageMigrationTest = require('./unit/test-lineage-migration');
    const lineageMigrationResult = await lineageMigrationTest.run();
    totalPassed += lineageMigrationResult.passed;
    totalFailed += lineageMigrationResult.failed;

    const webImportTest = require('./unit/test-web-import');
    const webImportResult = await webImportTest.run();
    totalPassed += webImportResult.passed;
    totalFailed += webImportResult.failed;

    const convLifecycleTest = require('./unit/test-conversations-lifecycle');
    const convLifecycleResult = await convLifecycleTest.run();
    totalPassed += convLifecycleResult.passed;
    totalFailed += convLifecycleResult.failed;

    const usageCountersTest = require('./unit/test-usage-counters');
    const usageCountersResult = await usageCountersTest.run();
    totalPassed += usageCountersResult.passed;
    totalFailed += usageCountersResult.failed;

    const scoreMatcherTest = require('./unit/test-score-matcher');
    const scoreMatcherResult = await scoreMatcherTest.run();
    totalPassed += scoreMatcherResult.passed;
    totalFailed += scoreMatcherResult.failed;

    const duplicateGuardsTest = require('./unit/test-duplicate-guards');
    const duplicateGuardsResult = await duplicateGuardsTest.run();
    totalPassed += duplicateGuardsResult.passed;
    totalFailed += duplicateGuardsResult.failed;

    const scannerCollisionTest = require('./unit/test-scanner-collision');
    const scannerCollisionResult = await scannerCollisionTest.run();
    totalPassed += scannerCollisionResult.passed;
    totalFailed += scannerCollisionResult.failed;

    const duplicateBodyHashTest = require('./unit/test-duplicate-body-hash');
    const duplicateBodyHashResult = await duplicateBodyHashTest.run();
    totalPassed += duplicateBodyHashResult.passed;
    totalFailed += duplicateBodyHashResult.failed;

    const changeLogTest = require('./unit/test-change-log');
    const changeLogResult = await changeLogTest.run();
    totalPassed += changeLogResult.passed;
    totalFailed += changeLogResult.failed;

    const impactCheckerTest = require('./unit/test-impact-checker');
    const impactCheckerResult = await impactCheckerTest.run();
    totalPassed += impactCheckerResult.passed;
    totalFailed += impactCheckerResult.failed;

    const externalScannerTest = require('./unit/test-external-scanner');
    const externalScannerResult = await externalScannerTest.run();
    totalPassed += externalScannerResult.passed;
    totalFailed += externalScannerResult.failed;
  }

  if (mode === 'all' || mode === 'integration') {
    printBanner('Integration Tests');

    try {
      const integrationScript = path.join(TEST_DIR, 'test.ps1');
      console.log(`  To run integration tests on Windows:`);
      console.log(`  pwsh -ExecutionPolicy Bypass -File "${integrationScript}"`);
      console.log('');
      console.log('  (Integration tests are skipped in the Node runner —');
      console.log('   they require PowerShell and a clean test environment.)');
    } catch (e) {
      console.log(`  SKIP: Integration tests not available on this platform`);
    }
  }

  console.log('');
  console.log('═'.repeat(50));
  console.log(`  Result: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('═'.repeat(50));
  console.log('');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
