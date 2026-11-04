#!/usr/bin/env node

/**
 * nn-conntent/scripts/lib/render.mjs
 *
 * The render primitive: compiles (or takes a manifest) and renders the master
 * `<slug>_<W>x<H>.mp4` in the episode folder. Rendering is in place: the renderer
 * writes `hyperframes/render.tmp.mp4` and the file is renamed into place, so a
 * failed render never damages a previous master.
 *
 * Usage:
 *   node lib/render.mjs render <script.md> [--fps n] [--concurrency n] [--cache-dir dir]
 *          [--allow-mock] [--allow-model name]... [-- <hyperframes render flags>]
 *
 * ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, CliUsageError } from './cli-args.mjs';
import { tryHyperframesRender } from '../hyperframes-render.mjs';
import { VideoRenderError, compileVideo, recordStage, cliReporter } from './compile.mjs';

export { VideoRenderError };

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
  let avatarVideos;

  if (options.manifestPath && fs.existsSync(path.resolve(options.manifestPath))) {
    manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifestPath), 'utf8'));
  } else if (options.scriptPath) {
    const compileStart = Date.now();
    const compRes = await compileVideo({
      scriptPath: options.scriptPath,
      fps: options.fps,
      width: options.width,
      height: options.height,
      cacheDir: options.cacheDir,
      synthesizeAssets: options.synthesizeAssets,
      model: options.model,
      modelPath: options.modelPath,
      allowModels: options.allowModels,
      stageDeps: options.stageDeps,
      facts: options.facts,
      onProgress,
    });
    recordStage(options.facts, {
      stage: 'compile',
      start: compileStart,
      end: Date.now(),
      cache: { hits: compRes.cachedAssetsUsed || 0, misses: compRes.newAssetsSynthesized || 0 },
    });
    manifest = compRes.manifest;
    cachedAssetsUsed = compRes.cachedAssetsUsed;
    newAssetsSynthesized = compRes.newAssetsSynthesized;
    spentUsd = compRes.spentUsd || 0;
    plannedTotalUsd = compRes.plannedTotalUsd || 0;
    avatarVideos = compRes.avatarVideos;

    // Render Refuses Missing Avatar Clips: a still avatar Layer would silently render as
    // a static frame, so the run stops here and names the synthesis command instead.
    const missingAvatars = avatarVideos?.missingLayers || [];
    if (missingAvatars.length > 0) {
      const named = missingAvatars.map((m) => `${m.sceneId}/${m.layerName}`).join(', ');
      throw new VideoRenderError(
        `Cannot render: ${missingAvatars.length} avatar Layer(s) have no cached lip-sync clip (${named}). ` +
          'Run synthesize-avatar.mjs first: there is no override flag.',
      );
    }
  } else {
    throw new Error('Either scriptPath or manifestPath must be provided for rendering');
  }

  // The master is written in place: render to hyperframes/render.tmp.mp4, then rename it
  // over E/<slug>_<W>x<H>.mp4 (same volume), so a failed render never touches a
  // previous master and no partial file is ever visible under the master name.
  const hyperframesDir = manifest.metadata?.hyperframesDir;
  if (!hyperframesDir) throw new Error('The manifest has no metadata.hyperframesDir; render takes the script, which compile stamps');
  const slug = manifest.metadata?.videoSlug;
  if (!slug) throw new Error('The manifest has no metadata.videoSlug (the Video slug); recompile the script');
  const tmpPath = path.join(hyperframesDir, 'render.tmp.mp4');
  const masterWidth = manifest.width || 1920;
  const masterHeight = manifest.height || 1920;
  const outputPath = path.join(path.dirname(hyperframesDir), `${slug}_${masterWidth}x${masterHeight}.mp4`);
  fs.mkdirSync(hyperframesDir, { recursive: true });
  fs.rmSync(tmpPath, { force: true });

  // Render is hermetic: the emitted project references `vendor/gsap.min.js`. The build is
  // linked in by the emitter, whose missing-install failure is loud (never a network load).
  const renderDeps = { onProgress };
  if (options.hyperframesRun) renderDeps.run = options.hyperframesRun;
  const renderStart = Date.now();
  const hfResult = await tryHyperframesRender(
    {
      manifest,
      outputPath: tmpPath,
      concurrency: options.concurrency || 4,
      projectDir: hyperframesDir,
      gsapPath: options.gsapPath,
      extraArgs: options.hyperframesArgs,
    },
    renderDeps,
  );
  recordStage(options.facts, {
    stage: 'render',
    start: renderStart,
    end: Date.now(),
    render: {
      frames: manifest.totalDurationInFrames,
      fps_effective: manifest.fps,
      width: manifest.width || 1920,
      height: manifest.height || 1920,
    },
    outcome: hfResult.rendered ? 'ok' : 'failed',
  });

  let mocked = false;
  if (!hfResult.rendered) {
    fs.rmSync(tmpPath, { force: true });
    if (!options.allowMock) {
      throw new VideoRenderError(
        `HyperFrames render failed (${hfResult.reason})${hfResult.detail ? `:\n${hfResult.detail}\n\n` : '. '}Install the CLI via ensure-hyperframes.mjs, ` +
          `or pass --allow-mock for a CI placeholder MP4.`,
      );
    }
    console.warn(`[render] HyperFrames unavailable (${hfResult.reason}); writing mock MP4 (--allow-mock).`);
    writeMockMp4(tmpPath);
    mocked = true;
  }

  try {
    fs.renameSync(tmpPath, outputPath);
  } catch (err) {
    fs.rmSync(tmpPath, { force: true });
    const open = err?.code === 'EBUSY' || err?.code === 'EPERM' || err?.code === 'EACCES';
    throw new VideoRenderError(
      open
        ? `Cannot replace ${outputPath}: the file is open in another program (a player or editor). Close it and render again; the previous master was left untouched.`
        : `Cannot move the render into place at ${outputPath}: ${err?.message || err}`,
      { cause: err },
    );
  }

  // Copy mode leaves real files behind; a successful render is the last reader, so the staged
  // copies are deleted (they duplicate cache entries). Link mode keeps the links: deleting them
  // would delete nothing of the cache, but the project stays regenerable either way.
  if (manifest.metadata?.linkMode === 'copy') {
    fs.rmSync(path.join(hyperframesDir, 'assets'), { recursive: true, force: true });
  }

  const renderTimeMs = Date.now() - startTime;

  return {
    outputVideoPath: outputPath,
    totalDurationSeconds: manifest.totalDurationInSeconds,
    totalFrames: manifest.totalDurationInFrames,
    renderTimeMs,
    linkMode: manifest.metadata?.linkMode || 'link',
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

/** Splits argv at the first literal `--`: what follows is forwarded verbatim to `hyperframes render`. */
export function splitPassthrough(argv) {
  const i = argv.indexOf('--');
  return i === -1 ? { argv, passthrough: [] } : { argv: argv.slice(0, i), passthrough: argv.slice(i + 1) };
}
const FLAG_SPEC = {
  boolean: ['allow-mock'],
  value: ['script', 'fps', 'concurrency', 'cache-dir'],
  repeatable: ['allow-model'],
};

