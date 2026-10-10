const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {
  auditModelCitations,
  checkScanImpact,
  findClosestSlugs,
  buildImpactReport,
  writeImpactReport,
  groupSourceFamilies,
  detectSourceFamilyEvolution,
} = require('../../scripts/lib/impact-checker');
const { put, cognitivizeAll } = require('./_fixtures');

const MODEL = (cite, name = 'Global Expansion') => `---
spec_version: "V_0-1-0"
level: 3
parent_spec:
  name: "business"
---

# NN Objectives

## NN Objectives: ${name}
sources:: [${cite}]
status:: Active
`;

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

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
    fs.mkdirSync(modelsDir, { recursive: true });

    // 1. Raw sources in place: markdown, CSV, JSON
    put(
      tmpDir,
      'sources/import/strategy.md',
      '---\ntitle: "Strategy"\n---\n\n# Strategy 2026\n\n## Strategic Vision\nHere is the vision.\n\n## Market Positioning\nPositioning details here.\n',
    );
    put(tmpDir, 'sources/import/metrics.csv', 'id,name,value\n1,alpha,100\n2,beta,200\n');
    put(tmpDir, 'sources/import/plan.json', JSON.stringify({ items: [{ name: 'alpha' }] }));
    await cognitivizeAll(tmpDir, ['sources/import/strategy.md', 'sources/import/metrics.csv', 'sources/import/plan.json']);

    // 2. Model with valid citations
    fs.writeFileSync(
      path.join(modelsDir, 'Objectives_business_NN.md'),
      MODEL(
        'sources/import/strategy.md@## Strategic Vision, sources/import/strategy.md@## Market Positioning, sources/import/metrics.csv@1',
      ),
      'utf8',
    );

    // Test 1: Clean audit
    const auditClean = auditModelCitations(tmpDir);
    eq(auditClean.errors.length, 0, 'clean audit has 0 errors');
    eq(auditClean.totalCitations, 3, 'records 3 total citations');
    eq(auditClean.validCitations, 3, 'records 3 valid citations');
    eq(auditClean.warnings.length, 0, 'clean audit has 0 warnings (sidecar hashes match)');

    // Test 2: Missing heading detection (KU_UNKNOWN_SLUG -> missing_heading)
    fs.writeFileSync(
      path.join(modelsDir, 'Drifted_business_NN.md'),
      MODEL('sources/import/strategy.md@## Strategic Vis', 'Unknown Heading Target'),
      'utf8',
    );
    const auditDrift = auditModelCitations(tmpDir);
    ok(auditDrift.errors.length > 0, 'detects missing heading as error');
    const driftedHeading = auditDrift.driftedCitations.find((c) => c.citation.includes('Strategic Vis'));
    ok(Boolean(driftedHeading), 'records drifted citation details');
    eq(driftedHeading.reason, 'missing_heading', 'reason is missing_heading for KU_UNKNOWN_SLUG');
    eq(driftedHeading.sourceFile, 'sources/import/strategy.md', 'the cited source is the full domaiNN-relative path');
    ok(Array.isArray(driftedHeading.suggestions) && driftedHeading.suggestions.length > 0, 'findClosestSlugs suggestions provided');

    // Test 3: Missing file detection (KU_DANGLING_FILE -> missing_file)
    fs.writeFileSync(path.join(modelsDir, 'MissingFile_business_NN.md'), MODEL('sources/import/nonexistent.md@## Some Heading', 'Missing File'), 'utf8');
    const driftedFile = auditModelCitations(tmpDir).driftedCitations.find((c) => c.citation.includes('nonexistent.md'));
    ok(Boolean(driftedFile), 'records missing file citation');
    eq(driftedFile.reason, 'missing_file', 'reason is missing_file for KU_DANGLING_FILE');

    // Test 4: Missing row detection
    fs.writeFileSync(path.join(modelsDir, 'MissingRow_business_NN.md'), MODEL('sources/import/metrics.csv@99', 'Missing Row'), 'utf8');
    const driftedRow = auditModelCitations(tmpDir).driftedCitations.find((c) => c.citation.includes('metrics.csv@99'));
    ok(Boolean(driftedRow), 'records missing row citation');
    eq(driftedRow.reason, 'missing_row', 'reason is missing_row for KU_UNKNOWN_ROW');

    // Test 5: Missing column detection
    fs.writeFileSync(path.join(modelsDir, 'MissingCol_business_NN.md'), MODEL('sources/import/metrics.csv@1&nonexistent_col', 'Missing Column'), 'utf8');
    const driftedCol = auditModelCitations(tmpDir).driftedCitations.find((c) => c.citation.includes('nonexistent_col'));
    ok(Boolean(driftedCol), 'records missing column citation');
    eq(driftedCol.reason, 'missing_column', 'reason is missing_column for KU_UNKNOWN_COLUMN');

    // Test 5b: Unknown JSON Pointer detection
    fs.writeFileSync(path.join(modelsDir, 'MissingPointer_business_NN.md'), MODEL('sources/import/plan.json@/items/9/name', 'Missing Pointer'), 'utf8');
    const driftedPointer = auditModelCitations(tmpDir).driftedCitations.find((c) => c.citation.includes('plan.json@/items/9/name'));
    ok(Boolean(driftedPointer), 'records unknown pointer citation');
    eq(driftedPointer && driftedPointer.reason, 'missing_pointer', 'reason is missing_pointer for KU_UNKNOWN_POINTER');
    eq(driftedPointer && driftedPointer.headingSlug, '/items/9/name', 'the pointer is reported as the cited unit');

    for (const f of ['MissingFile', 'MissingRow', 'MissingCol', 'MissingPointer']) {
      fs.rmSync(path.join(modelsDir, `${f}_business_NN.md`));
    }

    // Test 6: the hash guard. Raw bytes changed after cognitivizing: the audit says so.
    fs.appendFileSync(path.join(tmpDir, 'sources/import/metrics.csv'), '3,gamma,300\n');
    const stale = auditModelCitations(tmpDir);
    ok(
      stale.warnings.some((w) => /metrics\.csv/.test(w) && /hash/i.test(w)),
      'a cited source whose bytes differ from its sidecar sha256 is reported (hash guard)',
    );
    await cognitivizeAll(tmpDir, ['sources/import/metrics.csv']);
    eq(auditModelCitations(tmpDir).warnings.length, 0, 'cognitivizing again clears the hash warning');

    // Test 7: buildImpactReport and writeImpactReport
    const reportText = buildImpactReport(auditDrift);
    ok(!reportText.includes('type: report') && !/^date:/m.test(reportText), 'report carries no type or date frontmatter');
    ok(reportText.includes('generated_by: auditModelCitations'), 'report carries generated_by frontmatter');
    ok(reportText.includes('Drifted_business_NN.md'), 'report names each affected model');
    ok(reportText.includes('`sources/import/strategy.md`'), 'report names the cited source by its real path');
    ok(!/sources\/nn/.test(reportText), 'report never invents a sources/nn path');
    const { reportPath } = await writeImpactReport(tmpDir, auditDrift);
    ok(fs.existsSync(reportPath), 'report file is created on disk');

    fs.rmSync(path.join(modelsDir, 'Drifted_business_NN.md'));

    // Test 8: Source families (unsuffixed member first, then stamps in order)
    put(tmpDir, 'sources/import/quarterly_strategy.md', '# Strategy\n## Goal\n## Risks\n');
    put(tmpDir, 'sources/import/quarterly_strategy_20260901T100000Z.md', '# Strategy\n## Goal\n## Risks\n');
    put(tmpDir, 'sources/import/quarterly_strategy_20260915T120000Z.md', '# Strategy\n## Goal\n');
    put(tmpDir, 'sources/import/other_20260901T100000Z.csv', 'id\n1\n');

    const families = groupSourceFamilies(tmpDir);
    const famKey = 'sources/import/quarterly_strategy.md';
    ok(families[famKey] && families[famKey].length === 3, 'groups the unsuffixed and suffixed members into one family');
    eq(
      (families[famKey] || []).map((m) => m.fileName).join(','),
      'quarterly_strategy.md,quarterly_strategy_20260901T100000Z.md,quarterly_strategy_20260915T120000Z.md',
      'family order is unsuffixed first, then by stamp',
    );
    ok(families['sources/import/other.csv'] && families['sources/import/other.csv'].length === 1, 'families are per dir, key and extension');

    const oldBytes = sha(path.join(tmpDir, 'sources/import/quarterly_strategy_20260901T100000Z.md'));

    // A citation to the older member whose heading survives and one whose heading does not
    fs.writeFileSync(
      path.join(modelsDir, 'Evolving_business_NN.md'),
      `---\nlevel: 3\nparent_spec:\n  name: "business"\n---\n# NN O\n## NN O: Goal\nsources:: [sources/import/quarterly_strategy_20260901T100000Z.md@## Goal]\n\n## NN O: Risk\nsources:: [sources/import/quarterly_strategy_20260901T100000Z.md@## Risks]\n`,
    );

    const evolutions = detectSourceFamilyEvolution(tmpDir);
    eq(evolutions.length, 2, 'both citations to the older member are superseded');
    const goal = evolutions.find((e) => e.elementName === 'Goal' || /Goal/.test(e.citation));
    const risk = evolutions.find((e) => /Risks/.test(e.citation));
    eq(goal.family, famKey, 'identifies the family');
    eq(goal.currentSnapshot, 'quarterly_strategy_20260901T100000Z.md', 'identifies the cited member');
    eq(goal.latestSnapshot, 'quarterly_strategy_20260915T120000Z.md', 'identifies the latest member');
    eq(goal.headingPreserved, true, 'the heading survives in the latest member');
    eq(risk.headingPreserved, false, 'a heading missing in the latest member is flagged (resolved by core)');

    // Test 9: scan impact reads families: superseded listed, unresolved units warned
    const impacts = checkScanImpact(tmpDir);
    eq(impacts.length, 1, 'one family is affected');
    eq(impacts[0].source, famKey, 'the impact is keyed by the family');
    const byStatus = (s) => impacts[0].affectedModels.filter((a) => a.status === s);
    eq(byStatus('superseded').length, 1, 'a citation whose unit survives is listed as superseded only');
    eq(byStatus('unresolved_in_latest').length, 1, 'a citation whose unit is gone is a warning');
    ok(/Evolving_business_NN\.md/.test(byStatus('unresolved_in_latest')[0].modelFile), 'the warning names the citing file');
    ok(/Risk/.test(byStatus('unresolved_in_latest')[0].element || ''), 'the warning names the element');

    // CSV row missing in the latest member
    put(tmpDir, 'sources/import/prices_20261001T090000Z.csv', 'id,price\nR12,5\nR13,6\n');
    put(tmpDir, 'sources/import/prices_20261002T090000Z.csv', 'id,price\nR13,6\n');
    fs.writeFileSync(
      path.join(modelsDir, 'Prices_business_NN.md'),
      MODEL('sources/import/prices_20261001T090000Z.csv@R12&price', 'Price'),
    );
    const rowImpact = checkScanImpact(tmpDir).find((i) => i.source === 'sources/import/prices.csv');
    ok(rowImpact && rowImpact.affectedModels.some((a) => a.status === 'unresolved_in_latest'), 'a dangling CSV row in the latest member is reported');

    // A citation into a binary's sidecar follows the subject family
    put(tmpDir, 'sources/import/report_20261001T090000Z.pdf', 'pdf one');
    put(tmpDir, 'sources/import/report_20261002T090000Z.pdf', 'pdf two');
    await cognitivizeAll(tmpDir, ['sources/import/report_20261001T090000Z.pdf', 'sources/import/report_20261002T090000Z.pdf']);
    fs.writeFileSync(
      path.join(modelsDir, 'Report_business_NN.md'),
      MODEL('sources/import/report_20261001T090000Z.pdf_sidecar_NN.md@## Overview', 'Report'),
    );
    const pdfImpact = checkScanImpact(tmpDir).find((i) => i.source === 'sources/import/report.pdf');
    ok(pdfImpact && pdfImpact.affectedModels.some((a) => a.status === 'superseded'), 'a sidecar citation is checked against the newer member sidecar');
    ok(!pdfImpact.affectedModels.some((a) => a.status === 'unresolved_in_latest'), 'the newer sidecar still has the cited heading');

    // The check never changes a family member
    eq(sha(path.join(tmpDir, 'sources/import/quarterly_strategy_20260901T100000Z.md')), oldBytes, 'no existing member bytes changed');

    // Nothing to report when every citation targets the latest member
    fs.rmSync(path.join(modelsDir, 'Evolving_business_NN.md'));
    fs.rmSync(path.join(modelsDir, 'Prices_business_NN.md'));
    fs.rmSync(path.join(modelsDir, 'Report_business_NN.md'));
    fs.writeFileSync(
      path.join(modelsDir, 'Latest_business_NN.md'),
      MODEL('sources/import/quarterly_strategy_20260915T120000Z.md@## Goal', 'Latest'),
    );
    eq(checkScanImpact(tmpDir).length, 0, 'zero drift: a citation to the latest member reports nothing');

    ok(findClosestSlugs('strategic-vis', ['strategic-vision', 'market']).includes('strategic-vision'), 'findClosestSlugs still suggests near headings');
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    console.error(err.stack);
    failed++;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
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
