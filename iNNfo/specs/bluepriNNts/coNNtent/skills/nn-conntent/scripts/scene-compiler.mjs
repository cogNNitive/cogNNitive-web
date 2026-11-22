#!/usr/bin/env node

/**
 * nn-conntent/scripts/scene-compiler.mjs
 *
 * Lowers the structured iNNfo coNNtent model into a typed
 * Composition Manifest. The model comes from innfo-core `read_knowledge` (or the
 * equivalent structural reader in `lib/knowledge-model.mjs`); this module NEVER
 * parses script markdown and NEVER invokes a bespoke script parser.
 *
 * Computes frame-accurate timings, sequence tracks, audio bindings, transitions,
 * and visual overlay tracks (lowerThird, kineticTitle, captions, quote, broll).
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isKnowledgeModel, slugify } from './lib/knowledge-model.mjs';
import { resolve, resolveFit } from './lib/cascade.mjs';
import { chromeFieldsFor, kindBagOf, kindLayersOf, loadSeriesGrammar, validateLanguage, validateSceneKinds } from './lib/kinds.mjs';
import { bagsToChain } from './lib/video-scope.mjs';
import { lookupPreset } from './lib/presets.mjs';

/**
 * @typedef {Object} LowerThirdProps
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [position]
 */

/**
 * @typedef {Object} VisualOverlayConfig
 * @property {string} id
 * @property {"lowerThird" | "kineticTitle" | "captions" | "quote" | "broll"} type
 * @property {number} fromFrame
 * @property {number} durationInFrames
 * @property {string} [enterAnimation]
 * @property {string} [exitAnimation]
 * @property {Record<string, unknown>} config
 */

/**
 * @typedef {Object} SceneTrack
 * @property {string} id
 * @property {number} fromFrame
 * @property {number} durationInFrames
 * @property {object} props
 * @property {{ type: string, durationInFrames: number }} [transition]
 * @property {Array<object>} [animations]
 * @property {number} [narrationDurationInFrames]
 */

/**
 * @typedef {Object} CompositionManifest
 * @property {string} version
 * @property {string} compositionId
 * @property {number} fps
 * @property {number} width
 * @property {number} height
 * @property {number} totalDurationInFrames
 * @property {number} totalDurationInSeconds
 * @property {{ scenes: SceneTrack[], audio: Array<object>, overlays: Array<object> }} tracks
 * @property {object} metadata
 */

/**
 * `type::` → manifest binding. `kind` says whether the Layer is a drawable
 * scene layer, an ephemeral overlay, or an authored animation; `manifest` is the
 * emitted kind.
 */
export const TYPE_RENDERERS = {
  presenter: { kind: 'layer', manifest: 'talking_avatar' },
  background: { kind: 'layer', manifest: 'background' },
  'b-roll': { kind: 'overlay', manifest: 'broll' },
  title: { kind: 'overlay', manifest: 'kineticTitle' },
  'lower-third': { kind: 'overlay', manifest: 'lowerThird' },
  caption: { kind: 'overlay', manifest: 'captions' },
  brand: { kind: 'layer', manifest: 'image' },
  quote: { kind: 'overlay', manifest: 'quote' },
  watermark: { kind: 'overlay', manifest: 'watermark' },
  // An authored HyperFrames project mounted as a ROOT sub-composition (design
  // D7): `kind: 'animation'` keeps it out of both the drawable-layer path
  // (staged as media) and the overlay path; the pre-pass and the emitter own it.
  animation: { kind: 'animation', manifest: 'animation' },
};

/**
 * The `type::` → required Fields contract, read from the generated field registry (which is
 * generated from the blueprint) instead of a hand-copied table (design A11). The engine never
 * reads the blueprint at runtime: it reads the artifact the blueprint generates.
 */
const FIELD_REGISTRY = JSON.parse(
  fs.readFileSync(new URL('./lib/field-registry.generated.json', import.meta.url), 'utf8'),
);
export const CONDITIONAL_FIELDS = FIELD_REGISTRY.conditional_fields;

/**
 * Transitional: the visual `type::` names of the V_0-14-x line. Documents written before
 * V_0-15-0 still compile during the chain; Slice 5 retires them with the lowering rewrite.
 * Never part of the registry and never added to the blueprint.
 */
const LEGACY_LAYER_FIELDS = {
  presenter: ['asset', 'prompt', 'avatar'],
  background: ['asset', 'prompt'],
  'b-roll': ['asset', 'prompt'],
  title: ['text'],
  'lower-third': ['text'],
  quote: ['text'],
  caption: ['text'],
  brand: ['asset'],
  watermark: ['text'],
};


/**
 * Field names that declare duration or timing. The `coNNtent` blueprint
 * defines no such field: duration and schedule are derived by the engine from
 * measured/synthesized media (spec "No Declared Duration or Timing"). The
 * validator ignores undeclared properties, so this pre-compile guard is where
 * the rule is enforced — any timing-looking property on any Concept is rejected.
 */
export const TIMING_FIELD_NAMES = new Set([
  'duration',
  'duration_seconds',
  'duration_in_seconds',
  'duration_frames',
  'duration_in_frames',
  'from_frame',
  'to_frame',
  'from_frame_offset',
  'to_frame_offset',
  'from_seconds_offset',
  'to_seconds_offset',
  'start_frame',
  'end_frame',
  'start_time',
  'end_time',
]);

/** Named, non-zero error raised when an L3 document fails the pre-compile guard. */
export class ScriptValidationError extends Error {
  /**
   * @param {Array<{ code: string, message: string }>} errors
   */
  constructor(errors) {
    const list = Array.isArray(errors) ? errors : [{ code: 'invalid', message: String(errors) }];
    super(`Invalid iNNfo coNNtent: ${list.map((e) => `${e.code} (${e.message})`).join('; ')}`);
    this.name = 'ScriptValidationError';
    this.errors = list;
  }
}

const INPUT_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Parses an `animation` Layer's `inputs:: [name=value, ...]` (issue #612 item 4): the keyed
 * list the `fit` and `components` fields use. Accepts the parsed list, an object map, or the
 * raw `[a=1, b=2]` string. A value is kept verbatim as a string; the project's declared
 * variable types are applied later, when the project is read.
 * @param {unknown} raw
 * @returns {{ inputs: Record<string, string> | null, errors: string[] }} `inputs` is null when unset
 */
