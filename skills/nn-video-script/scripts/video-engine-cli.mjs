#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/video-engine-cli.mjs
 *
 * Headless CLI and programmatic engine for Remotion compilation, rendering,
 * and preview server initialization.
 *
 * Commands:
 *   compile <script.md> [--output <manifest.json>] [--fps <n>] [--cache-dir <dir>]
 *           [--dry-run] [--allow-model <name>]... [--approval <approved.json>]
 *           [--image-model <m>] [--tts-model <m>] [--avatar-model <m>]
 *   render  <script.md|manifest.json> --output <master.mp4> [--fps <n>] [--concurrency <n>]
 *   preview <script.md|manifest.json> [--port <3000>]
 *
 * Zero external mandatory runtime dependencies for compilation. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { RemotionSceneCompiler } from './remotion-scene-compiler.mjs';
import { CacheManager } from './cache-manager.mjs';
import { AssetSynthesizer } from './asset-synthesizer.mjs';
import { SpendGuard, loadGuard, resolveDefaultCacheDir } from './lib/video-guard.mjs';
import { APPROVAL_FILENAME, checkApproval } from './lib/plan-approval.mjs';
import { DEFAULT_MODELS, resolveModelId } from './asset-cost-estimator.mjs';
import { applyCachedAvatars } from './lib/avatar-jobs.mjs';
import { refreshFaststart } from './lib/faststart.mjs';
import { buildTtsVoiceOptions } from './lib/tts-options.mjs';
import { parseArgs, CliUsageError } from './lib/cli-args.mjs';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Id registered by scripts/ScriptRoot.tsx; must match what selectComposition resolves. */
export const COMPOSITION_ID = 'script-composition';

/**
 * Named error raised when Remotion cannot render and no mock was requested. Callers
 * branch on `.name` so a missing engine is never mistaken for a successful render.
 */
export class VideoRenderError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'VideoRenderError';
    if (cause) this.cause = cause;
  }
}

/**
 * Resolves the Remotion entry point path relative to the scripts directory.
 * Does not check if the file exists.
 * @param {string} [scriptsDir]
 * @returns {string}
 */
export function resolveRemotionEntryPoint(scriptsDir = SCRIPTS_DIR) {
  return path.resolve(scriptsDir, 'remotion-entry.tsx');
}

/** True when `target` is `root` or lives under it. */
function isInside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * The series folder that owns a script: the nearest ancestor (inclusive) holding
 * `series_rules.md` or `script_template.md`. Undefined for scripts outside a series.
 * @param {string} startDir
 * @returns {string | undefined}
 */
