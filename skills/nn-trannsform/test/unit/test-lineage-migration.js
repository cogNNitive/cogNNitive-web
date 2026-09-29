const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const provenance = require('../../scripts/provenance');

const SRC_FM = (sourceFile, hash) => `---
source_file: "${sourceFile}"
sha256: "${hash}"
size_bytes: 123
normalized_at: "2026-08-01T10:00:00Z"
normalized_by: "traNNsform v1.5"
---

# Body
content
`;

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

function run() {
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
    fs.mkdirSync(path.join(proj, 'sources', 'nn'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'sources', 'nn', 'raw.md'), SRC_FM('sources/import/raw.txt', 'aaa'));
    const manifest = '# NN index\n\n* [[Sources]]\n\n# NN Sources\n\n<!-- hand authored -->\n';
    fs.writeFileSync(path.join(proj, 'domaiNN_NN.md'), manifest);

    const r1 = provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    eq(path.basename(r1.modelPath), 'Acme_V_0-2-0_cogNNitive_NN.md', 'canonical cogNNitive record created');
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
    provenance.buildProvenanceModel(proj, { projectName: 'Acme' });
    const record2 = fs.readFileSync(r1.modelPath, 'utf8');
    eq(record2, record1, 'second build is byte-identical (idempotent replace)');

    // (c) A legacy <Project>_V_*_workspace_NN.md record is migrated in place.
    const legacyProj = path.join(TMP, 'Legacy');
    fs.mkdirSync(path.join(legacyProj, 'sources', 'nn'), { recursive: true });
    fs.writeFileSync(path.join(legacyProj, 'sources', 'nn', 'raw.md'), SRC_FM('sources/import/raw.txt', 'bbb'));
    fs.writeFileSync(path.join(legacyProj, 'Legacy_V_0-2-0_workspace_NN.md'), LEGACY_RECORD);

    const rL = provenance.buildProvenanceModel(legacyProj, { projectName: 'Legacy' });
    eq(path.basename(rL.modelPath), 'Legacy_V_0-2-0_cogNNitive_NN.md', 'legacy record migrated to the cogNNitive name');
    ok(
      !fs.existsSync(path.join(legacyProj, 'Legacy_V_0-2-0_workspace_NN.md')),
      'legacy filename no longer exists (no dual names)',
    );
    const migrated = fs.readFileSync(rL.modelPath, 'utf8');
    ok(/# NN ModelRecords\b/.test(migrated), 'legacy # NN Models heading migrated to # NN ModelRecords');
    ok(!/^# NN Models\b/m.test(migrated), 'no stale # NN Models heading remains');
    ok(/\* \[\[ModelRecords\]\]/.test(migrated), 'index wiki link migrated to [[ModelRecords]]');
    ok(
      /## NN Procedures: scan @ 2026-08-01T10:00:00Z/.test(migrated),
      'append-only procedure history preserved through migration',
    );
    eq(rL.created, false, 'migrated record is refreshed, not treated as newly created');

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
  const result = run();
  process.exit(result.failed > 0 ? 1 : 0);
}
