/**
 * nn-video-script/scripts/lib/plan-approval.mjs
 *
 * Plan approval as an artifact. The cost estimator stamps `plan_hash` (sha256 of
 * the normalized script text + explicitly chosen models), the estimated total and
 * the model set on the first line of asset_plan.md. A HUMAN runs approve-plan.mjs
 * to write `asset_plan.approved.json`; compile refuses billable work unless that
 * file's hash matches the current script, and caps spend by it.
 *
 * Residual risk: this is a file, not a cryptographic signature. Anything with
 * write access to the workspace can still hand-write the JSON; guard the file with
 * workspace permission rules. See references/cost-guardrails.md.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import { normalizeModelId } from './video-guard.mjs';

export const APPROVAL_FILENAME = 'asset_plan.approved.json';

/**
 * Canonical JSON of the chosen models: undefined/null dropped, keys sorted.
 * @param {Record<string, string | null | undefined>} models
 */
function canonicalModels(models = {}) {
  const out = {};
  for (const key of Object.keys(models).sort()) {
    if (models[key] !== undefined && models[key] !== null) out[key] = normalizeModelId(models[key]);
  }
  return JSON.stringify(out);
}

/**
 * @param {string} scriptContent
 * @param {Record<string, string | null | undefined>} [models] Explicitly chosen models (image/tts/avatar).
 * @returns {string} Hex sha256
 */
export function computePlanHash(scriptContent, models = {}) {
  const normalized = String(scriptContent)
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .trim();
  return crypto.createHash('sha256').update(normalized).update('\n:::\n').update(canonicalModels(models)).digest('hex');
}

/**
 * The machine-readable stamp: an HTML comment that MUST be the first line of the plan.
 * @param {{ planHash: string, totalUsd: number, models: string[] }} s
 */
export function formatStamp({ planHash, totalUsd, models }) {
  return '<!-- plan_hash: ' + planHash + ' total_usd: ' + totalUsd + ' models: ' + models.join(',') + ' -->';
}

const STAMP_RE = /^<!-- plan_hash: ([0-9a-f]{64}) total_usd: ([0-9]+(?:\.[0-9]+)?) models: ([^\r\n]*?) -->/;

/**
 * Reads the stamp from the first line of a generated asset_plan.md. Nothing else
 * in the document is trusted. A malformed or non-finite total yields nulls.
 * @param {string} markdown
 * @returns {{ planHash: string | null, totalUsd: number | null, models: string[] | null }}
 */
export function parsePlanMarkdown(markdown) {
  const m = STAMP_RE.exec(String(markdown).replace(/^﻿/, ''));
  const total = m ? Number(m[2]) : NaN;
  if (!m || !Number.isFinite(total)) return { planHash: null, totalUsd: null, models: null };
  return { planHash: m[1], totalUsd: total, models: m[3] ? m[3].split(',') : [] };
}

/**
 * @param {string} approvalPath
 * @param {{ planHash: string, totalUsd: number, allowedModels: string[], allowModels?: string[], delegated?: boolean, delegatedPhrase?: string }} data
 */
export function writeApproval(approvalPath, { planHash, totalUsd, allowedModels, allowModels = [], delegated = false, delegatedPhrase = '' }) {
  const body = {
    plan_hash: planHash,
    totalUsd,
    approvedAt: new Date().toISOString(),
    allowedModels,
    allowModels,
    delegated,
    delegatedPhrase,
  };
  fs.writeFileSync(approvalPath, JSON.stringify(body, null, 2) + '\n', 'utf8');
}

const isStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Checks that an approval artifact exists, is well-formed, matches the current
 * script + models, and covers every `--allow-model` of this run.
 * A delegated approval (agent-relayed human phrase, no TTY) is accepted only
 * when `allowDelegated` is true (workspace opt-in via
 * `video-guard.json: allowDelegatedApproval`); otherwise it is refused.
 * @param {{ scriptContent: string, models?: Record<string, string | null | undefined>, approvalPath: string, allowModels?: string[], allowDelegated?: boolean }} input
 * @returns {{ ok: true, approval: { planHash: string, totalUsd: number, allowedModels: string[], allowModels: string[], approvedAt?: string, delegated?: boolean, delegatedPhrase?: string } }
 *   | { ok: false, reason: 'missing' | 'invalid' | 'mismatch' | 'unapproved-model' | 'delegated-not-allowed', message: string }}
 */
export function checkApproval({ scriptContent, models = {}, approvalPath, allowModels = [], allowDelegated = false }) {
  const hint = 'Review the plan, then a human runs: node scripts/approve-plan.mjs <asset_plan.md>.';
  if (!fs.existsSync(approvalPath)) {
    return { ok: false, reason: 'missing', message: 'No approved plan found at ' + approvalPath + '. ' + hint };
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
  } catch {
    return { ok: false, reason: 'invalid', message: 'Approval file ' + approvalPath + ' is not valid JSON. ' + hint };
  }
  const wellFormed =
    raw && typeof raw.plan_hash === 'string' && typeof raw.totalUsd === 'number' && Number.isFinite(raw.totalUsd) &&
    raw.totalUsd >= 0 && isStrings(raw.allowedModels) && isStrings(raw.allowModels);
  if (!wellFormed) {
    return { ok: false, reason: 'invalid', message: 'Approval file ' + approvalPath + ' is incomplete or malformed. ' + hint };
  }
  if (raw.delegated === true && allowDelegated !== true) {
    return {
      ok: false,
      reason: 'delegated-not-allowed',
      message:
        'Approval file ' + approvalPath + ' is a delegated (agent-relayed) approval, but this workspace does not ' +
        'opt in (video-guard.json: allowDelegatedApproval). Either approve interactively with approve-plan.mjs ' +
        'or set "allowDelegatedApproval": true in video-guard.json. ' + hint,
    };
  }
  if (raw.plan_hash !== computePlanHash(scriptContent, models)) {
    return {
      ok: false,
      reason: 'mismatch',
      message:
        'The approved plan does not match the current script or chosen models (approval ' + approvalPath + '). ' +
        'The script changed after approval. Re-run the cost estimator and approve again. ' + hint,
    };
  }
  const unapproved = allowModels.filter((m) => !raw.allowModels.includes(m));
  if (unapproved.length > 0) {
    return {
      ok: false,
      reason: 'unapproved-model',
      message:
        '--allow-model ' + unapproved.join(', ') + ' was not recorded in the approval. ' +
        'A human must approve it: node scripts/approve-plan.mjs <asset_plan.md> --allow-model <name>.',
    };
  }
  return {
    ok: true,
    approval: {
      planHash: raw.plan_hash,
      totalUsd: raw.totalUsd,
      allowedModels: raw.allowedModels,
      allowModels: raw.allowModels,
      approvedAt: raw.approvedAt,
      delegated: raw.delegated === true,
      delegatedPhrase: typeof raw.delegatedPhrase === 'string' ? raw.delegatedPhrase : '',
    },
  };
}
