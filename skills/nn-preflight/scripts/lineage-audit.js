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
// nn-core (AD-2) by scripts/build-preflight-primitives.mjs and drift-guarded
// by scripts/verify.js step 11. No private copy may live here.
const {
  parseSemVer,
  gapKind,
  compareVersions,
  parsePinnedUrl,
  classifyAgainstCatalog,
} = /** @type {any} */ (require('./lib/version-status.generated.cjs'));
// Model identity is the naming contract's (bundled from nn-core, same drift guard).
const { isNNName, isSidecarName } = /** @type {any} */ (require('./lib/naming-contract.generated.cjs'));

const SCAN_SKIP_DIRS = new Set([
  '.git', '.backup', '.spec-cache', 'node_modules', 'dist', 'backups', 'archive',
  'sources', 'conversations', 'artifacts', 'procedures', 'specs', 'templates', 'changes',
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
 * (bundled from nn-core) so the CLI, `nn-mcp` check_workspace, and the
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
      // Canonical lineage vocabulary; `status` keeps the legacy value for one
      // release so existing consumers keep parsing it.
      updateStatus:
        cls.status === 'upgrade-available' ? 'update-available' : cls.status,
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

/* ── Grouped upgrade plan (distributed-storage S4b, design A14) ─────────────
 *
 * A domaiNN upgrades ONE bluepriNNt version at a time, and every model pinning
 * that bluepriNNt moves in the same unit: repinning half of a bluepriNNt's
 * models is exactly the skew `check_domain` reports. The plan groups the
 * `upgrade-available` models by bluepriNNt, so an interactive upgrade asks one
 * question per group instead of one per model.
 *
 * The plan is pure and read-only. `planHash` covers every member path and its
 * current pin, so the apply phase can refuse a plan the workspace has outgrown
 * (a model added or repinned between planning and applying).
 */

const crypto = require('crypto');

/** Stable hash of the plan's shape: per unit, the blueprint, the target and every member pin. */
function hashPlan(units) {
  const shape = units.map((unit) => [
    unit.blueprint,
    unit.adopted,
    unit.members.map((m) => [m.path, m.pinned]),
  ]);
  return crypto.createHash('sha256').update(JSON.stringify(shape)).digest('hex');
}

/**
 * One unit per bluepriNNt with at least one `upgrade-available` model.
 *
 * `pinned` lists every distinct pin inside the unit: more than one means the
 * domaiNN ALREADY carried a skew, which the plan reports first and resolves by
 * moving the whole group to the adopted version.
 */
function planUpgrade(workspaceDir, catalog) {
  const models = discoverModels(workspaceDir);
  const groups = new Map();
  for (const model of models) {
    const cls = classifyAgainstCatalog(model.parentUrl, catalog);
    // A unit is the WHOLE bluepriNNt group, not just its stale members: consent
    // to upgrade a bluepriNNt has to cover every model that pins it, and a group
    // that already holds two pins is the skew this plan resolves.
    if (cls.status !== 'upgrade-available' && cls.status !== 'current') continue;
    const key = String(cls.template ?? '').toLowerCase();
    const group = groups.get(key) ?? {
      blueprint: cls.template,
      adopted: cls.adopted,
      gap: cls.gap,
      members: [],
      pins: new Set(),
      upgradable: 0,
    };
    group.members.push({ path: model.rel, pinned: cls.pinned, moves: cls.status === 'upgrade-available' });
    group.pins.add(cls.pinned);
    if (cls.status === 'upgrade-available') group.upgradable++;
    // The widest gap in the unit drives how loud the plan is.
    if (cls.status === 'upgrade-available' && cls.gap === 'major') group.gap = cls.gap;
    groups.set(key, group);
  }

  const units = [...groups.values()]
    // A group whose every member is already adopted has nothing to plan.
    .filter((group) => group.upgradable > 0)
    .sort((a, b) => (a.blueprint < b.blueprint ? -1 : a.blueprint > b.blueprint ? 1 : 0))
    .map((group) => {
      const members = group.members
        .slice()
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      const pinned = [...group.pins].sort()
      return {
        blueprint: group.blueprint,
        adopted: group.adopted,
        gap: group.gap,
        count: members.length,
        pinned,
        // A pre-existing skew inside the unit: reported first, resolved whole.
        skew: pinned.length > 1,
        members,
      }
    })
    .map((unit) => ({ ...unit, planHash: hashPlan([unit]) }));

  return { units, planHash: hashPlan(units) }
}

/** True when the workspace still matches the plan it was produced from. */
function isPlanFresh(plan, workspaceDir, catalog) {
  return planUpgrade(workspaceDir, catalog).planHash === plan.planHash;
}

/**
 * Consent text. States the number of models in each unit, because consent to
 * "upgrade the bluepriNNt" is consent to touch every one of them.
 */
function describePlan(plan) {
  if (plan.units.length === 0) return 'No template upgrades are available.'
  const lines = []
  for (const unit of plan.units) {
    if (unit.skew) {
      lines.push(
        `SKEW: ${unit.blueprint} is pinned at ${unit.pinned.join(', ')}; the whole group moves to ${unit.adopted}.`,
      )
    }
    lines.push(
      `Upgrade ${unit.blueprint}: ${unit.count} model(s) ${unit.pinned.join(', ')} -> ${unit.adopted}`,
    )
  }
  lines.push(`planHash ${plan.planHash}`)
  return lines.join('\n')
}

function getArg(flag) {  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

function main() {
  const isJson = process.argv.includes('--json');
  // `--audit-lineage` is the canonical flag; bare invocation already audits.
  const workspaceDir = getArg('--workspace-dir');
  const catalogFile = getArg('--catalog-file');

  if (!workspaceDir || !catalogFile) {
    console.error('Usage: node lineage-audit.js --workspace-dir <dir> --catalog-file <catalog.json> [--json] [--plan]');
    process.exit(2);
  }

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf-8'));
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'ERROR', error: err.message }));
    } else {
      console.error(`lineage-audit: cannot read catalog: ${err.message}`);
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

  // The grouped plan is OPT-IN and read-only: `--plan` answers "one unit per
  // bluepriNNt, and how many models does each move?" without changing what the
  // default invocation prints.
  if (process.argv.includes('--plan')) {
    const plan = planUpgrade(workspaceDir, catalog)
    if (isJson) console.log(JSON.stringify({ plan }, null, 2))
    else console.log(`\n${describePlan(plan)}`)
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
  scanWorkspaceLineage: scanWorkspaceUpgrades,
  planUpgrade,
  isPlanFresh,
  describePlan,
  main,
};