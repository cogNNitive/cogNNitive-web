#!/usr/bin/env node

/**
 * scripts/generate-docs-facts.mjs
 *
 * Derives two generated regions from their canonical sources (design
 * D1/D2/D3/D4/D5):
 *   - `mcp-tools` in docs/innfo/documentation/innfo-mcp.md, from the built
 *     innfo-mcp tool registry.
 *   - `skills-catalog` in docs/skills/documentation/README.md, from
 *     manifest/source.yaml. Before rendering, this job also enforces that
 *     the iNNfo model's canonical-skills Page set equals the source.yaml
 *     skill set (design D1) — a mismatch is an input failure (exit 2), not
 *     a rendering concern.
 *
 * CLI contract:
 *   node scripts/generate-docs-facts.mjs [--check] [--against <git-ref>]
 *     (no flags)            write mode: regenerate and write both regions
 *     --check               compare each render against its on-disk file, do not write
 *     --check --against X   compare each render against `git show X:<path>` instead
 *                            of the working tree (used by CI, which runs write mode
 *                            in build:docs first — see design D5)
 *
 *     exit 0  both jobs wrote (or --check: both targets are up to date)
 *     exit 1  --check: at least one target differs from its generated render
 *             (and no job hit an input failure)
 *     exit 2  input failure in at least one job: missing built dist, missing
 *             region markers, a page-set mismatch, or a bad --against ref
 *
 * Each render is a pure function of its own canonical source: no timestamp,
 * no generator version, no run id. Regeneration with no upstream change is
 * byte-identical (design "Regeneration is deterministic"). The two jobs are
 * independent — a failure in one does not skip the other, so both bodies of
 * drift are always reported and (in write mode) written together.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import {
  replaceRegion,
  renderMcpToolsRegion,
  renderSkillsCatalogRegion,
  checkSkillPageSet,
  normalizeOutput,
} from './lib/docs-facts.mjs';
import { parseNNModel } from './generate-docsify-suite.mjs';

const require = createRequire(import.meta.url);
// Reused, not reimplemented (design D2): the manifest generator already
// parses manifest/source.yaml with the repo's own zero-dependency YAML
// reader. Requiring it here keeps the skills catalog and the bootstrap
// manifest reading the exact same skill list.
const { parseSourceYaml } = require('./manifest/generate-manifest.js');

const MCP_TOOLS_REGION = 'mcp-tools';
const DIST_RELATIVE_PATH = path.join('iNNfo', 'packages', 'innfo-mcp', 'dist', 'server.js');
const MCP_TARGET_RELATIVE_PATH = path.join('docs', 'innfo', 'documentation', 'innfo-mcp.md');

const SKILLS_CATALOG_REGION = 'skills-catalog';
const SOURCE_YAML_RELATIVE_PATH = path.join('manifest', 'source.yaml');
const MODEL_RELATIVE_PATH = path.join('docs', 'skills', 'documentation', 'documentation_NN.md');
const SKILLS_TARGET_RELATIVE_PATH = path.join('docs', 'skills', 'documentation', 'README.md');
const CANONICAL_SKILLS_SECTION = 'Canonical Skills';

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
 * Writes (or, in `--check` mode, verifies) `rendered` at `targetPath`,
 * sharing the exact write/check/log contract across both regions this CLI
 * owns.
 * @param {{ targetPath: string, currentContent: string, rendered: string, check: boolean, log: Function, logError: Function, describeCount: string }} params
 * @returns {number} 0 ok, 1 drift
 */
function writeOrCheck({ targetPath, currentContent, rendered, check, log, logError, describeCount }) {
  if (check) {
    if (rendered === normalizeOutput(currentContent)) {
      log(`OK: ${targetPath} is up to date (${describeCount})`);
      return 0;
    }
    logError(`FAIL: --check: ${targetPath} differs from the generated render (${describeCount} expected)`);
    return 1;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, rendered, 'utf-8');
  log(`OK: wrote ${targetPath} (${describeCount})`);
  return 0;
}

