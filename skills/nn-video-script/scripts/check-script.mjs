#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/check-script.mjs
 *
 * The Zero-Unresolved-Placeholder Gate plus the No-Upward-Escape asset check
 * for series `script.md` files (series-script-templates, video-folder-contract).
 *
 * Runs four checks in a fixed order and fails fast on the first category that
 * has findings: {{slot}} leak -> leftover `<!-- slot:` comment -> header line
 * -> asset path escape. This ordering keeps the failure report focused on one
 * root cause instead of a mixed dump (see design.md AD5's parser-ordering
 * rationale, applied here to the gate itself).
 *
 * Zero dependencies. Requires Node >= 18.
 *
 * Usage:
 *   node check-script.mjs <script.md> --series-root <dir> [--pinned-version <v>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PINNED_VERSION = 'V_0-3-3';

const PLACEHOLDER_RE = /\{\{[^{}]*\}\}/g;
const SLOT_COMMENT_RE = /<!--\s*slot:/g;
const HEADER_RE = /^\/\/\s*ANYDEO_SPEC:\s*(\S+)/;
const MARKDOWN_ASSET_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

/**
 * @param {string} content
 * @param {number} index
 * @returns {{ line: number, col: number }}
 */
function lineColAt(content, index) {
  const before = content.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

/** @param {string} content */
export function findPlaceholders(content) {
  const findings = [];
  for (const match of content.matchAll(PLACEHOLDER_RE)) {
    const { line, col } = lineColAt(content, match.index);
    findings.push({ line, col, message: `Unresolved placeholder ${match[0]}` });
  }
  return findings;
}

/** @param {string} content */
export function findLeftoverSlotComments(content) {
  const findings = [];
  for (const match of content.matchAll(SLOT_COMMENT_RE)) {
    const { line, col } = lineColAt(content, match.index);
    findings.push({ line, col, message: 'Leftover slot instruction comment (<!-- slot: ... -->) was not removed' });
  }
  return findings;
}

/**
 * @param {string} content
 * @param {string} pinnedVersion
 */
export function findHeaderIssues(content, pinnedVersion) {
  const firstLine = content.split('\n', 1)[0] ?? '';
  const match = firstLine.match(HEADER_RE);
  if (!match) {
    return [{ line: 1, col: 1, message: `Missing header line. Expected first line "//ANYDEO_SPEC: ${pinnedVersion}"` }];
  }
  if (match[1] !== pinnedVersion) {
    return [{ line: 1, col: 1, message: `Header declares spec "${match[1]}", expected pinned "${pinnedVersion}"` }];
  }
  return [];
}

/** @param {string} assetPath */
function isAllowedRemote(assetPath) {
  return /^https?:\/\//i.test(assetPath);
}

/** @param {string} assetPath */
function isForbiddenSchemeOrAbsolute(assetPath) {
  return (
    /^file:\/\//i.test(assetPath) ||
    /^asset:\/\//i.test(assetPath) ||
    path.isAbsolute(assetPath) ||
    /^[a-zA-Z]:[\\/]/.test(assetPath)
  );
}

/**
 * @param {string} content
 * @param {{ scriptDir: string, seriesRoot: string }} opts
 */
export function findAssetEscapes(content, { scriptDir, seriesRoot }) {
  const findings = [];
  for (const match of content.matchAll(MARKDOWN_ASSET_RE)) {
    const assetPath = match[1].trim();
    const { line, col } = lineColAt(content, match.index);

    if (isAllowedRemote(assetPath)) continue;

    if (isForbiddenSchemeOrAbsolute(assetPath)) {
      findings.push({ line, col, message: `Asset path uses a forbidden scheme or absolute path: ${assetPath}` });
      continue;
    }

    const resolved = path.resolve(scriptDir, assetPath);
    const relativeToSeries = path.relative(seriesRoot, resolved);
    const escapes = relativeToSeries.startsWith('..') || path.isAbsolute(relativeToSeries);
    if (escapes) {
      findings.push({ line, col, message: `Asset path escapes its Series folder: ${assetPath}` });
    }
  }
  return findings;
}

/**
 * @param {{ content: string, scriptDir: string, seriesRoot: string, pinnedVersion: string }} args
 * @returns {{ ok: boolean, category: string|null, findings: Array<{line:number,col:number,message:string}> }}
 */
export function runCheckScript({ content, scriptDir, seriesRoot, pinnedVersion }) {
  const categories = [
    { name: 'placeholder', findings: findPlaceholders(content) },
    { name: 'leftover-slot-comment', findings: findLeftoverSlotComments(content) },
    { name: 'header', findings: findHeaderIssues(content, pinnedVersion) },
    { name: 'asset-escape', findings: findAssetEscapes(content, { scriptDir, seriesRoot }) },
  ];
  for (const category of categories) {
    if (category.findings.length > 0) {
      return { ok: false, category: category.name, findings: category.findings };
    }
  }
  return { ok: true, category: null, findings: [] };
}

function parseArgs(argv) {
  const scriptPath = argv[0];
  const flag = (name, fallback) => {
    const idx = argv.indexOf(name);
    return idx !== -1 ? argv[idx + 1] : fallback;
  };
  return {
    scriptPath,
    seriesRoot: flag('--series-root', null),
    pinnedVersion: flag('--pinned-version', DEFAULT_PINNED_VERSION),
  };
}

function main() {
  const { scriptPath, seriesRoot, pinnedVersion } = parseArgs(process.argv.slice(2));
  if (!scriptPath) {
    console.error('Usage: node check-script.mjs <script.md> --series-root <dir> [--pinned-version <v>]');
    process.exit(1);
  }
  const resolvedScriptPath = path.resolve(scriptPath);
  const scriptDir = path.dirname(resolvedScriptPath);
  const resolvedSeriesRoot = seriesRoot ? path.resolve(seriesRoot) : scriptDir;
  const content = fs.readFileSync(resolvedScriptPath, 'utf8');

  const result = runCheckScript({ content, scriptDir, seriesRoot: resolvedSeriesRoot, pinnedVersion });

  if (!result.ok) {
    console.error(`❌ [check-script] ${result.category} check failed (${result.findings.length} finding(s)):`);
    for (const f of result.findings) console.error(`  - ${f.line}:${f.col} ${f.message}`);
    process.exit(1);
  }
  console.log('✅ [check-script] All checks passed: no leaked placeholders, no leftover slot comments, header pinned, no asset escapes.');
}

// Symlink/junction-safe guard: compare realpaths, not the typed path vs import.meta.url.
const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
