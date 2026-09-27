const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const converters = require('./scanner-converters');

const TRANNNSFORM_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../..', 'package.json'), 'utf8')).version || '1.0.0';
  } catch {
    return '1.0.0';
  }
})();

// Supported extensions by category
const EXT_OK = ['.txt', '.md', '.csv', '.json', '.html', '.htm', '.srt', '.vtt'];
const EXT_PROMPT = ['.docx', '.pdf', '.xlsx', '.xls', '.doc'];
const EXT_NO = ['.mp3', '.wav', '.png', '.jpg', '.jpeg', '.gif'];

const EXT_LABELS = {
  '.txt': 'txt', '.md': 'md', '.csv': 'csv', '.json': 'json', '.html': 'html', '.htm': 'htm',
  '.srt': 'srt', '.vtt': 'vtt',
  '.docx': 'docx', '.pdf': 'pdf', '.xlsx': 'xlsx', '.xls': 'xls', '.doc': 'doc'
};

const EXT_DEPS = {
  '.docx': { pkg: 'mammoth', label: 'mammoth' },
  '.pdf':  { pkg: 'pdf-parse', label: 'pdf-parse' },
  '.xlsx': { pkg: 'xlsx', label: 'xlsx' },
  '.xls':  { pkg: 'xlsx', label: 'xlsx' }
};

/**
 * Compute SHA-256 hash of a file.
 * @param {string} filePath
 * @returns {string}
 */
function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Escapes characters for YAML double-quoted string values.
 * @param {any} value
 * @returns {string}
 */
function escapeYamlString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

/**
 * Generate canonical flat YAML frontmatter for a normalized source file.
 * Supports W3C PROV-O, RO-Crate and bibliographic metadata (Phase 2 & 3).
 * @param {string} originalFilePath
 * @param {string} relativeSourcePath
 * @param {Record<string, any>} [extra]
 * @returns {string}
 */
