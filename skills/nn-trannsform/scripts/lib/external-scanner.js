const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  parseName,
  formatMemberName,
  nextStamp,
  isNNName,
  isSidecarName,
  importRaw,
  TEXT_NATIVE_FORMATS,
} = require('./innfo-core.generated.cjs');

/**
 * Filename tokens that identify the workspace lineage / entrypoint record — the
 * document that may declare `## NN External Watch Roots:`. `domaiNN` is the
 * canonical entrypoint, `cogNNitive` is the lineage record, and `workspace` is
 * the legacy entrypoint kept readable for unmigrated workspaces.
 */
const RECORD_TOKENS = ['cogNNitive', 'domaiNN', 'workspace'];

/**
 * Computes a timestamped filename from an original basename.
 * e.g. "metrics.xlsx" -> "metrics_20260912T195800Z.xlsx" (UTC contract stamp)
 * @param {string} originalBasename
 * @param {Date} [date]
 * @returns {string}
 */
function formatTimestampedBasename(originalBasename, date = new Date()) {
  const ext = path.extname(originalBasename);
  const stem = path.basename(originalBasename, ext);
  return formatMemberName(stem, ext.replace(/^\./, ''), nextStamp(date));
}

/**
 * Extracts stem from a potentially timestamped filename.
 * e.g. "metrics_20260912T195800Z.xlsx" -> "metrics"
 * e.g. "metrics.xlsx" -> "metrics"
 * @param {string} filename
 * @returns {{ stem: string, timestamp: string | null, ext: string }}
 */
function parseSourceStem(filename) {
  const base = path.basename(filename);
  const ext = path.extname(base);
  const parsed = parseName(base);
  if (parsed.kind === 'file' && parsed.stamp) {
    return {
      stem: parsed.key,
      timestamp: parsed.stamp.stamp,
      ext: parsed.ext ? `.${parsed.ext}` : '',
    };
  }
  return {
    stem: path.basename(base, ext),
    timestamp: null,
    ext,
  };
}

/**
 * Calculates SHA-256 hash of a file synchronously.
 * @param {string} filePath
 * @returns {string}
 */
function computeFileHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * @typedef {{ Root: string, Cadence: 'dynamic' | 'static', Recursive: boolean, Filter?: string[] }} WatchRootConfig
 */

/**
 * Parses declarative external watch roots from model content or file path.
 * Supports:
 * ## NN External Watch Roots:
 * - Root: "D:/External_Drops/Client_Inputs"
 *   Cadence: "dynamic"
 *   Recursive: true
 *   Filter: ["*.pdf", "*.docx"]
 *
 * @param {string} contentOrPath
 * @returns {WatchRootConfig[]}
 */
