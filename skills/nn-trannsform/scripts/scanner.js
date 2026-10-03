const fs = require('fs');
const path = require('path');
const core = require('./lib/scanner-core');
const converters = require('./lib/scanner-converters');
const { cognitivize, isSidecarName, isNNName } = require('./lib/innfo-core.generated.cjs');
const { createNormalizer } = require('./lib/normalizer');

/**
 * Cognitivize one raw file in place through innfo-core. Dependency and consent
 * checks for the prompt formats run first, and only when the sidecar is stale.
 *
 * @returns {Promise<{ format: string, status: string, action: string, outcome: 'processed' | 'skipped', refreshed?: boolean }>}
 */
async function processFile(projectDir, item, normalizer, notes, options) {
  const { absPath, relPath, sourceFileField } = item;
  const ext = path.extname(relPath).toLowerCase();
  const format = ext === '.txt' ? 'Plain Text' : ext.substring(1).toUpperCase();

  if (core.EXT_NO.includes(ext)) {
    return { format, status: '🚫 Blocked', action: 'Unsupported format (needs manual action)', outcome: 'skipped' };
  }
  const isPrompt = core.EXT_PROMPT.includes(ext);
  if (!isPrompt && !core.EXT_OK.includes(ext)) {
    return { format: 'Unknown', status: '⚠️ Skipped', action: 'Unknown extension', outcome: 'skipped' };
  }
  if (options.formats && !options.formats.includes(ext)) {
    return { format, status: '⚠️ Skipped', action: `Format ${core.EXT_LABELS[ext]} excluded by user selection.`, outcome: 'skipped' };
  }

  if (isPrompt) {
    if (ext === '.doc') {
      return { format, status: '⚠️ Skipped', action: 'Legacy .doc is not supported — convert it to .docx, or provide the .txt', outcome: 'skipped' };
    }
    const current = core.readSidecarSha256(absPath) === core.computeFileHash(absPath);
    if (!current) {
      const dep = await converters.ensureDependency(ext, options, core.EXT_DEPS);
      if (!dep.ok) return { format, status: dep.status, action: dep.reason, outcome: 'skipped' };
      let approve = options.autoAcceptPrompt;
      if (!approve && options.promptCallback) approve = await options.promptCallback(sourceFileField);
      if (!approve) return { format, status: '⚠️ Skipped', action: 'Extraction declined or skipped.', outcome: 'skipped' };
    }
  }

  try {
    const result = await cognitivize(projectDir, sourceFileField, { normalizer });
    if (result.status === 'unchanged') {
      return { format, status: '✅ Processed', action: `Already up to date at \`${result.sidecar}\` (unchanged, sha256 match).`, outcome: 'processed' };
    }
    if (result.status === 'written' || result.status === 'refreshed') {
      const note = notes.get(sourceFileField);
      const verb = result.status === 'refreshed' ? 'Refreshed' : 'Cognitivized in place:';
      const status = note && note.partial ? '✅ Processed (Partial)' : '✅ Processed';
      const action = note && note.partial
        ? `${verb} \`${result.sidecar}\` with a placeholder body. Parsing failed: ${note.note}`
        : `${verb} \`${result.sidecar}\``;
      return { format, status, action, outcome: 'processed', refreshed: result.status === 'refreshed' };
    }
    const reason = result.status === 'rejected' ? result.reason : result.status;
    return { format, status: '⚠️ Skipped', action: `Not cognitivized (${reason}).`, outcome: 'skipped' };
  } catch (err) {
    return { format, status: '❌ Error', action: `Failed to process: ${err.message}`, outcome: 'skipped' };
  }
}

/**
 * Cognitivize a list of items, in order, through the one per-file operation.
 * Orphaned sidecars under the scanned raw trees are reported, never deleted.
 * @param {string} projectDir
 * @param {Array<{ absPath: string, relPath: string, sourceFileField: string }>} files
 * @param {Record<string, any>} options
 * @returns {Promise<{ totalDiscovered: number, processedCount: number, skippedCount: number, registry: Array<any>, orphans: Array<{ sidecar: string, sourceFile: string }>, refreshed: string[] }>}
 */
