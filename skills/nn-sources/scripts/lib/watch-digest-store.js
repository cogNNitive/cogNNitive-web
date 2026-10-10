const fs = require('fs');
const path = require('path');

/**
 * Persistent decision state for the session-start external watch root digest.
 *
 * Stores one entry per content-addressed watch-root item, keyed by
 * `(root, relPath, sha256)`, so a decision sticks to the exact bytes it was made
 * for and an edited file is re-offered under a new key.
 *
 * Lives at `<projectDir>/.cognnitive/watch-digest.json` — a workspace-local cache,
 * never a source, never a citation target.
 */

const STATE_REL_DIR = '.cognnitive';
const STATE_FILE = 'watch-digest.json';
const STATE_VERSION = 1;

/** Statuses that must not be offered again. */
const SUPPRESSED_STATUSES = new Set(['ignore', 'import']);

/** Accepted decision values. */
const DECISION_STATUSES = ['ignore', 'postpone', 'import'];

/**
 * Builds the content-addressed digest key for a watch-root item.
 * @param {string} root
 * @param {string} relPath
 * @param {string} sha256
 * @returns {string}
 */
function digestKey(root, relPath, sha256) {
  const normalize = (value) => String(value == null ? '' : value).replace(/\\/g, '/');
  return `${normalize(root)}::${normalize(relPath)}::${normalize(sha256)}`;
}

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
 * @returns {{ version: number, items: Record<string, { status: string, decidedAt: string, note: string }> }}
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
 * @param {{ items: Record<string, unknown> }} state
 * @returns {string}
 */
function serializeState(state) {
  const items = {};
  for (const key of Object.keys(state.items || {}).sort()) {
    items[key] = state.items[key];
  }
  const out = { version: STATE_VERSION, items };
  // Convergence state shares this file (no second store); it is emitted only
  // when present so the digest-only shape is byte-identical to before.
  if (state.convergence && Object.keys(state.convergence).length > 0) {
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
 * Records a decision for a digest key. Idempotent for identical input.
 * @param {string} projectDir
 * @param {string} key
 * @param {'ignore' | 'postpone' | 'import'} status
 * @param {string} [note]
 * @returns {object} the updated state
 */
function decide(projectDir, key, status, note = '') {
  if (!DECISION_STATUSES.includes(status)) {
    throw new Error(`Unknown digest decision "${status}". Expected one of: ${DECISION_STATUSES.join(', ')}.`);
  }
  const state = loadState(projectDir);
  state.items[key] = {
    status,
    decidedAt: new Date().toISOString(),
    note: note || '',
  };
  saveState(projectDir, state);
  return state;
}

/**
 * Renders the digest: the watch-root scan filtered down to items awaiting a
 * decision (suppressed hashes dropped, postponed ones kept).
 *
 * @param {{ roots?: Array<any>, classified?: { new?: Array<any>, evolved?: Array<any>, alerts?: Array<any>, disconnected?: Array<string> } }} scanResult
 * @param {{ items: Record<string, { status: string }> }} state
 * @returns {{
 *   generatedAt: string,
 *   roots: Array<{ root: string, cadence: string, status: string }>,
 *   disconnected: Array<string>,
 *   items: Array<object>
 * }}
 */
function buildDigest(scanResult, state) {
  const classified = (scanResult && scanResult.classified) || {};
  const itemsState = (state && state.items) || {};
  const candidates = [
    ...(classified.new || []),
    ...(classified.evolved || []),
    ...(classified.alerts || []),
  ];

  const items = [];
  for (const item of candidates) {
    const key = digestKey(item.root, item.relPath, item.sha256);
    const record = itemsState[key];
    if (record && SUPPRESSED_STATUSES.has(record.status)) continue;
    items.push({
      key,
      root: item.root,
      relPath: item.relPath,
      baseName: item.baseName,
      fullPath: item.fullPath,
      cadence: item.cadence,
      sha256: item.sha256,
      deltaStatus: item.deltaStatus,
      sizeBytes: item.sizeBytes,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    roots: ((scanResult && scanResult.roots) || []).map((r) => ({
      root: r.root,
      cadence: r.cadence,
      status: r.status,
    })),
    disconnected: classified.disconnected || [],
    items,
  };
}

/**
 * Finds a scan item by its digest key across every classified bucket.
 * @param {any} scanResult
 * @param {string} key
 * @returns {object | null}
 */
function findItemByKey(scanResult, key) {
  const classified = (scanResult && scanResult.classified) || {};
  const all = [
    ...(classified.new || []),
    ...(classified.evolved || []),
    ...(classified.alerts || []),
    ...(classified.unchanged || []),
  ];
  for (const item of all) {
    if (digestKey(item.root, item.relPath, item.sha256) === key) return item;
  }
  return null;
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
  DECISION_STATUSES,
  digestKey,
  statePath,
  loadState,
  serializeState,
  saveState,
  decide,
  buildDigest,
  findItemByKey,
  getConvergence,
  recordConvergence,
  ignoredShas,
};
