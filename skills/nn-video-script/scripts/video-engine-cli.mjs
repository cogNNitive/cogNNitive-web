#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/video-engine-cli.mjs
 *
 * Headless CLI and programmatic engine for Remotion compilation, rendering,
 * and preview server initialization.
 *
 * Commands:
 *   compile <script.md> [--output <manifest.json>] [--fps <n>] [--cache-dir <dir>]
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
 * @param {{ scriptDir: string, publicDir: string }} opts
 * @returns {{ staged: number, missing: string[] }}
 */
export function resolveMediaLayers(manifest, opts) {
  const { scriptDir, publicDir } = opts;
  const missing = [];
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

  for (const track of manifest?.tracks?.audio || []) stageField(track, 'assetPath');

  return { staged, missing };
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

  try {
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

    // The official contract: resolve the composition from the bundle, then render it.
    const composition = await remotionRenderer.selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: manifest,
    });

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
 * @property {(id: string) => Promise<object|null>} [loadModule] Remotion module loader seam.
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
 * Compiles a video script into a Remotion Composition Manifest, synthesizing
 * and caching TTS/media assets if requested.
 * @param {VideoCompileOptions} options
 * @returns {Promise<{ manifest: import('./remotion-scene-compiler.mjs').RemotionCompositionManifest, cachedAssetsUsed: number, newAssetsSynthesized: number }>}
 */
export async function compileVideo(options) {
  const scriptPath = path.resolve(options.scriptPath);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script file not found: ${scriptPath}`);
  }

  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  const cacheManager = new CacheManager({ baseDir: options.cacheDir });
  const synthesizer = new AssetSynthesizer({ cacheManager });
  const compiler = new RemotionSceneCompiler({
    fps: options.fps,
    width: options.width,
    height: options.height,
  });

  const parsed = compiler.parseScript(scriptContent);
  const audioAssets = {};
  let cachedAssetsUsed = 0;
  let newAssetsSynthesized = 0;

  if (options.synthesizeAssets !== false) {
    for (const sc of parsed.scenes) {
      // 1. TTS synthesis
      if (sc.narration && sc.narration.trim().length > 0) {
        const model = sc.properties?.scene_tts_model || 'elevenlabs';
        const voiceOptions = {
          model,
          voice: sc.properties?.[`${model}/voice_id`] || sc.properties?.scene_voice || 'default',
          speed: sc.properties?.[`${model}/speed`],
          emotion: sc.properties?.[`${model}/emotion`],
          pitch: sc.properties?.[`${model}/pitch`],
          intensity: sc.properties?.[`${model}/intensity`],
        };
        for (const k of Object.keys(voiceOptions)) {
          if (voiceOptions[k] === undefined) delete voiceOptions[k];
        }
        const ttsRes = await synthesizer.synthesizeTTS(sc.narration, voiceOptions);
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
      }

      // 2. Layer Media synthesis (WaveSpeed / AI Image Prompts)
      if (Array.isArray(sc.layers)) {
        for (const layer of sc.layers) {
          const prompt = layer.properties?.layer_prompt || layer.properties?.prompt;
          const provider = layer.properties?.layer_provider || 'wavespeed';
          const model = layer.properties?.layer_generation_model || 'wavespeed-v1-flux';
          if (prompt) {
            const mediaRes = await synthesizer.resolveMedia(prompt, {
              provider,
              model,
              title: `${sc.name} — ${layer.name}`,
              accentColor: layer.properties?.layer_color || '#ef4444',
            });
            if (mediaRes.fromCache) {
              cachedAssetsUsed++;
            } else {
              newAssetsSynthesized++;
            }
            // Update layer asset source to point to cached image
            layer.properties.layer_asset_source = mediaRes.assetPath;
          }
        }
      }
    }
  }

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
  const scriptDir = path.dirname(scriptPath);
  const publicDir = path.join(scriptDir, 'public');
  const staging = resolveMediaLayers(manifest, { scriptDir, publicDir });
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

  return { manifest, cachedAssetsUsed, newAssetsSynthesized };
}

/**
 * Renders a video from a script or manifest to an MP4 output.
 * @param {VideoRenderOptions} options
 * @returns {Promise<RenderSummary>}
 */
export async function renderVideo(options) {
  const startTime = Date.now();
  let manifest;
  let cachedAssetsUsed = 0;
  let newAssetsSynthesized = 0;

  if (options.manifestPath && fs.existsSync(path.resolve(options.manifestPath))) {
    manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifestPath), 'utf8'));
  } else if (options.scriptPath) {
    const compRes = await compileVideo({
      scriptPath: options.scriptPath,
      fps: options.fps,
      width: options.width,
      height: options.height,
      cacheDir: options.cacheDir,
    });
    manifest = compRes.manifest;
    cachedAssetsUsed = compRes.cachedAssetsUsed;
    newAssetsSynthesized = compRes.newAssetsSynthesized;
  } else {
    throw new Error('Either scriptPath or manifestPath must be provided for rendering');
  }

  const outputPath = path.resolve(options.outputVideoPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Remotion is the ONLY renderer. A failure is a loud, named, non-zero error —
  // never a silent FFmpeg fallback or a mock MP4 masquerading as a render.
  const renderDeps = options.loadModule ? { loadModule: options.loadModule } : {};
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

function parseCliArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command) {
    console.error('Usage: node video-engine-cli.mjs <compile|render|preview> [options]');
    process.exit(1);
  }

  try {
    if (command === 'compile') {
      const scriptPath = args._[1] || args.script;
      if (!scriptPath) {
        console.error('Usage: node video-engine-cli.mjs compile <script.md> [--output manifest.json]');
        process.exit(1);
      }
      const result = await compileVideo({
        scriptPath,
        outputPath: args.output || args.out,
        fps: args.fps ? Number(args.fps) : undefined,
        width: args.width ? Number(args.width) : undefined,
        height: args.height ? Number(args.height) : undefined,
        cacheDir: args['cache-dir'],
      });
      console.log(`✅ [video-engine-cli] Compiled manifest (${result.manifest.totalDurationInFrames} frames, ${result.manifest.totalDurationInSeconds.toFixed(2)}s)`);
      console.log(`   Cached assets: ${result.cachedAssetsUsed}, New assets: ${result.newAssetsSynthesized}`);
    } else if (command === 'render') {
      const target = args._[1] || args.script || args.manifest;
      const output = args.output || args.out;
      if (!target || !output) {
        console.error('Usage: node video-engine-cli.mjs render <script.md|manifest.json> --output <master.mp4>');
        process.exit(1);
      }
      const isManifest = target.endsWith('.json');
      const result = await renderVideo({
        scriptPath: isManifest ? undefined : target,
        manifestPath: isManifest ? target : undefined,
        outputVideoPath: output,
        fps: args.fps ? Number(args.fps) : undefined,
        concurrency: args.concurrency ? Number(args.concurrency) : undefined,
        cacheDir: args['cache-dir'],
        allowMock: Boolean(args['allow-mock']),
      });
      console.log(`✅ [video-engine-cli] Rendered ${result.outputVideoPath}`);
      console.log(`   Duration: ${result.totalDurationSeconds}s (${result.totalFrames} frames) in ${result.renderTimeMs}ms`);
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
