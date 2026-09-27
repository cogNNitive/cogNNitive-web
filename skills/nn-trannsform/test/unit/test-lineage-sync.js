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
    for (const d of ['sources/nn', 'models', 'artifacts']) {
      fs.mkdirSync(path.join(proj, d), { recursive: true });
    }
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'report.md'),
      '---\nsource_file: "sources/original/report.pdf"\nsha256: "a"\nsize_bytes: 1\nnormalized_at: "x"\nnormalized_by: "t"\n---\n\n# Overview\n',
    );
    fs.writeFileSync(
      path.join(proj, 'models', 'Plan_V_1-0-0_NN.md'),
      '---\nlevel: 3\nmodel_version: "V_1-0-0"\nparent_spec:\n  name: "business_V_0-1-0"\ntitle: "Business Plan"\n---\n\n# NN Stakeholders\n\n## NN Stakeholders: Clients\nsources:: [report.md#overview]\n',
    );
    fs.writeFileSync(
      path.join(proj, 'artifacts', 'Exec_Summary_V_1-0-0.md'),
      '---\nmodel: "Business Plan"\nmodel_version: "V_1-0-0"\ntype: "report"\n---\n\n# Executive Summary\n',
    );

    // First build.
    const r1 = provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    const m1 = fs.readFileSync(r1.modelPath, 'utf8');
    ok(r1.modelCount === 1 && r1.artifactCount === 1, 'build reports 1 model + 1 artifact');
    ok(/## NN Models: Business Plan/.test(m1), '# NN Models entry rendered from models/');
    ok(
      /model_ref:: models\/Plan_V_1-0-0_NN\.md/.test(m1) &&
        /derived_from:: \[report\.md#overview\]/.test(m1),
      'model entry carries model_ref + derived_from from sources::',
    );
    ok(
      /## NN Artifacts: Exec_Summary_V_1-0-0/.test(m1) &&
        /derived_from:: \[Business Plan V_1-0-0\]/.test(m1),
      '# NN Artifacts entry rendered with derived_from model+version',
    );
    ok(/# NN Procedures/.test(m1), '# NN Procedures section present (empty placeholder)');

    // Idempotent re-run: managed sections byte-identical.
    const r2 = provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    const m2 = fs.readFileSync(r2.modelPath, 'utf8');
    const managed = (s) => s.slice(s.indexOf('# NN Sources'), s.indexOf('# NN Procedures'));
    ok(managed(m1) === managed(m2), 'managed sections byte-identical on idempotent re-run');

    // Append a procedure run — survives a later section refresh.
    provenance.appendProcedureRun(proj, { command: 'scan', inputs: ['sources/original/'], outputs: ['sources/nn/'] });
    provenance.appendProcedureRun(proj, { command: 'apply Foo', inputs: ['models/'], outputs: ['artifacts/'] });
    let mp = fs.readFileSync(r1.modelPath, 'utf8');
    ok((mp.match(/## NN Procedures:/g) || []).length === 2, 'two procedure entries appended');
    provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    mp = fs.readFileSync(r1.modelPath, 'utf8');
    ok((mp.match(/## NN Procedures:/g) || []).length === 2, 'section refresh preserves procedure history');

    // Remove the model → drops out of # NN Models.
    fs.rmSync(path.join(proj, 'models', 'Plan_V_1-0-0_NN.md'));
    provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    const m3 = fs.readFileSync(r1.modelPath, 'utf8');
    ok(!/## NN Models: Business Plan/.test(m3), 'removed model drops out of # NN Models');

    // --check drift: artifact still cites the now-missing model.
    const drift = checkLineage(proj);
    ok(
      drift.errors.some((e) => /Business Plan/.test(e)),
      '--check flags the artifact citing a now-absent model',
    );

    // Restore the model, add a dangling sources:: — --check catches it.
    fs.writeFileSync(
      path.join(proj, 'models', 'Plan_V_1-0-0_NN.md'),
      '---\nlevel: 3\nmodel_version: "V_1-0-0"\ntitle: "Business Plan"\n---\n\n# NN S\n\n## NN S: X\nsources:: [ghost.md#nowhere]\n',
    );
    provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    const drift2 = checkLineage(proj);
    ok(drift2.errors.some((e) => /ghost\.md/.test(e)), '--check flags a dangling sources:: pointer');

    // Clean workspace → no errors.
    fs.writeFileSync(
      path.join(proj, 'models', 'Plan_V_1-0-0_NN.md'),
      '---\nlevel: 3\nmodel_version: "V_1-0-0"\ntitle: "Business Plan"\n---\n\n# NN S\n\n## NN S: X\nsources:: [report.md#overview]\n',
    );
    fs.rmSync(path.join(proj, 'artifacts', 'Exec_Summary_V_1-0-0.md'));
    provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    ok(checkLineage(proj).errors.length === 0, '--check clean on a synced workspace');

    // Test export/ promotion & is_synthetic in # NN Sources
    fs.mkdirSync(path.join(proj, 'export'), { recursive: true });
    fs.writeFileSync(
      path.join(proj, 'export', 'Proposal_V_1-0-0.md'),
      '---\nmodel: "Business Plan"\nmodel_version: "V_1-0-0"\ntype: "proposal"\n---\n\n# Proposal\n',
    );
    fs.mkdirSync(path.join(proj, 'sources', 'nn', 'export'), { recursive: true });
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'export', 'synthetic_brief.md'),
      '---\nsource_file: "sources/export/synthetic_brief.md"\nsha256: "b"\nsize_bytes: 2\nis_synthetic: true\nderived_from: [Plan_V_1-0-0_NN.md]\nnormalized_at: "y"\nnormalized_by: "t"\n---\n\n# Brief\n',
    );
    provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    const mExport = fs.readFileSync(r1.modelPath, 'utf8');
    ok(/## NN Artifacts: Proposal_V_1-0-0/.test(mExport), 'deliverable in export/ rendered under # NN Artifacts');
    ok(/artifact_ref:: export\/Proposal_V_1-0-0\.md/.test(mExport), 'artifact_ref points to export/');
    ok(/is_synthetic:: true/.test(mExport), '# NN Sources includes is_synthetic:: true for synthetic source');
    ok(/derived_from:: \[Plan_V_1-0-0_NN\.md\]/.test(mExport), '# NN Sources includes derived_from for synthetic source');

    // Test 2.1: Lineage version metadata on active and archived sources
    // Create an archive snapshot for report: sources/archive/report/V1/report.md
    fs.mkdirSync(path.join(proj, 'sources', 'archive', 'report', 'V1'), { recursive: true });
    fs.writeFileSync(
      path.join(proj, 'sources', 'archive', 'report', 'V1', 'report.md'),
      '---\nsource_file: "sources/original/report.pdf"\nsha256: "v1hash"\nsize_bytes: 100\nnormalized_at: "2026-09-01T00:00:00Z"\nnormalized_by: "traNNsform v1.0.0"\n---\n\n# Old Report\n',
    );
    // Active file in sources/nn/report.md is at V2
    fs.writeFileSync(
      path.join(proj, 'sources', 'nn', 'report.md'),
      '---\nsource_file: "sources/original/report.pdf"\nsha256: "v2hash"\nsize_bytes: 150\nnormalized_at: "2026-09-06T00:00:00Z"\nnormalized_by: "traNNsform v1.0.0"\n---\n\n# Current Report\n',
    );

    provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
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
    const rIdemp = provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    const mIdemp = fs.readFileSync(rIdemp.modelPath, 'utf8');
    ok(mVersions === mIdemp, 'lineage model with version metadata is byte-identical on idempotent re-run');

    // Test 2.2: --check archive diagnostics
    // Subtest 2.2A: Clean archive check passes
    const checkClean = checkLineage(proj);
    ok(checkClean.errors.length === 0, '--check clean with valid archive and active sources');

    // Subtest 2.2B: Unlisted snapshot on disk triggers error
    fs.mkdirSync(path.join(proj, 'sources', 'archive', 'report', 'V2'), { recursive: true });
    fs.writeFileSync(
      path.join(proj, 'sources', 'archive', 'report', 'V2', 'report.md'),
      '---\nsource_file: "sources/original/report.pdf"\nsha256: "v2snapshot"\nsize_bytes: 120\n---\n# Unlisted\n',
    );
    const checkUnlisted = checkLineage(proj);
    ok(checkUnlisted.errors.some((e) => /unlisted|sources\/archive\/report\/V2/i.test(e)), '--check flags unlisted archive snapshot');
    fs.rmSync(path.join(proj, 'sources', 'archive', 'report', 'V2'), { recursive: true, force: true });

    // Subtest 2.2C: Dangling archive_path triggers error
    const modelWithDangling = mVersions.replace(
      'archive_path:: sources/archive/report/V1/report.md',
      'archive_path:: sources/archive/report/V99/report.md',
    );
    fs.writeFileSync(r1.modelPath, modelWithDangling);
    const checkDanglingArchive = checkLineage(proj);
    ok(checkDanglingArchive.errors.some((e) => /dangling|archive_path|V99/i.test(e)), '--check flags dangling archive_path');

    // Subtest 2.2D: Dangling superseded_by triggers error
    const modelWithDanglingSup = mVersions.replace(
      'superseded_by:: report.pdf V2',
      'superseded_by:: nonexistent_source.csv V99',
    );
    fs.writeFileSync(r1.modelPath, modelWithDanglingSup);
    const checkDanglingSup = checkLineage(proj);
    ok(checkDanglingSup.errors.some((e) => /superseded_by|nonexistent_source/i.test(e)), '--check flags dangling superseded_by');

    // Subtest 2.2E: Hash mismatch triggers error
    const modelWithHashMismatch = mVersions.replace(
      'raw_hash:: v1hash',
      'raw_hash:: tampered_wrong_hash',
    );
    fs.writeFileSync(r1.modelPath, modelWithHashMismatch);
    const checkHashMismatch = checkLineage(proj);
    ok(checkHashMismatch.errors.some((e) => /mismatch|hash/i.test(e)), '--check flags archived element hash mismatch');

    // Restore valid lineage record
    fs.writeFileSync(r1.modelPath, mVersions);

    // Subtest 2.2F: Orphan chain directory triggers warning
    fs.mkdirSync(path.join(proj, 'sources', 'archive', 'abandoned_chain', 'V1'), { recursive: true });
    const checkOrphanChain = checkLineage(proj);
    ok(checkOrphanChain.warnings.some((w) => /orphan.*abandoned_chain/i.test(w)), '--check reports warning for orphan archive chain');
    ok(checkOrphanChain.errors.filter(e => !/abandoned_chain/i.test(e)).length === 0, 'orphan chain does not generate error for itself');
    fs.rmSync(path.join(proj, 'sources', 'archive', 'abandoned_chain'), { recursive: true, force: true });

    // Test 2.3: Artifact staleness diagnostic — drift vs. missing model (A2)
    // Subtest 2.3A: version-drifted-but-existing model -> warning, not error, exit-zero-worthy
    const modelWithDriftedArtifact = mVersions.replace(
      'derived_from:: [Business Plan V_1-0-0]',
      'derived_from:: [Business Plan V_0-9-0]',
    );
    fs.writeFileSync(r1.modelPath, modelWithDriftedArtifact);
    const checkDrifted = checkLineage(proj);
    ok(
      checkDrifted.warnings.some(
        (w) => /Business Plan/.test(w) && /V_0-9-0/.test(w) && /V_1-0-0/.test(w) && /stale/i.test(w),
      ),
      '--check flags a version-drifted artifact as a distinct staleness warning naming both versions',
    );
    ok(
      !checkDrifted.errors.some((e) => /Business Plan/.test(e)),
      'a version-drifted (but existing) model does not also produce an error',
    );

    // Subtest 2.3B: unknown model name still stays an error (regression guard)
    const modelWithUnknownArtifact = mVersions.replace(
      'derived_from:: [Business Plan V_1-0-0]',
      'derived_from:: [Nonexistent_Model V_1-0-0]',
    );
    fs.writeFileSync(r1.modelPath, modelWithUnknownArtifact);
    const checkUnknown = checkLineage(proj);
    ok(
      checkUnknown.errors.some((e) => /Nonexistent_Model/.test(e)),
      'an unknown model name keeps the existing error',
    );
    ok(
      !checkUnknown.warnings.some((w) => /Nonexistent_Model/.test(w)),
      'an unknown model name does not also produce a staleness warning',
    );

    // Subtest 2.3C: missing-model error and drifted-model warning reported independently
    const modelWithBoth = mVersions
      .replace(
        'derived_from:: [Business Plan V_1-0-0]',
        'derived_from:: [Business Plan V_0-9-0]',
      )
      .replace(
        '## NN Artifacts: Proposal_V_1-0-0',
        '## NN Artifacts: Proposal_V_1-0-0\nmodel_ref:: models/Ghost_V_1-0-0_NN.md\nderived_from:: [Ghost_Model V_1-0-0]\n## NN Artifacts: Ghost_Artifact_V_1-0-0',
      );
    fs.writeFileSync(r1.modelPath, modelWithBoth);
    const checkBoth = checkLineage(proj);
    ok(
      checkBoth.errors.some((e) => /Ghost_Model/.test(e)) &&
        checkBoth.errors.filter((e) => /Ghost_Model|Business Plan/.test(e)).length === 1,
      'missing-model error is reported once, independently of the drift warning',
    );
    ok(
      checkBoth.warnings.some((w) => /Business Plan/.test(w) && /stale/i.test(w)),
      'drift warning is reported independently of the missing-model error',
    );

    // Restore valid lineage record for any subsequent assertions.
    fs.writeFileSync(r1.modelPath, mVersions);
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