const USAGE = [
  'Usage: node lib/render.mjs render <script.md> [options]',
  '  render  <script.md> [--fps n] [--concurrency n] [--cache-dir dir]',
  '          [--allow-mock] [--allow-model name]...',
  '          [-- <hyperframes render flags>]   e.g. -- --workers 2 --low-memory-mode (forwarded verbatim)',
  '  --allow-mock: write a placeholder MP4 when HyperFrames is unavailable (CI only).',
  '  Values may also be given as --flag=value.',
].join('\n');

/** Parses argv strictly; returns `{ _, ...flags, allowModels }` or exits with the usage banner. */
function parseCliArgs(argv) {
  try {
    const { _, flags } = parseArgs(argv, FLAG_SPEC);
    return { _, ...flags, allowModels: flags['allow-model'] };
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err;
    console.error(`❌ [render] ${err.message}\n${USAGE}`);
    process.exit(1);
  }
}

async function main() {
  const { argv, passthrough } = splitPassthrough(process.argv.slice(2));
  const args = parseCliArgs(argv);
  const command = args._[0];
  if (command !== 'render') {
    console.error(USAGE);
    process.exit(1);
  }
  const target = args._[1] || args.script;
  if (!target) {
    console.error(USAGE);
    process.exit(1);
  }
  if (target.endsWith('.json')) {
    console.error(`❌ [render] render takes the script, not a manifest: it recompiles every run. Re-run: render <script.md>`);
    process.exit(1);
  }
  try {
    const result = await renderVideo({
      scriptPath: target,
      fps: args.fps ? Number(args.fps) : undefined,
      concurrency: args.concurrency ? Number(args.concurrency) : undefined,
      cacheDir: args['cache-dir'],
      allowModels: args.allowModels,
      allowMock: Boolean(args['allow-mock']),
      hyperframesArgs: passthrough,
      onProgress: cliReporter,
    });
    console.log(`✅ [render] Rendered ${result.outputVideoPath}`);
    console.log(`   Duration: ${result.totalDurationSeconds}s (${result.totalFrames} frames) in ${result.renderTimeMs}ms, Spent: $${result.spentUsd.toFixed(4)}`);
  } catch (err) {
    console.error(`❌ [render] ${err.message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
