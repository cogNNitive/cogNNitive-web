/**
 * nn-conntent/scripts/lib/media-duration.mjs
 *
 * Measures an audio/video file's duration and a video/image file's pixel size with
 * `ffprobe`, falling back to a duration reported by the synthesis provider. Never
 * throws: `seconds` is 0 and `error` explains why when the duration cannot be measured.
 */

import fs from 'node:fs';
import { spawnTool } from './spawn-tool.mjs';

export const FFPROBE_CMD = 'ffprobe';

/** Args that make ffprobe print just the container duration in seconds. */
export const FFPROBE_DURATION_ARGS = (filePath) => [
  '-v', 'error',
  '-show_entries', 'format=duration',
  '-of', 'default=nw=1:nk=1',
  filePath,
];

/** Args that make ffprobe print the first video stream's width and height. */
export const FFPROBE_SIZE_ARGS = (filePath) => [
  '-v', 'error',
  '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height',
  '-of', 'csv=p=0',
  filePath,
];

const roundMs = (seconds) => Math.round(seconds * 1000) / 1000;

/** Default runner: `ffprobe` on PATH. Returns the captured streams. */
function defaultRun(cmd, args) {
  const res = spawnTool(cmd, args, { encoding: 'utf8' });
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

/**
 * Pixel size of the first video stream (a video, or a still image ffprobe can read).
 * Never throws: null when the size cannot be measured.
 *
 * This is how the engine learns what the avatar provider actually produced: the
 * `resolution` request field is advisory, so the clip's real dimensions are read back
 * instead of assumed (#691).
 *
 * @param {string} filePath
 * @param {{ run?: (cmd: string, args: string[]) => any }} [deps]
 * @returns {Promise<{ width: number, height: number } | null>}
 */
export async function probeVideoSize(filePath, deps = {}) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const run = deps.run || defaultRun;
  try {
    const res = await run(FFPROBE_CMD, FFPROBE_SIZE_ARGS(filePath));
    if (res?.error || res?.status !== 0) return null;
    const m = /(\d+)\s*,\s*(\d+)/.exec(String(res?.stdout || '').trim());
    if (!m) return null;
    const width = Number.parseInt(m[1], 10);
    const height = Number.parseInt(m[2], 10);
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}
