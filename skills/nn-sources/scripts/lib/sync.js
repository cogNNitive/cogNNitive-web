'use strict';

/**
 * `nn-sources --sync [alias]`: lands the origin of each Synchronization declared in
 * `sources/sources_NN.md` (nn-core `refreshSynchronization`) and prints, per refreshed
 * alias, a ready `propose_changeset` payload with one `comment` change. The CLI never
 * applies it and never writes `changes/`: apply stays in nn-mcp.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  cognitivize,
  latestOfFamily,
  parseName,
  readSynchronizations,
  refreshSynchronization,
  removeOrphanMirrors,
} = require('./nn-core.generated.cjs');
const { createNormalizer } = require('./normalizer');
const webImport = require('../webImport');

const CATALOG = 'sources/sources_NN.md';
const AUTHOR = 'nn-sources';
const IMPORT_DIR = 'sources/import';
const isUrl = (origin) => /^https?:\/\//i.test(origin);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/**
 * Refreshes a `kind: file` Synchronization whose origin is an https URL. The download is a
 * write-once member of `sources/import/<alias>`; fetch stays here so nn-core stays offline.
 * Returns the same result shape as `refreshSynchronization`.
 */
async function refreshUrl(projectDir, s) {
  const dirAbs = path.join(projectDir, IMPORT_DIR, s.alias);
  const idle = (status) => ({ alias: s.alias, status, files: [] });
  if (s.state === 'paused') return idle('skipped');
  const priorNames = fs.existsSync(dirAbs) ? fs.readdirSync(dirAbs) : [];

  let downloaded;
  try {
    downloaded = await webImport.downloadToImport(s.origin, projectDir, { subdir: s.alias });
  } catch {
    return idle('unreachable');
  }
  if (downloaded.deduplicated) return idle('unchanged');

  const name = path.basename(downloaded.relPath);
  const added = parseName(name);
  const prior = latestOfFamily(
    priorNames
      .filter((n) => {
        const parsed = parseName(n);
        return parsed.kind === 'file' && parsed.key === added.key && parsed.ext === added.ext;
      })
      .map((n) => ({ path: n })),
  );
  const rel = `${IMPORT_DIR}/${downloaded.relPath}`;
  const normalizer = createNormalizer({
    projectDir,
    webImportMeta: {
      [rel]: { ...downloaded.meta, origin_uri: downloaded.originUri, retrieved_at: downloaded.retrievedAt, synchronization: s.alias },
    },
  });
  await cognitivize(projectDir, rel, { normalizer });
  return {
    alias: s.alias,
    status: 'refreshed',
    files: [
      {
        path: name,
        before: prior ? sha256(fs.readFileSync(path.join(dirAbs, prior.path))) : null,
        after: sha256(fs.readFileSync(downloaded.absPath)),
      },
    ],
  };
}

/** `path before -> after` per file; an absent hash (added or removed) is left empty. */
function formatNotes(result) {
  const lines = result.files.map((f) => `${f.path} ${f.before ?? ''} -> ${f.after ?? ''}`.replace(/ {2,}/g, ' '));
  return [`Synchronization ${result.alias} (${result.status}): ${result.files.length} file(s) changed`, ...lines].join('\n');
}

/**
 * @param {{ alias: string, files: Array<{ path: string, before: string | null, after: string | null }>, status: string }} result
 */
function buildSyncPayload(result) {
  return {
    tool: 'propose_changeset',
    arguments: {
      operations: [
        {
          op: 'comment',
          target: `sources/sync/${result.alias}`,
          evidence: 'decision',
          author: AUTHOR,
          notes: formatNotes(result),
        },
      ],
    },
  };
}

function printSyncPayload(result) {
  console.log('');
  console.log('propose_changeset payload (comment):');
  console.log(JSON.stringify(buildSyncPayload(result), null, 2));
  console.log('');
  console.log('This is a ready payload. Apply it through apply_change; nothing was applied here.');
}

/**
 * @param {string} projectDir
 * @param {string | null} wanted  one alias, or null for every Synchronization
 * @returns {Promise<number>} the process exit code
 */
async function runSync(projectDir, wanted) {
  const catalogPath = path.join(projectDir, CATALOG);
  const text = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, 'utf8') : '';
  const { synchronizations, diagnostics } = readSynchronizations(text);
  let exitCode = 0;

  for (const d of diagnostics) {
    console.error(`Error: ${d.message}`);
    exitCode = 1;
  }

  const selected = wanted === null ? synchronizations : synchronizations.filter((s) => s.alias === wanted);
  if (wanted !== null && selected.length === 0) {
    console.error(`Error: no Synchronization with alias "${wanted}" in ${CATALOG}.`);
    return 1;
  }

  const normalizer = createNormalizer({ projectDir });
  for (const s of selected) {
    let result;
    try {
      if (isUrl(s.origin)) {
        if (s.kind !== 'file') throw new Error(`an https origin needs kind: file (got kind: ${s.kind})`);
        result = await refreshUrl(projectDir, s);
      } else {
        result = await refreshSynchronization(projectDir, s, { normalizer });
      }
    } catch (err) {
      console.error(`Error: Synchronization "${s.alias}" refused: ${err.message}`);
      exitCode = 1;
      continue;
    }
    if (result.status === 'skipped') {
      console.log(`Synchronization "${s.alias}" is paused; skipped.`);
    } else if (result.status === 'unreachable') {
      console.error(`Warning: origin of Synchronization "${s.alias}" is unreachable (${s.origin}); the previous mirror is kept.`);
      exitCode = 1;
    } else if (result.status === 'unchanged') {
      console.log(`Synchronization "${s.alias}" is up to date.`);
    } else {
      console.log(`Synchronization "${s.alias}" refreshed: ${result.files.length} file(s) changed.`);
      printSyncPayload(result);
    }
  }

  // With a Synchronization in doubt (a rejected alias) the declared set is incomplete, so nothing is removed.
  if (wanted === null && diagnostics.length === 0) {
    for (const removed of await removeOrphanMirrors(projectDir, synchronizations.map((s) => s.alias))) {
      console.log(`Synchronization "${removed.alias}" is no longer declared; its mirror was removed.`);
      printSyncPayload(removed);
    }
  }

  return exitCode;
}

module.exports = { runSync, buildSyncPayload };
