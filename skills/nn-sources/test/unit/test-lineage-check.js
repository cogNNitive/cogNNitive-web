const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const { checkLineage } = require('../../scripts/lib/lineage-check');
const provenance = require('../../scripts/provenance');
const { put, cognitivizeAll } = require('./_fixtures');

const PLAN = (cite) =>
  `---\nlevel: 3\nknowledge_version: "V_1-0-0"\nparent_spec:\n  name: "business"\ntitle: "Business Plan"\n---\n# NN Items\n## NN Items: Point 1\nsources:: [${cite}]\n`;

const INDEX = path.resolve(__dirname, '..', '..', 'scripts', 'index.js');

function cli(args) {
  return spawnSync(process.execPath, [INDEX, ...args], { encoding: 'utf8' });
}

function listTree(root) {
  return fs.readdirSync(root, { recursive: true }).map(String).sort();
}

async function run() {
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
    for (const d of ['sources/import', 'kNNowledge', 'artifacts']) {
      fs.mkdirSync(path.join(proj, d), { recursive: true });
    }

    // (a) Record missing check
    const rMissing = checkLineage(proj);
    ok(rMissing.errors.some((e) => /No lineage record found/.test(e)), '(a) reports error when no lineage record exists');

    put(proj, 'sources/import/report.pdf', '%PDF-1.4 fake bytes');
    put(proj, 'sources/import/data.csv', 'id,value\n1,100\n2,200\n');
    await cognitivizeAll(proj, ['sources/import/report.pdf', 'sources/import/data.csv']);
    put(proj, 'kNNowledge/Plan_business_NN.md', PLAN('sources/import/report.pdf_sidecar_NN.md@## Overview, sources/import/data.csv@1'));
    put(
      proj,
      'artifacts/summary_20261002T101500Z.md',
      '---\ntype: "report"\nsources: ["kNNowledge/Plan_business_NN.md@## NN Items: Point 1"]\n---\n# Summary\n',
    );

    provenance.buildProvenanceKnowledge(proj, { projectName: 'CheckProj' });

    const rValid = checkLineage(proj);
    eq(rValid.errors.length, 0, 'a synced workspace has no error');
    eq(rValid.warnings.length, 0, 'a synced workspace has no warning');

    // (b) Dangling citation produces an error via validateCitations
    put(proj, 'kNNowledge/Plan_business_NN.md', PLAN('sources/import/nonexistent.md@## Item'));
    ok(checkLineage(proj).errors.some((e) => /nonexistent\.md/.test(e)), '(b) dangling citation reported as error');
    put(proj, 'kNNowledge/Plan_business_NN.md', PLAN('sources/import/report.pdf_sidecar_NN.md@## Overview, sources/import/data.csv@1'));
    eq(checkLineage(proj).errors.length, 0, '(b) restoring the citation clears the error');

    // (c) A family member on disk with no element in # NN Sources
    put(proj, 'sources/import/data_20261003T080000Z.csv', 'id,value\n1,100\n2,250\n');
    await cognitivizeAll(proj, ['sources/import/data_20261003T080000Z.csv']);
    const unlisted = checkLineage(proj);
    ok(
      unlisted.errors.some((e) => /unlisted/i.test(e) && /data_20261003T080000Z\.csv/.test(e)),
      '(c) a family member missing from # NN Sources is an error',
    );
    provenance.buildProvenanceKnowledge(proj, { projectName: 'CheckProj' });
    eq(checkLineage(proj).errors.length, 0, '(c) syncing the record lists the member');

    // (d) superseded_by pointing at nothing
    const recordPath = path.join(proj, 'CheckProj_cogNNitive_NN.md');
    const record = fs.readFileSync(recordPath, 'utf8');
    ok(/superseded_by:: sources\/import\/data_20261003T080000Z\.csv/.test(record), '(d) setup: the earlier member points at the next one');
    fs.writeFileSync(
      recordPath,
      record.replace('superseded_by:: sources/import/data_20261003T080000Z.csv', 'superseded_by:: sources/import/data_20269999T000000Z.csv'),
    );
    ok(
      checkLineage(proj).errors.some((e) => /superseded_by/.test(e) && /20269999T000000Z/.test(e)),
      '(d) a dangling superseded_by is an error',
    );
    fs.writeFileSync(recordPath, record);
    eq(checkLineage(proj).errors.length, 0, '(d) restoring the record clears it');

    // (e) hash mismatch: raw bytes changed after cognitivizing
    fs.appendFileSync(path.join(proj, 'sources/import/data.csv'), '3,300\n');
    ok(
      checkLineage(proj).errors.some((e) => /hash/i.test(e) && /data\.csv/.test(e)),
      '(e) raw bytes that differ from the sidecar sha256 are an error',
    );
    await cognitivizeAll(proj, ['sources/import/data.csv']);
    const afterRefresh = checkLineage(proj).errors;
    ok(!afterRefresh.some((e) => /hash mismatch/i.test(e)), '(e) cognitivizing again clears the mismatch');
    ok(afterRefresh.some((e) => /drift/i.test(e)), '(e) the record still lists the old hash, which is drift');
    provenance.buildProvenanceKnowledge(proj, { projectName: 'CheckProj' });
    eq(checkLineage(proj).errors.length, 0, '(e) regenerating the record clears the drift');

    // (f) orphaned sidecar: a warning, never an error, nothing is touched
    fs.rmSync(path.join(proj, 'sources/import/report.pdf'));
    put(proj, 'kNNowledge/Plan_business_NN.md', PLAN('sources/import/data.csv@1'));
    provenance.buildProvenanceKnowledge(proj, { projectName: 'CheckProj' });
    const before = listTree(proj);
    const orphan = checkLineage(proj);
    ok(orphan.warnings.some((w) => /orphan/i.test(w) && /report\.pdf_sidecar_NN\.md/.test(w)), '(f) an orphaned sidecar is reported as a warning');
    eq(orphan.errors.length, 0, '(f) an orphaned sidecar does not add an error');
    ok(JSON.stringify(listTree(proj)) === JSON.stringify(before), '(f) nothing is moved, archived or deleted');

    // (g) sources/archive/ is inert: no chain check, no warning
    fs.mkdirSync(path.join(proj, 'sources', 'archive', 'ghost_chain'), { recursive: true });
    const archive = checkLineage(proj);
    ok(!archive.warnings.some((w) => /ghost_chain|archive/i.test(w)), '(g) an empty archive chain directory is not checked');
    ok(!archive.errors.some((e) => /ghost_chain|archive/i.test(e)), '(g) the archive produces no error');

    // (h) Drift gate: managed sections must equal a fresh projection, nothing else is compared
    provenance.buildProvenanceKnowledge(proj, { projectName: 'CheckProj' });
    const synced = fs.readFileSync(recordPath, 'utf8');
    eq(checkLineage(proj).errors.length, 0, '(h) an in-sync record has no drift error');
    eq(cli(['--src', proj, '--lineage', '--check']).status, 0, '(h) --lineage --check exits 0 on an in-sync record');

    fs.writeFileSync(recordPath, synced.replace(/^size:: .*$/m, 'size:: 1'));
    const drifted = checkLineage(proj);
    ok(
      drifted.errors.some((e) => /drift/i.test(e) && /# NN Sources/.test(e)),
      '(h) a hand-edited managed line is a drift error naming the section',
    );
    const drift = cli(['--src', proj, '--lineage', '--check']);
    ok(drift.status !== 0, '(h) --lineage --check exits non-zero on drift');
    ok(/# NN Sources/.test(drift.stderr + drift.stdout), '(h) --lineage --check names the drifted section');
    eq(fs.readFileSync(recordPath, 'utf8'), synced.replace(/^size:: .*$/m, 'size:: 1'), '(h) the check never rewrites the record');

    fs.writeFileSync(
      recordPath,
      synced +
        '\n## NN Procedures: scan @ 2026-10-01T00:00:00Z\ncommand:: scan --edited\n' +
        '\n# NN External Watch Roots\n\n- root: /edited\n',
    );
    eq(checkLineage(proj).errors.length, 0, '(h) journal and hand-authored edits do not drift');
    fs.writeFileSync(recordPath, synced);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    console.error(err.stack);
    failed++;
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then(({ passed, failed }) => {
    console.log(`\nLineage-check tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
