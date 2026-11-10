/**
 * nn-conntent/scripts/lib/gates.mjs
 *
 * Gate state is derived, never stored: it comes from the latest applied human console
 * verdict for a `(scene, gate)` and the current content hash (capability
 * conntent-review-gates; design D-P1, D-P2, D-P8).
 *
 * Zero document edits live here. Reading a workspace uses the core mirror parser.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseChangeset } = require('./nn-core.generated.cjs');

/** The fixed evaluation order, regardless of the order of `review_gates`. */
export const GATE_ORDER = ['script', 'budget', 'preview'];

/** The console's default pseudonym; it names nobody, so it never counts (Q9). */
export const DEFAULT_REVIEWER = 'reviewer';

/** True only for an applied verdict a named human entered in the console. */
export function countsAsVerdict(verdict) {
  if (!verdict) return false;
  if (verdict.authorKind !== 'human') return false;
  if (verdict.origin !== 'console') return false;
  const reviewer = typeof verdict.reviewer === 'string' ? verdict.reviewer.trim() : '';
  return reviewer !== '' && reviewer.toLowerCase() !== DEFAULT_REVIEWER;
}

/** The model id of a `model@element` (or bare `model`) target. */
function modelOf(target) {
  const at = String(target || '').indexOf('@');
  return (at === -1 ? String(target || '') : String(target).slice(0, at)).trim();
}

/** The element slug of a `model@element` target, or null for a bare model. */
function sceneOf(target) {
  const at = String(target || '').indexOf('@');
  return at === -1 ? null : String(target).slice(at + 1).trim();
}

/**
 * Every `review_gate` change of every APPLIED changeset for one model, in applied
 * order (the monotonic `applied_at`, then the batch name). A proposed or rejected
 * changeset is invisible; so is a conflicting change.
 *
 * @param {string} rootDir
 * @param {string} modelSlug
 * @returns {Array<Record<string, unknown>>}
 */
export function readAppliedVerdicts(rootDir, modelSlug) {
  const dir = path.join(rootDir, 'changes');
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir).sort()) {
    if (!entry.endsWith('.md') || entry.endsWith('_spec_NN.md')) continue;
    let doc;
    try {
      doc = parseChangeset(fs.readFileSync(path.join(dir, entry), 'utf8'));
    } catch {
      continue;
    }
    const status = doc.frontmatter?.status;
    if (status !== 'applied' && status !== 'partially_applied') continue;
    const appliedAt = doc.frontmatter?.applied_at || '';
    for (const change of doc.changes || []) {
      if (change.op !== 'review_gate') continue;
      if (modelOf(change.target) !== modelSlug) continue;
      if (change.status !== undefined && change.status !== 'applied') continue;
      found.push({
        scene: sceneOf(change.target),
        gate: change.gate ?? null,
        verdict: change.verdict ?? null,
        reviewedHash: change.reviewed_hash ?? null,
        planHash: change.plan_hash ?? null,
        notes: change.notes ?? null,
        reviewer: doc.frontmatter?.reviewer ?? null,
        authorKind: doc.frontmatter?.author_kind ?? null,
        origin: doc.frontmatter?.origin ?? null,
        appliedAt: change.applied_at || appliedAt,
        changeset: `changes/${entry}`,
      });
    }
  }
  // Applied order: monotonic instant, then the batch name for a deterministic tie.
  return found.sort((a, b) => {
    const byTime = String(a.appliedAt).localeCompare(String(b.appliedAt));
    return byTime !== 0 ? byTime : a.changeset.localeCompare(b.changeset);
  });
}

/**
 * The state of one `(scene, gate)`.
 *
 * @param {{ gate: string, scene?: string|null, currentHash: string,
 *   planHash?: string|null, verdicts?: Array<Record<string, unknown>> }} input
 * @returns {{ gate: string, scene: string|null, state: 'open'|'approved'|'needs-change'|'reopened',
 *   currentHash: string, reviewedHash: string|null, reviewer: string|null, notes: string|null,
 *   cause: { kind: string, detail?: string }|null, ignored: Array<Record<string, unknown>> }}
 */
