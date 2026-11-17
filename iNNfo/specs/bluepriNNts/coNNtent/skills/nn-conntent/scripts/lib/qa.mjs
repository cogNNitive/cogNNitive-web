/**
 * nn-conntent/scripts/lib/qa.mjs
 *
 * Full QA validation module (capability conntent-qa; design D-P5).
 * Checkpoints, run per output format (spec S9):
 * 1. Output checkpoint (after each format renders), `qaOutput`:
 *    - Structural overlay check against index.html (start and duration matching manifest)
 *    - Visible text edge density measurement (midpoint frame vs reference frame);
 *      skipped for an overlay with no text, never used for captions (checked by
 *      structure and manifest timing instead)
 *    - Output properties (duration +- 1 frame, resolution, audio stream when narrated)
 *    - Deterministic scene sampling
 *    Overlays are measured inside the safe area of the output's own canvas.
 * 2. Cross-format checkpoint, `qaCrossFormat`: every format manifest shares one timeline.
 * 3. Output-set checkpoint (after thumbnails and description, before delivery):
 *    - The current run's outputs, thumbnails and description: existence, non-empty, and
 *      matching dimensions; an unreadable size fails (never passes by default)
 *
 * Deterministic qa.json report written to episode folder.
 * Exit 12 and status failed_qa on any check failure.
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnTool } from './spawn-tool.mjs'
import { safeArea } from './safe-area.mjs'

/**
 * Presence heuristic, not a legibility measure: the minimum edge-density
 * difference between the overlay region at the midpoint of its interval and a
 * reference frame outside it.
 *
 * Evidence: an absent overlay measures about 0.0000 (compression noise stays
 * below 0.001); present overlays measured 0.005264-0.100208 on the pilot render
 * (9bd659de) but only 0.0029 for a visible lower-third over a textured background
 * in a later production (#610), which the former 0.004 rejected. 0.0015 sits
 * 1.5x above the absent ceiling and about 2x below the lowest present value, so
 * the two populations separate on both sides. Captions are not judged by this
 * number (adjacent captions differ by design); see qaOutput.
 */
export const QA_TEXT_EDGE_MIN = 0.0015

/** Default tool runner: spawnTool (Windows .cmd shims included). */
function runCommand(cmd, args, options = {}) {
  const res = spawnTool(cmd, args, { encoding: 'utf8', ...options })
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    error: res.error,
  }
}

/** Check if ffprobe and ffmpeg are available on PATH. */
export function defaultCheckTools() {
  try {
    const probe = runCommand('ffprobe', ['-version'])
    if (probe.error || probe.status !== 0) {
      return { ok: false, error: 'ffprobe is not available on PATH' }
    }
    const ffmpeg = runCommand('ffmpeg', ['-version'])
    if (ffmpeg.error || ffmpeg.status !== 0) {
      return { ok: false, error: 'ffmpeg is not available on PATH' }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) }
  }
}

/** Probe a video output's properties (dimensions, duration, audio stream) using ffprobe. */
export function defaultProbeVideo(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { error: `file not found: ${filePath}` }
  }
  try {
    const res = runCommand('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,duration',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      filePath,
    ])
    if (res.error || res.status !== 0) {
      return { error: res.stderr || 'ffprobe failed to probe video stream' }
    }
    const data = JSON.parse(res.stdout || '{}')
    const vStream = (data.streams || [])[0] || {}
    const width = Number(vStream.width)
    const height = Number(vStream.height)
    const durRaw = vStream.duration || data.format?.duration
    const duration = Number.parseFloat(String(durRaw || 0))

    // Probe audio stream
    const audioRes = runCommand('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_type',
      '-of',
      'json',
      filePath,
    ])
    const aData = JSON.parse(audioRes.stdout || '{}')
    const hasAudio = Array.isArray(aData.streams) && aData.streams.length > 0

    return {
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) ? height : 0,
      duration: Number.isFinite(duration) ? duration : 0,
      hasAudio,
    }
  } catch (err) {
    return { error: String(err?.message || err) }
  }
}

/** Probe dimensions of an output file (.mp4 or .png). */
export function defaultProbeOutputSize(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null

  // Fast header read for PNG
  if (filePath.toLowerCase().endsWith('.png')) {
    try {
      const fd = fs.openSync(filePath, 'r')
      const buf = Buffer.alloc(24)
      fs.readSync(fd, buf, 0, 24, 0)
      fs.closeSync(fd)
      if (buf.toString('ascii', 1, 4) === 'PNG') {
        const width = buf.readUInt32BE(16)
        const height = buf.readUInt32BE(20)
        return { width, height }
      }
    } catch {}
  }

  // ffprobe fallback for video or images
  try {
    const res = runCommand('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      filePath,
    ])
    if (res.error || res.status !== 0) return null
    const m = /^(\d+),(\d+)/.exec(String(res.stdout || '').trim())
    return m ? { width: Number(m[1]), height: Number(m[2]) } : null
  } catch {
    return null
  }
}