function generateSourceFrontmatter(originalFilePath, relativeSourcePath, extra = {}) {
  const hash = computeFileHash(originalFilePath);
  const timestamp = new Date().toISOString();
  const stat = fs.statSync(originalFilePath);

  const lines = [
    '---',
    `source_file: "${relativeSourcePath}"`,
  ];

  if (extra.media_file) lines.push(`media_file: "${escapeYamlString(extra.media_file)}"`);
  lines.push(`sha256: "${hash}"`);
  if (extra.media_sha256) lines.push(`media_sha256: "${escapeYamlString(extra.media_sha256)}"`);
  lines.push(`size_bytes: ${stat.size}`);
  lines.push(`normalized_at: "${timestamp}"`);
  lines.push(`normalized_by: "traNNsform v${TRANNNSFORM_VERSION}"`);

  if (extra.staging_file) lines.push(`staging_file: "${escapeYamlString(extra.staging_file)}"`);
  if (extra.is_synthetic !== undefined) lines.push(`is_synthetic: ${Boolean(extra.is_synthetic)}`);
  if (extra.source_type) lines.push(`source_type: "${escapeYamlString(extra.source_type)}"`);
  if (extra.conversation_format) lines.push(`conversation_format: "${escapeYamlString(extra.conversation_format)}"`);
  if (extra.session_id) lines.push(`session_id: "${escapeYamlString(extra.session_id)}"`);
  if (extra.origin_transcript) lines.push(`origin_transcript: "${escapeYamlString(extra.origin_transcript)}"`);
  if (extra.derived_from) {
    const df = Array.isArray(extra.derived_from) ? extra.derived_from : [extra.derived_from];
    lines.push(`derived_from: [${df.join(', ')}]`);
  }

  if (extra.source_url) lines.push(`source_url: "${escapeYamlString(extra.source_url)}"`);
  if (extra.origin_uri) lines.push(`origin_uri: "${escapeYamlString(extra.origin_uri)}"`);
  if (extra.type) lines.push(`type: "${escapeYamlString(extra.type)}"`);
  if (extra.tags) {
    const tagsArr = Array.isArray(extra.tags) ? extra.tags : [extra.tags];
    lines.push(`tags: [${tagsArr.map((t) => `"${escapeYamlString(t)}"`).join(', ')}]`);
  }
  if (extra.downloaded_at) lines.push(`downloaded_at: "${escapeYamlString(extra.downloaded_at)}"`);
  if (extra.title) lines.push(`title: "${escapeYamlString(extra.title)}"`);
  if (extra.description) lines.push(`description: "${escapeYamlString(extra.description)}"`);
  if (extra.author) lines.push(`author: "${escapeYamlString(extra.author)}"`);

  if (extra.canonical && typeof extra.canonical === 'object') {
    lines.push('canonical:');
    if (extra.canonical.title) lines.push(`  title: "${escapeYamlString(extra.canonical.title)}"`);
    if (extra.canonical.author) lines.push(`  author: "${escapeYamlString(extra.canonical.author)}"`);
    if (extra.canonical.year) lines.push(`  year: ${extra.canonical.year}`);
    if (extra.canonical.doi) lines.push(`  doi: "${escapeYamlString(extra.canonical.doi)}"`);
    if (extra.canonical.bibtex) {
      lines.push('  bibtex: |');
      const bibLines = extra.canonical.bibtex.trim().split(/\r?\n/);
      for (const bl of bibLines) {
        lines.push(`    ${bl}`);
      }
    }
  }

  // External works this Source cites. `references` is accepted as a deprecated
  // input alias; the emitted key is always `cited_works` (the iNNfo `reference`
  // *field type* is a different concept — see docs/innfo/documentation/sources-citations-lineage.md).
  const citedWorks = Array.isArray(extra.cited_works)
    ? extra.cited_works
    : Array.isArray(extra.references)
      ? extra.references
      : null;
  if (citedWorks && citedWorks.length > 0) {
    lines.push('cited_works:');
    for (const ref of citedWorks) {
      lines.push(`  - id: "${escapeYamlString(ref.id || '')}"`);
      if (ref.citation) lines.push(`    citation: "${escapeYamlString(ref.citation)}"`);
      if (ref.doi) lines.push(`    doi: "${escapeYamlString(ref.doi)}"`);
      if (ref.is_primary !== undefined) lines.push(`    is_primary: ${Boolean(ref.is_primary)}`);
    }
  }

  lines.push('---', '', '');
  return lines.join('\n');
}

/**
 * Read the sha256 field back out of an already-normalized markdown file's frontmatter.
 * @param {string} destPath
 * @returns {string | null}
 */
function readExistingSha256(destPath) {
  if (!fs.existsSync(destPath)) return null;
  try {
    const content = fs.readFileSync(destPath, 'utf8');
    const fields = parseFrontmatterFields(content);
    if (fields.sha256) return fields.sha256;
    const m = content.match(/^sha256:\s*"([^"]+)"\s*$/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Recursively walk directory preserving subfolders (ignoring staging and hidden files).
 * @param {string} originalDir
 * @returns {Array<{ absPath: string, relPath: string }>}
 */
function walkOriginal(originalDir) {
  const results = [];
  if (!fs.existsSync(originalDir)) return results;
  const base = path.basename(originalDir).toLowerCase();
  if (base === 'staging' || base === 'archive') return results;

  const walk = (dir, relDir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name.startsWith('~$') ||
        entry.name.toLowerCase() === 'desktop.ini' ||
        entry.name.toLowerCase() === 'staging' ||
        entry.name.toLowerCase() === 'archive'
      ) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        results.push({ absPath: fullPath, relPath });
      }
    }
  };

  if (fs.existsSync(originalDir)) walk(originalDir, '');
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/**
 * Recursively walk all active source subtrees:
 * - sources/import/ (or legacy sources/original/)
 * - sources/conversations/
 * - sources/export/
 *
 * @param {string} projectOrSourcesDir
 * @returns {Array<{ tree: string, absPath: string, relPath: string, sourceFileField: string, destRelPath: string, isSynthetic: boolean }>}
 */
