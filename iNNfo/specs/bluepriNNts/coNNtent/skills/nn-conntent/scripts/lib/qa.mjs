/**
 * nn-conntent/scripts/lib/qa.mjs
 *
 * Full QA validation module (capability conntent-qa; design D-P5).
 * Two checkpoints:
 * 1. Master checkpoint (after render, before formats):
 *    - Structural overlay check against index.html (start and duration matching manifest)
 *    - Visible text edge density measurement (midpoint frame vs reference frame);
 *      skipped for an overlay with no text, never used for captions (checked by
 *      structure and manifest timing instead)
 *    - Master properties (duration +- 1 frame, resolution, audio stream when narrated)
 *    - Deterministic scene sampling
 * 2. Output-set checkpoint (after formats, thumbnails and description, before delivery):
 *    - Output formats, thumbnails and description existence, non-empty, and matching dimensions
 *
 * Deterministic qa.json report written to episode folder.
 * Exit 12 and status failed_qa on any check failure.
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnTool } from './spawn-tool.mjs'

/**
 * Presence heuristic, not a legibility measure: the minimum edge-density
 * difference between the overlay region at the midpoint of its interval and a
 * reference frame outside it.
 *
 * Evidence: an absent overlay measures about 0.0000 (compression noise stays
 * below 0.001); present overlays measured 0.005264-0.100208 on the pilot master
 * (9bd659de) but only 0.0029 for a visible lower-third over a textured background
 * in a later production (#610), which the former 0.004 rejected. 0.0015 sits
 * 1.5x above the absent ceiling and about 2x below the lowest present value, so
 * the two populations separate on both sides. Captions are not judged by this
 * number (adjacent captions differ by design); see qaMaster.
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

/** Probe video master properties (dimensions, duration, audio stream) using ffprobe. */
export function defaultProbeMaster(filePath) {
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

/** Compute bounding box / crop region for an overlay based on type and position. */
export function overlayCropRegion({ overlay, masterWidth = 1920, masterHeight = 1920 }) {
  if (overlay?.bbox && typeof overlay.bbox === 'object') {
    return {
      width: Math.max(16, Math.floor(overlay.bbox.width / 2) * 2),
      height: Math.max(16, Math.floor(overlay.bbox.height / 2) * 2),
      x: Math.max(0, Math.floor(overlay.bbox.x)),
      y: Math.max(0, Math.floor(overlay.bbox.y)),
    }
  }

  const pos = String(overlay?.config?.position || overlay?.props?.position || '').toLowerCase()
  const type = String(overlay?.type || overlay?.kind || '').toLowerCase()

  // Safe area proportions relative to master
  const wScale = masterWidth / 1920
  const hScale = masterHeight / 1920

  let x = 420
  let y = 1200
  let w = 700
  let h = 220

  if (pos.includes('top-left')) {
    x = 420
    y = 420
    w = 450
    h = 200
  } else if (pos.includes('top-right')) {
    x = 1050
    y = 420
    w = 450
    h = 200
  } else if (pos.includes('top')) {
    x = 474
    y = 420
    w = 700
    h = 200
  } else if (pos.includes('bottom-left') || type.includes('lowerthird')) {
    x = 474
    y = 1200
    w = 756
    h = 250
  } else if (pos.includes('bottom-right')) {
    x = 1050
    y = 1200
    w = 450
    h = 250
  } else if (pos.includes('bottom') || type.includes('caption')) {
    x = 474
    y = 1250
    w = 700
    h = 200
  } else if (pos.includes('center') || type.includes('title') || type.includes('quote')) {
    x = 450
    y = 800
    w = 1020
    h = 320
  } else if (type.includes('watermark')) {
    x = 550
    y = 1350
    w = 820
    h = 120
  }

  // Scale and clamp inside [0, masterWidth], [0, masterHeight]
  let cropW = Math.max(16, Math.min(masterWidth, Math.floor((w * wScale) / 2) * 2))
  let cropH = Math.max(16, Math.min(masterHeight, Math.floor((h * hScale) / 2) * 2))
  let cropX = Math.max(0, Math.min(masterWidth - cropW, Math.floor(x * wScale)))
  let cropY = Math.max(0, Math.min(masterHeight - cropH, Math.floor(y * hScale)))

  return { width: cropW, height: cropH, x: cropX, y: cropY }
}

/**
 * Measure edge density at a specific timestamp and crop region in a video file.
 * Returns ratio of edge pixels (0.0 to 1.0).
 *
 * The decoded frame goes to a temp file, never to stdout: reading binary frame
 * bytes from a spawnSync pipe was reported to come back empty on Windows, so
 * every overlay measured 0 and looked missing (#616).
 */
export function defaultMeasureFrameEdgeDensity({ masterPath, timeSeconds, crop, run = spawnTool }) {
  const cropFilter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},edgedetect,format=gray`
  const ss = Math.max(0, timeSeconds).toFixed(3)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-frame-'))
  const framePath = path.join(tmpDir, 'frame.gray')
  let buf
  try {
    const res = run(
      'ffmpeg',
      ['-v', 'error', '-y', '-ss', ss, '-i', masterPath, '-vframes', '1', '-filter:v', cropFilter, '-f', 'rawvideo', framePath],
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

/** Compare edge density at tMid against reference frame outside overlay interval. */
export function defaultSampleEdgeDensity({
  masterPath,
  time,
  refTime,
  crop,
  measureFn = defaultMeasureFrameEdgeDensity,
}) {
  const densityMid = measureFn({ masterPath, timeSeconds: time, crop })
  const densityRef = refTime !== null ? measureFn({ masterPath, timeSeconds: refTime, crop }) : 0
  return Math.abs(densityMid - densityRef)
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
 * Checkpoint 1: Master QA.
 * Evaluates duration, dimensions, audio stream, and structural + visible overlay emission.
 */
export async function qaMaster({
  episodeDir,
  manifest,
  masterPath,
  declaredSize = '1920x1920',
  deps = {},
}) {
  const checks = []

  // 1. Tool check
  const checkTools = deps.checkTools || defaultCheckTools
  const tools = checkTools()
  if (!tools.ok) {
    checks.push({
      id: 'qa-unavailable',
      checkpoint: 'master',
      status: 'fail',
      expected: 'ffprobe and ffmpeg available on PATH',
      found: tools.error || 'tool check failed',
      sampled: masterPath,
    })
    return { ok: false, checks }
  }

  // 2. Master readable check & probe
  const probeMaster = deps.probeMaster || defaultProbeMaster
  const probed = probeMaster(masterPath)
  if (probed.error) {
    checks.push({
      id: 'qa-unavailable',
      checkpoint: 'master',
      status: 'fail',
      expected: 'master file readable by ffprobe',
      found: probed.error,
      sampled: masterPath,
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
      checkpoint: 'master',
      status: 'fail',
      expected: declaredSize,
      found: `${probed.width}x${probed.height}`,
      sampled: masterPath,
    })
  } else {
    checks.push({
      id: 'size',
      checkpoint: 'master',
      status: 'pass',
      expected: declaredSize,
      found: `${probed.width}x${probed.height}`,
      sampled: masterPath,
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
      checkpoint: 'master',
      status: 'fail',
      expected: manifestDuration,
      found: probed.duration,
      sampled: masterPath,
    })
  } else {
    checks.push({
      id: 'duration',
      checkpoint: 'master',
      status: 'pass',
      expected: manifestDuration,
      found: probed.duration,
      sampled: masterPath,
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
        checkpoint: 'master',
        status: 'fail',
        scene: scene.id || scene.slug,
        expected: `<= ${probed.duration.toFixed(3)}s`,
        found: `${sEnd.toFixed(3)}s`,
        sampled: masterPath,
      })
    }
    // Fixed position sampling records
    checks.push({
      id: 'scene-sampling',
      checkpoint: 'master',
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
      checkpoint: 'master',
      status: 'fail',
      expected: 'master has audio stream',
      found: 'no audio stream',
      sampled: masterPath,
    })
  } else if (hasNarration) {
    checks.push({
      id: 'audio',
      checkpoint: 'master',
      status: 'pass',
      expected: 'master has audio stream',
      found: 'audio stream present',
      sampled: masterPath,
    })
  }

  // 6. Overlays check: structural and visible
  const indexHtmlPath = path.join(episodeDir, 'hyperframes', 'index.html')
  if (!fs.existsSync(indexHtmlPath)) {
    checks.push({
      id: 'overlay-missing',
      checkpoint: 'master',
      status: 'fail',
      expected: 'hyperframes/index.html exists',
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
        checkpoint: 'master',
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
          checkpoint: 'master',
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
        checkpoint: 'master',
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
        checkpoint: 'master',
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

    // Visible check
    const tMid = Number((item.start + item.duration / 2).toFixed(3))
    const tRef =
      item.start >= 0.5
        ? Number(Math.max(0, item.start - 0.5).toFixed(3))
        : item.start + item.duration + 0.5 <= manifestDuration
          ? Number((item.start + item.duration + 0.5).toFixed(3))
          : null

    const crop = overlayCropRegion({
      overlay: item,
      masterWidth: probed.width,
      masterHeight: probed.height,
    })

    const edgeDiff = sampleEdgeDensity({
      masterPath,
      time: tMid,
      refTime: tRef,
      crop,
    })

    if (edgeDiff < QA_TEXT_EDGE_MIN) {
      checks.push({
        id: 'overlay-missing',
        checkpoint: 'master',
        status: 'fail',
        scene: item.sceneId,
        overlayKind: item.type,
        text: item.text,
        interval,
        expected: `edge density difference >= ${QA_TEXT_EDGE_MIN}`,
        found: `edge density difference ${edgeDiff.toFixed(4)}`,
        sampled: `tMid=${tMid}s, tRef=${tRef !== null ? tRef + 's' : 'none'}`,
      })
    } else {
      checks.push({
        id: 'overlay-present',
        checkpoint: 'master',
        status: 'pass',
        scene: item.sceneId,
        overlayKind: item.type,
        text: item.text,
        interval,
        sampled: `tMid=${tMid}s, tRef=${tRef !== null ? tRef + 's' : 'none'}`,
      })
    }
  }

  const ok = checks.every((c) => c.status === 'pass')
  return { ok, checks }
}

/**
 * Checkpoint 2: Output-set QA.
 * Evaluates existence, non-empty, and dimensions for video formats, thumbnails, and description.
 */
export async function qaOutputSet({
  episodeDir,
  slug,
  outputFormats = [],
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

  // 2. Video formats
  const formatsList = Array.isArray(outputFormats) ? outputFormats : []
  for (const size of formatsList) {
    const sizeStr = String(size)
    const subPath = path.join(episodeDir, 'formats', `${slug}_${sizeStr}.mp4`)
    const rootPath = path.join(episodeDir, `${slug}_${sizeStr}.mp4`)
    const filePath = fs.existsSync(subPath) ? subPath : fs.existsSync(rootPath) ? rootPath : null

    if (!filePath) {
      checks.push({
        id: 'output-missing',
        checkpoint: 'output-set',
        status: 'fail',
        file: `${slug}_${sizeStr}.mp4`,
        expected: `format video ${slug}_${sizeStr}.mp4 exists`,
        found: 'file missing',
        sampled: subPath,
      })
      continue
    }

    if (fs.statSync(filePath).size === 0) {
      checks.push({
        id: 'output-empty',
        checkpoint: 'output-set',
        status: 'fail',
        file: path.basename(filePath),
        expected: 'non-empty video file',
        found: '0 bytes',
        sampled: filePath,
      })
      continue
    }

    const [expW, expH] = sizeStr.split('x').map(Number)
    const actual = await probeSize(filePath)
    if (actual && (actual.width !== expW || actual.height !== expH)) {
      checks.push({
        id: 'output-size-mismatch',
        checkpoint: 'output-set',
        status: 'fail',
        file: path.basename(filePath),
        expected: sizeStr,
        found: `${actual.width}x${actual.height}`,
        sampled: filePath,
      })
    } else {
      checks.push({
        id: 'output-format',
        checkpoint: 'output-set',
        status: 'pass',
        file: path.basename(filePath),
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
    if (actual && (actual.width !== expW || actual.height !== expH)) {
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
 * Deterministic serialization of the QA report into qa.json.
 * Sorts checks by checkpoint, id, scene, and file so identical inputs produce byte-identical reports.
 */
export function writeQaReport(episodeDir, report) {
  const sortedChecks = [...(report.checks || [])].sort((a, b) => {
    const cp = String(a.checkpoint || '').localeCompare(String(b.checkpoint || ''))
    if (cp !== 0) return cp
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
