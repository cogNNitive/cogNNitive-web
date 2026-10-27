/**
 * skills/nn-preflight/scripts/lib/skill-content-hash.js
 *
 * Per-file SHA-256 record of an installed skill directory, so a hand-patched
 * copy can be detected independently of its version or tag (`modified locally`).
 * Canonical implementation shared by the skills manager (via the
 * `scripts/lib/skill-content-hash.js` forwarder) and nn-preflight. Zero external
 * dependencies, so the distributed nn-preflight skill stays self-contained.
 *
 * Excluded at any depth: `node_modules/` and `.bak-*` entries.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * @param {string} relPosix
 * @returns {boolean}
 */
function isExcluded(relPosix) {
  const parts = relPosix.split('/');
  return parts.includes('node_modules') || parts.some((p) => p.startsWith('.bak-'));
}

/**
 * @param {string} dir
 * @param {string} rel
 * @param {string[]} out
 * @returns {void}
 */
function walk(dir, rel, out) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const relPosix = rel ? `${rel}/${entry.name}` : entry.name;
    if (isExcluded(relPosix)) continue;
    if (entry.isDirectory()) walk(dir, relPosix, out);
    else if (entry.isFile()) out.push(relPosix);
  }
}

/**
 * One SHA-256 hex per file of `dir`, keyed by posix-relative path, excluding
 * `node_modules/` and `.bak-*`. Sorted for a stable record.
 * @param {string} dir
 * @returns {Record<string, string>}
 */
function hashSkillDir(dir) {
  /** @type {Record<string, string>} */
  const files = {};
  if (!fs.existsSync(dir)) return files;
  /** @type {string[]} */
  const list = [];
  walk(dir, '', list);
  for (const rel of list.sort()) {
    try {
      files[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex');
    } catch {
      // unreadable file: skip rather than crash a status report
    }
  }
  return files;
}

/**
 * Compares the current directory against a recorded hash map.
 * @param {string} dir
 * @param {Record<string, string>|null|undefined} recorded
 * @returns {{ modified: boolean, changed: string[], added: string[], removed: string[] }}
 */
function diffSkillDir(dir, recorded) {
  const current = hashSkillDir(dir);
  /** @type {Record<string, string>} */
  const rec = recorded || {};
  /** @type {string[]} */
  const changed = [];
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  for (const [rel, hash] of Object.entries(current)) {
    if (!(rel in rec)) added.push(rel);
    else if (rec[rel] !== hash) changed.push(rel);
  }
  for (const rel of Object.keys(rec)) {
    if (!(rel in current)) removed.push(rel);
  }
  return {
    modified: changed.length + added.length + removed.length > 0,
    changed: changed.sort(),
    added: added.sort(),
    removed: removed.sort(),
  };
}

module.exports = { hashSkillDir, diffSkillDir };