async function cognitivizeItems(projectDir, files, options) {
  const notes = new Map();
  const normalizer = createNormalizer({ projectDir, webImportMeta: options.webImportMeta || {}, notes });

  const registry = [];
  const refreshed = [];
  let processedCount = 0;
  let skippedCount = 0;

  for (const item of files) {
    const entry = await processFile(projectDir, item, normalizer, notes, options);
    if (entry.outcome === 'processed') {
      processedCount++;
      if (entry.refreshed) refreshed.push(item.sourceFileField);
    } else {
      skippedCount++;
    }
    registry.push({ name: item.sourceFileField, format: entry.format, size: fs.statSync(item.absPath).size, status: entry.status, action: entry.action });
  }

  // Orphaned sidecars are reported, never deleted (Zero Unilateral Mutation).
  const orphans = core.findOrphanSidecars(projectDir);
  for (const orphan of orphans) {
    console.warn(`⚠️  Warning: Orphaned sidecar \`${orphan.sidecar}\` — raw file \`${orphan.sourceFile}\` no longer exists on disk. Preserved.`);
  }

  return { totalDiscovered: files.length, processedCount, skippedCount, registry, orphans, refreshed };
}

/**
 * Scan the raw source trees (`sources/import/`, `sources/conversations/`) and
 * cognitivize every file that has no up-to-date sidecar, in place. Sidecars sit
 * next to their raw file; nothing is mirrored, archived, or moved.
 * @param {string} projectDir
 * @param {Record<string, any>} [options]
 */
async function scanAndProcess(projectDir, options = {}) {
  fs.mkdirSync(path.join(projectDir, 'sources', 'import'), { recursive: true });

  let files = core.walkSourceTrees(projectDir);
  if (options.singleFile) {
    const singleNorm = options.singleFile.replace(/\\/g, '/').toLowerCase();
    files = files.filter(item => {
      const absPosix = item.absPath.replace(/\\/g, '/').toLowerCase();
      const relPosix = item.relPath.replace(/\\/g, '/').toLowerCase();
      const srcPosix = item.sourceFileField.toLowerCase();
      return (
        absPosix.endsWith(singleNorm) ||
        relPosix === singleNorm ||
        srcPosix.endsWith(singleNorm) ||
        path.basename(absPosix) === singleNorm ||
        path.basename(relPosix) === singleNorm
      );
    });
    if (files.length === 0) {
      console.warn(`⚠️  Warning: Specified single file "${options.singleFile}" was not discovered in the raw source trees.`);
    }
  }

  return cognitivizeItems(projectDir, files, options);
}

/**
 * Cognitivize one file or, recursively, every raw file under a directory of the
 * domaiNN. Sidecars, other `_NN.md` documents, `staging/` and dot entries are
 * skipped. The same per-file operation backs `scanAndProcess`.
 * @param {string} projectDir
 * @param {string} target File or directory, workspace-relative or absolute (must be inside the project).
 * @param {Record<string, any>} [options]
 */
async function cognitivizeTarget(projectDir, target, options = {}) {
  const root = path.resolve(projectDir);
  const abs = path.resolve(root, target);
  const within = path.relative(root, abs);
  if (within.startsWith('..') || path.isAbsolute(within)) {
    throw new RangeError(`${target}: path is outside the project`);
  }
  if (!fs.existsSync(abs)) throw new Error(`${target}: no such file or directory`);

  const toItem = (absPath) => {
    const relPath = path.relative(root, absPath);
    return { absPath, relPath, sourceFileField: relPath.replace(/\\/g, '/') };
  };
  const files = fs.statSync(abs).isDirectory()
    ? core
        .walkOriginal(abs)
        .filter((f) => !isSidecarName(f.relPath) && !isNNName(f.relPath))
        .map((f) => toItem(f.absPath))
    : [toItem(abs)];

  return cognitivizeItems(projectDir, files, options);
}

module.exports = {
  scanAndProcess,
  cognitivizeTarget,
  detectFormats: core.detectFormats,
  isDepInstalled: converters.isDepInstalled,
  getSupportedFormats: core.getSupportedFormats,
  computeFileHash: core.computeFileHash,
  walkOriginal: core.walkOriginal,
  walkSourceTrees: core.walkSourceTrees,
  convertPdf: converters.convertPdf,
  convertDocx: converters.convertDocx,
  convertXlsx: converters.convertXlsx,
  convertOkFormat: converters.convertOkFormat,
  convertFeedbackJson: converters.convertFeedbackJson,
  validateFeedbackJson: converters.validateFeedbackJson,
  isFeedbackJsonPath: converters.isFeedbackJsonPath,
  stripFrontmatter: converters.stripFrontmatter,
  htmlToPlainText: converters.htmlToPlainText,
  EXT_LABELS: core.EXT_LABELS,
  EXT_DEPS: core.EXT_DEPS,
};
