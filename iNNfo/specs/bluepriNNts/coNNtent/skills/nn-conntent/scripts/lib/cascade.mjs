/**
 * nn-conntent/scripts/lib/cascade.mjs
 *
 * The one resolver for every cascade parameter (design D-K2; capability
 * conntent-field-registry "One Resolver Serves The Compiler And The Estimator").
 * `resolve`/`resolveKeyed` live HERE, not in video-scope.mjs, so every resolver
 * (compiler, estimator, synthesize-avatar, render-thumbnail, produce) imports the
 * same module and the same precedence.
 *
 * `createCascade({ model, scriptPath, bags, presetOf })` returns
 * `{ at(scene?, layer?), get(field), validateLevel(field, level) }`:
 *
 *   - `at(scene, layer)` builds the chain for that position. The scene bag may carry
 *     the scene's own declared fields and its `presets`; the layer bag the layer's
 *     explicit fields.
 *   - `get(field)` resolves through `bagsToChain` + nn-core `resolve` and returns
 *     `{ value, source, trace }`.
 *   - Node order per level is presets (list order) → explicit fields; the `kind`
 *     level holds Scene Kind direct fields and kind presets; a Chrome `music`
 *     value feeds `background_audio` at the kind level.
 *   - `validateLevel(field, level)` rejects a field set at a level its scope class
 *     forbids with `CASCADE_LEVEL_FORBIDDEN`.
 *
 * Zero external dependencies (nn-core via the shared mirror). ESM module.
 */

import { bagsToChain } from './video-scope.mjs';
import { resolve as coreResolve } from './nn-core.generated.cjs';

function usable(v) {
  if (v === undefined || v === null) return false;
  // An explicit empty list is a value, not "unset": `review_gates: []` is autopilot
  // and must beat a farther non-empty list (conntent-review-gates, 3b-1.8).
  if (Array.isArray(v)) return true;
  return String(v).trim() !== '';
}

/** The levels with an explicit node, outer → inner (the ones bagsToChain emits). */
const CHAIN_LEVELS = ['domain', 'series', 'kind', 'video', 'scene', 'layer'];

/**
 * Resolves one scalar parameter across bags using nn-core resolve (the shared
 * precedence of the whole engine). Lives here so one resolver serves every caller.
 * The returned trace carries `source`, the winning `document` and the `overridden`
 * sources that lost (nearest first) — capability conntent-field-registry "Every
 * Resolved Value Carries A Source Trace".
 * @param {string} param
 * @param {Record<string, Record<string, unknown>>} [bags]
 * @param {{ accept?: (v: unknown) => boolean }} [options]
 * @returns {{ value: unknown, source: string | null, document: string | null, overridden: Array<{ source: string, document: string | null }> }}
 */
export function resolve(param, bags = {}, options = {}) {
  const loaded = bagsToChain(bags);
  const accept = options.accept || usable;
  const r = coreResolve(loaded, param, 'override', { accept });
  const exp = r.explain || {};
  return {
    value: r.present ? r.value : null,
    source: exp.winner?.scope ?? null,
    document: exp.winner?.doc ?? null,
    overridden: (exp.overridden || []).map((o) => ({ source: o.scope, document: o.doc ?? null })),
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

/** The keys of `fit` (spec S2): the asset matches the box aspect, or it does not. */
export const FIT_KEYS = ['native', 'mismatch'];
/** The built-in `fit` treatments; `component:<name>` names a HyperFrames component instead. */
export const FIT_BUILTINS = ['cover', 'contain', 'blur', 'card'];

/** A `fit` value or key the engine does not know. Code `FIT_INVALID`. */
export class FitValueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FitValueError';
    this.code = 'FIT_INVALID';
  }
}

function checkFitValue(value, raw) {
  const v = String(value ?? '').trim();
  if (FIT_BUILTINS.includes(v)) return v;
  if (/^component:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v)) return v;
  throw new FitValueError(
    `fit: unknown value "${v}" in ${JSON.stringify(raw)}; expected cover | contain | blur | card | component:<name>`,
  );
}

