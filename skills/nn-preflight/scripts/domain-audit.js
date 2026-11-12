/**
 * skills/nn-preflight/scripts/domain-audit.js
 *
 * Read-only domaiNN audit for preflight (--workspace-dir), independent of the
 * `kNNowledge/` folder and of the template catalog (#611):
 *
 *   1. Models are found wherever the domaiNN keeps them: the documents the
 *      naming contract recognizes as models, every path the manifest
 *      (`domaiNN_NN.md`) registers, and every `_NN.md` document sitting in a
 *      directory a distributed concept's `placement::` rule points to (read from
 *      the installed bluepriNNt). A registered path with no file, or a placed
 *      document whose frontmatter is not a Level-3 model, is `invalid`.
 *   2. Engine drift: a bluepriNNt installed under `blueprintsDir` whose
 *      `blueprint_version` is older than the one the documents declare is
 *      `behind`, with the exact install command.
 *   3. Unsynced manifest: models that exist but the manifest does not register
 *      produce one `warning`.
 *
 * Discovery reuses `readNNDocuments` (lineage-audit) and the naming contract
 * bundled from nn-core (`isModelCandidate`, `blueprintNameOf`); version order is
 * nn-core's `compareVersions`.
 */

const fs = require('fs');
const path = require('path');
const { parseFocusedYaml, parseFrontmatter } = require('./lib/yaml-lite');
const { readNNDocuments } = require('./lineage-audit');
const { compareVersions } = /** @type {any} */ (require('./lib/version-status.generated.cjs'));
const { isModelCandidate, blueprintNameOf, ENTRYPOINT_FILENAME } = /** @type {any} */ (
  require('./lib/naming-contract.generated.cjs')
);

const SKILLS_MANAGER = 'node ~/.agents/skills/nn-skills-lifecycle/scripts/skills-manager.js';

/** The exact command that installs (or reinstalls) a catalog bluepriNNt. */
function installCommand(name) {
  return `${SKILLS_MANAGER} install --blueprint ${name} --yes`;
}

const VERSION_RE = /^V_\d+-\d+-\d+$/i;
const NAME_VERSION_RE = /_(V_\d+-\d+-\d+)$/i;

/** @param {string} p */
function normalizeRel(p) {
  return String(p).trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * `path::` values of the active `## NN kNNowledge:` (or legacy `## NN Models:`)
 * entries of the manifest's `# NN kNNowledge` section. Same section grammar as
 * nn-core `reconcileManifest`.
 * @param {string} text
 * @returns {string[]}
 */
function registeredPaths(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^#\s+NN\s+(?:kNNowledge|Models)\s*$/.test(l));
  if (start === -1) return [];
  const paths = [];
  let current = null;
  const flush = () => {
    if (current && current.path && current.status !== 'archived') paths.push(normalizeRel(current.path));
  };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^#(?!#)\s/.test(line)) break;
    if (/^##\s+NN\s+(?:kNNowledge|Models):/.test(line)) {
      flush();
      current = {};
      continue;
    }
    if (!current) continue;
    const m = line.match(/^\s*(path|status)::\s*(.*)$/);
    if (m) current[m[1]] = m[2].trim();
  }
  flush();
  return paths;
}

/**
 * The installed package of bluepriNNt `name` under `blueprintsDir`
 * (case-insensitive directory match, with a `spec_NN.md`), or null.
 */
function installedSpec(blueprintsDir, name) {
  let entries;
  try {
    entries = fs.readdirSync(blueprintsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const wanted = name.toLowerCase();
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.toLowerCase() !== wanted) continue;
    const specPath = path.join(blueprintsDir, entry.name, 'spec_NN.md');
    let text;
    try {
      text = fs.readFileSync(specPath, 'utf-8');
    } catch {
      continue;
    }
    let fm = {};
    try {
      fm = parseFocusedYaml(parseFrontmatter(text)) || {};
    } catch {
      fm = {};
    }
    return { path: specPath, text, version: fm.blueprint_version ? String(fm.blueprint_version) : null };
  }
  return null;
}

/**
 * Directory patterns of the distributed concepts of a bluepriNNt spec:
 * `placement:: "series/{slug}/"` and `placement:: "{container}/episodes/{slug}/"`
 * with `container:: Series` become `^series/[^/]+/$` and
 * `^series/[^/]+/episodes/[^/]+/$`.
 * @param {string} specText
 * @returns {RegExp[]}
 */
