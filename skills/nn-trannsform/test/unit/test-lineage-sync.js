const fs = require('fs');
const os = require('os');
const path = require('path');

const provenance = require('../../scripts/provenance');
const { checkLineage } = require('../../scripts/lib/lineage-check');
const { put, cognitivizeAll } = require('./_fixtures');

const PLAN = (cite) =>
  `---\nlevel: 3\nknowledge_version: "V_1-0-0"\nparent_spec:\n  name: "business"\ntitle: "Business Plan"\n---\n\n# NN Stakeholders\n\n## NN Stakeholders: Clients\nsources:: [${cite}]\n`;

async function run() {
  let passed = 0;
  let failed = 0;
  const ok = (cond, msg) => {
    if (cond) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.log(`  FAIL: ${msg}`);
      failed++;
    }
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-lineage-'));
  try {
    const proj = path.join(tmp, 'Acme');
    for (const d of ['sources/import', 'kNNowledge', 'artifacts']) {
      fs.mkdirSync(path.join(proj, d), { recursive: true });
    }
    put(proj, 'sources/import/report.pdf', '%PDF-1.4 fake bytes');
    await cognitivizeAll(proj, ['sources/import/report.pdf']);
    const CITE = 'sources/import/report.pdf_sidecar_NN.md@## Overview';
    put(proj, 'kNNowledge/Plan_business_NN.md', PLAN(CITE));
    put(
      proj,
      'artifacts/Exec_Summary_20261002T101500Z.md',
      '---\ntype: "report"\nsources: ["kNNowledge/Plan_business_NN.md@## NN Stakeholders: Clients"]\n---\n\n# Executive Summary\n',
    );

    // First build.
    const r1 = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const m1 = fs.readFileSync(r1.modelPath, 'utf8');
    ok(r1.sourceCount === 1 && r1.modelCount === 1 && r1.artifactCount === 1, 'build reports 1 source + 1 model + 1 artifact');
    ok(/## NN ModelRecords: Business Plan/.test(m1), '# NN ModelRecords entry rendered from kNNowledge/');
    ok(
      /model_ref:: kNNowledge\/Plan_business_NN\.md/.test(m1) &&
        /derived_from:: \[sources\/import\/report\.pdf_sidecar_NN\.md@## Overview\]/.test(m1),
      'model entry carries model_ref + derived_from from sources::',
    );
    ok(
      /## NN Artifacts: Exec_Summary_20261002T101500Z/.test(m1) &&
        /derived_from:: \[kNNowledge\/Plan_business_NN\.md@## NN Stakeholders: Clients\]/.test(m1),
      '# NN Artifacts entry rendered with derived_from citation',
    );
    ok(/# NN Procedures/.test(m1), '# NN Procedures section present (empty placeholder)');

    // Idempotent re-run: managed sections byte-identical.
    const r2 = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const m2 = fs.readFileSync(r2.modelPath, 'utf8');
    const managed = (s) => s.slice(s.indexOf('# NN Sources'), s.indexOf('# NN Procedures'));
    ok(managed(m1) === managed(m2), 'managed sections byte-identical on idempotent re-run');

    // Append a procedure run: it survives a later section refresh.
    provenance.appendProcedureRun(proj, { command: 'scan', inputs: ['sources/import/'], outputs: ['sources/import/*_sidecar_NN.md'] });
    provenance.appendProcedureRun(proj, { command: 'apply Foo', inputs: ['kNNowledge/'], outputs: ['artifacts/'] });
    let mp = fs.readFileSync(r1.modelPath, 'utf8');
    ok((mp.match(/## NN Procedures:/g) || []).length === 2, 'two procedure entries appended');
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    mp = fs.readFileSync(r1.modelPath, 'utf8');
    ok((mp.match(/## NN Procedures:/g) || []).length === 2, 'section refresh preserves procedure history');

    // Remove the model: it drops out of # NN ModelRecords.
    fs.rmSync(path.join(proj, 'kNNowledge', 'Plan_business_NN.md'));
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const m3 = fs.readFileSync(r1.modelPath, 'utf8');
    ok(!/## NN ModelRecords: Business Plan/.test(m3), 'removed model drops out of # NN ModelRecords');

    // --check drift: the artifact still cites the now-missing model.
    const drift = checkLineage(proj);
    ok(
      drift.errors.some((e) => /Plan_business_NN\.md/.test(e)),
      '--check flags the artifact citing a now-absent model',
    );

    // Restore the model with a dangling sources:: pointer: --check catches it.
    put(proj, 'kNNowledge/Plan_business_NN.md', PLAN('sources/import/ghost.md@# Nowhere'));
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const drift2 = checkLineage(proj);
    ok(drift2.errors.some((e) => /ghost\.md/.test(e)), '--check flags a dangling sources:: pointer');

    // Clean workspace: no errors.
    put(proj, 'kNNowledge/Plan_business_NN.md', PLAN(CITE));
    fs.rmSync(path.join(proj, 'artifacts', 'Exec_Summary_20261002T101500Z.md'));
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    ok(checkLineage(proj).errors.length === 0, '--check clean on a synced workspace');

    // A deliverable in artifacts/ and a reused artifact cognitivized in place.
    put(
      proj,
      'artifacts/Proposal_20261002T101500Z.md',
      '---\ntype: "proposal"\nsources: ["kNNowledge/Plan_business_NN.md@## NN Stakeholders: Clients"]\n---\n\n# Proposal\n',
    );
    put(
      proj,
      'artifacts/Brief_20261002T111500Z.md',
      '---\nsources: ["kNNowledge/Plan_business_NN.md@## NN Stakeholders: Clients"]\n---\n\n# Brief\n',
    );
    await cognitivizeAll(proj, ['artifacts/Brief_20261002T111500Z.md']);
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const mReuse = fs.readFileSync(r1.modelPath, 'utf8');
    ok(/## NN Artifacts: Proposal_20261002T101500Z/.test(mReuse), 'deliverable in artifacts/ rendered under # NN Artifacts');
    ok(/artifact_ref:: artifacts\/Proposal_20261002T101500Z\.md/.test(mReuse), 'artifact_ref points to artifacts/');
    ok(!/is_synthetic:: true/.test(mReuse), '# NN Sources does NOT include is_synthetic');
    ok(/## NN Sources: Brief_20261002T111500Z\.md/.test(mReuse), 'a reused artifact becomes a Source once it has a sidecar');
    ok(!/## NN Artifacts: Brief_20261002T111500Z/.test(mReuse), 'it does not appear twice (no duplicate under # NN Artifacts)');
    ok(
      /derived_from:: \[kNNowledge\/Plan_business_NN\.md@## NN Stakeholders: Clients\]/.test(mReuse),
      '# NN Sources keeps the reused artifact upstream edge (its own sources:)',
    );

    // Lineage version metadata: family members.
    put(proj, 'sources/import/metrics.csv', 'id,value\n1,10\n');
    put(proj, 'sources/import/metrics_20261003T080000Z.csv', 'id,value\n1,20\n');
    await cognitivizeAll(proj, ['sources/import/metrics.csv', 'sources/import/metrics_20261003T080000Z.csv']);
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const mVersions = fs.readFileSync(r1.modelPath, 'utf8');

    const v1 = mVersions.slice(mVersions.indexOf('## NN Sources: metrics.csv'));
    ok(/## NN Sources: metrics\.csv\r?\n/.test(mVersions), 'earlier member header is the raw basename');
    ok(/version:: V1[\s\S]*?superseded_by:: sources\/import\/metrics_20261003T080000Z\.csv/.test(v1), 'earlier member is V1 and points at the next member');
    const v2 = mVersions.slice(mVersions.indexOf('## NN Sources: metrics_20261003T080000Z.csv'));
    ok(/version:: V2/.test(v2.split('\n## ')[0]) && !/superseded_by::/.test(v2.split('\n## ')[0]), 'latest member is V2 with no superseded_by');
    ok(!/archive_path::|status:: archived|curated_csv::|media_filename::/.test(mVersions), 'no archive-era fields are emitted');

    const rIdemp = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    ok(mVersions === fs.readFileSync(rIdemp.modelPath, 'utf8'), 'lineage record with version metadata is byte-identical on idempotent re-run');
    ok(checkLineage(proj).errors.length === 0, '--check clean with family members and a reused artifact');

    // sources/archive/ is inert: --check does not look into it.
    fs.mkdirSync(path.join(proj, 'sources', 'archive', 'abandoned_chain'), { recursive: true });
    ok(checkLineage(proj).warnings.every((w) => !/abandoned_chain/.test(w)), '--check reports no archive chain warning');
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    console.error(err.stack);
    failed++;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.failed > 0 ? 1 : 0));
}
