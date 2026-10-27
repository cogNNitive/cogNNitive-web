#!/usr/bin/env node

/**
 * nn-video-script/scripts/video-engine-cli.mjs
 *
 * Headless CLI and programmatic engine for video compilation and rendering.
 *
 * Commands:
 *   compile <script.md> [--output <manifest.json>] [--fps <n>] [--cache-dir <dir>]
 *           [--dry-run] [--allow-model <name>]... [--approval <approved.json>]
 *           [--image-model <m>] [--tts-model <m>] [--avatar-model <m>]
 *   render  <script.md|manifest.json> --output <master.mp4> [--fps <n>] [--concurrency <n>]
 *
 * Zero external mandatory runtime dependencies for compilation. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SceneCompiler, ScriptValidationError, compositionIdOf, computeSceneDurations } from './scene-compiler.mjs';
import { loadKnowledgeModel, loadTemplateModels } from './lib/knowledge-model.mjs';
import { CacheManager } from './cache-manager.mjs';
import { AssetSynthesizer } from './asset-synthesizer.mjs';
import { SpendGuard, loadGuard, resolveDefaultCacheDir, normalizeModelId, resolveWorkspace } from './lib/video-guard.mjs';
import { APPROVAL_FILENAME, checkApproval } from './lib/plan-approval.mjs';
import { loadCascadeBags, resolve, resolveKeyed } from './lib/cascade.mjs';
import { findNearest, findNearestByStem, findSeriesRoot } from './lib/nearest.mjs';
import { applyCachedAvatars } from './lib/avatar-jobs.mjs';
import { buildTtsVoiceOptions } from './lib/tts-options.mjs';
import { loadFrame } from './lib/frame-tokens.mjs';
import { probeDuration } from './lib/media-duration.mjs';
import { checkMissingAsset } from './lib/missing-asset.mjs';
import { resolveAnimations, assertAnimationIds } from './lib/animations.mjs';
import { assertSlotContract, SLOT_OF } from './overlay-blocks.mjs';
import { parseArgs, CliUsageError } from './lib/cli-args.mjs';
import { tryHyperframesRender } from './hyperframes-render.mjs';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The skill's own folder: the fallback anchor for the nearest-folder walker. */
const SKILL_DIR = path.resolve(SCRIPTS_DIR, '..');

/**
 * Named error raised when the renderer cannot render and no mock was requested. Callers
 * branch on `.name` so a missing engine is never mistaken for a successful render.
 */
export class VideoRenderError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'VideoRenderError';
    if (cause) this.cause = cause;
  }
}

/** True when `target` is `root` or lives under it. */
function isInside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolves the `frame` cascade value to its `frames/<name>.md` document (design
 * D18/D21). Every distinct name the compiler resolved (video level and each
 * scene) is walked episode > series > domain > skill; a miss follows D21 — a
 * user-level name throws `MissingAssetError`, a blueprint-only name warns once
 * and is skipped. The first resolved document is the primary frame.
 * @param {{ entries: Array<{ value: unknown, source: string | null }>, scriptDir: string, workspaceRoot: string, skillDir?: string }} params
 * @returns {{ name: string, source: string, path: string, tokens: object | null } | null}
 */
export function resolveFrame({ entries, scriptDir, workspaceRoot, skillDir = SKILL_DIR }) {
  const seen = new Set();
  let primary = null;
  for (const entry of entries || []) {
    if (!entry || entry.value === null || entry.value === undefined || String(entry.value).trim() === '') continue;
    const name = String(entry.value);
    if (seen.has(name)) continue;
    seen.add(name);
    const { path: framePath, searched } = findNearest(scriptDir, `frames/${name}.md`, {
      stopDir: workspaceRoot,
      fallbackDir: skillDir,
    });
    if (!framePath) {
      checkMissingAsset({ kind: 'frame', name, source: entry.source, searched });
      continue;
    }
    if (!primary) primary = { name, source: entry.source, ...loadFrame(framePath) };
  }
  return primary;
}

/**
 * Resolves the slot components an overlay set mounts (design D1/D5/D21). For each
 * slot, the `components` cascade gives a name, the nearest-folder walk finds
 * `components/<name>.html` (episode > series > domain > skill fallback), the D21
 * rule judges a miss, and the slot contract is asserted against the skill's
 * fallback. A component that declares fewer variables than its slot throws
 * `SlotContractError` before anything is spent.
 * @param {{ slots: string[], bags: object, scriptDir: string, workspaceRoot: string, skillDir?: string }} params
 * @returns {Record<string, { name: string, path: string, noTimeline: boolean }>}
 */
export function resolveComponents({ slots, bags, scriptDir, workspaceRoot, skillDir = SKILL_DIR }) {
  const resolved = {};
  for (const slot of slots || []) {
    const { value: name, source } = resolveKeyed('components', slot, bags || {});
    if (!name) continue;
    const { path: compPath, searched } = findNearest(scriptDir, `components/${name}.html`, {
      stopDir: workspaceRoot,
      fallbackDir: skillDir,
    });
    if (!compPath) {
      checkMissingAsset({ kind: 'component', name, source, searched });
      continue;
    }
    const contractPath = path.join(skillDir, 'components', `${slot}.html`);
    const contractHtml = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf8') : '';
    const compHtml = fs.readFileSync(compPath, 'utf8');
    assertSlotContract(slot, { path: compPath, html: compHtml, contractHtml });
    // A component whose root declares `data-no-timeline` is static: it never
    // registers a sub-composition timeline, so the emitted host must say so too
    // (otherwise HyperFrames waits its 45s readiness timeout on every render).
    resolved[slot] = { name, path: compPath, noTimeline: /data-no-timeline/.test(compHtml) };
  }
  return resolved;
}

