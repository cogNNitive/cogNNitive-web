#!/usr/bin/env node

/**
 * nn-video-script/scripts/remotion-scene-compiler.mjs
 *
 * Lowers the structured iNNfo video-script model into a typed Remotion
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

/** Background music volume when a scene declares `music::`. */
export const DEFAULT_BG_MUSIC_VOLUME = 0.2;

/**
 * `type::` → renderer binding (design table). `kind` says whether the Layer is a
 * drawable scene layer or an ephemeral overlay; `manifest` is the emitted kind.
 */
export const TYPE_RENDERERS = {
  presenter: { kind: 'layer', renderer: 'AvatarFrame', manifest: 'talking_avatar' },
  background: { kind: 'layer', renderer: 'layer-primitive', manifest: 'background' },
  'b-roll': { kind: 'overlay', renderer: 'Broll', manifest: 'broll' },
  title: { kind: 'overlay', renderer: 'KineticTitle', manifest: 'kineticTitle' },
  'lower-third': { kind: 'overlay', renderer: 'LowerThird', manifest: 'lowerThird' },
  caption: { kind: 'overlay', renderer: 'Captions', manifest: 'captions' },
  brand: { kind: 'layer', renderer: 'layer-primitive', manifest: 'image' },
  quote: { kind: 'overlay', renderer: 'Quote', manifest: 'quote' },
};

/**
 * Default `type::` → required Fields contract. Mirrors the `video-script`
 * blueprint's `validation.conditional_fields`; a caller may pass the blueprint's
 * map through `checkScript(model, { conditionalFields })` so the blueprint stays
 * the single source of truth when it is reachable.
 */
export const DEFAULT_CONDITIONAL_FIELDS = {
  presenter: ['asset', 'prompt'],
  background: ['asset', 'prompt'],
  'b-roll': ['asset', 'prompt'],
  title: ['text'],
  'lower-third': ['text'],
  quote: ['text'],
  caption: ['text'],
  brand: ['asset'],
};

/**
 * Field names that declare duration or timing. The `video-script` blueprint
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
    super(`Invalid iNNfo video-script: ${list.map((e) => `${e.code} (${e.message})`).join('; ')}`);
    this.name = 'ScriptValidationError';
    this.errors = list;
  }
}

/** Overlay layers sequenced into non-overlapping slots, and their default seconds. */
const SEQUENTIAL_OVERLAY_TYPES = { quote: 3, 'lower-third': 4, 'b-roll': 4 };

/** Extracts the instance name from a `[[Doc :: Name]]` template reference. */
function templateRefName(ref) {
  const m = /\[\[(.*?)\]\]/.exec(String(ref || ''));
  if (!m) return null;
  const parts = m[1].split('::');
  return parts[parts.length - 1].trim() || null;
}

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
    const lslug = (layer.slug || slugify(layer.name)).toLowerCase();
    let idx = sceneSlugs.findIndex((s) => s && lslug.includes(s));
    if (idx === -1) idx = sceneSlugs.length > 0 ? last : -1;
    if (idx >= 0) {
      last = idx;
      buckets[idx].push(layer);
    }
  }
  return buckets;
}

export class RemotionSceneCompiler {
  /**
   * @param {Object} [options]
   * @param {number} [options.fps=30]
   * @param {number} [options.width=1920]
   * @param {number} [options.height=1080]
   * @param {number} [options.wordsPerSecond=2.5]
   * @param {number} [options.defaultSceneDuration=5]
   */
  constructor(options = {}) {
    this.fps = options.fps || 30;
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.wordsPerSecond = options.wordsPerSecond || 2.5;
    this.defaultSceneDuration = options.defaultSceneDuration || 5;
    /** Non-fatal compiler warnings. */
    this.warnings = [];
  }

