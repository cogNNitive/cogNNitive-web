const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const modelLib = require('./provenance-knowledge');
const { collectCitationSites } = require('./impact-checker');
const {
  readLineageSnapshot,
  readLineageRecord,
  projectLineage,
  renderLineageSections,
  checkLineageDrift,
  createFsSourceResolver,
  validateCitations,
} = require('./innfo-core.generated.cjs');

/** The `## NN Sources:` element names and `superseded_by::` values of a record's `# NN Sources` section. */
function readRecordSources(recordText) {
  const { blocks } = modelLib.splitTopLevelSections(recordText.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''));
  const section = blocks.find((b) => /^# NN Sources\b/.test(b.heading));
  const names = new Set();
  const supersededBy = [];
  if (!section) return { names, supersededBy };
  for (const line of section.lines) {
    const element = line.match(/^## NN Sources:\s*(.+?)\s*$/);
    if (element) names.add(element[1]);
    const pointer = line.match(/^superseded_by::\s*(.+?)\s*$/);
    if (pointer) supersededBy.push(pointer[1]);
  }
  return { names, supersededBy };
}

/**
 * Report drift between the lineage record and the workspace filesystem.
 *
 * Errors:
 *  (a) no lineage record exists;
 *  (b) a citation site fails `validateCitations`;
 *  (c) a Source family member on disk has no element in `# NN Sources`;
 *  (d) a `superseded_by::` value resolves to no element or file;
 *  (e) a sidecar `sha256` differs from the hash of its raw bytes;
 *  (f) a sidecar names a subject other than the one its name derives;
 *  (g) a managed section of the record differs from a fresh projection
 *      (the core drift comparator; the journal and hand-authored blocks are not compared).
 * Warnings: an orphaned sidecar (its raw file is missing). Nothing is moved,
 * archived or deleted.
 *
 * @param {string} projectDir
 * @returns {{ errors: string[], warnings: string[] }}
 */
function checkLineage(projectDir) {
  const errors = [];
  const warnings = [];

  const record = readLineageRecord(projectDir);
  if (!record) {
    errors.push('No lineage record found. Run `--scan` (or `--lineage`) to create one.');
    return { errors, warnings };
  }

  const snapshot = readLineageSnapshot(projectDir);
  const projection = projectLineage(snapshot);
  const sites = collectCitationSites(snapshot, projection);

  const resolver = createFsSourceResolver(projectDir);
  const diags = validateCitations(sites, resolver);
  for (const diag of diags) {
    errors.push(`${diag.site.referringPath}: citation "${diag.site.value}" failed validation: ${diag.message}`);
  }

  for (const d of projection.diagnostics) {
    errors.push(`${d.path}: ${d.message}`);
  }

  // Family validation against the record on disk.
  const recordText = record.content;
  const { names, supersededBy } = readRecordSources(recordText);
  const knownPaths = new Set(projection.sources.map((s) => s.raw_filename));

  for (const source of projection.sources) {
    if (!names.has(source.name)) {
      errors.push(`Unlisted family member: "${source.raw_filename}" has no element in # NN Sources. Run \`--lineage\` to sync the record.`);
    }

    const rawAbs = path.join(projectDir, source.raw_filename);
    if (!fs.existsSync(rawAbs)) {
      warnings.push(`Orphaned sidecar: "${source.normalized_content}" — its raw file "${source.raw_filename}" no longer exists. Preserved.`);
      continue;
    }
    if (source.raw_hash) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(rawAbs)).digest('hex');
      if (actual !== String(source.raw_hash).toLowerCase()) {
        errors.push(`Hash mismatch: "${source.raw_filename}" differs from the sha256 in "${source.normalized_content}". Run \`--cognitivize\` on it again.`);
      }
    }
  }

  const drift = checkLineageDrift(recordText, renderLineageSections(projection));
  if (!drift.ok) {
    for (const d of drift.diffs) {
      errors.push(`Lineage drift in ${d.section} of "${record.path}": ${d.firstDiff}. Run \`--lineage\` to regenerate the record.`);
    }
  }

  for (const pointer of supersededBy) {
    if (!knownPaths.has(pointer) && !fs.existsSync(path.join(projectDir, pointer))) {
      errors.push(`Dangling superseded_by:: "${pointer}" resolves to no element or file.`);
    }
  }

  return { errors, warnings };
}

module.exports = { checkLineage };
