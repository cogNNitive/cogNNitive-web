#!/usr/bin/env node

/**
 * skills/nn-update/scripts/apply-update-plan.js
 *
 * Applies a grouped Blueprint Lineage Reconciliation plan produced by
 * `nn-preflight`'s lineage audit (`lineage-audit.js --plan`).
 *
 * Three invariants, each one the reason this file exists rather than a loop in
 * the SKILL:
 *
 * 1. **The unit is the bluepriNNt group.** Every member of a unit is repinned or
 *    none is. A unit that ends with two pins is the skew `check_domain` reports.
 * 2. **All-or-none.** If any member fails re-validation, EVERY member is restored
 *    from the pre-write content (and the backup path is returned), so a failed
 *    update never leaves half a group moved.
 * 3. **Consent and freshness gate the first write.** No file is touched without
 *    `consent: true`, and a plan the workspace has outgrown (`isPlanFresh`)
 *    aborts with no writes.
 *
 * The pin is rewritten through the parser and the mutation engine, never with a
 * regular expression: `parseKnowledge` reads the document, `repin_blueprint`
 * (and `rename_concept` for an agreed mapping) mutate the AST, and
 * `serializeKnowledge` writes it back. A document the parser cannot read is a
 * hard failure, not a silent text patch.
 *
 * Note that any engine mutation freezes the model's slugs (`slug:: <slug>` on
 * every element). That is the platform contract for every changeset-driven
 * write, not a side effect of this script.
 */

const fs = require('fs');
const path = require('path');
const { backupWorkspace } = require('./backup-workspace');
const upgrade = require('../../nn-preflight/scripts/upgrade-check');
const core = require('./lib/nn-core.generated.cjs');

/** The pinned version segment inside a blueprint url, if any. */
const PIN_SEGMENT = /V_\d+-\d+-\d+/;

/**
 * Rewrite one model onto a target blueprint version through the AST.
 *
 * @param {string} content The model as read from disk.
 * @param {string} blueprint Canonical blueprint name (`coNNtent`).
 * @param {string} version Target `V_x-y-z`.
 * @param {Record<string,string>} [mapping] Concept renames agreed for the unit.
 * @returns {string} The serialized model.
 */
function reconcileContent(content, blueprint, version, mapping = {}) {
  const model = core.parseKnowledge(content);
  const current = model.frontmatter.parent_spec ?? {};
  const currentUrl = String(current.url ?? '');
  const targetUrl = PIN_SEGMENT.test(currentUrl)
    ? currentUrl.replace(new RegExp(PIN_SEGMENT.source, 'g'), version)
    : currentUrl;

  const repin = core.applyMutation(model, 'repin_blueprint', {
    to: `${blueprint}_${version}`,
    blueprintUrl: targetUrl,
    ...(current.name ? { from: String(current.name) } : {}),
  });
  if (!repin.success) {
    const detail = (repin.errors ?? []).map((e) => e.message).join('; ');
    throw new Error(`repin_blueprint failed: ${detail || 'unknown error'}`);
  }

  for (const [from, to] of Object.entries(mapping)) {
    if (!from || !to || from === to) continue;
    const renamed = core.applyMutation(model, 'rename_concept', {
      conceptName: from,
      newName: to,
    });
    // On a Level-2 blueprint `rename_concept` rewrites the Concept Definition.
    // On a Level-3 model the concept name is the section heading, and the engine
    // has no section primitive yet: the heading is renamed on the serialized AST
    // below, never on the raw file.
    if (!renamed.success && model.frontmatter.level !== 3) {
      const detail = (renamed.errors ?? []).map((e) => e.message).join('; ');
      throw new Error(`rename_concept ${from} -> ${to} failed: ${detail || 'unknown error'}`);
    }
  }

  return renameLevel3Sections(core.serializeKnowledge(model), mapping);
}

/** Rename a Level-3 concept section (`# NN <Concept>` and its `## NN <Concept>: x` children). */
function renameLevel3Sections(serialized, mapping = {}) {
  let out = serialized;
  for (const [from, to] of Object.entries(mapping)) {
    if (!from || !to || from === to) continue;
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`^# NN ${esc}$`, 'gm'), `# NN ${to}`)
      .replace(new RegExp(`^## NN ${esc}: `, 'gm'), `## NN ${to}: `);
  }
  return out;
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
function applyUpdatePlan(options) {
  const { workspaceDir, plan, consent } = options;
  const unitCount = plan && Array.isArray(plan.units) ? plan.units.length : 0;
  const modelCount = unitCount ? plan.units.reduce((total, unit) => total + unit.count, 0) : 0;

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
      let after;
      try {
        after = reconcileContent(before, unit.blueprint, unit.adopted, mapping);
      } catch (err) {
        failures.push({ path: member.path, id: member.path, message: err.message });
        continue;
      }
      fs.writeFileSync(abs, after, 'utf-8');
      written++;
      if (typeof options.validate === 'function' && options.validate(abs, after) === false) {
        failures.push({ path: member.path, id: member.path, message: 're-validation failed' });
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
      'Usage: node apply-update-plan.js --workspace-dir <dir> --catalog-file <catalog.json> [--consent] [--dry-run]',
    );
    process.exit(2);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf-8'));
  const plan = upgrade.planUpgrade(workspaceDir, catalog);
  console.log(upgrade.describePlan(plan));
  const result = applyUpdatePlan({
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

module.exports = {
  applyUpdatePlan,
  reconcileContent,
  // Deprecated aliases kept for one release.
  applyUpgradePlan: applyUpdatePlan,
  repinContent: reconcileContent,
};