/**
 * Compute the measuring band for an overlay on one canvas.
 *
 * The shipped components lay out inside the safe area of the canvas they are rendered on
 * (spec S6, `safe-area.mjs`), so the band is derived from that same safe area, never from the
 * whole frame and never from a fixed square. Positional bands (the bottom 28%, the top 28% or
 * the centre 40% of the safe area) keep the rules that fixed three wrong-place readings: a
 * `bottom` position wins over the overlay type, a `top` title's band starts where the title
 * draws, and a title's anchor recorded as `config.anchor` is honoured.
 */
export function overlayCropRegion({ overlay, canvasWidth, canvasHeight }) {
  if (overlay?.bbox && typeof overlay.bbox === 'object') {
    return {
      width: Math.max(16, Math.floor(overlay.bbox.width / 2) * 2),
      height: Math.max(16, Math.floor(overlay.bbox.height / 2) * 2),
      x: Math.max(0, Math.floor(overlay.bbox.x)),
      y: Math.max(0, Math.floor(overlay.bbox.y)),
    }
  }

  const pos = String(
    overlay?.config?.position || overlay?.config?.anchor || overlay?.props?.position || '',
  ).toLowerCase()
  const type = String(overlay?.type || overlay?.kind || '').toLowerCase()

  const safe = safeArea({ width: canvasWidth, height: canvasHeight })
  const innerX = safe.x
  const innerY = safe.y
  const innerW = safe.width
  const innerH = safe.height

  let bandY = innerY
  let bandH = innerH
  if (
    pos.includes('bottom') ||
    type.includes('watermark') ||
    type.includes('caption') ||
    type.includes('lowerthird')
  ) {
    bandY = innerY + Math.round(innerH * 0.72)
    bandH = Math.round(innerH * 0.28)
  } else if (pos.includes('top')) {
    bandY = innerY
    bandH = Math.round(innerH * 0.28)
  } else if (pos.includes('center') || type.includes('title') || type.includes('quote')) {
    bandY = innerY + Math.round(innerH * 0.3)
    bandH = Math.round(innerH * 0.4)
  }

  const cropW = Math.max(16, Math.min(canvasWidth, Math.floor(innerW / 2) * 2))
  const cropH = Math.max(16, Math.min(canvasHeight, Math.floor(bandH / 2) * 2))
  const cropX = Math.max(0, Math.min(canvasWidth - cropW, Math.max(0, Math.floor(innerX))))
  const cropY = Math.max(0, Math.min(canvasHeight - cropH, Math.max(0, Math.floor(bandY))))

  return { width: cropW, height: cropH, x: cropX, y: cropY }
}

/** Compute a control crop region in the same frame that does not overlap the overlay. */
export function overlayControlCropRegion({ crop, canvasHeight }) {
  let yControl = crop.y >= crop.height ? crop.y - crop.height : crop.y + crop.height
  if (yControl + crop.height > canvasHeight) {
    yControl = Math.max(0, crop.y - crop.height)
  }
  return {
    width: crop.width,
    height: crop.height,
    x: crop.x,
    y: Math.max(0, Math.min(canvasHeight - crop.height, Math.floor(yControl))),
  }
}

/**
 * Measure edge density at a specific timestamp and crop region in a video file.
 * Returns ratio of edge pixels (0.0 to 1.0).
 *
 * The decoded frame goes to a temp file, never to stdout: reading binary frame
 * bytes from a spawnSync pipe was reported to come back empty on Windows, so
 * every overlay measured 0 and looked missing (#616).
 */
