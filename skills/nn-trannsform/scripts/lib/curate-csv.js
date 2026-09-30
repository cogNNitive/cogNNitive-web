/**
 * curate-csv.js — turn a raw CSV into a citation-ready CSV.
 *
 * The scanner normalizes a CSV to a Markdown *profile* under `sources/nn/`; it
 * never produces the CSV that `sources:: <file>.csv@<row-id>` actually cites.
 * This module fills that gap: it parses the raw CSV, moves the key column to the
 * front, guarantees the key is unique and non-empty, and writes an RFC-4180 CSV
 * under `sources/nn/import/`, mirroring the `sources/import/` subtree like the
 * scanner does for Markdown.
 *
 * The key column is the citation row-id (`csv@<key-value>`), so it must be the
 * first column, non-empty and unique — the same contract the workspace-source
 * validator enforces (`KU_EMPTY_KEY` / `KU_DUPLICATE_KEY`).
 *
 * Zero runtime dependencies (Node builtins + the skill's own CSV parser).
 */

const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./scanner-converters');

/**
 * Quote a CSV cell only when RFC-4180 requires it.
 * @param {string} value
 * @returns {string}
 */
function serializeCell(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialize rows to an RFC-4180 CSV string: LF endings, one trailing newline,
 * no trailing blank row.
 * @param {string[][]} rows
 * @returns {string}
 */
function serializeCsv(rows) {
  return rows.map((row) => row.map(serializeCell).join(',')).join('\n') + '\n';
}

/**
 * Curate CSV content so its first column is a unique, non-empty citation key.
 *
 * @param {string} content Raw CSV text.
 * @param {{ key?: string, dedup?: boolean }} [options] `key` = column name to
 *   promote (defaults to the first column); `dedup` = collapse duplicate keys
 *   and drop empty-key rows instead of failing.
 * @returns {{ rows: string[][], header: string[], keyName: string, inputRows: number, outputRows: number, collapsed: number, droppedEmptyKey: number, duplicateKeys: string[] }}
 * @throws {Error} On malformed/empty CSV, unknown key column, or unsafe key without `dedup`.
 */
function curateCsvContent(content, options = {}) {
  const { rows: parsed, malformed } = parseCsv(content);
  if (malformed) throw new Error('Malformed CSV: unbalanced quotes.');
  const records = parsed.filter((r) => r.some((cell) => cell !== ''));
  if (records.length === 0) throw new Error('Empty CSV: no header row.');

  const header = records[0].map((h) => h.trim());
  const data = records.slice(1);

  let keyIndex = 0;
  if (options.key) {
    keyIndex = header.findIndex((h) => h === String(options.key).trim());
    if (keyIndex === -1) {
      throw new Error(`Key column "${options.key}" not found. Columns: ${header.join(', ')}`);
    }
  }
  const keyName = header[keyIndex] || header[0];

  const seen = new Set();
  const duplicateKeys = [];
  let emptyKeyRows = 0;
  for (const row of data) {
    const k = (row[keyIndex] ?? '').trim();
    if (k === '') { emptyKeyRows++; continue; }
    if (seen.has(k)) duplicateKeys.push(k);
    else seen.add(k);
  }

  if ((emptyKeyRows > 0 || duplicateKeys.length > 0) && !options.dedup) {
    const parts = [];
    if (emptyKeyRows > 0) parts.push(`${emptyKeyRows} row(s) with an empty key`);
    if (duplicateKeys.length > 0) {
      const sample = [...new Set(duplicateKeys)].slice(0, 10).join(', ');
      parts.push(`${duplicateKeys.length} duplicate key(s): ${sample}`);
    }
    throw new Error(
      `Key column "${keyName}" is not citation-safe (${parts.join('; ')}). ` +
      'Re-run with --dedup to collapse duplicates and drop empty-key rows.',
    );
  }

  // Key column first; remaining columns keep their original order.
  const order = [keyIndex, ...header.map((_, i) => i).filter((i) => i !== keyIndex)];
  const reorderedHeader = order.map((i) => header[i]);

  const seenKeys = new Set();
  let collapsed = 0;
  const outRows = [];
  for (const row of data) {
    const k = (row[keyIndex] ?? '').trim();
    if (k === '') continue;
    if (seenKeys.has(k)) { collapsed++; continue; }
    seenKeys.add(k);
    outRows.push(order.map((i) => (row[i] ?? '').trim()));
  }

  return {
    rows: [reorderedHeader, ...outRows],
    header: reorderedHeader,
    keyName,
    inputRows: data.length,
    outputRows: outRows.length,
    collapsed,
    droppedEmptyKey: emptyKeyRows,
    duplicateKeys: [...new Set(duplicateKeys)],
  };
}

/**
 * Resolve a raw CSV, curate it, and write the citation-ready CSV under
 * `sources/nn/import/` (mirroring its path under `sources/import/`).
 *
 * @param {string} input Path to the raw CSV (absolute or relative to cwd).
 * @param {{ key?: string, dedup?: boolean, projectDir?: string }} [options]
 * @returns {{ outputPath: string, relOutput: string, citationExample: string } & ReturnType<typeof curateCsvContent>}
 */
function curateCsvFile(input, options = {}) {
  const projectDir = options.projectDir || process.cwd();
  const absInput = path.resolve(input);
  if (!fs.existsSync(absInput)) throw new Error(`CSV not found: ${absInput}`);

  const importDir = path.join(projectDir, 'sources', 'import');
  const rel = path.relative(importDir, absInput);
  const insideImport = rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  const relInImport = (insideImport ? rel : path.basename(absInput)).replace(/\\/g, '/');

  const curated = curateCsvContent(fs.readFileSync(absInput, 'utf8'), options);

  const nnDir = path.join(projectDir, 'sources', 'nn');
  const outputPath = path.join(nnDir, 'import', relInImport);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serializeCsv(curated.rows), 'utf8');

  const relOutput = path.relative(projectDir, outputPath).replace(/\\/g, '/');
  const relFromNn = path.relative(nnDir, outputPath).replace(/\\/g, '/');
  const firstKey = curated.rows[1] ? curated.rows[1][0] : '<key>';

  return {
    outputPath,
    relOutput,
    citationExample: `${relFromNn}@${firstKey}`,
    ...curated,
  };
}

module.exports = { curateCsvContent, curateCsvFile, serializeCsv, serializeCell };