/** Overlay slots that carry enter/exit sound events (b-roll is a layer event). */
export const SOUND_OVERLAY_SLOTS = ['title', 'lower-third', 'caption', 'quote', 'watermark'];
/** Layer types that carry a `layer-enter` sound event. */
export const SOUND_LAYER_TYPES = ['b-roll', 'animation', 'presenter'];

/**
 * Every sound key the engine supports (design D12): video start/end, every scene
 * boundary after the first, each overlay slot's enter/exit, and each layer type's
 * enter. The engine names events, never concrete sounds.
 */
export const SUPPORTED_SOUND_KEYS = [
  'video-start',
  'video-end',
  'scene-boundary',
  ...SOUND_OVERLAY_SLOTS.map((s) => `overlay-enter.${s}`),
  ...SOUND_OVERLAY_SLOTS.map((s) => `overlay-exit.${s}`),
  ...SOUND_LAYER_TYPES.map((t) => `layer-enter.${t}`),
];

/** Manifest `layer_type` -> the `layer-enter.<type>` sound key it fires. */
const LAYER_ENTER_TYPE_OF = { animation: 'animation', talking_avatar: 'presenter' };

/**
 * Times every sound event from a manifest (design D12). Returns a map of key to
 * the frames where it fires: `video-start` at 0, `video-end` at the video's end
 * frame (the caller subtracts the probed sound length), `scene-boundary` at every
 * scene after the first, overlay enter/exit at the overlay's start/end, and
 * `layer-enter.<type>` at the layer's scene start. A key with no event is absent.
 * @param {object} manifest
 * @returns {Map<string, number[]>}
 */
export function soundEventFrames(manifest) {
  const fps = Number(manifest?.fps) || 30;
  const scenes = manifest?.tracks?.scenes || [];
  const overlays = manifest?.tracks?.overlays || [];
  const totalFrames =
    Number(manifest?.totalDurationInFrames) ||
    Math.round((Number(manifest?.totalDurationInSeconds) || 0) * fps);
  /** @type {Map<string, number[]>} */
  const frames = new Map();
  const add = (key, frame) => {
    if (!frames.has(key)) frames.set(key, []);
    frames.get(key).push(frame);
  };

  add('video-start', 0);
  add('video-end', totalFrames);
  for (let i = 1; i < scenes.length; i++) add('scene-boundary', scenes[i].fromFrame || 0);
  for (const overlay of overlays) {
    const slot = SLOT_OF[overlay.type];
    if (!slot) continue;
    if (SOUND_OVERLAY_SLOTS.includes(slot)) {
      add(`overlay-enter.${slot}`, overlay.fromFrame || 0);
      add(`overlay-exit.${slot}`, (overlay.fromFrame || 0) + (overlay.durationInFrames || 0));
    }
    if (slot === 'b-roll') add('layer-enter.b-roll', overlay.fromFrame || 0);
  }
  for (const scene of scenes) {
    for (const layer of scene?.props?.layers || []) {
      const type = LAYER_ENTER_TYPE_OF[layer.layer_type];
      if (type) add(`layer-enter.${type}`, scene.fromFrame || 0);
    }
  }
  return frames;
}

/**
 * Resolves every supported sound key through the cascade and the nearest-folder
 * walk (design D2/D6/D21), before any synthesis so a user-level miss spends
 * nothing. A name with no file follows D21: a user level throws
 * `MissingAssetError`, the blueprint default is skipped with one warning.
 * @param {{ bags?: object, scriptDir: string, workspaceRoot: string, skillDir?: string }} params
 * @returns {Record<string, { name: string, source: string, path: string }>}
 */
export function resolveSoundFiles({ bags, scriptDir, workspaceRoot, skillDir = SKILL_DIR }) {
  const files = {};
  for (const key of SUPPORTED_SOUND_KEYS) {
    const { value: name, source } = resolveKeyed('sounds', key, bags || {});
    if (!name) continue;
    const { path: soundPath, searched } = findNearestByStem(scriptDir, 'sounds', name, {
      stopDir: workspaceRoot,
      fallbackDir: skillDir,
    });
    if (!soundPath) {
      checkMissingAsset({ kind: 'sound', name, source, searched });
      continue;
    }
    files[key] = { name, source, path: soundPath };
  }
  return files;
}

/**
 * Builds the root `kind:'sfx'` audio tracks for every resolved sound key that
 * fires an event (design D6/D12). Each file is staged into `publicDir`; the
 * `video-end` sound is placed at `total - probeDuration(sound)` (never negative).
 * @param {{ manifest: object, files: Record<string, { path: string }>, scriptDir: string, publicDir: string, probe?: (file: string) => Promise<{ seconds?: number }> }} params
 * @returns {Promise<Array<{ id: string, kind: 'sfx', assetPath: string, fromFrame: number }>>}
 */
export async function resolveSounds({ manifest, files, scriptDir, publicDir, probe = probeDuration }) {
  const fps = Number(manifest?.fps) || 30;
  const totalFrames =
    Number(manifest?.totalDurationInFrames) ||
    Math.round((Number(manifest?.totalDurationInSeconds) || 0) * fps);
  const framesByKey = soundEventFrames(manifest);
  const tracks = [];
  let index = 0;

  for (const [key, frames] of framesByKey) {
    const file = files?.[key];
    if (!file) continue;
    const staged = stageAsset(file.path, scriptDir, publicDir);
    if (!staged) continue;

    let occurrences = frames;
    if (key === 'video-end') {
      const probed = await probe(file.path);
      const soundFrames = Math.max(0, Math.round((Number(probed?.seconds) || 0) * fps));
      occurrences = [Math.max(0, totalFrames - soundFrames)];
    }
    const idBase = key.replace(/[^a-z0-9]+/gi, '_');
    for (const fromFrame of occurrences) {
      tracks.push({ id: `sfx_${idBase}_${index++}`, kind: 'sfx', assetPath: staged.name, fromFrame });
    }
  }
  return tracks;
}

