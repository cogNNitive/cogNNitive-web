#!/usr/bin/env node
/**
 * scripts/lib/legacy-ledger-guard.js
 *
 * One-to-one legacy quarantine ledger and marker guard.
 *
 * Enforces that:
 * 1. `legacy-ledger.yaml` is valid (version: 1, required fields on every entry, no permanent history).
 * 2. Every marker `legacy:<namespace>/<id>` in tracked files has a unique matching ledger entry.
 * 3. Every ledger entry has at least one matching marker in tracked files.
 * 4. Every marked file is covered by its ledger entry's `paths`.
 * 5. Every pattern in an entry's `paths` matches at least one file carrying that entry's marker.
 *
 * Excludes: `openspec/**`, `legacy-ledger.yaml`, `*.test.js` / `*.test.mjs`, and contributor docs.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parseFocusedYaml } = require('./yaml-parser.js');

const MARKER_REGEX = /legacy:([a-z0-9-]+)\/([a-z0-9-]+)/g;
const REQUIRED_ENTRY_FIELDS = ['id', 'what', 'paths', 'why', 'removal', 'owner'];
const ID_REGEX = /^[a-z0-9-]+$/;

/**
 * Checks if a relative file path is excluded from marker scanning.
 * @param {string} relPath
 * @returns {boolean}
 */
function isExcludedPath(relPath) {
  const norm = relPath.split(path.sep).join('/');
  if (norm.startsWith('openspec/')) return true;
  if (norm === 'legacy-ledger.yaml' || norm.endsWith('/legacy-ledger.yaml')) return true;
  if (norm.endsWith('legacy-ledger-guard.test.js') || norm.endsWith('legacy-ledger-guard.test.mjs')) return true;
  if (norm.startsWith('temp/') || norm.includes('/temp/')) return true;
  return false;
}

/**
 * Checks if a path matches forbidden permanent history.
 * @param {string} p
 * @returns {boolean}
 */
function isPermanentHistory(p) {
  const norm = p.split(path.sep).join('/');
  if (norm.includes('_V_')) return true;
  if (norm.startsWith('docs/innfo/cdn/') || norm.includes('/cdn/') || norm.match(/-v\d+\.\d+\.\d+\.bundle\.js/)) return true;
  if (norm.startsWith('openspec/changes/archive/') || norm.startsWith('openspec/archive/')) return true;
  if (norm.startsWith('refs/tags/') || norm.startsWith('tag:')) return true;
  return false;
}

/**
 * Matches a file path against an entry path pattern (exact, prefix, or glob).
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesPathPattern(filePath, pattern) {
  const fileNorm = filePath.split(path.sep).join('/');
  const patNorm = pattern.split(path.sep).join('/');

  if (fileNorm === patNorm) return true;

  if (patNorm.includes('*') || patNorm.includes('?')) {
    // Glob match
    let regexStr = patNorm
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '§GLOBSTAR§')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/§GLOBSTAR§/g, '.*');
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(fileNorm);
  }

  // Directory prefix match
  if (patNorm.endsWith('/')) {
    return fileNorm.startsWith(patNorm);
  }

  return false;
}

/**
 * Validates the repository legacy ledger and code markers.
 * @param {object} [options]
 * @param {string} [options.repoRoot]
 * @param {string} [options.ledgerPath]
 * @param {string[]} [options.lsFiles]
 * @param {(file: string) => string} [options.readFile]
 * @returns {{
 *   ok: boolean,
 *   errors: string[],
 *   markers: Array<{ id: string, namespace: string, file: string, fullMarker: string }>,
 *   entries: any[]
 * }}
 */
