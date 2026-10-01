const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { auditModelCitations, checkScanImpact, findClosestSlugs, buildImpactReport, writeImpactReport } = require('../../scripts/lib/impact-checker');

async function run() {
  let passed = 0;
  let failed = 0;

  function ok(actual, msg) {
    try {
      assert.ok(actual);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg} - ${e.message}`);
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

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-impact-test-'));

  try {
    const modelsDir = path.join(tmpDir, 'kNNowledge');
    const nnDir = path.join(tmpDir, 'sources', 'nn');
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(nnDir, { recursive: true });

    // 1. Create normalized source
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

    // 2. Create model with valid citations
    const validModelContent = `---
spec_version: "V_0-1-0"
---

# NN Objectives

## NN Objectives: Global Expansion
sources:: [strategy_source.md#strategic-vision, strategy_source.md#market-positioning]
status:: Active
`;
    fs.writeFileSync(path.join(modelsDir, 'Objectives_V_1-0-0_NN.md'), validModelContent, 'utf8');

    // Test 1: Clean audit
    const auditClean = auditModelCitations(tmpDir);
    eq(auditClean.errors.length, 0, 'clean audit has 0 errors');
    eq(auditClean.totalCitations, 2, 'records 2 total citations');
    eq(auditClean.validCitations, 2, 'records 2 valid citations');

    // Test 2: Missing heading detection (drift)
    const driftedModelContent = `---
spec_version: "V_0-1-0"
---

# NN Objectives

## NN Objectives: Unknown Heading Target
sources:: strategy_source.md#non-existent-heading
status:: Inactive
`;
    fs.writeFileSync(path.join(modelsDir, 'Drifted_V_1-0-0_NN.md'), driftedModelContent, 'utf8');

    const auditDrift = auditModelCitations(tmpDir);
    ok(auditDrift.errors.length > 0, 'detects missing heading as error');
    const drifted = auditDrift.driftedCitations.find(c => c.headingSlug === 'non-existent-heading');
    ok(Boolean(drifted), 'records drifted citation details');
    eq(drifted.reason, 'missing_heading', 'reason is missing_heading');

    // Test 2b: @ grammar citation validated for real, not auto-skipped
    const atModelContent = `---
spec_version: "V_0-1-0"
---

# NN Objectives

## NN Objectives: At Grammar Valid
sources:: strategy_source.md@## Strategic Vision

## NN Objectives: At Grammar Drifted
sources:: strategy_source.md@## Nonexistent Section
`;
    fs.writeFileSync(path.join(modelsDir, 'AtGrammar_V_1-0-0_NN.md'), atModelContent, 'utf8');

    const auditAt = auditModelCitations(tmpDir);
    const atValid = auditAt.driftedCitations.find(c => c.citation.includes('Strategic Vision'));
    ok(!atValid, '@ grammar citation to a real heading is not flagged as drift');
    const atDrifted = auditAt.driftedCitations.find(c => c.citation.includes('Nonexistent Section'));
    ok(Boolean(atDrifted), '@ grammar citation to a missing heading IS flagged as drift');
    eq(atDrifted.reason, 'missing_heading', '@ grammar drift reason is missing_heading');

    fs.rmSync(path.join(modelsDir, 'AtGrammar_V_1-0-0_NN.md'));

    // Test 3: Suggest closest matching slugs
    const suggestions = findClosestSlugs('strategic-mission', ['strategic-vision', 'market-positioning', 'overview']);
    ok(suggestions.includes('strategic-vision'), 'finds closest slug suggestions for similar tokens');

    // Test 4: checkScanImpact for modified source
    const scanImpact = checkScanImpact([
      { baseName: 'strategy_source', displayOutPath: 'strategy_source.md' }
    ], tmpDir);
    ok(scanImpact.length > 0, 'scan impact returns affected models for changed source');
    eq(scanImpact[0].affectedModels[0].modelFile, 'kNNowledge/Drifted_V_1-0-0_NN.md', 'identifies correct affected model');

    // Test 5: buildImpactReport emits structured markdown with required frontmatter
    const reportMd = buildImpactReport(auditDrift, '2026-09-12');
    ok(reportMd.includes('type: report'), 'report carries type: report frontmatter');
    ok(reportMd.includes('generated_by:'), 'report carries generated_by frontmatter');
    ok(reportMd.includes('kNNowledge/Drifted_V_1-0-0_NN.md'), 'report names each affected model');
    ok(reportMd.includes('Unknown Heading Target'), 'report names the affected element');
    ok(reportMd.includes('non-existent-heading'), 'report cites the drifting source heading');
    ok(/Recommended remediation/i.test(reportMd), 'report includes recommended remediation');

    // Test 6: writeImpactReport writes export/Impact_Audit_<date>_report.md
    const written = writeImpactReport(tmpDir, auditDrift, '2026-09-12');
    ok(fs.existsSync(written.reportPath), 'report file is created on disk');
    ok(written.reportPath.endsWith(path.join('export', 'Impact_Audit_2026-09-12_report.md').replace(/\\/g, '/')), 'report path uses export/Impact_Audit_<date>_report.md');
    const writtenContent = fs.readFileSync(written.reportPath, 'utf8');
    ok(writtenContent.includes('type: report'), 'written report carries type: report');
    ok(writtenContent.includes('generated_by:'), 'written report carries generated_by');
    ok(writtenContent.includes('Recommended remediation'), 'written report details remediation');

    // Test 8: groupSourceFamilies and detectSourceFamilyEvolution
    const snap1Content = `# Strategy Snapshot 1\n## Strategic Vision\nVision v1\n`;
    const snap2Content = `# Strategy Snapshot 2\n## Strategic Vision\nVision v2 with updates\n## New Market Plan\nNew market details\n`;
    fs.writeFileSync(path.join(nnDir, 'quarterly_strategy_20260901-120000.md'), snap1Content, 'utf8');
    fs.writeFileSync(path.join(nnDir, 'quarterly_strategy_20260912-180000.md'), snap2Content, 'utf8');

    const { groupSourceFamilies, detectSourceFamilyEvolution } = require('../../scripts/lib/impact-checker');
    const families = groupSourceFamilies(tmpDir);
    ok(Boolean(families['quarterly_strategy']), 'groups quarterly_strategy family correctly');
    eq(families['quarterly_strategy'].length, 2, 'records 2 snapshots in quarterly_strategy family');

    // Model citing older snapshot
    const citingModel = `---
spec_version: "V_0-1-0"
---
# NN Vision
## NN Vision: Growth Plan
sources:: [quarterly_strategy_20260901-120000.md#strategic-vision]
`;
    fs.writeFileSync(path.join(modelsDir, 'Citing_Model_V_1-0-0_NN.md'), citingModel, 'utf8');

    const evolutions = detectSourceFamilyEvolution(tmpDir);
    ok(evolutions.length > 0, 'detects source family evolution opportunity');
    eq(evolutions[0].family, 'quarterly_strategy', 'identifies correct family stem');
    eq(evolutions[0].currentSnapshot, 'quarterly_strategy_20260901-120000.md', 'identifies current snapshot');
    eq(evolutions[0].latestSnapshot, 'quarterly_strategy_20260912-180000.md', 'identifies latest snapshot');
    eq(evolutions[0].headingPreserved, true, 'detects heading preserved in newer snapshot');

  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

  return { passed, failed };
}

module.exports = { run };
