/**
 * Per-intent LLM usage counters (measurement gate).
 *
 * Caller-side JSONL append: every LLM call records `{ ts, intent, inputTokens,
 * outputTokens }` so a session can tally per-intent call/token totals and a
 * before-vs-after benchmark can record the measured reduction.
 *
 * LOCATION DECISION (task 3.1): the default file lives under the OS temp
 * directory (session-scoped, e.g. `<tmp>/cognnitive-usage-<session>.jsonl`)
 * and NEVER defaults into the workspace tree, so counters cannot pollute the
 * repo or dirty git. A workspace path such as `.cogNNitive/usage.jsonl` is
 * allowed ONLY when the caller passes it explicitly (opt-in), and tests must
 * use `fs.mkdtempSync(os.tmpdir(), ...)` fixtures. An explicit
 * `COGNNITIVE_USAGE_FILE` env var overrides the default when set.
 *
 * Dependency-free: `fs`, `os`, `path` only.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const VALID_INTENTS = ["coach", "surgical", "verify", "match"];
const DEFAULT_SESSION_PREFIX = "cognnitive-usage-";
const ENV_USAGE_FILE = "COGNNITIVE_USAGE_FILE";

function emptyIntentTally() {
  return { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function emptyTally() {
  /** @type {Record<string, { calls: number, inputTokens: number, outputTokens: number, totalTokens: number }>} */
  const tally = {};
  for (const intent of VALID_INTENTS) tally[intent] = emptyIntentTally();
  return tally;
}

/**
 * Default session file under the OS temp directory (never the repo tree).
 * @param {string} [sessionId]
 * @returns {string}
 */
function defaultUsagePath(sessionId = "session") {
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-_]/g, "_") || "session";
  return path.join(os.tmpdir(), `${DEFAULT_SESSION_PREFIX}${safe}.jsonl`);
}

/**
 * Resolve the counters file: explicit path wins, then env override, then temp default.
 * @param {string} [explicitPath]
 * @param {string} [sessionId]
 * @returns {string}
 */
function resolveUsagePath(explicitPath, sessionId) {
  if (explicitPath) return explicitPath;
  if (process.env[ENV_USAGE_FILE]) return process.env[ENV_USAGE_FILE];
  return defaultUsagePath(sessionId);
}

/**
 * Validate a usage entry; throws on unknown intent or negative token counts.
 * @param {{ intent: string, inputTokens: number, outputTokens: number }} entry
 */
function assertValidEntry(entry) {
  if (!entry || !VALID_INTENTS.includes(entry.intent)) {
    throw new Error(
      `Unknown intent "${entry && entry.intent}". Expected one of: ${VALID_INTENTS.join(", ")}`,
    );
  }
  for (const key of ["inputTokens", "outputTokens"]) {
    const value = entry[key];
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(
        `"${key}" must be a non-negative integer, got ${JSON.stringify(value)}`,
      );
    }
  }
}

/**
 * Append one usage record as a JSONL line (creates parent dirs as needed).
 * @param {string} filePath
 * @param {{ intent: string, inputTokens: number, outputTokens: number, sessionId?: string, label?: string }} entry
 * @returns {{ ts: string, intent: string, inputTokens: number, outputTokens: number, sessionId?: string, label?: string }}
 */
function recordUsage(filePath, entry) {
  assertValidEntry(entry);
  const record = {
    ts: new Date().toISOString(),
    intent: entry.intent,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
  };
  if (entry.sessionId !== undefined) record.sessionId = entry.sessionId;
  if (entry.label !== undefined) record.label = entry.label;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

/**
 * Read all usage records from a JSONL file; missing file yields [].
 * @param {string} filePath
 * @returns {Array<{ intent: string, inputTokens: number, outputTokens: number }>}
 */
function readUsages(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  const records = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    records.push(JSON.parse(trimmed));
  }
  return records;
}

/**
 * Pure tally over usage records: per-intent calls and token totals.
 * @param {Array<{ intent: string, inputTokens: number, outputTokens: number }>} records
 * @returns {Record<string, { calls: number, inputTokens: number, outputTokens: number, totalTokens: number }>}
 */
function tallyEntries(records) {
  const tally = emptyTally();
  for (const record of records) {
    if (!VALID_INTENTS.includes(record.intent)) continue;
    const slot = tally[record.intent];
    slot.calls += 1;
    slot.inputTokens += record.inputTokens;
    slot.outputTokens += record.outputTokens;
    slot.totalTokens += record.inputTokens + record.outputTokens;
  }
  return tally;
}

/**
 * Tally per-intent call/token totals from a JSONL file.
 * @param {string} filePath
 * @returns {Record<string, { calls: number, inputTokens: number, outputTokens: number, totalTokens: number }>}
 */
function tallyByIntent(filePath) {
  return tallyEntries(readUsages(filePath));
}

/**
 * Pure comparison of two tallies: per-intent totals plus measured reduction.
 * Reduction is `(before - after) / before`; zero-before yields 0.
 * @param {Record<string, { calls: number, totalTokens: number }>} before
 * @param {Record<string, { calls: number, totalTokens: number }>} after
 * @returns {{ perIntent: Record<string, any>, totalTokensBefore: number, totalTokensAfter: number, totalReduction: number }}
 */
function summarizeReduction(before, after) {
  const perIntent = {};
  let totalTokensBefore = 0;
  let totalTokensAfter = 0;
  for (const intent of VALID_INTENTS) {
    const b = (before && before[intent]) || { calls: 0, totalTokens: 0 };
    const a = (after && after[intent]) || { calls: 0, totalTokens: 0 };
    const tokensBefore = b.totalTokens || 0;
    const tokensAfter = a.totalTokens || 0;
    totalTokensBefore += tokensBefore;
    totalTokensAfter += tokensAfter;
    perIntent[intent] = {
      callsBefore: b.calls || 0,
      callsAfter: a.calls || 0,
      tokensBefore,
      tokensAfter,
      tokenReduction:
        tokensBefore === 0 ? 0 : (tokensBefore - tokensAfter) / tokensBefore,
    };
  }
  return {
    perIntent,
    totalTokensBefore,
    totalTokensAfter,
    totalReduction:
      totalTokensBefore === 0
        ? 0
        : (totalTokensBefore - totalTokensAfter) / totalTokensBefore,
  };
}

module.exports = {
  VALID_INTENTS,
  DEFAULT_SESSION_PREFIX,
  ENV_USAGE_FILE,
  defaultUsagePath,
  resolveUsagePath,
  recordUsage,
  readUsages,
  tallyEntries,
  tallyByIntent,
  summarizeReduction,
};
