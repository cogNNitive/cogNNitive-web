/**
 * nn-video-script/scripts/lib/video-guard.mjs
 *
 * Spend guardrails for billable video-provider calls: workspace config
 * (`video-guard.json`), model allow/block lists, a per-run budget, a rolling
 * 24h cap read from an append-only ledger, a cross-process avatar slot lock and
 * a concurrency limiter.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { acquireSlot, withFileLock } from './file-lock.mjs';

export const GUARD_FILENAME = 'video-guard.json';
export const LEDGER_RELATIVE_PATH = path.join('.cognnitive', 'video-ledger.jsonl');
export const LOCKS_RELATIVE_DIR = path.join('.cognnitive', 'locks');
const DAY_MS = 24 * 3600 * 1000;

/** Safe defaults used when no video-guard.json is found (also the shape of the file). */
export const DEFAULT_GUARD = Object.freeze({
  version: 1,
  budgetPerRunUsd: 2.0,
  dailyCapUsd: 5.0,
  maxAvatarConcurrency: 1,
  maxAvatarSeconds: 300,
  allowedModels: [
    'minimax/speech-2.8-hd',
    'wavespeed-ai/infinitetalk-fast',
    'wavespeed-ai/z-image/turbo',
    'black-forest-labs/flux-schnell',
    'luma/uni-v1/text-to-image',
    'black-forest-labs/flux-3/text-to-image',
    'wavespeed-ai/minimax-h3/image-edit',
  ],
  blockedModels: ['wavespeed-ai/infinitetalk'],
  voices: {},
  // When true, compile/synthesize-avatar accept delegated (agent-relayed) plan
  // approvals. Default false: delegation is opt-in per workspace because a chat
  // phrase is weaker than a TTY (prompt-injection surface). See cost-guardrails.md.
  allowDelegatedApproval: false,
  // Provider-native voices that need no registration or cloning; a trailing * is a prefix glob.
  systemVoices: [
    'Friendly_Person', 'Wise_Woman', 'Deep_Voice_Man', 'Inspirational_girl', 'Calm_Woman', 'Casual_Guy', 'Lively_Girl', 'Patient_Man', 'Young_Knight', 'Determined_Man', 'Lovely_Girl', 'Decent_Boy', 'Imposing_Manner', 'Elegant_Man', 'Abbess', 'Sweet_Girl_2', 'Exuberant_Girl', 'English_*',
  ],
});

/**
 * Model-alias normalization. The VUS spec names models with a `replicate/` route prefix
 * (`replicate/minimax/speech-2.8-hd`), but calls go to WaveSpeed, whose id is the remainder
 * (`minimax/speech-2.8-hd`). A leading `replicate/` is stripped only when the remainder is a
 * `<vendor>/<model>` id; catalog-style ids such as `replicate/flux-schnell` are left alone.
 * The guard (allow/block, approval coverage), pricing, the request URL, the ledger and
 * plan_hash all use the normalized id; script property keys keep the ORIGINAL string.
 * @param {string} id
 * @returns {string}
 */
export function normalizeModelId(id) {
  if (typeof id !== 'string') return id;
  const m = /^replicate\/([^/]+\/.+)$/.exec(id);
  return m ? m[1] : id;
}

export class ModelBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelBlockedError';
  }
}

export class BudgetExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class ApprovalRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

/**
 * The single root resolver for guard config, ledger, locks and cache.
 * A `video-guard.json` found anywhere above `startDir` wins; otherwise the
 * nearest `.git`; otherwise `startDir` itself. (`.cognnitive` is NOT a marker:
 * a stray series-level cache dir must not re-root the workspace.)
 * @param {string} [startDir]
 * @returns {{ root: string, guardFile: string | null }}
 */
