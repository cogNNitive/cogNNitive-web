#!/usr/bin/env node

/**
 * nn-conntent/scripts/lib/render.mjs
 *
 * The render primitive: compiles (or takes a manifest) and renders one MP4 per output
 * format, `<slug>_<W>x<H>.mp4`, in the episode folder (spec S1/S8). The first format is
 * the primary output. Each format renders from its own project `hyperframes/<W>x<H>/`.
 * Rendering is in place: the renderer writes `hyperframes/<W>x<H>/render.tmp.mp4` and the
 * file is renamed into place, so a failed render never damages a previous output.
 *
 * Usage:
 *   node lib/render.mjs render <script.md> [--fps n] [--concurrency n] [--cache-dir dir]
 *          [--allow-mock] [--allow-model name]... [-- <hyperframes render flags>]
 *
 * ESM module.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, CliUsageError } from './cli-args.mjs'
import { tryHyperframesRender } from '../hyperframes-render.mjs'
import { VideoRenderError, compileVideo, recordStage, cliReporter } from './compile.mjs'

export { VideoRenderError }

/**
 * @typedef {Object} RenderedOutput
 * @property {string} format `<W>x<H>`
 * @property {number} width
 * @property {number} height
 * @property {string} path the MP4 at the episode root
 * @property {string} [manifestPath]
 * @property {string} projectDir the format's HyperFrames project
 * @property {boolean} mocked
 */

/**
 * Renders a video from a script or manifest: one MP4 per output format.
 * @param {VideoRenderOptions} options
 * @returns {Promise<RenderSummary & { outputs: RenderedOutput[], manifests: object[] }>}
 */

export async function renderVideo(options) {
  const startTime = Date.now()
  const onProgress = options.onProgress || (() => {})
  let manifests
  let cachedAssetsUsed = 0
  let newAssetsSynthesized = 0
  let spentUsd = 0
  let plannedTotalUsd = 0
  let avatarVideos

  if (options.manifestPath && fs.existsSync(path.resolve(options.manifestPath))) {
    manifests = [JSON.parse(fs.readFileSync(path.resolve(options.manifestPath), 'utf8'))]
  } else if (options.scriptPath) {
    const compileStart = Date.now()
    const compRes = await compileVideo({
      scriptPath: options.scriptPath,
      fps: options.fps,
      width: options.width,
      height: options.height,
      // The animatic is one project of its own, never one of the format projects (spec S7).
      ...(options.kind === 'animatic' ? { projectName: 'animatic' } : {}),
      ...(options.bags ? { bags: options.bags } : {}),
      cacheDir: options.cacheDir,
      synthesizeAssets: options.synthesizeAssets,
      recordSynthesisStages: options.recordSynthesisStages,
      model: options.model,
      modelPath: options.modelPath,
      allowModels: options.allowModels,
      stageDeps: options.stageDeps,
      facts: options.facts,
      onProgress,
      synthesizerOptions: options.synthesizerOptions,
    })
    recordStage(options.facts, {
      stage: 'compile',
      start: compileStart,
      end: Date.now(),
      cache: { hits: compRes.cachedAssetsUsed || 0, misses: compRes.newAssetsSynthesized || 0 },
    })
    manifests = compRes.manifests || [compRes.manifest]
    cachedAssetsUsed = compRes.cachedAssetsUsed
    newAssetsSynthesized = compRes.newAssetsSynthesized
    spentUsd = compRes.spentUsd || 0
    plannedTotalUsd = compRes.plannedTotalUsd || 0
    avatarVideos = compRes.avatarVideos

    // Render Refuses Missing Avatar Clips: a still avatar Layer would silently render as
    // a static frame, so the run stops here and names the synthesis command instead.
    const missingAvatars = avatarVideos?.missingLayers || []
    if (missingAvatars.length > 0 && options.kind !== 'animatic') {
      const named = missingAvatars.map((m) => `${m.sceneId}/${m.layerName}`).join(', ')
      throw new VideoRenderError(
        `Cannot render: ${missingAvatars.length} avatar Layer(s) have no cached lip-sync clip (${named}). ` +
          'Run synthesize-avatar.mjs first: there is no override flag.',
      )
    }
  } else {
    throw new Error('Either scriptPath or manifestPath must be provided for rendering')
  }

  // One pass per format, in the declared order: every pass reads its own project and the
  // assets compile already resolved, so no pass synthesizes anything.
  const outputs = []
  for (const manifest of manifests) {
    outputs.push(await renderOneFormat(manifest, options, onProgress))
  }
  const primary = manifests[0]
  const renderTimeMs = Date.now() - startTime

  return {
    outputVideoPath: outputs[0].path,
    outputs,
    manifests,
    totalDurationSeconds: primary.totalDurationInSeconds,
    totalFrames: primary.totalDurationInFrames,
    renderTimeMs,
    linkMode: manifests.some((m) => m.metadata?.linkMode === 'copy') ? 'copy' : primary.metadata?.linkMode || 'link',
    cachedAssetsUsed,
    newAssetsSynthesized,
    spentUsd,
    plannedTotalUsd,
    mocked: outputs.some((o) => o.mocked),
  }
}

