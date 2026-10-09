/**
 * nn-video-script/scripts/lib/avatar-request.mjs
 *
 * The ONE place the talking-avatar request body is built. The WaveSpeed infinitetalk request
 * schema is UNVERIFIED (taken from the earlier asset-synthesizer code); if it turns out to be
 * different (uploaded media URLs instead of data URIs, other field names), only this function
 * changes. Fails closed: a missing file, an unknown extension or an oversized input is an error,
 * never a guess (no octet-stream fallback, no raw local path sent to a remote API).
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';

export const MAX_AVATAR_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_AUDIO_BYTES = 25 * 1024 * 1024;
export const AVATAR_IMAGE_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
export const AVATAR_AUDIO_MIME = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac' };

function inline(file, table, maxBytes, what) {
  if (!file || !fs.existsSync(file)) throw new Error('Avatar ' + what + ' not found: ' + file);
  const ext = path.extname(file).toLowerCase();
  const mime = table[ext];
  if (!mime) {
    throw new Error('Avatar ' + what + ' has an unsupported extension "' + ext + '" (no MIME type known; allowed: ' + Object.keys(table).join(', ') + ').');
  }
  const bytes = fs.readFileSync(file);
  if (bytes.length > maxBytes) {
    throw new Error('Avatar ' + what + ' is too large to inline (' + bytes.length + ' bytes, limit ' + maxBytes + '): ' + file);
  }
  return 'data:' + mime + ';base64,' + bytes.toString('base64');
}

/**
 * @param {{ imagePath: string, audioPath: string, resolution?: string, limits?: { imageBytes?: number, audioBytes?: number } }} o
 * @returns {{ image: string, audio: string, resolution: string }}
 */
export function buildAvatarRequest({ imagePath, audioPath, resolution = '720p', limits = {} }) {
  return {
    image: inline(imagePath, AVATAR_IMAGE_MIME, limits.imageBytes ?? MAX_AVATAR_IMAGE_BYTES, 'image'),
    audio: inline(audioPath, AVATAR_AUDIO_MIME, limits.audioBytes ?? MAX_AVATAR_AUDIO_BYTES, 'audio'),
    resolution,
  };
}
