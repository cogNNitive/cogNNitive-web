const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { listWorkspaceModels, deriveIndexLabel } = require('../../scripts/lib/workspace-index');
const guards = require('../../scripts/lib/duplicate-guards');
const { findFamilyManifest } = require('../../scripts/lib/convergence-delta');
const { scanAllWatchRoots } = require('../../scripts/lib/external-scanner');
const { groupSourceFamilies } = require('../../scripts/lib/impact-checker');

const SIDECAR = '---\nlevel: 3\nparent_spec:\n  name: sidecar\n---\n';

function write(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

async function run() {
  let passed = 0;
  let failed = 0;

  function it(desc, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-sidecar-discovery-'));
    try {
      fn(root);
      console.log(`  PASS: ${desc}`);
      passed++;
    } catch (err) {
      console.log(`  FAIL: ${desc}`);
      console.error(err);
      failed++;
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  console.log('\n--- test-sidecar-discovery ---');

  it('workspace-index lists the real model and never a sidecar', (root) => {
    write(root, 'kNNowledge/Acme_business_NN.md', '# Model');
    write(root, 'sources/import/report.pdf_sidecar_NN.md', SIDECAR);
    write(root, 'kNNowledge/prices.csv_sidecar_NN.md', SIDECAR);
    assert.deepStrictEqual(listWorkspaceModels(root), ['./kNNowledge/Acme_business_NN.md']);
  });

  it('workspace-index labels a model from the contract stem', () => {
    assert.strictEqual(deriveIndexLabel('kNNowledge/Acme_Plan_business_NN.md'), 'Acme Plan business');
    assert.strictEqual(deriveIndexLabel('kNNowledge/Acme_V_1-0-0_business_NN.md'), 'Acme');
  });

  it('a sidecar never counts as a model that cites a source', (root) => {
    write(root, 'sources/import/notes.md', '# Notes\n\nbody\n');
    write(
      root,
      'sources/import/notes.md_sidecar_NN.md',
      `---\nlevel: 3\nparent_spec:\n  name: sidecar\nsource_file: sources/import/notes.md\nsha256: ${'a'.repeat(64)}\n---\n`,
    );
    write(root, 'kNNowledge/notes.pdf_sidecar_NN.md', SIDECAR + 'sources:: [sources/import/notes.md]\n');
    const audit = guards.auditUncitedSources(root);
    assert.strictEqual(audit.citedCount, 0);
    assert.strictEqual(audit.uncitedCount, 1);
  });

  it('convergence family manifest is never read from a sidecar', (root) => {
    write(root, 'kNNowledge/Acme_cogNNitive_NN.md', '## NN Source Family: fam\nstrategy:: cite-only\n');
    write(root, 'kNNowledge/Aaa.csv_sidecar_NN.md', SIDECAR + '## NN Source Family: bogus\nstrategy:: cite-only\n');
    assert.strictEqual(path.basename(findFamilyManifest(root)), 'Acme_cogNNitive_NN.md');
  });

  it('a sidecar named like a lineage record never supplies watch roots', (root) => {
    const watched = path.join(root, 'watched');
    write(watched, 'drop.csv', 'a,b\n1,2\n');
    write(
      root,
      'kNNowledge/Acme_cogNNitive_NN.md',
      `## NN External Watch Roots:\n- Root: "${watched.replace(/\\/g, '/')}"\n  Cadence: "dynamic"\n  Recursive: true\n  Filter: ["*.csv"]\n`,
    );
    write(root, 'kNNowledge/Aaa_workspace.csv_sidecar_NN.md', SIDECAR);
    const result = scanAllWatchRoots(root);
    assert.strictEqual(result.roots.length, 1);
  });

  it('source families ignore sidecars next to stamped files', (root) => {
    write(root, 'sources/import/q_20260901T100000Z.md', '# One\n');
    write(root, 'sources/import/q_20260915T120000Z.md', '# Two\n');
    write(root, 'sources/import/q_20260915T120000Z.md_sidecar_NN.md', SIDECAR);
    const families = groupSourceFamilies(root);
    assert.deepStrictEqual(Object.keys(families), ['sources/import/q.md']);
    assert.deepStrictEqual(
      families['sources/import/q.md'].map((m) => m.fileName),
      ['q_20260901T100000Z.md', 'q_20260915T120000Z.md'],
    );
  });

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then(({ passed, failed }) => {
    console.log(`\nSidecar discovery tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
