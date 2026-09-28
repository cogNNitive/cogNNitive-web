#!/usr/bin/env node

/**
 * scripts/verify-drift-guard.test.js
 *
 * Plain-node tests for the Docs-Derived Facts Drift Guard added to
 * scripts/verify.js as step 7e (`checkDocsFactsDriftAtRef` /
 * `checkHandTypedFactsAtRef`). Builds a disposable git repo fixture, runs the
 * real generate-docs-facts.mjs / generate-about-twin.mjs CLIs in write mode
 * to produce a genuinely clean committed state (exactly the way
 * build-docs.mjs does before verify.js ever runs), then asserts the guard is
 * compared against `git show HEAD:<path>` — never the working tree (design
 * D5) — for both generated-region drift and reintroduced hand-typed facts
 * (spec docs-derived-facts, "CI Drift Guard").
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkDocsFactsDriftAtRef } = require('./verify.js');

const SCRIPTS_DIR = __dirname;
const GENERATE_DOCS_FACTS = path.join(SCRIPTS_DIR, 'generate-docs-facts.mjs');
const GENERATE_ABOUT_TWIN = path.join(SCRIPTS_DIR, 'generate-about-twin.mjs');

const OPEN_MCP = '<!-- generated:mcp-tools (source: innfo-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->';
const CLOSE_MCP = '<!-- /generated:mcp-tools -->';
const OPEN_SKILLS = '<!-- generated:skills-catalog (source: manifest/source.yaml) -->';
const CLOSE_SKILLS = '<!-- /generated:skills-catalog -->';

const ABOUT_HTML = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <title>About — Fixture</title>',
  '    <meta name="description" content="Fixture about page." />',
  '    <link rel="canonical" href="https://example.com/about" />',
  '    <meta name="generator" content="https://example.com/skills/nn-design-presets" />',
  '  </head>',
  '  <body>',
  '    <main>',
  '      <h1>About Fixture</h1>',
  '      <p>Fixture body text.</p>',
  '    </main>',
  '  </body>',
  '</html>',
  '',
].join('\n');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

/**
 * Builds a disposable git repo fixture with a genuinely clean committed
 * generated state: dist/manifest/model inputs plus both target docs, seeded
 * via the real generators' own write mode (never hand-crafted region bodies,
 * so this fixture cannot silently drift from what the generators actually
 * produce).
 * @returns {string} the fixture repo root
 */
function buildFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-drift-guard-'));

  const distDir = path.join(root, 'iNNfo', 'packages', 'innfo-mcp', 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, 'server.js'),
    "export const toolDefinitions = [{ name: 'a', description: 'A' }, { name: 'b', description: 'B' }];\n",
    'utf-8',
  );

  const manifestDir = path.join(root, 'manifest');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(
    path.join(manifestDir, 'source.yaml'),
    'skills:\n  - name: fixture-skill\n    description: Fixture skill description\n',
    'utf-8',
  );

  const skillsDocsDir = path.join(root, 'docs', 'skills', 'documentation');
  fs.mkdirSync(skillsDocsDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillsDocsDir, 'documentation_NN.md'),
    [
      '---',
      'title: Agent Skills Documentation',
      'model_version: V_0-2-0',
      '---',
      '# NN Section',
      '## NN Section: Canonical Skills',
      'title:: Canonical Skills',
      '# NN Page',
      '## NN Page: fixture-skill',
      'title:: Fixture Skill',
      'parent:: [[Canonical Skills]]',
      '',
    ].join('\n'),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(skillsDocsDir, 'README.md'),
    ['# Skills Catalog', OPEN_SKILLS, 'placeholder', CLOSE_SKILLS, ''].join('\n'),
    'utf-8',
  );

  const mcpDocsDir = path.join(root, 'docs', 'innfo', 'documentation');
  fs.mkdirSync(mcpDocsDir, { recursive: true });
  fs.writeFileSync(
    path.join(mcpDocsDir, 'innfo-mcp.md'),
    ['# innfo-mcp', '', '## Tools', '', OPEN_MCP, 'placeholder', CLOSE_MCP, ''].join('\n'),
    'utf-8',
  );

  const aboutDir = path.join(root, 'docs', 'innfo');
  fs.mkdirSync(aboutDir, { recursive: true });
  fs.writeFileSync(path.join(aboutDir, 'about.html'), ABOUT_HTML, 'utf-8');

  // Write mode: produce a genuinely-correct generated state, the same way
  // build-docs.mjs does before verify.js ever runs (design D5).
  execFileSync(process.execPath, [GENERATE_DOCS_FACTS], { cwd: root, encoding: 'utf-8' });
  execFileSync(process.execPath, [GENERATE_ABOUT_TWIN], { cwd: root, encoding: 'utf-8' });

  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'fixture@example.com']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['config', 'core.autocrlf', 'false']);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'clean fixture state']);

  return root;
}

