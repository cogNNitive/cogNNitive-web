const fs = require('fs');
const path = require('path');
const modelLib = require('./provenance-knowledge');
const indexLib = require('./workspace-index');
const {
  readLineageSnapshot,
  projectLineage,
  extractFileCitations,
  createFsSourceResolver,
  validateCitations,
} = require('./innfo-core.generated.cjs');

/**
 * Report drift between the lineage record and the workspace filesystem.
 *
 * Checks:
 *  (a) A lineage record exists in the workspace.
 *  (b) validateCitations over all projection citation sites.
 *  (c) Every curated CSV under sources/nn/ has a corresponding stem .md file (Rule 1).
 *  (d) Orphan archive chain directories emit a warning.
 *
 * @param {string} projectDir
 * @returns {{ errors: string[], warnings: string[] }}
 */
function checkLineage(projectDir) {
  const errors = [];
  const warnings = [];

  const projectName = path.basename(projectDir);
  const best = modelLib.resolveLatestModelFile(projectDir, projectName, indexLib.compareVersions);
  if (!best) {
    errors.push('No lineage record found. Run `--scan` (or `--lineage`) to create one.');
    return { errors, warnings };
  }

  const snapshot = readLineageSnapshot(projectDir);
  const projection = projectLineage(snapshot);
  const sites = [];
  for (const k of projection.knowledge) {
    sites.push(...k.citations);
  }
  for (const a of projection.artifacts) {
    sites.push(...a.citations);
  }
  for (const s of extractFileCitations(snapshot)) {
    if (!sites.some((existing) => existing.referringPath === s.referringPath && existing.value === s.value && existing.element === s.element && existing.field === s.field)) {
      sites.push(s);
    }
  }

  const resolver = createFsSourceResolver(projectDir);
  const diags = validateCitations(sites, resolver);
  for (const diag of diags) {
    errors.push(`${diag.site.referringPath}: citation "${diag.site.value}" failed validation: ${diag.message}`);
  }

  const nnDir = path.join(projectDir, 'sources', 'nn');
  if (fs.existsSync(nnDir)) {
    const csvFiles = modelLib.walkFiles(nnDir, (n) => n.endsWith('.csv'));
    for (const relCsv of csvFiles) {
      const relMd = relCsv.replace(/\.csv$/i, '.md');
      if (!fs.existsSync(path.join(nnDir, relMd))) {
        errors.push(`Curated CSV "sources/nn/${relCsv.replace(/\\/g, '/')}" has no corresponding profile Markdown file "sources/nn/${relMd.replace(/\\/g, '/')}".`);
      }
    }
  }

  const archiveDir = path.join(projectDir, 'sources', 'archive');
  if (fs.existsSync(archiveDir)) {
    const chainDirs = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'));
    for (const cd of chainDirs) {
      const chainBase = cd.name;
      const hasActiveSource = fs.existsSync(nnDir) && modelLib.walkFiles(nnDir, (n) => n.endsWith('.md') || n.endsWith('.csv')).some(
        (rel) => path.basename(rel, path.extname(rel)) === chainBase
      );
      const chainSubDir = path.join(archiveDir, chainBase);
      let hasArchivedFiles = false;
      try {
        hasArchivedFiles = fs.readdirSync(chainSubDir).length > 0;
      } catch {
        // ignore
      }
      if (!hasActiveSource && !hasArchivedFiles) {
        warnings.push(`Orphan archive chain directory: "sources/archive/${chainBase}" has neither an active source nor an archived lineage element.`);
      }
    }
  }

  return { errors, warnings };
}

module.exports = { checkLineage };
