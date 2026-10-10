const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const provenance = require('../../scripts/provenance');
const { put, cognitivizeAll } = require('./_fixtures');

async function run() {
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

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'trannsform-prov-'));
  try {
    // A project with three raw sources cognitivized in place (one nested in a subfolder).
    const proj = path.join(TMP, 'Acme');
    put(proj, 'sources/import/clientA/market-report.docx', 'docx bytes');
    put(proj, 'sources/import/team.csv', 'id,name\n1,Ann\n');
    put(proj, 'sources/import/webpage.html', '<html><body>page</body></html>');
    await cognitivizeAll(proj, [
      'sources/import/clientA/market-report.docx',
      'sources/import/team.csv',
      'sources/import/webpage.html',
    ]);

    const r1 = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    eq(r1.created, true, 'model created on first run');
    eq(r1.sourceCount, 3, 'three sources registered');
    ok(fs.existsSync(r1.modelPath), 'model file written');
    eq(path.basename(r1.modelPath), 'Acme_cogNNitive_NN.md', 'model file named after the cogNNitive lineage template');

    const model1 = fs.readFileSync(r1.modelPath, 'utf8');
    ok(/parent_spec:\s*\n\s*name: "cogNNitive"/.test(model1), 'parent_spec points to the cogNNitive template');
    ok(/## NN Sources: market-report\.docx/.test(model1), 'source element present, named by the raw file');
    ok(/source_format:: docx/.test(model1), 'source_format derived from extension');
    ok(/source_format:: md/.test(model1), 'source_format html mapped to md (declared set only)');
    ok(
      /normalized_content:: sources\/import\/clientA\/market-report\.docx_sidecar_NN\.md/.test(model1),
      'normalized_content is the co-located sidecar, subfolders preserved',
    );
    ok(/raw_filename:: sources\/import\/clientA\/market-report\.docx/.test(model1), 'raw_filename is the subject path');
    ok(!/source_id/.test(model1), 'provenance model never emits source_id');
    ok(!/src-\d{3}/.test(model1), 'provenance model never emits a src-NNN id');
    ok(!/archive_path::|status:: archived|curated_csv::|media_filename::/.test(model1), 'no archive-era fields are emitted');

    // The lineage build does not copy anything into assets/.
    ok(!fs.existsSync(path.join(proj, 'assets')), 'nothing is copied into assets/');

    // semantic index.md written at root
    const idx = fs.readFileSync(path.join(proj, 'index.md'), 'utf8');
    ok(/# NN index/.test(idx), 'semantic index has # NN index');
    ok(/Acme_cogNNitive_NN\.md/.test(idx), 'index links the provenance model');

    // The # NN ModelRecords section is filesystem-managed: a hand-added entry is
    // replaced on the next sync (there are no kNNowledge models yet).
    const withModel = model1.replace(
      /# NN ModelRecords\n\n<!--[\s\S]*?-->\n/,
      '# NN ModelRecords\n\n## NN ModelRecords: Acme Plan\nmodel_template:: business\nsources:: [sources/import/clientA/market-report.docx_sidecar_NN.md]\n',
    );
    fs.writeFileSync(r1.modelPath, withModel);
    // Dropping a source removes the raw file together with its sidecar.
    fs.rmSync(path.join(proj, 'sources', 'import', 'team.csv'));
    fs.rmSync(path.join(proj, 'sources', 'import', 'team.csv_sidecar_NN.md'));

    const r2 = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    eq(r2.created, false, 'model refreshed (not recreated) on second run');
    eq(r2.sourceCount, 2, 'sources refreshed down to two');
    const model2 = fs.readFileSync(r2.modelPath, 'utf8');
    ok(!/## NN ModelRecords: Acme Plan/.test(model2), 'hand-added ModelRecords entry replaced by filesystem sync');
    ok(!/## NN Sources: team\.csv/.test(model2), 'dropped source removed from Sources');

    // --- P5: workspace index.md preserves existing entries, drops dangling, walks nested kNNowledge/ ---
    const idxPath = path.join(proj, 'index.md');
    fs.mkdirSync(path.join(proj, 'kNNowledge', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'kNNowledge', 'sub', 'Deep_Model_V_1-0-0_NN.md'), '# Deep Model\n');
    fs.writeFileSync(path.join(proj, 'kNNowledge', 'Custom_Model_V_2-0-0_NN.md'), '# Custom Model\n');
    fs.writeFileSync(
      idxPath,
      fs.readFileSync(idxPath, 'utf8') +
        '* [My Custom](kNNowledge/Custom_Model_V_2-0-0_NN.md)\n' +
        '* [Gone](kNNowledge/Gone_V_9-9-9_NN.md)\n',
    );

    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    let r3;
    try {
      r3 = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    } finally {
      console.log = origLog;
    }
    eq(r3.created, false, 'model refreshed again on third run');
    const idx3 = fs.readFileSync(idxPath, 'utf8');
    ok(idx3.includes('* [My Custom](kNNowledge/Custom_Model_V_2-0-0_NN.md)'), 'existing index entry preserved with its original label');
    ok(idx3.includes('Acme_cogNNitive_NN.md'), 'discovered provenance model link kept after regeneration');
    ok(idx3.includes('kNNowledge/sub/Deep_Model_V_1-0-0_NN.md'), 'nested model under kNNowledge/sub/ included in index');
    ok(!/Gone/.test(idx3), 'dangling index entry (target removed) dropped');
    ok(logs.some((l) => /regenerated.*dropped 1 dangling/.test(l)), 'regeneration logged the dropped dangling entry');

    // nested model discovery alone (recursive, skips excluded dirs)
    const nested = provenance.listWorkspaceModels(proj);
    ok(nested.includes('./kNNowledge/sub/Deep_Model_V_1-0-0_NN.md'), 'listWorkspaceModels is recursive into kNNowledge/sub/');
    ok(nested.includes('./kNNowledge/Custom_Model_V_2-0-0_NN.md'), 'listWorkspaceModels includes top-level kNNowledge/');
    ok(nested.includes('./Acme_cogNNitive_NN.md'), 'listWorkspaceModels keeps root files prefixed ./');

    // A cognitivized CSV is one Source entry: no curated_csv twin, no duplicate.
    const csvProj = path.join(TMP, 'CsvProj');
    put(csvProj, 'sources/import/links.csv', 'id,url\n1,a\n');
    await cognitivizeAll(csvProj, ['sources/import/links.csv']);
    const rCsv = provenance.buildProvenanceKnowledge(csvProj, { projectName: 'CsvProj' });
    const csvModel = fs.readFileSync(rCsv.modelPath, 'utf8');
    ok(/## NN Sources: links\.csv/.test(csvModel), 'CSV source entry present');
    ok(!/curated_csv::/.test(csvModel), 'curated_csv is no longer a Source field');
    eq((csvModel.match(/## NN Sources:/g) || []).length, 1, 'a CSV and its sidecar are one source entry');
    ok(
      /normalized_content:: sources\/import\/links\.csv_sidecar_NN\.md/.test(csvModel),
      'the CSV Source points at its co-located sidecar',
    );

    console.log(`\n  Provenance tests: ${passed} passed, ${failed} failed`);
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    console.error(e.stack);
    failed++;
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
