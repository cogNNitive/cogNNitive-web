const fs = require('fs');
const path = require('path');

/**
 * webImport.js — download a resource from a URL directly into sources/original/,
 * so it flows through the normal scan/normalize pipeline like any manually
 * dropped file (no new branches, no separate ingestion path).
 *
 * Zero npm dependencies: uses Node's native `fetch` and simple string/regex
 * HTML metadata parsing (no cheerio/jsdom).
 */

const CONTENT_TYPE_EXT_MAP = {
  'text/html': '.html',
  'application/xhtml+xml': '.html',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

function extFromContentType(contentType) {
  if (!contentType) return null;
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_EXT_MAP[mime] || null;
}

function extFromUrl(url) {
  try {
    const { pathname } = new URL(url);
    const ext = path.extname(pathname);
    return ext || null;
  } catch {
    return null;
  }
}

function sanitizeFilenameFromUrl(url, ext) {
  let base;
  try {
    const { pathname } = new URL(url);
    base = path.basename(pathname);
    try {
      base = decodeURIComponent(base);
    } catch {
      // leave percent-encoded if it can't be decoded
    }
  } catch {
    base = '';
  }
  if (!base || base === '/') base = 'download';
  base = base.replace(/[^a-zA-Z0-9._-]+/g, '_');

  const finalExt = ext || '.html';
  if (!base.toLowerCase().endsWith(finalExt.toLowerCase())) {
    base = base.replace(/\.[^.]+$/, '');
    if (!base) base = 'download';
    base += finalExt;
  }
  return base;
}

function decodeEntities(str) {
  return String(str)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function matchMetaTag(html, attr, value) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]*>`, 'i');
  const tag = html.match(re);
  if (!tag) return null;
  const contentMatch = tag[0].match(/content=["']([^"']*)["']/i);
  return contentMatch ? decodeEntities(contentMatch[1].trim()) : null;
}

/**
 * Extract basic metadata from an HTML document using simple string/regex
 * parsing (zero-dep). Best-effort: never throws, only returns keys it could
 * confidently find — <title>, og:title, og:description, meta author/description,
 * and JSON-LD blocks.
 */
function extractHtmlMetadata(html) {
  const meta = {};
  if (!html || typeof html !== 'string') return meta;

  try {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) meta.title = decodeEntities(titleMatch[1].trim());

    const ogTitle = matchMetaTag(html, 'property', 'og:title');
    if (ogTitle) meta.title = ogTitle;

    const ogDescription = matchMetaTag(html, 'property', 'og:description');
    const metaDescription = matchMetaTag(html, 'name', 'description');
    if (ogDescription) meta.description = ogDescription;
    else if (metaDescription) meta.description = metaDescription;

    const metaAuthor = matchMetaTag(html, 'name', 'author');
    if (metaAuthor) meta.author = metaAuthor;
  } catch {
    // best-effort — never fail the import over metadata parsing
  }

  try {
    const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of ldMatches) {
      try {
        const data = JSON.parse(m[1].trim());
        const obj = Array.isArray(data) ? data[0] : data;
        if (obj && typeof obj === 'object') {
          if (!meta.title && typeof obj.headline === 'string') meta.title = obj.headline;
          if (!meta.title && typeof obj.name === 'string') meta.title = obj.name;
          if (!meta.description && typeof obj.description === 'string') meta.description = obj.description;
          if (!meta.author) {
            if (typeof obj.author === 'string') meta.author = obj.author;
            else if (obj.author && typeof obj.author === 'object' && typeof obj.author.name === 'string') meta.author = obj.author.name;
          }
        }
      } catch {
        // malformed JSON-LD block — ignore and continue
      }
    }
  } catch {
    // best-effort
  }

  // Drop empty/falsy keys — only include what was actually found.
  for (const key of Object.keys(meta)) {
    if (!meta[key]) delete meta[key];
  }

  return meta;
}

/**
 * Download `url` straight into `targetDir` (sources/import/, with fallback to sources/original/),
 * the same dropbox the user drags manually-collected files into. The extension is
 * decided from the response's Content-Type header, falling back to the URL's
 * own extension.
 *
 * Returns a manifest describing what was saved — callers (the CLI or the
 * agent) are responsible for feeding `source_url`/`downloaded_at`/`meta` into
 * scanner.scanAndProcess's `webImportMeta` option so it ends up in the
 * normalized frontmatter.
 */
async function downloadToImport(url, targetDir, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Native fetch is not available in this Node.js runtime (requires Node 18+).');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  const ext = extFromContentType(contentType) || extFromUrl(url) || '.html';
  const buffer = Buffer.from(await response.arrayBuffer());

  const subdir = options.subdir || '';
  const destDir = subdir ? path.join(targetDir, subdir) : targetDir;
  fs.mkdirSync(destDir, { recursive: true });

  const filename = options.filename || sanitizeFilenameFromUrl(url, ext);
  const destPath = path.join(destDir, filename);
  fs.writeFileSync(destPath, buffer);

  const downloadedAt = new Date().toISOString();
  const relPath = path.relative(targetDir, destPath).replace(/\\/g, '/');

  const result = {
    relPath,
    absPath: destPath,
    contentType: contentType || null,
    sourceUrl: url,
    downloadedAt,
    meta: {
      origin_uri: url,
      type: options.type || 'url_snapshot',
      format: ext.startsWith('.') ? ext.substring(1) : ext,
      ...(options.tags ? { tags: options.tags } : {}),
    },
  };

  if (ext === '.html' || ext === '.htm') {
    const extracted = extractHtmlMetadata(buffer.toString('utf8'));
    result.meta = { ...result.meta, ...extracted };
  }

  return result;
}

const downloadToOriginal = downloadToImport;

module.exports = {
  downloadToImport,
  downloadToOriginal,
  extractHtmlMetadata,
  extFromContentType,
  extFromUrl,
  sanitizeFilenameFromUrl,
};