/**
 * Normalizes one level's raw `fit` into a partial `{ native?, mismatch? }` map. A scalar
 * (`cover`, or a one-item list without `=`) broadcasts to both keys; a keyed list sets
 * only the keys it names. This runs BEFORE the keyed union, because nn-core drops a list
 * item without `=` (M6). Returns null when the level sets nothing.
 * @param {unknown} raw
 * @returns {{ native?: string, mismatch?: string } | null}
 */
export function normalizeFit(raw) {
  if (raw === undefined || raw === null) return null;
  let items;
  if (Array.isArray(raw)) items = raw.map((x) => String(x).trim());
  else if (typeof raw === 'object') items = Object.entries(raw).map(([k, v]) => `${k}=${v}`);
  else {
    let text = String(raw).trim();
    if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
    items = text.split(',').map((s) => s.trim());
  }
  items = items.filter((s) => s !== '');
  if (items.length === 0) return null;
  const keyed = items.filter((s) => s.includes('=') && !s.startsWith('component:'));
  if (keyed.length === 0) {
    if (items.length !== 1) throw new FitValueError(`fit: a scalar takes one value, got ${JSON.stringify(raw)}`);
    const v = checkFitValue(items[0], raw);
    return { native: v, mismatch: v };
  }
  if (keyed.length !== items.length) throw new FitValueError(`fit: mix of keyed and scalar items in ${JSON.stringify(raw)}`);
  const out = {};
  for (const item of items) {
    const at = item.indexOf('=');
    const key = item.slice(0, at).trim();
    if (!FIT_KEYS.includes(key)) {
      throw new FitValueError(`fit: unknown key "${key}" in ${JSON.stringify(raw)}; expected native | mismatch`);
    }
    out[key] = checkFitValue(item.slice(at + 1), raw);
  }
  return out;
}

/**
 * Resolves the keyed `fit` per key through the cascade (layer > scene > video > kind >
 * series > domain > blueprint, Presets included, the order of `bagsToChain`). Every level
 * is normalized first, then the keyed union keeps the nearest value of each key, so an
 * inner level setting one key keeps the outer value of the other. A key no level sets is
 * `cover`. Returns `value: null` when no level sets `fit` at all.
 * @param {Record<string, unknown>} [bags]
 * @returns {{ value: { native: string, mismatch: string } | null, source: { native: string|null, mismatch: string|null } }}
 */
export function resolveFit(bags = {}) {
  const loaded = bagsToChain(bags);
  const norm = (node) => {
    if (!node || !Object.hasOwn(node.values || {}, 'fit')) return node;
    const map = normalizeFit(node.values.fit);
    const values = { ...node.values };
    if (map) values.fit = map;
    else delete values.fit;
    return { ...node, values };
  };
  const chain = { floor: norm(loaded.floor), nodes: loaded.nodes.map(norm) };
  const r = coreResolve(chain, 'fit', 'union');
  const source = { native: null, mismatch: null };
  if (!r.present || !Array.isArray(r.value) || r.value.length === 0) return { value: null, source };
  const value = { native: 'cover', mismatch: 'cover' };
  for (const entry of r.value) value[entry.name] = entry.value;
  for (const e of r.explain?.entries || []) source[e.name] = e.from?.scope ?? null;
  return { value, source };
}

/** Error code when a cascade field is set at a level its scope class forbids. */
export const CASCADE_LEVEL_FORBIDDEN = 'CASCADE_LEVEL_FORBIDDEN';

/** The one registry (generated). */
import registryJson from './field-registry.generated.json' with { type: 'json' };

/**
 * Builds a cascade resolver for one episode.
 * @param {{ model?: object, scriptPath?: string, bags?: object, presetOf?: (name: string) => { name: string, values: object } | null, characterOf?: (name: string) => { name: string, voices: Record<string,string>, defaultPose: string|null, avatarModel: string|null, avatarResolution: string|null, defaultBackground: string|null } | null, language?: string }} input
 */
