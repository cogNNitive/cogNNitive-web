#!/usr/bin/env node

/**
 * nn-conntent/scripts/lib/compile.mjs
 *
 * The compile primitive: turns an Episode document into the HyperFrames project and
 * its manifest, synthesizing the assets it is missing. It writes the project but
 * renders nothing.
 *
 * Usage:
 *   node lib/compile.mjs compile <script.md> [--fps n] [--cache-dir dir]
 *          [--dry-run] [--allow-model name]...
 *
 * Spend is gated by `produce` (the Episode's status and `--approve <plan_hash>`) and
 * capped per run by `SpendGuard`; there is no approval artifact on disk.
 * ESM module.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SceneCompiler, ScriptValidationError, compositionIdOf, computeSceneDurations } from '../scene-compiler.mjs';
import { loadKnowledgeModel } from './knowledge-model.mjs';
import { CacheManager } from '../cache-manager.mjs';
import { AssetSynthesizer } from '../asset-synthesizer.mjs';
import { SpendGuard, loadGuard, resolveDefaultCacheDir, normalizeModelId, resolveWorkspace } from './video-guard.mjs';
import { loadCascadeBags, resolve, resolveKeyed, findNearest, findNearestByStem, findSeriesRoot, withScriptPresets } from './video-scope.mjs';
import { applyCachedAvatars } from './avatar-jobs.mjs';
import { buildTtsVoiceOptions } from './tts-options.mjs';
import { buildImageOptions } from './image-options.mjs';
import { appendTimingRow, timingRow } from './facts.mjs';
import { assertImageSize, loadMergedCatalog } from './catalog.mjs';
import { warnUnpricedAllowedModels } from '../asset-cost-estimator.mjs';
import { loadFrame } from './frame-tokens.mjs';
import { probeDuration } from './media-duration.mjs';
import { checkMissingAsset } from './missing-asset.mjs';
import { resolveAnimations, assertAnimationIds } from './animations.mjs';
import { assertSlotContract, SLOT_OF } from '../overlay-blocks.mjs';
import { parseArgs, CliUsageError } from './cli-args.mjs';
import { assetName, linkOrCopy } from './stage-assets.mjs';


const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The skill's own folder: the fallback anchor for the nearest-folder walker. */
const SKILL_DIR = path.resolve(SCRIPTS_DIR, '..', '..');

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
    let { path: soundPath, searched } = findNearestByStem(scriptDir, 'sounds', name, {
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
 * @param {{ manifest: object, files: Record<string, { path: string }>, scriptDir: string, publicDir: string, probe?: (file: string) => Promise<{ seconds?: number }>, stageDeps?: object }} params
 * @returns {Promise<Array<{ id: string, kind: 'sfx', assetPath: string, fromFrame: number }>>}
 */
export async function resolveSounds({ manifest, files, scriptDir, publicDir, probe = probeDuration, stageDeps = {} }) {
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
    const staged = stageAsset(file.path, scriptDir, publicDir, stageDeps);
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
 * Resolves a media source against the script directory and links it into the
 * project's asset directory, returning the bundle-relative name. The name
 * is `<basename>_<sha256-prefix><ext>` so two sources that share a basename (an
 * in-dir `assets/x.mp4` and an out-of-dir `../shared/x.mp4`) never collide, and
 * the same source referenced twice stages once.
 *
 * The staged file is a HARDLINK to the source (capability "Assets Are Linked, Not
 * Copied"), so the episode folder never holds a copy of a cache entry. A refused
 * link falls back to a copy and is reported by `linkOrCopy`.
 * @param {string} src
 * @param {string} scriptDir
 * @param {string} publicDir
 * @param {{ link?: Function, copy?: Function, warn?: Function }} [deps] Staging seams (tests).
 * @returns {{ name: string, staged: boolean, mode: 'link' | 'copy' } | null} null when the source is empty or missing.
 */
export function stageAsset(src, scriptDir, publicDir, deps = {}) {
  if (!src || typeof src !== 'string') return null;
  const abs = path.isAbsolute(src) ? src : path.resolve(scriptDir, src);
  if (!fs.existsSync(abs)) return null;

  const name = assetName(abs);
  const res = linkOrCopy(abs, path.join(publicDir, name), deps);
  return { name, staged: res.staged, mode: res.mode };
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
 * @param {{ scriptDir: string, publicDir: string, seriesRoot?: string, scopeRoot?: string, stageDeps?: object }} opts
 * @returns {{ staged: number, missing: string[], escaped: string[], linkMode: 'link' | 'copy' }}
 */
export function resolveMediaLayers(manifest, opts) {
  const { scriptDir, publicDir, seriesRoot, scopeRoot, stageDeps = {} } = opts;
  const missing = [];
  const escaped = [];
  let staged = 0;
  let copyMode = false;

  const stageField = (obj, field) => {
    const src = obj?.[field];
    if (!src || typeof src !== 'string') return;
    const res = stageAsset(src, scriptDir, publicDir, stageDeps);
    if (res) {
      obj[field] = res.name;
      if (res.staged) staged++;
      if (res.mode === 'copy') copyMode = true;
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

  const rootBound = scopeRoot || seriesRoot;
  for (const track of manifest?.tracks?.audio || []) {
    // Music must stay inside the scope root tree (no-upward-escape rule). Narration is cache-produced and exempt.
    if (track?.kind === 'music' && rootBound && typeof track.assetPath === 'string' && !isInside(rootBound, path.resolve(scriptDir, track.assetPath))) {
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

  return { staged, missing, escaped, linkMode: copyMode ? 'copy' : 'link' };
}

/**
 * @typedef {Object} VideoCompileOptions
 * @property {string} scriptPath
 * @property {number} [fps]
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [cacheDir]
 * @property {boolean} [synthesizeAssets=true]
 * @property {boolean} [dryRun=false] List uncached billable work + estimated total; spend nothing, write nothing.
 * @property {string[]} [allowModels] Models explicitly unlocked past the guard blocklist/allowlist (--allow-model).
 * @property {(file: string) => Promise<{ seconds?: number }>} [soundProbe] Test seam for the `video-end` sound-length probe.
 * @property {Record<string, unknown>} [synthesizerOptions] Extra AssetSynthesizer options (test seam: env, fetch, sleep).
 * @property {{ link?: Function, copy?: Function, warn?: Function }} [stageDeps] Staging seams (tests force the copy fallback).
 * @property {{ rootDir: string, runId?: string, episode?: string, planHash?: string, linkMode?: string }} [facts] Timing-log context; each stage appends one row.
 * @property {(e: object) => void} [onProgress] Progress listener: `plan` (totals + estimated USD)
 *   first, then `tts-start`/`tts-done` and `media-start`/`media-done` with `[done/total]`,
 *   model, cache hit, `itemCostUsd` and accumulated `spentUsd`.
 */

/**
 * @typedef {Object} VideoRenderOptions
 * @property {string} [scriptPath]
 * @property {string} [manifestPath]
 * @property {number} [fps]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [concurrency=4]
 * @property {number} [quality=80]
 * @property {string} [cacheDir]
 * @property {boolean} [allowMock=false] Write a mock MP4 when the renderer is unavailable.
 * @property {string[]} [allowModels] See VideoCompileOptions (used when rendering from a script).
 * @property {string} [gsapPath] Pinned GSAP build to vendor (default: resolve the installed `gsap`).
 * @property {{ link?: Function, copy?: Function, warn?: Function }} [stageDeps] See VideoCompileOptions.
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
 * @param {{ image?: string, tts?: string, avatar?: string }} models Cascade-resolved models (part of plan_hash).
 * @param {(e: object) => void} [onProgress]
 * @param {Map<string, number>} [costByRef]
 */
async function synthesizeScriptAssets(parsed, synthesizer, models, onProgress = () => {}, costByRef = new Map(), bags = {}, catalog = null) {
  const audioAssets = {};
  let cachedAssetsUsed = 0;
  let newAssetsSynthesized = 0;
  let spentUsd = 0;
  /** Per-stage wall-clock windows for the timing log (capability video-run-facts). */
  const stageTimings = {
    tts: { start: null, end: null, calls: 0, hits: 0, misses: 0 },
    image: { start: null, end: null, calls: 0, hits: 0, misses: 0 },
  };
  const mark = (stage, startedAt, fromCache) => {
    const t = stageTimings[stage];
    t.start = t.start === null ? startedAt : Math.min(t.start, startedAt);
    t.end = t.end === null ? Date.now() : Math.max(t.end, Date.now());
    t.calls++;
    if (fromCache) t.hits++;
    else t.misses++;
  };
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
      const ttsModel = normalizeModelId(sc.properties?.scene_voice_model);
      onProgress({ phase: 'tts-start', done: ttsDone, total: ttsScenes.length, scene: sc.id, model: ttsModel });
      const ttsStartedAt = Date.now();
      const ttsRes = await synthesizer.synthesizeTTS(sc.narration, voiceOptions, { ref: sc.id, model: ttsModel });
      if (!ttsRes.dryRun) {
        mark('tts', ttsStartedAt, ttsRes.fromCache);
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
      const imageModel = normalizeModelId(resolve('image_model', bags).value);
      const imageSize = resolve('image_size', bags).value;
      // The size is validated against the merged catalog's `sizes` for the resolved model,
      // overlay included, before any provider call.
      if (imageSize) assertImageSize(catalog || loadMergedCatalog({ overlay: null }), imageModel, imageSize);
      const mediaOptions = buildImageOptions(sc, layer, { ...models, image: imageModel, imageSize });
      const ref = `${sc.id}/${layer.name}`;
      onProgress({ phase: 'media-start', done: mediaDone, total: mediaTotal, scene: sc.id, model: imageModel });
      const mediaStartedAt = Date.now();
      const mediaRes = await synthesizer.resolveMedia(prompt, mediaOptions, { ref, model: imageModel });
      if (mediaRes.dryRun) continue;
      mark('image', mediaStartedAt, mediaRes.fromCache);
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
  return { audioAssets, cachedAssetsUsed, newAssetsSynthesized, spentUsd, stageTimings };
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
  warnUnpricedAllowedModels(loaded.config);
  // The engine project IS `<episode>/hyperframes/` (capability "Engine Project Lives In The
  // Episode Folder"). An authored folder that differs from it only by case would be clobbered
  // by the regeneration, so the collision is a named error before anything is written.
  for (const entry of fs.readdirSync(scriptDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'hyperframes' && entry.name.toLowerCase() === 'hyperframes') {
      throw new VideoRenderError(
        `The episode folder holds an authored "${entry.name}" folder, which collides with the engine's ` +
          `"hyperframes/" project folder. Rename it; nothing was written.`,
      );
    }
  }
  // Render is hermetic: the emitted project loads the vendored GSAP build from `vendor/`
  // (checked when the project is emitted and when a render starts).
  const allowModels = options.allowModels || [];
  // Default cache lives at the workspace root so it is shared across series and cwd-independent.
  const cacheDir = options.cacheDir || resolveDefaultCacheDir(scriptDir);
  // One cascade and no `cli` level: every model id comes from the documents
  // (layer > scene > video > kind > series > domain > blueprint). No flag and no
  // default id supplies one.
  const bags = options.bags || loadCascadeBags(scriptDir);
  const models = {
    image: normalizeModelId(resolve('image_model', bags).value),
    tts: normalizeModelId(resolve('voice_model', bags).value),
    avatar: normalizeModelId(resolve('avatar_model', bags).value),
  };
  const checkNow = () => ({ ok: true });
  // The documents may declare a rolling 24h ceiling; the guard enforces it per call too.
  const dailyBudgetRaw = resolve('daily_budget', bags).value;
  const dailyBudgetUsd =
    dailyBudgetRaw === null || dailyBudgetRaw === undefined || dailyBudgetRaw === '' ? null : Number(dailyBudgetRaw);
  const synthOptions = { defaultModels: models, bags, ...(options.synthesizerOptions || {}) };
  const makeGuard = (dryRun) =>
    // `produce` owns the spending decision (the Episode's `status::` plus `--approve <plan_hash>`);
    // this guard enforces the per-run and rolling 24h caps and the model allow/block lists.
    new SpendGuard({ config: loaded.config, root: loaded.root, allowModels, dryRun, approval: checkNow, dailyBudgetUsd });

  const compiler = new SceneCompiler({
    fps: options.fps,
    width: options.width,
    height: options.height,
  });

  // Structured iNNfo model (read_knowledge shape or the equivalent reader) —
  // never a re-parse of the script markdown. The pre-compile guard runs before
  // any synthesis so an invalid document never spends a cent.
  const model = options.model || loadKnowledgeModel(scriptPath, { model: options.model, modelPath: options.modelPath });
  const scriptBags = withScriptPresets(bags, model, scriptPath);
  const guard = compiler.checkScript(model, { ...options, bags: scriptBags });
  if (!guard.ok) throw new ScriptValidationError(guard.errors);
  const parsed = compiler.lowerKnowledgeModel(model, { bags: scriptBags, scriptDir, fps: options.fps, width: options.width, height: options.height });
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
  // Synthesis and avatar-pickup rows are queued, then written once the staging mode is known,
  // so every stage row of the run carries the real `link_mode`.
  const stageRows = [];
  const queueStage = (row) => {
    if (options.facts) stageRows.push(row);
  };
  // One merged catalog (reference + domaiNN overlay) answers `sizes`, allowlists and prices.
  const catalog = loadMergedCatalog({ domainRoot: loaded.root });

  if (options.synthesizeAssets !== false || options.dryRun) {
    // Pass 1: plan. Read-only cache, dry-run guard: nothing is spent or written.
    const planGuard = makeGuard(true);
    const planSynth = new AssetSynthesizer({
      cacheManager: new CacheManager({ baseDir: cacheDir, readOnly: true }),
      guard: planGuard,
      ...synthOptions,
    });
    const planned = await synthesizeScriptAssets(structuredClone(parsed), planSynth, models, () => {}, new Map(), bags, catalog);

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
    let synthesisStages = null;
    ({
      audioAssets,
      cachedAssetsUsed,
      newAssetsSynthesized,
      spentUsd,
      stageTimings: synthesisStages,
    } = await synthesizeScriptAssets(parsed, synthesizer, models, onProgress, costByRef, bags, catalog));
    // One row per synthesis stage, before the compile row (capability video-run-facts
    // "Stage Timing Row Schema" and the fixed stage order of video-produce-command).
    for (const stage of ['tts', 'image']) {
      const t = synthesisStages?.[stage];
      if (!t || t.calls === 0) continue;
      queueStage({ stage, start: t.start, end: t.end, cache: { hits: t.hits, misses: t.misses } });
    }
  }

  // Avatar pickup: a lip-sync clip cached by synthesize-avatar.mjs replaces the still avatar layer
  // (cache read only: compile never synthesizes or spends on avatars).
  const avatarStartedAt = Date.now();
  const avatarVideos = applyCachedAvatars({
    parsed,
    scriptDir,
    cacheManager: new CacheManager({ baseDir: cacheDir, readOnly: true }),
    config: loaded.config,
    models,
    bags,
  });
  // The avatar stage of this run: the cache pickup. Counting it keeps the fixed stage order
  // even when the episode has no avatar Layer (and records the clips still missing).
  queueStage({
    stage: 'avatar',
    start: avatarStartedAt,
    end: Date.now(),
    cache: { hits: avatarVideos?.applied || 0, misses: avatarVideos?.missing || 0 },
  });

  const manifest = compiler.compile(parsed, {
    audioAssets,
    animations,
    fps: options.fps,
    width: options.width,
    height: options.height,
    scriptSource: scriptPath,
  });

  // Stage every media reference (layers + audio) into the project's asset dir and
  // rewrite the manifest to bundle-relative names. Sources resolve against the
  // script dir, not the cwd, so in-dir (`assets/…`) and out-of-dir (`../shared/…`)
  // paths both work. A missing asset is a loud failure — never a silently dropped
  // layer. The staged entries are HARDLINKS to the sources (capability "Assets Are
  // Linked, Not Copied"), so the episode folder holds no copy of a cache entry.
  const hyperframesDir = path.join(scriptDir, 'hyperframes');
  const assetsDir = path.join(hyperframesDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  manifest.metadata.hyperframesDir = hyperframesDir;
  manifest.metadata.assetsDir = assetsDir;
  const scopeRoot = resolveWorkspace(scriptDir).root;
  const staging = resolveMediaLayers(manifest, {
    scriptDir,
    publicDir: assetsDir,
    seriesRoot: findSeriesRoot(scriptDir),
    scopeRoot,
    stageDeps: options.stageDeps,
  });
  manifest.metadata.publicDir = assetsDir;
  manifest.metadata.linkMode = staging.linkMode;

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
    publicDir: assetsDir,
    probe: options.soundProbe,
    stageDeps: options.stageDeps,
  });
  manifest.tracks.audio.push(...sfxTracks);

  // No audio/ handoff: the narration stays in the TTS cache, and avatar
  // synthesis reads it from there (design D7).

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

  // The manifest always lands at hyperframes/manifest.json: it is engine output, not
  // a user-chosen file, and the HyperFrames project folder is regenerable.
  const manifestPath = path.join(hyperframesDir, 'manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  manifest.metadata.manifestPath = manifestPath;

  // The staging mode is known now: every queued stage row carries it.
  if (options.facts) options.facts.linkMode = staging.linkMode;
  for (const row of stageRows) recordStage(options.facts, row);

  return {
    manifest,
    cachedAssetsUsed,
    newAssetsSynthesized,
    avatarVideos,
    spentUsd,
    plannedTotalUsd,
    linkMode: staging.linkMode,
  };
}

/**
 * Appends one stage timing row when a run carries a `facts` context. A timing failure only
 * warns (capability video-run-facts), so it can never stop a render.
 */
export function recordStage(facts, { stage, start, end, render, cache, outcome }) {
  if (!facts || !facts.rootDir) return;
  appendTimingRow(
    facts.rootDir,
    timingRow({
      runId: facts.runId || 'run',
      episode: facts.episode || 'unknown',
      planHash: facts.planHash || '',
      stage,
      start,
      end,
      linkMode: facts.linkMode,
      render,
      cache,
      outcome,
    }),
  );
}

/**
 * Human progress reporter: plan totals + model + estimated cost first, then one
 * `[i/N]` line per asset with its cost and the accumulated spend.
 * @param {object} e Progress event (see `onProgress` in VideoCompileOptions).
 */
export function cliReporter(e) {
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
 * Prints the dry-run report: uncached billable work and the estimated total.
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

}
const FLAG_SPEC = {
  boolean: ['dry-run'],
  value: ['script', 'fps', 'cache-dir'],
  repeatable: ['allow-model'],
};

const USAGE = [
  'Usage: node lib/compile.mjs compile <script.md> [options]',
  '  compile <script.md> [--fps n] [--cache-dir dir] [--allow-model name]...',
  '  --dry-run: list uncached billable work and the estimated total; spends and writes nothing.',
  '  --allow-model unlocks a blocked model in the estimate. Values may also be given as --flag=value.',
].join('\n');

/** Parses argv strictly; returns `{ _, ...flags, allowModels }` or exits with the usage banner. */
function parseCliArgs(argv) {
  try {
    const { _, flags } = parseArgs(argv, FLAG_SPEC);
    return { _, ...flags, allowModels: flags['allow-model'] };
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err;
    console.error(`❌ [compile] ${err.message}\n${USAGE}`);
    process.exit(1);
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const command = args._[0];
  if (command !== 'compile') {
    console.error(USAGE);
    process.exit(1);
  }
  const scriptPath = args._[1] || args.script;
  if (!scriptPath) {
    console.error(USAGE);
    process.exit(1);
  }
  try {
    const result = await compileVideo({
      scriptPath,
      fps: args.fps ? Number(args.fps) : undefined,
      cacheDir: args['cache-dir'],
      dryRun: Boolean(args['dry-run']),
      allowModels: args.allowModels,
      onProgress: cliReporter,
    });
    if (result.dryRun) {
      printDryRun(result);
      return;
    }
    console.log(`✅ [compile] Compiled manifest (${result.manifest.totalDurationInFrames} frames, ${result.manifest.totalDurationInSeconds.toFixed(2)}s)`);
    console.log(`   Cached assets: ${result.cachedAssetsUsed}, New assets: ${result.newAssetsSynthesized}, Spent: $${result.spentUsd.toFixed(4)} of $${result.plannedTotalUsd.toFixed(4)} estimated`);
    if (result.avatarVideos.applied + result.avatarVideos.missing > 0) {
      console.log(`   Avatar clips: ${result.avatarVideos.applied} picked up from cache, ${result.avatarVideos.missing} still missing (run synthesize-avatar.mjs; never ad-hoc API calls). If clips exist but were not found, check that the episode and its Series declare the same avatar_model and voice_model that the synthesize-avatar run resolved.`);
    }
  } catch (err) {
    console.error(`❌ [compile] ${err.message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
