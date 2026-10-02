const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  auditModelCitations,
  checkScanImpact,
  findClosestSlugs,
  buildImpactReport,
  writeImpactReport,
  groupSourceFamilies,
  detectSourceFamilyEvolution,
} = require('../../scripts/lib/impact-checker');

async function run() {
  let passed = 0;
  let failed = 0;

  function ok(actual, msg) {
    if (actual) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.log(`  FAIL: ${msg}`);
      failed++;
    }
  }

  function eq(actual, expected, msg) {
    if (actual === expected) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.log(`  FAIL: ${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
      failed++;
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-impact-test-'));

  try {
    const modelsDir = path.join(tmpDir, 'kNNowledge');
    const nnDir = path.join(tmpDir, 'sources', 'nn');
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(nnDir, { recursive: true });

    // 1. Create normalized sources: markdown & CSV
    const sourceContent = `---
source_file: "sources/import/strategy.pdf"
sha256: "abc123hash"
---

# Strategy 2026

## Strategic Vision
Here is the vision.

## Market Positioning
Positioning details here.
`;
    fs.writeFileSync(path.join(nnDir, 'strategy_source.md'), sourceContent, 'utf8');

    const csvContent = `id,name,value
1,alpha,100
2,beta,200
`;
    fs.writeFileSync(path.join(nnDir, 'metrics.csv'), csvContent, 'utf8');
    fs.writeFileSync(path.join(nnDir, 'metrics.md'), `---\nsource_file: "sources/import/metrics.csv"\nsha256: "csv123"\n---\n# Metrics\n`, 'utf8');

    // 2. Create model with valid citations
    const validModelContent = `---
spec_version: "V_0-1-0"
level: 3
parent_spec:
  name: "business"
---

# NN Objectives

## NN Objectives: Global Expansion
sources:: [sources/nn/strategy_source.md@## Strategic Vision, sources/nn/strategy_source.md@## Market Positioning, sources/nn/metrics.csv@1]
status:: Active
`;
    fs.writeFileSync(path.join(modelsDir, 'Objectives_V_1-0-0_NN.md'), validModelContent, 'utf8');

    // Test 1: Clean audit
    const auditClean = auditModelCitations(tmpDir);
    eq(auditClean.errors.length, 0, 'clean audit has 0 errors');
    eq(auditClean.totalCitations, 3, 'records 3 total citations');
    eq(auditClean.validCitations, 3, 'records 3 valid citations');

    // Test 2: Missing heading detection (KU_UNKNOWN_SLUG -> missing_heading)
    const driftedModelContent = `---
spec_version: "V_0-1-0"
level: 3
parent_spec:
  name: "business"
---

# NN Objectives

## NN Objectives: Unknown Heading Target
sources:: [sources/nn/strategy_source.md@## Strategic Vis]
status:: Inactive
`;
    fs.writeFileSync(path.join(modelsDir, 'Drifted_V_1-0-0_NN.md'), driftedModelContent, 'utf8');

    const auditDrift = auditModelCitations(tmpDir);
    ok(auditDrift.errors.length > 0, 'detects missing heading as error');
    const driftedHeading = auditDrift.driftedCitations.find((c) => c.citation.includes('Strategic Vis'));
    ok(Boolean(driftedHeading), 'records drifted citation details');
    eq(driftedHeading.reason, 'missing_heading', 'reason is missing_heading for KU_UNKNOWN_SLUG');
    ok(Array.isArray(driftedHeading.suggestions) && driftedHeading.suggestions.length > 0, 'findClosestSlugs suggestions provided');

    // Test 3: Missing file detection (KU_DANGLING_FILE -> missing_file)
    const missingFileModel = `---
level: 3
parent_spec:
  name: "business"
---

# NN Objectives

## NN Objectives: Missing File
sources:: [sources/nn/nonexistent.md@## Some Heading]
`;
    fs.writeFileSync(path.join(modelsDir, 'MissingFile_V_1-0-0_NN.md'), missingFileModel, 'utf8');

    const auditMissingFile = auditModelCitations(tmpDir);
    const driftedFile = auditMissingFile.driftedCitations.find((c) => c.citation.includes('nonexistent.md'));
    ok(Boolean(driftedFile), 'records missing file citation');
    eq(driftedFile.reason, 'missing_file', 'reason is missing_file for KU_DANGLING_FILE');

    // Test 4: Missing row detection (KU_UNKNOWN_ROW -> missing_row)
    const missingRowModel = `---
level: 3
parent_spec:
  name: "business"
---

# NN Objectives

## NN Objectives: Missing Row
sources:: [sources/nn/metrics.csv@99]
`;
    fs.writeFileSync(path.join(modelsDir, 'MissingRow_V_1-0-0_NN.md'), missingRowModel, 'utf8');

    const auditMissingRow = auditModelCitations(tmpDir);
    const driftedRow = auditMissingRow.driftedCitations.find((c) => c.citation.includes('metrics.csv@99'));
    ok(Boolean(driftedRow), 'records missing row citation');
    eq(driftedRow.reason, 'missing_row', 'reason is missing_row for KU_UNKNOWN_ROW');

    // Test 5: Missing column detection (KU_UNKNOWN_COLUMN -> missing_column)
    const missingColModel = `---
level: 3
parent_spec:
  name: "business"
---

# NN Objectives

## NN Objectives: Missing Column
sources:: [sources/nn/metrics.csv@1&nonexistent_col]
`;
    fs.writeFileSync(path.join(modelsDir, 'MissingCol_V_1-0-0_NN.md'), missingColModel, 'utf8');

    const auditMissingCol = auditModelCitations(tmpDir);
    const driftedCol = auditMissingCol.driftedCitations.find((c) => c.citation.includes('nonexistent_col'));
    ok(Boolean(driftedCol), 'records missing column citation');
    eq(driftedCol.reason, 'missing_column', 'reason is missing_column for KU_UNKNOWN_COLUMN');

    // Clean up error models for impact report testing
    fs.rmSync(path.join(modelsDir, 'MissingFile_V_1-0-0_NN.md'));
    fs.rmSync(path.join(modelsDir, 'MissingRow_V_1-0-0_NN.md'));
    fs.rmSync(path.join(modelsDir, 'MissingCol_V_1-0-0_NN.md'));

    // Test 6: checkScanImpact
    const scanImpact = checkScanImpact(
      [{ baseName: 'strategy_source', displayOutPath: 'sources/nn/strategy_source.md' }],
      tmpDir,
    );
    ok(scanImpact.length > 0, 'scan impact returns affected models for changed source');
    eq(scanImpact[0].affectedModels[0].modelFile, 'kNNowledge/Drifted_V_1-0-0_NN.md', 'identifies correct affected model');

    // Test 7: buildImpactReport and writeImpactReport
    const reportText = buildImpactReport(auditDrift, '2026-10-01');
    ok(reportText.includes('type: report'), 'report carries type: report frontmatter');
    ok(reportText.includes('generated_by: auditModelCitations'), 'report carries generated_by frontmatter');
    ok(reportText.includes('Drifted_V_1-0-0_NN.md'), 'report names each affected model');

    const { reportPath } = writeImpactReport(tmpDir, auditDrift, '2026-10-01');
    ok(fs.existsSync(reportPath), 'report file is created on disk');

    // Test 8: Source Family Evolution
    const tsDir = path.join(tmpDir, 'sources', 'nn');
    fs.writeFileSync(path.join(tsDir, 'quarterly_strategy_20260901-100000.md'), '# Strategy\n## Goal\n');
    fs.writeFileSync(path.join(tsDir, 'quarterly_strategy_20260915-120000.md'), '# Strategy\n## Goal\n');

    const families = groupSourceFamilies(tmpDir);
    ok(families['quarterly_strategy'] && families['quarterly_strategy'].length === 2, 'groups quarterly_strategy family correctly');

    fs.writeFileSync(
      path.join(modelsDir, 'Evolving_V_1-0-0_NN.md'),
      `---\nlevel: 3\nparent_spec:\n  name: "business"\n---\n# NN O\n## NN O: Goal\nsources:: [sources/nn/quarterly_strategy_20260901-100000.md@## Goal]\n`,
    );

    const evolutions = detectSourceFamilyEvolution(tmpDir);
    ok(evolutions.length > 0, 'detects source family evolution opportunity');
    eq(evolutions[0].family, 'quarterly_strategy', 'identifies correct family stem');
    eq(evolutions[0].currentSnapshot, 'quarterly_strategy_20260901-100000.md', 'identifies current snapshot');
    eq(evolutions[0].latestSnapshot, 'quarterly_strategy_20260915-120000.md', 'identifies latest snapshot');
    eq(evolutions[0].headingPreserved, true, 'detects heading preserved in newer snapshot');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error(`  ERROR: ${err.message}`);
    console.error(err.stack);
    failed++;
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then(({ passed, failed }) => {
    console.log(`\nImpact-checker tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
