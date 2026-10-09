/**
 * nn-video-script/scripts/lib/faststart.mjs
 *
 * WaveSpeed MP4 outputs carry the moov atom at the end, which breaks the Remotion proxy.
 * When ffmpeg is on PATH this remuxes with `-c copy -movflags +faststart` (no re-encode),
 * through an ASYNC spawn with a timeout so it never blocks polling workers. If ffmpeg is
 * missing, times out or fails, the raw (already billed) clip is kept, a clear warning is
 * emitted and a `<clip>.needs-faststart` marker is left next to it so compile can retry
 * (`refreshFaststart`) once ffmpeg is available. No dependency is added.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const FASTSTART_TIMEOUT_MS = 120 * 1000;
const MARKER = '.needs-faststart';

/** @param {string} file */
export const markerPath = (file) => file + MARKER;
/** @param {string} file */
export const markNeedsFaststart = (file) => fs.writeFileSync(markerPath(file), new Date().toISOString() + '\n');
/** @param {string} file */
export const needsFaststart = (file) => fs.existsSync(markerPath(file));
/** @param {string} file */
export const clearFaststartMarker = (file) => fs.rmSync(markerPath(file), { force: true });

/**
 * @param {string[]} args
 * @param {number} timeoutMs
 * @returns {Promise<{ status: number | null, error?: any }>}
 */
function defaultRun(args, timeoutMs = FASTSTART_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(r);
      }
    };
    const child = spawn('ffmpeg', args, { stdio: 'ignore' });
    const timer = setTimeout(() => {
      child.kill();
      done({ status: null, error: Object.assign(new Error('ffmpeg timed out after ' + timeoutMs + 'ms'), { code: 'ETIMEDOUT' }) });
    }, timeoutMs);
    child.on('error', (error) => done({ status: null, error }));
    child.on('close', (status) => done({ status }));
  });
}

/**
 * @param {Buffer} buffer Raw MP4 bytes
 * @param {{ run?: (args: string[]) => any, warn?: (m: string) => void, timeoutMs?: number }} [deps]
 * @returns {Promise<{ buffer: Buffer, applied: boolean }>}
 */
export async function applyFaststart(buffer, { run, warn = (m) => console.warn(m), timeoutMs = FASTSTART_TIMEOUT_MS } = {}) {
  const exec = run || ((args) => defaultRun(args, timeoutMs));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faststart-'));
  const input = path.join(dir, 'in.mp4');
  const output = path.join(dir, 'out.mp4');
  try {
    fs.writeFileSync(input, buffer);
    const result = await exec(['-y', '-v', 'error', '-i', input, '-c', 'copy', '-movflags', '+faststart', output]);
    if (result?.error?.code === 'ENOENT') {
      warn('ffmpeg was not found on PATH: keeping the raw clip, which may not play in the Remotion proxy (moov atom at the end). Install ffmpeg; compile will retry.');
      return { buffer, applied: false };
    }
    if (result?.error || result?.status !== 0 || !fs.existsSync(output)) {
      warn('ffmpeg could not apply +faststart (' + (result?.error?.message || 'exit ' + result?.status) + '): keeping the raw clip.');
      return { buffer, applied: false };
    }
    return { buffer: fs.readFileSync(output), applied: true };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Retries faststart on a clip left marked by a failed attempt. Replaces the clip atomically
 * and clears the marker only on success. Never throws.
 * @param {string} file
 * @param {{ run?: Function, warn?: (m: string) => void }} [deps]
 * @returns {Promise<boolean>} true when the clip was fixed
 */
export async function refreshFaststart(file, deps = {}) {
  if (!needsFaststart(file) || !fs.existsSync(file)) return false;
  try {
    const out = await applyFaststart(fs.readFileSync(file), deps);
    if (!out.applied) return false;
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, out.buffer);
    fs.renameSync(tmp, file);
    clearFaststartMarker(file);
    return true;
  } catch {
    return false;
  }
}
