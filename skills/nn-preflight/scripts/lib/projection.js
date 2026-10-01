/**
 * skills/nn-preflight/scripts/lib/projection.js
 *
 * Core library for skill projection drift detection, classification, and content hashing.
 * Shared across preflight audit and skills-manager projection routines.
 * Zero external dependencies — native Node.js CommonJS.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Checks if a file or directory name belongs to the managed projectable namespace.
 * Skips hidden dotfiles and node_modules dependencies.
 * @param {string} name
 * @returns {boolean}
 */
function isProjectableName(name) {
  return typeof name === 'string' && !name.startsWith('.') && name !== 'node_modules';
}

/**
 * Classifies the filesystem entry at `dest` relative to canonical `src`.
 * Distinguishes absent, valid links, wrong/dangling links, and real directories.
 * @param {string} dest - Target projection path in agent directory.
 * @param {string} src - Canonical skill path in ~/.agents/skills/.
 * @returns {'absent' | 'link-ok' | 'link-wrong' | 'link-dangling' | 'dir'}
 */
function classifyProjection(dest, src) {
  let lstat;
  try {
    lstat = fs.lstatSync(dest);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return 'absent';
    }
    throw err;
  }

  if (lstat.isSymbolicLink()) {
    let rawTarget;
    try {
      rawTarget = fs.readlinkSync(dest);
    } catch {
      return 'link-dangling';
    }

    const resolvedTarget = path.isAbsolute(rawTarget)
      ? path.resolve(rawTarget)
      : path.resolve(path.dirname(dest), rawTarget);

    const canonicalResolved = path.resolve(src);

    let targetExists = false;
    try {
      targetExists = fs.existsSync(dest);
    } catch {
      targetExists = false;
    }

    if (!targetExists) {
      return 'link-dangling';
    }

    let realDestTarget;
    try {
      realDestTarget = path.resolve(fs.realpathSync(dest));
    } catch {
      realDestTarget = resolvedTarget;
    }

    let realCanonical;
    try {
      realCanonical = path.resolve(fs.realpathSync(src));
    } catch {
      realCanonical = canonicalResolved;
    }

    if (
      resolvedTarget.toLowerCase() === canonicalResolved.toLowerCase() ||
      realDestTarget.toLowerCase() === realCanonical.toLowerCase()
    ) {
      return 'link-ok';
    }

    return 'link-wrong';
  }

  if (lstat.isDirectory()) {
    return 'dir';
  }

  return 'dir';
}

/**
 * Computes a deterministic SHA256 hash of a directory tree for all included entries.
 * Returns null if the directory does not exist.
 * @param {string} dir - Directory to hash.
 * @param {(name: string) => boolean} [isIncluded=isProjectableName] - Filter predicate.
 * @returns {string | null}
 */
function hashTree(dir, isIncluded = isProjectableName) {
  if (!fs.existsSync(dir)) {
    return null;
  }

  /** @type {Array<{ relPath: string, hash: string }>} */
  const entries = [];

  function walk(currentDir, baseDir) {
    let items;
    try {
      items = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      if (!isIncluded(item.name)) continue;

      const fullPath = path.join(currentDir, item.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (item.isDirectory()) {
        walk(fullPath, baseDir);
      } else if (item.isFile()) {
        try {
          const content = fs.readFileSync(fullPath);
          const fileHash = crypto.createHash('sha256').update(content).digest('hex');
          entries.push({ relPath, hash: fileHash });
        } catch {}
      }
    }
  }

  walk(dir, dir);

  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const manifest = entries.map(e => `${e.relPath}:${e.hash}`).join('\n');
  return crypto.createHash('sha256').update(manifest, 'utf-8').digest('hex');
}

module.exports = {
  isProjectableName,
  classifyProjection,
  hashTree,
};