/**
 * Resolves a media source against the script directory and stages it into the
 * project's public directory, returning the bundle-relative name. The name
 * is `<basename>_<sha256-prefix><ext>` so two sources that share a basename (an
 * in-dir `assets/x.mp4` and an out-of-dir `../shared/x.mp4`) never collide, and
 * the same source referenced twice stages once.
 * @param {string} src
 * @param {string} scriptDir
 * @param {string} publicDir
 * @returns {{ name: string, staged: boolean } | null} null when the source is empty or missing.
 */
export function stageAsset(src, scriptDir, publicDir) {
  if (!src || typeof src !== 'string') return null;
  const abs = path.isAbsolute(src) ? src : path.resolve(scriptDir, src);
  if (!fs.existsSync(abs)) return null;

  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs) || '';
  const base = path.basename(abs, ext).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'asset';
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
  const name = `${base}_${hash}${ext}`;
  const dest = path.join(publicDir, name);

  let staged = false;
  if (!fs.existsSync(dest) || !fs.readFileSync(dest).equals(buf)) {
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(dest, buf);
    staged = true;
  }
  return { name, staged };
}

/**
 * Rewrites every media reference in a compiled manifest to a staged,
 * bundle-relative name, copying the resolved source into `publicDir`.
 *
 * Sources are resolved against `scriptDir` — NOT the current working directory —
 * so both in-dir (`assets/…`) and out-of-dir (`../shared/…`) paths resolve.
 * A referenced source that cannot be resolved is collected into `missing`; the
 * caller decides how to fail. Pure filesystem work: imports no renderer module,
 * so it is the test seam.
 *
 * @param {object} manifest
 * @param {{ scriptDir: string, publicDir: string, seriesRoot?: string }} opts
 * @returns {{ staged: number, missing: string[], escaped: string[] }}
 */
export function resolveMediaLayers(manifest, opts) {
  const { scriptDir, publicDir, seriesRoot } = opts;
  const missing = [];
  const escaped = [];
  let staged = 0;

  const stageField = (obj, field) => {
    const src = obj?.[field];
    if (!src || typeof src !== 'string') return;
    const res = stageAsset(src, scriptDir, publicDir);
    if (res) {
      obj[field] = res.name;
      if (res.staged) staged++;
    } else {
      missing.push(src);
    }
  };

  const scenes = manifest?.tracks?.scenes || [];
  for (const scene of scenes) {
    const layers = scene?.props?.layers;
    if (!Array.isArray(layers)) continue;
    for (const layer of layers) stageField(layer, 'layer_asset_source');
  }

  for (const track of manifest?.tracks?.audio || []) {
    // Music must stay inside the series tree (no-upward-escape rule). Narration is cache-produced and exempt.
    if (track?.kind === 'music' && seriesRoot && typeof track.assetPath === 'string' && !isInside(seriesRoot, path.resolve(scriptDir, track.assetPath))) {
      escaped.push(track.assetPath);
      continue;
    }
    stageField(track, 'assetPath');
  }

  // Overlay tracks (b-roll, quote, lower-third, captions, kinetic titles) carry their media in
  // `config.assetPath`; stage it too, or a b-roll image 404s at render time.
  for (const track of manifest?.tracks?.overlays || []) {
    if (track?.config) stageField(track.config, 'assetPath');
  }

  return { staged, missing, escaped };
}

/**
 * @typedef {Object} VideoCompileOptions
 * @property {string} scriptPath
 * @property {string} [outputPath]
 * @property {number} [fps]
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [cacheDir]
 * @property {boolean} [synthesizeAssets=true]
 * @property {boolean} [dryRun=false] List uncached billable work + estimated total; spend nothing, write nothing.
 * @property {string[]} [allowModels] Models explicitly unlocked past the guard blocklist/allowlist (--allow-model).
 * @property {string} [approvalPath] Approved-plan artifact (defaults to <scriptDir>/asset_plan.approved.json).
 * @property {{ image?: string, tts?: string, avatar?: string }} [models] Chosen models, as passed to the cost estimator (part of plan_hash).
 * @property {(file: string) => Promise<{ seconds?: number }>} [soundProbe] Test seam for the `video-end` sound-length probe.
 * @property {Record<string, unknown>} [synthesizerOptions] Extra AssetSynthesizer options (test seam: env, fetch, sleep).
 * @property {(e: object) => void} [onProgress] Progress listener: `plan` (totals + estimated USD)
 *   first, then `tts-start`/`tts-done` and `media-start`/`media-done` with `[done/total]`,
 *   model, cache hit, `itemCostUsd` and accumulated `spentUsd`.
 */

/**
 * @typedef {Object} VideoRenderOptions
 * @property {string} [scriptPath]
 * @property {string} [manifestPath]
 * @property {string} outputVideoPath
 * @property {number} [fps]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [concurrency=4]
 * @property {number} [quality=80]
 * @property {string} [cacheDir]
 * @property {boolean} [allowMock=false] Write a mock MP4 when the renderer is unavailable.
 * @property {string[]} [allowModels] See VideoCompileOptions (used when rendering from a script).
 * @property {string} [approvalPath] See VideoCompileOptions.
 * @property {{ image?: string, tts?: string, avatar?: string }} [models] See VideoCompileOptions.
 * @property {(e: object) => void} [onProgress] See VideoCompileOptions (also covers render phases).
 */

/**
 * @typedef {Object} RenderSummary
 * @property {string} outputVideoPath
 * @property {number} totalDurationSeconds
 * @property {number} totalFrames
 * @property {number} renderTimeMs
 * @property {number} cachedAssetsUsed
 * @property {number} newAssetsSynthesized
 * @property {boolean} [mocked]
 */