function commitChange(root, message) {
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', message]);
}

/**
 * The guard's own script paths and the target repo being scanned are
 * deliberately independent (see verify.js's `scriptsDir` doc comment): this
 * fixture never duplicates generate-docs-facts.mjs / lib/docs-facts.mjs /
 * generate-manifest.js, it just points the guard at the real, unmodified
 * ones while checking the disposable fixture repo.
 */
function checkFixture(root, ref) {
  return checkDocsFactsDriftAtRef(root, ref, { scriptsDir: SCRIPTS_DIR });
}

function main() {
  console.log('Running verify drift-guard tests...');

  // 1. Clean committed state passes both region checks and the hand-typed scan.
  {
    const root = buildFixtureRepo();
    try {
      const result = checkFixture(root, 'HEAD');
      assert.strictEqual(result.ok, true, `clean fixture must pass: ${JSON.stringify(result.failures)}`);
      console.log('✔ Clean committed state passes the drift guard');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // 2. A stale generated region committed at HEAD fails, naming the generator.
  {
    const root = buildFixtureRepo();
    try {
      const mcpPath = path.join(root, 'docs', 'innfo', 'documentation', 'innfo-mcp.md');
      const stale = fs.readFileSync(mcpPath, 'utf-8').replace('**2** tools', '**99** tools');
      fs.writeFileSync(mcpPath, stale, 'utf-8');
      commitChange(root, 'introduce stale region');

      const result = checkFixture(root, 'HEAD');
      assert.strictEqual(result.ok, false, 'stale generated region at HEAD must fail the guard');
      assert.ok(
        result.failures.some((f) => f.includes('generate-docs-facts.mjs')),
        `failure must name the generator: ${JSON.stringify(result.failures)}`,
      );
      console.log('✔ Stale generated region committed at HEAD fails, naming the generator');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // 3. A reintroduced hand-typed literal committed at HEAD fails, naming the file/line.
  {
    const root = buildFixtureRepo();
    try {
      const llmsPath = path.join(root, 'docs', 'innfo', 'llms-full.txt');
      fs.writeFileSync(llmsPath, 'innfo-mcp exposes seven semantic tools today.\n', 'utf-8');
      commitChange(root, 'reintroduce a hand-typed tool count');

      const result = checkFixture(root, 'HEAD');
      assert.strictEqual(result.ok, false, 'a reintroduced hand-typed literal at HEAD must fail the guard');
      assert.ok(
        result.failures.some((f) => f.includes('llms-full.txt') && f.includes('tool-count')),
        `failure must name the offending file and rule: ${JSON.stringify(result.failures)}`,
      );
      console.log('✔ Reintroduced hand-typed literal committed at HEAD fails, naming the file');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // 4. The guard is checked against HEAD, never the working tree (design D5):
  //    dirtying the tree without committing must NOT trip either check.
  {
    const root = buildFixtureRepo();
    try {
      const mcpPath = path.join(root, 'docs', 'innfo', 'documentation', 'innfo-mcp.md');
      fs.writeFileSync(mcpPath, fs.readFileSync(mcpPath, 'utf-8').replace('**2** tools', '**99** tools'), 'utf-8');
      const llmsPath = path.join(root, 'docs', 'innfo', 'llms-full.txt');
      fs.writeFileSync(llmsPath, 'innfo-mcp exposes seven semantic tools today.\n', 'utf-8');
      // Deliberately no commit: both changes are uncommitted working-tree dirt.

      const result = checkFixture(root, 'HEAD');
      assert.strictEqual(
        result.ok,
        true,
        `uncommitted working-tree changes must never affect a HEAD-scoped check: ${JSON.stringify(result.failures)}`,
      );
      console.log('✔ Uncommitted working-tree drift is ignored — the guard only ever reads HEAD');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  console.log('\nAll verify drift-guard tests passed successfully!');
}

main();
