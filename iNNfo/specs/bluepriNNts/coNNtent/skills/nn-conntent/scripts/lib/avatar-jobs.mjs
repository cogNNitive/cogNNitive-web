/**
 * nn-conntent/scripts/lib/avatar-jobs.mjs
 *
 * One avatar job = one scene's audio + the avatar still image. This module is the single
 * definition of (a) which layers are avatar layers, (b) where a scene's audio comes from and
 * (c) the cache key of the finished lip-sync video, shared by synthesize-avatar.mjs (which
 * writes the cache) and compile (which picks the cached clip up at zero cost). A narrated
 * scene's audio is read straight from its TTS cache entry (`ttsCachePathFor`); no staged
 * audio file exists.
 *
 * Render contract: at render time a `talking_avatar` layer is drawn by AvatarFrame as a STILL
 * image. A cached clip is applied by rewriting the layer to `layer_type: video`,
 * `layer_asset_source: <cached mp4>` and `layer_muted: true` (the narration Audio track is
 * bound separately, so the clip's own audio would echo it). compile stages the mp4 into the
 * project public dir like any other media layer.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { normalizeModelId } from './video-guard.mjs'
import { loadMergedCatalog, resolveModel, resolutionsOf } from './catalog.mjs'
import { translateIntent } from './intent.mjs'
import { AVATAR_IMAGE_MIME } from './avatar-request.mjs'
import { buildTtsVoiceOptions, resolveRegisteredVoice } from './tts-options.mjs'

export const AVATAR_CACHE_CATEGORY = 'temp'
export const AVATAR_CACHE_EXT = 'mp4'
export const DEFAULT_AVATAR_RESOLUTION = '480p'

/**
 * The nominal pixel height a `480p` / `720p` / `768p` label declares. The label is a
 * target, not a guarantee: see `checkAvatarClip`.
 * @param {string} resolution
 * @returns {number}
 */
export function declaredHeightOf(resolution) {
  const m = /^(\d+)p$/i.exec(String(resolution || '').trim())
  return m ? Number.parseInt(m[1], 10) : 0
}

/** Tolerance when comparing an asset's aspect ratio to a square (a rounded PNG edge). */
export const AVATAR_SQUARE_TOLERANCE = 0.02

/**
 * Compares the clip's measured size against the resolution that was requested.
 *
 * The WaveSpeed avatar provider does not enforce `resolution`: measured A/B on the
 * default InfiniTalk model with `avatar_resolution: 720p` returned 480x480 for a
 * 1920x1920 input and 640x352 for a 2848x1600 input. It preserves the input aspect ratio
 * and holds the pixel budget near 0.23 Mpx, so the declared label is advisory and the
 * short side is the dimension that collapses. Nothing here changes the request or the
 * cache key; it only reports what came back (#691).
 *
 * @param {{ resolution: string, width?: number, height?: number }} o
 * @returns {{ ok: boolean, warning?: string, width?: number, height?: number, declaredHeight: number }}
 */
export function checkAvatarClip({ resolution, width, height }) {
  const declaredHeight = declaredHeightOf(resolution)
  if (!width || !height) {
    return {
      ok: false,
      declaredHeight,
      warning:
        "could not read the produced avatar clip's dimensions, so the declared " +
        resolution +
        ' could not be verified. The provider treats `resolution` as advisory; check the output before delivery.',
    }
  }
  const shortSide = Math.min(width, height)
  if (declaredHeight > 0 && shortSide < declaredHeight) {
    return {
      ok: false,
      declaredHeight,
      width,
      height,
      warning:
        'the avatar provider returned ' +
        width +
        'x' +
        height +
        ' for a declared ' +
        resolution +
        ' (short side ' +
        shortSide +
        ' < ' +
        declaredHeight +
        '). `resolution` is advisory: the provider keeps the ' +
        'input aspect ratio and holds the pixel budget near 0.23 Mpx. Accept the clip as produced, or raise the ' +
        "input image's pixels.",
    }
  }
  return { ok: true, declaredHeight, width, height }
}

/**
 * A square master composes a full-frame avatar layer with `cover`, so a non-1:1 still
 * loses roughly 31% of its frame (a 16:9 image keeps ~0.56 of its height once cropped to
 * a square). Warn instead of rejecting, and never change the composition (#691).
 *
 * @param {{ width?: number, height?: number, label?: string }} o
 * @returns {string | null}
 */
