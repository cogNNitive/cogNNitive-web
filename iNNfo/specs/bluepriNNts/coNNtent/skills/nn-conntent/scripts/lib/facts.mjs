/**
 * nn-conntent/scripts/lib/facts.mjs
 *
 * Append-only JSONL facts, per machine (design A13, decisions D11/6): the v2 spend ledger
 * row (with the machine fingerprint) and the v1 stage timing row. Facts live under
 * `<domaiNN>/.cognnitive/video/`, one file per machine, and are never committed.
 *
 * A ledger write failure is fatal to a run before spend (the caller decides); a timing write
 * failure only warns. Nothing here throws on a timing failure.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const FACTS_DIR = path.join('.cognnitive', 'video');
export const LEDGER_FILE = 'ledger.jsonl';
export const TIMINGS_FILE = 'timings.jsonl';

/** JSON with deterministic key order, for hashing. */
export function canonicalJson(value) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      const out = {};
      for (const key of Object.keys(v).sort()) out[key] = sort(v[key]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

/** The machine object a timing or ledger row carries. */
export function machineInfo(overrides = {}) {
  const cpus = os.cpus() || [];
  const machine = {
    cpu: cpus.length > 0 ? String(cpus[0].model || '').trim() : 'unknown',
    cores: cpus.length,
    gpu: null,
    ram_gb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    os: `${os.platform()} ${os.release()}`,
    node: process.version,
    hyperframes: null,
    ...overrides,
  };
  return { ...machine, fp: fingerprintOf(machine) };
}

/** First 12 hex characters of sha256 over the canonical machine object without `fp`. */
export function fingerprintOf(machine) {
  const { fp: _ignored, ...rest } = machine || {};
  return crypto.createHash('sha256').update(canonicalJson(rest)).digest('hex').slice(0, 12);
}

/** True when a machine object's `fp` matches its content. */
export function verifyFingerprint(machine) {
  return Boolean(machine) && machine.fp === fingerprintOf(machine);
}

/**
 * A v2 spend ledger row (capability video-run-facts "Spend Ledger Row Schema").
 * @param {{ runId: string, episode: string, planHash: string, stage: string, kind: string, model: string,
 *   cacheKey?: string, units?: number, unitPrice?: number, priceDate?: string, priceSource?: string,
 *   estUsd?: number, actualUsd?: number, cacheHit?: boolean, outcome?: string, queueMs?: number,
 *   processingMs?: number, machine?: object, ts?: string }} input
 */
export function ledgerRow(input) {
  return {
    v: 2,
    ts: input.ts || new Date().toISOString(),
    run_id: input.runId,
    episode: input.episode,
    plan_hash: input.planHash,
    stage: input.stage,
    kind: input.kind,
    model: input.model,
    cache_key: input.cacheKey ?? null,
    units: input.units ?? 0,
    unit_price: input.unitPrice ?? 0,
    price_date: input.priceDate ?? null,
    price_source: input.priceSource ?? null,
    est_usd: input.estUsd ?? 0,
    actual_usd: input.actualUsd ?? 0,
    cache_hit: input.cacheHit === true,
    outcome: input.outcome || 'ok',
    queue_ms: input.queueMs ?? null,
    processing_ms: input.processingMs ?? null,
    machine: input.machine || machineInfo(),
  };
}

/**
 * A v1 stage timing row (capability video-run-facts "Stage Timing Row Schema").
 * @param {{ runId: string, episode: string, planHash: string, stage: string, start: string|number,
 *   end: string|number, linkMode?: string, machine?: object, render?: object, cache?: object, outcome?: string, ts?: string }} input
 */
export function timingRow(input) {
  const start = typeof input.start === 'number' ? input.start : Date.parse(input.start);
  const end = typeof input.end === 'number' ? input.end : Date.parse(input.end);
  return {
    v: 1,
    ts: input.ts || new Date().toISOString(),
    run_id: input.runId,
    episode: input.episode,
    plan_hash: input.planHash,
    stage: input.stage,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    duration_ms: Math.max(0, end - start),
    link_mode: input.linkMode || 'link',
    machine: input.machine || machineInfo(),
    cache: input.cache || { hits: 0, misses: 0 },
    ...(input.render ? { render: input.render } : {}),
    ...(input.outcome ? { outcome: input.outcome } : {}),
  };
}

/** Appends one JSON line, starting a new line when the file ends mid-line. */
function appendLine(file, row) {
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
  fs.appendFileSync(file, prefix + JSON.stringify(row) + '\n', 'utf8');
}

export const ledgerPath = (root) => path.join(root, FACTS_DIR, LEDGER_FILE);
export const timingsPath = (root) => path.join(root, FACTS_DIR, TIMINGS_FILE);

/** Appends a ledger row. Throws: the caller must stop before spend when this fails. */
export function appendLedgerRow(root, row) {
  appendLine(ledgerPath(root), row);
  return row;
}

/** Appends a timing row. Never throws: a timing failure only warns (capability video-run-facts). */
export function appendTimingRow(root, row, warn = console.warn) {
  try {
    appendLine(timingsPath(root), row);
    return { ok: true };
  } catch (err) {
    warn(`[facts] warning: could not append the timing row to ${timingsPath(root)}: ${err?.message || err}`);
    return { ok: false, warning: String(err?.message || err) };
  }
}

/**
 * Net spend of a ledger window, counting every billed call exactly once.
 *
 * A billable call writes a reservation row (`estUsd`, outcome `started`) BEFORE the
 * network call and a terminal row afterwards. The terminal row carries the amount
 * that was really charged and marks itself `supersedesStart`, so reading the two rows
 * as independent charges would double the spend. Counting only terminal rows would
 * lose every call whose process died mid-flight, which is the case the reservation
 * exists for. Rows written before this rule (a terminal row of $0 plus `refundUsd`)
 * keep working: an unmarked refund is subtracted.
 *
 * The amount is read from either spelling: `estUsd` (the guard's rows) and `est_usd`
 * (the v2 `ledgerRow` shape). Two spellings in one file is what made the produce-side
 * ceiling read zero for every avatar charge (#690).
 *
 * @param {Record<string, any>[]} rows
 * @param {number} [sinceMs] Epoch milliseconds; rows older than this are ignored.
 * @returns {number}
 */
export function spendOfRows(rows, sinceMs = 0) {
  let sum = 0;
  /** @type {Map<string, number[]>} Open reservations, per billed call. */
  const open = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const ts = Date.parse(row.ts);
    if (Number.isFinite(ts) && ts < sinceMs) continue;
    if (row.cacheHit === true) continue;
    const usd = Number(row.estUsd ?? row.est_usd ?? 0);
    if (!Number.isFinite(usd) || usd < 0) continue;
    const key = String(row.kind || '') + '|' + String(row.ref ?? '') + '|' + String(row.model ?? '');
    if (row.supersedesStart === true) {
      const stack = open.get(key);
      const reserved = stack && stack.length > 0 ? stack.pop() : null;
      sum += reserved === null ? usd : usd - reserved;
      continue;
    }
    if (row.outcome === 'started') {
      if (!open.has(key)) open.set(key, []);
      open.get(key).push(usd);
    }
    sum += usd;
    if (Number.isFinite(row.refundUsd) && row.refundUsd > 0) sum -= row.refundUsd;
  }
  return Math.max(0, Math.round(sum * 1e6) / 1e6);
}

/** Net spend recorded at or after `sinceMs`, from the one ledger file. */
export function sumLedgerSpend(root, sinceMs = 0) {
  return spendOfRows(readLedgerRows(root), sinceMs);
}

/** Tolerant JSONL reader: corrupt or partial lines are skipped. */
export function readRows(file) {
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

export const readLedgerRows = (root) => readRows(ledgerPath(root));
export const readTimingRows = (root) => readRows(timingsPath(root));
