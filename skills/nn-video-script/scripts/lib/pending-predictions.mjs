/**
 * skills/nn-video-script/scripts/lib/pending-predictions.mjs
 *
 * Append-only journal of long-running provider tasks at
 * `<workspaceRoot>/.cognnitive/pending-predictions.jsonl`. A task id is written the moment
 * a job is submitted (before any polling), so a timeout or crash never loses a billed task
 * and `--resume <task-id>` can poll it instead of paying for a second submit.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';

export const PENDING_RELATIVE_PATH = path.join('.cognnitive', 'pending-predictions.jsonl');

/** @param {string} root */
export function pendingPath(root) {
  return path.join(root, PENDING_RELATIVE_PATH);
}

/**
 * @param {string} root Workspace root
 * @param {Record<string, any>} record At least `{ status }` plus `taskId` and/or `intentId` (the taskId is stringified here).
 */
export function appendPending(root, record) {
  if (record.taskId !== undefined) record = { ...record, taskId: String(record.taskId) };
  const file = pendingPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let prefix = '';
  if (fs.existsSync(file) && fs.statSync(file).size > 0) {
    const fd = fs.openSync(file, 'r');
    try {
      const last = Buffer.alloc(1);
      fs.readSync(fd, last, 0, 1, fs.fstatSync(fd).size - 1);
      if (last[0] !== 0x0a) prefix = '\n';
    } finally {
      fs.closeSync(fd);
    }
  }
  fs.appendFileSync(file, prefix + JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n', 'utf8');
}

/**
 * Tolerant reader: corrupt or partial lines are skipped.
 * @param {string} root
 * @returns {Record<string, any>[]}
 */
export function readPending(root) {
  const file = pendingPath(root);
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && (typeof parsed.taskId === 'string' || typeof parsed.intentId === 'string')) out.push(parsed);
    } catch {
      // partial or corrupt line
    }
  }
  return out;
}

/**
 * The folded state of one task: the submit record (model, ref, cacheKey, ...) with the
 * latest status/detail applied. Null when the id was never journaled.
 * @param {string} root
 * @param {string} taskId
 */
export function latestPending(root, taskId) {
  const lines = readPending(root).filter((r) => r.taskId === taskId);
  if (lines.length === 0) return null;
  return lines.reduce((acc, r) => ({ ...acc, ...r }), {});
}

/**
 * Statuses that mean "a billed job for this key may still be running or may have been billed":
 * a second submit would double-bill. `completed`, `failed` (terminal) and `submit-rejected`
 * (a 4xx before any task existed) are definitive and do not block.
 */
export const BLOCKING_STATUSES = new Set(['submitting', 'submitted', 'timeout', 'failed-after-submit', 'submit-uncertain']);

/**
 * The latest journal record for a job (cache key). Every record written for a job carries its
 * cacheKey, so this is the last line mentioning it.
 * @param {string} root
 * @param {string} cacheKey
 * @returns {Record<string, any> | null}
 */
export function latestForCacheKey(root, cacheKey) {
  const lines = readPending(root).filter((r) => r.cacheKey === cacheKey);
  if (lines.length === 0) return null;
  // carry the task id and command forward from the submit record
  return lines.reduce((acc, r) => ({ ...acc, ...r }), {});
}

/**
 * The journal record that forbids a new submit for this job, or null when it is safe.
 * @param {string} root
 * @param {string} cacheKey
 */
export function findOutstanding(root, cacheKey) {
  const rec = latestForCacheKey(root, cacheKey);
  return rec && BLOCKING_STATUSES.has(rec.status) ? rec : null;
}
