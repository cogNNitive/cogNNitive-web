/**
 * scripts/lib/publish-diff.js
 *
 * Deterministic comparison of the built site tree against the public
 * distribution repo's working tree, so the one-way publish job
 * (`public-web-repository-split`) is a no-op when the artifact is
 * byte-identical — no empty commits, no churn in the public repo.
 *
 * Pure and dependency-free: the caller supplies two directory paths and gets
 * back the list of added / modified / removed relative paths. Only generated
 * content is compared; the repo's `.git` and the `CNAME`/Pages plumbing that
 * the public repo owns are excluded from the diff.
 */

const fs = require('node:fs');
const path = require('node:path');

// Paths the public repo owns and the publish must never add, overwrite, or
// delete: its own metadata and Pages config.
const PUBLISH_EXCLUDED = new Set(['.git', '.nojekyll']);

/**
 * Recursively collects `<relative posix path> -> file bytes` for every file
 * under `dir`, skipping PUBLISH_EXCLUDED top-level entries.
 *
 * @param {string} dir
 * @returns {Map<string, Buffer>}
 */
function collectTree(dir) {
  /** @type {Map<string, Buffer>} */
  const out = new Map();
  if (!fs.existsSync(dir)) return out;

  /** @param {string} absDir @param {string} relPrefix */
  const walk = (absDir, relPrefix) => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (relPrefix === '' && PUBLISH_EXCLUDED.has(entry.name)) continue;
      const abs = path.join(absDir, entry.name);
      const rel = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        out.set(rel, fs.readFileSync(abs));
      }
    }
  };

  walk(dir, '');
  return out;
}

/**
 * Computes added / modified / removed relative paths between `sourceDir`
 * (the freshly built artifact) and `targetDir` (the public repo's checkout).
 *
 * @param {string} sourceDir
 * @param {string} targetDir
 * @returns {{ added: string[], modified: string[], removed: string[], identical: boolean }}
 */
function diffTrees(sourceDir, targetDir) {
  /** @type {Map<string, Buffer>} */
  const source = collectTree(sourceDir);
  /** @type {Map<string, Buffer>} */
  const target = collectTree(targetDir);

  const added = [];
  const modified = [];
  const removed = [];

  for (const [rel, content] of source) {
    if (!target.has(rel)) added.push(rel);
    else if (!content.equals(/** @type {Buffer} */ (target.get(rel)))) modified.push(rel);
  }
  for (const rel of target.keys()) {
    if (!source.has(rel)) removed.push(rel);
  }

  added.sort();
  modified.sort();
  removed.sort();

  return {
    added,
    modified,
    removed,
    identical: added.length === 0 && modified.length === 0 && removed.length === 0,
  };
}

module.exports = { diffTrees, collectTree, PUBLISH_EXCLUDED };
