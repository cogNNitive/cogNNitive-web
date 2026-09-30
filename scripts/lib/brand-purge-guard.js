#!/usr/bin/env node
/**
 * scripts/lib/brand-purge-guard.js
 *
 * Deterministic grep gate: no tracked file (path or content) may mention the two retired
 * external video product names. The canonical brand is `cogNNitive-video`.
 *
 * The forbidden names are assembled from fragments so this file and its test do not
 * themselves trip the gate.
 *
 * Exclusions are deliberately minimal; each carries the reason it cannot change:
 *
 *  - PATH_EXCLUSIONS: files that cannot be rewritten.
 *  - ALLOWED_TOKENS: VUS syntax literals that the parser and the vendored spec define.
 *    They are stripped from a line before matching, so any other occurrence on the same
 *    line still fails.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const FORBIDDEN = new RegExp(['vid' + 'genn', 'any' + 'deo'].join('|'), 'i');

/** Files and trees the gate never scans. Every entry needs a one-line reason. */
const PATH_EXCLUSIONS = [
  {
    prefix: 'iNNfo/packages/innfo-video-parser/specs/V_0-3-3.json',
    reason: 'Vendored VUS spec pinned by sha256; the upstream text cannot be edited.',
  },
  {
    prefix: 'openspec/changes/',
    reason: 'Planning artifacts and archived changes are permanent history of the retired names.',
  },
];

/** VUS syntax literals (header line and config key) that must keep the legacy spelling. */
const ALLOWED_TOKENS = [
  {
    pattern: new RegExp('//\s*' + 'ANY' + 'DEO_SPEC', 'gi'),
    reason: 'VUS header literal required by the parser grammar and every VUS script.',
  },
  {
    pattern: new RegExp('ANY' + 'DEO_SPEC', 'g'),
    reason: 'VUS header literal as matched by the grammar, regexes and their tests.',
  },
  {
    pattern: new RegExp('any' + 'deo[-_]specification', 'gi'),
    reason: 'VUS config property key (and its hyphen alias) defined by the vendored spec.',
  },
];

function isExcluded(relPath) {
  const norm = relPath.split(path.sep).join('/');
  return PATH_EXCLUSIONS.some((e) => norm === e.prefix || (e.prefix.endsWith('/') && norm.startsWith(e.prefix)));
}

function stripAllowed(line) {
  let out = line;
  for (const { pattern } of ALLOWED_TOKENS) out = out.replace(pattern, '');
  return out;
}

/**
 * @param {{ path: string, content: string | null }[]} files
 * @returns {{ path: string, line: number | null, text: string }[]}
 */
function findViolations(files) {
  const hits = [];
  for (const file of files) {
    if (isExcluded(file.path)) continue;
    if (FORBIDDEN.test(file.path)) hits.push({ path: file.path, line: null, text: '(file name)' });
    if (file.content === null) continue;
    const lines = file.content.split(/\r?\n/);
    lines.forEach((text, i) => {
      if (FORBIDDEN.test(stripAllowed(text))) hits.push({ path: file.path, line: i + 1, text: text.trim().slice(0, 160) });
    });
  }
  return hits;
}

function readTracked(repoRoot) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28 });
  return out
    .split('\0')
    .filter(Boolean)
    .map((rel) => {
      let buf;
      try {
        buf = fs.readFileSync(path.join(repoRoot, rel));
      } catch {
        return null; // tracked but deleted in the working tree
      }
      return { path: rel, content: buf.includes(0) ? null : buf.toString('utf8') };
    })
    .filter(Boolean);
}

function main() {
  const repoRoot = path.join(__dirname, '..', '..');
  const hits = findViolations(readTracked(repoRoot));
  if (hits.length === 0) {
    console.log('OK Brand purge guard: no retired product names in tracked files.');
    return 0;
  }
  console.error(`FAIL Brand purge guard: ${hits.length} hit(s). Use "cogNNitive-video" or delete the reference.`);
  for (const h of hits) console.error(`  ${h.path}${h.line ? ':' + h.line : ''}  ${h.text}`);
  return 1;
}

module.exports = { FORBIDDEN, PATH_EXCLUSIONS, ALLOWED_TOKENS, findViolations };

if (require.main === module) process.exit(main());
