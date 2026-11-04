/**
 * nn-conntent/scripts/lib/plan.mjs
 *
 * The plan identity: the cost estimator stamps `plan_hash` (sha256 of the normalized
 * script text, the chosen models and the resolved unit prices) and the estimated total
 * onto the first line of the plan document. `produce --approve <plan_hash>` compares
 * that hash, so a price change or a model change invalidates a stale approval by
 * construction.
 *
 * There is no approval file: the decision lives in the Episode's `status::` and in the
 * `--approve` value, and nothing on disk can be hand-edited into consent.
 *
 * Zero external dependencies. ESM module.
 */

import crypto from 'node:crypto';
import { normalizeModelId } from './video-guard.mjs';

/**
 * Canonical JSON of the chosen models: undefined/null dropped, keys sorted.
 * @param {Record<string, string | null | undefined>} models
 * @returns {string}
 */
function canonicalModels(models = {}) {
  const out = {};
  for (const key of Object.keys(models).sort()) {
    if (models[key] !== undefined && models[key] !== null) out[key] = normalizeModelId(models[key]);
  }
  return JSON.stringify(out);
}

/**
 * Canonical JSON of the resolved unit prices, so a price change invalidates an approval.
 * @param {Record<string, string | number | null | undefined>} prices
 * @returns {string}
 */
function canonicalPrices(prices = {}) {
  const out = {};
  for (const key of Object.keys(prices || {}).sort()) {
    const value = prices[key];
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return JSON.stringify(out);
}

/**
 * @param {string} scriptContent
 * @param {Record<string, string | null | undefined>} [models] Explicitly chosen models (image/tts/avatar).
 * @param {Record<string, string | number | null | undefined>} [prices] Resolved unit prices.
 * @returns {string} Hex sha256
 */
export function computePlanHash(scriptContent, models = {}, prices = {}) {
  const normalized = String(scriptContent)
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .trim();
  return crypto
    .createHash('sha256')
    .update(normalized)
    .update('\n:::\n')
    .update(canonicalModels(models))
    .update('\n:::\n')
    .update(canonicalPrices(prices))
    .digest('hex');
}

/**
 * The machine-readable stamp: an HTML comment that MUST be the first line of the plan.
 * @param {{ planHash: string, totalUsd: number, models: string[] }} s
 * @returns {string}
 */
export function formatStamp({ planHash, totalUsd, models }) {
  return '<!-- plan_hash: ' + planHash + ' total_usd: ' + totalUsd + ' models: ' + models.join(',') + ' -->';
}

const STAMP_RE = /^<!-- plan_hash: ([0-9a-f]{64}) total_usd: ([0-9]+(?:\.[0-9]+)?) models: ([^\r\n]*?) -->/;

/**
 * Reads the stamp from the first line of a generated plan. Nothing else in the
 * document is trusted. A malformed or non-finite total yields nulls.
 * @param {string} markdown
 * @returns {{ planHash: string | null, totalUsd: number | null, models: string[] | null }}
 */
export function parsePlanMarkdown(markdown) {
  const m = STAMP_RE.exec(String(markdown).replace(/^\uFEFF/, ''));
  const total = m ? Number(m[2]) : NaN;
  if (!m || !Number.isFinite(total)) return { planHash: null, totalUsd: null, models: null };
  return { planHash: m[1], totalUsd: total, models: m[3] ? m[3].split(',') : [] };
}
