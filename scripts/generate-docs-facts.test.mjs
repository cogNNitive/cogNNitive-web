#!/usr/bin/env node

/**
 * scripts/generate-docs-facts.test.mjs
 *
 * CLI-level fixture tests for scripts/generate-docs-facts.mjs (plain node,
 * zero deps — matches the repo's template-catalog.test.mjs convention).
 * Spawns the real CLI against a disposable fixture tree so no code path
 * touches the real repo (design "Testing Strategy": Integration layer).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIR, 'generate-docs-facts.mjs');

const OPEN_MARKER = '<!-- generated:mcp-tools (source: innfo-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->';
const CLOSE_MARKER = '<!-- /generated:mcp-tools -->';

/**
 * @param {{ withDist?: boolean, tools?: Array<{name: string, description: string}>, targetBody?: string, withMarkers?: boolean }} opts
 * @returns {string} the fixture root directory
 */
function fixtureTree(opts = {}) {
  const {
    withDist = true,
    tools = [
      { name: 'list_models', description: 'Scan the models directory and list all iNNfo models' },
      { name: 'read_model', description: "Parse and return an iNNfo model's full structure by its id" },
    ],
    targetBody = 'STALE HAND-TYPED TABLE',
    withMarkers = true,
  } = opts;

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-facts-cli-test-'));

  if (withDist) {
    const distDir = path.join(root, 'iNNfo', 'packages', 'innfo-mcp', 'dist');
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'server.js'),
      `export const toolDefinitions = ${JSON.stringify(tools)};\n`,
      'utf8',
    );
  }

  const docsDir = path.join(root, 'docs', 'innfo', 'documentation');
  fs.mkdirSync(docsDir, { recursive: true });
  const body = withMarkers
    ? ['# innfo-mcp', '', '## Tools', '', OPEN_MARKER, targetBody, CLOSE_MARKER, ''].join('\n')
    : ['# innfo-mcp', '', '## Tools', '', '| Tool | Description |', '|------|-------------|', ''].join('\n');
  fs.writeFileSync(path.join(docsDir, 'innfo-mcp.md'), body, 'utf8');

  return root;
}

function runCli(cwd, args = []) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf-8' });
}

function readTarget(root) {
  return fs.readFileSync(path.join(root, 'docs', 'innfo', 'documentation', 'innfo-mcp.md'), 'utf8');
}

function main() {
  console.log('Running generate-docs-facts CLI fixture tests...');

  // 1. Missing innfo-mcp dist exits 2, naming the missing path (design D3).
  {
    const root = fixtureTree({ withDist: false });
    try {
      const res = runCli(root);
      assert.strictEqual(res.status, 2, `expected exit 2, got ${res.status}: ${res.stderr}`);
      assert.ok(
        res.stderr.includes(path.join('iNNfo', 'packages', 'innfo-mcp', 'dist', 'server.js')),
        `stderr must name the missing dist path, got: ${res.stderr}`,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // 2. `--check` against a stale fixture (on-disk body does not match the registry) exits 1.
  {
    const root = fixtureTree({ targetBody: 'STALE HAND-TYPED TABLE' });
    try {
      const res = runCli(root, ['--check']);
      assert.strictEqual(res.status, 1, `expected exit 1 (drift), got ${res.status}: ${res.stderr}`);
      assert.ok(res.stderr.length > 0, 'drift failure must report something on stderr');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // 3. Triangulation: `--check` succeeds (exit 0) once the file already matches the registry render.
  {
    const root = fixtureTree({ targetBody: 'STALE HAND-TYPED TABLE' });
    try {
      const write = runCli(root);
      assert.strictEqual(write.status, 0, `write mode must succeed, got ${write.status}: ${write.stderr}`);
      const check = runCli(root, ['--check']);
      assert.strictEqual(check.status, 0, `--check must pass right after a write, got ${check.status}: ${check.stderr}`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // 4. Write mode is byte-identical on a second run with no upstream change (determinism, design "Regeneration is deterministic").
  {
    const root = fixtureTree({ targetBody: 'STALE HAND-TYPED TABLE' });
    try {
      const first = runCli(root);
      assert.strictEqual(first.status, 0, `first write must succeed: ${first.stderr}`);
      const afterFirst = readTarget(root);
      const second = runCli(root);
      assert.strictEqual(second.status, 0, `second write must succeed: ${second.stderr}`);
      const afterSecond = readTarget(root);
      assert.strictEqual(afterSecond, afterFirst, 'a second write with no upstream change must be byte-identical');
      assert.ok(afterFirst.includes('**2** tools'), 'the written region reflects the 2-tool fixture registry');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // 5. Triangulation: a different tool count in the registry changes the written output (proves the count is derived, not fixed).
  {
    const root = fixtureTree({
      tools: [
        { name: 'a', description: 'A' },
        { name: 'b', description: 'B' },
        { name: 'c', description: 'C' },
      ],
    });
    try {
      const res = runCli(root);
      assert.strictEqual(res.status, 0, `write must succeed: ${res.stderr}`);
      const content = readTarget(root);
      assert.ok(content.includes('**3** tools'), 'a 3-tool registry renders a 3-tool count, not the previous fixture count');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // 6. Missing region markers in the target doc exits 2 (design D4: a missing marker never appends).
  {
    const root = fixtureTree({ withMarkers: false });
    try {
      const res = runCli(root);
      assert.strictEqual(res.status, 2, `expected exit 2 for missing markers, got ${res.status}: ${res.stderr}`);
      assert.ok(res.stderr.includes('generated:mcp-tools'), `stderr must name the missing region, got: ${res.stderr}`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  console.log('\nAll generate-docs-facts CLI fixture tests passed successfully!');
}

main();
