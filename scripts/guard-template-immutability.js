#!/usr/bin/env node

/**
 * scripts/guard-template-immutability.js
 *
 * Zero-dependency template versioning guard for canonical iNNfo templates.
 *
 * Blueprints now ship under canonical unversioned paths
 * (`iNNfo/specs/bluepriNNts/<name>/spec_NN.md`, `workspace_spec_NN.md`). The
 * authoritative version is the frontmatter `blueprint_version`, never the
 * filename. This guard enforces that any *content* change to a canonical
 * template is accompanied by a strictly increasing `blueprint_version`
 * relative to the base branch:
 *
 *   - status M (modified): base `blueprint_version` is read via
 *     `git show <base>:<path>`. If the body changed and the working
 *     `blueprint_version` is not > the base version (semver), fail.
 *   - status A (added): the new file MUST declare a valid semver
 *     `blueprint_version` in frontmatter (no filename token required).
 *   - status R (rename): validated as M against the OLD path's base content;
 *     a pure rename with no content change passes. A rename from a *versioned*
 *     legacy filename (`<name>_V_x-y-z_...`) to the canonical filename is the
 *     one-time path migration — it only has to carry a valid `blueprint_version`,
 *     not increment one.
 *   - status D (deleted): always passes (history lives in git tags).
 *   - non-template files and files under samples/ or assets/: ignored.
 *
 * Usage:
 *   node scripts/guard-template-immutability.js [--base <ref>] [--staged]
 *                                               [--root <path>]
 *                                               [--diff-file <path> [--base-root <path>]]
 *
 *   --base       base ref to diff against (default: origin/main if it resolves,
 *                otherwise HEAD).
 *   --staged     diff the index instead of the working tree.
 *   --root       bluepriNNts directory (default: <repo>/iNNfo/specs/bluepriNNts).
 *   --diff-file  read `git diff --name-status` lines from a file instead of
 *                invoking git — enables plain-node tests. Working-tree content
 *                is read from disk (under --root); base content for M/R entries
 *                is read from --base-root (a mirror tree of the base revision).
 *
 * Exit 0 when no violations, exit 1 otherwise (every violation is printed).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parseFocusedYaml, parseFrontmatter } = require('../skills/nn-preflight/scripts/lib/yaml-lite');

const DEFAULT_ROOT = path.join(__dirname, '..', 'iNNfo', 'specs', 'bluepriNNts');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

/** Normalize `V_0-2-1` / `"0.2.1"` / `v0_2_1` to a dotted `0.2.1`. */
function normalizeVersion(v) {
  return String(v).trim().replace(/^["']|["']$/g, '').replace(/^[vV]_?/, '').replace(/[_-]/g, '.').trim();
}

/** Parse a dotted/loose semver into a [major, minor, patch] tuple, or null. */
function semver(v) {
  const m = normalizeVersion(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** > 0 if a > b, < 0 if a < b, 0 if equal. Returns NaN if either is unparseable. */
function compareSemver(a, b) {
  const sa = semver(a);
  const sb = semver(b);
  if (!sa || !sb) return NaN;
  for (let i = 0; i < 3; i++) {
    if (sa[i] !== sb[i]) return sa[i] - sb[i];
  }
  return 0;
}

/**
 * Extract the frontmatter template version from raw file content, or null.
 * Prefers `blueprint_version`; the composition roots (`base`, `cogNNitive`,
 * `workspace_spec_NN.md`) declare `template_version` instead, so fall back to
 * it rather than treating those canonical templates as version-less.
 */
function templateVersionOf(content) {
  try {
    const fm = parseFocusedYaml(parseFrontmatter(content));
    if (!fm) return null;
    const v = fm.blueprint_version != null ? fm.blueprint_version : fm.template_version;
    return v != null ? String(v) : null;
  } catch {
    return null;
  }
}

/** Canonical template filter: a markdown file directly under a template dir, outside samples/ and assets/. */
function isCanonicalBlueprint(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (!/\.md$/i.test(p)) return false;
  if (p.includes('/samples/') || p.includes('/assets/') || p.includes('/procedures/')) return false;
  const base = path.basename(p);
  // Level-2 template specs: `spec_NN.md`, `<name>_spec_NN.md`, `<name>_NN.md`.
  return /^(spec_NN|.*_spec_NN|.*_NN)\.md$/i.test(base);
}

function isUnderRoot(filePath, root) {
  const rootNorm = path.resolve(root);
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  return abs === rootNorm || abs.startsWith(rootNorm + path.sep);
}

/** Parse `git diff --name-status` lines. Renames -> `{ status:'R', target, oldPath }`. */
function parseDiffLine(line) {
  const tokens = line.split('\t').filter((t) => t.length > 0);
  if (tokens.length < 2) return null;
  const status = tokens[0].charAt(0);
  if (status === 'R' || status === 'C') {
    return { status: 'R', oldPath: tokens[1], target: tokens[2] ?? tokens[1] };
  }
  return { status, target: tokens[tokens.length - 1], oldPath: null };
}

/** Resolve the base ref: explicit --base, else origin/main if it resolves, else HEAD. */
function resolveBase() {
  const explicit = getArg('--base');
  if (explicit) return explicit;
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', 'origin/main'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return 'origin/main';
  } catch {
    return 'HEAD';
  }
}

function diffLinesFromGit(base, root, staged) {
  const range = staged ? ['--cached', base] : [base];
  const out = execFileSync('git', ['diff', '--name-status', ...range, '--', root], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out.split(/\r?\n/).filter(Boolean);
}

/** Path of `relPath` relative to the first `bluepriNNts/` segment (posix). */
function underBlueprints(relPath) {
  const p = relPath.replace(/\\/g, '/');
  const i = p.indexOf('bluepriNNts/');
  return i === -1 ? path.basename(p) : p.slice(i + 'bluepriNNts/'.length);
}

function readWorkingContent(relOrAbs) {
  const abs = path.isAbsolute(relOrAbs) ? relOrAbs : path.resolve(process.cwd(), relOrAbs);
  try {
    return fs.readFileSync(abs, 'utf-8');
  } catch {
    return null;
  }
}

function readBaseContent(relPath, base, baseRoot) {
  if (baseRoot) {
    // Test mode: base revision mirrored under <baseRoot> (a `templates/` tree).
    try {
      return fs.readFileSync(path.join(baseRoot, underBlueprints(relPath)), 'utf-8');
    } catch {
      return null;
    }
  }
  try {
    // Argument array, never a shell string: `relPath` comes verbatim from
    // `git diff --name-status`, and git does not escape `$`/backticks in paths.
    return execFileSync('git', ['show', `${base}:${relPath}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * A rename from a legacy versioned template location — either a
 * `<name>_V_x-y-z_...md` filename or a `<name>/V_x-y-z/spec_NN.md` package
 * directory — to the canonical filename. This is the one-time path migration.
 */
function isCanonicalMigrationRename(status, oldPath, target) {
  if (status !== 'R' || !oldPath) return false;
  const old = oldPath.replace(/\\/g, '/');
  const oldIsVersioned =
    /_V_[0-9]+(?:[-_.][0-9]+){2}/i.test(path.basename(old)) ||
    /\/V_[0-9]+(?:[-_.][0-9]+){2}\//i.test(old);
  const newIsCanonical = /^(spec_NN|workspace_spec_NN)\.md$/i.test(path.basename(target));
  return oldIsVersioned && newIsCanonical;
}

function normalizeBadgeForComparison(content) {
  if (!content) return content;
  return content
    .replace(/https:\/\/(?:innfo\.)?cognnitive\.com\/innfo\/app\/(?:innfo-doc)?/g, 'https://cognnitive.com/innfo/app/')
    // Canonical spec/bundle hosting host is not content: a host migration (e.g.
    // the public-web-repository-split move off the private monorepo) must not
    // require a blueprint_version bump. Normalize the host so only real content
    // changes trip the guard.
    .replace(
      /https:\/\/raw\.githubusercontent\.com\/cogNNitive\/cogNNitive(?:-web)?\//g,
      'https://raw.githubusercontent.com/cogNNitive/HOST/',
    )
    .replace(
      /https:\/\/github\.com\/cogNNitive\/cogNNitive(?:-web)?\//g,
      'https://github.com/cogNNitive/HOST/',
    )
    .replace(/\r\n/g, '\n');
}

function checkModified(relPath, baseContent, workingContent, errors, migrationRename) {
  if (workingContent == null) return;

  const workV = templateVersionOf(workingContent);
  if (!workV || !semver(workV)) {
    errors.push(
      `ERROR: ${relPath} was modified but declares no valid frontmatter blueprint_version (got "${workV ?? 'missing'}").`,
    );
    return;
  }

  // The canonical path migration only has to carry a valid version.
  if (migrationRename) return;

  if (baseContent == null) return; // no base to compare against -> don't block
  if (normalizeBadgeForComparison(baseContent) === normalizeBadgeForComparison(workingContent)) return; // no content change

  const baseV = templateVersionOf(baseContent);
  if (!baseV || !semver(baseV)) {
    // Base had no parseable version (e.g. legacy) — any valid new version is fine.
    return;
  }
  if (compareSemver(workV, baseV) <= 0) {
    errors.push(
      `ERROR: canonical template ${relPath} was modified without incrementing frontmatter ` +
        `blueprint_version (base: "${baseV}", current: "${workV}"). Bump blueprint_version on every content change.`,
    );
  }
}

function checkAdded(relPath, workingContent, errors) {
  const workV = workingContent == null ? null : templateVersionOf(workingContent);
  if (!workV || !semver(workV)) {
    errors.push(
      `ERROR: new template ${relPath} declares no valid semver frontmatter blueprint_version (got "${workV ?? 'missing'}").`,
    );
  }
}

function main() {
  const root = getArg('--root') || DEFAULT_ROOT;
  const diffFile = getArg('--diff-file');
  const baseRoot = getArg('--base-root');
  const staged = process.argv.includes('--staged');
  const base = diffFile ? (getArg('--base') || 'BASE') : resolveBase();

  const lines = diffFile
    ? fs.readFileSync(diffFile, 'utf-8').split(/\r?\n/).filter(Boolean)
    : diffLinesFromGit(base, root, staged);

  const errors = [];
  for (const line of lines) {
    const parsed = parseDiffLine(line);
    if (!parsed) continue;
    const { status, target, oldPath } = parsed;
    if (!isUnderRoot(target, root)) continue;
    if (!isCanonicalBlueprint(target)) continue;

    if (status === 'D') continue;

    if (status === 'A') {
      checkAdded(target, readWorkingContent(target), errors);
      continue;
    }

    // M or R (rename): compare working content against base content of the
    // pre-change path.
    const basePath = status === 'R' && oldPath ? oldPath : target;
    const baseContent = readBaseContent(basePath, base, baseRoot);
    const workingContent = readWorkingContent(target);
    checkModified(
      target,
      baseContent,
      workingContent,
      errors,
      isCanonicalMigrationRename(status, oldPath, target),
    );
  }

  if (errors.length > 0) {
    console.log(`Template immutability guard: ${errors.length} violation(s) found.`);
    for (const err of errors) console.log(`  ${err}`);
    process.exit(1);
  }
  console.log('Template immutability guard: OK — every changed canonical template bumps blueprint_version.');
  process.exit(0);
}

main();