  /** Records a non-fatal warning and keeps it for inspection by callers/tests. */
  warn(message) {
    this.warnings.push(message);
    console.warn(`[remotion-scene-compiler] ${message}`);
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
    const conditional = options.conditionalFields || DEFAULT_CONDITIONAL_FIELDS;
    for (const layer of elements.Layer || []) {
      const type = layer.fields?.type;
      if (!type) {
        errors.push({ code: 'layer-type-required', message: `Layer "${layer.name}" has no type::` });
        continue;
      }
      const required = conditional[type];
      if (!required) {
        errors.push({ code: 'unknown-layer-type', message: `Layer "${layer.name}" has type:: "${type}"` });
        continue;
      }
      // caption defaults to the owning Scene body: `text` is not strictly required.
      if (type === 'caption') continue;
      const hasAny = required.some((field) => {
        const value = layer.fields?.[field];
        return value !== undefined && String(value).trim() !== '';
      });
      if (!hasAny) {
        errors.push({
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
   * @param {{ templates?: Record<string, { tool?: string, voice?: string, model?: string }>, fps?: number, width?: number, height?: number }} [options]
   */
  lowerKnowledgeModel(model, options = {}) {
    const elements = model?.elements || {};
    const videos = elements.Video || [];
    const sceneElements = elements.Scene || [];
    const layerElements = elements.Layer || [];
    const templates = options.templates || {};
    const buckets = assignLayersToScenes(sceneElements, layerElements);

    const scenes = sceneElements.map((sc, i) => {
      const slug = sc.slug || slugify(sc.name);
      const sceneId = `scene_${slug}`;
      const fields = sc.fields || {};
      const refName = templateRefName(fields.template);
      const resolvedTemplate = refName && templates[refName] ? { name: refName, ...templates[refName] } : null;
      const properties = {};
      if (fields.music) properties.scene_background_audio = fields.music;
      // Carry the resolved template's model/voice so downstream pricing + TTS
      // agree without reading any script-declared voice/model field.
      if (resolvedTemplate) {
        if (resolvedTemplate.model || resolvedTemplate.tool) properties.scene_tts_model = resolvedTemplate.model || resolvedTemplate.tool;
        if (resolvedTemplate.voice) properties.scene_voice = resolvedTemplate.voice;
      }

      const layers = buckets[i].map((layer, j) => this.lowerLayer(layer, sceneId, j));
      return {
        id: sceneId,
        name: sc.name,
        slug,
        narration: String(sc.description || '').trim(),
        template: fields.template || null,
        resolvedTemplate,
        transition: fields.transition || null,
        music: fields.music || null,
        properties,
        layers,
      };
    });

    const videoEl = videos[0] || {};
    return {
      title: videoEl.fields?.title || videoEl.name || model?.frontmatter?.title || 'video',
      fps: options.fps || this.fps,
      width: options.width || this.width,
      height: options.height || this.height,
      videoProps: {},
      scenes,
    };
  }

  /** Lowers one Layer element into the internal layer shape. */
  lowerLayer(layer, sceneId, index) {
    const fields = layer.fields || {};
    const declared = fields.type;
    const binding = TYPE_RENDERERS[declared] || { kind: 'layer', manifest: declared };
    const properties = {
      layer_type: internalLayerType(declared, fields.asset),
      layer_asset_source: fields.asset,
      layer_prompt: fields.prompt,
      layer_text_content: fields.text,
      layer_level: fields.level !== undefined ? Number(fields.level) : undefined,
      layer_position: fields.position,
    };
    for (const key of Object.keys(properties)) {
      if (properties[key] === undefined) delete properties[key];
    }
    return {
      id: `layer_${layer.slug || slugify(layer.name)}`,
      name: layer.name,
      slug: layer.slug || slugify(layer.name),
      type: declared,
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
        subtitle: props.subtitle || '',
        position: props.position || 'bottom-left',
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
        subheading: props.subheading || '',
        theme: 'dark',
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
        style: 'tiktok',
        size: 80,
        highlight: '#39E508',
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
      config: { assetPath: props.assetPath || '', fit: 'cover', position: props.position || 'center' },
    };
  }

  /**
   * Compiles a structured iNNfo model (or an already-lowered `{ scenes[] }`
   * object) into a RemotionCompositionManifest. A raw markdown string is
   * rejected: the compiler never re-parses script markdown.
   * @param {object | string} input Structured model or lowered object
   * @param {Object} [options]
   * @param {Record<string, number>} [options.audioDurations] Map of sceneId -> duration in seconds
   * @param {Record<string, { assetPath: string, sha256?: string, durationSeconds?: number }>} [options.audioAssets]
   * @param {Record<string, number>} [options.mediaDurations] Map of sceneId -> media duration in seconds
   * @param {Record<string, { tool?: string, voice?: string, model?: string }>} [options.templates] Resolved Template instances
   * @param {string} [options.scriptSource="script.model"]
   * @returns {object} RemotionCompositionManifest
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
    const width = options.width || parsed.width || this.width;
    const height = options.height || parsed.height || this.height;
    const audioDurations = options.audioDurations || {};
    const audioAssets = options.audioAssets || {};
    const mediaDurations = options.mediaDurations || {};

    const compositionId = (parsed.title || 'composition')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const sceneTracks = [];
    const audioTracks = [];
    const overlayTracks = [];
    let currentFrame = 0;

    for (let i = 0; i < parsed.scenes.length; i++) {
      const sc = parsed.scenes[i];
      const sceneId = sc.id || `scene_${i + 1}`;

      // 1. Duration: measured audio/media only — never declared.
      let durationInSeconds = this.defaultSceneDuration;
      if (audioDurations[sceneId] !== undefined) {
        durationInSeconds = audioDurations[sceneId];
      } else if (audioAssets[sceneId]?.durationSeconds !== undefined) {
        durationInSeconds = audioAssets[sceneId].durationSeconds;
      } else if (mediaDurations[sceneId] !== undefined) {
        durationInSeconds = mediaDurations[sceneId];
      } else if (sc.narration && sc.narration.trim().length > 0) {
        const words = sc.narration.trim().split(/\s+/).length;
        durationInSeconds = Math.max(3, words / this.wordsPerSecond);
      }
      const durationInFrames = Math.max(1, Math.ceil(durationInSeconds * fps));
      const fromFrame = currentFrame;

      // 2. Scene type from declared layer kinds (no invented scene_type field).
      let sceneType = 'image_motion';
      if (sc.layers.some((l) => l.type === 'title')) sceneType = 'kinetic_text';

      // 3. Transition from `transition::` (fade | slide-left | slide-right | wipe | none).
      let transition;
      if (sc.transition && sc.transition !== 'none') {
        transition = { type: sc.transition, durationInFrames: Math.round(fps * 0.5), easing: 'bezier(0.16,1,0.3,1)' };
      }

      // 4. Drawable layers (scene background / avatar / brand).
      const drawable = sc.layers
        .filter((l) => l.kind === 'layer')
        .map((l) => ({ name: l.name, ...l.properties, effects: l.effects || [] }));

      const sceneProps = {
        title: sc.name || `Scene ${i + 1}`,
        narration: sc.narration || '',
        ...(sc.resolvedTemplate ? { template: sc.resolvedTemplate } : {}),
        layers: drawable,
      };

      sceneTracks.push({
        id: sceneId,
        sceneType,
        fromFrame,
        durationInFrames,
        props: sceneProps,
        ...(transition ? { transition } : {}),
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

      // 5b. Scene background music (music::), looping for the scene.
      if (sc.music) {
        if (path.isAbsolute(sc.music) || /^[A-Za-z]:[\\/]/.test(sc.music) || /^[a-z]+:\/\//i.test(sc.music)) {
          throw new Error(`Invalid music "${sc.music}" in scene "${sceneId}": use a path relative to the script, inside the series tree.`);
        }
        audioTracks.push({
          id: `bgmusic_${sceneId}`,
          sceneId,
          kind: 'music',
          assetPath: sc.music,
          fromFrame,
          durationInFrames,
          volume: DEFAULT_BG_MUSIC_VOLUME,
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
              props: { assetPath: layer.properties.layer_asset_source || '', position: layer.position },
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
      },
    };
  }
}

// CLI runner: accept a structured model JSON or an L3 iNNfo document.
async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node remotion-scene-compiler.mjs <model.json|script_NN.md> [--out <manifest.json>]');
    process.exit(1);
  }
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx !== -1 ? process.argv[outIdx + 1] : null;

  try {
    const { loadKnowledgeModel, loadTemplateModels } = await import('./lib/knowledge-model.mjs');
    const resolved = path.resolve(target);
    const model = loadKnowledgeModel(resolved);
    const templates = loadTemplateModels(path.dirname(resolved));
    const compiler = new RemotionSceneCompiler();
    const manifest = compiler.compile(model, { templates, scriptSource: target });
    const jsonStr = JSON.stringify(manifest, null, 2);
    if (outPath) {
      fs.writeFileSync(path.resolve(outPath), jsonStr, 'utf8');
      console.log(`✅ [remotion-scene-compiler] Manifest written to ${outPath}`);
    } else {
      console.log(jsonStr);
    }
  } catch (err) {
    console.error(`❌ [remotion-scene-compiler] ${err.message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