function walkSourceTrees(projectOrSourcesDir, options = {}) {
  let sourcesDir = projectOrSourcesDir;
  if (path.basename(projectOrSourcesDir) !== 'sources' && fs.existsSync(path.join(projectOrSourcesDir, 'sources'))) {
    sourcesDir = path.join(projectOrSourcesDir, 'sources');
  }

  const importDir = path.join(sourcesDir, 'import');
  const originalDir = path.join(sourcesDir, 'original');
  const convDir = path.join(sourcesDir, 'conversations');
  const exportDir = path.join(sourcesDir, 'export');
  const nnDir = path.join(sourcesDir, 'nn');

  const items = [];

  // 1. Ingestion subtree: sources/import/ with legacy fallback to sources/original/
  if (fs.existsSync(importDir)) {
    const files = walkOriginal(importDir);
    for (const f of files) {
      const relPosix = f.relPath.replace(/\\/g, '/');
      const flatCandidate = relPosix.replace(/\.[^.]+$/, '.md');
      const mirroredCandidate = `import/${flatCandidate}`;

      // If flat layout is forced, or if a flat normalized file already exists under sources/nn/ while the mirrored one does not
      let destRelPath = mirroredCandidate;
      if (options.flat || options.preserveLayout) {
        destRelPath = flatCandidate;
      } else if (fs.existsSync(path.join(nnDir, flatCandidate)) && !fs.existsSync(path.join(nnDir, mirroredCandidate))) {
        destRelPath = flatCandidate;
      }

      items.push({
        tree: 'import',
        absPath: f.absPath,
        relPath: f.relPath,
        sourceFileField: `sources/import/${relPosix}`,
        destRelPath,
        isSynthetic: false,
      });
    }
  } else if (fs.existsSync(originalDir)) {
    console.warn("[DEPRECATION] 'sources/original/' is deprecated; migrate folder to 'sources/import/'");
    const files = walkOriginal(originalDir);
    for (const f of files) {
      const relPosix = f.relPath.replace(/\\/g, '/');
      items.push({
        tree: 'original',
        absPath: f.absPath,
        relPath: f.relPath,
        sourceFileField: `sources/original/${relPosix}`,
        destRelPath: relPosix.replace(/\.[^.]+$/, '.md'),
        isSynthetic: false,
      });
    }
  }

  // 2. Conversations subtree: sources/conversations/
  if (fs.existsSync(convDir)) {
    const files = walkOriginal(convDir);
    for (const f of files) {
      const relPosix = f.relPath.replace(/\\/g, '/');
      items.push({
        tree: 'conversations',
        absPath: f.absPath,
        relPath: f.relPath,
        sourceFileField: `sources/conversations/${relPosix}`,
        destRelPath: `conversations/${relPosix.replace(/\.[^.]+$/, '.md')}`,
        isSynthetic: false,
      });
    }
  }

  // 3. Synthetic exports subtree: sources/export/
  if (fs.existsSync(exportDir)) {
    const files = walkOriginal(exportDir);
    for (const f of files) {
      const relPosix = f.relPath.replace(/\\/g, '/');
      items.push({
        tree: 'export',
        absPath: f.absPath,
        relPath: f.relPath,
        sourceFileField: `sources/export/${relPosix}`,
        destRelPath: `export/${relPosix.replace(/\.[^.]+$/, '.md')}`,
        isSynthetic: true,
      });
    }
  }

  return items.sort((a, b) => a.sourceFileField.localeCompare(b.sourceFileField));
}

/**
 * Detect available formats in a directory (recursive, ignoring staging).
 * @param {string} dir
 * @returns {Record<string, number>}
 */
function detectFormats(dir) {
  /** @type {Record<string, number>} */
  const counts = {};
  if (!fs.existsSync(dir)) return counts;
  const base = path.basename(dir).toLowerCase();
  if (base === 'staging' || base === 'archive') return counts;

  const walk = (d) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name.startsWith('~$') ||
        entry.name.toLowerCase() === 'desktop.ini' ||
        entry.name.toLowerCase() === 'staging' ||
        entry.name.toLowerCase() === 'archive'
      ) {
        continue;
      }
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext in EXT_LABELS) counts[ext] = (counts[ext] || 0) + 1;
      }
    }
  };

  walk(dir);
  return counts;
}

