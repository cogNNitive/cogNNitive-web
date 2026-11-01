/**
 * nn-video-script/scripts/lib/video-scope.mjs
 *
 * Scope resolution and asset location for the video-script skill, powered by
 * nn-core's scope engine (via ./nn-core.generated.cjs).
 *
 * Replaces legacy cascade.mjs and nearest.mjs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findDomainRoot,
  findScopeChain,
  loadChain,
  resolve as coreResolve,
} from './nn-core.generated.cjs';
import { resolveWorkspace } from './video-guard.mjs';
import { parseKnowledgeDocument } from './knowledge-model.mjs';
import { loadPresetIndex, lookupPreset, parsePresetList, presetSourceFromFile } from './presets.mjs';

export const SCOPE_ORDER = ['cli', 'layer', 'scene', 'video', 'series', 'domain', 'blueprint'];
export const PROCEDURES_DIR = 'procedures';

/** Levels whose `presets` list expands. `layer` and `cli` carry explicit fields only. */
export const PRESET_LEVELS = new Set(['domain', 'series', 'video', 'scene']);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export class BlueprintPackageNotFoundError extends Error {
  constructor(searched) {
    super(
      `video-script bluepriNNt package not found; searched:\n${searched.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'BlueprintPackageNotFoundError';
    this.searched = searched;
  }
}

function usable(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/**
 * Turns legacy cascade bags { cli, layer, scene, video, series, domain, blueprint }
 * into a LoadedChain structure for nn-core's resolve fold.
 *
 * Each level that may carry `presets` expands its list into extra scope nodes
 * placed immediately before that level's own node, in list order: the last
 * Preset of a list wins, the level's explicit fields beat its own Presets, and
 * a nearer level still beats every outer one (design D4).
 */
export function bagsToChain(bags = {}) {
  const floor = bags.blueprint
    ? { id: 'blueprint', kind: 'floor', doc: null, isolate: false, values: bags.blueprint }
    : null;
  const levels = ['domain', 'series', 'video', 'scene', 'layer', 'cli'];
  const nodes = [];
  for (const level of levels) {
    const bag = bags[level];
    if (!bag) continue;
    if (PRESET_LEVELS.has(level)) {
      for (const name of parsePresetList(bag.presets)) {
        const def = lookupPreset(bags.presetIndex, name);
        nodes.push({ id: `${level}:preset:${def.name}`, kind: 'scope', doc: def.doc, isolate: false, values: def.values });
      }
    }
    const { presets: _presets, ...explicit } = bag;
    nodes.push({ id: level, kind: 'scope', doc: null, isolate: false, values: explicit });
  }
  return { floor, nodes };
}

/**
 * Resolves one scalar parameter across bags using nn-core resolve.
 * @param {string} param
 * @param {Record<string, Record<string, unknown>>} [bags]
 * @param {{ accept?: (v: unknown) => boolean }} [options]
 * @returns {{ value: unknown, source: string | null }}
 */
export function resolve(param, bags = {}, options = {}) {
  const loaded = bagsToChain(bags);
  const accept = options.accept || usable;
  const r = coreResolve(loaded, param, 'override', { accept });
  return {
    value: r.present ? r.value : null,
    source: r.explain?.winner?.scope ?? null,
  };
}

/**
 * Resolves one key of a keyed-list parameter (`components`, `sounds`) across bags
 * using nn-core resolve with union strategy.
 * @param {string} param
 * @param {string} key
 * @param {Record<string, Record<string, unknown>>} [bags]
 * @returns {{ value: string | null, source: string | null }}
 */
export function resolveKeyed(param, key, bags = {}) {
  const loaded = bagsToChain(bags);
  const r = coreResolve(loaded, param, 'union');
  if (!r.present || !Array.isArray(r.value)) {
    return { value: null, source: null };
  }
  const entry = r.value.find((e) => e.name === key);
  if (!entry) return { value: null, source: null };
  const explainEntry = r.explain?.entries?.find((e) => e.name === key);
  return {
    value: entry.value,
    source: explainEntry?.from?.scope ?? null,
  };
}

function documentFields(file, concept) {
  if (!fs.existsSync(file)) return null;
  const model = parseKnowledgeDocument(fs.readFileSync(file, 'utf8'));
  const el = (model.elements[concept] || [])[0];
  return el ? el.fields || {} : {};
}

export function findBlueprintPackage(skillDir = SKILL_DIR) {
  const candidates = [
    path.resolve(skillDir, '..', '..'),
    path.resolve(skillDir, '..', '..', 'bluepriNNts', 'video-script'),
    path.resolve(skillDir, '..', '..', '..', 'specs', 'bluepriNNts', 'video-script'),
  ];
  for (const candidate of candidates) {
    const spec = path.join(candidate, 'spec_NN.md');
    if (fs.existsSync(spec) && /blueprint_name:\s*"video-script"/.test(fs.readFileSync(spec, 'utf8'))) {
      return candidate;
    }
  }
  throw new BlueprintPackageNotFoundError(candidates);
}

/**
 * The series root: the outermost folder scope link below the domain root, as the
 * nn-core scope chain resolves it. A scope document is recognised by its
 * frontmatter `scope: true`, never by filename, and a chain that is not `ok`
 * (for example DUPLICATE_SCOPE_MARKER) is surfaced instead of swallowed.
 *
 * @param {string} startDir
 * @returns {string|undefined} Absolute path of the series folder, or undefined.
 */
export function findSeriesRoot(startDir) {
  const found = findScopeChain(startDir);
  if (!found.ok) {
    // An episode with no domaiNN root above it simply has no series; a broken
    // chain (a duplicate scope marker) is a real error and is surfaced.
    if (found.code === 'NO_DOMAIN_ROOT') return undefined;
    const detail = found.detail ? `: ${found.detail}` : '';
    throw new Error(`Cannot resolve the series root: ${found.code || 'unreadable scope chain'}${detail}`);
  }
  const loaded = loadChain(found.chain);
  if (!loaded.ok) {
    const detail = loaded.detail ? `: ${loaded.detail}` : '';
    throw new Error(`Cannot load the scope chain: ${loaded.code || 'unreadable scope chain'}${detail}`);
  }
  const scope = (loaded.loaded.nodes || []).find((node) => node.kind === 'scope');
  if (!scope) return undefined;
  return path.resolve(found.chain.root, scope.id);
}

/**
 * Series values read from the scope chain of the script (the context resolution
 * layer): every folder scope between the domaiNN root and the document, merged
 * outermost first so a deeper folder wins. The root's own values are NOT a
 * series level and are skipped. `presets` is the one list that is additive
 * across folders: the lists are concatenated outer to inner (design D3).
 * Returns null when the script sits in no chain or the chain holds no folder
 * scope below the root, so the caller can fall back to the legacy `series_NN.md`
 * document.
 */
function seriesValuesFromScopeChain(scriptDir) {
  const found = findScopeChain(scriptDir);
  if (!found.ok) return null;
  const loaded = loadChain(found.chain);
  if (!loaded.ok) return null;
  const nodes = loaded.loaded.nodes.slice(1);
  if (nodes.length === 0) return null;
  const merged = Object.assign({}, ...nodes.map((node) => node.values || {}));
  const lists = nodes.flatMap((node) => parsePresetList((node.values || {}).presets));
  if (lists.length > 0) merged.presets = lists;
  else delete merged.presets;
  return merged;
}

/**
 * Preset definitions along the same chain, nearest first (innermost folder,
 * then its parents), so the index can shadow outer definitions (design D3).
 */
function presetSourcesFromScopeChain(scriptDir) {
  const found = findScopeChain(scriptDir);
  if (!found.ok) return [];
  const links = (found.chain.links || []).slice(1);
  const files = links
    .map((link) => link.valuesDoc)
    .filter((rel) => typeof rel === 'string' && rel !== '')
    .map((rel) => path.join(found.chain.root, rel));
  return files.reverse().map((file) => presetSourceFromFile(file));
}

export function loadCascadeBags(scriptDir, options = {}) {
  const bags = {};
  const domainRoot = resolveWorkspace(scriptDir).root;
  const domainFile = path.join(domainRoot, 'video-defaults_NN.md');
  // The series level comes only from the scope chain: the legacy markers
  // (`series_NN.md`, `series_rules.md`, `script_template.md`) anchor nothing.
  const fromChain = seriesValuesFromScopeChain(scriptDir);
  if (fromChain) bags.series = fromChain;
  const domain = documentFields(domainFile, 'Video Defaults');
  if (domain) bags.domain = domain;
  const pkg = findBlueprintPackage(options.skillDir || SKILL_DIR);
  bags.blueprint = documentFields(path.join(pkg, 'defaults', 'video-defaults_NN.md'), 'Video Defaults') || {};
  // One lookup order for every reference: script (prepended by withScriptPresets),
  // then the Series chain innermost to outermost, then the domain defaults.
  bags.presetIndex = loadPresetIndex([...presetSourcesFromScopeChain(scriptDir), presetSourceFromFile(domainFile)]);
  return bags;
}

/**
 * Prepends the script's own Preset definitions to the index, so a Video-local
 * Preset shadows a Series or domain Preset of the same name (design D3).
 */
export function withScriptPresets(bags = {}, model = null, scriptPath = null) {
  const elements = model?.elements || {};
  const sources = [{ doc: scriptPath || null, elements }];
  for (const source of (bags.presetIndex?.sources || [])) sources.push(source);
  return { ...bags, presetIndex: loadPresetIndex(sources) };
}

export function findNearest(startDir, relPath, opts = {}) {
  const { stopDir, fallbackDir } = opts;
  const rel = relPath.split(/[\\/]/).filter(Boolean).join(path.sep);
  const searched = [];
  const stop = stopDir ? path.resolve(stopDir) : null;
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, rel);
    searched.push(candidate);
    if (fs.existsSync(candidate)) return { path: candidate, searched };
    if (stop && dir === stop) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (fallbackDir) {
    const candidate = path.join(path.resolve(fallbackDir), rel);
    searched.push(candidate);
    if (fs.existsSync(candidate)) return { path: candidate, searched };
  }
  return { path: null, searched };
}

export function findNearestByStem(startDir, dirName, stem, opts = {}) {
  const { stopDir, fallbackDir } = opts;
  const searched = [];
  const dirs = [];
  const stop = stopDir ? path.resolve(stopDir) : null;
  let dir = path.resolve(startDir);
  for (;;) {
    dirs.push(dir);
    if (stop && dir === stop) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (fallbackDir) dirs.push(path.resolve(fallbackDir));

  for (const base of dirs) {
    const folder = path.join(base, dirName);
    const probe = path.join(folder, `${stem}.*`);
    searched.push(probe);
    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      continue;
    }
    const match = entries
      .filter((e) => e.isFile() && path.parse(e.name).name === stem)
      .map((e) => e.name)
      .sort()[0];
    if (match) return { path: path.join(folder, match), searched };
  }
  return { path: null, searched };
}