/**
 * Renders one format's project and moves its MP4 into place at the episode root.
 * @returns {Promise<RenderedOutput>}
 */
async function renderOneFormat(manifest, options, onProgress) {
  // The output is written in place: render to <project>/render.tmp.mp4, then rename it
  // over E/<slug>_<W>x<H>.mp4 (same volume), so a failed render never touches a
  // previous output and no partial file is ever visible under the output name.
  const hyperframesDir = manifest.metadata?.hyperframesDir
  if (!hyperframesDir)
    throw new Error(
      'The manifest has no metadata.hyperframesDir; render takes the script, which compile stamps',
    )
  const slug = manifest.metadata?.videoSlug
  if (!slug)
    throw new Error('The manifest has no metadata.videoSlug (the Video slug); recompile the script')
  const width = Number(manifest.width)
  const height = Number(manifest.height)
  if (!width || !height) throw new Error('The manifest has no width/height; recompile the script')
  // The episode folder is stamped by compile; a manifest written before per-format
  // projects sat directly in `<episode>/hyperframes/`.
  const episodeDir = manifest.metadata?.episodeDir || path.dirname(hyperframesDir)
  const tmpPath = path.join(
    hyperframesDir,
    options.kind === 'animatic' ? 'render.animatic.tmp.mp4' : 'render.tmp.mp4',
  )
  const outputName =
    options.kind === 'animatic'
      ? `${slug}_animatic_${width}x${height}.mp4`
      : `${slug}_${width}x${height}.mp4`
  const outputPath = path.join(episodeDir, outputName)
  fs.mkdirSync(hyperframesDir, { recursive: true })
  fs.rmSync(tmpPath, { force: true })

  // Render is hermetic: the emitted project references `vendor/gsap.min.js`. The build is
  // linked in by the emitter, whose missing-install failure is loud (never a network load).
  const renderDeps = { onProgress }
  if (options.hyperframesRun) renderDeps.run = options.hyperframesRun
  const renderStart = Date.now()
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
  )
  recordStage(options.facts, {
    stage: 'render',
    start: renderStart,
    end: Date.now(),
    render: {
      frames: manifest.totalDurationInFrames,
      fps_effective: manifest.fps,
      width,
      height,
    },
    outcome: hfResult.rendered ? 'ok' : 'failed',
  })

  let mocked = false
  if (!hfResult.rendered) {
    fs.rmSync(tmpPath, { force: true })
    if (!options.allowMock) {
      throw new VideoRenderError(
        `HyperFrames render failed for ${width}x${height} (${hfResult.reason})${hfResult.detail ? `:\n${hfResult.detail}\n\n` : '. '}Install the CLI via ensure-hyperframes.mjs, ` +
          `or pass --allow-mock for a CI placeholder MP4.`,
      )
    }
    console.warn(
      `[render] HyperFrames unavailable (${hfResult.reason}); writing mock MP4 (--allow-mock).`,
    )
    writeMockMp4(tmpPath)
    mocked = true
  }

  try {
    fs.renameSync(tmpPath, outputPath)
  } catch (err) {
    fs.rmSync(tmpPath, { force: true })
    const open = err?.code === 'EBUSY' || err?.code === 'EPERM' || err?.code === 'EACCES'
    throw new VideoRenderError(
      open
        ? `Cannot replace ${outputPath}: the file is open in another program (a player or editor). Close it and render again; the previous output was left untouched.`
        : `Cannot move the render into place at ${outputPath}: ${err?.message || err}`,
      { cause: err },
    )
  }

  // Copy mode leaves real files behind; this format's render is the last reader of its own
  // staged copies (every format stages into its own project), so they are deleted here and a
  // later format still has its own. Link mode keeps the links: deleting them would delete
  // nothing of the cache, but the project stays regenerable either way.
  if (manifest.metadata?.linkMode === 'copy') {
    fs.rmSync(path.join(hyperframesDir, 'assets'), { recursive: true, force: true })
  }

  return {
    format: `${width}x${height}`,
    width,
    height,
    path: outputPath,
    manifestPath: manifest.metadata?.manifestPath,
    projectDir: hyperframesDir,
    mocked,
  }
}

