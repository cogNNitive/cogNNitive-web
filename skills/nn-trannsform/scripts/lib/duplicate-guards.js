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
const { parseCitation, isNNName, isSidecarName, isExcludedPath, rawPathOfSidecar } = require('./innfo-core.generated.cjs');

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
 *   Existing normalized bodies (sidecar files). Provide `content` lazily to avoid reading
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
 * Index every cognitivized source of the domaiNN from its co-located sidecar,
 * establishing canonical primary paths vs alias paths.
 *
 * Two sources are the same content when their sidecars record the same raw
 * `sha256`, or, for binary sources whose sidecar carries a normalized body, when
 * the bodies hash identically (frontmatter excluded). Sidecars themselves are
 * never indexed, and a sidecar whose raw file is missing is an orphan, not a source.
 *
 * Primary canonical path: the shortest path, then code-point order.
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
  const allEntries = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      const relPath = path.relative(workspaceRoot, full).replace(/\\/g, '/');
      if (isExcludedPath(relPath)) continue;
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.isFile() || !isSidecarName(ent.name)) continue;

      const rawRel = rawPathOfSidecar(relPath);
      const rawFull = rawRel ? path.join(workspaceRoot, rawRel) : null;
      if (!rawRel || !rawFull || !fs.existsSync(rawFull)) continue;
      let content = '';
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }

      const body = extractNormalizedBody(content);
      const bodyHash = body ? crypto.createHash('sha256').update(body, 'utf8').digest('hex') : null;
      const shaMatch = content.match(/^sha256:\s*"?([a-f0-9]{64})"?\s*$/m);

      allEntries.push({
        fullPath: rawFull,
        relativePath: rawRel,
        sidecarPath: relPath,
        sha256: '',
        bodySha256: bodyHash,
        rawSha256: shaMatch ? shaMatch[1] : null,
        isCanonical: false,
        primaryPath: '',
        aliases: [],
      });
    }
  }

  walk(workspaceRoot);
  allEntries.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0));

  // Union entries that share a raw hash or a non-empty normalized-body hash.
  const parent = allEntries.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const firstSeen = new Map();
  allEntries.forEach((entry, i) => {
    for (const key of [entry.rawSha256 && `raw:${entry.rawSha256}`, entry.bodySha256 && `body:${entry.bodySha256}`]) {
      if (!key) continue;
      if (firstSeen.has(key)) parent[find(i)] = find(firstSeen.get(key));
      else firstSeen.set(key, i);
    }
  });
  const groups = new Map();
  allEntries.forEach((entry, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(entry);
  });

  const byHash = new Map();
  const byPath = new Map();
  const canonicalSources = [];
  const aliases = [];

  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        a.relativePath.length - b.relativePath.length ||
        (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0),
    );
    const primary = group[0];
    const groupId = primary.rawSha256 || primary.bodySha256 || primary.relativePath;
    for (const entry of group) entry.sha256 = groupId;
    byHash.set(groupId, group);

    primary.isCanonical = true;
    primary.primaryPath = primary.relativePath;
    canonicalSources.push(primary);
    byPath.set(primary.relativePath, primary);
    byPath.set(primary.sidecarPath, primary);

    for (let i = 1; i < group.length; i++) {
      const alias = group[i];
      alias.primaryPath = primary.relativePath;
      primary.aliases.push(alias.relativePath);
      aliases.push(alias);
      byPath.set(alias.relativePath, alias);
      byPath.set(alias.sidecarPath, alias);
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
 *     sidecarPath: string,
 *     sha256: string,
 *     aliases: string[],
 *   }>,
 *   citedSources: Array<{
 *     path: string,
 *     sidecarPath: string,
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
  const modelsDir = path.join(workspaceRoot, 'kNNowledge');

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
        else if (ent.isFile() && isNNName(ent.name) && !isSidecarName(ent.name)) modelFiles.push(full);
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
          const cit = parseCitation(p);
          if (!cit || cit.kind !== 'source') continue;

          const match = index.byPath.get(cit.filePath);

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
        sidecarPath: canon.sidecarPath,
        sha256: canon.sha256,
        citedByModels: Array.from(modelCitations.get(canon.sha256) || []),
        aliases: canon.aliases,
      });
    } else {
      uncitedSources.push({
        path: canon.relativePath,
        sidecarPath: canon.sidecarPath,
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