export function findSeriesRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'series_rules.md')) || fs.existsSync(path.join(dir, 'script_template.md'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Resolves a media source against the script directory and stages it into a
 * Remotion-served public directory, returning the bundle-relative name. The name
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
 * caller decides how to fail. Pure filesystem work: imports no Remotion module,
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

  return { staged, missing, escaped };
}

/**
 * Attempts to render video using Remotion programmatic renderer.
 * Never throws; returns { rendered: true } or { rendered: false, reason: string }.
 * @param {{ manifest: object, outputPath: string, concurrency?: number }} input
 * @param {{ loadModule?: (id: string) => Promise<object|null>, scriptsDir?: string }} [deps]
 * @returns {Promise<{ rendered: true } | { rendered: false, reason: string }>}
 */
export async function tryRemotionRender(input, deps = {}) {
  const { manifest, outputPath, concurrency = 4 } = input;
  const loadModule = deps.loadModule || ((id) => import(id).catch(() => null));
  const scriptsDir = deps.scriptsDir || SCRIPTS_DIR;
  const onProgress = deps.onProgress || input.onProgress || (() => {});

  try {
    onProgress({ phase: 'bundle-start' });
    const remotionBundler = await loadModule('@remotion/bundler');
    const remotionRenderer = await loadModule('@remotion/renderer');

    if (!remotionBundler || !remotionRenderer) {
      return { rendered: false, reason: 'modules-unavailable' };
    }

    const entryPoint = resolveRemotionEntryPoint(scriptsDir);
    if (!fs.existsSync(entryPoint)) {
      return { rendered: false, reason: `entry-point-missing: ${entryPoint}` };
    }

    // Serve the staged media so `staticFile()` in the composition resolves both
    // in-dir and out-of-dir assets. Read from the manifest so a render from a
    // persisted manifest (no in-process compile) still finds the media.
    const publicDir = manifest?.metadata?.publicDir;
    if (typeof publicDir === 'string' && !fs.existsSync(publicDir)) {
      return { rendered: false, reason: `public-dir-missing: ${publicDir}` };
    }

    const serveUrl = await remotionBundler.bundle({
      entryPoint,
      webpackOverride: (config) => config,
      ...(typeof publicDir === 'string' ? { publicDir } : {}),
    });
    onProgress({ phase: 'bundle-done' });

    // The official contract: resolve the composition from the bundle, then render it.
    const composition = await remotionRenderer.selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: manifest,
    });
    onProgress({ phase: 'render-start', frames: composition?.durationInFrames });

    await remotionRenderer.renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: manifest,
      concurrency,
    });

    return { rendered: true };
  } catch (err) {
    return { rendered: false, reason: `error: ${err?.message || String(err)}` };
  }
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
 * @property {Function} [ffmpegRun] Test seam for the faststart retry on marked avatar clips.
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
 * @property {boolean} [allowMock=false] Write a mock MP4 when Remotion is unavailable.
 * @property {string[]} [allowModels] See VideoCompileOptions (used when rendering from a script).
 * @property {string} [approvalPath] See VideoCompileOptions.
 * @property {{ image?: string, tts?: string, avatar?: string }} [models] See VideoCompileOptions.
 * @property {(id: string) => Promise<object|null>} [loadModule] Remotion module loader seam.
 * @property {(e: object) => void} [onProgress] See VideoCompileOptions (also covers bundle/render phases).
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
async function synthesizeScriptAssets(parsed, synthesizer, models, onProgress = () => {}, costByRef = new Map()) {
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
      const voiceOptions = buildTtsVoiceOptions(sc, models);
      const ttsModel = resolveModelId(sc.properties?.scene_tts_model, models.tts || DEFAULT_MODELS.tts);
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
        provider: layer.properties?.layer_provider || 'wavespeed',
        model: layer.properties?.layer_generation_model || 'wavespeed-v1-flux',
        title: `${sc.name} — ${layer.name}`,
        accentColor: layer.properties?.layer_color || '#ef4444',
      };
      if (models.image) mediaOptions.modelOverride = models.image;
      const imageModel = resolveModelId(layer.properties?.layer_generation_model, models.image || DEFAULT_MODELS.image);
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
 * Compiles a video script into a Remotion Composition Manifest, synthesizing and caching
 * TTS/media assets. Billable work is planned first (no spend, no writes) and the WHOLE run
 * is refused before the first charge when it is unapproved, uses a blocked model, or would
 * pass the per-run or 24h cap. With `dryRun` it only returns that plan.
 * @param {VideoCompileOptions} options
 * @returns {Promise<{ manifest: import('./remotion-scene-compiler.mjs').RemotionCompositionManifest | null, cachedAssetsUsed: number, newAssetsSynthesized: number, dryRun?: boolean, plan?: any }>}
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
  const synthOptions = { defaultModels: models, ...(options.synthesizerOptions || {}) };
  const makeGuard = (dryRun) =>
    new SpendGuard({ config: loaded.config, root: loaded.root, allowModels, dryRun, approval: checkNow });

  const compiler = new RemotionSceneCompiler({
    fps: options.fps,
    width: options.width,
    height: options.height,
  });

  const parsed = compiler.parseScript(scriptContent);
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
    const planned = await synthesizeScriptAssets(structuredClone(parsed), planSynth, models);

    if (options.dryRun) {
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
    ({ audioAssets, cachedAssetsUsed, newAssetsSynthesized, spentUsd } = await synthesizeScriptAssets(parsed, synthesizer, models, onProgress, costByRef));
  }

  // Avatar pickup: a lip-sync clip cached by synthesize-avatar.mjs replaces the still avatar layer
  // (cache read only: compile never synthesizes or spends on avatars).
  const avatarVideos = applyCachedAvatars({
    parsed,
    scriptDir,
    cacheManager: new CacheManager({ baseDir: cacheDir, readOnly: true }),
    resolveModel: (prop) => resolveModelId(prop, models.avatar || DEFAULT_MODELS.avatar),
    audioFor: (sc) => audioAssets[sc.id]?.assetPath,
  });
  // A clip kept raw because ffmpeg was missing or failed is retried here once ffmpeg is available.
  for (const clip of avatarVideos.clips) await refreshFaststart(clip, { run: options.ffmpegRun });

  const manifest = compiler.compile(parsed, {
    audioAssets,
    fps: options.fps,
    width: options.width,
    height: options.height,
    scriptSource: scriptPath,
  });

  // Stage every media reference (layers + audio) into a Remotion-served public
  // dir next to the script, and rewrite the manifest to bundle-relative names.
  // Sources resolve against the script dir, not the cwd, so in-dir (`assets/…`)
  // and out-of-dir (`../shared/…`) paths both work. A missing asset is a loud
  // failure — never a silently dropped layer.
  const publicDir = path.join(scriptDir, 'public');
  const staging = resolveMediaLayers(manifest, { scriptDir, publicDir, seriesRoot: findSeriesRoot(scriptDir) });
  manifest.metadata.publicDir = publicDir;

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

  // Remotion is the ONLY renderer. A failure is a loud, named, non-zero error —
  // never a silent FFmpeg fallback or a mock MP4 masquerading as a render.
  const renderDeps = options.loadModule ? { loadModule: options.loadModule } : {};
  renderDeps.onProgress = onProgress;
  const remotionResult = await tryRemotionRender(
    {
      manifest,
      outputPath,
      concurrency: options.concurrency || 4,
    },
    renderDeps,
  );

  let mocked = false;
  if (!remotionResult.rendered) {
    if (!options.allowMock) {
      throw new VideoRenderError(
        `Remotion render failed (${remotionResult.reason}). Install the engine via ensure-engine.mjs, ` +
          `or pass --allow-mock for a CI placeholder MP4.`,
      );
    }
    console.warn(`[video-engine-cli] Remotion unavailable (${remotionResult.reason}); writing mock MP4 (--allow-mock).`);
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
 * Previews a video composition in Remotion Web Studio / preview server.
 * @param {Object} options
 * @param {string} [options.scriptPath]
 * @param {string} [options.manifestPath]
 * @param {number} [options.port=3000]
 */
export async function previewVideo(options) {
  const port = options.port || 3000;
  console.log(`🎬 [video-engine-cli] Starting Remotion preview on port ${port}...`);
  return {
    previewUrl: `http://localhost:${port}`,
    port,
  };
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
    case 'bundle-start':
      console.log('📦 Bundleando composición Remotion...');
      break;
    case 'bundle-done':
      console.log('📦 Bundle listo, resolviendo composición...');
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
    'output', 'out', 'script', 'manifest', 'fps', 'width', 'height', 'format', 'concurrency', 'port',
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
  'Usage: node video-engine-cli.mjs <compile|render|preview> [options]',
  '  compile <script.md> [--output manifest.json] [--fps n] [--width n] [--height n] [--format 16:9|9:16|1:1] [--cache-dir dir]',
  '          [--dry-run] [--approval approved.json] [--allow-model name]...',
  '          [--image-model id] [--tts-model id] [--avatar-model id]',
  '  render  <script.md|manifest.json> --output master.mp4 [--fps n] [--width n] [--height n] [--format 16:9|9:16|1:1] [--concurrency n] [--cache-dir dir]',
  '          [--allow-mock] [--approval approved.json] [--allow-model name]... [--image-model id] [--tts-model id] [--avatar-model id]',
  '  preview <script.md|manifest.json> [--port n]',
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

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command) {
    console.error(USAGE);
    process.exit(1);
  }

  if (args['dry-run'] && command !== 'compile') {
    console.error(`❌ [video-engine-cli] --dry-run is only supported by compile (render and preview would execute).`);
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
        onProgress: cliReporter,
      });
      console.log(`✅ [video-engine-cli] Rendered ${result.outputVideoPath}`);
      console.log(`   Duration: ${result.totalDurationSeconds}s (${result.totalFrames} frames) in ${result.renderTimeMs}ms, Spent: $${result.spentUsd.toFixed(4)}`);
    } else if (command === 'preview') {
      const target = args._[1];
      const result = await previewVideo({
        scriptPath: target?.endsWith('.md') ? target : undefined,
        manifestPath: target?.endsWith('.json') ? target : undefined,
        port: args.port ? Number(args.port) : 3000,
      });
      console.log(`✅ [video-engine-cli] Preview server ready at ${result.previewUrl}`);
    } else {
      console.error(`Unknown command: ${command}`);
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
