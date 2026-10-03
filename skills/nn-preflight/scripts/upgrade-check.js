#!/usr/bin/env node

/**
 * skills/nn-preflight/scripts/upgrade-check.js
 *
 * Tier-3 workspace template upgrade detection for the cogNNitive ecosystem.
 * Read-only: it inspects a workspace, classifies every Level-3 model against the
 * published Level-2 template catalog, and reports — it never mutates anything.
 *
 * Classification of a model's pinned template against the catalog `adopted`
 * version (highest published blueprint_version for that blueprint name):
 *
 *   current            — pinned == adopted
 *   upgrade-available  — pinned < adopted (gap reported as major/minor/patch)
 *   ahead              — pinned > adopted
 *   unlisted           — template name or version not in the catalog
 *   unpinned           — model has no resolvable parent_spec.url
 *
 * Consumed by preflight-check.js (--workspace-dir). Available upgrades are
 * informational and NEVER flip the preflight exit code to a blocker.
 *
 * CLI:
 *   node upgrade-check.js --workspace-dir <dir> --catalog-file <catalog.json> [--json]
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, parseFocusedYaml } = require('./lib/yaml-lite');
// Single classifier for the whole ecosystem: the primitives are bundled from
// innfo-core (AD-2) by scripts/build-preflight-primitives.mjs and drift-guarded
// by scripts/verify.js step 11. No private copy may live here.
const {
  parseSemVer,
  gapKind,
  compareVersions,
  parsePinnedUrl,
  classifyAgainstCatalog,
} = require('./lib/version-status.generated.cjs');
// Model identity is the naming contract's (bundled from innfo-core, same drift guard).
const { isNNName, isSidecarName } = require('./lib/naming-contract.generated.cjs');

const SCAN_SKIP_DIRS = new Set([
  '.git', '.backup', '.spec-cache', 'node_modules', 'dist', 'backups', 'archive',
  'sources', 'conversations', 'artifacts', 'procedures', 'specs', 'templates',
]);

/** Recursive walk for `_NN.md` documents (sidecars excluded), skipping noise/staging dirs. */
function walkModels(dir, files) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || SCAN_SKIP_DIRS.has(entry.name)) continue;
      walkModels(path.join(dir, entry.name), files);
    } else if (entry.isFile() && isNNName(entry.name) && !isSidecarName(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
}

/** Discover Level-3 models in the workspace (models/ + root, recursively). */
function discoverModels(workspaceDir) {
  const files = [];
  walkModels(workspaceDir, files);
  const models = [];
  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    let fm;
    try {
      fm = parseFocusedYaml(parseFrontmatter(content)) || {};
    } catch {
      fm = {};
    }
    if (String(fm.level) !== '3') continue;
    const parentUrl = (fm.parent_spec && fm.parent_spec.url) || fm.spec_url || null;
    models.push({
      file,
      rel: path.relative(workspaceDir, file).replace(/\\/g, '/'),
      parentUrl,
    });
  }
  return models;
}

/**
 * Classify every workspace model against the catalog.
 * `catalog` shape: { blueprints: { <name>: { name, adopted, versions: [{blueprint_version}] } } }
 *
 * Classification delegates to the shared `classifyAgainstCatalog` primitive
 * (bundled from innfo-core) so the CLI, `innfo-mcp` check_workspace, and the
 * editor all agree on one model's status. The `kind` field (bump gap) is
 * surfaced only for `upgrade-available` items, matching the pre-delegation
 * item shape.
 */
function scanWorkspaceUpgrades(workspaceDir, catalog) {
  const models = discoverModels(workspaceDir);
  const items = [];
  const summary = {
    modelsScanned: models.length,
    current: 0,
    upgradeAvailable: 0,
    ahead: 0,
    unlisted: 0,
    unpinned: 0,
  };

  for (const model of models) {
    const cls = classifyAgainstCatalog(model.parentUrl, catalog);

    if (cls.status === 'current') summary.current++;
    else if (cls.status === 'upgrade-available') summary.upgradeAvailable++;
    else if (cls.status === 'ahead') summary.ahead++;
    else if (cls.status === 'unlisted') summary.unlisted++;
    else if (cls.status === 'unpinned') summary.unpinned++;

    const item = {
      type: 'template-upgrade',
      name: model.rel,
      status: cls.status,
      template: cls.template,
      pinned: cls.pinned,
      adopted: cls.adopted,
      url: model.parentUrl,
    };
    if (cls.status === 'upgrade-available') item.kind = cls.gap;
    if (cls.detail) item.detail = cls.detail;
    items.push(item);
  }

  return { summary, items, models };
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

function main() {
  const isJson = process.argv.includes('--json');
  const workspaceDir = getArg('--workspace-dir');
  const catalogFile = getArg('--catalog-file');

  if (!workspaceDir || !catalogFile) {
    console.error('Usage: node upgrade-check.js --workspace-dir <dir> --catalog-file <catalog.json> [--json]');
    process.exit(2);
  }

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf-8'));
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'ERROR', error: err.message }));
    } else {
      console.error(`upgrade-check: cannot read catalog: ${err.message}`);
    }
    process.exit(2);
  }

  const result = scanWorkspaceUpgrades(workspaceDir, catalog);
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Templates scanned: ${result.summary.modelsScanned} model(s)`);
    for (const item of result.items) {
      const arrow = item.status === 'upgrade-available'
        ? `${item.pinned} -> ${item.adopted} (${item.kind})`
        : item.status === 'current'
          ? item.pinned
          : item.detail || item.status;
      console.log(`  [${item.status.toUpperCase()}] ${item.name} — ${arrow}`);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseSemVer,
  gapKind,
  compareVersions,
  parsePinnedUrl,
  discoverModels,
  scanWorkspaceUpgrades,
};