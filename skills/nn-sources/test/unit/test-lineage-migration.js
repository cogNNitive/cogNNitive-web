const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const provenance = require('../../scripts/provenance');
const { checkLineage } = require('../../scripts/lib/lineage-check');

const { put, cognitivizeAll } = require('./_fixtures');

const LEGACY_RECORD = `---
specification_version: "V_0-2-1"
specification_url: "https://example.com/iNNfo_V_0-2-1_NN.md"
level: 3
parent_spec:
  name: "workspace"
  url: "https://example.com/workspace_spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Legacy Provenance"
---

# NN index

* [[Sources]]
* [[Models]]
* [[Artifacts]]
* [[Procedures]]

# NN Sources

<!-- empty -->

# NN Models

<!-- empty -->

# NN Artifacts

<!-- empty -->

# NN Procedures

## NN Procedures: scan @ 2026-08-01T10:00:00Z
command:: scan
run_at:: 2026-08-01T10:00:00Z
`;

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

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'trannsform-mig-'));
  try {
    // (a) A workspace that already has a hand-authored domaiNN_NN.md manifest
    // must not gain a second manifest, and the scanner must not touch it.
    const proj = path.join(TMP, 'Acme');
    put(proj, 'sources/import/raw.md', '# Raw\ncontent\n');
    await cognitivizeAll(proj, ['sources/import/raw.md']);
    const manifest = '# NN index\n\n* [[Sources]]\n\n# NN Sources\n\n<!-- hand authored -->\n';
    fs.writeFileSync(path.join(proj, 'domaiNN_NN.md'), manifest);

    const r1 = provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    eq(path.basename(r1.modelPath), 'Acme_cogNNitive_NN.md', 'canonical cogNNitive record created');
    eq(
      fs.readFileSync(path.join(proj, 'domaiNN_NN.md'), 'utf8'),
      manifest,
      'hand-authored domaiNN_NN.md manifest left untouched',
    );
    const created = fs.readdirSync(proj).filter((f) => f.endsWith('_workspace_NN.md'));
    eq(created.length, 0, 'no second *_workspace_NN.md manifest is created');
    const record1 = fs.readFileSync(r1.modelPath, 'utf8');
    eq((record1.match(/## NN Sources:/g) || []).length, 1, 'source entry is not duplicated');
    ok(/parent_spec:\s*\n\s*name: "cogNNitive"/.test(record1), 'record conforms to the cogNNitive template');

    // (b) Re-running the build is byte-stable (idempotent).
    provenance.buildProvenanceKnowledge(proj, { projectName: 'Acme' });
    const record2 = fs.readFileSync(r1.modelPath, 'utf8');
    eq(record2, record1, 'second build is byte-identical (idempotent replace)');

    // (c) A legacy <Project>_V_*_workspace_NN.md record is migrated in place.
    const legacyProj = path.join(TMP, 'Legacy');
    put(legacyProj, 'sources/import/raw.md', '# Raw\ncontent\n');
    await cognitivizeAll(legacyProj, ['sources/import/raw.md']);
    fs.writeFileSync(path.join(legacyProj, 'Legacy_V_0-2-0_workspace_NN.md'), LEGACY_RECORD);

    const rL = provenance.buildProvenanceKnowledge(legacyProj, { projectName: 'Legacy' });
    eq(path.basename(rL.modelPath), 'Legacy_V_0-2-0_cogNNitive_NN.md', 'legacy record migrated to the cogNNitive name');
    ok(
      !fs.existsSync(path.join(legacyProj, 'Legacy_V_0-2-0_workspace_NN.md')),
      'legacy filename no longer exists (no dual names)',
    );
    const migrated = fs.readFileSync(rL.modelPath, 'utf8');
    ok(/# NN ModelRecords\b/.test(migrated), 'refresh produces # NN ModelRecords section');
    ok(
      /## NN Procedures: scan @ 2026-08-01T10:00:00Z/.test(migrated),
      'append-only procedure history preserved through migration',
    );
    // (d) Canonical domaiNN workspace with lineage record in kNNowledge/ (Issue #104)
    const domProj = path.join(TMP, 'DomProj');
    fs.mkdirSync(path.join(domProj, 'kNNowledge'), { recursive: true });
    put(domProj, 'sources/import/raw.md', '# Raw\ncontent\n');
    await cognitivizeAll(domProj, ['sources/import/raw.md']);
    const knRecordPath = path.join(domProj, 'kNNowledge', 'DomProj_V_0-1-0_cogNNitive_NN.md');
    fs.writeFileSync(
      knRecordPath,
      LEGACY_RECORD.replace('name: "workspace"', 'name: "cogNNitive"').replace('Legacy Provenance', 'DomProj Provenance'),
    );

    const checkDom = checkLineage(domProj);
    ok(
      !checkDom.errors.some((e) => /No lineage record found/i.test(e)),
      '--check finds lineage record located in kNNowledge/',
    );

    const rD = provenance.buildProvenanceKnowledge(domProj, { projectName: 'DomProj' });
    eq(rD.modelPath.replace(/\\/g, '/'), knRecordPath.replace(/\\/g, '/'), 'build refreshes existing kNNowledge/ record');
    eq(rD.created, false, 'existing kNNowledge/ record not flagged as created');
    ok(
      !fs.existsSync(path.join(domProj, 'DomProj_cogNNitive_NN.md')),
      'no duplicate lineage record created at workspace root',
    );

    // (e) Legacy workspace_NN record inside kNNowledge/ is migrated in place
    const knLegacyProj = path.join(TMP, 'KnLegacy');
    fs.mkdirSync(path.join(knLegacyProj, 'kNNowledge'), { recursive: true });
    put(knLegacyProj, 'sources/import/raw.md', '# Raw\ncontent\n');
    await cognitivizeAll(knLegacyProj, ['sources/import/raw.md']);
    const knLegacyRecordPath = path.join(knLegacyProj, 'kNNowledge', 'KnLegacy_V_0-1-0_workspace_NN.md');
    fs.writeFileSync(knLegacyRecordPath, LEGACY_RECORD);

    const rKnL = provenance.buildProvenanceKnowledge(knLegacyProj, { projectName: 'KnLegacy' });
    const expectedMigrated = path.join(knLegacyProj, 'kNNowledge', 'KnLegacy_V_0-1-0_cogNNitive_NN.md');
    eq(rKnL.modelPath.replace(/\\/g, '/'), expectedMigrated.replace(/\\/g, '/'), 'migrated in-place inside kNNowledge/');
    ok(
      !fs.existsSync(knLegacyRecordPath),
      'legacy workspace_NN in kNNowledge/ removed',
    );
    ok(
      !fs.existsSync(path.join(knLegacyProj, 'KnLegacy_cogNNitive_NN.md')),
      'no duplicate created at root for kNNowledge/ legacy migration',
    );

    fs.rmSync(TMP, { recursive: true, force: true });
    console.log(`\n  Lineage migration tests: ${passed} passed, ${failed} failed`);
  } catch (e) {
    fs.rmSync(TMP, { recursive: true, force: true });
    console.error(`  ERROR: ${e.message}`);
    console.error(e.stack);
    failed++;
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
