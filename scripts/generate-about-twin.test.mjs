#!/usr/bin/env node

/**
 * scripts/generate-about-twin.test.mjs
 *
 * Fixture tests for scripts/generate-about-twin.mjs (plain node, zero deps —
 * matches the repo's generate-docs-facts.test.mjs convention). Covers the
 * pure extraction/render functions against fixture HTML strings, then the
 * CLI (write / --check [--against]) against a disposable fixture tree, so no
 * code path touches the real repo (design "Testing Strategy": Unit +
 * Integration layers, D6).
 *
 * Run directly during development: node scripts/generate-about-twin.test.mjs
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  extractHeadMetadata,
  extractMainFragment,
  htmlFragmentToMarkdown,
  renderFrontmatter,
  renderAboutTwin,
} from './generate-about-twin.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIR, 'generate-about-twin.mjs');

function section(name, fn) {
  console.log(`\n▶ ${name}`);
  fn();
}

const FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>About — Fixture</title>
    <meta name="description" content="A fixture about page for testing." />
    <link rel="canonical" href="https://example.com/about" />
    <meta name="generator" content="https://example.com/skills/nn-design-presets" />
  </head>
  <body>
    <script>console.log('should never appear');</script>
    <header>
      <nav><a href="/">Home</a><a href="/about">About</a></nav>
    </header>
    <main>
      <h1>About <span class="serif-accent">Fixture</span></h1>
      <p>A short intro paragraph with a <a href="https://example.com/docs">docs link</a>.</p>
      <h2>Packages</h2>
      <div class="card">
        <h3>fixture-core</h3>
        <p>Wraps <code>fixture-core</code> for testing.</p>
      </div>
      <nav class="in-main">This nav must not survive either.</nav>
      <script>window.trap = true;</script>
    </main>
    <footer>
      <p>Footer content that must never appear in the twin.</p>
    </footer>
  </body>
</html>
`;

function testExtractHeadMetadata() {
  const meta = extractHeadMetadata(FIXTURE_HTML);
  assert.strictEqual(meta.title, 'About — Fixture');
  assert.strictEqual(meta.description, 'A fixture about page for testing.');
  assert.strictEqual(meta.html_url, 'https://example.com/about');
  assert.strictEqual(meta.generator, 'https://example.com/skills/nn-design-presets');
}

function testExtractMainFragmentStripsChrome() {
  const fragment = extractMainFragment(FIXTURE_HTML);
  assert.ok(!fragment.includes('should never appear'), 'top-level <script> must not reach the fragment');
  assert.ok(!fragment.includes('window.trap'), 'in-main <script> must be stripped');
  assert.ok(!fragment.includes('Home'), 'top-level <nav> (outside <main>) must not reach the fragment');
  assert.ok(!fragment.includes('This nav must not survive'), 'in-main <nav> must be stripped');
  assert.ok(!fragment.includes('Footer content'), '<footer> must not reach the fragment');
  assert.ok(fragment.includes('fixture-core'), 'real content inside <main> must survive');
}

function testHtmlFragmentToMarkdownConvertsElements() {
  const fragment = extractMainFragment(FIXTURE_HTML);
  const markdown = htmlFragmentToMarkdown(fragment);

  assert.ok(/^#\s+About\s+Fixture/m.test(markdown), `expected an h1 "# About Fixture" heading, got:\n${markdown}`);
  assert.ok(/^##\s+Packages/m.test(markdown), `expected an h2 "## Packages" heading, got:\n${markdown}`);
  assert.ok(/^###\s+fixture-core/m.test(markdown), `expected an h3 "### fixture-core" heading, got:\n${markdown}`);
  assert.ok(
    markdown.includes('[docs link](https://example.com/docs)'),
    `expected the <a> to become a Markdown link, got:\n${markdown}`,
  );
  assert.ok(markdown.includes('`fixture-core`'), `expected the <code> to become an inline code span, got:\n${markdown}`);
  assert.ok(markdown.includes('A short intro paragraph'), `expected the paragraph text to survive, got:\n${markdown}`);
}

const TREE_DIAGRAM_FRAGMENT = `<div
  style="
    background: var(--canvas-inert);
    font-family: var(--mono);
  "
>
  iNNfo/<br />
  ├── apps/<br />
  │&nbsp;&nbsp; └── innfo-editor/ &nbsp;<span
    style="color: var(--ink-muted)"
    >// Vue 3 workspace editor</span
  ><br />
  └── docs/ &nbsp;&nbsp;<span style="color: var(--ink-muted)">// This website</span>
</div>`;

function testHtmlFragmentToMarkdownPreservesTreeDiagramIndentation() {
  const markdown = htmlFragmentToMarkdown(TREE_DIAGRAM_FRAGMENT);

  assert.ok(
    markdown.includes('```'),
    `expected the <br>-separated tree diagram to be wrapped in a fenced code block, got:\n${markdown}`,
  );

  const fencedMatch = /```\n([\s\S]*?)\n```/.exec(markdown);
  assert.ok(fencedMatch, `expected to find a fenced code block, got:\n${markdown}`);
  const lines = fencedMatch[1].split('\n');

  assert.strictEqual(
    lines.length,
    4,
    `expected the 4 <br>-separated lines to survive as one block, got:\n${JSON.stringify(lines)}`,
  );
  assert.strictEqual(lines[0], 'iNNfo/');
  assert.strictEqual(lines[1], '├── apps/');
  assert.ok(
    lines[2].startsWith('│  '),
    `expected the nested line to keep its "│" indentation (decoded &nbsp; as spaces), got: ${JSON.stringify(lines[2])}`,
  );
  assert.ok(
    lines[2].includes('└── innfo-editor/') && lines[2].includes('// Vue 3 workspace editor'),
    `expected the nested line's content and inline comment to survive, got: ${JSON.stringify(lines[2])}`,
  );
  assert.ok(
    lines[3].startsWith('└── docs/'),
    `expected the last tree line to survive, got: ${JSON.stringify(lines[3])}`,
  );

  assert.ok(
    !/iNNfo\/\s*\n\s*\n/.test(markdown),
    'tree lines must not be split into separate paragraphs by a blank line',
  );
}

function testRenderFrontmatterPreservesAllFields() {
  const meta = extractHeadMetadata(FIXTURE_HTML);
  const frontmatter = renderFrontmatter(meta);
  const lines = frontmatter.trim().split('\n');

  assert.strictEqual(lines[0], '---');
  assert.strictEqual(lines[lines.length - 1], '---');
  assert.ok(lines.includes(`title: ${meta.title}`), `frontmatter must preserve title, got:\n${frontmatter}`);
  assert.ok(
    lines.includes(`description: ${meta.description}`),
    `frontmatter must preserve description, got:\n${frontmatter}`,
  );
  assert.ok(lines.includes(`html_url: ${meta.html_url}`), `frontmatter must preserve html_url, got:\n${frontmatter}`);
  assert.ok(lines.includes(`generator: ${meta.generator}`), `frontmatter must preserve generator, got:\n${frontmatter}`);
}

function testRenderAboutTwinIsDeterministic() {
  const first = renderAboutTwin(FIXTURE_HTML);
  const second = renderAboutTwin(FIXTURE_HTML);
  assert.strictEqual(first, second, 'rendering the same source html twice must be byte-identical');
  assert.ok(first.startsWith('---\n'), 'the twin must start with a frontmatter block');
  assert.ok(first.includes('# About Fixture'), 'the twin must include the converted h1');
  assert.ok(first.endsWith('\n'), 'the twin must end with exactly one trailing newline');
  assert.ok(!first.endsWith('\n\n'), 'the twin must end with exactly one trailing newline');
}

// --- CLI fixture tests -------------------------------------------------

/**
 * @param {{ withSource?: boolean, sourceHtml?: string, targetBody?: string | null }} opts
 * @returns {string} the fixture root directory
 */
