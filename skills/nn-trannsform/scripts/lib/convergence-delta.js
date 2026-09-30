/**
 * convergence-delta.js — keyed delta engine for source convergence.
 *
 * Turns a new snapshot of a keyed source family into a **read-only proposal**
 * (added / changed / removed keys), so the model can converge through the
 * reviewed mutation path instead of hand-editing or mutating a citation target.
 *
 * Sources stay immutable: this module only reads. The two newest snapshots of a
 * family are compared; nothing here writes `sources/` or the model.
 *
 * Design: OpenSpec `2026-09-30-source-convergence-strategies`.
 *   - strategies: `cite-only` (default) | `upsert` | `replace-values`.
 *   - `upsert` flags changed values (apply does not overwrite without a
 *     decision); `replace-values` overwrites them on apply. The engine emits the
 *     same shape for both; the difference is apply-time.
 *   - removed keys are flag-only (never deleted or archived by convergence).
 *   - one single key column/field (no composite keys).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseCsv } = require('./scanner-converters');

const STRATEGIES = ['cite-only', 'upsert', 'replace-values'];
const SNAPSHOT_EXTS = ['.csv', '.json'];
const TIMESTAMP_RE = /_(\d{8}-\d{6})(\.[a-z0-9]+)$/i;

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/* ── Declared strategy (domaiNN manifest) ─────────────────────── */

/**
 * Parses `## NN Source Family:` blocks from a manifest's text.
 * Each block declares `strategy:: <cite-only|upsert|replace-values>` and, for a
 * non-default strategy, a required `key:: <column>`.
 *
 * @param {string} manifestText
 * @returns {Array<{ family: string, strategy: string, key: string | null }>}
 */
function parseSourceFamilies(manifestText) {
  const families = [];
  const sectionRe = /^## NN Source Family:\s*(.+?)\s*$/gim;
  const matches = [];
  let m;
  while ((m = sectionRe.exec(manifestText)) !== null) {
    matches.push({ family: m[1].trim(), start: sectionRe.lastIndex });
  }
  for (let i = 0; i < matches.length; i++) {
    const end = i + 1 < matches.length ? matches[i + 1].start : manifestText.length;
    const body = manifestText.slice(matches[i].start, end);
    const strategyMatch = body.match(/^strategy::\s*(\S+)\s*$/im);
    const keyMatch = body.match(/^key::\s*(\S+)\s*$/im);
    families.push({
      family: matches[i].family,
      strategy: strategyMatch ? strategyMatch[1].toLowerCase() : 'cite-only',
      key: keyMatch ? keyMatch[1] : null,
    });
  }
  return families;
}

/** Finds the manifest holding `## NN Source Family:` declarations, or null. */
function findFamilyManifest(projectDir) {
  const candidates = [];
  for (const dir of [projectDir, path.join(projectDir, 'kNNowledge'), path.join(projectDir, 'models')]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('_NN.md')) candidates.push(path.join(dir, name));
    }
  }
  for (const file of candidates) {
    try {
      if (/^## NN Source Family:/im.test(fs.readFileSync(file, 'utf8'))) return file;
    } catch {
      // unreadable candidate — skip
    }
  }
  return null;
}

/* ── Snapshot resolution ──────────────────────────────────────── */

/** Walks `sources/nn` for `<family>_<YYYYMMDD-HHmmss>.<csv|json>` snapshots. */
function resolveFamilySnapshots(projectDir, family) {
  const root = path.join(projectDir, 'sources', 'nn');
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && SNAPSHOT_EXTS.includes(path.extname(entry.name).toLowerCase())) {
        const tm = entry.name.match(TIMESTAMP_RE);
        if (!tm) continue;
        const stem = entry.name.slice(0, entry.name.length - tm[0].length);
        if (stem !== family) continue;
        found.push({
          relPath: path.relative(projectDir, full).replace(/\\/g, '/'),
          absPath: full,
          timestamp: tm[1],
        });
      }
    }
  };
  walk(root);
  found.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return found;
}

/* ── Records ──────────────────────────────────────────────────── */

/** Parses a snapshot's text into an array of plain records (objects). */
function recordsFromContent(text, ext) {
  const lower = ext.toLowerCase();
  if (lower === '.csv') {
    const { rows, malformed } = parseCsv(text);
    if (malformed) throw new Error('Malformed CSV: unbalanced quotes.');
    const records = rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
    if (records.length === 0) throw new Error('Empty CSV: no header row.');
    const headers = records[0];
    return records.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });
  }
  if (lower === '.json') {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
      return parsed;
    }
    throw new Error('JSON snapshot must be an array of objects.');
  }
  throw new Error(`Unsupported snapshot extension: ${ext}`);
}

