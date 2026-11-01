/**
 * nn-video-script/scripts/lib/avatar-jobs.mjs
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

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeModelId } from './video-guard.mjs';
import { AVATAR_IMAGE_MIME } from './avatar-request.mjs';
import { buildTtsVoiceOptions, resolveRegisteredVoice } from './tts-options.mjs';

export const AVATAR_CACHE_CATEGORY = 'temp';
export const AVATAR_CACHE_EXT = 'mp4';
export const DEFAULT_AVATAR_RESOLUTION = '480p';

/** Resolutions each avatar model accepts. Pruna rejects 720p; InfiniTalk accepts it. */
export function validResolutionsFor(model) {
  const m = normalizeModelId(model);
  if (m.includes('pruna')) return ['480p', '768p'];
  return ['480p', '720p', '768p'];
}

/** Model-appropriate fallback when the script declares no resolution. */
export function defaultResolutionFor(model) {
  const m = normalizeModelId(model);
  return m.includes('pruna') ? '480p' : '720p';
}

/** Validates a requested resolution against the model's allowed set (fail closed). */
export function normalizeAvatarResolution(requested, model) {
  const allowed = validResolutionsFor(model);
  const r = requested ? String(requested) : defaultResolutionFor(model);
  if (!allowed.includes(r)) {
    throw new Error('Avatar resolution "' + r + '" is not supported by ' + model + ' (allowed: ' + allowed.join(', ') + ').');
  }
  return r;
}

/**
 * The single avatar-layer predicate (estimator, synthesize-avatar and compile pickup). Only an
 * explicit avatar `layer_type` counts: a layer typed `image` or `video` is never an avatar job,
 * and a name such as "Avatar Intro" alone is not enough.
 */
export function isAvatarLayer(l) {
  const t = String(l.properties?.layer_type ?? l.type ?? '').toLowerCase().trim();
  return t === 'talking_avatar' || t === 'talking-avatar' || t === 'avatar';
}

const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Content-addressed key: image bytes + audio bytes + {model, resolution}. Moving or renaming
 * files never changes it; changing either input or the model does.
 * @param {{ computeHash: (c: string, o?: object) => string }} cacheManager
 * @param {{ imagePath: string, audioPath: string, model: string, resolution?: string }} job
 */
export function avatarJobKey(cacheManager, { imagePath, audioPath, model, resolution = DEFAULT_AVATAR_RESOLUTION }) {
  return cacheManager.computeHash('image:' + sha256File(imagePath) + ':audio:' + sha256File(audioPath), {
    model: normalizeModelId(model),
    resolution,
  });
}

/**
 * The TTS cache entry for a scene's CURRENT narration, voice and model (the same key compile
 * writes). A narration/voice edit changes the key, so a stale entry is never served.
 * @returns {string | undefined} Absolute cache file path, or undefined on a miss
 */
export function ttsCachePathFor(sc, { cacheManager, config, models = {}, bags = {} }) {
  const narration = String(sc.narration || '').trim();
  if (!narration) return undefined;
  const options = resolveRegisteredVoice(buildTtsVoiceOptions(sc, models, bags), config);
  const key = cacheManager.computeHash(narration, options);
  return cacheManager.getSync(key, 'mp3', 'tts') || undefined;
}

/**
 * Collects the avatar jobs of a parsed script.
 * @param {Object} o
 * @param {{ scenes: any[] }} o.parsed
 * @param {string} o.scriptDir
 * @param {{ computeHash: Function }} o.cacheManager
 * @param {string[]} [o.sceneIds] Restrict to these scene ids.
 * @param {{ voices?: object }} o.config Guard config (registered voices are part of the TTS key).
 * @param {{ tts?: string }} [o.models]
 * @param {object} [o.bags]
 * @returns {{ jobs: any[], problems: string[] }} `problems` lists missing images/audio (no job is created for them).
 */
export function collectAvatarJobs({ parsed, scriptDir, cacheManager, sceneIds, config, models = {}, bags = {} }) {
  const jobs = [];
  const problems = [];
  for (const sc of parsed.scenes) {
    if (sceneIds && !sceneIds.includes(sc.id)) continue;
    for (const layer of (sc.layers || []).filter(isAvatarLayer)) {
      const src = layer.properties?.layer_asset_source;
      const imagePath = src ? path.resolve(scriptDir, src) : null;
      const narrated = String(sc.narration || '').trim().length > 0;
      const explicit = sc.properties?.audio_asset_source || sc.properties?.voiceover;
      const audioPath = narrated
        ? ttsCachePathFor(sc, { cacheManager, config, models, bags })
        : explicit ? path.resolve(scriptDir, explicit) : undefined;
      if (!imagePath) {
        const prompted = layer.properties?.layer_prompt || layer.properties?.prompt;
        problems.push(
          'Scene ' + sc.id + ': ' + (prompted
            ? 'the avatar layer has only a prompt. Avatar images must be real files: generate the image first (compile generates prompt layers into the cache) and reference the file with ![media](path).'
            : 'the avatar layer has no image. Reference a real image file with ![media](path).'),
        );
        continue;
      }
      if (!fs.existsSync(imagePath)) {
        problems.push('Scene ' + sc.id + ': avatar image not found (' + imagePath + ').');
        continue;
      }
      if (!AVATAR_IMAGE_MIME[path.extname(imagePath).toLowerCase()]) {
        problems.push('Scene ' + sc.id + ': avatar image extension must be one of ' + Object.keys(AVATAR_IMAGE_MIME).join(', ') + ' (got ' + imagePath + ').');
        continue;
      }
      if (!audioPath || !fs.existsSync(audioPath)) {
        problems.push(
          'Scene ' + sc.id + ': ' + (narrated
            ? 'no TTS cache entry for its current narration, voice and model. Run compile first to populate the TTS cache.'
            : 'no narration and no audio_asset_source/voiceover file (' + (audioPath || 'none declared') + '). Declare one, or add narration and run compile first.'),
        );
        continue;
      }
      const model = normalizeModelId(layer.properties?.layer_avatar_model);
      const resolution = normalizeAvatarResolution(layer.properties?.layer_avatar_resolution, model);
      jobs.push({
        sceneId: sc.id,
        layerName: layer.name,
        layer,
        imagePath,
        audioPath,
        model,
        resolution,
        cacheKey: avatarJobKey(cacheManager, { imagePath, audioPath, model, resolution }),
      });
    }
  }
  return { jobs, problems };
}

/**
 * Compile-side pickup: rewrites each avatar layer that has a cached lip-sync clip. Cache reads
 * only: it never synthesizes or spends.
 * @returns {{ applied: number, missing: number, clips: string[] }} `clips` are the cached clip paths that were applied.
 */
export function applyCachedAvatars({ parsed, scriptDir, cacheManager, config, models, bags }) {
  const { jobs } = collectAvatarJobs({ parsed, scriptDir, cacheManager, config, models, bags });
  let applied = 0;
  let missing = 0;
  const clips = [];
  for (const job of jobs) {
    const cached = cacheManager.getSync(job.cacheKey, AVATAR_CACHE_EXT, AVATAR_CACHE_CATEGORY);
    if (!cached) {
      missing++;
      continue;
    }
    job.layer.properties.layer_type = 'video';
    job.layer.properties.layer_asset_source = cached;
    job.layer.properties.layer_muted = true;
    clips.push(cached);
    applied++;
  }
  return { applied, missing, clips };
}
