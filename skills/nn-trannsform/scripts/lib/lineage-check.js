const fs = require('fs');
const path = require('path');
const modelLib = require('./provenance-model');
const indexLib = require('./workspace-index');

/**
 * Report drift between the lineage record and the workspace filesystem.
 *
 * Errors:
 *  - a `models/*_NN.md` with no `## NN ModelRecords:` entry;
 *  - a `## NN Artifacts:` entry whose `derived_from` names a model that does
 *    not exist at all under `models/` (no model with that name, at any
 *    version);
 *  - a `sources::` value in any model that does not resolve under `sources/nn/`.
 *
 * Warnings:
 *  - a `## NN Artifacts:` entry whose `derived_from` names a model that does
 *    exist under `models/`, but whose recorded `knowledge_version` differs from
 *    the model's current `knowledge_version` (artifact-staleness diagnostic).
 *    This is a distinct, non-escalating diagnostic: it never becomes an
 *    error and never causes a non-zero exit on its own (see
 *    `scripts/index.js`, which already exits 0 when only warnings exist).
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
  const record = fs.readFileSync(path.join(projectDir, best), 'utf8');
  const models = modelLib.collectModels(projectDir);

  // 1. Every model file is registered.
  for (const m of models) {
    if (!record.includes(`model_ref:: ${m.model_ref}`)) {
      errors.push(`${m.model_ref} has no entry in the lineage record's # NN ModelRecords section.`);
    }
  }

  // 2. Every artifact's derived_from resolves to a real model / version.
  for (const blk of record.split(/^## NN Artifacts:/m).slice(1)) {
    const df = blk.match(/^derived_from::\s*\[(.*)\]/m);
    if (!df) continue;
    const nameLine = blk.split(/\r?\n/, 1)[0].trim();
    for (const ref of df[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const ok = models.some(
        (m) => ref === m.name || (m.knowledge_version && ref === `${m.name} ${m.knowledge_version}`),
      );
      if (ok) continue;

      const known = models.filter((m) => ref.startsWith(`${m.name} `));
      if (known.length > 0) {
        const versions = known
          .map((m) => m.knowledge_version || 'no knowledge_version')
          .join(', ');
        const knownName = known[0].name;
        warnings.push(
          `Artifact "${nameLine}" derives from "${ref}", but models/ has "${knownName}" at ${versions} — artifact may be stale.`,
        );
      } else {
        errors.push(
          `Artifact "${nameLine}" derives from "${ref}", but no such model/version exists under models/.`,
        );
      }
    }
  }

  // 3. Every sources:: Citation in every model resolves under sources/nn/.
  const nnDir = path.join(projectDir, 'sources', 'nn');
  const modelsDir = path.join(projectDir, 'models');
  for (const rel of modelLib.walkFiles(modelsDir, (n) => n.endsWith('_NN.md'))) {
    const content = fs.readFileSync(path.join(modelsDir, rel), 'utf8');
    for (const ref of modelLib.scrapeSourceRefs(content)) {
      const filePart = ref.replace(/#.*$/, '').replace(/^sources\/nn\//, '').trim();
      if (!filePart || filePart.startsWith('models/')) continue;
      if (!fs.existsSync(path.join(nnDir, filePart))) {
        errors.push(`models/${rel}: sources:: "${ref}" does not resolve under sources/nn/.`);
      }
    }
  }

  // 4. Archive checks
  const archiveDir = path.join(projectDir, 'sources', 'archive');
  const sourceBlocks = record.split(/^## NN Sources:/m).slice(1);
  const parsedSources = sourceBlocks.map((blk) => {
    const lines = blk.split(/\r?\n/);
    const name = lines[0].trim();
    const getField = (f) => {
      const m = blk.match(new RegExp(`^${f}::\\s*(.+?)\\s*$`, 'm'));
      return m ? m[1].trim() : null;
    };
    return {
      name,
      status: getField('status'),
      version: getField('version'),
      archive_path: getField('archive_path'),
      superseded_by: getField('superseded_by'),
      raw_hash: getField('raw_hash'),
      normalized_content: getField('normalized_content'),
    };
  });

  if (fs.existsSync(archiveDir)) {
    // 4.1 Unlisted snapshot: every sources/archive/** file must have a matching status:: archived lineage element
    const snapshotFiles = [];
    const walkArchive = (d, rel) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        if (ent.name.startsWith('.')) continue;
        const abs = path.join(d, ent.name);
        const relPath = rel ? `${rel}/${ent.name}` : ent.name;
        if (ent.isDirectory()) walkArchive(abs, relPath);
        else if (ent.isFile() && ent.name.endsWith('.md')) snapshotFiles.push(relPath);
      }
    };
    walkArchive(archiveDir, '');

    for (const snap of snapshotFiles) {
      const snapPosix = snap.replace(/\\/g, '/');
      const expectedNormContent = `sources/archive/${snapPosix}`;
      const found = parsedSources.some(
        (s) => s.status === 'archived' && s.normalized_content === expectedNormContent
      );
      if (!found) {
        errors.push(`Unlisted snapshot: "sources/archive/${snapPosix}" has no status:: archived element in the lineage record.`);
      }
    }

    // 4.4 Orphan chain: chain dir with neither an active source nor an archived element -> warning
    const chainDirs = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'));
    for (const cd of chainDirs) {
      const chainBase = cd.name;
      const hasActiveSource = fs.existsSync(nnDir) && modelLib.walkMarkdown(nnDir).some(
        (rel) => path.basename(rel, '.md') === chainBase
      );
      const hasArchivedElement = parsedSources.some(
        (s) => s.status === 'archived' && (s.name === chainBase || s.name.startsWith(`${chainBase} `) || (s.normalized_content && s.normalized_content.includes(`/archive/${chainBase}/`)))
      );
      if (!hasActiveSource && !hasArchivedElement) {
        warnings.push(`Orphan archive chain directory: "sources/archive/${chainBase}" has neither an active source nor an archived lineage element.`);
      }
    }
  }

  // 4.2 Dangling archive_path / superseded_by
  for (const s of parsedSources) {
    if (s.archive_path) {
      const targetAbs = path.join(projectDir, s.archive_path);
      if (!fs.existsSync(targetAbs)) {
        errors.push(`Dangling archive_path: "${s.archive_path}" in element "${s.name}" does not resolve on disk.`);
      }
    }
    if (s.superseded_by) {
      const targetName = s.superseded_by;
      const targetElementExists = parsedSources.some(
        (other) => other.name === targetName || (other.version && `${other.name} ${other.version}` === targetName)
      );
      if (!targetElementExists) {
        errors.push(`Dangling superseded_by: "${targetName}" in element "${s.name}" does not resolve to any active or archived source.`);
      }
    }
  }

  // 4.3 Hash mismatch: archived element raw_hash vs snapshot frontmatter sha256
  for (const s of parsedSources) {
    if (s.status === 'archived' && s.normalized_content && s.raw_hash) {
      const targetAbs = path.join(projectDir, s.normalized_content);
      if (fs.existsSync(targetAbs)) {
        try {
          const content = fs.readFileSync(targetAbs, 'utf8');
          const fm = modelLib.parseSourceFrontmatter(content);
          if (fm && fm.hash && fm.hash !== s.raw_hash) {
            errors.push(
              `Hash mismatch: archived element "${s.name}" raw_hash "${s.raw_hash}" does not match snapshot frontmatter sha256 "${fm.hash}".`
            );
          }
        } catch {
          // File read error caught elsewhere if needed
        }
      }
    }
  }

  return { errors, warnings };
}

module.exports = { checkLineage };