export function evaluateGate({ gate, scene = null, currentHash, planHash = null, verdicts = [] }) {
  const relevant = verdicts.filter((v) => v.gate === gate && (v.scene ?? null) === (scene ?? null));
  const ignored = [];
  const usable = [];
  for (const v of relevant) {
    if (!countsAsVerdict(v)) {
      ignored.push({ ...v, reason: 'not-human' });
      continue;
    }
    if ((gate === 'preview' || gate === 'budget') && !v.planHash) {
      ignored.push({ ...v, reason: 'missing-plan-hash' });
      continue;
    }
    usable.push(v);
  }

  const base = {
    gate,
    scene,
    state: 'open',
    currentHash,
    reviewedHash: null,
    reviewer: null,
    notes: null,
    cause: null,
    ignored,
  };
  const latest = usable[usable.length - 1];
  if (!latest) return base;

  const withVerdict = {
    ...base,
    reviewedHash: latest.reviewedHash ?? null,
    reviewer: latest.reviewer ?? null,
    notes: latest.notes ?? null,
  };

  if ((gate === 'preview' || gate === 'budget') && latest.planHash !== planHash) {
    return {
      ...withVerdict,
      state: 'reopened',
      cause: { kind: 'plan-changed', detail: `approved ${latest.planHash}, current ${planHash}` },
    };
  }
  if (latest.reviewedHash !== currentHash) {
    return {
      ...withVerdict,
      state: 'reopened',
      cause: { kind: 'content-changed' },
    };
  }
  return { ...withVerdict, state: latest.verdict === 'needs-change' ? 'needs-change' : 'approved' };
}

/**
 * The state of every target, in the fixed order `script`, `budget`, `preview`.
 * @param {{ targets: Array<{ gate: string, scene?: string|null, currentHash: string, planHash?: string|null }>,
 *   verdicts?: Array<Record<string, unknown>> }} input
 */
export function gateState({ targets = [], verdicts = [] }) {
  const order = (gate) => {
    const index = GATE_ORDER.indexOf(gate);
    return index === -1 ? GATE_ORDER.length : index;
  };
  return [...targets]
    .sort((a, b) => order(a.gate) - order(b.gate) || String(a.scene ?? '').localeCompare(String(b.scene ?? '')))
    .map((target) => evaluateGate({ ...target, verdicts }));
}

/** The engine's message for a verdict applied after its content changed (C7). */
export const STALE_APPROVAL_MESSAGE =
  'content changed since you reviewed it; reopen the console';

/* ── Re-open causes (design D-P2) ───────────────────────────────────────────── */

/** The machine-local record directory; gitignored, absence only degrades a cause. */
export function reviewsDir(rootDir) {
  return path.join(rootDir, '.cognnitive', 'video', 'reviews');
}

/** `<root>/.cognnitive/video/reviews/<series>__<episode>.json`. */
export function reviewSnapshotPath(rootDir, series, episode) {
  return path.join(reviewsDir(rootDir), `${series}__${episode}.json`);
}

/** The last stored review record of one episode, or an empty one. */
export function readReviewSnapshot(rootDir, series, episode) {
  try {
    const parsed = JSON.parse(fs.readFileSync(reviewSnapshotPath(rootDir, series, episode), 'utf8'));
    return { scenes: parsed?.scenes && typeof parsed.scenes === 'object' ? parsed.scenes : {} };
  } catch {
    return { scenes: {} };
  }
}

/** Overwrites the episode's record in place (never appended, never committed). */
export function writeReviewSnapshot(rootDir, series, episode, scenes) {
  fs.mkdirSync(reviewsDir(rootDir), { recursive: true });
  fs.writeFileSync(
    reviewSnapshotPath(rootDir, series, episode),
    JSON.stringify({ scenes }, null, 2),
    'utf8',
  );
}

/** The first differing key between two field objects, in insertion order. */
function firstChangedKey(previous = {}, current = {}) {
  for (const key of Object.keys(current)) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) return key;
  }
  for (const key of Object.keys(previous)) {
    if (!(key in current)) return key;
  }
  return null;
}

/**
 * The cause of a re-open: kind and detail, or null when the subject did not change.
 * `sources` maps a resolved parameter to the level that supplied it, so a cause can
 * say "series voice changed" (design D-P2).
 *
 * @param {{ previous?: object|null, current: object, sources?: Record<string, string> }} input
 * @returns {{ kind: string, detail?: string }|null}
 */
export function reopenCause({ previous, current, sources = {} }) {
  if (!previous) return { kind: 'unknown' };
  if (previous.narration !== current.narration) return { kind: 'narration-changed' };

  const previousLayers = previous.layers || [];
  const currentLayers = current.layers || [];
  if (previousLayers.length !== currentLayers.length) {
    return { kind: 'layer-changed', detail: 'layers' };
  }
  for (let index = 0; index < currentLayers.length; index++) {
    if (JSON.stringify(previousLayers[index]) !== JSON.stringify(currentLayers[index])) {
      const label = currentLayers[index]?.name || currentLayers[index]?.slug || `layer ${index + 1}`;
      return { kind: 'layer-changed', detail: String(label) };
    }
  }

  const changedParam = firstChangedKey(previous.params || {}, current.params || {});
  if (changedParam) {
    const level = sources[changedParam];
    return { kind: 'param-changed', detail: level ? `${level} ${changedParam}` : changedParam };
  }
  return null;
}