export function defaultMeasureFrameEdgeDensity({ videoPath, timeSeconds, crop, run = spawnTool }) {
  const cropFilter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},edgedetect,format=gray`
  const ss = Math.max(0, timeSeconds).toFixed(3)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-frame-'))
  const framePath = path.join(tmpDir, 'frame.gray')
  let buf
  try {
    const res = run(
      'ffmpeg',
      ['-v', 'error', '-y', '-ss', ss, '-i', videoPath, '-vframes', '1', '-filter:v', cropFilter, '-f', 'rawvideo', framePath],
      { stdio: 'ignore' },
    )
    if (res?.error || res?.status !== 0 || !fs.existsSync(framePath)) return 0
    buf = fs.readFileSync(framePath)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
  if (buf.length === 0) return 0

  let nonZero = 0
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] > 0) nonZero++
  }
  return buf.length > 0 ? nonZero / buf.length : 0
}

/**
 * Splits an overlay crop into a small grid of measurable tiles.
 *
 * One averaged band is the wrong instrument for presence: the shipped bands are
 * 6-20x the area an overlay actually covers, so a small mark's edge pixels get
 * diluted below any threshold that still separates present from absent. A tile keeps
 * the denominator near the mark's own size, and the check takes the strongest tile
 * (#692). Sizes are even because the ffmpeg crop filter wants even dimensions.
 *
 * @param {{ width: number, height: number, x: number, y: number }} crop
 * @param {{ cols?: number, rows?: number }} [opts]
 * @returns {Array<{ width: number, height: number, x: number, y: number }>}
 */
export function tileRegions(crop, { cols = 4, rows = 2 } = {}) {
  const bounds = {
    width: Math.max(16, Math.floor(Number(crop?.width) || 0)),
    height: Math.max(16, Math.floor(Number(crop?.height) || 0)),
    x: Math.max(0, Math.floor(Number(crop?.x) || 0)),
    y: Math.max(0, Math.floor(Number(crop?.y) || 0)),
  }
  const nCols = Math.max(1, Math.min(cols, Math.floor(bounds.width / 16)))
  const nRows = Math.max(1, Math.min(rows, Math.floor(bounds.height / 16)))
  const tileW = Math.max(16, Math.floor(bounds.width / nCols / 2) * 2)
  const tileH = Math.max(16, Math.floor(bounds.height / nRows / 2) * 2)
  const tiles = []
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const x = bounds.x + c * tileW
      const y = bounds.y + r * tileH
      if (x + 16 > bounds.x + bounds.width || y + 16 > bounds.y + bounds.height) continue
      tiles.push({
        width: Math.min(tileW, bounds.x + bounds.width - x),
        height: Math.min(tileH, bounds.y + bounds.height - y),
        x,
        y,
      })
    }
  }
  return tiles.length > 0 ? tiles : [{ ...bounds }]
}

/**
 * Compare edge density at tMid against a same-frame control crop or a reference frame.
 *
 * The crop is measured as a grid of tiles and the strongest tile wins (#692). Averaging
 * the whole band is what produced the 0.0004 false negative for a visible watermark:
 * the same edge pixels are a 20x larger share of a tile than of the band.
 */
export function defaultSampleEdgeDensity({
  videoPath,
  time,
  refTime,
  crop,
  controlCrop,
  measureFn = defaultMeasureFrameEdgeDensity,
}) {
  if (controlCrop) {
    let best = 0;
    for (const tile of tileRegions(crop)) {
      const offsetX = tile.x - crop.x;
      const offsetY = tile.y - crop.y;
      const control = {
        width: Math.min(tile.width, controlCrop.width),
        height: Math.min(tile.height, controlCrop.height),
        x: controlCrop.x + offsetX,
        y: controlCrop.y + offsetY,
      };
      const densityMid = measureFn({ videoPath, timeSeconds: time, crop: tile });
      const densityControl = measureFn({ videoPath, timeSeconds: time, crop: control });
      best = Math.max(best, densityMid - densityControl);
    }
    return Math.max(0, Math.round(best * 1e6) / 1e6);
  }
  const densityRef = refTime !== null ? measureFn({ videoPath, timeSeconds: refTime, crop }) : 0;
  return Math.abs(measureFn({ videoPath, timeSeconds: time, crop }) - densityRef);
}

/**
 * Parse host elements from emitted hyperframes/index.html.
 * Matches <div ... id="..." ... class="clip nn-overlay..." ... data-start="..." data-duration="...">
 */
export function parseHtmlOverlayHosts(html) {
  const hosts = new Map()
  const elRegex = /<([a-zA-Z0-9-]+)\s+([^>]+)>/gi
  let match
  while ((match = elRegex.exec(html)) !== null) {
    const attrs = match[2]
    const idMatch = attrs.match(/(?:^|\s)id\s*=\s*['"]([^'"]+)['"]/i)
    if (!idMatch) continue
    const id = idMatch[1]
    const classMatch = attrs.match(/\bclass\s*=\s*['"]([^'"]+)['"]/i)
    const classes = classMatch ? classMatch[1] : ''
    const startMatch = attrs.match(/\bdata-start\s*=\s*['"]([^'"]+)['"]/i)
    const durMatch = attrs.match(/\bdata-duration\s*=\s*['"]([^'"]+)['"]/i)

    hosts.set(id, {
      id,
      tag: match[1],
      classes,
      isOverlayHost: classes.includes('nn-overlay') || classes.includes('clip'),
      dataStart: startMatch ? Number.parseFloat(startMatch[1]) : null,
      dataDuration: durMatch ? Number.parseFloat(durMatch[1]) : null,
    })
  }
  return hosts
}

/** Text an overlay shows: lowerThird `title`, kineticTitle `heading`, the others `text`. */
function overlayText(o) {
  for (const bag of [o?.config, o?.props]) {
    for (const key of ['title', 'heading', 'text']) {
      const v = bag?.[key]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return ''
}

/** Captions follow each other, so a frame diff against a reference frame is meaningless for them (#610). */
const isCaption = (item) => /^(captions?|caption-word)$/i.test(String(item.type || ''))

/** Overlays that draw media rather than text keep the visual check with no text. */
const isMediaOverlay = (item) => /^b-?roll$/i.test(String(item.type || '')) || Boolean(item.config?.assetPath)

/**
 * Checkpoint 1: one output's QA (spec S9), run once per format.
 * Evaluates duration, dimensions, audio stream, and structural + visible overlay emission
 * of `outputPath` against its own format manifest and project. Every check carries the
 * output's `format`.
 */
export async function qaOutput(input) {
  const result = await qaOneOutput(input)
  const format = input.declaredSize || formatOf(input.manifest)
  return { ok: result.ok, checks: result.checks.map((c) => ({ ...c, format })) }
}

/** `<W>x<H>` of a manifest. */
function formatOf(manifest) {
  return `${Number(manifest?.width) || 0}x${Number(manifest?.height) || 0}`
}

async function qaOneOutput({
  episodeDir,
  manifest,
  outputPath,
  declaredSize,
  projectDir,
  deps = {},
}) {
  const checks = []
  declaredSize = declaredSize || formatOf(manifest)

  // 1. Tool check
  const checkTools = deps.checkTools || defaultCheckTools
  const tools = checkTools()
  if (!tools.ok) {
    checks.push({
      id: 'qa-unavailable',
      checkpoint: 'output',
      status: 'fail',
      expected: 'ffprobe and ffmpeg available on PATH',
      found: tools.error || 'tool check failed',
      sampled: outputPath,
    })
    return { ok: false, checks }
  }

  // 2. Output readable check & probe
  const probeVideo = deps.probeVideo || defaultProbeVideo
  const probed = probeVideo(outputPath)
  if (probed.error) {
    checks.push({
      id: 'qa-unavailable',
      checkpoint: 'output',
      status: 'fail',
      expected: 'output file readable by ffprobe',
      found: probed.error,
      sampled: outputPath,
    })
    return { ok: false, checks }
  }

  const fps = Number(manifest?.fps) || 30
  const frameDuration = 1 / fps

  // 3. Size check
  const [expW, expH] = declaredSize.split('x').map(Number)
  if (probed.width !== expW || probed.height !== expH) {
    checks.push({
      id: 'size-mismatch',
      checkpoint: 'output',
      status: 'fail',
      expected: declaredSize,
      found: `${probed.width}x${probed.height}`,
      sampled: outputPath,
    })
  } else {
    checks.push({
      id: 'size',
      checkpoint: 'output',
      status: 'pass',
      expected: declaredSize,
      found: `${probed.width}x${probed.height}`,
      sampled: outputPath,
    })
  }

  // 4. Duration check (total +- 1 frame, and each scene's bounds)
  const totalFrames = Number(manifest?.totalDurationInFrames) || 0
  const manifestDuration =
    Number(manifest?.totalDurationInSeconds) || (totalFrames > 0 ? totalFrames / fps : 0)
  const durationDiff = Math.abs(probed.duration - manifestDuration)

  if (durationDiff > frameDuration + 0.001) {
    checks.push({
      id: 'duration-mismatch',
      checkpoint: 'output',
      status: 'fail',
      expected: manifestDuration,
      found: probed.duration,
      sampled: outputPath,
    })
  } else {
    checks.push({
      id: 'duration',
      checkpoint: 'output',
      status: 'pass',
      expected: manifestDuration,
      found: probed.duration,
      sampled: outputPath,
    })
  }

  const scenes = manifest?.tracks?.scenes || []
  for (const scene of scenes) {
    const sFrom = (Number(scene.fromFrame) || 0) / fps
    const sDur = (Number(scene.durationInFrames) || 0) / fps
    const sEnd = sFrom + sDur
    if (sEnd > probed.duration + frameDuration + 0.001) {
      checks.push({
        id: 'duration-mismatch',
        checkpoint: 'output',
        status: 'fail',
        scene: scene.id || scene.slug,
        expected: `<= ${probed.duration.toFixed(3)}s`,
        found: `${sEnd.toFixed(3)}s`,
        sampled: outputPath,
      })
    }
    // Fixed position sampling records
    checks.push({
      id: 'scene-sampling',
      checkpoint: 'output',
      status: 'pass',
      scene: scene.id || scene.slug,
      sampled: {
        firstFrame: Number(sFrom.toFixed(3)),
        lastFrame: Number(Math.max(sFrom, sEnd - frameDuration).toFixed(3)),
      },
    })
  }

  // 5. Audio stream check
  const hasNarration =
    scenes.some((s) =>
      Boolean(
        s.narration ||
        s.props?.narration ||
        s.props?.layers?.some((l) => l.kind === 'voice' || l.layer_type === 'audio'),
      ),
    ) || (manifest?.tracks?.audio || []).length > 0

  if (hasNarration && !probed.hasAudio) {
    checks.push({
      id: 'audio-missing',
      checkpoint: 'output',
      status: 'fail',
      expected: 'output has audio stream',
      found: 'no audio stream',
      sampled: outputPath,
    })
  } else if (hasNarration) {
    checks.push({
      id: 'audio',
      checkpoint: 'output',
      status: 'pass',
      expected: 'output has audio stream',
      found: 'audio stream present',
      sampled: outputPath,
    })
  }

  // 6. Overlays check: structural and visible
  // The project this output rendered from: its own `hyperframes/<W>x<H>/` (spec S7).
  const project =
    projectDir || manifest?.metadata?.hyperframesDir || path.join(episodeDir, 'hyperframes', declaredSize)
  const indexHtmlPath = path.join(project, 'index.html')
  if (!fs.existsSync(indexHtmlPath)) {
    checks.push({
      id: 'overlay-missing',
      checkpoint: 'output',
      status: 'fail',
      expected: `${path.relative(episodeDir, indexHtmlPath).split(path.sep).join('/')} exists`,
      found: 'index.html missing',
      sampled: indexHtmlPath,
    })
    return { ok: false, checks }
  }

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')
  const hosts = parseHtmlOverlayHosts(indexHtml)

  // Collect declared overlay items
  const overlays = manifest?.tracks?.overlays || []
  const overlayItems = []

  for (const o of overlays) {
    if (!o) continue
    const fromFrame = Number(o.fromFrame) || 0
    const durFrames = Number(o.durationInFrames) || 0
    overlayItems.push({
      id: String(o.id),
      type: o.type || 'overlay',
      sceneId: o.sceneId || o.scene || null,
      fromFrame,
      durationInFrames: durFrames,
      start: fromFrame / fps,
      duration: durFrames / fps,
      text: overlayText(o),
      config: o.config || o.props || {},
      bbox: o.bbox || null,
    })
  }

  // Caption words when captions are enabled
  if (Array.isArray(manifest?.metadata?.captions?.words)) {
    for (const w of manifest.metadata.captions.words) {
      if (w && w.start !== undefined && w.end !== undefined) {
        overlayItems.push({
          id: String(w.id || `word_${w.start}`),
          type: 'caption-word',
          sceneId: w.sceneId || null,
          start: Number(w.start),
          duration: Number(w.end) - Number(w.start),
          text: String(w.text || ''),
          config: { position: 'bottom' },
        })
      }
    }
  }

  // Leaked text drawables (scene layers still carrying layer_text_content)
  for (const s of scenes) {
    const layers = s?.props?.layers || []
    for (const l of layers) {
      if (l && l.layer_text_content) {
        overlayItems.push({
          id: String(l.id || l.name || 'leaked_text_layer'),
          type: 'leaked_text',
          sceneId: s.id || s.slug,
          start: (Number(s.fromFrame) || 0) / fps,
          duration: (Number(s.durationInFrames) || 0) / fps,
          text: String(l.layer_text_content),
        })
      }
    }
  }

  const sampleEdgeDensity = deps.sampleEdgeDensity || defaultSampleEdgeDensity

  for (const item of overlayItems) {
    const host = hosts.get(item.id)
    const itemStart = Number(item.start.toFixed(3))
    const itemEnd = Number((item.start + item.duration).toFixed(3))
    const interval = [itemStart, itemEnd]

    // Structural check
    if (!host) {
      checks.push({
        id: 'overlay-missing',
        checkpoint: 'output',
        status: 'fail',
        scene: item.sceneId,
        overlayKind: item.type,
        text: item.text,
        interval,
        expected: `host element #${item.id} in index.html`,
        found: 'host missing',
        sampled: indexHtmlPath,
      })
      continue
    }

    // Timing check on host attributes (if present)
    if (host.dataStart !== null && host.dataDuration !== null) {
      if (
        Math.abs(host.dataStart - item.start) > frameDuration + 0.001 ||
        Math.abs(host.dataDuration - item.duration) > frameDuration + 0.001
      ) {
        checks.push({
          id: 'overlay-missing',
          checkpoint: 'output',
          status: 'fail',
          scene: item.sceneId,
          overlayKind: item.type,
          text: item.text,
          interval,
          expected: `data-start="${item.start}" data-duration="${item.duration}"`,
          found: `data-start="${host.dataStart}" data-duration="${host.dataDuration}"`,
          sampled: indexHtmlPath,
        })
        continue
      }
    }

    // Captions: structural (above) and manifest timing, never a frame diff (#610).
    if (isCaption(item)) {
      const scene = scenes.find((sc) => item.sceneId && (sc.id === item.sceneId || sc.slug === item.sceneId))
      const tol = frameDuration + 0.001
      const bounds = scene
        ? [(Number(scene.fromFrame) || 0) / fps, ((Number(scene.fromFrame) || 0) + (Number(scene.durationInFrames) || 0)) / fps]
        : [0, manifestDuration]
      const end = item.start + item.duration
      const inTime =
        Number.isFinite(item.start) &&
        Number.isFinite(item.duration) &&
        item.duration > 0 &&
        item.start >= bounds[0] - tol &&
        end <= bounds[1] + tol
      checks.push({
        id: inTime ? 'caption-present' : 'caption-timing',
        checkpoint: 'output',
        status: inTime ? 'pass' : 'fail',
        scene: item.sceneId,
        overlayKind: item.type,
        text: item.text,
        interval,
        expected: `host #${item.id} and an interval inside [${bounds[0].toFixed(3)}, ${bounds[1].toFixed(3)}]s`,
        found: inTime ? 'host present, timing inside bounds' : `interval [${itemStart}, ${itemEnd}]s`,
        sampled: indexHtmlPath,
      })
      continue
    }

    // An overlay with no text has nothing to measure: the structural check stands alone (#610).
    if (!String(item.text || '').trim() && !isMediaOverlay(item)) {
      checks.push({
        id: 'overlay-structural',
        checkpoint: 'output',
        status: 'pass',
        scene: item.sceneId,
        overlayKind: item.type,
        text: item.text,
        interval,
        expected: `host element #${item.id} in index.html`,
        found: 'host present; visual check skipped: overlay has no text',
        sampled: indexHtmlPath,
      })
      continue
    }

    // Visible check. The reference frame MUST be free of the same overlay kind, or the comparison
    // measures nothing: with a watermark on every scene, `start - 0.5` lands in the previous scene,
    // which carries its own watermark, and the difference is 0.0000 even though both overlays are on
    // screen. Prefer a frame with nothing at all on screen, then the nearest clean one, and skip the
    // visual check when the kind covers every frame.
    const tMid = Number((item.start + item.duration / 2).toFixed(3))
    const sameKind = overlayItems.filter((o) => o !== item && o.type === item.type)
    const isBusy = (t) => sameKind.some((o) => t >= o.start && t < o.start + o.duration)
    const inItem = (t) => t >= item.start && t < item.start + item.duration
    const anyActive = (t) =>
      overlayItems.some((o) => o !== item && t >= o.start && t < o.start + o.duration)
    const candidates = []
    for (let t = 0; t <= manifestDuration; t += 0.25) {
      const at = Number(t.toFixed(3))
      if (inItem(at) || isBusy(at)) continue
      candidates.push({ at, active: anyActive(at) ? 1 : 0 })
    }
    candidates.sort((a, b) => a.active - b.active || Math.abs(a.at - tMid) - Math.abs(b.at - tMid))
    const tRef = candidates.length > 0 ? candidates[0].at : null
    if (tRef === null) {
      checks.push({
        id: 'overlay-structural',
        checkpoint: 'output',
        status: 'pass',
        scene: item.sceneId,
        overlayKind: item.type,
        text: item.text,
        interval,
        expected: 'a reference frame with no overlay of the same kind',
        found: 'every frame carries this overlay kind; visual check skipped',
        sampled: indexHtmlPath,
      })
      continue
    }

    const crop = overlayCropRegion({
      overlay: item,
      canvasWidth: probed.width,
      canvasHeight: probed.height,
    })
    const controlCrop = overlayControlCropRegion({
      crop,
      canvasHeight: probed.height,
    })

    const edgeDiff = sampleEdgeDensity({
      videoPath: outputPath,
      time: tMid,
      refTime: tRef,
      crop,
      controlCrop,
    })

    if (edgeDiff < QA_TEXT_EDGE_MIN) {
      checks.push({
        id: 'overlay-missing',
        checkpoint: 'output',
        status: 'fail',
        scene: item.sceneId,
        overlayKind: item.type,
        text: item.text,
        interval,
        expected: `edge density difference >= ${QA_TEXT_EDGE_MIN}`,
        found: `edge density difference ${edgeDiff.toFixed(4)}`,
        sampled: `tMid=${tMid}s, controlCrop=y:${controlCrop.y}`,
      })
    } else {
      checks.push({
        id: 'overlay-present',
        checkpoint: 'output',
        status: 'pass',
        scene: item.sceneId,
        overlayKind: item.type,
        text: item.text,
        interval,
        sampled: `tMid=${tMid}s, controlCrop=y:${controlCrop.y}`,
      })
    }
  }

  const ok = checks.every((c) => c.status === 'pass')
  return { ok, checks }
}

