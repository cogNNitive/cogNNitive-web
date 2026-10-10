const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isSidecarName, rawPathOfSidecar } = require('./innfo-core.generated.cjs');

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
 * True for names the walkers never descend into or list: dotfiles, Office lock
 * files, `desktop.ini`, and `staging` (scratch space).
 * @param {string} name
 * @returns {boolean}
 */
function isSkippedEntry(name) {
  const lower = name.toLowerCase();
  return name.startsWith('.') || name.startsWith('~$') || lower === 'desktop.ini' || lower === 'staging';
}

/**
 * Recursively walk a directory preserving subfolders (ignoring staging and hidden files).
 * @param {string} originalDir
 * @returns {Array<{ absPath: string, relPath: string }>}
 */
function walkOriginal(originalDir) {
  const results = [];
  if (!fs.existsSync(originalDir)) return results;
  if (path.basename(originalDir).toLowerCase() === 'staging') return results;

  const walk = (dir, relDir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (isSkippedEntry(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        results.push({ absPath: fullPath, relPath });
      }
    }
  };

  walk(originalDir, '');
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/**
 * Recursively walk the two raw-source subtrees the scanner cognitivizes:
 * `sources/import/` and `sources/conversations/`. Sidecars are never raw files.
 *
 * @param {string} projectOrSourcesDir
 * @returns {Array<{ tree: string, absPath: string, relPath: string, sourceFileField: string }>}
 */
function walkSourceTrees(projectOrSourcesDir) {
  let sourcesDir = projectOrSourcesDir;
  if (path.basename(projectOrSourcesDir) !== 'sources' && fs.existsSync(path.join(projectOrSourcesDir, 'sources'))) {
    sourcesDir = path.join(projectOrSourcesDir, 'sources');
  }

  const items = [];
  for (const tree of ['import', 'conversations']) {
    for (const f of walkOriginal(path.join(sourcesDir, tree))) {
      if (isSidecarName(f.relPath)) continue;
      const relPosix = f.relPath.replace(/\\/g, '/');
      items.push({
        tree,
        absPath: f.absPath,
        relPath: f.relPath,
        sourceFileField: `sources/${tree}/${relPosix}`,
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
  if (path.basename(dir).toLowerCase() === 'staging') return counts;

  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (isSkippedEntry(entry.name)) continue;
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
 * The raw-source sidecar hash recorded for a raw file, or null when it has none.
 * @param {string} absPath Absolute path of the raw file.
 * @returns {string | null}
 */
function readSidecarSha256(absPath) {
  const sidecar = `${absPath}_sidecar_NN.md`;
  if (!fs.existsSync(sidecar)) return null;
  try {
    const fields = parseFrontmatterFields(fs.readFileSync(sidecar, 'utf8'));
    return fields.sha256 ? String(fields.sha256).toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Sidecars in the scanned subtrees whose raw file no longer exists. They are
 * reported, never deleted.
 *
 * @param {string} projectDir
 * @returns {Array<{ sidecar: string, sourceFile: string }>} workspace-relative posix paths
 */
function findOrphanSidecars(projectDir) {
  const sourcesDir = path.join(projectDir, 'sources');
  const orphans = [];
  for (const tree of ['import', 'conversations']) {
    const treeDir = path.join(sourcesDir, tree);
    if (!fs.existsSync(treeDir)) continue;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (isSkippedEntry(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && isSidecarName(entry.name)) {
          const relSidecar = path.relative(projectDir, full).replace(/\\/g, '/');
          const rawRel = rawPathOfSidecar(relSidecar);
          if (rawRel && !fs.existsSync(path.join(projectDir, rawRel))) {
            orphans.push({ sidecar: relSidecar, sourceFile: rawRel });
          }
        }
      }
    };
    walk(treeDir);
  }
  return orphans.sort((a, b) => a.sidecar.localeCompare(b.sidecar));
}

module.exports = {
  EXT_OK,
  EXT_PROMPT,
  EXT_NO,
  EXT_LABELS,
  EXT_DEPS,
  computeFileHash,
  readSidecarSha256,
  findOrphanSidecars,
  walkOriginal,
  walkSourceTrees,
  detectFormats,
  getSupportedFormats,
  parseFrontmatterFields,
};
