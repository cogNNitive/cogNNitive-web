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

export const SCOPE_ORDER = ['cli', 'layer', 'scene', 'video', 'series', 'domain', 'blueprint'];
export const SERIES_MARKERS = ['series_NN.md', 'series_rules.md', 'script_template.md'];
export const PROCEDURES_DIR = 'procedures';

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
 */
export function bagsToChain(bags = {}) {
  const floor = bags.blueprint
    ? { id: 'blueprint', kind: 'floor', doc: null, isolate: false, values: bags.blueprint }
    : null;
  const levels = ['domain', 'series', 'video', 'scene', 'layer', 'cli'];
  const nodes = [];
  for (const level of levels) {
    if (bags[level]) {
      nodes.push({ id: level, kind: 'scope', doc: null, isolate: false, values: bags[level] });
    }
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

export function findSeriesRoot(startDir, domainRoot) {
  const stop = domainRoot ? path.resolve(domainRoot) : null;
  let dir = path.resolve(startDir);
  for (;;) {
    if (stop && dir === stop) return undefined;
    if (SERIES_MARKERS.some((m) => fs.existsSync(path.join(dir, m)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Series values read from the scope chain of the script (the context resolution
 * layer): every folder scope between the domaiNN root and the document, merged
 * outermost first so a deeper folder wins. The root's own values are NOT a
 * series level and are skipped. Returns null when the script sits in no chain or
 * the chain holds no folder scope below the root, so the caller can fall back to
 * the legacy `series_NN.md` document.
 */
function seriesValuesFromScopeChain(scriptDir) {
  const found = findScopeChain(scriptDir);
  if (!found.ok) return null;
  const loaded = loadChain(found.chain);
  if (!loaded.ok) return null;
  const nodes = loaded.loaded.nodes.slice(1);
  if (nodes.length === 0) return null;
  return Object.assign({}, ...nodes.map((node) => node.values || {}));
}

export function loadCascadeBags(scriptDir, options = {}) {
  const bags = {};
  const domainRoot = resolveWorkspace(scriptDir).root;
  const fromChain = seriesValuesFromScopeChain(scriptDir);
  if (fromChain) {
    bags.series = fromChain;
  } else {
    const seriesRoot = findSeriesRoot(scriptDir, domainRoot);
    if (seriesRoot) {
      const series = documentFields(path.join(seriesRoot, 'series_NN.md'), 'Series');
      if (series) bags.series = series;
    }
  }
  const domain = documentFields(path.join(domainRoot, 'video-defaults_NN.md'), 'Video Defaults');
  if (domain) bags.domain = domain;
  const pkg = findBlueprintPackage(options.skillDir || SKILL_DIR);
  bags.blueprint = documentFields(path.join(pkg, 'defaults', 'video-defaults_NN.md'), 'Video Defaults') || {};
  return bags;
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
