#!/usr/bin/env node

/**
 * scripts/generate-docs-facts.mjs
 *
 * Derives the `mcp-tools` generated region in docs/innfo/documentation/innfo-mcp.md
 * from the built innfo-mcp tool registry (design D1/D3/D4/D5). From Unit 3
 * onward this CLI also renders the `skills-catalog` region from
 * manifest/source.yaml; today it owns the MCP tool facts only.
 *
 * CLI contract:
 *   node scripts/generate-docs-facts.mjs [--check] [--against <git-ref>]
 *     (no flags)            write mode: regenerate and write the region
 *     --check               compare the render against the on-disk file, do not write
 *     --check --against X   compare the render against `git show X:<path>` instead
 *                            of the working tree (used by CI, which runs write mode
 *                            in build:docs first — see design D5)
 *
 *     exit 0  wrote (or --check: target is up to date)
 *     exit 1  --check: target differs from the generated render
 *     exit 2  input failure: missing built dist, missing region markers, or a
 *             bad --against ref
 *
 * The render is a pure function of the built innfo-mcp registry: no timestamp,
 * no generator version, no run id. Regeneration with no upstream change is
 * byte-identical (design "Regeneration is deterministic").
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { replaceRegion, renderMcpToolsRegion, normalizeOutput } from './lib/docs-facts.mjs';

const MCP_TOOLS_REGION = 'mcp-tools';
const DIST_RELATIVE_PATH = path.join('iNNfo', 'packages', 'innfo-mcp', 'dist', 'server.js');
const TARGET_RELATIVE_PATH = path.join('docs', 'innfo', 'documentation', 'innfo-mcp.md');

/**
 * @param {string[]} argv
 * @returns {{ check: boolean, against: string | null }}
 */
function parseArgs(argv) {
  let check = false;
  let against = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') check = true;
    else if (arg === '--against') against = argv[++i] ?? null;
    else if (arg.startsWith('--against=')) against = arg.slice('--against='.length);
  }
  return { check, against };
}

/**
 * Reads the tool registry from the built innfo-mcp dist. Imported as an
 * absolute file URL (Windows-safe) so the same code works from any cwd.
 * @param {string} distPath
 * @returns {Promise<Array<{ name: string, description: string }>>}
 */
async function loadToolDefinitions(distPath) {
  const mod = await import(pathToFileURL(distPath).href);
  return mod.toolDefinitions.map((tool) => ({ name: tool.name, description: tool.description }));
}

/**
 * Reads the current content of the target doc, either from the working tree
 * or from a committed git ref (design D5's `--against` seam).
 * @param {string} cwd
 * @param {string} targetPath
 * @param {string | null} against
 * @param {(cmd: string, args: string[], opts: object) => string} execFile - injectable for tests
 * @returns {{ content: string } | { error: string }}
 */
function readCurrentContent(cwd, targetPath, against, execFile) {
  if (against) {
    try {
      const relPosix = path.relative(cwd, targetPath).split(path.sep).join('/');
      const content = execFile('git', ['show', `${against}:${relPosix}`], { cwd, encoding: 'utf-8' });
      return { content };
    } catch (err) {
      return { error: `could not read ${targetPath} at git ref '${against}': ${err.message}` };
    }
  }

  if (!fs.existsSync(targetPath)) {
    return { error: `target file not found: ${targetPath}` };
  }
  return { content: fs.readFileSync(targetPath, 'utf-8') };
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, log?: (msg: string) => void, logError?: (msg: string) => void, execFile?: Function }} [options]
 * @returns {Promise<number>} process exit code
 */
export async function run(argv, options = {}) {
  const {
    cwd = process.cwd(),
    log = console.log,
    logError = console.error,
    execFile = execFileSync,
  } = options;

  const { check, against } = parseArgs(argv);

  if (against && !check) {
    logError('FAIL: --against requires --check');
    return 2;
  }

  const distPath = path.join(cwd, DIST_RELATIVE_PATH);
  if (!fs.existsSync(distPath)) {
    logError(`FAIL: innfo-mcp build artifact not found at: ${distPath}. Build it first (npm --workspace=@cognnitive/innfo-mcp run build).`);
    return 2;
  }

  let tools;
  try {
    tools = await loadToolDefinitions(distPath);
  } catch (err) {
    logError(`FAIL: could not import ${distPath}: ${err.message}`);
    return 2;
  }

  const targetPath = path.join(cwd, TARGET_RELATIVE_PATH);
  const current = readCurrentContent(cwd, targetPath, against, execFile);
  if ('error' in current) {
    logError(`FAIL: ${current.error}`);
    return 2;
  }

  const body = renderMcpToolsRegion(tools);

  let rendered;
  try {
    rendered = normalizeOutput(replaceRegion(current.content, MCP_TOOLS_REGION, body));
  } catch (err) {
    logError(`FAIL: ${err.message} in ${against ? `${targetPath} at ref '${against}'` : targetPath}`);
    return 2;
  }

  if (check) {
    if (rendered === normalizeOutput(current.content)) {
      log(`OK: ${targetPath} is up to date (${tools.length} tools)`);
      return 0;
    }
    logError(`FAIL: --check: ${targetPath} differs from the generated render (${tools.length} tools expected)`);
    return 1;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, rendered, 'utf-8');
  log(`OK: wrote ${targetPath} (${tools.length} tools)`);
  return 0;
}

async function main() {
  const exitCode = await run(process.argv.slice(2));
  process.exit(exitCode);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
