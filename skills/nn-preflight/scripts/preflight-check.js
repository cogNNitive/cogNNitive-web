#!/usr/bin/env node

/**
 * skills/nn-preflight/scripts/preflight-check.js
 *
 * Lightweight, zero-dependency environment readiness and integrity auditor
 * for the cogNNitive ecosystem.
 *
 * Checks:
 *   1. Node.js runtime (>= 18 required)
 *   2. Installed skills vs manifest pinned commits (~/.agents/skills/ and bootstrap-state.json)
 *   3. MCP server bundle and version vs manifest pins (~/.agents/mcp/ or .cogNNitive/)
 *   4. Level 2 templates vs manifest pins (~/.agents/templates/)
 *
 * Exit Codes:
 *   0: All components are installed and up-to-date (or non-blocking warning).
 *   1: Components are missing or outdated; user confirmation required before proceeding.
 *   2: Fatal runtime blocker (e.g. Node.js < 18).
 *
 * Flags:
 *   --json          Emit machine-readable JSON output
 *   --manifest-url  Override default manifest URL
 *   --skills-dir    Override ~/.agents/skills directory
 *   --blueprints-dir Override ~/.agents/bluepriNNts directory
 *   --state-file    Override ~/.agents/bootstrap-state.json
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { parseFocusedYaml, parseFrontmatter } = require('./lib/yaml-lite');
const { discoverModels, scanWorkspaceUpgrades } = require('./upgrade-check');
const { isProjectableName, classifyProjection, hashTree } = require('./lib/projection');

const DEFAULT_MANIFEST_URL = process.env.SM_MANIFEST_URL ||
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/docs/use/manifest.md';

const DEFAULT_SKILLS_DIR = path.join(os.homedir(), '.agents', 'skills');
const DEFAULT_BLUEPRINTS_DIR = path.join(os.homedir(), '.agents', 'bluepriNNts');
const DEFAULT_MCP_DIR = path.join(os.homedir(), '.agents', 'mcp');
const DEFAULT_STATE_FILE = path.join(os.homedir(), '.agents', 'bootstrap-state.json');
const LEGACY_STATE_FILE = path.join(os.homedir(), '.agents', 'skills-state.json');

/**
 * Canonical Level-2 template catalog. Wired in as a Tier-3 workspace check:
 * an available template upgrade is informational and never blocks.
 *
 * Resolution is remote-first (AD-3): the Pages copy is canonical
 * (same-origin for the editor), the raw.githubusercontent copy is the
 * fallback. When both fail, upgrade detection degrades to offline.
 */
const DEFAULT_TEMPLATE_CATALOG_URL =
  'https://cognnitive.com/innfo/blueprints/catalog.json';
const FALLBACK_TEMPLATE_CATALOG_URL =
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/catalog.json';

/**
 * Canonical channel freshness summary published by CI on every push to main.
 * Read-only informational signal: reports pin identity, pin age, and commit drift.
 * Single URL, no raw.githubusercontent fallback (file is not committed to git, ADR-004).
 */
const FRESHNESS_URL = process.env.SM_FRESHNESS_URL ||
  'https://cognnitive.com/use/freshness.json';

function formatAge(isoDateStr) {
  if (!isoDateStr) return 'unknown age';
  const tagTime = new Date(isoDateStr).getTime();
  if (Number.isNaN(tagTime)) return 'unknown age';
  const diffMs = Date.now() - tagTime;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return '0 days old';
  if (days === 1) return '1 day old';
  return `${days} days old`;
}

function requestFor(url) {
  return url.startsWith('https:') ? https.request : http.request;
}

function fetchString(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const req = requestFor(url)(url, {
      headers: { 'User-Agent': 'cogNNitive-preflight-auditor' },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} while fetching ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching manifest after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

function loadState(file) {
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, ''));
      return {
        manifest: data.manifest || DEFAULT_MANIFEST_URL,
        skills: data.skills || {},
        blueprints: data.blueprints || {},
        mcp: data.mcp || {},
        projections: data.projections || {},
      };
    } catch {
      // ignore corrupt JSON and return empty
    }
  }

  const siblingLegacy = path.join(path.dirname(file), 'skills-state.json');
  const legacyToUse = fs.existsSync(siblingLegacy) ? siblingLegacy : LEGACY_STATE_FILE;
  if (fs.existsSync(legacyToUse)) {
    try {
      const legacyData = JSON.parse(fs.readFileSync(legacyToUse, 'utf-8').replace(/^\uFEFF/, ''));
      return {
        manifest: legacyData.manifest || DEFAULT_MANIFEST_URL,
        skills: legacyData.skills || {},
        blueprints: {},
        mcp: {},
        projections: {},
      };
    } catch {
      // ignore corrupt JSON
    }
  }

  return { manifest: DEFAULT_MANIFEST_URL, skills: {}, blueprints: {}, mcp: {}, projections: {} };
}

function parseManifest(text) {
  const doc = parseFocusedYaml(parseFrontmatter(text));
  const bootstrap = doc['agent-bootstrap'];
  if (!bootstrap || typeof bootstrap !== 'object') {
    throw new Error('agent-bootstrap block missing from manifest');
  }
  return {
    version: bootstrap.version || 'unknown',
    skills: Array.isArray(bootstrap.skills) ? bootstrap.skills : [],
    blueprints: Array.isArray(bootstrap.blueprints) ? bootstrap.blueprints : [],
    // Exposes the published `console-assets` block so its resolved `ref` can be
    // compared against the freshness JSON's `innfo-console` pin, the same way
    // `skills`/`templates` already are (Defect 1 fix).
    consoleAssets: Array.isArray(bootstrap['console-assets']) ? bootstrap['console-assets'] : [],
  };
}

/* ── Workspace spec freshness scan (--workspace-dir) ───────────────── */

const SPEC_SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.spec-cache', 'backups', 'archive']);

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

/**
 * Split a spec filename into `{ base, version }`. The base drops the `_NN` /
 * `_spec` suffix and the version (`_V_x-y-z`); `version` is `null` when the
 * name carries none (legacy versionless caches).
 */
function specIdentity(fileName) {
  const stem = String(fileName).toLowerCase().replace(/\.(md|markdown)$/, '');
  const [namePart, version] = stem.split('_v_');
  return { base: namePart.replace(/_(nn|spec|f)$/, ''), version: version || null };
}

/**
 * True only when `url` names the very document stored at `filePath` — i.e. the
 * file is a cache OF that URL, not a document that merely references it.
 * `parent_spec.url` names the parent document, so it never qualifies; comparing
 * a specialization against its parent would always report a false `stale`.
 *
 * Identity is the URL basename matching the local filename, a shared base name
 * when exactly one side is versionless (legacy `procedures_NN.md`), or — for
 * the canonical package layout, whose URL basename is the generic `spec_NN.md`
 * (or `spec.md`) — the URL's parent directory matching the local directory.
 */
