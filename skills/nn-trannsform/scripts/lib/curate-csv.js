/**
 * curate-csv.js — turn a raw CSV into a citation-ready CSV.
 *
 * A raw CSV is cognitivized in place as it is; this module produces the CSV that
 * `sources:: <file>.csv@<row-id>` actually cites. It parses the raw CSV, moves
 * the key column to the front, guarantees the key is unique and non-empty, and
 * writes the result as a derived artifact: a write-once, UTC-suffixed member of
 * the family `artifacts/curated/<name>.csv`, cognitivized in place.
 *
 * The key column is the citation row-id (`csv@<key-value>`), so it must be the
 * first column, non-empty and unique — the same contract the workspace-source
 * validator enforces (`KU_EMPTY_KEY` / `KU_DUPLICATE_KEY`).
 *
 * Zero runtime dependencies (Node builtins, the skill's own CSV parser, and the
 * innfo-core mirror).
 */

const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./scanner-converters');
const { cognitivize, parseName, writeOnce } = require('./innfo-core.generated.cjs');

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
 * Resolve a raw CSV, curate it, and write the citation-ready CSV as a write-once
 * artifact under `artifacts/curated/`. Identical output deduplicates against the
 * latest member, so curating unchanged input twice writes nothing new.
 *
 * @param {string} input Path to the raw CSV (absolute or relative to cwd).
 * @param {{ key?: string, dedup?: boolean, projectDir?: string }} [options]
 * @returns {Promise<{ outputPath: string, relOutput: string, citationExample: string } & ReturnType<typeof curateCsvContent>>}
 */
async function curateCsvFile(input, options = {}) {
  const projectDir = path.resolve(options.projectDir || process.cwd());
  const absInput = path.resolve(input);
  if (!fs.existsSync(absInput)) throw new Error(`CSV not found: ${absInput}`);

  const curated = curateCsvContent(fs.readFileSync(absInput, 'utf8'), options);

  // A raw file inside the workspace is cognitivized first, so the artifact's hash guard has a current sidecar to check.
  const relInput = path.relative(projectDir, absInput).replace(/\\/g, '/');
  const insideProject = relInput !== '' && !relInput.startsWith('..') && !path.isAbsolute(relInput);
  if (insideProject) await cognitivize(projectDir, relInput);

  const parsed = parseName(path.basename(absInput));
  const key = parsed.kind === 'file' ? parsed.key : path.basename(absInput, path.extname(absInput));
  const written = await writeOnce(
    projectDir,
    { dir: 'artifacts/curated', key, ext: 'csv' },
    serializeCsv(curated.rows),
    { inputs: insideProject ? [relInput] : [] },
  );
  // The curated CSV cannot carry frontmatter, so its upstream edge (the raw file) lives in its sidecar.
  await cognitivize(projectDir, written.path, insideProject ? { sources: [relInput] } : {});

  const firstKey = curated.rows[1] ? curated.rows[1][0] : '<key>';

  return {
    outputPath: path.join(projectDir, written.path),
    relOutput: written.path,
    citationExample: `${written.path}@${firstKey}`,
    ...curated,
  };
}

module.exports = { curateCsvContent, curateCsvFile, serializeCsv, serializeCell };