export function checkAvatarAssetAspect({ width, height, label = 'avatar image' }) {
  if (!width || !height) return null
  const ratio = width / height
  if (Math.abs(ratio - 1) <= AVATAR_SQUARE_TOLERANCE) return null
  const kept = Math.round((Math.min(width, height) / Math.max(width, height)) * 100)
  return (
    label +
    ' is ' +
    width +
    'x' +
    height +
    ' (' +
    ratio.toFixed(2) +
    ':1), not square. A square master ' +
    'draws a full-frame avatar layer with `cover`, so only about ' +
    kept +
    '% of the frame survives ' +
    '(roughly ' +
    (100 - kept) +
    '% is cropped). Compose it as square, or place it in a `contain` box.'
  )
}

/** Model-appropriate fallback when the script declares no resolution. */

export const DEFAULT_MAX_AVATAR_UPSCALE = 3.0

/**
 * Warns when the centered-cover upscale factor of an avatar asset in any configured
 * output format exceeds the threshold (spec S4).
 * @param {{ width?: number, height?: number, formats?: Array<{ width: number, height: number, size?: string }>, maxUpscale?: number, label?: string }} o
 * @returns {string[]}
 */
export function checkAvatarUpscale({
  width,
  height,
  formats = [],
  maxUpscale = DEFAULT_MAX_AVATAR_UPSCALE,
  label = 'avatar',
}) {
  if (!width || !height || !Array.isArray(formats) || formats.length === 0) return []
  const warnings = []
  for (const fmt of formats) {
    if (!fmt.width || !fmt.height) continue
    const scale = Math.max(fmt.width / width, fmt.height / height)
    if (scale > maxUpscale) {
      const tag = fmt.size || `${fmt.width}x${fmt.height}`
      warnings.push(
        `${label} (${width}x${height}) requires a ${scale.toFixed(2)}x upscale to cover ${tag} (threshold: ${maxUpscale}x). ` +
          `Centered \`cover\` may show blur or pixelation. Opt in to a dedicated format clip or provide a higher-resolution portrait.`,
      )
    }
  }
  return warnings
}

/**
 * The default resolution of a catalog avatar Model: the first of its declared `resolutions`
 * (#752 step 3: the values are catalog data, never an engine table keyed by vendor). A model
 * the catalog does not declare, or one that declares no values, falls back to
 * DEFAULT_AVATAR_RESOLUTION; it cannot be called anyway until it is declared.
 * @param {{ resolutions?: string[] } | null} model the resolved catalog Model
 */
export function defaultResolutionFor(model) {
  return declaredResolutions(model)[0] || DEFAULT_AVATAR_RESOLUTION
}

/**
 * The Model's declared `resolutions`. A Model that declares the `resolution` control but no
 * values (an overlay written before `resolutions` existed) is refused before any spend: no
 * value can be requested or defaulted safely for it.
 */
function declaredResolutions(model) {
  const list = resolutionsOf(model)
  if (list.length === 0 && (model?.controls || []).map(String).includes('resolution')) {
    throw new Error(
      'Avatar model ' +
        (model.api_id || model.slug) +
        ' declares the resolution control but no resolutions: declare `resolutions:: [...]` on it in the catalog ' +
        '(the first value is its default). Nothing was spent.',
    )
  }
  return list
}

/**
 * Validates a requested resolution against the catalog Model's declared `resolutions` (fail
 * closed, before any spend). A requested value needs the `resolution` control; a Model that
 * declares no values is not constrained beyond that.
 * @param {string | undefined} requested the Layer's `avatar_resolution`
 * @param {{ slug?: string, api_id?: string, controls?: string[], resolutions?: string[] } | null} model
 */
export function normalizeAvatarResolution(requested, model) {
  if (requested && model) translateIntent({ avatar_resolution: requested }, model)
  const allowed = declaredResolutions(model)
  const r = requested ? String(requested) : defaultResolutionFor(model)
  if (allowed.length > 0 && !allowed.includes(r)) {
    throw new Error(
      'Avatar resolution "' +
        r +
        '" is not supported by ' +
        (model?.api_id || model?.slug) +
        ' (declared resolutions: ' +
        allowed.join(', ') +
        ').',
    )
  }
  return r
}