export function resolveWorkspace(startDir = process.cwd()) {
  const start = path.resolve(startDir);
  const walk = (marker) => {
    let dir = start;
    for (;;) {
      if (fs.existsSync(path.join(dir, marker))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  };
  const guardDir = walk(GUARD_FILENAME);
  if (guardDir) return { root: guardDir, guardFile: path.join(guardDir, GUARD_FILENAME) };
  return { root: walk('.git') || start, guardFile: null };
}

/**
 * @param {string} [startDir]
 * @returns {string}
 */
export function findWorkspaceRoot(startDir = process.cwd()) {
  return resolveWorkspace(startDir).root;
}

const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0);
const isMoney = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * True when `name` is a provider-native system voice: an exact match or a trailing-* prefix glob.
 * @param {string} name
 * @param {string[]} systemVoices
 */
export function isSystemVoice(name, systemVoices = []) {
  return systemVoices.some((p) => (p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p));
}

/**
 * Throws a loud error unless `config` is a valid guard config.
 * An empty or null `allowedModels` is invalid (it must never mean "allow all").
 * @param {Record<string, any>} config
 * @param {string} source Where the config came from (for the message).
 */
export function validateConfig(config, source) {
  const problems = [];
  if (!isMoney(config.budgetPerRunUsd)) problems.push('budgetPerRunUsd must be a finite number >= 0');
  if (!isMoney(config.dailyCapUsd)) problems.push('dailyCapUsd must be a finite number >= 0');
  if (!Number.isInteger(config.maxAvatarConcurrency) || config.maxAvatarConcurrency < 1) {
    problems.push('maxAvatarConcurrency must be a positive integer');
  }
  if (typeof config.maxAvatarSeconds !== 'number' || !Number.isFinite(config.maxAvatarSeconds) || config.maxAvatarSeconds <= 0) {
    problems.push('maxAvatarSeconds must be a finite number > 0');
  }
  if (!isStringArray(config.allowedModels) || config.allowedModels.length === 0) {
    problems.push('allowedModels must be a non-empty array of model ids');
  }
  if (!isStringArray(config.blockedModels)) problems.push('blockedModels must be an array of model ids');
  if (config.allowDelegatedApproval !== undefined && typeof config.allowDelegatedApproval !== 'boolean') {
    problems.push('allowDelegatedApproval must be a boolean');
  }
  if (!isStringArray(config.systemVoices)) problems.push('systemVoices must be an array of voice names (a trailing * is allowed)');
  if (!config.voices || typeof config.voices !== 'object' || Array.isArray(config.voices)) {
    problems.push('voices must be an object');
  }
  if (problems.length > 0) {
    throw new Error('Invalid ' + GUARD_FILENAME + ' (' + source + '): ' + problems.join('; '));
  }
}

/**
 * Loads and validates the guard config for the workspace containing `startDir`.
 * @param {string} [startDir]
 * @returns {{ config: Record<string, any>, source: string | null, root: string }}
 */
export function loadGuard(startDir = process.cwd()) {
  const { root, guardFile } = resolveWorkspace(startDir);
  let config = structuredClone(DEFAULT_GUARD);
  if (guardFile) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(guardFile, 'utf8'));
    } catch (err) {
      throw new Error('Invalid ' + GUARD_FILENAME + ' at ' + guardFile + ': ' + err.message);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid ' + GUARD_FILENAME + ' at ' + guardFile + ': expected a JSON object');
    }
    config = { ...config, ...parsed };
  }
  validateConfig(config, guardFile || 'defaults');
  return { config, source: guardFile, root };
}

/**
 * Default video cache dir for the workspace containing `startDir`.
 * @param {string} [startDir]
 * @returns {string}
 */
export function resolveDefaultCacheDir(startDir = process.cwd()) {
  return path.join(findWorkspaceRoot(startDir), '.cognnitive', 'cache', 'video');
}

/**
 * Throws ModelBlockedError unless `model` may be used. The blocklist always
 * wins, then the allowlist applies; `allowBlocked` lists the models explicitly
 * unlocked for this run (`--allow-model <name>`).
 * @param {string} model
 * @param {{ config: { allowedModels?: string[], blockedModels?: string[] }, allowBlocked?: string[] }} opts
 */
export function assertModelAllowed(rawModel, { config, allowBlocked = [] }) {
  const model = normalizeModelId(rawModel);
  if (allowBlocked.map(normalizeModelId).includes(model)) return;
  if ((config.blockedModels || []).map(normalizeModelId).includes(model)) {
    throw new ModelBlockedError(
      'Model "' + model + '" is blocked by ' + GUARD_FILENAME + ' (blockedModels). ' +
        'Pass --allow-model ' + model + ' to override for this run.',
    );
  }
  const allowed = (config.allowedModels || []).map(normalizeModelId);
  if (!allowed.includes(model)) {
    throw new ModelBlockedError(
      'Model "' + model + '" is not in allowedModels of ' + GUARD_FILENAME + '. ' +
        'Add it there, or pass --allow-model ' + model + ' for this run.',
    );
  }
}