export function parseLayerInputs(raw) {
  if (raw === undefined || raw === null) return { inputs: null, errors: [] };
  let items;
  if (Array.isArray(raw)) items = raw.map((x) => String(x));
  else if (typeof raw === 'object') items = Object.entries(raw).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  else {
    let text = String(raw).trim();
    if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
    items = text.split(',');
  }
  const inputs = {};
  const errors = [];
  for (const item of items.map((s) => s.trim()).filter((s) => s !== '')) {
    const at = item.indexOf('=');
    const name = at > 0 ? item.slice(0, at).trim() : '';
    if (!INPUT_NAME_RE.test(name)) {
      errors.push(`"${item}" is not a name=value entry`);
      continue;
    }
    if (Object.hasOwn(inputs, name)) {
      errors.push(`"${name}" is given twice`);
      continue;
    }
    inputs[name] = item.slice(at + 1).trim();
  }
  if (Object.keys(inputs).length === 0 && errors.length === 0) return { inputs: null, errors };
  return { inputs, errors };
}

/**
 * Resolves `file:<path>` input values to the file's text, read relative to the script
 * folder, so the content (not the name) is the value: a changed file changes the scene's
 * review subject. A missing file throws code `animation-input-file`.
 */
function readInputFiles(inputs, layerName, scriptDir) {
  const out = {};
  for (const [name, value] of Object.entries(inputs)) {
    if (!value.startsWith('file:')) {
      out[name] = value;
      continue;
    }
    const file = path.resolve(scriptDir || process.cwd(), value.slice('file:'.length).trim());
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw Object.assign(new Error(`animation-input-file: Layer "${layerName}" input "${name}" names ${file}, which does not exist`), {
        code: 'animation-input-file',
      });
    }
    out[name] = fs.readFileSync(file, 'utf8');
  }
  return out;
}

/** Overlay layers sequenced into non-overlapping slots, and their default seconds. */
const SEQUENTIAL_OVERLAY_TYPES = { quote: 3, 'b-roll': 4 };

/** Video vs still by extension (background layers). */
function isVideoAsset(asset) {
  return /\.(mp4|webm|mov|mkv|m4v)$/i.test(String(asset || ''));
}

/** Internal `layer_type` consumed by the renderer machinery. */
function internalLayerType(declared, asset) {
  switch (declared) {
    case 'presenter':
      return 'talking_avatar';
    case 'background':
      return isVideoAsset(asset) ? 'video' : 'image';
    case 'brand':
      return 'image';
    default:
      return declared;
  }
}

/**
 * The manifest `compositionId`: the episode slug, never derived from the title
 * (design D-S2; conntent-folder-contract "Composition id is the slug"). Accepts either
 * the slug string or `{ slug, title }`; when no slug is known it falls back to a
 * slugified title so existing callers keep working.
 */
