/**
 * change-log.js — per-unit knowledge change log (backlog:
 * feature/kb-change-governance).
 *
 * Data backbone for knowledge-change governance: records every change that
 * affects a knowledge unit with type, scope (units touched), timestamp, actor,
 * and optional RACI owner, then renders individualized monthly reports per
 * responsible person.
 *
 * Storage: one JSONL file per project at `<workspaceRoot>/.cogNNitive/change-log.jsonl`
 * (gitignored state, not a model artifact). This is deliberately a separate,
 * append-only store from the lineage record: the lineage describes the *current*
 * normalized corpus, while the change log is the *event history* that feeds the
 * review workflow and monthly reports.
 */

const fs = require('fs');
const path = require('path');

const CHANGE_LOG_DIR = '.cogNNitive';
const CHANGE_LOG_FILE = 'change-log.jsonl';

function changeLogPath(workspaceRoot) {
  return path.join(workspaceRoot, CHANGE_LOG_DIR, CHANGE_LOG_FILE);
}

/** Append a change entry to the log (idempotent on identical entry). */
function recordChange(workspaceRoot, entry) {
  const dir = path.dirname(changeLogPath(workspaceRoot));
  fs.mkdirSync(dir, { recursive: true });
  const file = changeLogPath(workspaceRoot);
  const normalized = {
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: entry.type || 'update',
    timestamp: entry.timestamp || new Date().toISOString(),
    actor: entry.actor || 'unknown',
    ...(entry.owner ? { owner: entry.owner } : {}),
    ...(entry.scope ? { scope: entry.scope } : {}),
    ...(entry.summary ? { summary: entry.summary } : {}),
  };
  const line = JSON.stringify(normalized) + '\n';
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (existing.includes(line)) return normalized;
  fs.appendFileSync(file, line, 'utf8');
  return normalized;
}

/** Read all change entries, oldest first. */
function readChangeLog(workspaceRoot) {
  const file = changeLogPath(workspaceRoot);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function parseMonth(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Entries scoped to a given unit (by id or any scope entry). */
function entriesForUnit(entries, unitId) {
  return entries.filter(
    (e) =>
      (e.scope || []).includes(unitId) ||
      (Array.isArray(e.scope) && e.scope.some((s) => String(s).toLowerCase() === String(unitId).toLowerCase())),
  );
}

/**
 * Render an individualized monthly report for one responsible person.
 *
 * @param {string} workspaceRoot
 * @param {{ owner: string, month: string }} opts  month = "YYYY-MM"
 * @returns {string} Markdown report.
 */
function renderMonthlyReport(workspaceRoot, opts) {
  const { owner, month } = opts;
  const entries = readChangeLog(workspaceRoot).filter(
    (e) => (e.owner || e.actor) === owner && parseMonth(e.timestamp) === month,
  );
  const lines = [`# Monthly change report — ${owner}`, '', `Month: ${month}`, ''];
  if (entries.length === 0) {
    lines.push('No changes recorded for this period.', '');
    return lines.join('\n');
  }
  lines.push(`| Type | Timestamp | Unit(s) | Summary |`, `|---|---|---|---|`);
  for (const e of entries) {
    const scope = Array.isArray(e.scope) ? e.scope.join(', ') : (e.scope || '');
    lines.push(`| ${e.type} | ${e.timestamp} | ${scope} | ${e.summary || ''} |`);
  }
  lines.push('', `Total: ${entries.length} change(s).`);
  return lines.join('\n');
}

module.exports = {
  CHANGE_LOG_DIR,
  CHANGE_LOG_FILE,
  changeLogPath,
  recordChange,
  readChangeLog,
  entriesForUnit,
  renderMonthlyReport,
};