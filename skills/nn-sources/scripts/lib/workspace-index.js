const fs = require('fs');
const path = require('path');
const { displayStem, isNNName, isSidecarName } = require('./innfo-core.generated.cjs');

// Directories that never hold workspace knowledge and must not be walked when
// listing workspace models.
const INDEX_SKIP_DIRS = new Set(['backups', 'archive', 'specs', '.spec-cache', 'node_modules', '.git']);

/**
 * List workspace models: `_NN.md` documents that are not sidecars.
 * @param {string} projectDir
 * @returns {string[]}
 */
function listWorkspaceModels(projectDir) {
  const found = [];
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.') || INDEX_SKIP_DIRS.has(name)) continue;
      if (entry.isDirectory()) {
        walk(path.join(dir, name), prefix + name + '/');
      } else if (entry.isFile() && isNNName(name) && !isSidecarName(name)) {
        found.push(prefix + name);
      }
    }
  };
  walk(projectDir, './');
  return found.sort();
}

/**
 * Derives a display label for a model path: the contract display stem with any
 * `_V_x-y-z_` version tag stripped and underscores turned into spaces.
 * @param {string} relPath
 * @returns {string}
 */
function deriveIndexLabel(relPath) {
  return displayStem(path.basename(relPath))
    .replace(/_V_\d+-\d+-\d+_[A-Za-z0-9-]+$/, '')
    .replace(/_/g, ' ');
}

module.exports = {
  INDEX_SKIP_DIRS,
  listWorkspaceModels,
  deriveIndexLabel,
};