function parseWatchRoots(contentOrPath) {
  let content = contentOrPath;
  if (typeof contentOrPath === 'string' && fs.existsSync(contentOrPath) && fs.statSync(contentOrPath).isFile()) {
    content = fs.readFileSync(contentOrPath, 'utf8');
  }

  /** @type {WatchRootConfig[]} */
  const roots = [];
  const sectionMatch = content.match(/## NN External Watch Roots:\s*([\s\S]*?)(?=\n## NN |\n# NN |$)/i);
  if (!sectionMatch) return roots;

  const sectionText = sectionMatch[1];
  const lines = sectionText.split(/\r?\n/);
  /** @type {WatchRootConfig | null} */
  let currentRoot = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const rootMatch = line.match(/^-\s*Root:\s*"?([^"\r\n]+)"?/i);
    if (rootMatch) {
      if (currentRoot) roots.push(currentRoot);
      currentRoot = {
        Root: rootMatch[1].trim(),
        Cadence: /** @type {'dynamic' | 'static'} */ ('dynamic'),
        Recursive: true,
      };
      continue;
    }

    if (!currentRoot) continue;

    const cadenceMatch = line.match(/^Cadence:\s*["']?(\w+)["']?/i);
    if (cadenceMatch) {
      currentRoot.Cadence = cadenceMatch[1].toLowerCase() === 'static' ? 'static' : 'dynamic';
    }

    const recMatch = line.match(/^Recursive:\s*(true|false)/i);
    if (recMatch) {
      currentRoot.Recursive = recMatch[1].toLowerCase() === 'true';
    }

    const filterMatch = line.match(/^Filter:\s*\[(.*)\]/i);
    if (filterMatch) {
      currentRoot.Filter = filterMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
  }

  if (currentRoot) {
    roots.push(currentRoot);
  }

  return roots;
}

/**
 * Scans an external directory (strict read-only) with Fast Path mtime/size checks.
 *
 * @param {{ Root: string, Cadence?: 'dynamic' | 'static', Recursive?: boolean, Filter?: string[] }} rootConfig
 * @param {Map<string, { mtimeMs: number, size: number, sha256: string }> | Record<string, any>} [cache]
 * @returns {{
 *   root: string,
 *   cadence: 'dynamic' | 'static',
 *   status: 'CONNECTED' | 'DISCONNECTED',
 *   items: Array<{
 *     relPath: string,
 *     fullPath: string,
 *     baseName: string,
 *     sizeBytes: number,
 *     mtimeMs: number,
 *     mtimeIso: string,
 *     sha256: string,
 *     deltaStatus: 'NEW' | 'EVOLVED_DYNAMIC' | 'STATIC_ALERT' | 'UNCHANGED',
 *     fastPathHit: boolean
 *   }>
 * }}
 */
function scanExternalDirectory(rootConfig, cache = {}) {
  const rootDir = rootConfig.Root;
  const cadence = rootConfig.Cadence || 'dynamic';
  const recursive = rootConfig.Recursive !== false;
  const filterList = rootConfig.Filter && rootConfig.Filter.length > 0 ? rootConfig.Filter : null;

  const cacheMap = cache instanceof Map ? cache : new Map(Object.entries(cache));

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return {
      root: rootDir,
      cadence,
      status: 'DISCONNECTED',
      items: [],
    };
  }

  const items = [];

  function matchesFilter(filename) {
    if (!filterList) return true;
    const ext = path.extname(filename).toLowerCase();
    return filterList.some((pat) => {
      const p = pat.toLowerCase().replace(/^\*/, '');
      return p === ext || p === filename.toLowerCase();
    });
  }

  function walk(currentDir, relPrefix) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      const full = path.join(currentDir, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;

      if (ent.isDirectory()) {
        if (recursive && !ent.name.startsWith('.')) {
          walk(full, rel);
        }
      } else if (ent.isFile()) {
        if (!matchesFilter(ent.name)) continue;

        try {
          const stat = fs.statSync(full);
          const cached = cacheMap.get(full) || cacheMap.get(rel);

          let fastPathHit = false;
          let sha256 = '';
          let deltaStatus = 'NEW';

          if (cached) {
            if (cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
              fastPathHit = true;
              sha256 = cached.sha256;
              deltaStatus = 'UNCHANGED';
            } else {
              // File changed! Compute sha256
              sha256 = computeFileHash(full);
              if (sha256 === cached.sha256) {
                deltaStatus = 'UNCHANGED';
              } else {
                deltaStatus = cadence === 'dynamic' ? 'EVOLVED_DYNAMIC' : 'STATIC_ALERT';
              }
            }
          } else {
            sha256 = computeFileHash(full);
            deltaStatus = 'NEW';
          }

          items.push({
            relPath: rel,
            fullPath: full,
            baseName: ent.name,
            sizeBytes: stat.size,
            mtimeMs: stat.mtimeMs,
            mtimeIso: stat.mtime.toISOString(),
            sha256,
            deltaStatus,
            fastPathHit,
          });
        } catch {
          // Ignore unreadable individual files gracefully
        }
      }
    }
  }

  walk(rootDir, '');

  return {
    root: rootDir,
    cadence,
    status: 'CONNECTED',
    items,
  };
}

/**
 * Scans all watch roots declared in a workspace's provenance model.
 *
 * @param {string} projectDir
 * @param {Map<string, any> | Record<string, any>} [cache]
 * @returns {{
 *   roots: Array<ReturnType<typeof scanExternalDirectory>>,
 *   classified: {
 *     new: Array<any>,
 *     evolved: Array<any>,
 *     alerts: Array<any>,
 *     disconnected: Array<string>,
 *     unchanged: Array<any>
 *   }
 * }}
 */