function urlIdentifiesLocalFile(url, filePath) {
  let segments;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return false;
    segments = parsed.pathname.split('/').filter(Boolean);
  } catch {
    return false;
  }
  const urlName = segments[segments.length - 1] || '';
  const localName = path.basename(filePath);
  if (urlName.toLowerCase() === localName.toLowerCase()) return true;
  if (urlName.toLowerCase() === 'spec_nn.md' || urlName.toLowerCase() === 'spec.md') {
    const urlDir = (segments[segments.length - 2] || '').toLowerCase();
    const localDir = path.basename(path.dirname(filePath)).toLowerCase();
    return urlDir !== '' && urlDir === localDir;
  }
  const a = specIdentity(localName);
  const b = specIdentity(urlName);
  return a.base === b.base && (a.version === null) !== (b.version === null);
}

/** Node native fetch with an AbortController timeout (mirrors `fetchString`). */
async function fetchWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} while fetching ${url}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Recursive `.md` walk of `<workspace>/specs/`, skipping staging and cache dirs. */
function walkSpecs(dir, files) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.staging-')) continue;
      if (SPEC_SKIP_DIRS.has(entry.name)) continue;
      walkSpecs(path.join(dir, entry.name), files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.join(dir, entry.name));
    }
  }
}

/**
 * Content-hash freshness scan of a workspace's `specs/` tree against each
 * file's own canonical URL (`spec_url`). Only files whose `spec_url` names the
 * file itself are compared; `parent_spec.url` is never a comparison URL (it
 * names the parent document, so the hash would always differ). Files without a
 * self-identifying URL are skipped silently; unreachable remotes are recorded
 * as `offline` (warning only, never a blocker).
 */
async function scanWorkspaceSpecs(workspaceDir) {
  const files = [];
  walkSpecs(path.join(workspaceDir, 'specs'), files);

  let stale = 0;
  let fresh = 0;
  let offline = 0;
  const items = [];

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    let fm;
    try {
      fm = parseFocusedYaml(parseFrontmatter(content));
    } catch {
      continue; // no frontmatter → not an iNNfo spec, skip silently
    }
    const url = fm.spec_url;
    if (!url || !urlIdentifiesLocalFile(url, file)) continue;

    const relPath = path.relative(workspaceDir, file).replace(/\\/g, '/');
    const localHash = sha256(content);
    let status;
    let detail;
    try {
      const remote = await fetchWithTimeout(url);
      status = sha256(remote) === localHash ? 'fresh' : 'stale';
    } catch (err) {
      status = 'offline';
      detail = err.message;
    }

    if (status === 'stale') stale++;
    else if (status === 'fresh') fresh++;
    else offline++;

    const item = { type: 'spec-freshness', name: relPath, url, status };
    if (detail) item.detail = detail;
    items.push(item);
  }

  return { stale, fresh, offline, items };
}

/* ── Workspace source integrity scan (--workspace-dir) ─────────────── */

const SOURCE_SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.spec-cache', 'backups', 'archive', 'staging']);

function walkSourceDir(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.startsWith('~$') || entry.name === 'desktop.ini') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.staging-')) continue;
      if (SOURCE_SKIP_DIRS.has(entry.name)) continue;
      walkSourceDir(fullPath, onFile);
    } else if (entry.isFile()) {
      onFile(fullPath, entry.name);
    }
  }
}

/**
 * Universal source integrity audit across sources/import/, sources/conversations/,
 * sources/export/, and legacy sources/original/ against sources/nn/.
 */
