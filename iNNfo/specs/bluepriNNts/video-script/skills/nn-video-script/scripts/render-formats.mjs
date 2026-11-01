#!/usr/bin/env node

/**
 * nn-video-script/scripts/render-formats.mjs
 *
 * Format-variant step (cognnitive-video-engine — "Format variants with blur
 * fill"): derives vertical/horizontal outputs from a square master by showing
 * the square WHOLE (contain) centered over a Gaussian-blurred fill, named by
 * their dimensions (`<slug>_<W>x<H>.mp4`). The square itself is emitted as a
 * stream-copied `_1080x1080` master so one run produces the whole deliverable
 * set.
 *
 * This is a post-process over the already-rendered square master, not a
 * re-render: it re-encodes only the variant video (FFmpeg) and copies the audio
 * untouched, remuxing every output with +faststart.
 *
 * Zero external dependencies. ESM module. Requires Node >= 18 and ffmpeg on PATH.
 *
 * Usage:
 *   node render-formats.mjs --master <square.mp4> [--out-dir <dir>]
 *                           [--formats square,vertical,horizontal] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/cli-args.mjs';

export class RenderFormatsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RenderFormatsError';
  }
}

/**
 * Canonical delivery formats. Every one is a pure function of the 1920x1920
 * master: the vertical and horizontal files are the central 1080-wide/1080-high
 * crops of the Open Gate safe square, and the square file is a real lanczos scale.
 */
export const DELIVERY_FORMATS = {
  square: { width: 1080, height: 1080, filter: 'scale=1080:1080:flags=lanczos' },
  vertical: { width: 1080, height: 1920, filter: 'crop=1080:1920:420:0' },
  horizontal: { width: 1920, height: 1080, filter: 'crop=1920:1080:0:420' },
};

/** The only master this tool accepts. */
export const MASTER_DIMENSIONS = { width: 1920, height: 1920 };

/** The arguments every derivation shares, so the outputs differ only by filter. */
export const DERIVATION_ARGS = [
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-c:a', 'copy',
  '-movflags', '+faststart', '-map_metadata', '-1', '-fflags', '+bitexact',
];

/** Default blur-graph tuning: Gaussian sigma and a slight darkening of the fill. */
export const DEFAULT_SIGMA = 20;
export const DEFAULT_BRIGHTNESS = -0.18;

/**
 * Derives the variant slug from the square master's filename by stripping a
 * trailing `_<W>x<H>` dimension suffix (`master_1080x1080.mp4` → `master`).
 * @param {string} masterPath
 * @returns {string}
 */
export function slugFromMaster(masterPath) {
  const base = path.basename(masterPath, path.extname(masterPath));
  return base.replace(/_\d+x\d+$/, '') || base;
}

/**
 * @param {string} slug
 * @param {{ width: number, height: number }} preset
 * @returns {string}
 */
export function variantName(slug, { width, height, suffix = '' }) {
  return `${slug}_${width}x${height}${suffix}.mp4`;
}

/**
 * Builds the FFmpeg blur-fill filter graph: the square is scaled down to fit
 * WHOLE (decrease) and overlaid centered on a blurred, cropped, dimmed copy
 * that fills the target frame.
 * @param {number} width
 * @param {number} height
 * @param {{ sigma?: number, brightness?: number }} [opts]
 * @returns {string}
 */
export function buildBlurFillFilter(width, height, { sigma = DEFAULT_SIGMA, brightness = DEFAULT_BRIGHTNESS } = {}) {
  return [
    '[0:v]split=2[bg][fg]',
    `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=${sigma},eq=brightness=${brightness}[bg2]`,
    `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg2]`,
    '[bg2][fg2]overlay=(W-w)/2:(H-h)/2[v]',
  ].join(';');
}

/** Default runner: ffmpeg on PATH, output inherited. */
function defaultRun(args) {
  return spawnSync('ffmpeg', args, { stdio: 'inherit' });
}

/**
 * Default size probe: ffprobe on PATH reads the real dimensions of the master.
 * Returns null when ffprobe is missing or cannot read the file.
 */
function defaultProbe(file) {
  const res = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  );
  if (res.error || res.status !== 0) return null;
  const m = /^(\d+),(\d+)/.exec(String(res.stdout || '').trim());
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/**
 * Produces the format variants from a square master.
 * @param {{
 *   master: string,
 *   outDir?: string,
 *   formats?: string[],
 *   sigma?: number,
 *   brightness?: number,
 *   run?: (args: string[]) => { status: number|null, error?: any },
 *   dryRun?: boolean,
 * }} options
 * @returns {Promise<{ master: string, slug: string, outDir: string, formats: string[], dryRun?: boolean, variants: Array<{ format: string, width: number, height: number, outputPath: string, command: string }> }>}
 */
