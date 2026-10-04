/**
 * provenance.js — workspace lineage-record generator.
 *
 * Builds and refreshes an iNNfo Level 3 lineage record that registers every
 * Source ingested, every Model authored under `kNNowledge/`, and every Artifact
 * under `artifacts/` as first-class iNNfo elements with explicit derivation.
 * The `# NN Sources`, `# NN ModelRecords` and `# NN Artifacts` sections are
 * re-synced from the filesystem on every run; `# NN Procedures` is an
 * append-only run log.
 *
 * Lineage projection and rendering are delegated to `@cognnitive/innfo-core`
 * via the committed mirror.
 */

const fs = require('fs');
const path = require('path');
const modelLib = require('./lib/provenance-knowledge');
const indexLib = require('./lib/workspace-index');
const {
  readLineageRecord,
  readLineageSnapshot,
  projectLineage,
  renderLineageSections,
} = require('./lib/innfo-core.generated.cjs');

/** Suffix of the pre-rename lineage record, migrated in place to `_cogNNitive_NN.md`. */
const LEGACY_RECORD_SUFFIX = '_workspace_NN.md';

/** The pre-rename `<project>_*_workspace_NN.md` record in `kNNowledge/` or the root, or null. */
function findLegacyRecord(projectDir, projectName) {
  for (const dir of ['kNNowledge', '.']) {
    const abs = dir === '.' ? projectDir : path.join(projectDir, dir);
    if (!fs.existsSync(abs)) continue;
    const name = fs
      .readdirSync(abs)
      .sort()
      .find((f) => f.startsWith(`${projectName}_`) && f.endsWith(LEGACY_RECORD_SUFFIX));
    if (name) return dir === '.' ? name : path.posix.join(dir, name);
  }
  return null;
}

/**
 * Resolve the canonical `cogNNitive` lineage-record path for a project: the
 * existing record (found by role, wherever it lives), a legacy
 * `_workspace_NN.md` record migrated in place, or the unversioned `<project>_cogNNitive_NN.md` default (model version lives in frontmatter).
 */
function resolveModelPath(projectDir, projectName) {
  const existing = readLineageRecord(projectDir);
  if (existing) return { modelPath: path.join(projectDir, existing.path), created: false };

  const legacy = findLegacyRecord(projectDir, projectName);
  if (legacy) {
    const migrated = legacy.slice(0, legacy.length - LEGACY_RECORD_SUFFIX.length) + '_cogNNitive_NN.md';
    fs.renameSync(path.join(projectDir, legacy), path.join(projectDir, migrated));
    return { modelPath: path.join(projectDir, migrated), created: false };
  }

  return { modelPath: path.join(projectDir, `${projectName}_cogNNitive_NN.md`), created: true };
}

/**
 * Build or refresh the workspace lineage record for a project.
 * @param {string} projectDir
 * @param {Record<string, any>} [options]
 * @returns {{ modelPath: string, sourceCount: number, modelCount: number, artifactCount: number, created: boolean }}
 */
function buildProvenanceKnowledge(projectDir, options = {}) {
  const projectName = options.projectName || path.basename(projectDir);
  const snapshot = readLineageSnapshot(projectDir);
  const projection = projectLineage(snapshot);
  const sections = renderLineageSections(projection);

  const { modelPath, created } = resolveModelPath(projectDir, projectName);
  const content = created
    ? modelLib.buildFreshModel(projectName, sections)
    : modelLib.refreshExistingModel(fs.readFileSync(modelPath, 'utf8'), sections);

  fs.writeFileSync(modelPath, content, 'utf8');
  indexLib.writeWorkspaceIndex(projectDir);

  return {
    modelPath,
    sourceCount: projection.sources.length,
    modelCount: projection.knowledge.length,
    artifactCount: projection.artifacts.length,
    created,
  };
}

/**
 * Append one run entry to the lineage record's `# NN Procedures` section.
 * No-op (returns null) when no lineage record exists yet.
 * @param {string} projectDir
 * @param {{ command: string, flags?: string, runAt?: string, inputs?: string[], outputs?: string[] }} run
 * @returns {{ modelPath: string } | null}
 */
function appendProcedureRun(projectDir, run) {
  const projectName = path.basename(projectDir);
  const { modelPath, created } = resolveModelPath(projectDir, projectName);
  if (created && !fs.existsSync(modelPath)) return null;
  const updated = modelLib.appendProcedureRun(fs.readFileSync(modelPath, 'utf8'), run);
  fs.writeFileSync(modelPath, updated, 'utf8');
  return { modelPath };
}

module.exports = {
  buildProvenanceKnowledge,
  appendProcedureRun,
  writeWorkspaceIndex: indexLib.writeWorkspaceIndex,
  listWorkspaceModels: indexLib.listWorkspaceModels,
};

if (require.main === module) {
  const minimist = (() => {
    try {
      return require('minimist');
    } catch {
      return null;
    }
  })();
  const args = minimist ? minimist(process.argv.slice(2)) : { src: process.argv[3] };
  const projectDir = args.src || process.cwd();
  const result = buildProvenanceKnowledge(projectDir, { projectName: args.name });
  console.log(
    `workspace lineage record ${result.created ? 'created' : 'refreshed'}: ${result.modelPath}`,
  );
  console.log(
    `Registered ${result.sourceCount} source(s), ${result.modelCount} model(s), ${result.artifactCount} artifact(s).`,
  );
}