/**
 * Checkpoint 3: Output-set QA.
 * Evaluates existence, non-empty, and dimensions for this run's outputs (`outputs`, one
 * `{ format, path }` per format), the thumbnails, and the description. An output or a
 * thumbnail whose size cannot be read fails.
 */
export async function qaOutputSet({
  episodeDir,
  slug,
  outputs = [],
  thumbnailFormats = [],
  deps = {},
}) {
  const checks = []
  const probeSize = deps.probeSize || defaultProbeOutputSize

  // 1. Description file
  const descPath = path.join(episodeDir, `${slug}_description.md`)
  if (!fs.existsSync(descPath)) {
    checks.push({
      id: 'output-missing',
      checkpoint: 'output-set',
      status: 'fail',
      file: `${slug}_description.md`,
      expected: 'description file exists',
      found: 'file missing',
      sampled: descPath,
    })
  } else if (fs.statSync(descPath).size === 0) {
    checks.push({
      id: 'output-empty',
      checkpoint: 'output-set',
      status: 'fail',
      file: `${slug}_description.md`,
      expected: 'non-empty description file',
      found: '0 bytes',
      sampled: descPath,
    })
  } else {
    checks.push({
      id: 'output-description',
      checkpoint: 'output-set',
      status: 'pass',
      file: `${slug}_description.md`,
      sampled: descPath,
    })
  }

  // 2. The outputs this run rendered, one per format: a stale file from an earlier run,
  // or a derived variant under `formats/`, is never what QA reads (fail closed).
  const outputList = Array.isArray(outputs) ? outputs : []
  for (const output of outputList) {
    const sizeStr = String(output.format)
    const filePath = output.path
    const fileName = path.basename(String(filePath || `${slug}_${sizeStr}.mp4`))

    if (!filePath || !fs.existsSync(filePath)) {
      checks.push({
        id: 'output-missing',
        checkpoint: 'output-set',
        status: 'fail',
        format: sizeStr,
        file: fileName,
        expected: `output video ${fileName} exists`,
        found: 'file missing',
        sampled: filePath || null,
      })
      continue
    }

    if (fs.statSync(filePath).size === 0) {
      checks.push({
        id: 'output-empty',
        checkpoint: 'output-set',
        status: 'fail',
        format: sizeStr,
        file: fileName,
        expected: 'non-empty video file',
        found: '0 bytes',
        sampled: filePath,
      })
      continue
    }

    const [expW, expH] = sizeStr.split('x').map(Number)
    const actual = await probeSize(filePath)
    if (!actual) {
      checks.push({
        id: 'output-unreadable',
        checkpoint: 'output-set',
        status: 'fail',
        format: sizeStr,
        file: fileName,
        expected: sizeStr,
        found: 'size unreadable',
        sampled: filePath,
      })
    } else if (actual.width !== expW || actual.height !== expH) {
      checks.push({
        id: 'output-size-mismatch',
        checkpoint: 'output-set',
        status: 'fail',
        format: sizeStr,
        file: fileName,
        expected: sizeStr,
        found: `${actual.width}x${actual.height}`,
        sampled: filePath,
      })
    } else {
      checks.push({
        id: 'output-format',
        checkpoint: 'output-set',
        status: 'pass',
        format: sizeStr,
        file: fileName,
        sampled: filePath,
      })
    }
  }

  // 3. Thumbnail formats
  const thumbList = Array.isArray(thumbnailFormats) ? thumbnailFormats : []
  for (const size of thumbList) {
    const sizeStr = String(size)
    const fileName = `${slug}_thumbnail_${sizeStr}.png`
    const thumbPath = path.join(episodeDir, fileName)

    if (!fs.existsSync(thumbPath)) {
      checks.push({
        id: 'output-missing',
        checkpoint: 'output-set',
        status: 'fail',
        file: fileName,
        expected: `thumbnail ${fileName} exists`,
        found: 'file missing',
        sampled: thumbPath,
      })
      continue
    }

    if (fs.statSync(thumbPath).size === 0) {
      checks.push({
        id: 'output-empty',
        checkpoint: 'output-set',
        status: 'fail',
        file: fileName,
        expected: 'non-empty thumbnail file',
        found: '0 bytes',
        sampled: thumbPath,
      })
      continue
    }

    const [expW, expH] = sizeStr.split('x').map(Number)
    const actual = await probeSize(thumbPath)
    if (!actual) {
      checks.push({
        id: 'output-unreadable',
        checkpoint: 'output-set',
        status: 'fail',
        file: fileName,
        expected: sizeStr,
        found: 'size unreadable',
        sampled: thumbPath,
      })
    } else if (actual.width !== expW || actual.height !== expH) {
      checks.push({
        id: 'output-size-mismatch',
        checkpoint: 'output-set',
        status: 'fail',
        file: fileName,
        expected: sizeStr,
        found: `${actual.width}x${actual.height}`,
        sampled: thumbPath,
      })
    } else {
      checks.push({
        id: 'output-thumbnail',
        checkpoint: 'output-set',
        status: 'pass',
        file: fileName,
        sampled: thumbPath,
      })
    }
  }

  const ok = checks.every((c) => c.status === 'pass')
  return { ok, checks }
}

