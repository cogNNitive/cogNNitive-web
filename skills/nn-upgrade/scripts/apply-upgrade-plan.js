#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/apply-upgrade-plan.js
 *
 * Applies a GROUPED upgrade plan produced by `nn-preflight`'s
 * `upgrade-check.js --plan` (distributed-storage S4b.2, design A14).
 *
 * Three invariants, each one the reason this file exists rather than a loop in
 * the SKILL:
 *
 * 1. **The unit is the bluepriNNt group.** Every member of a unit is repinned or
 *    none is. A unit that ends with two pins is the skew `check_domain` reports.
 * 2. **All-or-none.** If any member fails re-validation, EVERY member is restored
 *    from the pre-write content (and the backup path is returned), so a failed
 *    upgrade never leaves half a group moved.
 * 3. **Consent and freshness gate the first write.** No file is touched without
 *    `consent: true`, and a plan the workspace has outgrown (`isPlanFresh`)
 *    aborts with no writes.
 *
 * The pinned->adopted schema diff and its mapping questions belong to the SKILL
 * (Flow B3): they need schema resolution this script does not do. The mapping is
 * asked ONCE per unit through the `onMapping` hook and the answer is applied to
 * every member - 24 Videos share one concept, so a per-model prompt would be 23
 * redundant questions and 23 chances to answer differently.
 */

const fs = require('fs');
const path = require('path');
const { backupWorkspace } = require('./backup-workspace');
const upgrade = require('../../nn-preflight/scripts/upgrade-check');

/** Rewrite the pinned version of one model. Only the pin changes; every other byte stays. */
function repinContent(content, blueprint, version, mapping = {}) {
  let out = content;

  // `parent_spec.name` carries the pin: "<blueprint>_<V_x-y-z>" (bare name is legal too).
  out = out.replace(
    /(parent_spec:[ \t]*\r?\n[ \t]*name:[ \t]*["']?)([^"'\r\n]+)/,
    (match, head) => `${head}${blueprint}_${version}`,
  );

  // `parent_spec.url` carries the same pin inside the file or folder name.
  out = out.replace(
    /(parent_spec:[ \t]*\r?\n(?:[ \t]*[^\r\n]*\r?\n)*?[ \t]*url:[ \t]*["']?[^"'\r\n]*?)_V_\d+-\d+-\d+/,
    (match, head) => `${head}_${version}`,
  );

  // A concept renamed between the pinned and the adopted schema: one answer, applied everywhere.
  for (const [from, to] of Object.entries(mapping)) {
    if (!from || !to || from === to) continue
    out = out.split(`## NN ${from}:`).join(`## NN ${to}:`)
  }
  return out
}

/**
 * Apply a grouped plan.
 *
 * @param {object} options
 * @param {string} options.workspaceDir domaiNN root.
 * @param {object} options.plan `planUpgrade()` output.
 * @param {object} options.catalog The catalog the plan was built from (freshness gate).
 * @param {boolean} options.consent Must be true before the first write.
 * @param {(absPath: string, content: string) => boolean} [options.validate]
 *   Re-validation of one repinned model. Returning false fails the unit.
 * @param {(concepts: string[]) => Record<string,string>} [options.onMapping]
 *   Asked ONCE per unit; the returned `{from: to}` map is applied to every member.
 * @param {string[]} [options.concepts] Concepts the caller wants mapped.
 * @param {boolean} [options.dryRun] Report what would happen, write nothing.
 * @param {string} [options.backupTarget] Where the pre-write backup goes.
 */
function applyUpgradePlan(options) {
  const { workspaceDir, plan, catalog, consent } = options;
  const unitCount = plan && Array.isArray(plan.units) ? plan.units.length : 0;
  const modelCount = unitCount
    ? plan.units.reduce((total, unit) => total + unit.count, 0)
    : 0;

  if (!plan || !Array.isArray(plan.units) || unitCount === 0) {
    return { ok: false, code: 'PLAN_EMPTY', written: 0 };
  }
  if (consent !== true) {
    // The gate is deliberate: consent names the model count, so it cannot be
    // given before a plan exists.
    return { ok: false, code: 'CONSENT_REQUIRED', written: 0, units: unitCount, models: modelCount };
  }
  if (!upgrade.isPlanFresh(plan, workspaceDir, options.catalog)) {
    return { ok: false, code: 'PLAN_STALE', written: 0, units: unitCount, models: modelCount };
  }
  if (options.dryRun) {
    return { ok: true, dryRun: true, written: 0, units: unitCount, models: modelCount };
  }

  const backup = backupWorkspace(workspaceDir, { target: options.backupTarget });
  const originals = new Map();
  const failures = [];
  let written = 0;

  for (const unit of plan.units) {
    const mapping =
      typeof options.onMapping === 'function' && options.concepts
        ? options.onMapping(options.concepts) || {}
        : {};

    for (const member of unit.members) {
      const abs = path.join(workspaceDir, member.path);
      const before = fs.readFileSync(abs, 'utf-8');
      originals.set(abs, before);
      const after = repinContent(before, unit.blueprint, unit.adopted, mapping);
      fs.writeFileSync(abs, after, 'utf-8');
      written++;
      if (typeof options.validate === 'function' && options.validate(abs, after) === false) {
        failures.push({ path: member.path, id: member.path });
      }
    }

    if (failures.length > 0) {
      // All-or-none: restore EVERY member of the run, not just this unit's, so
      // the domaiNN never keeps a partially applied plan.
      for (const [abs, content] of originals) fs.writeFileSync(abs, content, 'utf-8');
      return {
        ok: false,
        code: 'UNIT_REVALIDATION_FAILED',
        written: 0,
        rolledBack: originals.size,
        backup: backup.target,
        failing: failures,
      };
    }
  }

  return {
    ok: true,
    written,
    units: unitCount,
    models: modelCount,
    backup: backup.target,
  };
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

function main() {
  const workspaceDir = getArg('--workspace-dir');
  const catalogFile = getArg('--catalog-file');
  if (!workspaceDir || !catalogFile) {
    console.error(
      'Usage: node apply-upgrade-plan.js --workspace-dir <dir> --catalog-file <catalog.json> [--consent] [--dry-run]',
    );
    process.exit(2);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf-8'));
  const plan = upgrade.planUpgrade(workspaceDir, catalog);
  console.log(upgrade.describePlan(plan));
  const result = applyUpgradePlan({
    workspaceDir,
    catalog,
    plan,
    consent: process.argv.includes('--consent'),
    dryRun: process.argv.includes('--dry-run'),
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { applyUpgradePlan, repinContent };