function placementPatterns(specText) {
  /** @type {Map<string, { placement?: string, container?: string }>} */
  const concepts = new Map();
  let current = null;
  for (const line of specText.split(/\r?\n/)) {
    const head = line.match(/^##\s+NN\s+Concept Definition:\s*(.+?)\s*$/);
    if (head) {
      current = {};
      concepts.set(head[1].toLowerCase(), current);
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;
    const m = line.match(/^\s*(placement|container)::\s*(.*)$/);
    if (m) current[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }

  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** @param {string} name @param {number} depth @returns {string | null} */
  const resolve = (name, depth) => {
    const concept = concepts.get(name.toLowerCase());
    if (!concept || !concept.placement || depth > 8) return null;
    let out = '';
    for (const part of concept.placement.split(/(\{[a-z]+\})/i)) {
      if (part === '{slug}') out += '[^/]+';
      else if (part === '{container}') {
        const parent = concept.container ? resolve(concept.container.replace(/^\[\[|\]\]$/g, ''), depth + 1) : null;
        if (parent === null) return null;
        out += parent.replace(/\/$/, '');
      } else out += escape(part);
    }
    return out.endsWith('/') ? out : `${out}/`;
  };

  const patterns = [];
  for (const name of concepts.keys()) {
    const source = resolve(name, 0);
    if (source) patterns.push(new RegExp(`^${source}$`, 'i'));
  }
  return patterns;
}

/** The highest of two `V_x-y-z` versions (either may be null). */
function maxVersion(a, b) {
  if (!a) return b;
  if (!b) return a;
  return compareVersions(a, b) >= 0 ? a : b;
}

/** Why a document is not a valid Level-3 model, or null when it is one. */
function invalidReason(doc) {
  if (doc.parseError) return `frontmatter cannot be parsed (${doc.parseError})`;
  if (String(doc.fm.level) !== '3') return 'frontmatter does not declare `level: 3`';
  if (!doc.fm.parent_spec || !doc.fm.parent_spec.name) return 'frontmatter has no `parent_spec.name`';
  return null;
}

/**
 * @param {string} workspaceDir
 * @param {{ blueprintsDir: string }} options
 */
function auditDomain(workspaceDir, options) {
  const blueprintsDir = options.blueprintsDir;
  const items = [];
  const summary = { modelsScanned: 0, invalid: 0, unregistered: 0, enginesBehind: 0 };

  const docs = readNNDocuments(workspaceDir);
  const byRel = new Map(docs.map((d) => [d.rel, d]));
  const manifestPath = path.join(workspaceDir, ENTRYPOINT_FILENAME);
  const manifestText = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf-8') : null;
  const registered = manifestText === null ? [] : registeredPaths(manifestText);

  const isCandidate = (doc) =>
    doc.rel.toLowerCase() !== ENTRYPOINT_FILENAME.toLowerCase() &&
    isModelCandidate({ path: doc.rel, frontmatter: { ...doc.fm, level: Number(doc.fm.level) } });

  // bluepriNNts the domaiNN uses: the documents' parent_spec plus the manifest's `blueprint::`.
  const blueprints = new Map();
  const note = (raw, declared) => {
    if (!raw) return;
    const name = blueprintNameOf(String(raw));
    const key = name.toLowerCase();
    const entry = blueprints.get(key) || { name, declared: null };
    entry.declared = maxVersion(entry.declared, declared);
    blueprints.set(key, entry);
  };
  for (const doc of docs) {
    if (!isCandidate(doc) || !doc.fm.parent_spec.name) continue;
    const specName = String(doc.fm.parent_spec.name);
    const fromName = (specName.match(NAME_VERSION_RE) || [])[1] || null;
    const fromField = doc.fm.blueprint_version && VERSION_RE.test(String(doc.fm.blueprint_version))
      ? String(doc.fm.blueprint_version)
      : null;
    note(specName, maxVersion(fromName, fromField));
  }
  if (manifestText) {
    for (const m of manifestText.matchAll(/^\s*blueprint::\s*\[?\[?([^\]\r\n]+?)\]?\]?\s*$/gm)) note(m[1], null);
  }

  // Placement rules of the installed bluepriNNts, and engine drift.
  const patterns = [];
  for (const { name, declared } of blueprints.values()) {
    const spec = installedSpec(blueprintsDir, name);
    if (!spec) continue;
    patterns.push(...placementPatterns(spec.text));
    if (declared && spec.version && VERSION_RE.test(spec.version) && compareVersions(spec.version, declared) < 0) {
      summary.enginesBehind++;
      const command = installCommand(name);
      items.push({
        type: 'blueprint-engine',
        name,
        status: 'behind',
        installed: spec.version,
        declared,
        command,
        detail:
          `Installed bluepriNNt engine ${name} ${spec.version} is older than the version the domaiNN declares (${declared}). ` +
          `Run: ${command}`,
      });
    }
  }

  const placed = (rel) => {
    const dir = rel.includes('/') ? `${rel.slice(0, rel.lastIndexOf('/'))}/` : '';
    return patterns.some((re) => re.test(dir));
  };

  const scanned = new Set();
  const invalid = new Map();
  for (const doc of docs) {
    if (isCandidate(doc)) scanned.add(doc.rel);
    else if (placed(doc.rel)) {
      scanned.add(doc.rel);
      const reason = invalidReason(doc);
      if (reason) invalid.set(doc.rel, `${reason}; it sits where a placement rule puts a model`);
    }
  }
  for (const rel of registered) {
    scanned.add(rel);
    const doc = byRel.get(rel);
    if (!doc) {
      if (!fs.existsSync(path.join(workspaceDir, rel))) invalid.set(rel, `registered in ${ENTRYPOINT_FILENAME} but the file does not exist`);
      continue;
    }
    const reason = invalidReason(doc);
    if (reason) invalid.set(rel, `${reason}; it is registered in ${ENTRYPOINT_FILENAME}`);
  }

  for (const [rel, detail] of [...invalid].sort(([a], [b]) => a.localeCompare(b))) {
    items.push({ type: 'domain-model', name: rel, status: 'invalid', detail });
  }
  summary.invalid = invalid.size;
  summary.modelsScanned = scanned.size;

  if (manifestText !== null) {
    const known = new Set(registered);
    const unregistered = [...scanned].filter((rel) => !known.has(rel) && !invalid.has(rel)).sort();
    summary.unregistered = unregistered.length;
    if (unregistered.length > 0) {
      items.push({
        type: 'domain-manifest',
        name: ENTRYPOINT_FILENAME,
        status: 'warning',
        unregistered,
        detail:
          `${ENTRYPOINT_FILENAME} does not register ${unregistered.length} model(s) that exist in the domaiNN ` +
          `(${unregistered.slice(0, 3).join(', ')}${unregistered.length > 3 ? ', ...' : ''}). ` +
          'Sync it (nn-mcp `sync_domain_manifest`).',
      });
    }
  }

  return { summary, items };
}

module.exports = { auditDomain, registeredPaths, placementPatterns, installCommand };