/**
 * Checkpoint 2: the cross-format check (spec S9). Every format manifest must carry the same
 * timeline as the primary: fps, total duration, and every scene, audio and overlay track's
 * start and length. Only the canvas may differ.
 * @param {object[]} manifests one per output format, primary first
 * @returns {{ ok: boolean, checks: object[] }}
 */
export function qaCrossFormat(manifests = []) {
  const timeline = (m) => ({
    fps: Number(m?.fps) || 0,
    totalDurationInFrames: Number(m?.totalDurationInFrames) || 0,
    scenes: (m?.tracks?.scenes || []).map((t) => [t.id, t.fromFrame, t.durationInFrames]),
    audio: (m?.tracks?.audio || []).map((t) => [t.id || t.kind || '', t.fromFrame, t.durationInFrames]),
    overlays: (m?.tracks?.overlays || []).map((t) => [t.id, t.fromFrame, t.durationInFrames]),
  })
  const list = Array.isArray(manifests) ? manifests : []
  if (list.length === 0) return { ok: true, checks: [] }
  const primary = list[0]
  const expected = JSON.stringify(timeline(primary))
  const checks = list.slice(1).map((m) => {
    const found = JSON.stringify(timeline(m))
    const same = found === expected
    const diff = []
    if (!same) {
      const a = timeline(primary)
      const b = timeline(m)
      for (const key of Object.keys(a)) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) diff.push(key)
    }
    return {
      id: same ? 'cross-format-timeline' : 'cross-format-mismatch',
      checkpoint: 'cross-format',
      status: same ? 'pass' : 'fail',
      format: formatOf(m),
      expected: `the timeline of ${formatOf(primary)}`,
      found: same ? 'same duration and timeline' : `differs in ${diff.join(', ')}`,
    }
  })
  return { ok: checks.every((c) => c.status === 'pass'), checks }
}