function scanAllWatchRoots(projectDir, cache = {}) {
  // Find the lineage/entrypoint record that can declare watch roots. The record
  // is `<Project>_..._cogNNitive_NN.md` (or the entrypoint `domaiNN_NN.md`), living
  // at the workspace root or under the knowledge dir (`kNNowledge/`).
  let modelPath = null;
  for (const dirName of ['kNNowledge']) {
    if (modelPath) break;
    const dir = path.join(projectDir, dirName);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    const prov = files.find((f) => !isSidecarName(f) && RECORD_TOKENS.some((t) => f.includes(t)));
    if (prov) modelPath = path.join(dir, prov);
  }

  // Also check workspace root records.
  if (!modelPath) {
    const rootFiles = fs.readdirSync(projectDir);
    const prov = rootFiles.find((f) => isNNName(f) && !isSidecarName(f) && RECORD_TOKENS.some((t) => f.includes(t)));
    if (prov) modelPath = path.join(projectDir, prov);
  }

  const rootConfigs = modelPath ? parseWatchRoots(modelPath) : [];
  const scannedRoots = rootConfigs.map((cfg) => scanExternalDirectory(cfg, cache));

  const classified = {
    new: [],
    evolved: [],
    alerts: [],
    disconnected: [],
    unchanged: [],
  };

  for (const sr of scannedRoots) {
    if (sr.status === 'DISCONNECTED') {
      classified.disconnected.push(sr.root);
      continue;
    }
    for (const it of sr.items) {
      const itemWithRoot = { ...it, root: sr.root, cadence: sr.cadence };
      if (it.deltaStatus === 'NEW') classified.new.push(itemWithRoot);
      else if (it.deltaStatus === 'EVOLVED_DYNAMIC') classified.evolved.push(itemWithRoot);
      else if (it.deltaStatus === 'STATIC_ALERT') classified.alerts.push(itemWithRoot);
      else classified.unchanged.push(itemWithRoot);
    }
  }

  return {
    roots: scannedRoots,
    classified,
  };
}

/**
 * Imports candidate files from the watch roots into workspace sources/import/.
 * The watch root is only read. Every import is a new write-once family member
 * (always suffixed, whatever the cadence; identical bytes dedupe) and its copy is
 * cognitivized in place. Binary formats are left to the scan that follows, which
 * runs their dependency and consent checks before converting.
 *
 * @param {Array<{ fullPath: string, baseName: string, cadence?: 'dynamic' | 'static' }>} candidates
 * @param {string} projectDir
 * @param {{ timestampDate?: Date }} [options]
 * @returns {Promise<Array<{ sourcePath: string, importedAs: string, fullImportPath: string, status: 'imported' | 'deduplicated', cognitivized: boolean }>>}
 */
async function importExternalFiles(candidates, projectDir, options = {}) {
  const now = options.timestampDate ? () => options.timestampDate : undefined;
  const { createNormalizer } = require('./normalizer');
  const normalizer = createNormalizer({ projectDir });

  const imported = [];
  for (const item of candidates) {
    const ext = path.extname(item.baseName).slice(1).toLowerCase();
    const textNative = TEXT_NATIVE_FORMATS.has(ext);
    const result = await importRaw(projectDir, item.fullPath, { now, normalizer: textNative ? normalizer : undefined });
    if (result.status === 'rejected') {
      throw new Error(`Cannot import ${item.fullPath}: ${result.reason}`);
    }
    imported.push({
      sourcePath: item.fullPath,
      importedAs: path.basename(result.path),
      fullImportPath: path.join(projectDir, result.path),
      status: result.status,
      cognitivized: result.cognitivize.status === 'written' || result.cognitivize.status === 'refreshed' || result.cognitivize.status === 'unchanged',
    });
  }

  return imported;
}

/**
 * Renders a scan result as a stable, machine-readable object (changed items only).
 * @param {ReturnType<typeof scanAllWatchRoots>} scanResult
 * @returns {{
 *   generatedAt: string,
 *   roots: Array<{ root: string, cadence: string, status: string, items: Array<object> }>
 * }}
 */
function serializeScanResult(scanResult) {
  return {
    generatedAt: new Date().toISOString(),
    roots: ((scanResult && scanResult.roots) || []).map((r) => ({
      root: r.root,
      cadence: r.cadence,
      status: r.status,
      items: (r.items || [])
        .filter((it) => it.deltaStatus !== 'UNCHANGED')
        .map((it) => ({
          relPath: it.relPath,
          sha256: it.sha256,
          mtimeMs: it.mtimeMs,
          size: it.sizeBytes,
          status: it.deltaStatus,
        })),
    })),
  };
}

module.exports = {
  formatTimestampedBasename,
  parseSourceStem,
  computeFileHash,
  parseWatchRoots,
  scanExternalDirectory,
  scanAllWatchRoots,
  serializeScanResult,
  importExternalFiles,
};
