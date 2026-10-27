/**
 * nn-video-script/scripts/lib/media-duration.mjs
 *
 * Measures an audio/video file's duration with `ffprobe`, falling back to a
 * duration reported by the synthesis provider. Never throws: `seconds` is 0 and `error`
 * explains why when the duration cannot be measured.
 */

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export const FFPROBE_CMD = 'ffprobe';

/** Args that make ffprobe print just the container duration in seconds. */
export const FFPROBE_DURATION_ARGS = (filePath) => [
  '-v', 'error',
  '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1',
  filePath,
];

const roundMs = (seconds) => Math.round(seconds * 1000) / 1000;

/** Default runner: `ffprobe` on PATH. Returns the captured streams. */
function defaultRun(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', error: res.error };
}

/**
 * @param {string} filePath
 * @param {{ run?: (cmd: string, args: string[]) => any, providerSeconds?: number }} [deps]
 * @returns {Promise<{ seconds: number, source: 'ffprobe'|'provider'|'unknown', error?: string }>}
 */
export async function probeDuration(filePath, deps = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { seconds: 0, source: 'unknown', error: 'file not found: ' + filePath };
  }

  const run = deps.run || defaultRun;
  try {
    const res = await run(FFPROBE_CMD, FFPROBE_DURATION_ARGS(filePath));
    const seconds = Number.parseFloat(String(res?.stdout ?? '').trim());
    if (Number.isFinite(seconds) && seconds > 0) {
      return { seconds: roundMs(seconds), source: 'ffprobe' };
    }
  } catch {
    // fall through to the provider duration
  }

  const provider = Number(deps.providerSeconds);
  if (Number.isFinite(provider) && provider > 0) {
    return { seconds: roundMs(provider), source: 'provider' };
  }

  return { seconds: 0, source: 'unknown', error: 'could not measure duration for ' + filePath };
}
