/**
 * duplicate-guards.js — import-time guard helpers (backlog:
 * feature/source-import-guards).
 *
 * Two guards share one matching layer:
 *  1. History guard  — search past conversation transcripts for prior handling
 *     of the same/similar source (by filename, source_file/source_url, topic).
 *  2. Duplicate guard — compare an incoming file against already-ingested
 *     sources: exact (sha256) or near (structural similarity) duplicates.
 *
 * These are pure helpers: the caller (agent workflow / scanner) decides how to
 * surface the verdict and ask the user reuse/adjust/from-scratch.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Canonicalize whitespace + ordering for structural comparison. */
function canonicalize(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .toLowerCase();
}

/** Tokenize a canonicalized text into an ordered token array. */
function tokenize(text) {
  return canonicalize(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Structural similarity in [0,1] — shared-token Jaccard over canonicalized
 * content. Same substance with different organisation scores high because
 * vocabulary dominates over layout.
 */
function structuralSimilarity(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setA = new Set(ta);
  let shared = 0;
  const seen = new Set();
  for (const t of tb) {
    if (setA.has(t) && !seen.has(t)) {
      shared++;
      seen.add(t);
    }
  }
  const union = new Set([...ta, ...tb]);
  return shared / union.size;
}

/** sha256 of a file's bytes. */
function computeFileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/** Strips frontmatter delimited by --- to isolate the normalized markdown body. */
function extractNormalizedBody(content) {
  if (!content || typeof content !== 'string') return '';
  if (content.startsWith('---\n') || content.startsWith('---\r\n')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) {
      return content.slice(endIdx + 4).trim();
    }
  }
  return content.trim();
}

/**
 * Duplicate guard: classify an incoming file against already-ingested sources.
 *
 * @param {string} incomingPath Absolute path of the incoming file.
 * @param {Array<{ path: string, sha256?: string|null, content?: string }>} corpus
 *   Existing sources (sources/nn/**). Provide `content` lazily to avoid reading
 *   every file up front — `contentLoader(path)` is called on demand.
 * @param {{ contentLoader?: (p: string) => string|null, nearThreshold?: number }} opts
 *   `nearThreshold` default 0.5.
 * @returns {{ exact: Array<string>, near: Array<{ path: string, score: number }> }}
 */
function detectDuplicates(incomingPath, corpus, opts = {}) {
  const { contentLoader = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null, nearThreshold = 0.5 } = opts;
  const rawIncoming = contentLoader(incomingPath) ?? '';
  const incomingBody = extractNormalizedBody(rawIncoming);
  const newHash = crypto.createHash('sha256').update(incomingBody, 'utf8').digest('hex');
  const newContent = canonicalize(incomingBody);
  const exact = [];
  const near = [];
  for (const item of corpus) {
    if (!item || !item.path) continue;
    const rawItem = contentLoader(item.path) ?? '';
    const itemBody = extractNormalizedBody(rawItem);
    const itemHash = crypto.createHash('sha256').update(itemBody, 'utf8').digest('hex');
    if (itemHash === newHash) {
      exact.push(item.path);
      continue;
    }
    if (!newContent) continue;
    const other = canonicalize(itemBody);
    if (!other) continue;
    const score = structuralSimilarity(newContent, other);
    if (score >= nearThreshold) near.push({ path: item.path, score: Math.round(score * 100) / 100 });
  }
  return { exact, near };
}

/**
 * History guard: search past conversation transcripts for prior handling of a
 * source. Matches on filename stem, `source_file`/`source_url` fields, or the
 * slugified topic inside `conversations/*.md`.
 *
 * @param {string} workspaceRoot
 * @param {{ fileName?: string, topic?: string, sourceRef?: string }} query
 * @returns {Array<{ file: string, title?: string, date?: string, excerpt?: string }>}
 */
function searchConversationHistory(workspaceRoot, query = {}) {
  const convDir = path.join(workspaceRoot, 'conversations');
  if (!fs.existsSync(convDir)) return [];
  const terms = [];
  if (query.fileName) terms.push(query.fileName.toLowerCase().replace(/\.md$/, ''));
  if (query.topic) terms.push(query.topic.toLowerCase());
  if (query.sourceRef) terms.push(String(query.sourceRef).toLowerCase());
  const haystacks = terms.filter(Boolean);
  if (haystacks.length === 0) return [];

  const hits = [];
  const files = fs
    .readdirSync(convDir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.md$/i.test(e.name))
    .map((e) => path.join(convDir, e.name));
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const lower = text.toLowerCase();
    const matched = haystacks.filter((t) => lower.includes(t));
    if (matched.length === 0) continue;
    const title = (text.match(/^#\s+(.+)$/m) || [])[1];
    const date = (f.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
    const lines = text.split('\n');
    let excerpt = '';
    for (let i = 0; i < lines.length; i++) {
      if (matched.some((t) => lines[i].toLowerCase().includes(t))) {
        excerpt = lines.slice(Math.max(0, i - 1), i + 2).join(' ').trim().slice(0, 200);
        break;
      }
    }
    hits.push({ file: path.relative(workspaceRoot, f).replace(/\\/g, '/'), title, date, excerpt });
  }
  return hits;
}

/**
 * Traverse sources/nn/ (and any active source trees) and compute a content-hash
 * index of all normalized sources, establishing canonical primary paths vs alias paths.
 *
 * Priority rules for primary canonical path:
 * 1. Non-import paths take precedence over `import/` paths (e.g. `sources/nn/sessions/foo.md` > `sources/nn/import/sessions/foo.md`).
 * 2. If both are non-import or both are import, shorter path or first-seen wins.
 *
 * @param {string} workspaceRoot
 * @param {object} [opts]
 * @returns {{
 *   sources: Array<any>,
 *   canonicalSources: Array<any>,
 *   aliases: Array<any>,
 *   byHash: Map<string, Array<any>>,
 *   byPath: Map<string, any>,
 * }}
 */
function indexWorkspaceSources(workspaceRoot, opts = {}) {
  const nnDir = path.join(workspaceRoot, 'sources', 'nn');
  const allEntries = [];

  if (!fs.existsSync(nnDir)) {
    return {
      sources: [],
      canonicalSources: [],
      aliases: [],
      byHash: new Map(),
      byPath: new Map(),
    };
  }

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') || ent.name === 'index.md' || ent.name === 'staging' || ent.name === 'archive') {
        continue;
      }
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && ent.name.endsWith('.md')) {
        const relPath = path.relative(workspaceRoot, full).replace(/\\/g, '/');
        const normPath = path.relative(nnDir, full).replace(/\\/g, '/');
        let content = '';
        try {
          content = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }

        const body = extractNormalizedBody(content);
        const bodyHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
        const shaMatch = content.match(/^sha256:\s*"([a-f0-9]{64})"\s*$/m);
        const rawHash = shaMatch ? shaMatch[1] : null;

        allEntries.push({
          fullPath: full,
          relativePath: relPath,
          normalizedPath: normPath,
          sha256: bodyHash,
          bodySha256: bodyHash,
          rawSha256: rawHash,
          isCanonical: false,
          primaryPath: '',
          aliases: [],
        });
      }
    }
  }

  walk(nnDir);

  const byHash = new Map();
  const byPath = new Map();

  for (const entry of allEntries) {
    if (!byHash.has(entry.sha256)) {
      byHash.set(entry.sha256, []);
    }
    byHash.get(entry.sha256).push(entry);
  }

  const canonicalSources = [];
  const aliases = [];

  for (const [hash, group] of byHash.entries()) {
    group.sort((a, b) => {
      const aImport = a.normalizedPath.startsWith('import/') || a.relativePath.includes('/import/');
      const bImport = b.normalizedPath.startsWith('import/') || b.relativePath.includes('/import/');
      if (!aImport && bImport) return -1;
      if (aImport && !bImport) return 1;
      return a.relativePath.length - b.relativePath.length || a.relativePath.localeCompare(b.relativePath);
    });

    const primary = group[0];
    primary.isCanonical = true;
    primary.primaryPath = primary.relativePath;
    primary.aliases = [];

    canonicalSources.push(primary);
    byPath.set(primary.relativePath, primary);
    byPath.set(primary.normalizedPath, primary);

    for (let i = 1; i < group.length; i++) {
      const alias = group[i];
      alias.isCanonical = false;
      alias.primaryPath = primary.relativePath;
      primary.aliases.push(alias.relativePath);
      aliases.push(alias);
      byPath.set(alias.relativePath, alias);
      byPath.set(alias.normalizedPath, alias);
    }
  }

  return {
    sources: allEntries,
    canonicalSources,
    aliases,
    byHash,
    byPath,
  };
}