/**
 * Writes a minimal, valid-enough MP4 container for headless/CI environments.
 * Only ever called behind the explicit `--allow-mock` flag.
 * @param {string} outputPath
 */
function writeMockMp4(outputPath) {
  const mockMp4Header = Buffer.from([
    0x00,
    0x00,
    0x00,
    0x18,
    0x66,
    0x74,
    0x79,
    0x70, // ftyp
    0x69,
    0x73,
    0x6f,
    0x6d,
    0x00,
    0x00,
    0x02,
    0x00,
    0x69,
    0x73,
    0x6f,
    0x6d,
    0x69,
    0x73,
    0x6f,
    0x32,
    0x00,
    0x00,
    0x00,
    0x08,
    0x66,
    0x72,
    0x65,
    0x65, // free
    0x00,
    0x00,
    0x00,
    0x10,
    0x6d,
    0x64,
    0x61,
    0x74, // mdat
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ])
  fs.writeFileSync(outputPath, mockMp4Header)
}

/** Splits argv at the first literal `--`: what follows is forwarded verbatim to `hyperframes render`. */
export function splitPassthrough(argv) {
  const i = argv.indexOf('--')
  return i === -1
    ? { argv, passthrough: [] }
    : { argv: argv.slice(0, i), passthrough: argv.slice(i + 1) }
}

/** Strips a trailing `_<W>x<H>` dimension suffix from an output/animatic filename to the slug. */
export function slugFromOutput(name) {
  const base = path.basename(String(name))
  return base
    .replace(/_animatic_\d+x\d+\.\w+$/, '')
    .replace(/_thumbnail_\d+x\d+\.\w+$/, '')
    .replace(/_\d+x\d+\.\w+$/, '')
    .replace(/\.\w+$/, '')
}

/**
 * One name per deliverable (design D-S2; conntent-folder-contract "Naming Scheme By
 * File Class"). Working files carry no slug or version. `output` is the MP4 of one
 * output format; the primary output is the one named after `output_formats[0]`.
 * @param {{ slug: string, width: number, height: number }} input
 * @returns {{ output: string, apng: string, description: string, animatic: string, plan: string, qa: string }}
 */
export function deliverableNamesFor({ slug, width, height }) {
  const dims = `${width}x${height}`
  return {
    output: `${slug}_${dims}.mp4`,
    apng: `${slug}_thumbnail_${dims}.png`,
    description: `${slug}_description.md`,
    animatic: `${slug}_animatic_${dims}.mp4`,
    plan: 'plan.json',
    qa: 'qa.json',
  }
}
const FLAG_SPEC = {
  boolean: ['allow-mock'],
  value: ['script', 'fps', 'concurrency', 'cache-dir'],
  repeatable: ['allow-model'],
}

const USAGE = [
  'Usage: node lib/render.mjs render <script.md> [options]',
  '  render  <script.md> [--fps n] [--concurrency n] [--cache-dir dir]',
  '          [--allow-mock] [--allow-model name]...',
  '          [-- <hyperframes render flags>]   e.g. -- --workers 2 --low-memory-mode (forwarded verbatim)',
  '  --allow-mock: write a placeholder MP4 when HyperFrames is unavailable (CI only).',
  '  Values may also be given as --flag=value.',
].join('\n')

/** Parses argv strictly; returns `{ _, ...flags, allowModels }` or exits with the usage banner. */
function parseCliArgs(argv) {
  try {
    const { _, flags } = parseArgs(argv, FLAG_SPEC)
    return { _, ...flags, allowModels: flags['allow-model'] }
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err
    console.error(`❌ [render] ${err.message}\n${USAGE}`)
    process.exit(1)
  }
}

async function main() {
  const { argv, passthrough } = splitPassthrough(process.argv.slice(2))
  const args = parseCliArgs(argv)
  const command = args._[0]
  if (command !== 'render') {
    console.error(USAGE)
    process.exit(1)
  }
  const target = args._[1] || args.script
  if (!target) {
    console.error(USAGE)
    process.exit(1)
  }
  if (target.endsWith('.json')) {
    console.error(
      `❌ [render] render takes the script, not a manifest: it recompiles every run. Re-run: render <script.md>`,
    )
    process.exit(1)
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
    })
    for (const output of result.outputs) console.log(`✅ [render] Rendered ${output.path} (${output.format})`)
    console.log(
      `   Duration: ${result.totalDurationSeconds}s (${result.totalFrames} frames) in ${result.renderTimeMs}ms, Spent: $${result.spentUsd.toFixed(4)}`,
    )
  } catch (err) {
    console.error(`❌ [render] ${err.message}`)
    process.exit(1)
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))

if (isMain) {
  main()
}