/**
 * Runs every TTS / image synthesis a script needs through `synthesizer`. With a dry-run
 * synthesizer nothing is performed: billable work is only collected by its guard.
 * `onProgress` receives `{ phase: 'tts-start'|'tts-done'|'media-start'|'media-done', done, total,
 * scene, model, fromCache, itemCostUsd, spentUsd }`; `costByRef` maps the plan
 * `ref` to its estimated USD (cache hits cost 0, so `spentUsd` is real accumulated spend).
 * @param {any} parsed Parsed script (layers receive `layer_asset_source` for real runs).
 * @param {AssetSynthesizer} synthesizer
 * @param {{ image?: string, tts?: string, avatar?: string }} models Chosen models (same flags as the estimator).
 * @param {(e: object) => void} [onProgress]
 * @param {Map<string, number>} [costByRef]
 */
async function synthesizeScriptAssets(parsed, synthesizer, models, onProgress = () => {}, costByRef = new Map(), bags = {}) {
  const audioAssets = {};
  let cachedAssetsUsed = 0;
  let newAssetsSynthesized = 0;
  let spentUsd = 0;
  const ttsScenes = parsed.scenes.filter((sc) => sc.narration && sc.narration.trim().length > 0);
  const mediaTotal = parsed.scenes.reduce(
    (n, sc) => n + (Array.isArray(sc.layers) ? sc.layers.filter((l) => l.properties?.layer_prompt || l.properties?.prompt).length : 0),
    0,
  );
  let ttsDone = 0;
  let mediaDone = 0;
  /** Real accumulated spend: cache hits cost 0, misses cost the planned estimate. */
  const charge = (ref, fromCache) => {
    const itemCostUsd = fromCache ? 0 : Math.round((costByRef.get(ref) || 0) * 1e6) / 1e6;
    spentUsd = Math.round((spentUsd + itemCostUsd) * 1e6) / 1e6;
    return itemCostUsd;
  };

  for (const sc of parsed.scenes) {
    // 1. TTS synthesis
    if (sc.narration && sc.narration.trim().length > 0) {
      const voiceOptions = buildTtsVoiceOptions(sc, models, bags);
      const ttsModel = normalizeModelId(sc.properties?.scene_tts_model);
      onProgress({ phase: 'tts-start', done: ttsDone, total: ttsScenes.length, scene: sc.id, model: ttsModel });
      const ttsRes = await synthesizer.synthesizeTTS(sc.narration, voiceOptions, { ref: sc.id, model: ttsModel });
      if (!ttsRes.dryRun) {
        if (ttsRes.fromCache) {
          cachedAssetsUsed++;
        } else {
          newAssetsSynthesized++;
        }
        audioAssets[sc.id] = {
          assetPath: ttsRes.assetPath,
          sha256: ttsRes.sha256,
          durationSeconds: ttsRes.durationSeconds,
        };
        ttsDone++;
        const itemCostUsd = charge(sc.id, ttsRes.fromCache);
        onProgress({ phase: 'tts-done', done: ttsDone, total: ttsScenes.length, scene: sc.id, model: ttsModel, fromCache: ttsRes.fromCache, itemCostUsd, spentUsd });
      }
    }

    // 2. Layer Media synthesis (WaveSpeed / AI Image Prompts). Always runs, even when the
    //    scene had narration: image costs must be planned and billed like any other call.
    for (const layer of Array.isArray(sc.layers) ? sc.layers : []) {
      const prompt = layer.properties?.layer_prompt || layer.properties?.prompt;
      if (!prompt) continue;
      const mediaOptions = {
        provider: 'wavespeed',
        model: 'wavespeed-v1-flux',
        title: `${sc.name} — ${layer.name}`,
        accentColor: '#ef4444',
      };
      if (models.image) mediaOptions.modelOverride = models.image;
      const imageModel = normalizeModelId(resolve('image_model', bags).value);
      const ref = `${sc.id}/${layer.name}`;
      onProgress({ phase: 'media-start', done: mediaDone, total: mediaTotal, scene: sc.id, model: imageModel });
      const mediaRes = await synthesizer.resolveMedia(prompt, mediaOptions, { ref, model: imageModel });
      if (mediaRes.dryRun) continue;
      if (mediaRes.fromCache) {
        cachedAssetsUsed++;
      } else {
        newAssetsSynthesized++;
      }
      mediaDone++;
      const itemCostUsd = charge(ref, mediaRes.fromCache);
      onProgress({ phase: 'media-done', done: mediaDone, total: mediaTotal, scene: sc.id, model: imageModel, fromCache: mediaRes.fromCache, itemCostUsd, spentUsd });
      // Update layer asset source to point to cached image
      layer.properties.layer_asset_source = mediaRes.assetPath;
    }
  }
  return { audioAssets, cachedAssetsUsed, newAssetsSynthesized, spentUsd };
}

/**
 * Compiles a video script into a Composition Manifest, synthesizing and caching
 * TTS/media assets. Billable work is planned first (no spend, no writes) and the WHOLE run
 * is refused before the first charge when it is unapproved, uses a blocked model, or would
 * pass the per-run or 24h cap. With `dryRun` it only returns that plan.
 * @param {VideoCompileOptions} options
 * @returns {Promise<{ manifest: import('./scene-compiler.mjs').CompositionManifest | null, cachedAssetsUsed: number, newAssetsSynthesized: number, dryRun?: boolean, plan?: any }>}
 */
