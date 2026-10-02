const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const provenance = require('../../scripts/provenance');
const modelLib = require('../../scripts/lib/provenance-knowledge');
const {
  readLineageSnapshot,
  projectLineage,
  renderLineageSections,
} = require('../../scripts/lib/innfo-core.generated.cjs');

function run() {
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

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-prov-test-'));
  try {
    const proj = path.join(TMP, 'TestProj');
    for (const d of ['sources/nn', 'sources/archive/sample/V1', 'kNNowledge', 'export', 'artifacts']) {
      fs.mkdirSync(path.join(proj, d), { recursive: true });
    }

    // Active source
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'sample.md'),
      `---\nsource_file: "sources/import/sample.txt"\nsha256: "hash123"\nsize_bytes: 100\nnormalized_at: "2026-09-01T10:00:00Z"\nnormalized_by: "test"\n---\n# Sample\n## Item\nContent\n`,
    );

    // Archived source
    fs.writeFileSync(
      path.join(proj, 'sources', 'archive', 'sample', 'V1', 'sample.md'),
      `---\nsource_file: "sources/import/sample.txt"\nsha256: "oldhash"\nsize_bytes: 80\nnormalized_at: "2026-08-01T10:00:00Z"\nnormalized_by: "test"\n---\n# Sample\n## Item\nOld content\n`,
    );

    // kNNowledge model
    fs.writeFileSync(
      path.join(proj, 'kNNowledge', 'Doc_V_1-0-0_NN.md'),
      `---\nlevel: 3\nknowledge_version: "V_1-0-0"\nparent_spec:\n  name: "business_V_0-1-0"\ntitle: "Business Doc"\n---\n# NN Items\n## NN Items: Spec\nsources:: [sources/nn/sample.md#item]\n`,
    );

    // Export artifact (proper)
    fs.writeFileSync(
      path.join(proj, 'export', 'summary.md'),
      `---\ntype: "report"\nsources: ["kNNowledge/Doc_V_1-0-0_NN.md#spec"]\n---\n# Summary\n`,
    );

    // Legacy artifact folder (should be ignored)
    fs.writeFileSync(
      path.join(proj, 'artifacts', 'ignored_artifact.md'),
      `---\ntype: "report"\nsources: ["kNNowledge/Doc_V_1-0-0_NN.md"]\n---\n# Ignored\n`,
    );

    // 1. Projection match check
    const r1 = provenance.buildProvenanceKnowledge(proj, { projectName: 'TestProj' });
    const content1 = fs.readFileSync(r1.modelPath, 'utf8');

    const expectedSections = renderLineageSections(projectLineage(readLineageSnapshot(proj)));
    ok(content1.includes(expectedSections.sources.trim()), 'rendered sources section equals core projection render');
    ok(content1.includes(expectedSections.modelRecords.trim()), 'rendered modelRecords section equals core projection render');
    ok(content1.includes(expectedSections.artifacts.trim()), 'rendered artifacts section equals core projection render');

    // 2. No is_synthetic in sources
    ok(!content1.includes('is_synthetic::'), 'no is_synthetic emitted in lineage record');

    // 3. No artifacts/ fallback: ignored_artifact.md not present
    ok(!content1.includes('ignored_artifact'), 'files under artifacts/ are ignored');

    // 4. Hand-authored blocks and journal preserved byte-for-byte in refreshExistingModel
    const handAuthoredSection = '\n# NN External Watch Roots\n\n- root: /data/external\n  pattern: **/*.pdf\n';
    const journalEntry = '\n## NN Procedures: trannsform --scan @ 2026-09-01T12:00:00Z\ncommand:: trannsform --scan\n';
    
    // Inject custom section and procedure into content
    let customContent = content1 + handAuthoredSection;
    customContent = customContent.replace('# NN Procedures\n\n<!-- Append-only. One entry per pipeline run (--scan, --import-url, --apply). Never regenerated. -->\n', '# NN Procedures\n' + journalEntry);
    fs.writeFileSync(r1.modelPath, customContent, 'utf8');

    const r2 = provenance.buildProvenanceKnowledge(proj, { projectName: 'TestProj' });
    const content2 = fs.readFileSync(r2.modelPath, 'utf8');

    ok(content2.includes(handAuthoredSection.trim()), 'hand-authored block preserved byte-for-byte');
    ok(content2.includes(journalEntry.trim()), 'procedures journal preserved byte-for-byte');

    // 5. Deprecated model / knowledge_version fallback removed
    fs.writeFileSync(
      path.join(proj, 'export', 'legacy_header_artifact.md'),
      `---\nmodel: "Business Doc"\nknowledge_version: "V_1-0-0"\ntype: "report"\n---\n# Legacy\n`,
    );
    const r3 = provenance.buildProvenanceKnowledge(proj, { projectName: 'TestProj' });
    const content3 = fs.readFileSync(r3.modelPath, 'utf8');
    ok(!content3.includes('derived_from:: [Business Doc V_1-0-0]'), 'model fallback not used for artifacts without sources:');

    // 6. Legacy # NN Models / [[Models]] alias not honored
    const legacyDoc = `---\nspecification_version: "V_0-3-0"\nspecification_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"\nlevel: 3\nparent_spec:\n  name: "cogNNitive"\n  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/cogNNitive/spec_NN.md"\nknowledge_version: "V_0-2-0"\ntitle: "Test Legacy"\n---\n\n> [!NOTE]\n> Test\n\n# NN index\n\n* [[Sources]]\n* [[Models]]\n* [[Artifacts]]\n* [[Procedures]]\n\n# NN Models\n\n## NN Models: Legacy\nmodel_ref:: kNNowledge/Old.md\n`;
    
    const refreshed = modelLib.refreshExistingModel(legacyDoc, expectedSections);
    ok(refreshed.includes('# NN Models\n\n## NN Models: Legacy'), 'legacy # NN Models section passes through as unmanaged custom block');
    ok(refreshed.includes('# NN ModelRecords'), 'refresh produces # NN ModelRecords');
    ok(refreshed.includes('* [[Models]]'), 'legacy [[Models]] index link is not rewritten');

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
  console.log(`\nProvenance-knowledge tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
