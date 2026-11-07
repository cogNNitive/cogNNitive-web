const fs = require('fs');
const path = require('path');

/**
 * Persistent workspace-local state: convergence records per source family and the
 * content hashes a user has ignored. The file keeps its historic name.
 *
 * Lives at `<projectDir>/.cognnitive/watch-digest.json` — a workspace-local cache,
 * never a source, never a citation target.
 */

const STATE_REL_DIR = '.cognnitive';
const STATE_FILE = 'watch-digest.json';
const STATE_VERSION = 1;

/**
 * Absolute path to the digest state file for a workspace.
 * @param {string} projectDir
 * @returns {string}
 */
function statePath(projectDir) {
  return path.join(projectDir, STATE_REL_DIR, STATE_FILE);
}

/**
 * Reads the digest state. A missing or unreadable file yields empty state.
 * @param {string} projectDir
 * @returns {{ version: number, items: Record<string, { status: string, decidedAt: string, note: string }>, convergence: Record<string, { appliedToSha?: string, appliedVersion?: string, appliedAt?: string }> }}
 */
function loadState(projectDir) {
  try {
    const raw = fs.readFileSync(statePath(projectDir), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.items || typeof parsed.items !== 'object') {
      return { version: STATE_VERSION, items: {}, convergence: {} };
    }
    const convergence =
      parsed.convergence && typeof parsed.convergence === 'object' ? parsed.convergence : {};
    return { version: STATE_VERSION, items: parsed.items, convergence };
  } catch {
    return { version: STATE_VERSION, items: {}, convergence: {} };
  }
}

/**
 * Serializes state deterministically: items sorted by key, stable formatting.
 * @param {{ items: Record<string, unknown>, convergence?: Record<string, unknown> }} state
 * @returns {string}
 */
function serializeState(state) {
  /** @type {Record<string, unknown>} */
  const items = {};
  for (const key of Object.keys(state.items || {}).sort()) {
    items[key] = state.items[key];
  }
  /** @type {{ version: number, items: Record<string, unknown>, convergence?: Record<string, unknown> }} */
  const out = { version: STATE_VERSION, items };
  // Convergence state shares this file (no second store); it is emitted only
  // when present so the digest-only shape is byte-identical to before.
  if (state.convergence && Object.keys(state.convergence).length > 0) {
    /** @type {Record<string, unknown>} */
    const convergence = {};
    for (const key of Object.keys(state.convergence).sort()) {
      convergence[key] = state.convergence[key];
    }
    out.convergence = convergence;
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

/**
 * Writes the digest state, creating the cache directory lazily.
 * @param {string} projectDir
 * @param {{ items: Record<string, unknown> }} state
 * @returns {string} the written path
 */
function saveState(projectDir, state) {
  const target = statePath(projectDir);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, serializeState(state), 'utf8');
  return target;
}

/**
 * Reads the recorded convergence state for one source family.
 * @param {string} projectDir
 * @param {string} family
 * @returns {{ appliedToSha?: string, appliedVersion?: string, appliedAt?: string } | null}
 */
function getConvergence(projectDir, family) {
  const state = loadState(projectDir);
  return state.convergence[family] || null;
}

/**
 * Records the applied target snapshot + model version for one source family,
 * so re-running `--converge` is a no-op (idempotence). Shares the digest file.
 * @param {string} projectDir
 * @param {string} family
 * @param {{ appliedToSha: string, appliedVersion?: string }} entry
 * @returns {object} the updated state
 */
function recordConvergence(projectDir, family, entry) {
  const state = loadState(projectDir);
  state.convergence[family] = {
    appliedToSha: entry.appliedToSha,
    appliedVersion: entry.appliedVersion || '',
    appliedAt: new Date().toISOString(),
  };
  saveState(projectDir, state);
  return state;
}

/** Every content hash the user has explicitly `ignore`d in this workspace. */
function ignoredShas(projectDir) {
  const state = loadState(projectDir);
  const shas = new Set();
  for (const [key, record] of Object.entries(state.items)) {
    if (!record || record.status !== 'ignore') continue;
    // Keys are `root::relPath::sha256`; the trailing segment is the hash.
    const parts = String(key).split('::');
    const sha = parts[parts.length - 1];
    if (sha) shas.add(sha);
  }
  return shas;
}

module.exports = {
  STATE_REL_DIR,
  STATE_FILE,
  STATE_VERSION,
  statePath,
  loadState,
  serializeState,
  saveState,
  getConvergence,
  recordConvergence,
  ignoredShas,
};