/**
 * Returns comma-separated list of supported extensions.
 * @returns {string}
 */
function getSupportedFormats() {
  return Object.values(EXT_LABELS).map(l => `\`${l}\``).join(', ');
}

/**
 * Parses frontmatter key-value pairs from markdown text.
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseFrontmatterFields(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return {};
  const block = fm[1];
  /** @type {Record<string, string>} */
  const fields = {};
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    let val = line.substring(colonIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    fields[key] = val;
  }
  return fields;
}

/**
 * Retrieves existing frontmatter fields from normalized destination file if present.
 * @param {string} destPath
 * @param {string} sourceFileField
 * @returns {Record<string, string>}
 */
function getExistingFrontmatterFields(destPath, sourceFileField) {
  if (!fs.existsSync(destPath)) return {};
  try {
    const content = fs.readFileSync(destPath, 'utf8');
    const fields = parseFrontmatterFields(content);
    if (!fields.source_file || fields.source_file === sourceFileField) {
      return fields;
    }
  } catch {
    // Ignore read errors
  }
  return {};
}

/**
 * Takes a snapshot of an active normalized source file into sources/archive/<basename>/V<N>/<basename>.md.
 * Hash-idempotent: skips snapshot if one with the same sha256 already exists in the archive.
 *
 * @param {string} absPath Absolute path of the raw source file
 * @param {string} nnPath Active normalized file path in sources/nn/
 * @param {string} destPath Target destination (or same as nnPath)
 * @param {string} [basename] Source basename without extension
 * @returns {{ archived: boolean, skipped?: boolean, version?: string, archivePath?: string }}
 */
