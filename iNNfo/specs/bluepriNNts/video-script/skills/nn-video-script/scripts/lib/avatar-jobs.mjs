/**
 * nn-video-script/scripts/lib/avatar-jobs.mjs
 *
 * One avatar job = one scene's audio + the avatar still image. This module is the single
 * definition of (a) which layers are avatar layers, (b) where a scene's audio comes from and
 * (c) the cache key of the finished lip-sync video, shared by synthesize-avatar.mjs (which
 * writes the cache) and compile (which picks the cached clip up at zero cost).
 *
 * Render contract: at render time a `talking_avatar` layer is drawn by AvatarFrame as a STILL
 * image. A cached clip is applied by rewriting the layer to `layer_type: video`,
 * `layer_asset_source: <cached mp4>` and `layer_muted: true` (the narration Audio track is
 * bound separately, so the clip's own audio would echo it). compile stages the mp4 into the
 * Remotion public dir like any other media layer.
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
export const DEFAULT_AVATAR_RESOLUTION = '720p';

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
 * Where a scene's narration audio is read from, in ONE order shared with compile and the
 * compiler: the staged TTS (`audio/<sceneId>_voiceover.mp3`) when the scene has narration,
 * otherwise an explicit `audio_asset_source` / `voiceover` property.
 * @returns {string} Absolute path (may not exist)
 */
export function sceneAudioPath(sc, scriptDir) {
  const staged = path.resolve(scriptDir, 'audio', sc.id + '_voiceover.mp3');
  if (String(sc.narration || '').trim().length > 0) return staged;
  const explicit = sc.properties?.audio_asset_source || sc.properties?.voiceover;
  return explicit ? path.resolve(scriptDir, explicit) : staged;
}

/**
 * Refuses stale audio: when the scene has narration, the staged audio must be byte-identical to
 * the CURRENT TTS cache entry for that narration (it goes stale after a narration/voice edit).
 * @throws {Error} telling the user to re-run compile first
 */
export function assertAudioFresh({ sc, audioPath, cacheManager, config, models = {} }) {
  const narration = String(sc.narration || '').trim();
  if (!narration) return;
  const options = resolveRegisteredVoice(buildTtsVoiceOptions(sc, models), config);
  const key = cacheManager.computeHash(narration, options);
  const cached = cacheManager.getSync(key, 'mp3', 'tts');
  if (!cached || !fs.readFileSync(cached).equals(fs.readFileSync(audioPath))) {
    throw new Error(
      'Scene ' + sc.id + ': the staged audio ' + audioPath + ' does not match the current TTS output for its narration ' +
        '(the narration, voice or model changed, or compile has not run). Re-run compile first.',
    );
  }
}

/**
 * Collects the avatar jobs of a parsed script.
 * @param {Object} o
 * @param {{ scenes: any[] }} o.parsed
 * @param {string} o.scriptDir
 * @param {{ computeHash: Function }} o.cacheManager
 * @param {(model: string | undefined) => string} o.resolveModel Resolves a layer model prop to the model id.
 * @param {string[]} [o.sceneIds] Restrict to these scene ids.
 * @param {(sc: any) => string | undefined} [o.audioFor] Override the audio source (compile passes its fresh TTS output).
 * @returns {{ jobs: any[], problems: string[] }} `problems` lists missing images/audio (no job is created for them).
 */
export function collectAvatarJobs({ parsed, scriptDir, cacheManager, resolveModel, sceneIds, audioFor }) {
  const jobs = [];
  const problems = [];
  for (const sc of parsed.scenes) {
    if (sceneIds && !sceneIds.includes(sc.id)) continue;
    for (const layer of (sc.layers || []).filter(isAvatarLayer)) {
      const src = layer.properties?.layer_asset_source;
      const imagePath = src ? path.resolve(scriptDir, src) : null;
      const audioPath = audioFor?.(sc) || sceneAudioPath(sc, scriptDir);
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
        problems.push('Scene ' + sc.id + ': narration audio not found (' + audioPath + '). Run compile first to generate it.');
        continue;
      }
      const model = resolveModel(layer.properties?.layer_avatar_model);
      jobs.push({
        sceneId: sc.id,
        layerName: layer.name,
        layer,
        imagePath,
        audioPath,
        model,
        resolution: DEFAULT_AVATAR_RESOLUTION,
        cacheKey: avatarJobKey(cacheManager, { imagePath, audioPath, model }),
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
export function applyCachedAvatars({ parsed, scriptDir, cacheManager, resolveModel, audioFor }) {
  const { jobs } = collectAvatarJobs({ parsed, scriptDir, cacheManager, resolveModel, audioFor });
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