function scanWorkspaceSources(workspaceDir) {
  const sourcesDir = path.join(workspaceDir, 'sources');
  const nnDir = path.join(sourcesDir, 'nn');

  const subtrees = {
    import: { total: 0, normalized: 0, unnormalized: 0 },
    export: { total: 0, normalized: 0, unnormalized: 0 },
    conversations: { total: 0, normalized: 0, unnormalized: 0 },
  };

  const unnormalizedList = [];
  const orphanedList = [];
  const items = [];
  let totalCount = 0;
  let normalizedCount = 0;
  let unnormalizedCount = 0;
  let danglingCount = 0;

  const MEDIA_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.flac', '.aac']);

  // 1. Discover all normalized Markdown files in sources/nn/ (excluding index.md)
  const nnFiles = [];
  if (fs.existsSync(nnDir)) {
    walkSourceDir(nnDir, (filePath, name) => {
      if (name.endsWith('.md')) {
        const relToNn = path.relative(nnDir, filePath).replace(/\\/g, '/');
        if (relToNn !== 'index.md') {
          nnFiles.push(filePath);
        }
      }
    });
  }

  // 2. Parse frontmatter and map source_file -> normalized file & hash
  const sourceIndex = new Map();
  const companionMediaIndex = new Map();
  const normalizedStems = new Set();

  for (const nnFile of nnFiles) {
    const relNnPath = path.relative(workspaceDir, nnFile).replace(/\\/g, '/');
    const nnStem = path.basename(nnFile, '.md').toLowerCase();
    normalizedStems.add(nnStem);

    let content;
    try {
      content = fs.readFileSync(nnFile, 'utf-8');
    } catch {
      continue;
    }
    let fm;
    try {
      fm = parseFocusedYaml(parseFrontmatter(content)) || {};
    } catch {
      fm = {};
    }

    const rawRef = fm.source_file || fm.file;
    const storedHash = (fm.sha256 || fm.hash || '').trim();

    if (fm.media_file) {
      const normMedia = String(fm.media_file).replace(/\\/g, '/');
      const mediaEntry = { nnPath: relNnPath, storedHash: (fm.media_sha256 || '').trim(), isCompanionMedia: true };
      sourceIndex.set(normMedia, mediaEntry);
      companionMediaIndex.set(normMedia, mediaEntry);
      const mediaAbs = path.resolve(workspaceDir, normMedia);
      if (fs.existsSync(mediaAbs)) {
        const relMedia = path.relative(workspaceDir, mediaAbs).replace(/\\/g, '/');
        sourceIndex.set(relMedia, mediaEntry);
        companionMediaIndex.set(relMedia, mediaEntry);
      }
    }

    // `user_input` is no longer an authorable source_type in the taxonomy (folded into
    // conversations); this check stays as a defensive legacy read for pre-existing data,
    // and still covers the `inline:`/`chat:` prefixes, which remain valid.
    if (
      fm.source_type === 'user_input' ||
      (rawRef && (String(rawRef).startsWith('inline:') || String(rawRef).startsWith('chat:') || String(rawRef).includes('(proporcionado directamente')))
    ) {
      sourceIndex.set(String(rawRef || relNnPath).replace(/\\/g, '/'), { nnPath: relNnPath, storedHash, isUserInput: true });
      continue;
    }

    if (!rawRef) {
      danglingCount++;
      orphanedList.push({ path: relNnPath, missing_source: 'missing_source_file_field' });
      items.push({
        type: 'source-integrity',
        name: relNnPath,
        status: 'dangling',
        detail: 'Normalized file missing source_file field in frontmatter',
      });
      continue;
    }

    const normRawRef = String(rawRef).replace(/\\/g, '/');
    const candidatePaths = [
      path.resolve(workspaceDir, normRawRef),
      path.resolve(workspaceDir, 'sources', normRawRef),
      path.resolve(path.dirname(nnFile), normRawRef),
    ];

    let resolvedRawPath = null;
    for (const cand of candidatePaths) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        resolvedRawPath = cand;
        break;
      }
    }

    if (!resolvedRawPath) {
      danglingCount++;
      orphanedList.push({ path: relNnPath, missing_source: normRawRef });
      items.push({
        type: 'source-integrity',
        name: relNnPath,
        status: 'dangling',
        detail: `Referenced source file does not exist: ${normRawRef}`,
      });
    } else {
      const relSource = path.relative(workspaceDir, resolvedRawPath).replace(/\\/g, '/');
      const entry = { nnPath: relNnPath, storedHash };
      sourceIndex.set(relSource, entry);
      sourceIndex.set(normRawRef, entry);
    }
  }

  // 3. Scan active source trees (import, conversations, export, original)
  const sourceTreesToCheck = [
    { name: 'import', dir: path.join(sourcesDir, 'import') },
    { name: 'conversations', dir: path.join(sourcesDir, 'conversations') },
    { name: 'export', dir: path.join(sourcesDir, 'export') },
    { name: 'original', dir: path.join(sourcesDir, 'original') },
  ];

  for (const tree of sourceTreesToCheck) {
    if (!fs.existsSync(tree.dir)) continue;

    if (!subtrees[tree.name]) {
      subtrees[tree.name] = { total: 0, normalized: 0, unnormalized: 0 };
    }

    const treeFiles = [];
    walkSourceDir(tree.dir, (filePath) => {
      treeFiles.push(filePath);
    });

    for (const file of treeFiles) {
      const relPath = path.relative(workspaceDir, file).replace(/\\/g, '/');
      const fileExt = path.extname(file).toLowerCase();
      const fileStem = path.basename(file, fileExt).toLowerCase();
      const isMedia = MEDIA_EXTENSIONS.has(fileExt);

      subtrees[tree.name].total++;
      totalCount++;

      let currentHash = null;
      try {
        const buf = fs.readFileSync(file);
        currentHash = crypto.createHash('sha256').update(buf).digest('hex');
      } catch {
        // cannot read file
      }

      const match = sourceIndex.get(relPath);
      if (match) {
        if (!isMedia && match.storedHash && match.storedHash !== currentHash) {
          unnormalizedCount++;
          subtrees[tree.name].unnormalized++;
          unnormalizedList.push({ path: relPath, subtree: tree.name, reason: 'hash_mismatch' });
          items.push({
            type: 'source-integrity',
            name: relPath,
            status: 'stale',
            detail: 'Source content has changed since normalization. Run `node scripts/index.js --scan`.',
          });
        } else {
          normalizedCount++;
          subtrees[tree.name].normalized++;
        }
      } else if (isMedia) {
        // Check if paired with a normalized companion sharing the same stem
        if (companionMediaIndex.has(relPath) || normalizedStems.has(fileStem)) {
          normalizedCount++;
          subtrees[tree.name].normalized++;
        } else {
          // Un-transcribed raw media is informational, non-blocking
          subtrees[tree.name].normalized++;
          normalizedCount++;
          items.push({
            type: 'source-integrity',
            name: relPath,
            status: 'raw-media',
            detail: 'Raw media primary source (pending transcription). Non-blocking.',
          });
        }
      } else {
        unnormalizedCount++;
        subtrees[tree.name].unnormalized++;
        unnormalizedList.push({ path: relPath, subtree: tree.name, reason: 'missing' });
        items.push({
          type: 'source-integrity',
          name: relPath,
          status: 'unnormalized',
          detail: 'Source has not been normalized into sources/nn/. Run `node scripts/index.js --scan`.',
        });
      }
    }
  }

  return {
    total: totalCount,
    normalized: normalizedCount,
    unnormalized: unnormalizedCount,
    dangling: danglingCount,
    sources_integrity: {
      ok: unnormalizedCount === 0 && danglingCount === 0,
      subtrees,
      unnormalized: unnormalizedList,
      orphaned: orphanedList,
    },
    items,
  };
}

/* ── Template Composition & Semantic AST Validator ─────────────────── */

/**
 * Inspects Level 2 blueprint compositions across specs/bluepriNNts and specs/.
 * Evaluates:
 *   1. Resolvability of all `includes:` definitions on disk.
 *   2. Absence of cyclic includes.
 *   3. Absence of colliding/conflicting concept definitions.
 *   4. Resolvability of matrix `source::` and `target::` endpoints within the composed AST.
 *
 * @param {object} options
 * @param {string} [options.workspaceDir]
 * @param {string} [options.blueprintsDir]
 * @returns {{ validCount: number, blockerCount: number, warningCount: number, items: Array<any> }}
 */
