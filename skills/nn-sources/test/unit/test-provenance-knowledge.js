const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const provenance = require('../../scripts/provenance');
const modelLib = require('../../scripts/lib/provenance-knowledge');
const { put, cognitivizeAll } = require('./_fixtures');
const {
  readLineageSnapshot,
  projectLineage,
  renderLineageSections,
} = require('../../scripts/lib/innfo-core.generated.cjs');

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

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-prov-test-'));
  try {
    const proj = path.join(TMP, 'TestProj');
    for (const d of ['kNNowledge', 'export', 'artifacts']) {
      fs.mkdirSync(path.join(proj, d), { recursive: true });
    }

    // Source: a raw file cognitivized in place.
    put(proj, 'sources/import/sample.md', '# Sample\n## Item\nContent\n');
    await cognitivizeAll(proj, ['sources/import/sample.md']);

    // kNNowledge model
    fs.writeFileSync(
      path.join(proj, 'kNNowledge', 'Doc_business_NN.md'),
      `---\nlevel: 3\nknowledge_version: "V_1-0-0"\nparent_spec:\n  name: "business"\ntitle: "Business Doc"\n---\n# NN Items\n## NN Items: Spec\nsources:: [sources/import/sample.md@## Item]\n`,
    );

    // Artifact declaring its upstream
    fs.writeFileSync(
      path.join(proj, 'artifacts', 'summary.md'),
      `---\ntype: "report"\nsources: ["kNNowledge/Doc_business_NN.md@## NN Items: Spec"]\n---\n# Summary\n`,
    );

    // A loose hand-written file under the retired export/ folder: no sidecar, not a family member, no upstream
    fs.writeFileSync(path.join(proj, 'export', 'ignored_artifact.md'), '# Ignored\n');

    // 1. Projection match check
    const r1 = provenance.buildProvenanceKnowledge(proj, { projectName: 'TestProj' });
    const content1 = fs.readFileSync(r1.modelPath, 'utf8');

    const expectedSections = renderLineageSections(projectLineage(readLineageSnapshot(proj)));
    ok(content1.includes(expectedSections.sources.trim()), 'rendered sources section equals core projection render');
    ok(content1.includes(expectedSections.modelRecords.trim()), 'rendered modelRecords section equals core projection render');
    ok(content1.includes(expectedSections.artifacts.trim()), 'rendered artifacts section equals core projection render');

    // 2. No is_synthetic in sources
    ok(!content1.includes('is_synthetic::'), 'no is_synthetic emitted in lineage record');

    // 3. Roles come from names, not folders: a loose file under export/ is no node,
    // while a file that declares upstream sources is an artifact wherever it sits.
    ok(!content1.includes('ignored_artifact'), 'a loose file under the retired export/ is not projected');
    ok(content1.includes('## NN Sources: sample.md'), 'the cognitivized raw file is a Source');
    ok(!content1.includes('## NN Artifacts: sample'), 'the Source does not appear under # NN Artifacts');
    fs.writeFileSync(
      path.join(proj, 'export', 'declares_upstream.md'),
      '---\nsources: ["kNNowledge/Doc_business_NN.md@## NN Items: Spec"]\n---\n# Declares\n',
    );
    const rExport = provenance.buildProvenanceKnowledge(proj, { projectName: 'TestProj' });
    ok(
      fs.readFileSync(rExport.modelPath, 'utf8').includes('## NN Artifacts: declares_upstream'),
      'folder-blind: a file declaring upstream sources is an artifact even under export/',
    );
    fs.rmSync(path.join(proj, 'export', 'declares_upstream.md'));

    // 4. Hand-authored blocks and journal preserved byte-for-byte in refreshExistingModel
    const handAuthoredSection = '\n# NN External Watch Roots\n\n- root: /data/external\n  pattern: **/*.pdf\n';
    const journalEntry = '\n## NN Procedures: trannsform --scan @ 2026-09-01T12:00:00Z\ncommand:: trannsform --scan\n';
    
    // Inject custom section and procedure into content
    let customContent = content1 + handAuthoredSection;
    customContent = customContent.replace('# NN Procedures\n\n<!-- Append-only. One entry per pipeline run (--scan, --import-url). Never regenerated. -->\n', '# NN Procedures\n' + journalEntry);
    fs.writeFileSync(r1.modelPath, customContent, 'utf8');

    const r2 = provenance.buildProvenanceKnowledge(proj, { projectName: 'TestProj' });
    const content2 = fs.readFileSync(r2.modelPath, 'utf8');

    ok(content2.includes(handAuthoredSection.trim()), 'hand-authored block preserved byte-for-byte');
    ok(content2.includes(journalEntry.trim()), 'procedures journal preserved byte-for-byte');

    // 5. Deprecated model / knowledge_version fallback removed
    fs.writeFileSync(
      path.join(proj, 'artifacts', 'legacy_header_artifact.md'),
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

    // 7. The record is a single living file: no version key in its frontmatter, none in the generator source
    ok(!/^knowledge_version:\s/m.test(content3), 'a generated record carries no knowledge_version frontmatter key');
    ok(!/^knowledge_version:\s/m.test(refreshed), 'refreshing a record drops a legacy knowledge_version key');
    const generatorSource = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'lib', 'provenance-knowledge.js'), 'utf8');
    ok(!/knowledge_version|export-meta|sources\/(nn|original|export|archive)\//.test(generatorSource), 'no knowledge_version, export-meta, or retired-folder inference in the generator');

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
  run().then(({ passed, failed }) => {
    console.log(`\nProvenance-knowledge tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