/** Per-run running total of estimated spend against a budget. */
export class BudgetTracker {
  /** @param {{ budgetUsd: number }} opts */
  constructor({ budgetUsd }) {
    if (!isMoney(budgetUsd)) throw new Error('BudgetTracker: budgetUsd must be a finite number >= 0');
    this.budgetUsd = budgetUsd;
    this.totalUsd = 0;
  }

  /** Gives back a charge for a call that was rejected before any task was created. */
  refund(usd) {
    this.totalUsd = Math.max(0, Math.round((this.totalUsd - usd) * 1e6) / 1e6);
  }

  get remainingUsd() {
    return Math.round((this.budgetUsd - this.totalUsd) * 1e6) / 1e6;
  }

  /**
   * Records `estUsd`, or throws BEFORE recording when it would exceed the cap.
   * @param {number} estUsd Finite, non-negative.
   * @param {string} [label]
   * @param {number} [capUsd] Cap for this charge (defaults to the tracker budget).
   */
  charge(estUsd, label = 'call', capUsd = this.budgetUsd) {
    if (typeof estUsd !== 'number' || !Number.isFinite(estUsd) || estUsd < 0) {
      throw new TypeError('estUsd must be a finite number >= 0, got ' + String(estUsd) + ' for "' + label + '"');
    }
    const next = Math.round((this.totalUsd + estUsd) * 1e6) / 1e6;
    if (next > capUsd) {
      throw new BudgetExceededError(
        'Budget exceeded: "' + label + '" (~$' + estUsd.toFixed(4) + ') would raise the spend of this run to $' +
          next.toFixed(4) + ', over the $' + capUsd.toFixed(2) + ' per-run cap (budgetPerRunUsd in ' + GUARD_FILENAME +
          ', or 1.25x the approved plan total). Nothing was spent on this call.',
      );
    }
    this.totalUsd = next;
  }
}

/**
 * @param {string} root Workspace root
 * @returns {string}
 */
export function ledgerPath(root) {
  return path.join(root, LEDGER_RELATIVE_PATH);
}

/**
 * Appends one JSON line (a new line is started if the file ends mid-line).
 * @param {string} root Workspace root
 * @param {Record<string, any>} entry
 */
export function appendLedger(root, entry) {
  const file = ledgerPath(root);
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
  const line = { ts: new Date().toISOString(), ...entry, cacheHit: entry.cacheHit === true };
  fs.appendFileSync(file, prefix + JSON.stringify(line) + '\n', 'utf8');
}

/**
 * Tolerant ledger reader: corrupt or partial lines are skipped.
 * @param {string} root
 * @returns {Record<string, any>[]}
 */
export function readLedger(root) {
  const file = ledgerPath(root);
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) out.push(parsed);
    } catch {
      // partial or corrupt line
    }
  }
  return out;
}

/**
 * Sum of estimated spend recorded at or after `sinceMs` (cache hits and
 * entries with a missing/invalid timestamp or amount do not count).
 * @param {string} root
 * @param {number} sinceMs Epoch milliseconds
 * @returns {number}
 */
export function sumLedgerSince(root, sinceMs) {
  let sum = 0;
  for (const e of readLedger(root)) {
    const t = Date.parse(e.ts);
    if (Number.isNaN(t) || t < sinceMs) continue;
    if (e.cacheHit === true) continue;
    if (typeof e.estUsd !== 'number' || !Number.isFinite(e.estUsd) || e.estUsd < 0) continue;
    sum += e.estUsd - (Number.isFinite(e.refundUsd) && e.refundUsd > 0 ? e.refundUsd : 0);
  }
  sum = Math.max(0, sum);
  return Math.round(sum * 1e6) / 1e6;
}

/**
 * Returns a `limit(fn)` runner that executes at most `maxConcurrency` jobs at once.
 * @param {number} maxConcurrency
 * @returns {<T>(fn: () => Promise<T>) => Promise<T>}
 */
export function createLimiter(maxConcurrency) {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error('createLimiter: maxConcurrency must be a positive integer, got ' + maxConcurrency);
  }
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= maxConcurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

const failClosedApproval = () => ({
  ok: false,
  reason: 'missing',
  message:
    'No approved plan is attached to this synthesizer, so billable calls are refused (fail closed). ' +
    'Use compileVideo with an approved asset_plan.approved.json, or pass an explicit guard.',
});

