/**
 * nn-conntent/scripts/lib/avatar-request.mjs
 *
 * The ONE place the talking-avatar request body is built.
 *
 * Two separate facts live here, and they are not the same kind of fact:
 *
 * - The BODY SHAPE (data URIs under `image` / `audio`, plus `resolution`) is still
 *   UNVERIFIED against WaveSpeed's published schema; it comes from the earlier
 *   asset-synthesizer code. If it turns out to be different (uploaded media URLs instead
 *   of data URIs, other field names), only this function changes.
 * - `resolution` IS OBSERVED TO BE ADVISORY. Measured A/B on the default InfiniTalk
 *   model, both requesting `avatar_resolution: 720p`: a 1920x1920 still came back
 *   480x480, and a 2848x1600 still came back 640x352. The
 *   provider preserves the input aspect ratio and holds the pixel budget near 0.23 Mpx,
 *   so the label does not decide the output size. The field is still sent (it is part of
 *   the request and may matter to other models), but nothing downstream should treat it
 *   as enforced: the produced clip is measured with `probeVideoSize` and compared with
 *   `checkAvatarClip` in `avatar-jobs.mjs`, which warns when the short side falls below
 *   the declared label.
 *
 * Fails closed: a missing file, an unknown extension or an oversized input is an error,
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
export function buildAvatarRequest({ imagePath, audioPath, resolution = '480p', limits = {} }) {
  return {
    image: inline(imagePath, AVATAR_IMAGE_MIME, limits.imageBytes ?? MAX_AVATAR_IMAGE_BYTES, 'image'),
    audio: inline(audioPath, AVATAR_AUDIO_MIME, limits.audioBytes ?? MAX_AVATAR_AUDIO_BYTES, 'audio'),
    resolution,
  };
}