export async function compileVideo(options) {
  const scriptPath = path.resolve(options.scriptPath);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script file not found: ${scriptPath}`);
  }

  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  const scriptDir = path.dirname(scriptPath);
  const loaded = loadGuard(scriptDir);
  const models = options.models || {};
  const allowModels = options.allowModels || [];
  const approvalPath = options.approvalPath ? path.resolve(options.approvalPath) : path.join(scriptDir, APPROVAL_FILENAME);
  const checkNow = () => checkApproval({ scriptContent, models, approvalPath, allowModels, allowDelegated: loaded.config.allowDelegatedApproval === true });
  // Default cache lives at the workspace root so it is shared across series and cwd-independent.
  const cacheDir = options.cacheDir || resolveDefaultCacheDir(scriptDir);
  // One cascade: the CLI model flags are the most specific level, the script's
  // series/domain/blueprint documents the rest (design D10). No default id here.
  const bags = {
    ...(options.bags || loadCascadeBags(scriptDir)),
    cli: { image_model: models.image, tts_model: models.tts, avatar_model: models.avatar },
  };
  const synthOptions = { defaultModels: models, bags, ...(options.synthesizerOptions || {}) };
  const makeGuard = (dryRun) =>
    new SpendGuard({ config: loaded.config, root: loaded.root, allowModels, dryRun, approval: checkNow });

  const compiler = new SceneCompiler({
    fps: options.fps,
    width: options.width,
    height: options.height,
  });

  // Structured iNNfo model (read_knowledge shape or the equivalent reader) —
  // never a re-parse of the script markdown. The pre-compile guard runs before
  // any synthesis so an invalid document never spends a cent.
  const model = options.model || loadKnowledgeModel(scriptPath, { model: options.model, modelPath: options.modelPath });
  const guard = compiler.checkScript(model, options);
  if (!guard.ok) throw new ScriptValidationError(guard.errors);
  const templates = options.templates || loadTemplateModels(scriptDir);
  const parsed = compiler.lowerKnowledgeModel(model, { templates, bags, fps: options.fps, width: options.width, height: options.height });
  // Resolve the frame cascade value to its document BEFORE any synthesis or
  // render (design D18/D21): a user-level name with no file fails here, with
  // nothing spent; a blueprint-only name is skipped with one warning.
  const frameInfo = resolveFrame({
    entries: [parsed.frame, ...parsed.scenes.map((sc) => sc.frame)],
    scriptDir,
    workspaceRoot: loaded.root,
  });
  // Resolve every slot component an overlay uses BEFORE any synthesis (design
  // D1/D21): a user-level name with no file fails here, with nothing spent, and a
  // component that breaks its slot contract fails before the render.
  const overlaySlots = [
    ...new Set(
      parsed.scenes.flatMap((sc) => (Array.isArray(sc.layers) ? sc.layers : []).filter((l) => l.kind === 'overlay').map((l) => l.type)),
    ),
  ];
  const components = resolveComponents({ slots: overlaySlots, bags, scriptDir, workspaceRoot: loaded.root });
  // Resolve every authored animation project BEFORE any synthesis (design D7/D8):
  // a missing project fails loudly with nothing spent, and an id that would
  // collide with a scene slug, the root composition id, a component id or another
  // animation fails naming both.
  const animations = resolveAnimations({ scenes: parsed.scenes, scriptDir });
  assertAnimationIds({
    animations,
    sceneSlugs: parsed.scenes.map((sc) => sc.slug),
    rootId: compositionIdOf(parsed.title),
    componentIds: Object.entries(components).flatMap(([slot, c]) => [slot, c.name]),
  });
  // Resolve and D21-check every sound name BEFORE any synthesis (design D6/D21):
  // a user-level name with no file fails here, with nothing spent; a blueprint-only
  // name is skipped with one warning. The times are computed after the manifest.
  const soundFiles = resolveSoundFiles({ bags, scriptDir, workspaceRoot: loaded.root });
  let audioAssets = {};
  let cachedAssetsUsed = 0;
  let newAssetsSynthesized = 0;
  let spentUsd = 0;
  let plannedTotalUsd = 0;
  const onProgress = options.onProgress || (() => {});

  if (options.synthesizeAssets !== false || options.dryRun) {
    // Pass 1: plan. Read-only cache, dry-run guard: nothing is spent or written.
    const planGuard = makeGuard(true);
    const planSynth = new AssetSynthesizer({
      cacheManager: new CacheManager({ baseDir: cacheDir, readOnly: true }),
      guard: planGuard,
      ...synthOptions,
    });
    const planned = await synthesizeScriptAssets(structuredClone(parsed), planSynth, models, () => {}, new Map(), bags);

    if (options.dryRun) {
      // Each scene's target duration (design D14): `measured` when narration
      // audio exists, `estimated` from the word count otherwise; an authored
      // animation extends it to `max(narration, animation)`.
      const scenes = computeSceneDurations(parsed.scenes, {
        wordsPerSecond: compiler.wordsPerSecond,
        defaultSceneDuration: compiler.defaultSceneDuration,
        audioAssets,
        animations,
      }).map((d) => ({ slug: d.slug, seconds: d.seconds, measured: d.measured }));
      return {
        dryRun: true,
        manifest: null,
        cachedAssetsUsed: planned.cachedAssetsUsed,
        newAssetsSynthesized: 0,
        plan: {
          items: planGuard.planned,
          totalUsd: planGuard.plannedTotalUsd,
          budgetUsd: loaded.config.budgetPerRunUsd,
          dailyCapUsd: loaded.config.dailyCapUsd,
          dailySpentUsd: planGuard.dailySpentUsd,
          withinBudget: planGuard.plannedTotalUsd <= loaded.config.budgetPerRunUsd,
          approval: checkNow(),
          frame: frameInfo ? { name: frameInfo.name, path: frameInfo.path, source: frameInfo.source } : null,
          scenes,
        },
      };
    }

    // Pre-flight: refuse the whole run BEFORE the first charge.
    planGuard.assertPlanAffordable();

    // Totals + models + estimated cost, BEFORE the slow work starts.
    plannedTotalUsd = planGuard.plannedTotalUsd;
    const costByRef = new Map();
    for (const item of planGuard.planned) {
      if (item.blocked) continue;
      costByRef.set(item.ref, Math.round(((costByRef.get(item.ref) || 0) + item.estUsd) * 1e6) / 1e6);
    }
    const ttsTotal = parsed.scenes.filter((sc) => sc.narration && sc.narration.trim().length > 0).length;
    const mediaTotal = parsed.scenes.reduce(
      (n, sc) => n + (Array.isArray(sc.layers) ? sc.layers.filter((l) => l.properties?.layer_prompt || l.properties?.prompt).length : 0),
      0,
    );
    onProgress({
      phase: 'plan',
      ttsTotal,
      mediaTotal,
      models: [...new Set(planGuard.planned.map((p) => p.model))],
      totalUsd: plannedTotalUsd,
    });

    // Pass 2: synthesize for real.
    const synthesizer = new AssetSynthesizer({
      cacheManager: new CacheManager({ baseDir: cacheDir }),
      guard: makeGuard(false),
      ...synthOptions,
    });
    ({ audioAssets, cachedAssetsUsed, newAssetsSynthesized, spentUsd } = await synthesizeScriptAssets(parsed, synthesizer, models, onProgress, costByRef, bags));
  }

  // Avatar pickup: a lip-sync clip cached by synthesize-avatar.mjs replaces the still avatar layer
  // (cache read only: compile never synthesizes or spends on avatars).
  const avatarVideos = applyCachedAvatars({
    parsed,
    scriptDir,
    cacheManager: new CacheManager({ baseDir: cacheDir, readOnly: true }),
    audioFor: (sc) => audioAssets[sc.id]?.assetPath,
  });

  const manifest = compiler.compile(parsed, {
    audioAssets,
    animations,
    fps: options.fps,
    width: options.width,
    height: options.height,
    scriptSource: scriptPath,
  });

  // Stage every media reference (layers + audio) into a project public
  // dir next to the script, and rewrite the manifest to bundle-relative names.
  // Sources resolve against the script dir, not the cwd, so in-dir (`assets/…`)
  // and out-of-dir (`../shared/…`) paths both work. A missing asset is a loud
  // failure — never a silently dropped layer.
  const publicDir = path.join(scriptDir, 'public');
  const staging = resolveMediaLayers(manifest, { scriptDir, publicDir, seriesRoot: findSeriesRoot(scriptDir, resolveWorkspace(scriptDir).root) });
  manifest.metadata.publicDir = publicDir;

  // The resolved frame (palette + type) becomes the manifest's frame contract so
  // the emitter styles overlays from brand tokens instead of hardcoded values.
  // Absent a frame, the manifest carries nothing and the emitter keeps its own
  // defaults.
  if (frameInfo) manifest.metadata.frame = { path: frameInfo.path, tokens: frameInfo.tokens };

  // The resolved slot components ride on the manifest so the emitter mounts the
  // right file and the render driver stages it into `<project>/components/`.
  manifest.metadata.components = components;

  // Sound effects (design D6/D12): every resolved key that fires an event becomes a
  // root `kind:'sfx'` audio track at its event time, staged into the same public
  // dir. Appended after `resolveMediaLayers` so its own staging is not re-walked.
  const sfxTracks = await resolveSounds({
    manifest,
    files: soundFiles,
    scriptDir,
    publicDir,
    probe: options.soundProbe,
  });
  manifest.tracks.audio.push(...sfxTracks);

  // Keep the human-visible local audio staging dir next to the script (developer aid).
  const localAudioDir = path.join(scriptDir, 'audio');
  fs.mkdirSync(localAudioDir, { recursive: true });

  for (const [scId, audioInfo] of Object.entries(audioAssets)) {
    if (audioInfo?.assetPath && fs.existsSync(audioInfo.assetPath)) {
      const destAudio = path.join(localAudioDir, `${scId}_voiceover.mp3`);
      fs.copyFileSync(audioInfo.assetPath, destAudio);
    }
  }

  if (staging.escaped.length > 0) {
    throw new VideoRenderError(
      `Background audio escapes the series folder (no-upward-escape rule): ${staging.escaped.join(', ')}`,
    );
  }

  if (staging.missing.length > 0) {
    throw new VideoRenderError(
      `Cannot render: ${staging.missing.length} referenced asset(s) not found ` +
        `(resolved against ${scriptDir}): ${staging.missing.join(', ')}`,
    );
  }

  if (options.outputPath) {
    const outResolved = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outResolved), { recursive: true });
    fs.writeFileSync(outResolved, JSON.stringify(manifest, null, 2), 'utf8');
  }

  return { manifest, cachedAssetsUsed, newAssetsSynthesized, avatarVideos, spentUsd, plannedTotalUsd };
}

/**
 * Renders a video from a script or manifest to an MP4 output.
 * @param {VideoRenderOptions} options
 * @returns {Promise<RenderSummary>}
 */
export async function renderVideo(options) {
  const startTime = Date.now();
  const onProgress = options.onProgress || (() => {});
  let manifest;
  let cachedAssetsUsed = 0;
  let newAssetsSynthesized = 0;
  let spentUsd = 0;
  let plannedTotalUsd = 0;

  if (options.manifestPath && fs.existsSync(path.resolve(options.manifestPath))) {
    manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifestPath), 'utf8'));
  } else if (options.scriptPath) {
    const compRes = await compileVideo({
      scriptPath: options.scriptPath,
      fps: options.fps,
      width: options.width,
      height: options.height,
      cacheDir: options.cacheDir,
      synthesizeAssets: options.synthesizeAssets,
      model: options.model,
      modelPath: options.modelPath,
      templates: options.templates,
      allowModels: options.allowModels,
      approvalPath: options.approvalPath,
      models: options.models,
      onProgress,
    });
    manifest = compRes.manifest;
    cachedAssetsUsed = compRes.cachedAssetsUsed;
    newAssetsSynthesized = compRes.newAssetsSynthesized;
    spentUsd = compRes.spentUsd || 0;
    plannedTotalUsd = compRes.plannedTotalUsd || 0;
  } else {
    throw new Error('Either scriptPath or manifestPath must be provided for rendering');
  }

  const outputPath = path.resolve(options.outputVideoPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // HyperFrames is the renderer: emit the project from the manifest, then render
  // it headlessly. A failure is a loud, named, non-zero error — never a silent
  // FFmpeg fallback or a mock MP4 masquerading as a render (only `--allow-mock`).
  const projectDir = path.join(path.dirname(outputPath), 'hyperframes');
  const renderDeps = { onProgress };
  if (options.hyperframesRun) renderDeps.run = options.hyperframesRun;
  const hfResult = await tryHyperframesRender(
    {
      manifest,
      outputPath,
      concurrency: options.concurrency || 4,
      projectDir,
      extraArgs: options.hyperframesArgs,
    },
    renderDeps,
  );

  let mocked = false;
  if (!hfResult.rendered) {
    if (!options.allowMock) {
      throw new VideoRenderError(
        `HyperFrames render failed (${hfResult.reason})${hfResult.detail ? `:\n${hfResult.detail}\n\n` : '. '}Install the CLI via ensure-hyperframes.mjs, ` +
          `or pass --allow-mock for a CI placeholder MP4.`,
      );
    }
    console.warn(`[video-engine-cli] HyperFrames unavailable (${hfResult.reason}); writing mock MP4 (--allow-mock).`);
    writeMockMp4(outputPath);
    mocked = true;
  }

  const renderTimeMs = Date.now() - startTime;

  return {
    outputVideoPath: outputPath,
    totalDurationSeconds: manifest.totalDurationInSeconds,
    totalFrames: manifest.totalDurationInFrames,
    renderTimeMs,
    cachedAssetsUsed,
    newAssetsSynthesized,
    spentUsd,
    plannedTotalUsd,
    mocked,
  };
}

/**
 * Writes a minimal, valid-enough MP4 container for headless/CI environments.
 * Only ever called behind the explicit `--allow-mock` flag.
 * @param {string} outputPath
 */
function writeMockMp4(outputPath) {
  const mockMp4Header = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // ftyp
    0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65, // free
    0x00, 0x00, 0x00, 0x10, 0x6d, 0x64, 0x61, 0x74, // mdat
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  fs.writeFileSync(outputPath, mockMp4Header);
}

/**
 * Human progress reporter: plan totals + model + estimated cost first, then one
 * `[i/N]` line per asset with its cost and the accumulated spend.
 * @param {object} e Progress event (see `onProgress` in VideoCompileOptions).
 */
function cliReporter(e) {
  const tag = (n, t) => `[${n}/${t}]`;
  const money = (v) => '$' + Number(v || 0).toFixed(4);
  switch (e.phase) {
    case 'plan':
      console.log(`🎙️ Hay que generar ${e.ttsTotal} audio(s) TTS y ${e.mediaTotal} imagen(es) con: ${e.models.join(', ') || 'local (gratis)'}. Estimado: ${money(e.totalUsd)}.`);
      break;
    case 'tts-done':
      console.log(`🎙️ TTS ${tag(e.done, e.total)} escena ${e.scene} con ${e.model} — ${e.fromCache ? 'cache' : 'generado'} ${money(e.itemCostUsd)} (acumulado ${money(e.spentUsd)})`);
      break;
    case 'media-done':
      console.log(`🖼️ Media ${tag(e.done, e.total)} escena ${e.scene} con ${e.model} — ${e.fromCache ? 'cache' : 'generado'} ${money(e.itemCostUsd)} (acumulado ${money(e.spentUsd)})`);
      break;
    case 'render-start':
      console.log(`🎬 Renderizando${e.frames ? ` ${e.frames} frames` : ''}...`);
      break;
    default:
      break;
  }
}

/**
 * Prints the dry-run report: uncached billable work, estimated total, approval status.
 * @param {{ cachedAssetsUsed: number, plan: any }} result
 */
function printDryRun(result) {
  const { plan } = result;
  console.log('Dry run: nothing was synthesized, spent or written.');
  if (plan.frame) console.log('   frame ' + plan.frame.name + ': ' + plan.frame.path + ' (' + plan.frame.source + ')');
  for (const scene of plan.scenes || []) {
    console.log('   scene ' + scene.slug + ': ' + scene.seconds + 's (' + (scene.measured ? 'measured' : 'estimated') + ')');
  }
  console.log('   Cached assets (free): ' + result.cachedAssetsUsed);
  console.log('   Uncached billable calls: ' + plan.items.length);
  for (const item of plan.items) {
    const flag = item.blocked ? '  [BLOCKED: ' + item.blocked + ']' : '';
    console.log('   - ' + item.kind + ' ' + item.model + ' ~$' + item.estUsd.toFixed(4) + (item.ref ? ' (' + item.ref + ')' : '') + flag);
  }
  console.log('   Estimated total: $' + plan.totalUsd.toFixed(4) + ' (budget per run: $' + plan.budgetUsd.toFixed(2) + (plan.withinBudget ? '' : ' - OVER BUDGET') + ')');
  console.log('   Spent in the last 24h: $' + plan.dailySpentUsd.toFixed(4) + ' (daily cap: $' + plan.dailyCapUsd.toFixed(2) + ')');
  console.log('   Plan approval: ' + (plan.approval.ok ? 'approved' : 'NOT approved (' + plan.approval.reason + ')'));
}

const FLAG_SPEC = {
  boolean: ['dry-run', 'allow-mock'],
  value: [
    'output', 'out', 'script', 'manifest', 'fps', 'width', 'height', 'format', 'concurrency',
    'cache-dir', 'approval', 'image-model', 'tts-model', 'avatar-model',
  ],
  repeatable: ['allow-model'],
};

/** Named aspect presets: --format resolves to width/height unless explicit flags win. */
export const FORMAT_PRESETS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

/** @param {{ format?: string, width?: string, height?: string }} flags */
export function resolveFormatSize(flags) {
  const preset = flags.format ? FORMAT_PRESETS[flags.format] : null;
  if (flags.format && !preset) {
    throw new Error(`Unknown --format "${flags.format}" (expected 16:9, 9:16 or 1:1).`);
  }
  return {
    width: flags.width ? Number(flags.width) : preset?.width,
    height: flags.height ? Number(flags.height) : preset?.height,
  };
}

const USAGE = [
  'Usage: node video-engine-cli.mjs <compile|render> [options]',
  '  compile <script.md> [--output manifest.json] [--fps n] [--width n] [--height n] [--format 16:9|9:16|1:1] [--cache-dir dir]',
  '          [--dry-run] [--approval approved.json] [--allow-model name]...',
  '          [--image-model id] [--tts-model id] [--avatar-model id]',
  '  render  <script.md|manifest.json> --output master.mp4 [--fps n] [--width n] [--height n] [--format 16:9|9:16|1:1] [--concurrency n] [--cache-dir dir]',
  '          [--allow-mock] [--approval approved.json] [--allow-model name]... [--image-model id] [--tts-model id] [--avatar-model id]',
  '          [-- <hyperframes render flags>]   e.g. -- --workers 2 --low-memory-mode (forwarded verbatim)',
  '  --dry-run (compile only): list uncached billable work and the estimated total; spends and writes nothing.',
  '  --approval: approved plan (default <script dir>/asset_plan.approved.json); --allow-model unlocks a blocked',
  '  model only if a human recorded it in that approval. Values may also be given as --flag=value.',
].join('\n');

/** Parses argv strictly; returns `{ _, ...flags, allowModels }` or exits with the usage banner. */
function parseCliArgs(argv) {
  try {
    const { _, flags } = parseArgs(argv, FLAG_SPEC);
    return { _, ...flags, allowModels: flags['allow-model'] };
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err;
    console.error(`❌ [video-engine-cli] ${err.message}\n${USAGE}`);
    process.exit(1);
  }
}

/** Splits argv at the first literal `--`: what follows is forwarded verbatim to `hyperframes render`. */
export function splitPassthrough(argv) {
  const i = argv.indexOf('--');
  return i === -1 ? { argv, passthrough: [] } : { argv: argv.slice(0, i), passthrough: argv.slice(i + 1) };
}

async function main() {
  const { argv, passthrough } = splitPassthrough(process.argv.slice(2));
  const args = parseCliArgs(argv);
  const command = args._[0];
  if (passthrough.length > 0 && command !== 'render') {
    console.warn(`⚠️ [video-engine-cli] Arguments after "--" are ignored (only render forwards them): ${passthrough.join(' ')}`);
  }

  if (!command) {
    console.error(USAGE);
    process.exit(1);
  }

  if (args['dry-run'] && command !== 'compile') {
    console.error(`❌ [video-engine-cli] --dry-run is only supported by compile (render would execute).`);
    process.exit(1);
  }

  try {
    if (command === 'compile') {
      const scriptPath = args._[1] || args.script;
      if (!scriptPath) {
        console.error(USAGE);
        process.exit(1);
      }
      const size = resolveFormatSize(args);
      const result = await compileVideo({
        scriptPath,
        outputPath: args.output || args.out,
        fps: args.fps ? Number(args.fps) : undefined,
        width: size.width,
        height: size.height,
        cacheDir: args['cache-dir'],
        dryRun: Boolean(args['dry-run']),
        allowModels: args.allowModels,
        approvalPath: typeof args.approval === 'string' ? args.approval : undefined,
        models: { image: args['image-model'], tts: args['tts-model'], avatar: args['avatar-model'] },
        onProgress: cliReporter,
      });
      if (result.dryRun) {
        printDryRun(result);
        return;
      }
      console.log(`✅ [video-engine-cli] Compiled manifest (${result.manifest.totalDurationInFrames} frames, ${result.manifest.totalDurationInSeconds.toFixed(2)}s)`);
      console.log(`   Cached assets: ${result.cachedAssetsUsed}, New assets: ${result.newAssetsSynthesized}, Spent: $${result.spentUsd.toFixed(4)} of $${result.plannedTotalUsd.toFixed(4)} estimated`);
      if (result.avatarVideos.applied + result.avatarVideos.missing > 0) {
        console.log(`   Avatar clips: ${result.avatarVideos.applied} picked up from cache, ${result.avatarVideos.missing} still missing (run synthesize-avatar.mjs; never ad-hoc API calls). If clips exist but were not found, check that --avatar-model/--tts-model match the synthesize-avatar run.`);
      }
    } else if (command === 'render') {
      const target = args._[1] || args.script || args.manifest;
      const output = args.output || args.out;
      if (!target || !output) {
        console.error(USAGE);
        process.exit(1);
      }
      const isManifest = target.endsWith('.json');
      const renderSize = resolveFormatSize(args);
      if (isManifest && (renderSize.width || renderSize.height)) {
        console.error(`❌ [video-engine-cli] --width/--height/--format only apply when rendering from a script; re-compile the manifest instead.`);
        process.exit(1);
      }
      const result = await renderVideo({
        scriptPath: isManifest ? undefined : target,
        manifestPath: isManifest ? target : undefined,
        outputVideoPath: output,
        fps: args.fps ? Number(args.fps) : undefined,
        width: renderSize.width,
        height: renderSize.height,
        concurrency: args.concurrency ? Number(args.concurrency) : undefined,
        cacheDir: args['cache-dir'],
        allowModels: args.allowModels,
        approvalPath: typeof args.approval === 'string' ? args.approval : undefined,
        models: { image: args['image-model'], tts: args['tts-model'], avatar: args['avatar-model'] },
        allowMock: Boolean(args['allow-mock']),
        hyperframesArgs: passthrough,
        onProgress: cliReporter,
      });
      console.log(`✅ [video-engine-cli] Rendered ${result.outputVideoPath}`);
      console.log(`   Duration: ${result.totalDurationSeconds}s (${result.totalFrames} frames) in ${result.renderTimeMs}ms, Spent: $${result.spentUsd.toFixed(4)}`);
    } else {
      console.error(`Unknown command: ${command}\n${USAGE}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ [video-engine-cli] ${err.message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
