const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createHash } = require('crypto');

const core = require('../scripts/lib/innfo-core.generated.cjs');
const { writeImpactReport } = require('../scripts/lib/impact-checker');
const { writeWorkspaceIndex } = require('../scripts/lib/workspace-index');
const { curateCsvFile } = require('../scripts/lib/curate-csv');
const scanner = require('../scripts/scanner');

const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-write-once-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function put(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

/** Every file under `dir` mapped to its sha256. */
function listing(dir) {
  const out = {};
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out[path.relative(dir, abs).replace(/\\/g, '/')] = sha(abs);
    }
  };
  walk(dir);
  return out;
}

const audit = (citation) => ({
  totalCitations: 2,
  validCitations: 1,
  errors: ['drift'],
  warnings: [],
  driftedCitations: [
    {
      modelFile: 'kNNowledge/Business_NN.md',
      elementName: 'Offer',
      citation,
      sourceFile: 'sources/import/strategy.md',
      headingSlug: 'goal',
      reason: 'HEADING_NOT_FOUND',
      suggestions: [],
    },
  ],
});

test('impact report: identical findings write nothing, changed findings add a member', async (t) => {
  const root = workspace(t);
  const first = await writeImpactReport(root, audit('sources/import/strategy.md@## Goal'));
  assert.match(first.reportPath, /artifacts\/Impact_Audit_report_\d{8}T\d{6}Z\.md$/);
  assert.equal(first.status, 'written');
  const before = listing(root);

  const again = await writeImpactReport(root, audit('sources/import/strategy.md@## Goal'));
  assert.equal(again.status, 'deduplicated');
  assert.equal(again.reportPath, first.reportPath);
  assert.deepEqual(listing(root), before);

  const changed = await writeImpactReport(root, audit('sources/import/strategy.md@## Risks'));
  assert.equal(changed.status, 'written');
  assert.notEqual(changed.reportPath, first.reportPath);
  const after = listing(root);
  assert.equal(Object.keys(after).length, 2);
  assert.equal(after[path.relative(root, first.reportPath).replace(/\\/g, '/')], before['artifacts/' + path.basename(first.reportPath)]);
});

test('impact report: declares its upstream sources and carries no date', async (t) => {
  const root = workspace(t);
  const { content } = await writeImpactReport(root, audit('sources/import/strategy.md@## Goal'));
  assert.match(content, /^---\n[\s\S]*\nsources:\n {2}- sources\/import\/strategy\.md\n/);
  assert.ok(!/^date:/m.test(content), 'no date frontmatter: identical findings must be byte-identical');
  assert.ok(!/^type: report/m.test(content));
});

test('curated CSV: a write-once artifact whose sidecar declares the raw file as upstream', async (t) => {
  const root = workspace(t);
  const raw = put(root, 'sources/import/sales.csv', 'id,count\na,1\nb,2\n');
  const rawSha = sha(raw);
  const curated = await curateCsvFile(raw, { key: 'id', projectDir: root });
  assert.equal(sha(raw), rawSha, 'the raw file is untouched');
  const sidecar = fs.readFileSync(`${curated.outputPath}_sidecar_NN.md`, 'utf8');
  assert.match(sidecar, /\nsources:\n {2}- sources\/import\/sales\.csv\n/);

  const projection = core.projectLineage(core.readLineageSnapshot(root));
  const source = projection.sources.find((s) => s.raw_filename === curated.relOutput);
  assert.deepEqual(source.derived_from, ['sources/import/sales.csv']);

  const before = listing(root);
  await curateCsvFile(raw, { key: 'id', projectDir: root });
  assert.deepEqual(listing(root), before);
});

test('workspace index: rerunning on an unchanged workspace rewrites nothing', async (t) => {
  const root = workspace(t);
  put(root, 'kNNowledge/Offer_business_NN.md', '---\nlevel: 3\n---\n# NN Offer\n');
  writeWorkspaceIndex(root);
  const indexPath = path.join(root, 'index.md');
  const old = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(indexPath, old, old);
  const before = fs.readFileSync(indexPath, 'utf8');

  writeWorkspaceIndex(root);
  assert.equal(fs.readFileSync(indexPath, 'utf8'), before);
  assert.equal(fs.statSync(indexPath).mtimeMs, old.getTime(), 'unchanged input does not touch the file');
});

test('scanner: running twice on unchanged input writes no new file', async (t) => {
  const root = workspace(t);
  put(root, 'sources/import/dummy.txt', 'hello world');
  await scanner.scanAndProcess(root, { autoAcceptPrompt: true });
  const before = listing(root);
  await scanner.scanAndProcess(root, { autoAcceptPrompt: true });
  assert.deepEqual(listing(root), before);
});
