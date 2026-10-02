const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const provenance = require('../../scripts/provenance');
const { checkLineage } = require('../../scripts/lib/lineage-check');

function run() {
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
    for (const d of ['sources/nn', 'kNNowledge', 'export']) {
      fs.mkdirSync(path.join(proj, d), { recursive: true });
    }
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'report.md'),
      '---\nsource_file: "sources/import/report.pdf"\nsha256: "a"\nsize_bytes: 1\nnormalized_at: "x"\nnormalized_by: "t"\n---\n\n# Overview\n',
    );
    fs.writeFileSync(
      path.join(proj, 'kNNowledge', 'Plan_V_1-0-0_NN.md'),
      '---\nlevel: 3\nknowledge_version: "V_1-0-0"\nparent_spec:\n  name: "business_V_0-1-0"\ntitle: "Business Plan"\n---\n\n# NN Stakeholders\n\n## NN Stakeholders: Clients\nsources:: [sources/nn/report.md@# Overview]\n',
    );
    fs.writeFileSync(
      path.join(proj, 'export', 'Exec_Summary_V_1-0-0.md'),
      '---\ntype: "report"\nsources: ["kNNowledge/Plan_V_1-0-0_NN.md@## NN Stakeholders: Clients"]\n---\n\n# Executive Summary\n',
    );

    // First build.
    const r1 = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const m1 = fs.readFileSync(r1.modelPath, 'utf8');
    ok(r1.modelCount === 1 && r1.artifactCount === 1, 'build reports 1 model + 1 artifact');
    ok(/## NN ModelRecords: Business Plan/.test(m1), '# NN ModelRecords entry rendered from kNNowledge/');
    ok(
      /model_ref:: kNNowledge\/Plan_V_1-0-0_NN\.md/.test(m1) &&
        /derived_from:: \[sources\/nn\/report\.md@# Overview\]/.test(m1),
      'model entry carries model_ref + derived_from from sources::',
    );
    ok(
      /## NN Artifacts: Exec_Summary_V_1-0-0/.test(m1) &&
        /derived_from:: \[kNNowledge\/Plan_V_1-0-0_NN\.md@## NN Stakeholders: Clients\]/.test(m1),
      '# NN Artifacts entry rendered with derived_from citation',
    );
    ok(/# NN Procedures/.test(m1), '# NN Procedures section present (empty placeholder)');

    // Idempotent re-run: managed sections byte-identical.
    const r2 = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const m2 = fs.readFileSync(r2.modelPath, 'utf8');
    const managed = (s) => s.slice(s.indexOf('# NN Sources'), s.indexOf('# NN Procedures'));
    ok(managed(m1) === managed(m2), 'managed sections byte-identical on idempotent re-run');

    // Append a procedure run — survives a later section refresh.
    provenance.appendProcedureRun(proj, { command: 'scan', inputs: ['sources/import/'], outputs: ['sources/nn/'] });
    provenance.appendProcedureRun(proj, { command: 'apply Foo', inputs: ['kNNowledge/'], outputs: ['export/'] });
    let mp = fs.readFileSync(r1.modelPath, 'utf8');
    ok((mp.match(/## NN Procedures:/g) || []).length === 2, 'two procedure entries appended');
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    mp = fs.readFileSync(r1.modelPath, 'utf8');
    ok((mp.match(/## NN Procedures:/g) || []).length === 2, 'section refresh preserves procedure history');

    // Remove the model → drops out of # NN ModelRecords.
    fs.rmSync(path.join(proj, 'kNNowledge', 'Plan_V_1-0-0_NN.md'));
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const m3 = fs.readFileSync(r1.modelPath, 'utf8');
    ok(!/## NN ModelRecords: Business Plan/.test(m3), 'removed model drops out of # NN ModelRecords');

    // --check drift: artifact still cites the now-missing model.
    const drift = checkLineage(proj);
    ok(
      drift.errors.some((e) => /Plan_V_1-0-0_NN\.md/.test(e)),
      '--check flags the artifact citing a now-absent model',
    );

    // Restore the model, add a dangling sources:: — --check catches it.
    fs.writeFileSync(
      path.join(proj, 'kNNowledge', 'Plan_V_1-0-0_NN.md'),
      '---\nlevel: 3\nknowledge_version: "V_1-0-0"\ntitle: "Business Plan"\n---\n\n# NN S\n\n## NN S: X\nsources:: [sources/nn/ghost.md@# Nowhere]\n',
    );
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const drift2 = checkLineage(proj);
    ok(drift2.errors.some((e) => /ghost\.md/.test(e)), '--check flags a dangling sources:: pointer');

    // Clean workspace → no errors.
    fs.writeFileSync(
      path.join(proj, 'kNNowledge', 'Plan_V_1-0-0_NN.md'),
      '---\nlevel: 3\nknowledge_version: "V_1-0-0"\ntitle: "Business Plan"\n---\n\n# NN S\n\n## NN S: X\nsources:: [sources/nn/report.md@# Overview]\n',
    );
    fs.rmSync(path.join(proj, 'export', 'Exec_Summary_V_1-0-0.md'));
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    ok(checkLineage(proj).errors.length === 0, '--check clean on a synced workspace');

    // Test export/ promotion & sidecar in # NN Sources
    fs.writeFileSync(
      path.join(proj, 'export', 'Proposal_V_1-0-0.md'),
      '---\ntype: "proposal"\nsources: ["kNNowledge/Plan_V_1-0-0_NN.md@## NN S: X"]\n---\n\n# Proposal\n',
    );
    fs.mkdirSync(path.join(proj, 'sources', 'export'), { recursive: true });
    fs.writeFileSync(
      path.join(proj, 'sources', 'export', 'synthetic_brief.md'),
      '---\nsource_file: "sources/export/synthetic_brief.md"\nsha256: "b"\nsize_bytes: 2\nsources: ["kNNowledge/Plan_V_1-0-0_NN.md@## NN S: X"]\nnormalized_at: "y"\nnormalized_by: "t"\n---\n\n# Brief\n',
    );
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const mExport = fs.readFileSync(r1.modelPath, 'utf8');
    ok(/## NN Artifacts: Proposal_V_1-0-0/.test(mExport), 'deliverable in export/ rendered under # NN Artifacts');
    ok(/artifact_ref:: export\/Proposal_V_1-0-0\.md/.test(mExport), 'artifact_ref points to export/');
    ok(!/is_synthetic:: true/.test(mExport), '# NN Sources does NOT include is_synthetic');
    ok(/derived_from:: \[kNNowledge\/Plan_V_1-0-0_NN\.md@## NN S: X\]/.test(mExport), '# NN Sources includes derived_from for promoted export source');

    // Test 2.1: Lineage version metadata on active and archived sources
    fs.mkdirSync(path.join(proj, 'sources', 'archive', 'report', 'V1'), { recursive: true });
    fs.writeFileSync(
      path.join(proj, 'sources', 'archive', 'report', 'V1', 'report.md'),
      '---\nsource_file: "sources/import/report.pdf"\nsha256: "v1hash"\nsize_bytes: 100\nnormalized_at: "2026-09-01T00:00:00Z"\nnormalized_by: "traNNsform v1.0.0"\n---\n\n# Old Report\n',
    );
    // Active file in sources/nn/report.md is at V2
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'report.md'),
      '---\nsource_file: "sources/import/report.pdf"\nsha256: "v2hash"\nsize_bytes: 150\nnormalized_at: "2026-09-06T00:00:00Z"\nnormalized_by: "traNNsform v1.0.0"\n---\n\n# Current Report\n\n# Overview\n',
    );

    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const mVersions = fs.readFileSync(r1.modelPath, 'utf8');

    // Assert active element carries version:: V2 and archive_path::
    ok(/## NN Sources: report\.pdf\r?\n/.test(mVersions), 'active element header has raw basename');
    ok(/version:: V2/.test(mVersions), 'active element carries version:: V2');
    ok(/archive_path:: sources\/archive\/report\/V1\/report\.md/.test(mVersions), 'active element carries archive_path::');

    // Assert archived element carries status:: archived, version:: V1, superseded_by::
    ok(/## NN Sources: report\.pdf V1\r?\n/.test(mVersions), 'archived element header has version suffix');
    ok(/status:: archived/.test(mVersions), 'archived element carries status:: archived');
    ok(/normalized_content:: sources\/archive\/report\/V1\/report\.md/.test(mVersions), 'archived element points to archive snapshot');
    ok(/superseded_by:: report\.pdf V2/.test(mVersions), 'archived element has superseded_by:: report.pdf V2');

    // Idempotent refresh is byte-identical
    const rIdemp = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const mIdemp = fs.readFileSync(rIdemp.modelPath, 'utf8');
    ok(mVersions === mIdemp, 'lineage model with version metadata is byte-identical on idempotent re-run');

    // Clean archive check passes
    const checkClean = checkLineage(proj);
    ok(checkClean.errors.length === 0, '--check clean with valid archive and active sources');

    // Orphan chain directory triggers warning
    fs.mkdirSync(path.join(proj, 'sources', 'archive', 'abandoned_chain'), { recursive: true });
    const checkOrphanChain = checkLineage(proj);
    ok(checkOrphanChain.warnings.some((w) => /orphan.*abandoned_chain/i.test(w)), '--check reports warning for orphan archive chain');
    fs.rmSync(path.join(proj, 'sources', 'archive', 'abandoned_chain'), { recursive: true, force: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const r = run();
  process.exit(r.failed > 0 ? 1 : 0);
}