export function compositionIdOf(input) {
  // A real episode slug comes from an object `{ slug, title }`; a bare string is
  // treated as the title (back-compat with existing callers).
  const isObj = input && typeof input === 'object';
  const slug = isObj ? input.slug : null;
  const title = isObj ? input.title : input;
  const raw = String(slug || title || 'composition');
  return String(slug || raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Computes each scene's target duration (design D7/D14). Narration is measured
 * when its audio exists (`audioDurations`/`audioAssets`) and estimated from the
 * word count otherwise. A narrated scene lasts its narration and an authored
 * `animation` never stretches it (the emitter trims or loops the animation); a
 * scene without narration lasts its longest animation, else the default.
 * `measured` says whether the narration length was measured.
 * @param {Array<{ id: string, slug?: string, narration?: string }>} scenes
 * @param {{ fps?: number, wordsPerSecond?: number, defaultSceneDuration?: number, audioDurations?: Record<string, number>, audioAssets?: Record<string, { durationSeconds?: number }>, animations?: Record<string, Array<{ durationSeconds?: number }>> }} [options]
 * @returns {Array<{ sceneId: string, slug: string | undefined, seconds: number, narrationSeconds: number, animationSeconds: number, measured: boolean }>}
 */
export function computeSceneDurations(scenes, options = {}) {
  const wordsPerSecond = options.wordsPerSecond || 2.5;
  const defaultSceneDuration = options.defaultSceneDuration || 5;
  const audioDurations = options.audioDurations || {};
  const audioAssets = options.audioAssets || {};
  const animations = options.animations || {};
  const animFor = (id) => (animations instanceof Map ? animations.get(id) : animations?.[id]) || [];
  return (scenes || []).map((sc) => {
    const sceneId = sc.id;
    let narrationSeconds = defaultSceneDuration;
    let measured = false;
    if (audioDurations[sceneId] !== undefined) {
      narrationSeconds = audioDurations[sceneId];
      measured = true;
    } else if (audioAssets[sceneId]?.durationSeconds !== undefined) {
      narrationSeconds = audioAssets[sceneId].durationSeconds;
      measured = true;
    } else if (sc.narration && sc.narration.trim().length > 0) {
      const words = sc.narration.trim().split(/\s+/).length;
      narrationSeconds = Math.max(3, words / wordsPerSecond);
    }
    const animationSeconds = animFor(sceneId).reduce((m, a) => Math.max(m, Number(a?.durationSeconds) || 0), 0);
    // `narration:: on` (the scene has narration): the narration alone sets the length,
    // an animation is trimmed or looped to it. `narration:: off`: the media or the
    // animation sets it.
    const narrated = measured || Boolean(sc.narration && sc.narration.trim().length > 0);
    return {
      sceneId,
      slug: sc.slug,
      seconds: narrated || animationSeconds <= 0 ? narrationSeconds : animationSeconds,
      narrationSeconds,
      animationSeconds,
      measured,
    };
  });
}

/** A Layer's override key: its reserved slug, else the slug of its name. */
const layerKey = (layer) => String(layer?.slug || slugify(layer?.name)).toLowerCase();

/** The concepts whose nested Layers are inherited by every scene that uses them. */
const INHERITING_CONCEPTS = new Set(['Preset', 'Scene Kind']);

/**
 * True for a Layer nested under a Preset or a Scene Kind: it is inherited, never owned by
 * position. A positive check on purpose: `parentElement` may also be a bare concept name
 * (`'Scene'`) or carry no concept, and those are a scene's own layers.
 */
const isInheritedLayer = (layer) => INHERITING_CONCEPTS.has(layer?.parentElement?.concept);

/**
 * The Layer elements a scene inherits (issue #612 item 3), folded in the order of the
 * Universal Parameter Cascade: each level's Presets in list order, then that level's own
 * node, where the `kind` node carries the Layers nested under the Scene Kind. The fold
 * walks the very chain `bagsToChain` builds for parameters, so layers and parameters
 * never disagree on precedence. A nearer contribution replaces an outer one of the same
 * slug. Without a preset index the Preset nodes cannot be expanded; only the kind layers fold.
 * @param {{ grammar: object, kindName: unknown, bags: Record<string, any> }} input
 * @returns {object[]} Layer elements, outer first
 */
export function inheritedLayers({ grammar, kindName, bags }) {
  const chainBags = bags.presetIndex ? bags : withoutPresets(bags);
  const byKey = new Map();
  for (const node of bagsToChain(chainBags).nodes) {
    const at = node.id.indexOf(':preset:');
    const layers =
      at !== -1
        ? lookupPreset(chainBags.presetIndex, node.id.slice(at + ':preset:'.length)).layers || []
        : node.id === 'kind'
          ? kindLayersOf(grammar, kindName)
          : [];
    for (const layer of layers) {
      byKey.delete(layerKey(layer));
      byKey.set(layerKey(layer), layer);
    }
  }
  return [...byKey.values()];
}

function withoutPresets(bags) {
  const out = {};
  for (const [level, bag] of Object.entries(bags || {})) {
    if (bag && typeof bag === 'object' && !Array.isArray(bag) && Object.hasOwn(bag, 'presets')) {
      const { presets: _presets, ...rest } = bag;
      out[level] = rest;
    } else out[level] = bag;
  }
  return out;
}

/**
 * A scene's effective Layer elements: the inherited ones not overridden, in fold order,
 * then the scene's own in document order. A scene Layer replaces an inherited one of the
 * same slug whole; no inherited field leaks into it.
 */
export function effectiveLayers(inherited, own) {
  const ownKeys = new Set(own.map(layerKey));
  return [...inherited.filter((layer) => !ownKeys.has(layerKey(layer))), ...own];
}

/**
 * Assigns Layers to Scenes. The L3 `# NN index` cannot carry element nesting
 * (the validator rejects element entries), so ownership is derived from the
 * stable `slug`: a Layer belongs to the Scene whose slug names it; an unmatched
 * Layer falls back to the document-order Scene before it (DEV-1 reconciliation).
 */
export function assignLayersToScenes(sceneElements, layerElements) {
  const sceneSlugs = sceneElements.map((s) => (s.slug || slugify(s.name)).toLowerCase());
  const buckets = sceneElements.map(() => []);
  let last = 0;
  for (const layer of layerElements) {
    let idx = -1;
    // 1. Prioritize explicit parentSlug
    if (layer.parentSlug) {
      const pslug = String(layer.parentSlug).toLowerCase();
      idx = sceneSlugs.findIndex((s) => s === pslug);
    }
    // 2. Prioritize explicit parentElement (slug or name)
    if (idx === -1 && layer.parentElement) {
      if (layer.parentElement.slug) {
        const pslug = String(layer.parentElement.slug).toLowerCase();
        idx = sceneSlugs.findIndex((s) => s === pslug);
      }
      if (idx === -1 && layer.parentElement.name) {
        const pname = String(layer.parentElement.name).toLowerCase();
        idx = sceneElements.findIndex((s) => s.name.toLowerCase() === pname);
      }
    }
    // 3. Fall back to legacy slug prefix matching
    if (idx === -1) {
      const lslug = (layer.slug || slugify(layer.name)).toLowerCase();
      idx = sceneSlugs.findIndex((s) => s && lslug.includes(s));
    }
    // 4. Fall back to preceding scene
    if (idx === -1) idx = sceneSlugs.length > 0 ? last : -1;
    if (idx >= 0) {
      last = idx;
      buckets[idx].push(layer);
    }
  }
  return buckets;
}

export class SceneCompiler {
  /**
   * @param {Object} [options]
   * @param {number} [options.fps=30]
   * @param {number} [options.width] Overrides the resolved `master_resolution`
   * @param {number} [options.height]
   * @param {number} [options.wordsPerSecond=2.5]
   * @param {number} [options.defaultSceneDuration=5]
   */
  constructor(options = {}) {
    this.fps = options.fps || 30;
    // The master size is declared data (`master_resolution`), never an engine
    // default: no width/height fallback lives in code.
    this.width = options.width;
    this.height = options.height;
    this.wordsPerSecond = options.wordsPerSecond || 2.5;
    this.defaultSceneDuration = options.defaultSceneDuration || 5;
    /** Non-fatal compiler warnings. */
    this.warnings = [];
  }

  /** Records a non-fatal warning and keeps it for inspection by callers/tests. */
  warn(message) {
    this.warnings.push(message);
    console.warn(`[scene-compiler] ${message}`);
  }

  /**
   * Pre-compile guard: enforces exactly one Video per document and the
   * `type::` → required-Fields conditional contract. Runs before any lowering,
   * manifest, or synthesis so an invalid document never spends a cent.
   * @param {object} model Structured iNNfo model
   * @param {{ conditionalFields?: Record<string,string[]> }} [options]
   * @returns {{ ok: boolean, errors: Array<{ code: string, message: string }> }}
   */
  checkScript(model, options = {}) {
    const errors = [];
    const elements = model?.elements || {};
    const videos = elements.Video || [];
    if (videos.length !== 1) {
      errors.push({ code: 'one-video-per-document', message: `expected exactly one Video, found ${videos.length}` });
    }
    // No declared duration or timing on any Concept (spec "No Declared Duration
    // or Timing"). The blueprint defines no such field; duration is derived.
    for (const [concept, list] of Object.entries(elements)) {
      for (const el of list || []) {
        for (const key of Object.keys(el?.fields || {})) {
          if (TIMING_FIELD_NAMES.has(key.toLowerCase())) {
            errors.push({
              code: 'declared-duration',
              message: `${concept} "${el.name}" declares forbidden timing field "${key}"; duration/timing is derived by the engine, never declared`,
            });
          }
        }
      }
    }
    const conditional = options.conditionalFields || { ...LEGACY_LAYER_FIELDS, ...CONDITIONAL_FIELDS };
    const guardBags = options.bags || null;
    const videoFields = (elements.Video || [])[0]?.fields || {};
    const sceneFieldsBySlug = new Map();
    for (const sceneEl of elements.Scene || []) {
      const key = sceneEl.slug || slugify(sceneEl.name);
      if (key) sceneFieldsBySlug.set(key, sceneEl.fields || {});
    }
    // The cascade bags a Layer resolves through, exactly as lowering builds them:
    // its owning Scene (same ownership rule), that Scene's Kind presets, the Video,
    // and the outer levels in `bags`. A conditional field may be satisfied there.
    const grammar = options.grammar || (options.scriptDir ? loadSeriesGrammar(options.scriptDir) : { kinds: {}, chrome: {} });
    // Each Layer the guard checks, with the Scene it renders in: the Scene's own Layers (same
    // ownership rule as lowering; a Layer nested under a Preset or Scene Kind is never owned
    // by position) and, per Scene, the Layers it inherits from its Kind and Presets.
    const entries = [];
    const ownLayers = (elements.Layer || []).filter((l) => !isInheritedLayer(l));
    const ownBuckets = assignLayersToScenes(elements.Scene || [], ownLayers);
    const ownerOf = new Map();
    ownBuckets.forEach((bucket, i) => {
      for (const l of bucket) ownerOf.set(l, elements.Scene[i] || {});
    });
    for (const l of ownLayers) {
      const owner = ownerOf.get(l);
      entries.push({ layer: l, scene: owner, sceneFields: owner?.fields || sceneFieldsBySlug.get(l.parentSlug) || {}, inherited: false });
    }
    ownBuckets.forEach((bucket, i) => {
      const owner = elements.Scene[i] || {};
      const fields = owner.fields || {};
      const kindBag = kindBagOf(grammar, fields.kind);
      let inherited = [];
      try {
        inherited = inheritedLayers({
          grammar,
          kindName: fields.kind,
          bags: { ...(guardBags || {}), ...(kindBag ? { kind: kindBag } : {}), video: videoFields, scene: fields },
        });
      } catch (err) {
        // A broken preset reference is reported once by the preset check below.
        if (!err?.code) throw err;
      }
      for (const l of effectiveLayers(inherited, bucket).filter((x) => !bucket.includes(x))) {
        entries.push({ layer: l, scene: owner, sceneFields: fields, inherited: true });
      }
    });
    const layerBags = (entry) => {
      const kindBag = kindBagOf(grammar, entry.sceneFields.kind);
      return { ...(guardBags || {}), ...(kindBag ? { kind: kindBag } : {}), video: videoFields, scene: entry.sceneFields, layer: entry.layer.fields || {} };
    };
    // Preset reference errors are reported by the same guard, before any spend.
    if (guardBags) {
      const seen = new Set(errors.map((e) => e.code + '|' + e.message));
      const targets = [
        { ...guardBags, video: videoFields },
        ...[...sceneFieldsBySlug.values()].map((fields) => ({ ...guardBags, video: videoFields, scene: fields })),
      ];
      for (const bags of targets) {
        try {
          resolve('voice', bags);
        } catch (err) {
          if (err && err.code) {
            const key = err.code + '|' + err.message;
            if (!seen.has(key)) {
              seen.add(key);
              errors.push({ code: err.code, message: err.message });
            }
          } else {
            throw err;
          }
        }
      }
    }
    // An inherited Layer is checked in every Scene that uses it, but reported once.
    const reported = new Set();
    for (const entry of entries) {
      const { layer } = entry;
      const report = (error) => {
        const key = error.code + '|' + error.message;
        if (entry.inherited && reported.has(key)) return;
        reported.add(key);
        errors.push(error);
      };
      const type = layer.fields?.type;
      if (!type) {
        report({ code: 'layer-type-required', message: `Layer "${layer.name}" has no type::` });
        continue;
      }
      // `inputs` carries data into an animation project; no other Layer type reads it.
      if (layer.fields?.inputs !== undefined && layer.fields?.inputs !== null) {
        if (type !== 'animation') {
          report({
            code: 'inputs-not-animation',
            message: `Layer "${layer.name}" (type:: ${type}) declares inputs::, which only an animation Layer accepts`,
          });
        } else {
          const { errors: inputErrors } = parseLayerInputs(layer.fields.inputs);
          if (inputErrors.length > 0) {
            report({ code: 'inputs-invalid', message: `Layer "${layer.name}" inputs:: ${inputErrors.join('; ')}` });
          }
        }
      }
      if (type === 'text') {
        const style = layer.fields?.style;
        const binding = style ? TYPE_RENDERERS[style] : null;
        if (!style || !binding || binding.kind !== 'overlay') {
          report({
            code: 'unknown-text-style',
            message: `Layer "${layer.name}" (type:: text) has unknown or missing style:: "${style}"`,
          });
          continue;
        }
      }
      const required = conditional[type];
      if (!required) {
        report({ code: 'unknown-layer-type', message: `Layer "${layer.name}" has type:: "${type}"` });
        continue;
      }
      // An `avatar` Layer is a paid lip-sync job driven by its Scene's narration, so a Scene
      // with no narration has nothing to sync. Refuse it here, before any spend, and name the
      // type that draws a still: the still image the animatic shows is a pipeline state, not a
      // mode of the Layer (spec "Animatic and Avatars").
      if (type === 'avatar' && !String(entry.scene?.description || '').trim()) {
        const sceneName = entry.scene?.name || '(unowned)';
        report({
          code: 'avatar-requires-narration',
          message:
            `Layer "${layer.name}" (type:: avatar) belongs to Scene "${sceneName}", which has no narration. ` +
            `An avatar Layer is a paid lip-sync job and needs that Scene's narration; ` +
            `a presenter that does not speak is type:: media with placement:: full and timing:: scene.`,
        });
      }
      // caption defaults to the owning Scene body: `text` is not strictly required.
      if (type === 'caption' || (type === 'text' && layer.fields?.style === 'caption')) continue;
      const present = (value) => value !== undefined && value !== null && String(value).trim() !== '';
      const hasAny = required.some((field) => {
        if (present(layer.fields?.[field])) return true;
        // A cascade parameter may be satisfied by another level. An avatar Layer's
        // image (`asset`) comes from the cascaded `avatar` when the Layer declares
        // none, exactly as `lowerLayer` reads it: from the Layer's or Scene's own
        // `presets`, the Scene Kind's presets, the Video, the Series or the domain
        // defaults (design D7). Resolution stays pure and offline, so the guard
        // still runs before any spend.
        const isAvatar = type === 'avatar' || type === 'presenter';
        if ((field === 'avatar' || (field === 'asset' && isAvatar)) && guardBags) {
          return present(resolve('avatar', layerBags(entry)).value);
        }
        return false;
      });
      if (!hasAny) {
        report({
          code: 'missing-conditional-field',
          message: `Layer "${layer.name}" (type:: ${type}) requires one of: ${required.join(', ')}`,
        });
      }
    }
    return { ok: errors.length === 0, errors };
  }

  /**
   * Lowers a structured iNNfo model into the internal
   * `{ title, fps, width, height, scenes[] }` shape.
   * @param {object} model read_knowledge-shaped model
   * @param {{ bags?: Record<string, Record<string, unknown>>, fps?: number, width?: number, height?: number }} [options]
   */
  lowerKnowledgeModel(model, options = {}) {
    const elements = model?.elements || {};
    const videos = elements.Video || [];
    const sceneElements = elements.Scene || [];
    const layerElements = elements.Layer || [];
    const bags = options.bags || {};
    // A Layer nested under a Preset or a Scene Kind is inherited, never owned by position.
    const buckets = assignLayersToScenes(sceneElements, layerElements.filter((l) => !isInheritedLayer(l)));
    const videoEl = videos[0] || {};

    // The series grammar: Scene Kinds and Chrome declared by the Series document
    // (capability video-scene-kinds). A caller may inject it (tests, `produce`).
    const grammar = options.grammar || (options.scriptDir ? loadSeriesGrammar(options.scriptDir) : { kinds: {}, chrome: {} });
    const kindErrors = validateSceneKinds(model, grammar);
    if (kindErrors.length > 0) {
      throw Object.assign(new Error(kindErrors.map((e) => e.message).join(' ')), { code: kindErrors[0].code, errors: kindErrors });
    }
    const language = resolve('language', { ...bags, video: videoEl.fields || {} }).value;
    const languageError = validateLanguage(model, language);
    if (languageError) {
      throw Object.assign(new Error(languageError.message), { code: languageError.code, errors: [languageError] });
    }

    const scenes = sceneElements.map((sc, i) => {
      const slug = sc.slug || slugify(sc.name);
      const sceneId = `scene_${slug}`;
      const fields = sc.fields || {};
      // The scene bag is the most specific element level; `video` is the
      // enclosing Video element; `kind` is the Scene Kind's expanded presets,
      // which sit between `series` and `video` (design A6). `series`/`domain`/
      // `blueprint` ride in `bags`, and every level's `presets` expand there.
      const kindBag = kindBagOf(grammar, fields.kind);
      const sceneBags = { ...bags, ...(kindBag ? { kind: kindBag } : {}), video: videoEl.fields || {}, scene: fields };
      const backgroundAudio = resolve('background_audio', sceneBags).value;
      const backgroundVolume = resolve('background_audio_volume', sceneBags, {
        accept: (v) => v !== undefined && v !== null && String(v).trim() !== '' && Number.isFinite(Number(v)),
      }).value;
      const transition = resolve('transition', sceneBags).value;
      // `frame` is a cascade parameter resolved per scene (design D18); the file
      // for the resolved name is located by the caller's nearest-folder walk.
      const frame = resolve('frame', sceneBags);
      // Voice delivery resolves through the same cascade as every other
      // parameter: a Preset, a scope document or the element may supply it, and
      // an explicit Scene field beats any Preset (design D4/D5).
      const voiceModel = resolve('voice_model', sceneBags).value;
      const voice = resolve('voice', sceneBags).value;
      const voiceSpeed = resolve('voice_speed', sceneBags, {
        accept: (v) => v !== undefined && v !== null && String(v).trim() !== '' && Number.isFinite(Number(v)),
      }).value;
      const voiceEmotion = resolve('voice_emotion', sceneBags).value;
      const properties = {};
      if (backgroundAudio) properties.scene_background_audio = backgroundAudio;
      if (backgroundVolume !== null) {
        properties.scene_background_audio_volume = Number(backgroundVolume);
      }
      if (voiceModel !== null && voiceModel !== undefined) properties.scene_voice_model = voiceModel;
      if (voice !== null && voice !== undefined) properties.scene_voice = voice;
      if (voiceSpeed !== null && voiceSpeed !== undefined) properties.scene_voice_speed = Number(voiceSpeed);
      if (typeof voiceEmotion === 'string' && voiceEmotion.trim() !== '') {
        properties.scene_voice_emotion = voiceEmotion.trim();
      }
      const sceneLanguage = resolve('language', sceneBags).value || language;
      if (sceneLanguage) properties.scene_language = sceneLanguage;
      // `voice_tone` is authoring guidance only and is deliberately not read
      // here: it must never reach the TTS payload or the cache key (design D6).

      // The scene's Layers: those it inherits from its Kind and Presets (cascade order), minus
      // any it overrides by slug, then its own (issue #612 item 3).
      const inherited = inheritedLayers({ grammar, kindName: fields.kind, bags: sceneBags });
      const layers = effectiveLayers(inherited, buckets[i]).map((layer, j) =>
        this.lowerLayer(layer, sceneId, j, sceneBags, { scriptDir: options.scriptDir }),
      );
      // Kind chrome: series wallpaper applied per kind, resolved for the cascaded
      // language (capability video-scene-kinds). It becomes ordinary overlays/music,
      // so the scene document never repeats it.
      const chrome = chromeFieldsFor(grammar, fields.kind, language);
      if (chrome.missing.length > 0) {
        throw Object.assign(
          new Error(
            `missing-chrome-language: kind "${fields.kind}" lists ${chrome.missing.join(', ')} but no Chrome element for language "${language}" declares it.`,
          ),
          { code: 'missing-chrome-language' },
        );
      }
      if (chrome.fields.watermark) {
        layers.push(
          this.lowerLayer({ name: 'Chrome watermark', fields: { type: 'watermark', text: chrome.fields.watermark } }, sceneId, layers.length, sceneBags),
        );
      }
      if (chrome.fields.cta) {
        layers.push(
          this.lowerLayer({ name: 'Chrome cta', fields: { type: 'title', text: chrome.fields.cta } }, sceneId, layers.length, sceneBags),
        );
      }
      if (chrome.fields.music && !properties.scene_background_audio) {
        properties.scene_background_audio = chrome.fields.music;
      }
      return {
        id: sceneId,
        name: sc.name,
        slug,
        kind: fields.kind ? String(fields.kind) : null,
        narration: String(sc.description || '').trim(),
        transition: transition || null,
        frame: { value: frame.value, source: frame.source },
        music: backgroundAudio || null,
        properties,
        layers,
      };
    });

    // Fixed scenes: a Scene Kind whose `fixed` is not `none` is inserted by the engine,
    // in placed order, so the episode never declares a bumper itself (capability
    // video-scene-kinds "Fixed Scenes Are Inserted By The Engine").
    const fixedScenes = [];
    for (const kind of Object.values(grammar.kinds || {})) {
      const placement = String(kind.fields.fixed || 'none').trim();
      if (!placement || placement === 'none') continue;
      const fixedId = `scene_${slugify(kind.name)}`;
      const media = kind.fields.asset
        ? [this.lowerLayer({ name: `${kind.name} media`, fields: { type: 'background', asset: kind.fields.asset } }, fixedId, 0, bags)]
        : [];
      fixedScenes.push({
        placement,
        scene: {
          id: fixedId,
          name: kind.name,
          slug: slugify(kind.name),
          kind: kind.name,
          narration: '',
          transition: null,
          frame: { value: null, source: null },
          music: kind.fields.music || null,
          properties: {},
          layers: media,
          fixed: true,
        },
      });
    }
    for (const { placement, scene: fixed } of fixedScenes) {
      if (placement === 'first') scenes.unshift(fixed);
      else if (placement === 'last') scenes.push(fixed);
      else if (placement.startsWith('after:')) {
        const anchor = placement.slice('after:'.length).trim();
        const at = scenes.findIndex((s) => s.kind === anchor);
        if (at === -1) {
          this.warnings.push(`fixed scene "${fixed.kind}" has no "${anchor}" scene to follow; it was not inserted.`);
        } else {
          scenes.splice(at + 1, 0, fixed);
        }
      }
    }

    // Every entry of the declared `output_formats` is a native output canvas (spec S1/S3);
    // the first is the primary format and sizes the lowered model. The retired
    // `master_resolution` stays readable for documents written before V_0-15-0 as a
    // one-format list.
    const formats = resolve('output_formats', { ...bags, video: videoEl.fields || {} }).value;
    const legacyMaster = resolve('master_resolution', { ...bags, video: videoEl.fields || {} }).value;
    const outputFormats = parseOutputFormats(formats);
    if (outputFormats.length === 0 && legacyMaster != null && String(legacyMaster).trim() !== '') {
      const m = /^(\d+)x(\d+)$/.exec(String(legacyMaster).trim());
      if (!m) {
        throw new Error(
          `unsupported-master-resolution: "${legacyMaster}" — expected <width>x<height>, for example 1920x1080`,
        );
      }
      outputFormats.push({ size: m[0], width: Number(m[1]), height: Number(m[2]) });
    }
    const declared = outputFormats[0]?.size ?? null;
    let width = options.width ?? this.width;
    let height = options.height ?? this.height;
    if (outputFormats.length > 0 && (width === undefined || height === undefined)) {
      width = outputFormats[0].width;
      height = outputFormats[0].height;
    }

    return {
      title: videoEl.fields?.title || videoEl.name || model?.frontmatter?.title || 'video',
      slug: videoEl.slug,
      fps: options.fps || this.fps,
      width,
      height,
      masterResolution: declared,
      outputFormats,
      videoProps: {},
      frame: resolve('frame', { ...bags, video: videoEl.fields || {} }),
      scenes,
    };
  }

  /**
   * Lowers one Layer element into the internal layer shape.
   * @param {{ scriptDir?: string }} [context] the script folder `file:` inputs resolve against
   */
  lowerLayer(layer, sceneId, index, bags = {}, context = {}) {
    const fields = layer.fields || {};
    // An `animation` Layer's data inputs (issue #612 item 4). Absent, the layer carries no
    // `layer_inputs`, so its lowered shape and review hash are what they were before inputs.
    const parsedInputs = parseLayerInputs(fields.inputs);
    if (parsedInputs.errors.length > 0) {
      throw Object.assign(new Error(`inputs-invalid: Layer "${layer.name}" inputs:: ${parsedInputs.errors.join('; ')}`), {
        code: 'inputs-invalid',
      });
    }
    const inputs = parsedInputs.inputs ? readInputFiles(parsedInputs.inputs, layer.name, context.scriptDir) : undefined;
    const declared = fields.type;
    const effectiveType = declared === 'text' ? fields.style : declared;
    const binding = TYPE_RENDERERS[effectiveType] || { kind: 'layer', manifest: declared };
    // The format-independent `{ native, mismatch }` map (M5): which key applies is decided
    // per canvas at projection, so the lowered model (and the script-gate hash) never
    // depends on the output format.
    const fit = resolveFit({ ...bags, layer: fields }).value ?? undefined;
    const avatarModel = resolve('avatar_model', { ...bags, layer: fields }).value;
    // A presenter with no local asset takes the cascaded `avatar` as its source
    // (design D7); every other Layer type uses `asset` only.
    const cascadedAvatar =
      (declared === 'presenter' || declared === 'avatar') && !fields.asset ? resolve('avatar', { ...bags, layer: fields }).value : null;
    const properties = {
      layer_type: internalLayerType(effectiveType, fields.asset),
      layer_asset_source: fields.asset || cascadedAvatar || undefined,
      layer_prompt: fields.prompt,
      layer_text_content: fields.text,
      layer_z_index: fields.z_index !== undefined ? Number(fields.z_index) : undefined,
      layer_position: fields.position,
      layer_avatar_model: avatarModel ?? undefined,
      layer_avatar_resolution: fields.avatar_resolution,
      layer_fit: fit,
      // Only `inset` changes the projection (spec S6); `full` is the default and stays out
      // of the lowered model, so it never moves the script-gate hash.
      layer_placement: fields.placement === 'inset' ? 'inset' : undefined,
      layer_inputs: inputs,
    };
    for (const key of Object.keys(properties)) {
      if (properties[key] === undefined) delete properties[key];
    }
    return {
      id: `layer_${layer.slug || slugify(layer.name)}`,
      name: layer.name,
      slug: layer.slug || slugify(layer.name),
      type: effectiveType,
      kind: binding.kind,
      manifestKind: binding.manifest,
      text: fields.text,
      position: fields.position,
      enterAnimation: fields.enter_animation,
      exitAnimation: fields.exit_animation,
      properties,
      effects: [],
    };
  }

  createLowerThirdOverlay({ id, fromFrame, durationInFrames, props, enterAnimation, exitAnimation }) {
    return {
      id,
      type: 'lowerThird',
      fromFrame,
      durationInFrames,
      enterAnimation,
      exitAnimation,
      config: {
        title: props.title || '',
        position: props.position || 'bottom-left',
      },
    };
  }

  createWatermarkOverlay({ id, fromFrame, durationInFrames, props, enterAnimation, exitAnimation }) {
    return {
      id,
      type: 'watermark',
      fromFrame,
      durationInFrames,
      enterAnimation,
      exitAnimation,
      config: {
        text: props.text || '',
        position: props.position || 'bottom',
      },
    };
  }

  createKineticTitleOverlay({ id, fromFrame, durationInFrames, props, enterAnimation, exitAnimation }) {
    return {
      id,
      type: 'kineticTitle',
      fromFrame,
      durationInFrames,
      enterAnimation,
      exitAnimation,
      config: {
        heading: props.heading || '',
        anchor: props.position || 'center',
      },
    };
  }

  createCaptionsOverlay({ id, fromFrame, durationInFrames, props, narration, enterAnimation, exitAnimation }) {
    return {
      id,
      type: 'captions',
      fromFrame,
      durationInFrames,
      enterAnimation,
      exitAnimation,
      config: {
        text: props.text || narration || '',
      },
    };
  }

  createQuoteOverlay({ id, fromFrame, durationInFrames, props, enterAnimation, exitAnimation }) {
    return {
      id,
      type: 'quote',
      fromFrame,
      durationInFrames,
      enterAnimation,
      exitAnimation,
      config: { text: props.text || '' },
    };
  }

  createBrollOverlay({ id, fromFrame, durationInFrames, props, enterAnimation, exitAnimation }) {
    return {
      id,
      type: 'broll',
      fromFrame,
      durationInFrames,
      enterAnimation,
      exitAnimation,
      config: { assetPath: props.assetPath || '', fit: props.fit, position: props.position || 'center' },
    };
  }

  /**
   * Compiles a structured iNNfo model (or an already-lowered `{ scenes[] }`
   * object) into a CompositionManifest. A raw markdown string is
   * rejected: the compiler never re-parses script markdown.
   * @param {object | string} input Structured model or lowered object
   * @param {Object} [options]
    * @param {Record<string, number>} [options.audioDurations] Map of sceneId -> duration in seconds
    * @param {Record<string, { assetPath: string, sha256?: string, durationSeconds?: number }>} [options.audioAssets]
    * @param {string} [options.scriptSource="script.model"]
   * @returns {CompositionManifest}
   */
  compile(input, options = {}) {
    const scriptSource = options.scriptSource || 'script.model';
    this.warnings = [];

    let parsed;
    if (isKnowledgeModel(input)) {
      const guard = this.checkScript(input, options);
      if (!guard.ok) throw new ScriptValidationError(guard.errors);
      parsed = this.lowerKnowledgeModel(input, options);
    } else if (input && typeof input === 'object' && Array.isArray(input.scenes)) {
      parsed = input;
    } else if (typeof input === 'string') {
      throw new ScriptValidationError([
        { code: 'markdown-not-accepted', message: 'compile() accepts a structured iNNfo model, not script markdown; load it with lib/knowledge-model.mjs' },
      ]);
    } else {
      throw new Error('Invalid script input: expected a structured iNNfo model or { scenes: [] }');
    }

    const fps = options.fps || parsed.fps || this.fps;
    const width = options.width ?? parsed.width;
    const height = options.height ?? parsed.height;
    if (!width || !height) {
      throw new Error(
        'missing-master-resolution: the episode declares no master_resolution and no width/height was supplied',
      );
    }
    const audioDurations = options.audioDurations || {};
    const audioAssets = options.audioAssets || {};
    const animations = options.animations || {};
    const animFor = (id) => (animations instanceof Map ? animations.get(id) : animations?.[id]) || [];

    const compositionId = compositionIdOf(parsed.title);

    // Per-scene target durations (design D7/D14): narration measured/estimated
    // sets a narrated scene; only a scene without narration takes an animation's length.
    const durations = computeSceneDurations(parsed.scenes, {
      wordsPerSecond: this.wordsPerSecond,
      defaultSceneDuration: this.defaultSceneDuration,
      audioDurations,
      audioAssets,
      animations,
    });

    const sceneTracks = [];
    const audioTracks = [];
    const overlayTracks = [];
    let currentFrame = 0;

    for (let i = 0; i < parsed.scenes.length; i++) {
      const sc = parsed.scenes[i];
      const sceneId = sc.id || `scene_${i + 1}`;

      // 1. Duration: measured audio/media only — never declared. A narrated scene
      //    lasts its narration; an animation is trimmed or looped to it (emitter).
      const durationInSeconds = durations[i].seconds;
      const narrationDurationInFrames = Math.max(1, Math.ceil(durations[i].narrationSeconds * fps));
      const durationInFrames = Math.max(1, Math.ceil(durationInSeconds * fps));
      const fromFrame = currentFrame;
      const sceneAnimations = animFor(sceneId).map((a) => ({
        id: a.id,
        durationInFrames: Math.max(1, Math.ceil((Number(a.durationSeconds) || 0) * fps)),
        sourceDir: a.sourceDir,
        ...(a.values ? { values: a.values } : {}),
      }));

      // 2. Transition from `transition::` (fade | slide-left | slide-right | wipe | none).
      let transition;
      if (sc.transition && sc.transition !== 'none') {
        transition = { type: sc.transition, durationInFrames: Math.round(fps * 0.5) };
      }

      // 3. Drawable layers (scene background / avatar / brand).
      const drawable = sc.layers
        .filter((l) => l.kind === 'layer')
        .map((l) => ({ name: l.name, ...l.properties, effects: l.effects || [] }));

      const sceneProps = {
        title: sc.name || `Scene ${i + 1}`,
        narration: sc.narration || '',
        layers: drawable,
      };

      sceneTracks.push({
        id: sceneId,
        fromFrame,
        durationInFrames,
        props: sceneProps,
        ...(transition ? { transition } : {}),
        ...(sceneAnimations.length > 0 ? { animations: sceneAnimations, narrationDurationInFrames } : {}),
      });

      // 5. Narration audio binding.
      const boundAudio = audioAssets[sceneId];
      if (boundAudio) {
        audioTracks.push({
          id: `audio_${sceneId}`,
          sceneId,
          assetPath: boundAudio.assetPath,
          fromFrame,
          durationInFrames,
          volume: 1.0,
          sha256: boundAudio.sha256 || crypto.createHash('sha256').update(sc.narration || sceneId).digest('hex'),
        });
      }

      // 5b. Scene background audio (background_audio::), looping for the scene.
      if (sc.music) {
        if (path.isAbsolute(sc.music) || /^[A-Za-z]:[\\/]/.test(sc.music) || /^[a-z]+:\/\//i.test(sc.music)) {
          throw new Error(`Invalid background audio "${sc.music}" in scene "${sceneId}": use a path relative to the script, inside the series tree.`);
        }
        const musicVolume = sc.properties?.scene_background_audio_volume;
        audioTracks.push({
          id: `bgmusic_${sceneId}`,
          sceneId,
          kind: 'music',
          assetPath: sc.music,
          fromFrame,
          durationInFrames,
          ...(Number.isFinite(musicVolume) ? { volume: musicVolume } : {}),
          loop: true,
          sha256: crypto.createHash('sha256').update(`bgmusic:${sc.music}`).digest('hex'),
        });
      }

      // 6. Overlays from Layer `type::`, in list order.
      const sceneEnd = fromFrame + durationInFrames;
      const overlayLayers = sc.layers.filter((l) => l.kind === 'overlay');
      const sequentialLayers = overlayLayers.filter((l) => SEQUENTIAL_OVERLAY_TYPES[l.type]);
      // One equal, non-overlapping slot per sequential overlay, capped at the
      // type's default seconds so two overlays never collide within a scene.
      const seqSlotFrames = sequentialLayers.length > 0
        ? Math.max(1, Math.min(
            Math.max(1, Math.round(Math.max(...sequentialLayers.map((l) => SEQUENTIAL_OVERLAY_TYPES[l.type])) * fps)),
            Math.floor(durationInFrames / sequentialLayers.length),
          ))
        : 0;

      for (let j = 0; j < overlayLayers.length; j++) {
        const layer = overlayLayers[j];
        const ovId = `overlay_${sceneId}_${j + 1}`;
        const text = layer.text || '';
        if (layer.type === 'lower-third') {
          overlayTracks.push(this.createLowerThirdOverlay({
            id: ovId, fromFrame, durationInFrames,
            props: { title: text, position: layer.position },
            enterAnimation: layer.enterAnimation, exitAnimation: layer.exitAnimation,
          }));
        } else if (layer.type === 'watermark') {
          overlayTracks.push(this.createWatermarkOverlay({
            id: ovId, fromFrame, durationInFrames,
            props: { text, position: layer.position },
            enterAnimation: layer.enterAnimation, exitAnimation: layer.exitAnimation,
          }));
        } else if (layer.type === 'title') {
          overlayTracks.push(this.createKineticTitleOverlay({
            id: ovId, fromFrame, durationInFrames,
            props: { heading: text, position: layer.position },
            enterAnimation: layer.enterAnimation, exitAnimation: layer.exitAnimation,
          }));
        } else if (layer.type === 'caption') {
          overlayTracks.push(this.createCaptionsOverlay({
            id: ovId, fromFrame, durationInFrames,
            props: { text: text || sc.narration }, narration: sc.narration,
            enterAnimation: layer.enterAnimation, exitAnimation: layer.exitAnimation,
          }));
        } else if (layer.type === 'quote' || layer.type === 'b-roll') {
          const slotIndex = sequentialLayers.indexOf(layer);
          const frames = Math.min(seqSlotFrames, sceneEnd - (fromFrame + slotIndex * seqSlotFrames));
          const ovFrom = fromFrame + slotIndex * seqSlotFrames;
          if (frames <= 0) continue;
          if (layer.type === 'quote') {
            overlayTracks.push(this.createQuoteOverlay({
              id: ovId, fromFrame: ovFrom, durationInFrames: frames,
              props: { text },
              enterAnimation: layer.enterAnimation, exitAnimation: layer.exitAnimation,
            }));
          } else {
            overlayTracks.push(this.createBrollOverlay({
              id: ovId, fromFrame: ovFrom, durationInFrames: frames,
              props: { assetPath: layer.properties.layer_asset_source || '', position: layer.position, fit: layer.properties.layer_fit },
              enterAnimation: layer.enterAnimation, exitAnimation: layer.exitAnimation,
            }));
          }
        }
      }

      currentFrame += durationInFrames;
    }

    const totalDurationInFrames = currentFrame;
    const totalDurationInSeconds = totalDurationInFrames / fps;

    return {
      version: '1.0.0',
      compositionId,
      fps,
      width,
      height,
      totalDurationInFrames,
      totalDurationInSeconds,
      tracks: { scenes: sceneTracks, audio: audioTracks, overlays: overlayTracks },
      metadata: {
        generator: 'cogNNitive Video Engine',
        generatedAt: new Date().toISOString(),
        scriptSource,
        // The Video element's reserved slug: the render names every output after it.
        ...(parsed.slug ? { videoSlug: parsed.slug } : {}),
      },
    };
  }
}

/**
 * Parses a resolved `output_formats` value into `[{ size, width, height }]`, in order and
 * without duplicates. A list or a bracketed string is accepted; an entry that is not
 * `<W>x<H>` throws `unsupported-output-format` (before anything is synthesized or written).
 * @param {unknown} value
 * @returns {{ size: string, width: number, height: number }[]}
 */
export function parseOutputFormats(value) {
  if (value === null || value === undefined) return [];
  const entries = Array.isArray(value)
    ? value
    : String(value).replace(/^\[|\]$/g, '').split(',');
  const out = [];
  for (const raw of entries) {
    const size = String(raw ?? '').trim();
    if (size === '') continue;
    const m = /^(\d+)x(\d+)$/.exec(size);
    if (!m || Number(m[1]) <= 0 || Number(m[2]) <= 0) {
      throw new Error(`unsupported-output-format: "${size}" — expected <width>x<height>, for example 1920x1080`);
    }
    if (out.some((f) => f.size === size)) continue;
    out.push({ size, width: Number(m[1]), height: Number(m[2]) });
  }
  return out;
}

// CLI runner: accept a structured model JSON or an L3 iNNfo document.
async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scene-compiler.mjs <model.json|script_NN.md> [--out <manifest.json>]');
    process.exit(1);
  }
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx !== -1 ? process.argv[outIdx + 1] : null;

  try {
    const { loadKnowledgeModel } = await import('./lib/knowledge-model.mjs');
    const { loadCascadeBags, withScriptPresets } = await import('./lib/video-scope.mjs');
    const resolved = path.resolve(target);
    const model = loadKnowledgeModel(resolved);
    const bags = withScriptPresets(loadCascadeBags(path.dirname(resolved)), model, resolved);
    const compiler = new SceneCompiler();
    const manifest = compiler.compile(model, { bags, scriptSource: target });
    const jsonStr = JSON.stringify(manifest, null, 2);
    if (outPath) {
      fs.writeFileSync(path.resolve(outPath), jsonStr, 'utf8');
      console.log(`✅ [scene-compiler] Manifest written to ${outPath}`);
    } else {
      console.log(jsonStr);
    }
  } catch (err) {
    console.error(`❌ [scene-compiler] ${err.message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