/** The catalog Model an avatar model id names, or null when the catalog does not declare it. */
function declaredAvatarModel(catalog, id) {
  try {
    return resolveModel(catalog, id)
  } catch {
    return null
  }
}

/**
 * The single avatar-layer predicate (estimator, synthesize-avatar and compile pickup). Only an
 * explicit avatar `layer_type` counts: a layer typed `image` or `video` is never an avatar job,
 * and a name such as "Avatar Intro" alone is not enough.
 */
export function isAvatarLayer(l) {
  const t = String(l?.properties?.layer_type ?? l?.fields?.type ?? l?.type ?? '')
    .toLowerCase()
    .trim()
  return t === 'talking_avatar' || t === 'talking-avatar' || t === 'avatar'
}

const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

/**
 * Content-addressed key: image bytes + audio bytes + {model, resolution}. Moving or renaming
 * files never changes it; changing either input or the model does.
 * @param {{ computeHash: (c: string, o?: object) => string }} cacheManager
 * @param {{ imagePath: string, audioPath: string, model: string, resolution?: string }} job
 */
export function avatarJobKey(
  cacheManager,
  { imagePath, audioPath, model, resolution = DEFAULT_AVATAR_RESOLUTION },
) {
  return cacheManager.computeHash(
    'image:' + sha256File(imagePath) + ':audio:' + sha256File(audioPath),
    {
      model: normalizeModelId(model),
      resolution,
    },
  )
}

/**
 * The TTS cache entry for a scene's CURRENT narration, voice and model (the same key compile
 * writes). A narration/voice edit changes the key, so a stale entry is never served.
 * @returns {string | undefined} Absolute cache file path, or undefined on a miss
 */
export function ttsCacheKeyFor(sc, { cacheManager, config, models = {}, bags = {} }) {
  const narration = String(sc.narration || '').trim()
  if (!narration) return undefined
  const options = resolveRegisteredVoice(buildTtsVoiceOptions(sc, models, bags), config)
  return cacheManager.computeHash(narration, options)
}

export function ttsCachePathFor(sc, opts) {
  const key = ttsCacheKeyFor(sc, opts)
  if (!key) return undefined
  return (
    opts.cacheManager.getSync(key, 'mp3', 'tts') ||
    opts.cacheManager.getSync(key + '-offline', 'mp3', 'tts') ||
    undefined
  )
}

/**
 * Collects the avatar jobs of a parsed script.
 *
 * A job needs a measurable narration: the paid clip is driven by the scene's TTS audio, so a
 * Scene with no narration has nothing to lip-sync. Those Layers are reported in `skipped`, not
 * in `problems`: they are not malformed, they are not jobs. The pre-compile guard refuses an
 * `avatar` Layer in a Scene with no narration (`avatar-requires-narration`) and names the type
 * that draws a still, so this list only matters when the stage is run directly.
 * @param {Object} o
 * @param {{ scenes: any[] }} o.parsed
 * @param {string} o.scriptDir
 * @param {{ computeHash: Function }} o.cacheManager
 * @param {string[]} [o.sceneIds] Restrict to these scene ids.
 * @param {{ voices?: object }} o.config Guard config (registered voices are part of the TTS key).
 * @param {{ tts?: string }} [o.models]
 * @param {object} [o.bags]
 * @param {{ models: object }} [o.catalog] Merged catalog whose avatar Models declare `resolutions` (default: the reference catalog).
 * @returns {{ jobs: any[], problems: string[], skipped: Array<{ sceneId: string, layerName: string }> }}
 *   `problems` lists missing images/audio (no job is created for them) and an unresolved
 *   `avatar_model` (its job is still listed, so the pickup reports it missing); `skipped` lists avatar
 *   Layers whose Scene carries no narration, which render as their still image.
 */