function fixtureTree(opts = {}) {
  const { withSource = true, sourceHtml = FIXTURE_HTML, targetBody = null } = opts;

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'about-twin-cli-test-'));
  const innfoDocsDir = path.join(root, 'docs', 'innfo');
  fs.mkdirSync(innfoDocsDir, { recursive: true });

  if (withSource) {
    fs.writeFileSync(path.join(innfoDocsDir, 'about.html'), sourceHtml, 'utf8');
  }

  if (targetBody !== null) {
    fs.writeFileSync(path.join(innfoDocsDir, 'about.md'), targetBody, 'utf8');
  }

  return root;
}

function runCli(cwd, args = []) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf-8' });
}

function readTarget(root) {
  return fs.readFileSync(path.join(root, 'docs', 'innfo', 'about.md'), 'utf8');
}

function testCliMissingSourceExits2() {
  const root = fixtureTree({ withSource: false });
  try {
    const res = runCli(root);
    assert.strictEqual(res.status, 2, `expected exit 2, got ${res.status}: ${res.stderr}`);
    assert.ok(res.stderr.includes(path.join('docs', 'innfo', 'about.html')), `stderr must name the missing source, got: ${res.stderr}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testCliCheckDetectsDrift() {
  const root = fixtureTree({ targetBody: 'STALE HAND-WRITTEN TWIN' });
  try {
    const res = runCli(root, ['--check']);
    assert.strictEqual(res.status, 1, `expected exit 1 (drift), got ${res.status}: ${res.stderr}`);
    assert.ok(res.stderr.length > 0, 'drift failure must report something on stderr');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testCliWriteThenCheckSucceeds() {
  const root = fixtureTree({ targetBody: 'STALE HAND-WRITTEN TWIN' });
  try {
    const write = runCli(root);
    assert.strictEqual(write.status, 0, `write mode must succeed, got ${write.status}: ${write.stderr}`);
    const check = runCli(root, ['--check']);
    assert.strictEqual(check.status, 0, `--check must pass right after a write, got ${check.status}: ${check.stderr}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testCliWriteIsDeterministicAcrossRuns() {
  const root = fixtureTree({ targetBody: 'STALE HAND-WRITTEN TWIN' });
  try {
    const first = runCli(root);
    assert.strictEqual(first.status, 0, `first write must succeed: ${first.stderr}`);
    const afterFirst = readTarget(root);
    const second = runCli(root);
    assert.strictEqual(second.status, 0, `second write must succeed: ${second.stderr}`);
    const afterSecond = readTarget(root);
    assert.strictEqual(afterSecond, afterFirst, 'a second write with no upstream change must be byte-identical');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testCliRerendersWhenSourceChanges() {
  const root = fixtureTree({});
  try {
    const write = runCli(root);
    assert.strictEqual(write.status, 0, `write must succeed: ${write.stderr}`);
    const before = readTarget(root);

    const changedHtml = FIXTURE_HTML.replace('fixture-core', 'renamed-core');
    fs.writeFileSync(path.join(root, 'docs', 'innfo', 'about.html'), changedHtml, 'utf8');
    const rewrite = runCli(root);
    assert.strictEqual(rewrite.status, 0, `rewrite must succeed: ${rewrite.stderr}`);
    const after = readTarget(root);

    assert.notStrictEqual(after, before, 'a changed source must change the rendered twin');
    assert.ok(after.includes('renamed-core'), 'the rewritten twin must reflect the renamed source content');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testCliMissingMainElementExits2() {
  const noMainHtml = FIXTURE_HTML.replace(/<main>[\s\S]*?<\/main>/, '<div>no main here</div>');
  const root = fixtureTree({ sourceHtml: noMainHtml });
  try {
    const res = runCli(root);
    assert.strictEqual(res.status, 2, `expected exit 2 for a missing <main>, got ${res.status}: ${res.stderr}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  console.log('Running generate-about-twin fixture tests...');

  section('extractHeadMetadata()', testExtractHeadMetadata);
  section('extractMainFragment() strips nav/footer/script', testExtractMainFragmentStripsChrome);
  section('htmlFragmentToMarkdown() converts headings/paragraphs/links/code', testHtmlFragmentToMarkdownConvertsElements);
  section(
    'htmlFragmentToMarkdown() preserves tree-diagram indentation as a fenced code block',
    testHtmlFragmentToMarkdownPreservesTreeDiagramIndentation,
  );
  section('renderFrontmatter() preserves all fields', testRenderFrontmatterPreservesAllFields);
  section('renderAboutTwin() is deterministic', testRenderAboutTwinIsDeterministic);

  section('CLI: missing about.html exits 2', testCliMissingSourceExits2);
  section('CLI: --check detects drift', testCliCheckDetectsDrift);
  section('CLI: write then --check succeeds', testCliWriteThenCheckSucceeds);
  section('CLI: write is deterministic across runs', testCliWriteIsDeterministicAcrossRuns);
  section('CLI: rerenders when the source changes', testCliRerendersWhenSourceChanges);
  section('CLI: missing <main> exits 2', testCliMissingMainElementExits2);

  console.log('\nAll generate-about-twin fixture tests passed successfully!');
}

main();