/**
 * Turns one `hyperframes check` result per format project into QA checks (spec S9): a
 * project passes only when the pinned CLI ran and exited 0. An unavailable checker fails.
 * @param {Array<{ format: string, projectDir: string, ok: boolean, reason?: string, detail?: string }>} results
 */
export function qaHyperframesCheck(results = []) {
  const checks = (Array.isArray(results) ? results : []).map((r) => ({
    id: r.ok ? 'hyperframes-check' : 'hyperframes-check-failed',
    checkpoint: 'hyperframes-check',
    status: r.ok ? 'pass' : 'fail',
    format: r.format,
    expected: '`hyperframes check` exits 0 for the format project',
    found: r.ok ? 'passed' : `${r.reason || 'failed'}${r.detail ? `: ${r.detail}` : ''}`,
    sampled: r.projectDir,
  }))
  return { ok: checks.every((c) => c.status === 'pass'), checks }
}

/**
 * Deterministic serialization of the QA report into qa.json.
 * Sorts checks by checkpoint, id, scene, and file so identical inputs produce byte-identical reports.
 */
export function writeQaReport(episodeDir, report) {
  const sortedChecks = [...(report.checks || [])].sort((a, b) => {
    const cp = String(a.checkpoint || '').localeCompare(String(b.checkpoint || ''))
    if (cp !== 0) return cp
    const fm = String(a.format || '').localeCompare(String(b.format || ''))
    if (fm !== 0) return fm
    const id = String(a.id || '').localeCompare(String(b.id || ''))
    if (id !== 0) return id
    const sc = String(a.scene || '').localeCompare(String(b.scene || ''))
    if (sc !== 0) return sc
    return String(a.file || '').localeCompare(String(b.file || ''))
  })

  const reportData = {
    ok: report.ok === true,
    checks: sortedChecks,
  }

  const reportPath = path.join(episodeDir, 'qa.json')
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2) + '\n', 'utf8')
  return reportPath
}