/**
 * Single authorization point for every billable provider call. Order of checks:
 * model allow/block list, plan approval (and the approved model set), per-run
 * cap (min of budgetPerRunUsd and 1.25x the approved total), rolling 24h cap,
 * then the ledger append. Every check runs BEFORE the network call.
 *
 * In dry-run mode nothing is spent or written: billable calls are collected in
 * `planned` (blocked models are flagged instead of thrown).
 */
export class SpendGuard {
  /**
   * @param {Object} opts
   * @param {Record<string, any>} opts.config Validated guard config.
   * @param {string} opts.root Workspace root (ledger and lock location).
   * @param {string[]} [opts.allowModels] Models explicitly unlocked for this run.
   * @param {() => { ok: boolean, message?: string, approval?: any }} [opts.approval] Approval check. Defaults to FAIL CLOSED.
   * @param {boolean} [opts.dryRun]
   * @param {number} [opts.avatarStaleMs] Avatar slot staleness (keep above the poll window; a live holder heartbeats anyway).
   */
  constructor({ config, root, allowModels = [], approval = failClosedApproval, dryRun = false, avatarStaleMs = 45 * 60 * 1000 }) {
    validateConfig(config, 'SpendGuard');
    this.config = config;
    this.root = root;
    this.allowModels = allowModels;
    this.approval = approval;
    this.dryRun = dryRun;
    this.avatarStaleMs = avatarStaleMs;
    this.budget = new BudgetTracker({ budgetUsd: config.budgetPerRunUsd });
    this._avatarInProcess = createLimiter(config.maxAvatarConcurrency);
    /** @type {{ kind: string, model: string, estUsd: number, ref?: string, blocked?: string }[]} */
    this.planned = [];
  }

  get plannedTotalUsd() {
    const sum = this.planned.reduce((acc, p) => acc + (p.blocked ? 0 : p.estUsd), 0);
    return Math.round(sum * 1e6) / 1e6;
  }

  get dailySpentUsd() {
    return sumLedgerSince(this.root, Date.now() - DAY_MS);
  }

  /** Effective per-run cap: budgetPerRunUsd, tightened to 1.25x the approved total when known. */
  runCapUsd(approvalData) {
    const approved = approvalData && Number.isFinite(approvalData.totalUsd) ? approvalData.totalUsd * 1.25 : Infinity;
    return Math.round(Math.min(this.config.budgetPerRunUsd, approved) * 1e6) / 1e6;
  }