export async function renderFormats({
  master,
  outDir,
  formats = ['square', 'vertical', 'horizontal'],
  fill = 'crop',
  force = false,
  sigma = DEFAULT_SIGMA,
  brightness = DEFAULT_BRIGHTNESS,
  run = defaultRun,
  probe = defaultProbe,
  dryRun = false,
} = {}) {
  if (!master) throw new RenderFormatsError('A --master square MP4 is required.');
  const masterAbs = path.resolve(master);
  if (!fs.existsSync(masterAbs)) {
    throw new RenderFormatsError(`Master not found: ${masterAbs}`);
  }
  // Refuse anything that is not the declared master: the derivation is a pure
  // function of a 1920x1920 file (design D5).
  const size = probe(masterAbs);
  if (!size || size.width !== MASTER_DIMENSIONS.width || size.height !== MASTER_DIMENSIONS.height) {
    throw new RenderFormatsError(
      `Master must be ${MASTER_DIMENSIONS.width}x${MASTER_DIMENSIONS.height}; ${masterAbs} is ` +
        (size ? `${size.width}x${size.height}` : 'not readable by ffprobe'),
    );
  }
  const slug = slugFromMaster(masterAbs);
  const dir = path.resolve(outDir || path.dirname(masterAbs));
  fs.mkdirSync(dir, { recursive: true });

  const variants = [];
  for (const name of formats) {
    const preset = DELIVERY_FORMATS[name];
    if (!preset) {
      throw new RenderFormatsError(`Unknown format "${name}" (known: ${Object.keys(DELIVERY_FORMATS).join(', ')}).`);
    }
    const blur = fill === 'blur' && (name === 'vertical' || name === 'horizontal');
    const outputPath = path.join(dir, blur ? variantName(slug, { ...preset, suffix: '_blur' }) : variantName(slug, preset));
    // Never overwrite the master with itself (ffmpeg refuses a same source/output).
    if (outputPath === masterAbs) {
      variants.push({ format: name, width: preset.width, height: preset.height, outputPath, skipped: true });
      continue;
    }
    // An existing output is kept unless --force: a variant may already be published.
    if (!force && fs.existsSync(outputPath)) {
      variants.push({ format: name, width: preset.width, height: preset.height, outputPath, skipped: true });
      continue;
    }
    const args = [
      '-y', '-v', 'error', '-i', masterAbs,
      '-filter_complex', blur
        ? buildBlurFillFilter(preset.width, preset.height, { sigma, brightness })
        : preset.filter,
      '-map', '[v]', '-map', '0:a?',
      ...DERIVATION_ARGS,
      outputPath,
    ];
    variants.push({
      format: name,
      width: preset.width,
      height: preset.height,
      outputPath,
      command: `ffmpeg ${args.join(' ')}`,
    });

    if (dryRun) continue;

    const result = run(args);
    if (result?.error?.code === 'ENOENT') {
      throw new RenderFormatsError('ffmpeg was not found on PATH. Install ffmpeg and retry.');
    }
    if (result?.error || result?.status !== 0) {
      throw new RenderFormatsError(`ffmpeg failed for "${name}" (${result?.error?.message || 'exit ' + result?.status}).`);
    }
    if (!fs.existsSync(outputPath)) {
      throw new RenderFormatsError(`ffmpeg reported success but ${outputPath} was not written.`);
    }
  }

  const out = { master: masterAbs, slug, outDir: dir, formats, variants };
  if (dryRun) out.dryRun = true;
  return out;
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      value: ['master', 'out-dir', 'formats'],
      boolean: ['dry-run'],
    });
  } catch (err) {
    console.error(`❌ [render-formats] ${err.message}`);
    process.exit(2);
  }
  const master = parsed.flags.master;
  const dryRun = !!parsed.flags['dry-run'];
  if (!master) {
    console.error('Usage: node render-formats.mjs --master <square.mp4> [--out-dir <dir>] [--formats square,vertical,horizontal] [--dry-run]');
    process.exit(2);
  }
  const formats = parsed.flags.formats
    ? String(parsed.flags.formats).split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  try {
    const res = await renderFormats({ master, outDir: parsed.flags['out-dir'], formats, dryRun });
    if (res.dryRun) {
      for (const v of res.variants) console.log(`▶ [render-formats] ${v.command}`);
    } else {
      for (const v of res.variants) console.log(`✅ [render-formats] ${v.format} → ${v.outputPath}`);
    }
  } catch (err) {
    console.error(`❌ [render-formats] ${err.message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