/**
 * Audit models against workspace sources to discover un-cited sources,
 * suppressing identical duplicate sources across import subtrees using content hashing.
 *
 * @param {string} workspaceRoot
 * @param {object} [opts]
 * @returns {{
 *   totalSources: number,
 *   canonicalCount: number,
 *   aliasCount: number,
 *   citedCount: number,
 *   uncitedCount: number,
 *   uncitedSources: Array<{
 *     path: string,
 *     normalizedPath: string,
 *     sha256: string,
 *     aliases: string[],
 *   }>,
 *   citedSources: Array<{
 *     path: string,
 *     normalizedPath: string,
 *     sha256: string,
 *     citedByModels: string[],
 *     aliases: string[],
 *   }>,
 *   aliasMappings: Array<{
 *     aliasPath: string,
 *     canonicalPath: string,
 *     sha256: string,
 *   }>,
 * }}
 */
function auditUncitedSources(workspaceRoot, opts = {}) {
  const index = indexWorkspaceSources(workspaceRoot, opts);
  const modelsDir = path.join(workspaceRoot, 'models');

  const citedHashes = new Set();
  const citedPaths = new Set();
  const modelCitations = new Map();

  if (fs.existsSync(modelsDir)) {
    const modelFiles = [];
    function walkModels(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (ent.name.startsWith('.')) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walkModels(full);
        else if (ent.isFile() && ent.name.endsWith('_NN.md')) modelFiles.push(full);
      }
    }
    walkModels(modelsDir);

    for (const mFile of modelFiles) {
      const relModel = path.relative(workspaceRoot, mFile).replace(/\\/g, '/');
      let content = '';
      try { content = fs.readFileSync(mFile, 'utf8'); } catch { continue; }

      const refRegex = /^\s*sources::\s*(.+?)\s*$/gm;
      let m;
      while ((m = refRegex.exec(content)) !== null) {
        const raw = m[1].trim();
        const bracket = raw.match(/^\[(.*)\]$/s);
        const parts = bracket ? bracket[1].split(',') : [raw];
        for (const p of parts) {
          const v = p.trim().replace(/^"|"$/g, '');
          if (!v || v.startsWith('models/') || v.includes('@')) continue;

          const hashIdx = v.indexOf('#');
          const fileRef = (hashIdx >= 0 ? v.substring(0, hashIdx) : v)
            .replace(/^sources\/nn\//, '')
            .trim();

          if (!fileRef) continue;

          const match = index.byPath.get(fileRef) ||
                        index.byPath.get(`sources/nn/${fileRef}`) ||
                        index.sources.find(s => s.normalizedPath === fileRef || s.normalizedPath.endsWith(`/${fileRef}`) || path.basename(s.normalizedPath) === fileRef);

          if (match) {
            citedHashes.add(match.sha256);
            citedPaths.add(match.relativePath);
            if (!modelCitations.has(match.sha256)) {
              modelCitations.set(match.sha256, new Set());
            }
            modelCitations.get(match.sha256).add(relModel);
          }
        }
      }
    }
  }

  const uncitedSources = [];
  const citedSources = [];

  for (const canon of index.canonicalSources) {
    if (citedHashes.has(canon.sha256)) {
      citedSources.push({
        path: canon.relativePath,
        normalizedPath: canon.normalizedPath,
        sha256: canon.sha256,
        citedByModels: Array.from(modelCitations.get(canon.sha256) || []),
        aliases: canon.aliases,
      });
    } else {
      uncitedSources.push({
        path: canon.relativePath,
        normalizedPath: canon.normalizedPath,
        sha256: canon.sha256,
        aliases: canon.aliases,
      });
    }
  }

  const aliasMappings = index.aliases.map((a) => ({
    aliasPath: a.relativePath,
    canonicalPath: a.primaryPath,
    sha256: a.sha256,
  }));

  return {
    totalSources: index.sources.length,
    canonicalCount: index.canonicalSources.length,
    aliasCount: index.aliases.length,
    citedCount: citedSources.length,
    uncitedCount: uncitedSources.length,
    uncitedSources,
    citedSources,
    aliasMappings,
  };
}

module.exports = {
  canonicalize,
  tokenize,
  structuralSimilarity,
  computeFileHash,
  detectDuplicates,
  searchConversationHistory,
  indexWorkspaceSources,
  auditUncitedSources,
};