  /**
   * Runs `fn` as an avatar job: bounded in this process by the limiter and
   * across processes by slot lock files under <root>/.cognnitive/locks.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  avatarLimit(fn) {
    return this._avatarInProcess(async () => {
      if (this.dryRun) return fn();
      const dir = path.join(this.root, LOCKS_RELATIVE_DIR);
      const release = await acquireSlot(dir, 'avatar', this.config.maxAvatarConcurrency, {
        staleMs: this.avatarStaleMs,
        timeoutMs: this.avatarStaleMs,
      });
      try {
        return await fn();
      } finally {
        release();
      }
    });
  }

  _assertCovered(approvalData, model) {
    if (!approvalData || !Array.isArray(approvalData.allowedModels)) return;
    const covered = new Set([...approvalData.allowedModels, ...(approvalData.allowModels || [])].map(normalizeModelId));
    if (!covered.has(model)) {
      throw new ApprovalRequiredError(
        'Model "' + model + '" is not covered by the approved plan (approved models: ' +
          [...covered].join(', ') + '). Re-run the cost estimator with this model and approve again.',
      );
    }
  }

  /**
   * @param {{ kind: string, model: string, estUsd: number, ref?: string }} call
   * @param {{ requireApproval?: boolean, checkModel?: boolean }} [opts] Waivers (voice cloning is user-invoked).
   * @returns {Promise<null | { settle: (outcome: string, detail?: string) => void }>}
   *   null in dry-run (the caller must not perform the call); otherwise a ticket to settle afterwards.
   */
  async authorize({ kind, model: rawModel, estUsd, ref }, { requireApproval = true, checkModel = true } = {}) {
    const model = normalizeModelId(rawModel);
    if (typeof estUsd !== 'number' || !Number.isFinite(estUsd) || estUsd < 0) {
      throw new TypeError('estUsd must be a finite number >= 0, got ' + String(estUsd));
    }
    if (checkModel) {
      try {
        assertModelAllowed(model, { config: this.config, allowBlocked: this.allowModels });
      } catch (err) {
        if (!this.dryRun) throw err;
        this.planned.push({ kind, model, estUsd, ref, blocked: err.message });
        return null;
      }
    }
    if (this.dryRun) {
      this.planned.push({ kind, model, estUsd, ref });
      return null;
    }

    let approvalData = null;
    if (requireApproval) {
      const res = this.approval();
      if (!res.ok) throw new ApprovalRequiredError(res.message || 'Plan approval required before billable synthesis.');
      approvalData = res.approval || null;
      if (checkModel) this._assertCovered(approvalData, model);
    }
    const capUsd = this.runCapUsd(approvalData);
    const label = kind + ' ' + model + (ref ? ' (' + ref + ')' : '');

    await withFileLock(path.join(this.root, LOCKS_RELATIVE_DIR, 'ledger.lock'), () => {
      const spent = sumLedgerSince(this.root, Date.now() - DAY_MS);
      if (spent + estUsd > this.config.dailyCapUsd + 1e-9) {
        throw new BudgetExceededError(
          'Daily cap exceeded: "' + label + '" (~$' + estUsd.toFixed(4) + ') on top of $' + spent.toFixed(4) +
            ' already spent in the last 24h would pass the $' + this.config.dailyCapUsd.toFixed(2) +
            ' dailyCapUsd in ' + GUARD_FILENAME + '. Nothing was spent on this call.',
        );
      }
      this.budget.charge(estUsd, label, capUsd);
      appendLedger(this.root, { kind, model, estUsd, ref, outcome: 'started' });
    });

    return {
      settle: (outcome, detail, { refundUsd } = {}) => {
        if (refundUsd > 0) this.budget.refund(refundUsd);
        appendLedger(this.root, {
          kind, model, estUsd: 0, ref, outcome,
          ...(refundUsd > 0 ? { refundUsd } : {}),
          ...(detail ? { detail } : {}),
        });
      },
    };
  }

  /** Ledgers the outcome of a task that was authorized earlier (e.g. a resumed poll). No new charge. */
  noteOutcome({ kind, model, ref }, outcome, detail) {
    if (this.dryRun) return;
    appendLedger(this.root, { kind, model: normalizeModelId(model), estUsd: 0, ref, outcome, ...(detail ? { detail } : {}) });
  }

  /** Records a free cache hit in the ledger (no-op in dry-run). */
  recordCacheHit({ kind, ref }) {
    if (this.dryRun) return;
    appendLedger(this.root, { kind, ref, estUsd: 0, outcome: 'cache-hit', cacheHit: true });
  }

  /**
   * Pre-flight over a dry-run plan: refuses the WHOLE run (before any charge)
   * when a planned call uses a blocked/unlisted model, the plan is unapproved or
   * not covered by the approval, or the total would pass the per-run or 24h cap.
   */
  assertPlanAffordable() {
    const blocked = this.planned.filter((p) => p.blocked);
    if (blocked.length > 0) {
      throw new ModelBlockedError(
        blocked.length + ' planned call(s) use a blocked or unlisted model; nothing was spent. First: ' + blocked[0].blocked,
      );
    }
    if (this.planned.length === 0) return;
    const res = this.approval();
    if (!res.ok) throw new ApprovalRequiredError(res.message || 'Plan approval required before billable synthesis.');
    const approvalData = res.approval || null;
    for (const item of this.planned) this._assertCovered(approvalData, item.model);

    const total = this.plannedTotalUsd;
    const cap = this.runCapUsd(approvalData);
    if (total > cap + 1e-9) {
      throw new BudgetExceededError(
        'Budget exceeded: the planned run (~$' + total.toFixed(4) + ') is over the $' + cap.toFixed(2) +
          ' per-run cap (budgetPerRunUsd, or 1.25x the approved plan total). Nothing was spent.',
      );
    }
    const spent = this.dailySpentUsd;
    if (spent + total > this.config.dailyCapUsd + 1e-9) {
      throw new BudgetExceededError(
        'Daily cap exceeded: the planned run (~$' + total.toFixed(4) + ') plus $' + spent.toFixed(4) +
          ' spent in the last 24h would pass the $' + this.config.dailyCapUsd.toFixed(2) + ' dailyCapUsd. Nothing was spent.',
      );
    }
  }
}
