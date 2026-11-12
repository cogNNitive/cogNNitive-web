/**
 * import-guard.js — the scan-path wiring of the import guards.
 *
 * `duplicate-guards.js` holds the pure guards (duplicate classification and
 * conversation-history search). This module runs both of them over one incoming
 * source before it is normalised, settles the reuse / adjust / from-scratch
 * answer, and renders the registry text. Nothing here writes a file: `reuse`
 * is the caller's stop signal, and the scan still owns the single writer.
 */

const guards = require('./duplicate-guards');

/** The three answers the import guard offers, in the order the prompt presents them. */
const IMPORT_GUARD_DECISIONS = ['reuse', 'adjust', 'scratch'];

/**
 * How the guard describes what it found, for the registry line.
 *
 * @param {{ duplicate: { exact: string[], near: Array<{ path: string, score: number }> }, history: Array<{ file: string }> }} verdict
 * @returns {string}
 */
function describeGuard(verdict) {
  const parts = [];
  if (verdict.duplicate.exact.length > 0) parts.push(`duplicate of \`${verdict.duplicate.exact[0]}\``);
  if (verdict.duplicate.near.length > 0) {
    const top = verdict.duplicate.near[0];
    parts.push(`near duplicate of \`${top.path}\` (score ${top.score})`);
  }
  if (verdict.history.length > 0) parts.push(`prior handling in \`${verdict.history[0].file}\``);
  return parts.join('; ');
}

/**
 * Ask the caller which guard answer applies. A caller that supplies no prompt
 * (the CLI `--scan`, CI) gets the deterministic default.
 *
 * @param {{ sourceFileField: string }} item
 * @param {any} verdict
 * @param {Record<string, any>} options
 * @returns {Promise<'reuse'|'adjust'|'scratch'>}
 */
async function resolveDecision(item, verdict, options) {
  if (typeof options.duplicatePrompt === 'function') {
    const answer = await options.duplicatePrompt(item.sourceFileField, verdict, {
      decisions: IMPORT_GUARD_DECISIONS,
      recommended: guards.defaultDuplicateDecision(verdict),
    });
    if (IMPORT_GUARD_DECISIONS.includes(answer)) return answer;
  }
  return guards.defaultDuplicateDecision(verdict);
}

/**
 * What `reviewIncomingSource` returns for a source that needs no review: already
 * up to date, or the guards are disabled for this run.
 */
const IDLE_REVIEW = { verdict: null, decision: null, reuse: false, suffix: '', action: '' };

/**
 * Run both guards over an incoming source and settle the answer.
 *
 * @param {string} projectDir
 * @param {{ absPath: string, sourceFileField: string }} item
 * @param {{ index: any, batch: Array<any> }} context Shared by one scan run; the
 *   workspace index is built on the first incoming source and the batch holds
 *   the sources this run already normalised.
 * @param {Record<string, any>} options `nearThreshold`, `historyGuard`, `duplicatePrompt`.
 * @returns {Promise<{
 *   verdict: any|null,
 *   decision: 'reuse'|'adjust'|'scratch'|null,
 *   reuse: boolean,
 *   suffix: string,
 *   action: string,
 * }>}
 */
async function reviewIncomingSource(projectDir, item, context, options) {
  if (!context.index) context.index = guards.indexWorkspaceSources(projectDir);
  const verdict = guards.guardIncomingSource(
    projectDir,
    { absPath: item.absPath, relPath: item.sourceFileField },
    {
      nearThreshold: options.nearThreshold,
      index: context.index,
      batch: context.batch,
      history: options.historyGuard !== false,
    },
  );
  if (!verdict.flagged) return IDLE_REVIEW;
  const decision = await resolveDecision(item, verdict, options);
  const top = verdict.duplicate.near[0];
  const target = verdict.duplicate.exact[0] || (top ? top.path : null);
  // The reason restates the target for an exact duplicate, so it only earns a
  // place in the sentence when the guard found something else as well.
  const extra = verdict.duplicate.near.length > 0 || verdict.history.length > 0;
  return {
    verdict,
    decision,
    reuse: decision === 'reuse',
    suffix: guardSuffix(verdict, decision),
    action: `Reused existing source \`${target}\` instead of importing a duplicate${extra ? ` — ${describeGuard(verdict)}` : ''}.`,
  };
}

/**
 * The suffix a normalised source's registry line carries after `adjust` or
 * `scratch`. Empty when the source was not flagged.
 *
 * @returns {string}
 */
function guardSuffix(verdict, decision) {
  const reason = verdict ? describeGuard(verdict) : '';
  if (!reason) return '';
  if (decision === 'adjust') return ` Import guard: adjusted (${reason}).`;
  if (decision === 'scratch') return ` Import guard: from scratch (${reason}).`;
  return '';
}

/**
 * Remember a source this run normalised, so a later file in the same batch is
 * classified against it without rebuilding the workspace index.
 */
function recordSource(context, item, rawHash) {
  context.batch.push({ relativePath: item.sourceFileField, rawSha256: rawHash, primaryPath: item.sourceFileField });
}

/**
 * The registry field for a flagged source, or nothing when it was not flagged.
 */
function registryField(verdict, decision) {
  if (!verdict) return {};
  return {
    importGuard: {
      decision,
      exact: verdict.duplicate.exact,
      near: verdict.duplicate.near,
      history: verdict.history,
    },
  };
}

module.exports = {
  IDLE_REVIEW,
  IMPORT_GUARD_DECISIONS,
  describeGuard,
  reviewIncomingSource,
  guardSuffix,
  recordSource,
  registryField,
};