function archiveSourceSnapshot(absPath, nnPath, destPath, basename) {
  let activeFile = [nnPath, destPath, absPath].find(p => p && typeof p === 'string' && fs.existsSync(p) && p.endsWith('.md'));
  if (!activeFile && (destPath || nnPath || absPath)) {
    const candidatePath = destPath || nnPath || absPath;
    let cur = path.dirname(candidatePath);
    let sourcesDir = null;
    while (cur) {
      if (path.basename(cur).toLowerCase() === 'sources') {
        sourcesDir = cur;
        break;
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    if (sourcesDir) {
      const base = basename || path.basename(candidatePath, path.extname(candidatePath));
      const flatCandidate = path.join(sourcesDir, 'nn', `${base}.md`);
      const importCandidate = path.join(sourcesDir, 'nn', 'import', `${base}.md`);
      if (fs.existsSync(flatCandidate)) {
        activeFile = flatCandidate;
      } else if (fs.existsSync(importCandidate)) {
        activeFile = importCandidate;
      }
    }
  }

  if (!activeFile) {
    return { archived: false };
  }

  const base = basename || path.basename(activeFile, '.md');

  // Find sources/ root directory from activeFile
  let cur = path.dirname(activeFile);
  let sourcesDir = null;
  while (cur) {
    if (path.basename(cur).toLowerCase() === 'sources') {
      sourcesDir = cur;
      break;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  if (!sourcesDir) {
    return { archived: false };
  }

  const archiveBaseDir = path.join(sourcesDir, 'archive', base);
  const activeContent = fs.readFileSync(activeFile, 'utf8');
  const activeFm = parseFrontmatterFields(activeContent);
  const activeHash = activeFm.sha256 || computeFileHash(activeFile);

  // Check existing snapshots in sources/archive/<base>/
  let maxVersion = 0;
  if (fs.existsSync(archiveBaseDir)) {
    const entries = fs.readdirSync(archiveBaseDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const vMatch = ent.name.match(/^V(\d+)$/);
      if (!vMatch) continue;
      const vNum = parseInt(vMatch[1], 10);
      if (vNum > maxVersion) maxVersion = vNum;

      // Check hash for idempotency
      const snapshotFile = path.join(archiveBaseDir, ent.name, `${base}.md`);
      if (fs.existsSync(snapshotFile)) {
        const snapContent = fs.readFileSync(snapshotFile, 'utf8');
        const snapFm = parseFrontmatterFields(snapContent);
        if (snapFm.sha256 === activeHash) {
          return {
            archived: false,
            skipped: true,
            version: ent.name,
            archivePath: `sources/archive/${base}/${ent.name}/${base}.md`
          };
        }
      }
    }
  }

  const nextVersionNum = maxVersion + 1;
  const nextVersion = `V${nextVersionNum}`;
  const targetDir = path.join(archiveBaseDir, nextVersion);
  fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, `${base}.md`);
  fs.copyFileSync(activeFile, targetPath);

  const archivePath = `sources/archive/${base}/${nextVersion}/${base}.md`;
  return {
    archived: true,
    version: nextVersion,
    archivePath
  };
}

/**
 * Checks if a binary media companion sharing the same base name (stem) exists alongside a text source.
 * @param {string} absPath
 * @param {string} sourceFileField
 * @returns {{ media_file: string, media_sha256: string } | null}
 */
const COMPANION_MEDIA_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.flac', '.aac'];

function findCompanionMedia(absPath, sourceFileField) {
  const dir = path.dirname(absPath);
  const ext = path.extname(absPath);
  const stem = path.basename(absPath, ext);
  const relDir = path.dirname(sourceFileField);
  for (const mExt of COMPANION_MEDIA_EXTENSIONS) {
    const cand = path.join(dir, `${stem}${mExt}`);
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      const relMedia = path.join(relDir, `${stem}${mExt}`).replace(/\\/g, '/');
      const mediaHash = computeFileHash(cand);
      return { media_file: relMedia, media_sha256: mediaHash };
    }
  }
  return null;
}

/**
 * Recursively find orphaned normalized markdown files under sources/nn/.
 * An orphan is a file whose frontmatter source_file does not exist on disk relative to projectDir.
 * Excludes index.md, staging, archive, and user_input / in-line sources.
 *
 * @param {string} projectDir
 * @returns {Array<{ nnPath: string, relPath: string, baseName: string, sourceFile: string, sha256: string | null }>}
 */
function findOrphanSources(projectDir) {
  const nnDir = path.join(projectDir, 'sources', 'nn');
  const orphans = [];
  if (!fs.existsSync(nnDir)) return orphans;

  const walk = (dir, rel) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (
        ent.name.startsWith('.') ||
        ent.name.startsWith('~$') ||
        ent.name.toLowerCase() === 'desktop.ini' ||
        ent.name.toLowerCase() === 'staging' ||
        ent.name.toLowerCase() === 'archive'
      ) {
        continue;
      }
      const abs = path.join(dir, ent.name);
      const relPath = rel ? path.join(rel, ent.name) : ent.name;
      if (ent.isDirectory()) {
        walk(abs, relPath);
      } else if (ent.isFile() && ent.name.endsWith('.md')) {
        if (relPath === 'index.md') continue;
        const content = fs.readFileSync(abs, 'utf8');
        const fm = parseFrontmatterFields(content);
        if (fm.source_type === 'user_input' || (fm.source_file && (fm.source_file.startsWith('inline:') || fm.source_file.startsWith('chat:') || fm.source_file.includes('(proporcionado directamente')))) {
          continue;
        }
        if (fm.source_file) {
          const originalOnDisk = path.join(projectDir, fm.source_file);
          if (!fs.existsSync(originalOnDisk)) {
            const baseName = path.basename(ent.name, '.md');
            orphans.push({
              nnPath: abs,
              relPath: relPath.replace(/\\/g, '/'),
              baseName,
              sourceFile: fm.source_file,
              sha256: fm.sha256 || null,
            });
          }
        }
      }
    }
  };

  walk(nnDir, '');
  return orphans.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/**
 * Processes native/text formats and writes normalized markdown files.
 * @param {string} ext
 * @param {string} absPath
 * @param {string} sourceFileField
 * @param {string} destPath
 * @param {string} displayOutPath
 * @param {boolean} isSelected
 * @param {Record<string, any>} extra
 * @returns {{ format: string, status: string, action: string, outcome: 'processed' | 'skipped', snapshot?: any, baseName?: string, displayOutPath?: string }}
 */
function processOkFile(ext, absPath, sourceFileField, destPath, displayOutPath, isSelected, extra) {
  const format = ext === '.txt' ? 'Plain Text' : ext.substring(1).toUpperCase();
  if (!isSelected) {
    return { format, status: '⚠️ Skipped', action: `Format ${EXT_LABELS[ext]} excluded by user selection.`, outcome: 'skipped' };
  }

  // Reviewer-feedback drop zone: sources/import/feedback/ (legacy sources/original/feedback/).
  // Feedback docs always normalize as synthetic feedback sources; invalid JSON throws
  // inside convertOkFormat and is caught below so the run skips-and-reports the file.
  const feedbackRelPosix = String(sourceFileField || '').replace(/\\/g, '/');
  const isFeedbackDoc = ext === '.json' && /(^|\/)(import|original)\/feedback\//.test(feedbackRelPosix);

  // Destination collision guard: verify destPath is not already owned by a different source_file
  const sourceFilePosix = String(sourceFileField || '').replace(/\\/g, '/');
  if (fs.existsSync(destPath)) {
    try {
      const existingContent = fs.readFileSync(destPath, 'utf8');
      const existingFm = parseFrontmatterFields(existingContent);
      const existingSource = (existingFm.source_file || existingFm.file || '').replace(/\\/g, '/');
      if (existingSource && existingSource !== sourceFilePosix) {
        return {
          format,
          status: '❌ Collision',
          action: `Destination collision at \`sources/nn/${displayOutPath}\`: destination already claimed by \`${existingSource}\`. Incoming raw \`${sourceFilePosix}\` cannot overwrite it.`,
          outcome: 'failed',
          collision: true,
          existingSource,
          incomingSource: sourceFilePosix,
        };
      }
    } catch {
      // Ignore read error
    }
  }

  const newHash = computeFileHash(absPath);
  const existingHash = readExistingSha256(destPath);
  if (existingHash && existingHash === newHash) {
    return { format, status: '✅ Processed', action: `Already up to date at \`sources/nn/${displayOutPath}\` (unchanged, sha256 match).`, outcome: 'processed' };
  }

  try {
    const baseName = path.basename(displayOutPath, '.md');
    let snapshot = null;
    if (existingHash && existingHash !== newHash) {
      snapshot = archiveSourceSnapshot(absPath, destPath, destPath, baseName);
    }

    const body = converters.convertOkFormat(ext, absPath, baseName);

    let incomingFields = {};
    if (ext === '.md') {
      try {
        const rawContent = fs.readFileSync(absPath, 'utf8');
        incomingFields = parseFrontmatterFields(rawContent);
      } catch {}
    }

    let derivedFrom = extra.derived_from;
    if (!derivedFrom && incomingFields.derived_from) {
      if (incomingFields.derived_from.startsWith('[') && incomingFields.derived_from.endsWith(']')) {
        derivedFrom = incomingFields.derived_from.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
      } else {
        derivedFrom = [incomingFields.derived_from];
      }
    }

    const companionMedia = findCompanionMedia(absPath, sourceFileField);
    const existingFields = getExistingFrontmatterFields(destPath, sourceFileField);
    const finalExtra = {
      staging_file: extra.staging_file || incomingFields.staging_file || existingFields.staging_file,
      media_file: extra.media_file || incomingFields.media_file || existingFields.media_file || (companionMedia ? companionMedia.media_file : undefined),
      media_sha256: extra.media_sha256 || incomingFields.media_sha256 || existingFields.media_sha256 || (companionMedia ? companionMedia.media_sha256 : undefined),
      is_synthetic: isFeedbackDoc ? true : (extra.is_synthetic !== undefined ? extra.is_synthetic : (incomingFields.is_synthetic !== undefined ? (incomingFields.is_synthetic === 'true' || incomingFields.is_synthetic === true) : (existingFields.is_synthetic !== undefined ? existingFields.is_synthetic === 'true' : undefined))),
      source_type: isFeedbackDoc ? 'feedback' : (extra.source_type || incomingFields.source_type || existingFields.source_type),
      conversation_format: extra.conversation_format || incomingFields.conversation_format || existingFields.conversation_format,
      session_id: extra.session_id || incomingFields.session_id || existingFields.session_id,
      origin_transcript: extra.origin_transcript || incomingFields.origin_transcript || existingFields.origin_transcript,
      derived_from: derivedFrom,
      source_url: extra.source_url || incomingFields.source_url || existingFields.source_url,
      downloaded_at: extra.downloaded_at || incomingFields.downloaded_at || existingFields.downloaded_at,
      title: extra.title || incomingFields.title || existingFields.title,
      description: extra.description || incomingFields.description || existingFields.description,
      author: extra.author || incomingFields.author || existingFields.author,
      canonical: extra.canonical,
      cited_works: extra.cited_works,
    };

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, generateSourceFrontmatter(absPath, sourceFileField, finalExtra) + body, 'utf8');
    const actionText = (snapshot && snapshot.archived)
      ? `Archived ${snapshot.version} then converted`
      : `Converted to markdown at \`sources/nn/${displayOutPath}\``;
    return { format, status: '✅ Processed', action: actionText, outcome: 'processed', snapshot, baseName, displayOutPath };
  } catch (err) {
    return { format, status: '❌ Error', action: `Failed to process: ${err.message}`, outcome: 'skipped' };
  }
}