function validateTemplateCompositions(options = {}) {
  const { workspaceDir, blueprintsDir } = options;
  const searchDirs = [];

  if (workspaceDir) {
    const wsSpecsTemplates = path.join(workspaceDir, 'specs', 'templates');
    const wsSpecs = path.join(workspaceDir, 'specs');
    if (fs.existsSync(wsSpecsTemplates)) searchDirs.push(wsSpecsTemplates);
    if (fs.existsSync(wsSpecs)) searchDirs.push(wsSpecs);
  } else if (blueprintsDir && fs.existsSync(blueprintsDir)) {
    searchDirs.push(blueprintsDir);
  } else {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const repoSpecsTemplates = path.join(repoRoot, 'specs', 'templates');
    const repoSpecs = path.join(repoRoot, 'specs');
    if (fs.existsSync(repoSpecsTemplates)) searchDirs.push(repoSpecsTemplates);
    if (fs.existsSync(repoSpecs)) searchDirs.push(repoSpecs);
  }

  // Also include resolver fallback search dirs
  const resolverDirs = [...searchDirs];
  const repoRoot = path.resolve(__dirname, '../../../..');
  const repoInnfoSpecsTemplates = path.join(repoRoot, 'iNNfo', 'specs', 'templates');
  const repoSpecsTemplates = path.join(repoRoot, 'specs', 'templates');
  const repoSpecs = path.join(repoRoot, 'specs');
  if (fs.existsSync(repoInnfoSpecsTemplates) && !resolverDirs.includes(repoInnfoSpecsTemplates)) {
    resolverDirs.push(repoInnfoSpecsTemplates);
  }
  if (fs.existsSync(repoSpecsTemplates) && !resolverDirs.includes(repoSpecsTemplates)) {
    resolverDirs.push(repoSpecsTemplates);
  }
  if (fs.existsSync(repoSpecs) && !resolverDirs.includes(repoSpecs)) {
    resolverDirs.push(repoSpecs);
  }

  const templateFiles = new Map();

  function walkTemplates(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ent.name.startsWith('.') || SPEC_SKIP_DIRS.has(ent.name)) continue;
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walkTemplates(fullPath);
      } else if (ent.isFile() && ent.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          let fm = {};
          try {
            fm = parseFocusedYaml(parseFrontmatter(content)) || {};
          } catch {}
          // Note: fm.level here is always a string — this file parses with
          // ./lib/yaml-lite, a separate parser from innfo-core's
          // parseFrontmatter, whose parseScalar never coerces to a number
          // (design ADR-007). The numeric comparisons removed here were dead.
          if (fm.level === '1') continue;
          if (fm.level === '2' || fm.type === 'template' || Array.isArray(fm.includes) || fullPath.includes('templates')) {
            templateFiles.set(fullPath, { name: ent.name, content, fm });
          }
        } catch {}
      }
    }
  }

  for (const d of searchDirs) {
    walkTemplates(d);
  }

  const results = {
    validCount: 0,
    blockerCount: 0,
    warningCount: 0,
    items: [],
  };

  if (templateFiles.size === 0) {
    return results;
  }

  function resolveIncludeFile(incName, parentFilePath) {
    const rawName = typeof incName === 'object' && incName !== null ? (incName.name || incName.path || '') : String(incName);
    const cleanName = rawName.replace(/\\/g, '/');
    const slug = path.basename(cleanName, '.md').toLowerCase().replace(/[\s_]+/g, '-');
    const baseName = path.basename(cleanName, '.md');

    const parentDir = path.dirname(parentFilePath);
    const candidates = [
      path.resolve(parentDir, cleanName),
      path.resolve(parentDir, `${cleanName}.md`),
      path.resolve(parentDir, `${cleanName}_NN.md`),
      path.resolve(parentDir, cleanName, 'spec_NN.md'),
      path.resolve(parentDir, cleanName, `${baseName}_NN.md`),
      path.resolve(parentDir, slug, 'spec_NN.md'),
      path.resolve(parentDir, slug, `${slug}_NN.md`),
    ];

    for (const searchDir of resolverDirs) {
      candidates.push(
        path.join(searchDir, cleanName),
        path.join(searchDir, `${cleanName}.md`),
        path.join(searchDir, `${cleanName}_NN.md`),
        path.join(searchDir, cleanName, 'spec_NN.md'),
        path.join(searchDir, cleanName, `${baseName}_NN.md`),
        path.join(searchDir, slug, 'spec_NN.md'),
        path.join(searchDir, slug, `${slug}_NN.md`)
      );
    }

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand;
      }
    }

    for (const [absPath, info] of templateFiles.entries()) {
      const stem = path.basename(absPath, '.md').toLowerCase().replace(/_nn$/, '').replace(/[\s_]+/g, '-');
      const folder = path.basename(path.dirname(absPath)).toLowerCase().replace(/[\s_]+/g, '-');
      if (stem === slug || folder === slug || info.name === cleanName || info.name === `${cleanName}.md`) {
        return absPath;
      }
    }

    return null;
  }

  function extractConceptsAndMatrices(content) {
    const concepts = new Set();
    const matrices = [];

    const indexMatch = content.match(/# NN index\b([\s\S]*?)(?=\n# NN |\n# [^#]|$)/i);
    if (indexMatch) {
      const itemMatches = indexMatch[1].matchAll(/\*\s*\[\[(.*?)\]\]/g);
      for (const m of itemMatches) {
        const c = m[1].trim();
        if (c) concepts.add(c);
      }
    }

    const conceptDefMatches = content.matchAll(/## NN Concept Definition:\s*(.+?)(?:\r?\n|$)/gi);
    for (const m of conceptDefMatches) {
      const c = m[1].trim();
      if (c) concepts.add(c);
    }

    const sectionMatches = content.matchAll(/^# NN (?!index|Matrix|Field|Marker|Relation|Procedure|Procedures|Sources|Models|Artifacts|Concept Definition|Actions)(.+?)(?:\r?\n|$)/gim);
    for (const m of sectionMatches) {
      const c = m[1].trim();
      if (c) concepts.add(c);
    }

    const matrixBlocks = content.split(/## NN Matrix Definition:\s*/i);
    for (let i = 1; i < matrixBlocks.length; i++) {
      const block = matrixBlocks[i];
      const name = block.split(/\r?\n/)[0].trim();
      const sourceMatch = block.match(/^\s*source::\s*(.+?)\s*$/m);
      const targetMatch = block.match(/^\s*target::\s*(.+?)\s*$/m);
      if (sourceMatch && targetMatch) {
        matrices.push({
          name,
          source: sourceMatch[1].trim(),
          target: targetMatch[1].trim(),
        });
      }
    }

    return { concepts, matrices };
  }

  for (const [absPath, tmplInfo] of templateFiles.entries()) {
    const relName = workspaceDir ? path.relative(workspaceDir, absPath).replace(/\\/g, '/') : path.basename(absPath);
    const fm = tmplInfo.fm;
    const includes = Array.isArray(fm.includes) ? fm.includes : [];

    const rootData = extractConceptsAndMatrices(tmplInfo.content);
    const composedConcepts = new Map();
    for (const c of rootData.concepts) {
      composedConcepts.set(c.toLowerCase(), { originalName: c, sourceFile: relName });
    }

    const allMatrices = [...rootData.matrices];
    let hasBlocker = false;
    let hasWarning = false;
    const blockerDetails = [];
    const warningDetails = [];

    const queue = includes.map((inc) => ({ inc, chain: [absPath] }));

    while (queue.length > 0) {
      const { inc, chain } = queue.shift();
      const incPath = resolveIncludeFile(inc, chain[chain.length - 1]);
      const incLabel = typeof inc === 'object' && inc !== null ? inc.name : String(inc);

      if (!incPath) {
        hasBlocker = true;
        blockerDetails.push(`Unresolved include "${incLabel}"`);
        continue;
      }

      if (chain.includes(incPath)) {
        hasBlocker = true;
        blockerDetails.push(`Cyclic include detected: ${[...chain, incPath].map((p) => path.basename(p)).join(' -> ')}`);
        continue;
      }

      let subContent;
      try {
        subContent = fs.readFileSync(incPath, 'utf8');
      } catch {
        hasBlocker = true;
        blockerDetails.push(`Cannot read included template "${incLabel}" at "${incPath}"`);
        continue;
      }

      const subData = extractConceptsAndMatrices(subContent);
      const subRelName = workspaceDir ? path.relative(workspaceDir, incPath).replace(/\\/g, '/') : path.basename(incPath);

      for (const c of subData.concepts) {
        const key = c.toLowerCase();
        const existing = composedConcepts.get(key);
        if (existing && existing.sourceFile !== subRelName && existing.sourceFile !== relName) {
          hasWarning = true;
          warningDetails.push(`Concept collision: "${c}" is defined in both "${existing.sourceFile}" and "${subRelName}"`);
        } else if (!existing) {
          composedConcepts.set(key, { originalName: c, sourceFile: subRelName });
        }
      }

      allMatrices.push(...subData.matrices);

      let subFm = {};
      try {
        subFm = parseFocusedYaml(parseFrontmatter(subContent)) || {};
      } catch {}
      if (Array.isArray(subFm.includes)) {
        for (const nextInc of subFm.includes) {
          queue.push({ inc: nextInc, chain: [...chain, incPath] });
        }
      }
    }

    for (const mat of allMatrices) {
      const srcKey = mat.source.toLowerCase();
      const tgtKey = mat.target.toLowerCase();
      const hasSrc = composedConcepts.has(srcKey);
      const hasTgt = composedConcepts.has(tgtKey);

      if (!hasSrc || !hasTgt) {
        hasBlocker = true;
        const missing = [];
        if (!hasSrc) missing.push(`source "${mat.source}"`);
        if (!hasTgt) missing.push(`target "${mat.target}"`);
        blockerDetails.push(`Matrix "${mat.name}" references unresolvable ${missing.join(' and ')}`);
      }
    }

    if (hasBlocker) {
      results.blockerCount++;
      results.items.push({
        type: 'template-composition',
        name: relName,
        status: 'blocker',
        detail: blockerDetails.join('; '),
      });
    } else if (hasWarning) {
      results.warningCount++;
      results.items.push({
        type: 'template-composition',
        name: relName,
        status: 'warning',
        detail: warningDetails.join('; '),
      });
    } else {
      results.validCount++;
      results.items.push({
        type: 'template-composition',
        name: relName,
        status: 'ok',
        detail: `Valid composition (${composedConcepts.size} concepts, ${allMatrices.length} matrices)`,
      });
    }
  }

  return results;
}

/**
 * Audits recorded AI agent skill projections against canonical skills on disk.
 * @param {Record<string, any>} state - Loaded bootstrap-state.json object.
 * @param {string} skillsDir - Canonical skills directory.
 * @param {string} [homedir] - Optional home directory override for testing.
 * @returns {{ total: number, inSync: number, drift: number, items: Array<any> }}
 */
function auditSkillProjections(state, skillsDir, homedir = os.homedir()) {
  const items = [];
  let total = 0;
  let inSync = 0;
  let drift = 0;

  const projections = state.projections || {};
  for (const [agent, agentEntry] of Object.entries(projections)) {
    if (!agentEntry || typeof agentEntry !== 'object') continue;
    const skills = agentEntry.skills || {};

    for (const [skillName, proj] of Object.entries(skills)) {
      if (!proj || typeof proj !== 'object') continue;
      total++;
      const canonicalSrc = path.resolve(proj.source || path.join(skillsDir, skillName));
      const targetDir = agentEntry.dir || (
        agent === 'opencode' ? path.join(homedir, '.config', 'opencode', 'skills') :
        agent === 'claude' ? path.join(homedir, '.claude', 'skills') :
        agent === 'antigravity' ? path.join(homedir, '.gemini', 'config', 'skills') :
        path.join(homedir, `.${agent}`, 'skills')
      );
      const dest = path.resolve(targetDir, skillName);

      const classification = classifyProjection(dest, canonicalSrc);
      let status = 'in-sync';
      let detail = 'In sync with canonical.';

      if (classification === 'absent') {
        status = 'missing';
        detail = 'Projected skill directory or link does not exist.';
      } else if (classification === 'link-dangling') {
        status = 'dangling';
        detail = 'Projected symlink points to non-existent target.';
      } else if (classification === 'link-wrong') {
        status = 'wrong-target';
        detail = 'Projected symlink points to unexpected target.';
      } else if (classification === 'link-ok') {
        status = 'in-sync';
        detail = 'Symlink projection in sync with canonical.';
      } else if (classification === 'dir') {
        if (proj.method === 'copy') {
          const srcHash = hashTree(canonicalSrc, isProjectableName);
          const destHash = hashTree(dest, isProjectableName);
          if (srcHash && destHash && srcHash === destHash) {
            status = 'in-sync';
            detail = 'Mirror copy projection in sync with canonical.';
          } else {
            status = 'stale';
            detail = 'Projected copy content has drifted from canonical.';
          }
        } else {
          status = 'stale';
          detail = 'Expected symlink projection but found unlinked directory.';
        }
      }

      if (status === 'in-sync') {
        inSync++;
      } else {
        drift++;
      }

      items.push({
        type: 'skill-projection',
        name: `${agent}/${skillName}`,
        agent,
        skill: skillName,
        method: proj.method,
        status,
        detail,
        dest,
        source: canonicalSrc,
      });
    }
  }

  return { total, inSync, drift, items };
}

async function runCheck(options = {}) {
  const isJson = options.json || process.argv.includes('--json');
  const manifestUrl = options.manifestUrl || process.env.SM_MANIFEST_URL || DEFAULT_MANIFEST_URL;
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
  const blueprintsDir = options.blueprintsDir || DEFAULT_BLUEPRINTS_DIR;
  const mcpDir = options.mcpDir || DEFAULT_MCP_DIR;
  const stateFile = options.stateFile || DEFAULT_STATE_FILE;
  const workspaceDir = options.workspaceDir || null;
  const templateCatalogUrl = options.templateCatalogUrl || null;

  const results = {
    timestamp: new Date().toISOString(),
    status: 'OK',
    exitCode: 0,
    node: {
      version: process.versions.node,
      major: parseInt(process.versions.node.split('.')[0], 10),
      ok: true,
    },
    manifest: {
      url: manifestUrl,
      reachable: true,
      error: null,
    },
    summary: {
      skillsTotal: 0,
      skillsOutdated: 0,
      skillsMissing: 0,
      mcpTotal: 0,
      mcpOutdated: 0,
      mcpMissing: 0,
      templatesTotal: 0,
      templatesOutdated: 0,
      templatesMissing: 0,
      specsStale: 0,
      specsFresh: 0,
      specsOffline: 0,
      sourcesTotal: 0,
      sourcesNormalized: 0,
      sourcesUnnormalized: 0,
      sourcesDangling: 0,
      templateModelsScanned: 0,
      templateUpgradesAvailable: 0,
      templateModelsCurrent: 0,
      templateModelsAhead: 0,
      templateModelsUnlisted: 0,
      templateModelsUnpinned: 0,
      templateCatalogOffline: 0,
      templatesCompositionValid: 0,
      templatesCompositionBlockers: 0,
      templatesCompositionWarnings: 0,
      projectionsTotal: 0,
      projectionsInSync: 0,
      projectionsDrift: 0,
    },
    sources_integrity: {
      ok: true,
      subtrees: {
        import: { total: 0, normalized: 0, unnormalized: 0 },
        export: { total: 0, normalized: 0, unnormalized: 0 },
        conversations: { total: 0, normalized: 0, unnormalized: 0 },
      },
      unnormalized: [],
      orphaned: [],
    },
    freshnessLines: [],
    items: [],
  };

  // 1. Node.js check
  if (results.node.major < 18) {
    results.node.ok = false;
    results.status = 'BLOCKER';
    results.exitCode = 2;
    results.items.push({
      type: 'runtime',
      name: 'node',
      status: 'blocker',
      detail: `Node.js >= 18 required, detected v${process.versions.node}`,
    });
    return results;
  }

  // 1b. Workspace scans (opt-in via --workspace-dir). Runs
  // before the manifest fetch so the manifest-offline early return below can
  // still fold staleness or unnormalized sources into ACTION_REQUIRED / exit 1.
  if (workspaceDir) {
    const specResults = await scanWorkspaceSpecs(workspaceDir);
    results.summary.specsStale = specResults.stale;
    results.summary.specsFresh = specResults.fresh;
    results.summary.specsOffline = specResults.offline;
    results.items.push(...specResults.items);

    const sourceResults = scanWorkspaceSources(workspaceDir);
    results.summary.sourcesTotal = sourceResults.total;
    results.summary.sourcesNormalized = sourceResults.normalized;
    results.summary.sourcesUnnormalized = sourceResults.unnormalized;
    results.summary.sourcesDangling = sourceResults.dangling;
    results.sources_integrity = sourceResults.sources_integrity;
    results.items.push(...sourceResults.items);

    // Tier 3 — workspace template upgrade detection (read-only, informational).
    // Only queries the catalog when the workspace actually contains Level-3 models.
    if (discoverModels(workspaceDir).length > 0) {
      const catalogUrls = options.templateCatalogUrl
        ? [options.templateCatalogUrl]
        : [DEFAULT_TEMPLATE_CATALOG_URL, FALLBACK_TEMPLATE_CATALOG_URL];
      let catalog = null;
      for (const catalogUrl of catalogUrls) {
        try {
          catalog = JSON.parse(await fetchWithTimeout(catalogUrl, 4000));
          break;
        } catch {
          // try the next catalog URL
        }
      }
      if (!catalog) {
        results.summary.templateCatalogOffline = 1;
        results.items.push({
          type: 'template-catalog',
          name: 'catalog.json',
          status: 'offline',
          detail: `Template catalog unreachable (${catalogUrls.join(' / ')}); upgrade detection skipped.`,
        });
      }
      if (catalog) {
        const upgrade = scanWorkspaceUpgrades(workspaceDir, catalog);
        results.summary.templateModelsScanned = upgrade.summary.modelsScanned;
        results.summary.templateUpgradesAvailable = upgrade.summary.upgradeAvailable;
        results.summary.templateModelsCurrent = upgrade.summary.current;
        results.summary.templateModelsAhead = upgrade.summary.ahead;
        results.summary.templateModelsUnlisted = upgrade.summary.unlisted;
        results.summary.templateModelsUnpinned = upgrade.summary.unpinned;
        results.items.push(...upgrade.items);
      }
    }
  }

  const state = loadState(stateFile);

  // 1c. Audit skill projections recorded in state (runs offline before manifest fetch)
  const projAudit = auditSkillProjections(state, skillsDir, options.homedir);
  results.summary.projectionsTotal = projAudit.total;
  results.summary.projectionsInSync = projAudit.inSync;
  results.summary.projectionsDrift = projAudit.drift;
  results.items.push(...projAudit.items);

  // 2. Fetch Manifest
  let manifest;
  try {
    const raw = await fetchString(manifestUrl);
    manifest = parseManifest(raw);
  } catch (err) {
    results.manifest.reachable = false;
    results.manifest.error = err.message;
    results.items.push({
      type: 'network',
      name: 'manifest',
      status: 'warning',
      detail: `Could not verify remote manifest (${err.message}). Using local state offline.`,
    });
    // Offline mode: do not block if local files exist — but stale workspace
    // specs, unnormalized sources, or projection drift are still a hard failure and must not be masked by the early return.
    if (results.summary.specsStale > 0 || results.summary.sourcesUnnormalized > 0 || results.summary.sourcesDangling > 0 || results.summary.projectionsDrift > 0) {
      results.status = 'ACTION_REQUIRED';
      results.exitCode = 1;
    }
    return results;
  }

  // 2b. Fetch Freshness (informational only, non-blocking, silent on any failure, ADR-004/ADR-005)
  const targetFreshnessUrl = options.freshnessUrl || FRESHNESS_URL;
  let freshnessData = null;
  try {
    const rawFreshness = await fetchWithTimeout(targetFreshnessUrl, 4000);
    freshnessData = JSON.parse(rawFreshness);
  } catch {
    // Silent omission on any error / timeout / invalid JSON (ADR-005)
  }

  if (freshnessData && freshnessData.subsystems && typeof freshnessData.subsystems === 'object') {
    const innfoMcpSkill = manifest.skills.find(s => Array.isArray(s.mcp) && s.mcp.some(m => m && m.name === 'innfo-mcp'));
    const innfoMcpEntry = innfoMcpSkill ? innfoMcpSkill.mcp.find(m => m && m.name === 'innfo-mcp') : null;
    const innfoConsoleEntry = manifest.consoleAssets.find(a => a && a.ref);

    // Fallback path label shown only when a subsystem reports no touched files
    // (e.g. zero drift), per the published tracked-subsystem prefixes.
    const SUBSYSTEM_PATH_LABELS = {
      skills: 'skills/',
      templates: 'iNNfo/specs/bluepriNNts/',
      'innfo-mcp': 'iNNfo/packages/innfo-mcp/',
      'innfo-console': 'iNNfo/specs/bluepriNNts/console/',
    };
    const MAX_FILES_SHOWN = 3;

    const targets = [
      { key: 'skills', manifestRef: (manifest.skills.find(s => s && s.ref) || {}).ref },
      { key: 'templates', manifestRef: (manifest.blueprints.find(t => t && t.ref) || {}).ref },
      { key: 'innfo-mcp', manifestRef: innfoMcpEntry ? innfoMcpEntry.ref : undefined },
      { key: 'innfo-console', manifestRef: innfoConsoleEntry ? innfoConsoleEntry.ref : undefined },
    ];
    for (const { key, manifestRef } of targets) {
      const entry = freshnessData.subsystems[key];
      if (
        entry &&
        manifestRef &&
        entry.pinnedTag === manifestRef &&
        typeof entry.commitsSincePin === 'number'
      ) {
        const age = formatAge(entry.pinnedTagDate);
        const filesTouched = Array.isArray(entry.filesTouched) ? entry.filesTouched : [];
        let filesDisplay;
        if (filesTouched.length === 0) {
          filesDisplay = SUBSYSTEM_PATH_LABELS[key] || key;
        } else if (filesTouched.length <= MAX_FILES_SHOWN) {
          filesDisplay = filesTouched.join(', ');
        } else {
          const shown = filesTouched.slice(0, MAX_FILES_SHOWN).join(', ');
          filesDisplay = `${shown}, and ${filesTouched.length - MAX_FILES_SHOWN} more`;
        }
        results.freshnessLines.push(
          `ℹ️  Channel freshness: ${key} pinned to ${entry.pinnedTag} (${age}); main has ${entry.commitsSincePin} later commit(s) touching ${filesDisplay} — informational, not a blocker.`
        );
      }
    }
  }

  // 3. Audit Skills & declared MCPs
  for (const skill of manifest.skills) {
    results.summary.skillsTotal++;
    const skillDir = path.join(skillsDir, skill.name);
    const dirExists = fs.existsSync(skillDir);
    const recorded = state.skills[skill.name];
    let skillStatus = 'up-to-date';

    if (!dirExists) {
      skillStatus = 'missing';
      results.summary.skillsMissing++;
    } else if (!recorded || recorded.commit !== skill.commit) {
      skillStatus = 'outdated';
      results.summary.skillsOutdated++;
    }

    if (dirExists) {
      const pkgPath = path.join(skillDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const nodeModulesDir = path.join(skillDir, 'node_modules');
          const hasNodeModules = fs.existsSync(nodeModulesDir);
          const deps = Object.keys(pkg.dependencies || {});
          const missingDeps = [];
          if (!hasNodeModules) {
            missingDeps.push(...deps);
          } else {
            for (const dep of deps) {
              if (!fs.existsSync(path.join(nodeModulesDir, dep))) {
                missingDeps.push(dep);
              }
            }
          }
          if (missingDeps.length > 0) {
            results.summary.skillsDependenciesMissing = (results.summary.skillsDependenciesMissing || 0) + 1;
            results.items.push({
              type: 'skill-dependency',
              name: skill.name,
              status: 'missing',
              detail: `Missing npm dependencies (${missingDeps.join(', ')}) in skill "${skill.name}". Run: cd "${skillDir}" && npm install`,
            });
          }
        } catch {
          // ignore malformed package.json
        }
      }
    }

    results.items.push({
      type: 'skill',
      name: skill.name,
      version: skill.version,
      installedCommit: recorded ? recorded.commit.slice(0, 7) : null,
      pinnedCommit: skill.commit ? skill.commit.slice(0, 7) : null,
      status: skillStatus,
    });

    // Audit MCP declared inside skill
    if (Array.isArray(skill.mcp)) {
      for (const mcp of skill.mcp) {
        results.summary.mcpTotal++;
        const bundlePath = path.join(mcpDir, `${mcp.name}.bundle.js`);
        const localRepoBundle = path.join(process.cwd(), '.cogNNitive', 'mcp-bundle.js');
        const bundleExists = fs.existsSync(bundlePath) || fs.existsSync(localRepoBundle);
        const recordedMcp = state.mcp[mcp.name];
        let mcpStatus = 'up-to-date';

        if (!bundleExists) {
          mcpStatus = 'missing';
          results.summary.mcpMissing++;
        } else if (mcp.version && recordedMcp && recordedMcp.version && recordedMcp.version !== mcp.version) {
          mcpStatus = 'outdated';
          results.summary.mcpOutdated++;
        }

        results.items.push({
          type: 'mcp',
          name: mcp.name,
          version: mcp.version,
          installedVersion: recordedMcp ? recordedMcp.version : (bundleExists ? 'local-bundle' : null),
          status: mcpStatus,
        });
      }
    }
  }

  // 4. Audit Templates
  for (const tmpl of manifest.blueprints) {
    results.summary.templatesTotal++;
    const fileName = tmpl.name.endsWith('.md') ? tmpl.name : `${tmpl.name}.md`;
    const tmplPath = path.join(blueprintsDir, fileName);
    const tmplExists = fs.existsSync(tmplPath) || fs.existsSync(path.join(blueprintsDir, tmpl.name));
    const recorded = state.blueprints[tmpl.name];
    let tmplStatus = 'up-to-date';

    if (!tmplExists) {
      tmplStatus = 'missing';
      results.summary.templatesMissing++;
    } else if (!recorded || recorded.commit !== tmpl.commit) {
      tmplStatus = 'outdated';
      results.summary.templatesOutdated++;
    }

    results.items.push({
      type: 'template',
      name: tmpl.name,
      version: tmpl.version,
      installedCommit: recorded ? recorded.commit.slice(0, 7) : null,
      pinnedCommit: tmpl.commit ? tmpl.commit.slice(0, 7) : null,
      status: tmplStatus,
    });
  }

  // 5. Template Composition Integrity Validation
  const compositionResults = validateTemplateCompositions({
    workspaceDir,
    blueprintsDir,
  });
  results.summary.templatesCompositionValid = compositionResults.validCount;
  results.summary.templatesCompositionBlockers = compositionResults.blockerCount;
  results.summary.templatesCompositionWarnings = compositionResults.warningCount;
  results.items.push(...compositionResults.items);

  const hasSkillDeps = (results.summary.skillsDependenciesMissing || 0) > 0;
  const hasOutdated = results.summary.skillsOutdated > 0 ||
                      results.summary.mcpOutdated > 0 ||
                      results.summary.templatesOutdated > 0;
  const hasMissing = results.summary.skillsMissing > 0 ||
                     results.summary.mcpMissing > 0 ||
                     results.summary.templatesMissing > 0 ||
                     hasSkillDeps;
  const hasStaleSpecs = results.summary.specsStale > 0;
  const hasSourceIssues = results.summary.sourcesUnnormalized > 0 ||
                          results.summary.sourcesDangling > 0;
  const hasCompositionBlockers = results.summary.templatesCompositionBlockers > 0;
  const hasProjectionDrift = (results.summary.projectionsDrift || 0) > 0;

  if (hasOutdated || hasMissing || hasStaleSpecs || hasSourceIssues || hasCompositionBlockers || hasProjectionDrift) {
    results.status = 'ACTION_REQUIRED';
    results.exitCode = 1;
  } else {
    results.status = 'OK';
    results.exitCode = 0;
  }

  return results;
}

function printHumanReport(results) {
  console.log('=== cogNNitive Environment & Integrity Gate ===');
  console.log(`Node.js: v${results.node.version} (${results.node.ok ? 'OK' : 'BLOCKER'})`);

  if (results.summary.skillsDependenciesMissing > 0) {
    console.log(`\n⚠️  Missing skill dependencies detected:`);
    for (const item of results.items) {
      if (item.type === 'skill-dependency' && item.status === 'missing') {
        console.log(`  - [DEPENDENCY] ${item.name}`);
        console.log(`    ${item.detail}`);
      }
    }
    console.log('');
  }

  if (results.summary.specsStale > 0) {
    console.log(`\n⚠️  Stale workspace spec(s) detected (${results.summary.specsStale}):`);
    for (const item of results.items) {
      if (item.type === 'spec-freshness' && item.status === 'stale') {
        console.log(`  - [STALE] ${item.name}`);
        console.log(`    canonical: ${item.url}`);
      }
    }
    console.log('  Remediation: rehydrate the local copy from its canonical URL (e.g. run check_workspace). Do NOT hand-delete or hand-edit files under specs/.\n');
  }

  if (results.summary.projectionsDrift > 0) {
    console.log(`\n⚠️  Skill projection drift detected (${results.summary.projectionsDrift}):`);
    for (const item of results.items) {
      if (item.type === 'skill-projection' && item.status !== 'in-sync') {
        console.log(`  - [${item.status.toUpperCase()}] ${item.name}`);
        console.log(`    ${item.detail}`);
      }
    }
    console.log('  Remediation: run `node scripts/skills-manager.js update` to synchronize projections.\n');
  }

  if (results.summary.sourcesUnnormalized > 0 || results.summary.sourcesDangling > 0) {
    console.log(`\n⚠️  Workspace source integrity issue(s) detected:`);
    for (const item of results.items) {
      if (item.type === 'source-integrity') {
        if (item.status === 'unnormalized') {
          console.log(`  - [UNNORMALIZED] ${item.name}`);
          console.log(`    ${item.detail || 'Source has not been normalized into sources/nn/.'}`);
        } else if (item.status === 'stale') {
          console.log(`  - [STALE] ${item.name}`);
          console.log(`    ${item.detail || 'Source content has changed since normalization.'}`);
        } else if (item.status === 'dangling') {
          console.log(`  - [DANGLING] ${item.name}`);
          console.log(`    ${item.detail || 'Normalized source references missing file.'}`);
        }
      }
    }
    console.log('  Remediation: Run `node scripts/index.js --scan` (nn-trannsform --scan) to synchronize sources.\n');
  }

  if (results.summary.templatesCompositionBlockers > 0 || results.summary.templatesCompositionWarnings > 0) {
    console.log(`\n⚠️  Template composition issue(s) detected (${results.summary.templatesCompositionBlockers} blocker(s), ${results.summary.templatesCompositionWarnings} warning(s)):`);
    for (const item of results.items) {
      if (item.type === 'template-composition' && (item.status === 'blocker' || item.status === 'warning')) {
        console.log(`  - [${item.status.toUpperCase()}] ${item.name}`);
        console.log(`    ${item.detail}`);
      }
    }
    console.log('  Remediation: Resolve template concept collisions or broken matrix endpoints in specs/.\n');
  } else if (results.summary.templatesCompositionValid > 0) {
    console.log(`✨ Template Composition: OK (${results.summary.templatesCompositionValid} templates valid)`);
  }

  if (results.summary.templateUpgradesAvailable > 0) {
    console.log(`\n🆙  Workspace template upgrade(s) available (${results.summary.templateUpgradesAvailable}):`);
    for (const item of results.items) {
      if (item.type === 'template-upgrade' && item.status === 'upgrade-available') {
        console.log(`  - ${item.name}: ${item.template} ${item.pinned} -> ${item.adopted} (${item.kind})`);
      }
    }
    console.log('  Invoke the nn-upgrade skill to migrate with backup and re-validation (or continue as-is).\n');
  }

  if (results.summary.templateCatalogOffline > 0) {
    console.log('ℹ️  Template catalog offline — workspace template upgrade detection skipped (non-blocking).\n');
  }

  if (results.freshnessLines && results.freshnessLines.length > 0) {
    for (const line of results.freshnessLines) {
      console.log(line);
    }
    console.log('');
  }

  if (!results.manifest.reachable) {
    console.log(`⚠️  Remote manifest unreachable: ${results.manifest.error}`);
    console.log('Operating in offline cache mode.\n');
    return;
  }

  if (results.status === 'OK') {
    let msg = `Status: OK — All ${results.summary.skillsTotal} skills, ${results.summary.mcpTotal} MCP servers, and ${results.summary.templatesTotal} templates are up-to-date.`;
    if (results.summary.templatesCompositionValid > 0) {
      msg += ` All ${results.summary.templatesCompositionValid} template compositions verified.`;
    }
    if (results.summary.sourcesTotal > 0) {
      msg += ` All ${results.summary.sourcesTotal} sources normalized and verified.`;
    }
    console.log(`${msg}\n`);
    return;
  }

  console.log(`Status: ⚠️  UPDATES OR MISSING COMPONENTS DETECTED\n`);

  const pending = results.items.filter(i =>
    i.status === 'outdated' ||
    i.status === 'missing' ||
    i.status === 'stale' ||
    i.status === 'unnormalized' ||
    i.status === 'dangling' ||
    i.status === 'wrong-target' ||
    (i.type === 'template-composition' && i.status === 'blocker') ||
    (i.type === 'skill-projection' && i.status !== 'in-sync')
  );
  console.log('Detected items needing attention:');
  for (const item of pending) {
    let detail;
    if (item.type === 'source-integrity' || item.type === 'template-composition') {
      detail = item.detail ? `(${item.detail})` : `(${item.status})`;
    } else if (item.status === 'outdated') {
      detail = `(installed: ${item.installedCommit || item.installedVersion || 'unknown'} -> pinned: ${item.pinnedCommit || item.version})`;
    } else {
      detail = '(not installed)';
    }
    console.log(`  - [${item.status.toUpperCase()}] ${item.type} "${item.name}" ${detail}`);
  }

  console.log('\nDecision needed before continuing:');
  console.log('  [a] (Recommended) Update components now');
  console.log('  [b] Continue with current version\n');
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

async function main() {
  const isJson = process.argv.includes('--json');
  const manifestUrl = getArg('--manifest-url');
  const skillsDir = getArg('--skills-dir');
  const blueprintsDir = getArg('--blueprints-dir');
  const mcpDir = getArg('--mcp-dir');
  const stateFile = getArg('--state-file');
  const workspaceDir = getArg('--workspace-dir');
  const templateCatalogUrl = getArg('--template-catalog-url');
  const freshnessUrl = getArg('--freshness-url');

  try {
    const results = await runCheck({
      json: isJson,
      manifestUrl,
      skillsDir,
      blueprintsDir,
      mcpDir,
      stateFile,
      workspaceDir,
      templateCatalogUrl,
      freshnessUrl,
    });
    if (isJson) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printHumanReport(results);
    }
    process.exit(results.exitCode);
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'ERROR', error: err.message, exitCode: 2 }));
    } else {
      console.error(`Preflight error: ${err.message}`);
    }
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runCheck,
  parseManifest,
  loadState,
  scanWorkspaceSources,
  validateTemplateCompositions,
  FRESHNESS_URL,
  formatAge,
};
