#!/usr/bin/env node

/**
 * scripts/blueprint-catalog.mjs
 *
 * Generates iNNfo/specs/bluepriNNts/catalog.json — the machine-readable Level-2
 * blueprint catalog consumed by the nn-preflight Tier-3 upgrade detection scan
 * (skills/nn-preflight/scripts/upgrade-check.js).
 *
 * Discovery rules:
 *   - Walks the bluepriNNts tree for level-2 documents only (skips samples/).
 *   - Canonical name comes from the containing directory (`<name>/spec_NN.md`),
 *     or from the bare filename for the root workspace spec (`workspace_spec_NN.md`).
 *   - Version is the authoritative frontmatter `blueprint_version` (`V_x-y-z` or
 *     dotted `x.y.z`), NOT the filename — filenames are canonical/unversioned.
 *   - `adopted` is the highest `blueprint_version` discovered for each name. On
 *     `main` only the current canonical spec is on disk, so `versions` carries a
 *     single entry; historical versions live in immutable `templates-v*` tags.
 *
 * Usage:
 *   node scripts/blueprint-catalog.mjs [--check] [--root <dir>] [--out <file>]
 *
 *   --check   compare the rendered catalog to the committed file; exit 1 on drift.
 *   --root    override the bluepriNNts tree (default: iNNfo/specs/bluepriNNts).
 *   --out     override the output file (default: iNNfo/specs/bluepriNNts/catalog.json).
 *
 * Zero external dependencies. LF line endings, stable key ordering.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_ROOT = path.join(REPO_ROOT, 'iNNfo', 'specs', 'bluepriNNts');
const DEFAULT_OUT = path.join(DEFAULT_ROOT, 'catalog.json');

const SKIP_DIRS = new Set(['samples', 'node_modules', '.git', 'dist', '.spec-cache', 'backups', 'archive']);

/**
 * Retired templates that are frozen byte-identical for legacy resolution but no
 * longer part of ACTIVE distribution. They are emitted under a top-level
 * `frozen` object and dropped from `blueprints` (so nn-preflight upgrade-check —
 * which reads only `catalog.blueprints` — gives them no upgrade notices).
 */
const FROZEN_NAMES = ['cogNNitive', 'base', 'workspace'];

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

function parseSemVer(v) {
  const m = String(v).match(/(\d+)[-_.](\d+)[-_.](\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareVersions(a, b) {
  const va = parseSemVer(a);
  const vb = parseSemVer(b);
  if (!va || !vb) return 0;
  return (va.major - vb.major) || (va.minor - vb.minor) || (va.patch - vb.patch);
}

/** Canonical `V_x-y-z` token from an authoritative `blueprint_version` value. */
function normalizeBlueprintVersion(raw) {
  const sv = parseSemVer(raw);
  return sv ? `V_${sv.major}-${sv.minor}-${sv.patch}` : null;
}

/**
 * Canonical template name for a level-2 spec path:
 *   `<name>/spec_NN.md`      -> `<name>`  (subdirectory templates)
 *   `workspace_spec_NN.md`   -> `workspace` (root workspace spec)
 */
function nameFromPath(relPosix) {
  const parts = relPosix.split('/');
  if (parts.length > 1) return parts[parts.length - 2];
  return parts[0]
    .replace(/\.(md|markdown)$/i, '')
    .replace(/_(NN|FORMAT|F)$/i, '')
    .replace(/_spec$/i, '');
}

function walk(rootDir, rel, files) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(rootDir, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      walk(rootDir, path.join(rel, entry.name), files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.join(rel, entry.name));
    }
  }
}

function generate(rootDir) {
  const files = [];
  walk(rootDir, '', files);

  const byName = new Map();
  const warnings = [];

  for (const rel of files) {
    const abs = path.join(rootDir, rel);
    let content;
    try {
      content = fs.readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    if (fm.level !== '2' && fm.level !== 2) continue;

    const relPosix = rel.replace(/\\/g, '/');
    const name = nameFromPath(relPosix);
    const version = normalizeBlueprintVersion(fm.blueprint_version);
    if (!version) {
      warnings.push(`skipped (no parseable blueprint_version): ${relPosix}`);
      continue;
    }

    const url = fm.spec_url || `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/${relPosix}`;

    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push({
      blueprint_version: version,
      spec_version: fm.spec_version || null,
      title: fm.title || null,
      url,
    });
  }

  const blueprints = {};
  const frozen = {};
  for (const [name, versions] of byName.entries()) {
    versions.sort((a, b) => compareVersions(a.blueprint_version, b.blueprint_version));
    const entry = {
      name,
      adopted: versions[versions.length - 1].blueprint_version,
      versions,
    };
    if (FROZEN_NAMES.includes(name)) {
      frozen[name] = entry;
    } else {
      blueprints[name] = entry;
    }
  }

  return {
    generator: 'scripts/blueprint-catalog.mjs',
    blueprints: Object.fromEntries(Object.keys(blueprints).sort().map((k) => [k, blueprints[k]])),
    frozen: Object.fromEntries(Object.keys(frozen).sort().map((k) => [k, frozen[k]])),
    warnings,
  };
}

function render(catalog) {
  return JSON.stringify(catalog, null, 2) + '\n';
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const rootIdx = argv.indexOf('--root');
  const outIdx = argv.indexOf('--out');
  const rootDir = rootIdx !== -1 ? argv[rootIdx + 1] : DEFAULT_ROOT;
  const outFile = outIdx !== -1 ? argv[outIdx + 1] : DEFAULT_OUT;

  if (!fs.existsSync(rootDir)) {
    console.error(`blueprint-catalog: bluepriNNts tree not found: ${rootDir}`);
    process.exit(2);
  }

  const catalog = generate(rootDir);
  const rendered = render(catalog);

  if (check) {
    const committed = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf-8') : null;
    if (rendered === committed) {
      console.log(`blueprint-catalog: OK — ${outFile} is up to date.`);
      process.exit(0);
    }
    console.error(`blueprint-catalog: DRIFT — ${outFile} is stale. Re-run without --check.`);
    if (catalog.warnings.length) {
      console.error(catalog.warnings.map((w) => `  - ${w}`).join('\n'));
    }
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, rendered, 'utf-8');
  const count = Object.keys(catalog.blueprints).length;
  console.log(`blueprint-catalog: wrote ${outFile} (${count} blueprints).`);
}

main();