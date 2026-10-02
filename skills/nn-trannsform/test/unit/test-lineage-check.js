const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { checkLineage } = require('../../scripts/lib/lineage-check');
const provenance = require('../../scripts/provenance');

function run() {
  let passed = 0;
  let failed = 0;

  function ok(cond, msg) {
    if (cond) {
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

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-lineage-check-'));
  try {
    const proj = path.join(TMP, 'CheckProj');
    for (const d of ['sources/nn', 'kNNowledge', 'export', 'sources/archive/sample/V1']) {
      fs.mkdirSync(path.join(proj, d), { recursive: true });
    }

    // (a) Record missing check
    const rMissing = checkLineage(proj);
    ok(rMissing.errors.some((e) => /No lineage record found/.test(e)), '(a) reports error when no lineage record exists');

    // Create source files
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'report.md'),
      `---\nsource_file: "sources/import/report.pdf"\nsha256: "h1"\nsize_bytes: 10\nnormalized_at: "2026-09-01T10:00:00Z"\nnormalized_by: "t"\n---\n# Report\n## Overview\nContent\n`,
    );

    // Curated CSV with corresponding .md stem (rule 1 satisfied)
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'data.csv'),
      `id,value\n1,100\n2,200\n`,
    );
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'data.md'),
      `---\nsource_file: "sources/import/data.csv"\nsha256: "h2"\nsize_bytes: 20\nnormalized_at: "2026-09-01T10:00:00Z"\nnormalized_by: "t"\n---\n# Data\n`,
    );

    // kNNowledge model citing source with canonical @ grammar and CSV citation (regression for old line 81 #.* strip bug)
    fs.writeFileSync(
      path.join(proj, 'kNNowledge', 'Plan_V_1-0-0_NN.md'),
      `---\nlevel: 3\nknowledge_version: "V_1-0-0"\nparent_spec:\n  name: "business_V_0-1-0"\ntitle: "Business Plan"\n---\n# NN Items\n## NN Items: Point 1\nsources:: [sources/nn/report.md@## Overview, sources/nn/data.csv@1]\n`,
    );

    // Export artifact citing model
    fs.writeFileSync(
      path.join(proj, 'export', 'summary.md'),
      `---\ntype: "report"\nsources: ["kNNowledge/Plan_V_1-0-0_NN.md@## NN Items: Point 1"]\n---\n# Summary\n`,
    );

    // Archived source for sample
    fs.writeFileSync(
      path.join(proj, 'sources', 'archive', 'sample', 'V1', 'sample.md'),
      `---\nsource_file: "sources/import/sample.txt"\nsha256: "h3"\nsize_bytes: 30\nnormalized_at: "2026-08-01T10:00:00Z"\nnormalized_by: "t"\n---\n# Sample\n`,
    );

    provenance.buildProvenanceKnowledge(proj, { projectName: 'CheckProj' });

    // Canonical @ and CSV citations produce no error
    const rValid = checkLineage(proj);
    eq(rValid.errors.length, 0, 'canonical @ and CSV citations produce no error');

    // (b) Dangling citation produces error via validateCitations
    fs.writeFileSync(
      path.join(proj, 'kNNowledge', 'Plan_V_1-0-0_NN.md'),
      `---\nlevel: 3\nknowledge_version: "V_1-0-0"\nparent_spec:\n  name: "business_V_0-1-0"\ntitle: "Business Plan"\n---\n# NN Items\n## NN Items: Point 1\nsources:: [sources/nn/nonexistent.md@## Item]\n`,
    );
    const rDangling = checkLineage(proj);
    ok(rDangling.errors.some((e) => /nonexistent\.md/.test(e)), '(b) dangling citation reported as error');

    // Restore valid kNNowledge
    fs.writeFileSync(
      path.join(proj, 'kNNowledge', 'Plan_V_1-0-0_NN.md'),
      `---\nlevel: 3\nknowledge_version: "V_1-0-0"\nparent_spec:\n  name: "business_V_0-1-0"\ntitle: "Business Plan"\n---\n# NN Items\n## NN Items: Point 1\nsources:: [sources/nn/report.md@## Overview]\n`,
    );

    // (c) Curated CSV with no stem .md (Rule 1 violation)
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'orphan_data.csv'),
      `a,b\n1,2\n`,
    );
    const rRule1 = checkLineage(proj);
    ok(rRule1.errors.some((e) => /orphan_data\.csv/.test(e)), '(c) CSV under sources/nn with no stem .md produces error');
    fs.rmSync(path.join(proj, 'sources', 'nn', 'orphan_data.csv'));

    // (d) Orphan archive chain warning
    fs.mkdirSync(path.join(proj, 'sources', 'archive', 'ghost_chain'), { recursive: true });
    const rOrphanChain = checkLineage(proj);
    ok(rOrphanChain.warnings.some((w) => /ghost_chain/.test(w)), '(d) orphan archive chain produces warning');

    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (err) {
    fs.rmSync(TMP, { recursive: true, force: true });
    console.error(`  ERROR: ${err.message}`);
    console.error(err.stack);
    failed++;
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const { passed, failed } = run();
  console.log(`\nLineage-check tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
