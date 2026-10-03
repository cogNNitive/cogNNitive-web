const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const core = require('../scripts/lib/innfo-core.generated.cjs');
const { planProjectGc } = require('../scripts/lib/gc');

const CLI = path.join(__dirname, '..', 'scripts', 'index.js');

const OLD = 'artifacts/report_20261001T100000Z.md';
const MID = 'artifacts/report_20261002T100000Z.md';
const LATEST = 'artifacts/report_20261003T100000Z.md';
const CITED_OLD = 'sources/import/prices_20261001T100000Z.csv';
const PRICES_LATEST = 'sources/import/prices_20261002T100000Z.csv';
const PDF_OLD = 'sources/import/terms_20261001T100000Z.pdf';
const PDF_LATEST = 'sources/import/terms_20261002T100000Z.pdf';
const normalizer = async () => ({ body: '## Overview\nNormalized.\n', normalizedBy: 'test' });

function put(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

/** A domaiNN with a three-member report family, a two-member prices family whose old member is cited. */
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-gc-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  put(root, 'sources/import/.keep', '');
  for (const rel of [OLD, MID, LATEST]) put(root, rel, `# ${rel}\n`);
  put(root, CITED_OLD, 'id,v\na,1\n');
  put(root, PRICES_LATEST, 'id,v\na,2\n');
  put(root, PDF_OLD, '%PDF old');
  put(root, PDF_LATEST, '%PDF latest');
  await core.cognitivize(root, CITED_OLD);
  await core.cognitivize(root, PDF_OLD, { normalizer });
  await core.cognitivize(root, PDF_LATEST, { normalizer });
  await core.cognitivize(root, OLD);
  put(
    root,
    'kNNowledge/Pricing_business_NN.md',
    [
      '---',
      'level: 3',
      'knowledge_version: 0.1.0',
      'parent_spec:',
      '  name: business',
      '  url: https://example.com/business.md',
      '---',
      '# NN Offer',
      '## NN Offer: Basic',
      `sources:: [${CITED_OLD}@a, ${PDF_OLD}_sidecar_NN.md@## Overview]`,
      '',
    ].join('\n'),
  );
  return root;
}

function cli(root, args, env = {}) {
  const cleaned = { ...process.env };
  delete cleaned.CI;
  return spawnSync(process.execPath, [CLI, '--src', root, ...args], {
    encoding: 'utf8',
    env: { ...cleaned, ...env },
  });
}

test('planProjectGc proposes only non-latest, uncited members (a sidecar citation counts for its subject)', async (t) => {
  const root = await fixture(t);
  const plan = await planProjectGc(root);
  assert.deepEqual(plan.candidates, [MID, OLD].sort());
  assert.ok(!plan.candidates.includes(LATEST), 'the latest member is never proposed');
  assert.ok(!plan.candidates.includes(CITED_OLD), 'a member cited directly is kept');
  assert.ok(!plan.candidates.includes(PDF_OLD), 'a member cited through its sidecar is kept');
});

test('--gc is a dry run: it lists the plan and deletes nothing', async (t) => {
  const root = await fixture(t);
  const res = cli(root, ['--gc']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, new RegExp(OLD.replace(/[.]/g, '\\.')));
  assert.match(res.stdout, new RegExp(MID.replace(/[.]/g, '\\.')));
  assert.ok(!res.stdout.includes(LATEST));
  for (const rel of [OLD, MID, LATEST, CITED_OLD]) assert.ok(fs.existsSync(path.join(root, rel)), rel);
});

test('--gc --apply refuses without --yes and --paths', async (t) => {
  const root = await fixture(t);
  assert.notEqual(cli(root, ['--gc', '--apply']).status, 0);
  assert.notEqual(cli(root, ['--gc', '--apply', '--yes']).status, 0);
  assert.notEqual(cli(root, ['--gc', '--apply', '--paths', OLD]).status, 0);
  assert.ok(fs.existsSync(path.join(root, OLD)));
});

test('--gc --apply --yes --paths deletes only confirmed paths that are also in the plan, with their sidecars', async (t) => {
  const root = await fixture(t);
  const res = cli(root, ['--gc', '--apply', '--yes', '--paths', [OLD, LATEST, CITED_OLD, PDF_OLD].join(',')]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(path.join(root, OLD)), 'confirmed and planned: deleted');
  assert.ok(!fs.existsSync(path.join(root, `${OLD}_sidecar_NN.md`)), 'its sidecar goes with it');
  assert.ok(fs.existsSync(path.join(root, MID)), 'planned but not confirmed: kept');
  assert.ok(fs.existsSync(path.join(root, LATEST)), 'confirmed but latest: kept');
  assert.ok(fs.existsSync(path.join(root, CITED_OLD)), 'confirmed but cited: kept');
  assert.ok(fs.existsSync(path.join(root, PDF_OLD)), 'confirmed but cited through its sidecar: kept');
});

test('CI never applies a deletion, even with every confirmation flag', async (t) => {
  const root = await fixture(t);
  const res = cli(root, ['--gc', '--apply', '--yes', '--paths', OLD], { CI: 'true' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /CI/);
  assert.ok(fs.existsSync(path.join(root, OLD)));
});
