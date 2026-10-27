/**
 * nn-video-script/scripts/lib/cascade.mjs
 *
 * The single resolver for every multi-level video parameter (design D10), and
 * the locator for the bluepriNNt package that supplies the `blueprint` level
 * (design D15). Precedence, most specific first:
 *
 *   cli > layer > scene > video > series > domain > blueprint
 *
 * `series` is the episode's Series document, `domain` the domain-root Video
 * Defaults document, `blueprint` the Video Defaults document shipped in the
 * package. Every caller obtains a parameter only from here and reports the
 * level that supplied it; no default value lives in engine code. Pure module
 * apart from the two filesystem locators (`loadCascadeBags`,
 * `findBlueprintPackage`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSeriesRoot } from './nearest.mjs';
import { resolveWorkspace } from './video-guard.mjs';
import { parseKnowledgeDocument } from './knowledge-model.mjs';

/** Scope chain, most specific first. */
export const SCOPE_ORDER = ['cli', 'layer', 'scene', 'video', 'series', 'domain', 'blueprint'];

/** The skill's own folder, used as the anchor for the package locator. */
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Raised when no `video-script` bluepriNNt package can be located. */
export class BlueprintPackageNotFoundError extends Error {
  /** @param {string[]} searched */
  constructor(searched) {
    super(
      `video-script bluepriNNt package not found; searched:\n${searched.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'BlueprintPackageNotFoundError';
    this.searched = searched;
  }
}

/** @param {unknown} v */
function usable(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/**
 * Resolves one scalar parameter across the bags, most specific level first.
 * @param {string} param
 * @param {Record<string, Record<string, unknown>>} [bags]
 * @param {{ accept?: (v: unknown) => boolean }} [options] - `accept` overrides the
 *   default "non-empty" test so a typed parameter (e.g. a number) can skip a
 *   malformed value at a more specific level and fall through to a valid one.
 * @returns {{ value: unknown, source: string | null }}
 */
export function resolve(param, bags = {}, options = {}) {
  const accept = options.accept || usable;
  for (const level of SCOPE_ORDER) {
    const bag = bags[level];
    if (bag && accept(bag[param])) return { value: bag[param], source: level };
  }
  return { value: null, source: null };
}

/** Parses one `key=name` item, or null when malformed. @param {unknown} item */
function parseKeyedItem(item) {
  const s = String(item).trim();
  if (!s) return null;
  const i = s.indexOf('=');
  if (i === -1) return null;
  const key = s.slice(0, i).trim();
  const value = s.slice(i + 1).trim();
  if (!key || !usable(value)) return null;
  return { key, value };
}

/**
 * Normalizes a keyed-list value (bracketed `[a=b, c=d]` string, array or object)
 * into `{ key, value }` entries.
 * @param {unknown} raw
 * @returns {Array<{ key: string, value: string }>}
 */
function keyedEntries(raw) {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) return raw.map(parseKeyedItem).filter(Boolean);
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, value: String(value) }));
  }
  let s = String(raw).trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  return s.split(',').map(parseKeyedItem).filter(Boolean);
}

/**
 * Resolves one key of a keyed-list parameter (`components`, `sounds`), most
 * specific level first. An absent key resolves to `{ value: null }`.
 * @param {string} param
 * @param {string} key
 * @param {Record<string, Record<string, unknown>>} [bags]
 * @returns {{ value: string | null, source: string | null }}
 */
export function resolveKeyed(param, key, bags = {}) {
  for (const level of SCOPE_ORDER) {
    const bag = bags[level];
    if (!bag) continue;
    const entry = keyedEntries(bag[param]).find((e) => e.key === key);
    if (entry) return { value: entry.value, source: level };
  }
  return { value: null, source: null };
}

/** Fields of the first element of the named Concept in a Level-3 document. */
function documentFields(file, concept) {
  if (!fs.existsSync(file)) return null;
  const model = parseKnowledgeDocument(fs.readFileSync(file, 'utf8'));
  const el = (model.elements[concept] || [])[0];
  return el ? el.fields || {} : {};
}

/**
 * Locates the installed `video-script` bluepriNNt package from the skill's own
 * folder (design D15): repo/in-package, global install, then workspace install.
 * @param {string} [skillDir]
 * @returns {string}
 */
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
 * Builds the `series`, `domain` and `blueprint` bags for a script directory.
 * A missing series or domain document simply omits that level; the `blueprint`
 * level always resolves through the package locator.
 * @param {string} scriptDir
 * @param {{ skillDir?: string }} [options]
 * @returns {{ series?: object, domain?: object, blueprint: object }}
 */
export function loadCascadeBags(scriptDir, options = {}) {
  const bags = {};
  const domainRoot = resolveWorkspace(scriptDir).root;
  const seriesRoot = findSeriesRoot(scriptDir, domainRoot);
  if (seriesRoot) {
    const series = documentFields(path.join(seriesRoot, 'series_NN.md'), 'Series');
    if (series) bags.series = series;
  }
  const domain = documentFields(path.join(domainRoot, 'video-defaults_NN.md'), 'Video Defaults');
  if (domain) bags.domain = domain;
  const pkg = findBlueprintPackage(options.skillDir || SKILL_DIR);
  bags.blueprint = documentFields(path.join(pkg, 'defaults', 'video-defaults_NN.md'), 'Video Defaults') || {};
  return bags;
}
