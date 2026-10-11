#!/usr/bin/env node

/**
 * nn-video-script/scripts/assemble-video.mjs
 *
 * Final-assembly layer (blueprint decision A): joins an ordered list of
 * already-produced clips into one master MP4 with the FFmpeg concat demuxer in
 * stream-copy mode (`-f concat -c copy`). No re-encode and NO scene effects —
 * this is assembly only. (FFmpeg scene effects such as zoompan or burned-in
 * `.ass` captions are explicitly out of scope: they glitch and are prohibited.)
 *
 * Clips MUST already share video codec, resolution and frame rate. An ffprobe
 * precheck refuses a mismatched set with a named error BEFORE ffmpeg can emit a
 * silently glitched file. When ffprobe is unavailable the precheck is skipped
 * with a warning and ffmpeg's own exit status decides.
 *
 * The output is remuxed with +faststart (moov atom first), matching the engine's
 * other MP4s.
 *
 * Zero external dependencies. ESM module. Requires Node >= 18 and ffmpeg on PATH.
 *
 * Usage:
 *   node assemble-video.mjs <clip1> <clip2> ... --out <master.mp4> [--dry-run]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/cli-args.mjs';

export class AssembleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssembleError';
  }
}

/**
 * Escapes one path for a concat-demuxer `file '...'` line. A literal single
 * quote is written by closing, escaping, and reopening the quote (`'\''`).
 * @param {string} file
 */
export function escapeConcatPath(file) {
  return `file '${file.replace(/'/g, "'\\''")}'`;
}

/**
 * Builds the concat-demuxer list body for an ordered clip list.
 * @param {string[]} clips
 * @returns {string}
 */
export function buildConcatList(clips) {
  return clips.map(escapeConcatPath).join('\n') + '\n';
}

/** @param {{ codec?: string, width?: number, height?: number, fps?: string }} p */
function signature(p) {
  return `${p.codec}|${p.width}x${p.height}|${p.fps}`;
}

/**
 * Default probe: the first video stream's codec/size/fps via ffprobe.
 * Returns null when ffprobe is missing or the file is not readable media.
 * @param {string} file
 * @returns {{ codec?: string, width?: number, height?: number, fps?: string } | null}
 */
export function defaultProbe(file) {
  const res = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate', '-of', 'json', file],
    { encoding: 'utf8' },
  );
  if (res.error || res.status !== 0) return null;
  try {
    const s = JSON.parse(res.stdout).streams?.[0];
    if (!s) return null;
    return { codec: s.codec_name, width: s.width, height: s.height, fps: s.r_frame_rate };
  } catch {
    return null;
  }
}

/** Default runner: ffmpeg on PATH, output inherited. */
function defaultRun(args) {
  return spawnSync('ffmpeg', args, { stdio: 'inherit' });
}

/**
 * Assembles clips into one master MP4 via the FFmpeg concat demuxer.
 * @param {{
 *   clips: string[],
 *   outputPath: string,
 *   run?: (args: string[]) => { status: number|null, error?: any },
 *   probe?: (file: string) => object|null,
 *   warn?: (m: string) => void,
 *   dryRun?: boolean,
 * }} options
 * @returns {Promise<{ outputPath: string, clips: number, dryRun?: boolean, command?: string }>}
 */
export async function assembleVideo({
  clips,
  outputPath,
  run = defaultRun,
  probe = defaultProbe,
  warn = (m) => console.warn(m),
  dryRun = false,
}) {
  if (!Array.isArray(clips) || clips.length === 0) {
    throw new AssembleError('No clips provided; nothing to assemble.');
  }
  const missing = clips.filter((c) => !fs.existsSync(c));
  if (missing.length > 0) {
    throw new AssembleError(`Clip(s) not found: ${missing.join(', ')}`);
  }

  // Precheck: refuse a mismatched set before ffmpeg can emit a glitched file.
  const probes = clips.map((c) => probe(c));
  const unreadable = clips.filter((_, i) => !probes[i]);
  if (unreadable.length > 0) {
    warn(`[assemble-video] ffprobe unavailable or unreadable for ${unreadable.length} clip(s); skipping the consistency precheck.`);
  } else {
    const bySignature = new Map();
    for (let i = 0; i < clips.length; i++) {
      const sig = signature(probes[i]);
      if (!bySignature.has(sig)) bySignature.set(sig, []);
      bySignature.get(sig).push(clips[i]);
    }
    if (bySignature.size > 1) {
      const groups = [...bySignature.entries()].map(([sig, files]) => `${sig} (${files.join(', ')})`);
      throw new AssembleError(
        `Clips differ in codec/resolution/fps and cannot be stream-copied. Normalise them to one profile first. Groups: ${groups.join(' ; ')}`,
      );
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const listPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'assemble-')), 'clips.txt');
  const args = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', outputPath];

  if (dryRun) {
    fs.rmSync(path.dirname(listPath), { recursive: true, force: true });
    return { outputPath, clips: clips.length, dryRun: true, command: `ffmpeg ${args.join(' ')}` };
  }

  try {
    fs.writeFileSync(listPath, buildConcatList(clips));
    const result = run(args);
    if (result?.error?.code === 'ENOENT') {
      throw new AssembleError('ffmpeg was not found on PATH. Install ffmpeg and retry.');
    }
    if (result?.error || result?.status !== 0) {
      throw new AssembleError(`ffmpeg concat failed (${result?.error?.message || 'exit ' + result?.status}).`);
    }
    if (!fs.existsSync(outputPath)) {
      throw new AssembleError('ffmpeg reported success but no output file was written.');
    }
  } finally {
    fs.rmSync(path.dirname(listPath), { recursive: true, force: true });
  }

  return { outputPath, clips: clips.length };
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { value: ['out'], boolean: ['dry-run'] });
  } catch (err) {
    console.error(`❌ [assemble-video] ${err.message}`);
    process.exit(2);
  }
  const clips = parsed._;
  const out = parsed.flags.out;
  const dryRun = !!parsed.flags['dry-run'];
  if (!out || clips.length === 0) {
    console.error('Usage: node assemble-video.mjs <clip1> <clip2> ... --out <master.mp4> [--dry-run]');
    process.exit(2);
  }
  try {
    const res = await assembleVideo({
      clips: clips.map((c) => path.resolve(c)),
      outputPath: path.resolve(out),
      dryRun,
    });
    if (res.dryRun) console.log(`▶ [assemble-video] ${res.command}`);
    else console.log(`✅ [assemble-video] Assembled ${res.clips} clip(s) → ${res.outputPath}`);
  } catch (err) {
    console.error(`❌ [assemble-video] ${err.message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