/**
 * Validates that `key` resolves to a single, unique, non-empty column across
 * `records`. Returns `{ ok, conflicts }`; never throws.
 */
function validateKey(records, key) {
  if (!key) return { ok: false, conflicts: [{ key: null, reason: 'missing_key' }] };
  const conflicts = [];
  const seen = new Set();
  records.forEach((rec, idx) => {
    if (!(key in rec)) {
      conflicts.push({ key: null, reason: 'unknown_key_column', column: key, row: idx + 1 });
      return;
    }
    const value = String(rec[key]).trim();
    if (value === '') {
      conflicts.push({ key: '', reason: 'empty_key', row: idx + 1 });
      return;
    }
    if (seen.has(value)) {
      conflicts.push({ key: value, reason: 'duplicate_key', row: idx + 1 });
      return;
    }
    seen.add(value);
  });
  return { ok: conflicts.length === 0, conflicts };
}

/* ── Delta ────────────────────────────────────────────────────── */

/**
 * Computes the deterministic keyed delta from `fromRecords` to `toRecords`.
 * Added keys carry their full non-key fields; changed values are one entry per
 * (key, field); removed keys are flag-only.
 */
function computeDelta(fromRecords, toRecords, key) {
  const fromByKey = new Map();
  for (const rec of fromRecords) fromByKey.set(String(rec[key]).trim(), rec);
  const toByKey = new Map();
  for (const rec of toRecords) toByKey.set(String(rec[key]).trim(), rec);

  const added = [];
  for (const [k, rec] of toByKey) {
    if (fromByKey.has(k)) continue;
    const fields = {};
    for (const [field, value] of Object.entries(rec)) {
      if (field === key) continue;
      fields[field] = String(value);
    }
    added.push({ key: k, fields });
  }
  added.sort((a, b) => a.key.localeCompare(b.key));

  const changed = [];
  for (const [k, toRec] of toByKey) {
    const fromRec = fromByKey.get(k);
    if (!fromRec) continue;
    const fields = new Set([...Object.keys(fromRec), ...Object.keys(toRec)]);
    for (const field of fields) {
      if (field === key) continue;
      const before = fromRec[field] === undefined ? '' : String(fromRec[field]);
      const after = toRec[field] === undefined ? '' : String(toRec[field]);
      if (before !== after) changed.push({ key: k, field, from: before, to: after });
    }
  }
  changed.sort((a, b) => a.key.localeCompare(b.key) || a.field.localeCompare(b.field));

  const removed = [];
  for (const k of fromByKey.keys()) {
    if (!toByKey.has(k)) removed.push({ key: k });
  }
  removed.sort((a, b) => a.key.localeCompare(b.key));

  return { added, changed, removed };
}

/**
 * Builds the read-only proposal for one family. Returns `{ empty: true, ... }`
 * when the strategy is `cite-only`, or when the newest target snapshot was
 * already applied (idempotence). Throws on an invalid key (no proposal).
 */
function buildProposal(options) {
  const { family, strategy, key, fromFile, fromContent, toFile, toContent, appliedToSha = null } = options;
  const base = { family, strategy, key };
  if (strategy === 'cite-only') {
    return { ...base, empty: true, reason: 'cite-only' };
  }
  const fromSha = sha256(fromContent);
  const toSha = sha256(toContent);
  const refs = {
    from: { file: fromFile, sha256: fromSha },
    to: { file: toFile, sha256: toSha },
  };
  if (fromSha === toSha || appliedToSha === toSha) {
    return { ...base, ...refs, empty: true, reason: 'up-to-date', applied: appliedToSha };
  }

  const fromExt = path.extname(fromFile);
  const toExt = path.extname(toFile);
  const fromRecords = recordsFromContent(fromContent, fromExt);
  const toRecords = recordsFromContent(toContent, toExt);
  const check = validateKey(fromRecords, key).ok ? validateKey(toRecords, key) : validateKey(fromRecords, key);
  if (!check.ok) {
    const err = new Error(`Invalid convergence key "${key}" for family "${family}".`);
    err.conflicts = check.conflicts;
    throw err;
  }

  const delta = computeDelta(fromRecords, toRecords, key);
  return { ...base, ...refs, ...delta, conflicts: [], applied: null, empty: false };
}

module.exports = {
  STRATEGIES,
  SNAPSHOT_EXTS,
  sha256,
  parseSourceFamilies,
  findFamilyManifest,
  resolveFamilySnapshots,
  recordsFromContent,
  validateKey,
  computeDelta,
  buildProposal,
};
