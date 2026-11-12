/**
 * skills/nn-preflight/scripts/domain-storage.test.js
 *
 * Preflight on a domaiNN that keeps its models in distributed storage (#611):
 * models found through the manifest and the bluepriNNt placement rules, an
 * installed engine older than the version the documents declare, and an
 * unsynced manifest. Every fixture passes explicit directories so nothing is
 * read from the real home directory.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { runCheck } = require('./preflight-check');

const preflightScript = path.join(__dirname, 'preflight-check.js');
const UNREACHABLE = 'http://127.0.0.1:1';
const SPEC_URL =
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md';
const INSTALL_COMMAND =
  'node ~/.agents/skills/nn-skills-lifecycle/scripts/skills-manager.js install --blueprint coNNtent --yes';

function model(slug, title, blueprintVersion = 'V_0-18-0') {
  return [
    '---',
    `spec_url: "${SPEC_URL}"`,
    `knowledge_slug: "${slug}"`,
    'level: 3',
    'parent_spec:',
    '  name: "coNNtent"',
    `  url: "${SPEC_URL}"`,
    'knowledge_version: "V_0-1-0"',
    `blueprint_version: "${blueprintVersion}"`,
    `title: "${title}"`,
    '---',
    '',
    `# NN Series`,
    '',
    `## NN Series: ${title}`,
    '',
  ].join('\n');
}

function manifest(paths) {
  const entries = paths
    .map((p) => `## NN kNNowledge: ${path.basename(p)}\npath:: ${p}\nblueprint:: coNNtent\nstatus:: active\n`)
    .join('\n');
  return [
    '---',
    'level: 3',
    'parent_spec:',
    '  name: "domaiNN"',
    '  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"',
    'knowledge_version: "V_0-4-0"',
    'title: "Channel"',
    '---',
    '',
    '# NN domaiNN',
    '',
    '# NN kNNowledge',
    '',
    entries,
  ].join('\n');
}

function installedEngine(blueprintsDir, version) {
  const dir = path.join(blueprintsDir, 'coNNtent');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'spec_NN.md'),
    [
      '---',
      'spec_version: "V_0-5-0"',
      'level: 2',
      'blueprint_name: "coNNtent"',
      `blueprint_version: "${version}"`,
      'title: "coNNtent App"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Video',
      'slug:: video',
      'storage:: distributed',
      'container:: Series',
      'placement:: "{container}/episodes/{slug}/"',
      '',
      '## NN Concept Definition: Series',
      'slug:: series',
      'storage:: distributed',
      'placement:: "series/{slug}/"',
      '',
    ].join('\n'),
  );
}

const SERIES = 'series/news/news_coNNtent_NN.md';
const EPISODE = 'series/news/episodes/e01/e01_coNNtent_NN.md';

/** A coNNtent domaiNN with every model under `series/` and none under `kNNowledge/`. */
function fixture({ register = [SERIES, EPISODE], engine = 'V_0-18-0' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-domain-storage-'));
  const ws = path.join(root, 'ws');
  const blueprintsDir = path.join(root, 'bluepriNNts');
  fs.mkdirSync(path.join(ws, 'series', 'news', 'episodes', 'e01'), { recursive: true });
  fs.writeFileSync(path.join(ws, SERIES), model('news', 'News'));
  fs.writeFileSync(path.join(ws, EPISODE), model('e01', 'E01'));
  fs.writeFileSync(path.join(ws, '.gitattributes'), '* -text\n');
  fs.writeFileSync(path.join(ws, 'domaiNN_NN.md'), manifest(register));
  if (engine) installedEngine(blueprintsDir, engine);
  return { root, ws, blueprintsDir };
}

function options(f) {
  return {
    workspaceDir: f.ws,
    blueprintsDir: f.blueprintsDir,
    skillsDir: path.join(f.root, 'skills'),
    mcpDir: path.join(f.root, 'mcp'),
    stateFile: path.join(f.root, 'bootstrap-state.json'),
    homedir: path.join(f.root, 'home'),
    manifestUrl: `${UNREACHABLE}/manifest.md`,
    templateCatalogUrl: `${UNREACHABLE}/catalog.json`,
    catalogUrl: `${UNREACHABLE}/bp-catalog.json`,
    freshnessUrl: `${UNREACHABLE}/freshness.json`,
  };
}

function cleanup(f) {
  fs.rmSync(f.root, { recursive: true, force: true });
}

test('models stored only under series/ are scanned (non-zero blueprintModelsScanned)', async () => {
  const f = fixture();
  try {
    const res = await runCheck(options(f));
    assert.strictEqual(res.summary.blueprintModelsScanned, 2);
    assert.strictEqual(res.summary.domainModelsInvalid, 0);
    assert.strictEqual(res.exitCode, 0, JSON.stringify(res.items, null, 2));
  } finally {
    cleanup(f);
  }
});

test('an invalid model in distributed storage and a registered path with no file are surfaced', async () => {
  const f = fixture({ register: [SERIES, EPISODE, 'series/news/episodes/e09/e09_coNNtent_NN.md'] });
  try {
    fs.mkdirSync(path.join(f.ws, 'series', 'news', 'episodes', 'e02'), { recursive: true });
    // No `level` / `parent_spec`: the placement rule says this is a Video, the frontmatter does not.
    fs.writeFileSync(path.join(f.ws, 'series/news/episodes/e02/e02_coNNtent_NN.md'), '---\ntitle: "E02"\n---\n# NN Video\n');
    const res = await runCheck(options(f));
    const invalid = res.items.filter((i) => i.type === 'domain-model' && i.status === 'invalid');
    assert.deepStrictEqual(
      invalid.map((i) => i.name).sort(),
      ['series/news/episodes/e02/e02_coNNtent_NN.md', 'series/news/episodes/e09/e09_coNNtent_NN.md'],
    );
    assert.ok(invalid.every((i) => typeof i.detail === 'string' && i.detail.length > 0));
    assert.strictEqual(res.summary.domainModelsInvalid, 2);
    assert.strictEqual(res.summary.blueprintModelsScanned, 4);
    assert.strictEqual(res.status, 'ACTION_REQUIRED');
    assert.strictEqual(res.exitCode, 1);
  } finally {
    cleanup(f);
  }
});

test('an installed engine older than the declared blueprint_version is flagged with the install command', async () => {
  const f = fixture({ engine: 'V_0-15-1' });
  try {
    const res = await runCheck(options(f));
    const item = res.items.find((i) => i.type === 'blueprint-engine');
    assert.ok(item, JSON.stringify(res.items, null, 2));
    assert.strictEqual(item.name, 'coNNtent');
    assert.strictEqual(item.status, 'behind');
    assert.strictEqual(item.installed, 'V_0-15-1');
    assert.strictEqual(item.declared, 'V_0-18-0');
    assert.strictEqual(item.command, INSTALL_COMMAND);
    assert.ok(item.detail.includes(INSTALL_COMMAND));
    assert.strictEqual(res.summary.blueprintEnginesBehind, 1);
    assert.strictEqual(res.status, 'ACTION_REQUIRED');
    assert.strictEqual(res.exitCode, 1);
  } finally {
    cleanup(f);
  }
});

test('an installed engine at the declared version raises no engine item', async () => {
  const f = fixture({ engine: 'V_0-18-0' });
  try {
    const res = await runCheck(options(f));
    assert.strictEqual(res.items.filter((i) => i.type === 'blueprint-engine').length, 0);
    assert.strictEqual(res.summary.blueprintEnginesBehind, 0);
  } finally {
    cleanup(f);
  }
});

test('a manifest that does not register existing documents is warned about without blocking', async () => {
  const f = fixture({ register: [] });
  try {
    const res = await runCheck(options(f));
    const item = res.items.find((i) => i.type === 'domain-manifest');
    assert.ok(item, JSON.stringify(res.items, null, 2));
    assert.strictEqual(item.status, 'warning');
    assert.deepStrictEqual(item.unregistered, [EPISODE, SERIES]);
    assert.strictEqual(res.summary.domainManifestUnregistered, 2);
    assert.strictEqual(res.summary.blueprintModelsScanned, 2);
    assert.strictEqual(res.exitCode, 0);
  } finally {
    cleanup(f);
  }
});

test('a synced manifest raises no manifest warning', async () => {
  const f = fixture();
  try {
    const res = await runCheck(options(f));
    assert.strictEqual(res.items.filter((i) => i.type === 'domain-manifest').length, 0);
    assert.strictEqual(res.summary.domainManifestUnregistered, 0);
  } finally {
    cleanup(f);
  }
});

test('CLI prints the engine drift and the install command and exits 1', async () => {
  const f = fixture({ engine: 'V_0-15-1' });
  const home = path.join(f.root, 'home');
  fs.mkdirSync(home, { recursive: true });
  try {
    const o = options(f);
    const args = [
      preflightScript,
      '--workspace-dir', o.workspaceDir,
      '--blueprints-dir', o.blueprintsDir,
      '--skills-dir', o.skillsDir,
      '--mcp-dir', o.mcpDir,
      '--state-file', o.stateFile,
      '--manifest-url', o.manifestUrl,
      '--template-catalog-url', o.templateCatalogUrl,
      '--catalog-url', o.catalogUrl,
      '--freshness-url', o.freshnessUrl,
    ];
    const res = await new Promise((resolve) => {
      const child = spawn(process.execPath, args, { env: { ...process.env, HOME: home, USERPROFILE: home } });
      let stdout = '';
      child.stdout.on('data', (c) => { stdout += c; });
      child.on('close', (status) => resolve({ status, stdout }));
    });
    assert.strictEqual(res.status, 1, res.stdout);
    assert.ok(res.stdout.includes('coNNtent'), res.stdout);
    assert.ok(res.stdout.includes('V_0-15-1'), res.stdout);
    assert.ok(res.stdout.includes(INSTALL_COMMAND), res.stdout);
  } finally {
    cleanup(f);
  }
});

test('a kNNowledge/ domain keeps its catalog lineage scan (existing behaviour)', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-domain-storage-legacy-'));
  const catalog = JSON.stringify({
    blueprints: {
      business: {
        name: 'business',
        adopted: 'V_0-2-0',
        versions: [{ blueprint_version: 'V_0-1-0' }, { blueprint_version: 'V_0-2-0' }],
      },
    },
  });
  const server = await new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(catalog);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const ws = path.join(root, 'ws');
    fs.mkdirSync(path.join(ws, 'kNNowledge'), { recursive: true });
    fs.writeFileSync(path.join(ws, '.gitattributes'), '* -text\n');
    fs.writeFileSync(
      path.join(ws, 'kNNowledge', 'Old_business_NN.md'),
      '---\nlevel: 3\nparent_spec:\n  name: "business_V_0-1-0"\n  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/business_V_0-1-0_NN.md"\nknowledge_version: "V_0-1-0"\n---\n',
    );
    const f = { root, ws, blueprintsDir: path.join(root, 'bluepriNNts') };
    const res = await runCheck({
      ...options(f),
      templateCatalogUrl: `http://127.0.0.1:${server.address().port}/catalog.json`,
    });
    assert.strictEqual(res.summary.blueprintModelsScanned, 1);
    assert.strictEqual(res.summary.templateUpgradesAvailable, 1);
    assert.strictEqual(res.items.filter((i) => i.type === 'template-upgrade').length, 1);
    // No domaiNN_NN.md: no manifest warning, no engine item.
    assert.strictEqual(res.items.filter((i) => i.type === 'domain-manifest').length, 0);
    assert.strictEqual(res.items.filter((i) => i.type === 'blueprint-engine').length, 0);
    assert.strictEqual(res.exitCode, 0, JSON.stringify(res.items, null, 2));
  } finally {
    await new Promise((r) => server.close(r));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