/**
 * Job: derive the `mcp-tools` region from the built innfo-mcp registry
 * (design D3/D4/D5).
 * @returns {Promise<number>} exit code for this job alone
 */
async function runMcpToolsJob(cwd, check, against, execFile, log, logError) {
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

  const targetPath = path.join(cwd, MCP_TARGET_RELATIVE_PATH);
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

  return writeOrCheck({
    targetPath,
    currentContent: current.content,
    rendered,
    check,
    log,
    logError,
    describeCount: `${tools.length} tools`,
  });
}

/**
 * Job: derive the `skills-catalog` region from `manifest/source.yaml`,
 * guarded by the iNNfo model's canonical-skills Page set (design D1). The
 * model and `source.yaml` are always read from the working tree — they are
 * this job's canonical inputs, not the target being drift-checked; only the
 * target file honors `--against` (design D5).
 * @returns {Promise<number>} exit code for this job alone
 */
async function runSkillsCatalogJob(cwd, check, against, execFile, log, logError) {
  const sourceYamlPath = path.join(cwd, SOURCE_YAML_RELATIVE_PATH);
  let skills;
  try {
    skills = parseSourceYaml(fs.readFileSync(sourceYamlPath, 'utf-8')).skills;
  } catch (err) {
    logError(`FAIL: could not read/parse ${sourceYamlPath}: ${err.message}`);
    return 2;
  }

  const modelPath = path.join(cwd, MODEL_RELATIVE_PATH);
  let pages;
  try {
    pages = parseNNModel(fs.readFileSync(modelPath, 'utf-8')).pages;
  } catch (err) {
    logError(`FAIL: could not read/parse ${modelPath}: ${err.message}`);
    return 2;
  }

  const pageNames = pages.filter((page) => page.fields.parent === CANONICAL_SKILLS_SECTION).map((page) => page.id);
  const skillNames = skills.map((skill) => skill.name);
  const guard = checkSkillPageSet(pageNames, skillNames);
  if (!guard.ok) {
    if (guard.missingPages.length > 0) {
      logError(`FAIL: skill(s) declared in ${sourceYamlPath} with no matching Page in ${modelPath}: ${guard.missingPages.join(', ')}`);
    }
    if (guard.extraPages.length > 0) {
      logError(`FAIL: Page(s) in ${modelPath} with no matching skill in ${sourceYamlPath}: ${guard.extraPages.join(', ')}`);
    }
    return 2;
  }

  const targetPath = path.join(cwd, SKILLS_TARGET_RELATIVE_PATH);
  const current = readCurrentContent(cwd, targetPath, against, execFile);
  if ('error' in current) {
    logError(`FAIL: ${current.error}`);
    return 2;
  }

  const body = renderSkillsCatalogRegion(skills);

  let rendered;
  try {
    rendered = normalizeOutput(replaceRegion(current.content, SKILLS_CATALOG_REGION, body));
  } catch (err) {
    logError(`FAIL: ${err.message} in ${against ? `${targetPath} at ref '${against}'` : targetPath}`);
    return 2;
  }

  return writeOrCheck({
    targetPath,
    currentContent: current.content,
    rendered,
    check,
    log,
    logError,
    describeCount: `${skills.length} skills`,
  });
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, log?: (msg: string) => void, logError?: (msg: string) => void, execFile?: Function }} [options]
 * @returns {Promise<number>} the most severe exit code across both jobs (2 > 1 > 0);
 *   both jobs always run, so a failure in one never hides drift in the other.
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

  const mcpExitCode = await runMcpToolsJob(cwd, check, against, execFile, log, logError);
  const skillsExitCode = await runSkillsCatalogJob(cwd, check, against, execFile, log, logError);

  return Math.max(mcpExitCode, skillsExitCode);
}

async function main() {
  const exitCode = await run(process.argv.slice(2));
  process.exit(exitCode);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