/**
 * Handles binary document formats prompting for conversion consent and dependency checks.
 * @param {string} ext
 * @param {string} absPath
 * @param {string} sourceFileField
 * @param {string} destPath
 * @param {string} displayOutPath
 * @param {boolean} isSelected
 * @param {Record<string, any>} options
 * @param {Record<string, any>} extra
 * @returns {Promise<{ format: string, status: string, action: string, outcome: 'processed' | 'skipped', snapshot?: any, baseName?: string, displayOutPath?: string }>}
 */
async function processPromptFile(ext, absPath, sourceFileField, destPath, displayOutPath, isSelected, options, extra) {
  const format = ext.substring(1).toUpperCase();
  if (!isSelected) {
    return { format, status: '⚠️ Skipped', action: `Format ${EXT_LABELS[ext]} excluded by user selection.`, outcome: 'skipped' };
  }

  if (ext === '.doc') {
    return { format, status: '⚠️ Skipped', action: 'Legacy .doc is not supported — convert it to .docx, or provide the .txt', outcome: 'skipped' };
  }

  const dep = await converters.ensureDependency(ext, options, EXT_DEPS);
  if (!dep.ok) {
    return { format, status: dep.status, action: dep.reason, outcome: 'skipped' };
  }

  // Destination collision guard: verify destPath is not already owned by a different source_file
  const sourceFilePosix = String(sourceFileField || '').replace(/\\/g, '/');
  if (fs.existsSync(destPath)) {
    try {
      const existingContent = fs.readFileSync(destPath, 'utf8');
      const existingFm = parseFrontmatterFields(existingContent);
      const existingSource = (existingFm.source_file || existingFm.file || '').replace(/\\/g, '/');
      if (existingSource && existingSource !== sourceFilePosix) {
        return {
          format,
          status: '❌ Collision',
          action: `Destination collision at \`sources/nn/${displayOutPath}\`: destination already claimed by \`${existingSource}\`. Incoming raw \`${sourceFilePosix}\` cannot overwrite it.`,
          outcome: 'failed',
          collision: true,
          existingSource,
          incomingSource: sourceFilePosix,
        };
      }
    } catch {
      // Ignore read error
    }
  }

  const newHash = computeFileHash(absPath);
  const existingHash = readExistingSha256(destPath);
  if (existingHash && existingHash === newHash) {
    return { format, status: '✅ Processed', action: `Already up to date at \`sources/nn/${displayOutPath}\` (unchanged, sha256 match).`, outcome: 'processed' };
  }

  let approve = options.autoAcceptPrompt;
  if (!approve && options.promptCallback) {
    approve = await options.promptCallback(sourceFileField);
  }
  if (!approve) {
    return { format, status: '⚠️ Skipped', action: 'Extraction declined or skipped.', outcome: 'skipped' };
  }

  try {
    const baseName = path.basename(displayOutPath, '.md');
    let snapshot = null;
    if (existingHash && existingHash !== newHash) {
      snapshot = archiveSourceSnapshot(absPath, destPath, destPath, baseName);
    }

    const result = await converters.PROMPT_CONVERTERS[ext](absPath, baseName);

    const mergedExtra = { ...extra };
    if (ext === '.pdf' && result.info) {
      if (result.info.Title && !mergedExtra.title) mergedExtra.title = result.info.Title;
      if (result.info.Author && !mergedExtra.author) mergedExtra.author = result.info.Author;
    }

    const companionMedia = findCompanionMedia(absPath, sourceFileField);
    const existingFields = getExistingFrontmatterFields(destPath, sourceFileField);
    const finalExtra = {
      staging_file: extra.staging_file || existingFields.staging_file,
      media_file: extra.media_file || existingFields.media_file || (companionMedia ? companionMedia.media_file : undefined),
      media_sha256: extra.media_sha256 || existingFields.media_sha256 || (companionMedia ? companionMedia.media_sha256 : undefined),
      is_synthetic: extra.is_synthetic !== undefined ? extra.is_synthetic : (existingFields.is_synthetic !== undefined ? existingFields.is_synthetic === 'true' : undefined),
      source_type: extra.source_type || existingFields.source_type,
      conversation_format: extra.conversation_format || existingFields.conversation_format,
      session_id: extra.session_id || existingFields.session_id,
      origin_transcript: extra.origin_transcript || existingFields.origin_transcript,
      derived_from: extra.derived_from,
      source_url: mergedExtra.source_url || existingFields.source_url,
      downloaded_at: mergedExtra.downloaded_at || existingFields.downloaded_at,
      title: mergedExtra.title || existingFields.title,
      description: mergedExtra.description || existingFields.description,
      author: mergedExtra.author || existingFields.author,
      canonical: extra.canonical,
      cited_works: extra.cited_works,
    };

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, generateSourceFrontmatter(absPath, sourceFileField, finalExtra) + result.body, 'utf8');
    if (result.partial) {
      return { format, status: '✅ Processed (Partial)', action: `Created placeholder markdown at \`sources/nn/${displayOutPath}\`. PDF parsing failed: ${result.note}`, outcome: 'processed', snapshot, baseName, displayOutPath };
    }
    const actionText = (snapshot && snapshot.archived)
      ? `Archived ${snapshot.version} then converted`
      : `Converted to markdown at \`sources/nn/${displayOutPath}\``;
    return { format, status: '✅ Processed', action: actionText, outcome: 'processed', snapshot, baseName, displayOutPath };
  } catch (err) {
    return { format, status: '❌ Error', action: `Failed to process: ${err.message}`, outcome: 'skipped' };
  }
}

module.exports = {
  TRANNNSFORM_VERSION,
  EXT_OK,
  EXT_PROMPT,
  EXT_NO,
  EXT_LABELS,
  EXT_DEPS,
  computeFileHash,
  escapeYamlString,
  generateSourceFrontmatter,
  readExistingSha256,
  archiveSourceSnapshot,
  findOrphanSources,
  walkOriginal,
  walkSourceTrees,
  detectFormats,
  getSupportedFormats,
  parseFrontmatterFields,
  getExistingFrontmatterFields,
  processOkFile,
  processPromptFile,
};