export function createCascade({ model, scriptPath, bags: baseBags, presetOf, characterOf: charOf, language } = {}) {
  const bags = { ...(baseBags || {}) };
  if (presetOf) bags.__presetOf = presetOf;
  const characterOf = charOf || null;

  return {
    /**
     * Positions the resolution at a scene (and optionally a layer).
     * @param {string|undefined} scene
     * @param {string|undefined} layer
     * @returns {{ get: (field: string) => { value: unknown, source: string|null, trace: Array<{ level: string, node: string|null, value: unknown }> } }}
     */
    at(scene, layer) {
      // Build the per-position bags: scene/layer bags only when the positions exist.
      const sceneBag = scene ? (bags.scene || {}) : {};
      const layerBag = layer ? (bags.layer || {}) : {};
      // The kind level: direct Scene Kind fields, with a Chrome `music` feeding
      // `background_audio` at the kind level.
      const kindBag = { ...(bags.kind || {}) };
      if (kindBag.music !== undefined && kindBag.background_audio === undefined) {
        kindBag.background_audio = kindBag.music;
      }

      const chainBags = {
        ...bags,
        scene: scene ? sceneBag : undefined,
        layer: layer ? layerBag : undefined,
        kind: kindBag,
        presetIndex: bags.presetIndex,
      };

      return {
        /** @returns {{ value: unknown, source: string|null, document: string|null, overridden: Array<{ source: string, document: string|null }>, trace: Array<{ level: string, node: string|null, value: unknown }> }} */
        get(field) {
          // Fold each level's active Character in as a node directly beneath that
          // level's explicit fields (design D19): explicit > character > preset.
          const loaded = bagsToChain(chainBags);
          const nodes = [];
          for (const node of loaded.nodes) {
            const level = node.id;
            const bag = chainBags[level];
            const name = bag && typeof bag.character === 'string' && bag.character.trim() !== '' ? bag.character.trim() : null;
            const character = name && characterOf ? characterOf(name) : null;
            // The character node joins just before this level's explicit node; preset
            // nodes already precede the explicit node in the emitted order.
            if (character) {
              const lang = String(language || bags.video?.language || '').toLowerCase();
              nodes.push({
                id: `${level}:character:${character.name}`,
                kind: 'scope',
                doc: null,
                isolate: false,
                values: {
                  voice: character.voices?.[lang] || null,
                  pose: character.defaultPose ?? null,
                  avatar_model: character.avatarModel ?? null,
                  avatar_resolution: character.avatarResolution ?? null,
                  background: character.defaultBackground ?? null,
                },
              });
            }
            nodes.push(node);
          }
          const r = coreResolve({ floor: loaded.floor, nodes }, field, 'override', { accept: usable });
          const exp = r.explain || {};
          const trace = (exp.winner?.scope ? [{ level: exp.winner.scope, node: null, value: r.present ? r.value : null }] : []);
          return {
            value: r.present ? r.value : null,
            source: exp.winner?.scope ?? null,
            document: exp.winner?.doc ?? null,
            overridden: (exp.overridden || []).map((o) => ({ source: o.scope, document: o.doc ?? null })),
            trace,
          };
        },
      };
    },

    /**
     * Rejects a field set at a level its scope class forbids.
     * @param {string} field
     * @param {string} level one of layer|scene|video|kind|series|domain|blueprint
     * @throws {{ code: string, field: string, level: string, allowed: string[] }}
     */
    validateLevel(field, level) {
      const def = registryJson.fields[field];
      if (!def || !def.cascade) return; // record fields may sit anywhere their concept allows
      const allowed = def.levels || [];
      // `blueprint` is the floor; it is always allowed as a default source.
      if (level === 'blueprint') return;
      if (!allowed.includes(level)) {
        const err = new Error(
          `cascade field "${field}" (class ${def.scope}) cannot be set at the ${level} level; allowed: ${allowed.join(', ')}`,
        );
        err.code = CASCADE_LEVEL_FORBIDDEN;
        err.field = field;
        err.level = level;
        err.allowed = allowed;
        throw err;
      }
    },
  };
}