function validateLegacyLedger(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..', '..');
  const ledgerPath = options.ledgerPath || path.join(repoRoot, 'legacy-ledger.yaml');
  const readFile = options.readFile || ((f) => fs.readFileSync(f, 'utf8'));

  const errors = [];
  const markers = [];
  let entries = [];

  // 1. Read and parse legacy-ledger.yaml
  if (!fs.existsSync(ledgerPath)) {
    return {
      ok: false,
      errors: [`legacy-ledger.yaml not found at ${ledgerPath}`],
      markers: [],
      entries: [],
    };
  }

  let doc;
  try {
    const rawYaml = readFile(ledgerPath);
    doc = parseFocusedYaml(rawYaml);
  } catch (err) {
    return {
      ok: false,
      errors: [`Failed to parse legacy-ledger.yaml: ${err.message}`],
      markers: [],
      entries: [],
    };
  }

  // 2. Validate top-level version
  if (!doc || (doc.version !== 1 && doc.version !== '1')) {
    errors.push(`Invalid legacy-ledger.yaml version: expected 1, got ${doc ? doc.version : 'none'}`);
  }

  // 3. Validate entries array
  if (!doc || !Array.isArray(doc.entries)) {
    if (doc && doc.entries === null) {
      entries = [];
    } else {
      errors.push('legacy-ledger.yaml "entries" must be an array');
      entries = [];
    }
  } else {
    entries = doc.entries;
  }

  // 4. Validate each entry schema and uniqueness
  const seenIds = new Set();
  const entryMap = new Map();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') {
      errors.push(`Entry #${i + 1} is not an object`);
      continue;
    }

    const id = entry.id;
    if (!id || typeof id !== 'string') {
      errors.push(`Entry #${i + 1} is missing required field: id`);
      continue;
    }

    if (!ID_REGEX.test(id)) {
      errors.push(`Entry #${i + 1} has invalid id "${id}" (must be kebab-case matching ${ID_REGEX})`);
    }

    if (seenIds.has(id)) {
      errors.push(`Duplicate entry id "${id}" found in legacy-ledger.yaml`);
    } else {
      seenIds.add(id);
      entryMap.set(id, entry);
    }

    for (const field of REQUIRED_ENTRY_FIELDS) {
      if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
        errors.push(`Entry "${id}" is missing required field: ${field}`);
      }
    }

    if (!Array.isArray(entry.paths) || entry.paths.length === 0) {
      errors.push(`Entry "${id}" field "paths" must be a non-empty array of file paths or globs`);
    } else {
      for (const p of entry.paths) {
        if (typeof p !== 'string' || !p.trim()) {
          errors.push(`Entry "${id}" contains empty or invalid path in "paths"`);
        } else if (isPermanentHistory(p)) {
          errors.push(`Entry "${id}" lists forbidden permanent history in paths: "${p}"`);
        }
      }
    }
  }

  // 5. Gather git-tracked files
  let trackedFiles = options.lsFiles;
  if (!trackedFiles) {
    try {
      const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8' });
      trackedFiles = output.split(/\r?\n/).filter(Boolean);
    } catch (err) {
      errors.push(`Failed to get git tracked files via git ls-files: ${err.message}`);
      trackedFiles = [];
    }
  }

  // 6. Scan files for markers
  const filesByEntryId = new Map();

  for (const relFile of trackedFiles) {
    if (isExcludedPath(relFile)) continue;

    const fullPath = path.isAbsolute(relFile) ? relFile : path.join(repoRoot, relFile);
    if (!fs.existsSync(fullPath)) continue;

    let content;
    try {
      content = readFile(fullPath);
    } catch (_) {
      // Binary or unreadable file
      continue;
    }

    let match;
    const re = new RegExp(MARKER_REGEX.source, 'g');
    while ((match = re.exec(content)) !== null) {
      const fullMarker = match[0];
      const namespace = match[1];
      const markerId = match[2];
      const normFile = relFile.split(path.sep).join('/');

      markers.push({
        namespace,
        id: markerId,
        file: normFile,
        fullMarker,
      });

      if (!filesByEntryId.has(markerId)) {
        filesByEntryId.set(markerId, []);
      }
      filesByEntryId.get(markerId).push(normFile);
    }
  }

  // 7. Check: Marker without entry
  for (const marker of markers) {
    if (!entryMap.has(marker.id)) {
      errors.push(
        `Marker "${marker.fullMarker}" in "${marker.file}" has no corresponding ledger entry in legacy-ledger.yaml`,
      );
    }
  }

  // 8. Check: Entry without marker
  for (const [id] of entryMap) {
    if (!filesByEntryId.has(id) || filesByEntryId.get(id).length === 0) {
      errors.push(`Ledger entry "${id}" has no code marker in the repository`);
    }
  }

  // 9. Check: Marked file outside entry paths & Paths item with no marker file
  for (const [id, entry] of entryMap) {
    const matchingFiles = filesByEntryId.get(id) || [];
    const declaredPaths = Array.isArray(entry.paths) ? entry.paths : [];

    // 9a. Marked file outside paths
    for (const file of matchingFiles) {
      const covered = declaredPaths.some((p) => matchesPathPattern(file, p));
      if (!covered) {
        errors.push(
          `Marked file "${file}" with marker "legacy:nn-rename/${id}" is not covered by entry "${id}" paths: [${declaredPaths.join(', ')}]`,
        );
      }
    }

    // 9b. Paths item with no marker file
    for (const p of declaredPaths) {
      const hasMatchingMarkerFile = matchingFiles.some((f) => matchesPathPattern(f, p));
      if (!hasMatchingMarkerFile) {
        errors.push(
          `Path "${p}" in ledger entry "${id}" does not match any file bearing marker "legacy:nn-rename/${id}"`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    markers,
    entries,
  };
}

// CLI execution
if (require.main === module) {
  const result = validateLegacyLedger();
  if (!result.ok) {
    console.error('❌ Legacy Ledger Guard failed:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
  console.log(`▶ Legacy Ledger Guard: ${result.entries.length} ledger entries, ${result.markers.length} code markers validated.`);
}

module.exports = {
  validateLegacyLedger,
  matchesPathPattern,
  isPermanentHistory,
  isExcludedPath,
};