export function collectAvatarJobs({
  parsed,
  scriptDir,
  cacheManager,
  sceneIds,
  config,
  models = {},
  bags = {},
  catalog = loadMergedCatalog({ overlay: null }),
}) {
  const jobs = []
  const problems = []
  const skipped = []
  for (const sc of parsed.scenes) {
    if (sceneIds && !sceneIds.includes(sc.id)) continue
    for (const layer of (sc.layers || []).filter(isAvatarLayer)) {
      // No narration, nothing to lip-sync: the Layer stays a still. Never a job.
      if (String(sc.narration || '').trim().length === 0) {
        skipped.push({ sceneId: sc.id, layerName: layer.name })
        continue
      }
      const src = layer.properties?.layer_asset_source
      const imagePath = src ? path.resolve(scriptDir, src) : null
      const audioPath = ttsCachePathFor(sc, { cacheManager, config, models, bags })
      if (!imagePath) {
        const prompted = layer.properties?.layer_prompt || layer.properties?.prompt
        problems.push(
          'Scene ' +
            sc.id +
            ': ' +
            (prompted
              ? 'the avatar layer has only a prompt. Avatar images must be real files: generate the image first (compile generates prompt layers into the cache) and reference the file with ![media](path).'
              : 'the avatar layer has no image. Reference a real image file with ![media](path).'),
        )
        continue
      }
      if (!fs.existsSync(imagePath)) {
        problems.push('Scene ' + sc.id + ': avatar image not found (' + imagePath + ').')
        continue
      }
      if (!AVATAR_IMAGE_MIME[path.extname(imagePath).toLowerCase()]) {
        problems.push(
          'Scene ' +
            sc.id +
            ': avatar image extension must be one of ' +
            Object.keys(AVATAR_IMAGE_MIME).join(', ') +
            ' (got ' +
            imagePath +
            ').',
        )
        continue
      }
      if (!audioPath || !fs.existsSync(audioPath)) {
        problems.push(
          'Scene ' +
            sc.id +
            ': no TTS cache entry for its current narration, voice and model. Run compile first to populate the TTS cache.',
        )
        continue
      }
      const model = normalizeModelId(layer.properties?.layer_avatar_model)
      if (!model) {
        // The blueprint pins no vendor model: the domain plugs one in. synthesize-avatar refuses
        // on any problem (before any spend); the job itself is still listed, so the compile
        // pickup reports its clip as missing and render refuses instead of drawing a still.
        problems.push(
          'Scene ' +
            sc.id +
            ': no avatar_model resolved for the avatar layer. The blueprint pins no vendor model: declare `avatar_model:: <api_id>` ' +
            '(a merged-catalog avatar Model) in the domain video-defaults_NN.md, or on the Series, Character, Scene or Layer.',
        )
      }
      const resolution = normalizeAvatarResolution(
        layer.properties?.layer_avatar_resolution,
        declaredAvatarModel(catalog, model),
      )
      jobs.push({
        sceneId: sc.id,
        layerName: layer.name,
        layer,
        imagePath,
        audioPath,
        model,
        resolution,
        cacheKey: avatarJobKey(cacheManager, { imagePath, audioPath, model, resolution }),
      })
    }
  }
  return { jobs, problems, skipped }
}

/**
 * Compile-side pickup: rewrites each avatar layer that has a cached lip-sync clip. Cache reads
 * only: it never synthesizes or spends.
 * @returns {{ applied: number, missing: number, clips: string[] }} `clips` are the cached clip paths that were applied.
 */
export function applyCachedAvatars({
  parsed,
  scriptDir,
  cacheManager,
  config,
  models,
  bags,
  catalog,
}) {
  const { jobs } = collectAvatarJobs({
    parsed,
    scriptDir,
    cacheManager,
    config,
    models,
    bags,
    catalog,
  })
  let applied = 0
  let missing = 0
  const missingLayers = []
  const clips = []
  for (const job of jobs) {
    const cached = cacheManager.getSync(job.cacheKey, AVATAR_CACHE_EXT, AVATAR_CACHE_CATEGORY)
    if (!cached) {
      missing++
      missingLayers.push({ sceneId: job.sceneId, layerName: job.layerName })
      continue
    }
    job.layer.properties.layer_type = 'video'
    job.layer.properties.layer_asset_source = cached
    job.layer.properties.layer_muted = true
    job.layer.properties.layer_avatar_origin = true
    job.layer.properties.layer_fit = { native: 'cover', mismatch: 'cover' }
    clips.push(cached)
    applied++
  }
  return { applied, missing, missingLayers, clips }
}
