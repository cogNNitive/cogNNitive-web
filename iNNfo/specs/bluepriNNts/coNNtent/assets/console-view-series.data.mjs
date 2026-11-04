/**
 * coNNtent/assets/console-view-series.data.mjs
 *
 * Export-time facts for the Series view (design A12/A13). Facts stay JSONL: this module
 * reads every `<ledger|timings>*.jsonl` under `<domaiNN>/.cognnitive/video/` and merges
 * them, so several machines' files land side by side and are compared by fingerprint.
 *
 * The staleness rule is the engine's own (`isPriceStale`), imported from the skill so a
 * threshold change cannot drift between the plan, the engine and the view.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isPriceStale } from '../skills/nn-conntent/scripts/lib/catalog.mjs'

const FACTS_DIR = ['.cognnitive', 'video']

/** JSONL files in the facts folder whose name starts with `prefix`. */
async function factFiles(dir, prefix) {
  let entries
  try {
    entries = await readdir(dir)
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return []
    throw err
  }
  return entries
    .filter((name) => name.startsWith(prefix) && name.endsWith('.jsonl'))
    .sort()
    .map((name) => join(dir, name))
}

/** Rows of one JSONL file; a torn last line from an interrupted append is skipped. */
async function readRows(file) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  const rows = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const row = JSON.parse(trimmed)
      if (row && typeof row === 'object') rows.push(row)
    } catch {
      // Not a fact.
    }
  }
  return rows
}

async function readAll(dir, prefix) {
  const files = await factFiles(dir, prefix)
  const rows = []
  for (const file of files) rows.push(...(await readRows(file)))
  return rows
}

function money(value) {
  return Math.round(value * 1e6) / 1e6
}

export async function collect({ rootDir, now = new Date() } = {}) {
  const dir = join(String(rootDir || '.'), ...FACTS_DIR)
  const [ledger, timings] = await Promise.all([readAll(dir, 'ledger'), readAll(dir, 'timings')])

  /** @type {Record<string, { realUsd: number, rows: number, timings: any[], staleRows: any[] }>} */
  const episodes = {}
  const bucket = (slug) => {
    if (!slug) return null
    if (!episodes[slug]) episodes[slug] = { realUsd: 0, rows: 0, timings: [], staleRows: [] }
    return episodes[slug]
  }

  for (const row of ledger) {
    const entry = bucket(String(row.episode || ''))
    if (!entry) continue
    const usd = Number(row.estUsd)
    const refund = Number(row.refundUsd)
    entry.rows += 1
    if (Number.isFinite(usd) && usd > 0) entry.realUsd = money(entry.realUsd + usd)
    if (Number.isFinite(refund) && refund > 0) entry.realUsd = money(Math.max(0, entry.realUsd - refund))
    // A stale price is still a real charge: flag it, count it.
    const priceDate = row.price_date ? String(row.price_date) : ''
    if (priceDate && isPriceStale(priceDate, { now })) {
      entry.staleRows.push({
        priceDate,
        model: String(row.model || ''),
        usd: Number.isFinite(usd) ? usd : 0,
      })
    }
  }

  for (const row of timings) {
    const entry = bucket(String(row.episode || ''))
    if (!entry) continue
    entry.timings.push({
      stage: String(row.stage || ''),
      durationMs: Number(row.duration_ms) || 0,
      fingerprint: String((row.machine && row.machine.fp) || ''),
      runId: String(row.run_id || ''),
      outcome: String(row.outcome || ''),
    })
  }

  return { episodes }
}
