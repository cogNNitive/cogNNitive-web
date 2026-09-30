/**
 * provenance.js — workspace lineage-record generator.
 *
 * Builds and refreshes an iNNfo Level 3 lineage record that registers every
 * Source ingested, every Model authored under `models/`, and every Artifact
 * under `artifacts/` as first-class iNNfo elements with explicit derivation.
 * The `# NN Sources`, `# NN ModelRecords` and `# NN Artifacts` sections are
 * re-synced from the filesystem on every run; `# NN Procedures` is an
 * append-only run log.
 *
 * Zero runtime dependencies (Node builtins only), mirroring scanner.js.
 */

const fs = require('fs');
const path = require('path');
const modelLib = require('./lib/provenance-knowledge');
const indexLib = require('./lib/workspace-index');

/**
 * Resolve the canonical `cogNNitive` lineage-record path for a project: the
 * existing latest record, a legacy `_workspace_NN.md` record migrated in place,
 * or the V_0-2-0 default.
 */
function resolveModelPath(projectDir, projectName) {
  const latest = modelLib.resolveLatestModelFile(projectDir, projectName, indexLib.compareVersions);
  if (latest) return { modelPath: path.join(projectDir, latest), created: false };

  const legacy = modelLib.resolveLatestModelFile(
    projectDir,
    projectName,
    indexLib.compareVersions,
    '_workspace_NN.md',
  );
  if (legacy) {
    const migrated = legacy.replace(/_workspace_NN\.md$/, '_cogNNitive_NN.md');
    fs.renameSync(path.join(projectDir, legacy), path.join(projectDir, migrated));
    return { modelPath: path.join(projectDir, migrated), created: false };
  }

  return { modelPath: path.join(projectDir, `${projectName}_V_0-2-0_cogNNitive_NN.md`), created: true };
}

/**
 * Build or refresh the workspace lineage record for a project.
 * @param {string} projectDir
 * @param {Record<string, any>} [options]
 * @returns {{ modelPath: string, sourceCount: number, modelCount: number, artifactCount: number, created: boolean }}
 */
function buildProvenanceModel(projectDir, options = {}) {
  const projectName = options.projectName || path.basename(projectDir);
  const activeSources = modelLib.collectSources(path.join(projectDir, 'sources', 'nn'));
  const archivedSources = modelLib.collectArchivedSources(projectDir, activeSources);
  const sources = [...activeSources, ...archivedSources].sort((a, b) => a.name.localeCompare(b.name));
  const models = modelLib.collectModels(projectDir);
  const artifacts = modelLib.collectArtifacts(projectDir);

  const { modelPath, created } = resolveModelPath(projectDir, projectName);
  const data = { sources, models, artifacts };
  const content = created
    ? modelLib.buildFreshModel(projectName, data)
    : modelLib.refreshExistingModel(fs.readFileSync(modelPath, 'utf8'), data);

  fs.writeFileSync(modelPath, content, 'utf8');
  indexLib.writeWorkspaceIndex(projectDir);

  return {
    modelPath,
    sourceCount: sources.length,
    modelCount: models.length,
    artifactCount: artifacts.length,
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
  buildProvenanceModel,
  appendProcedureRun,
  collectSources: modelLib.collectSources,
  collectArchivedSources: modelLib.collectArchivedSources,
  collectModels: modelLib.collectModels,
  collectArtifacts: modelLib.collectArtifacts,
  slugify: modelLib.slugify,
  SOURCE_FORMAT_OPTIONS: modelLib.SOURCE_FORMAT_OPTIONS,
  mapSourceFormat: modelLib.mapSourceFormat,
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
  const result = buildProvenanceModel(projectDir, { projectName: args.name });
  console.log(
    `workspace lineage record ${result.created ? 'created' : 'refreshed'}: ${result.modelPath}`,
  );
  console.log(
    `Registered ${result.sourceCount} source(s), ${result.modelCount} model(s), ${result.artifactCount} artifact(s).`,
  );
}
