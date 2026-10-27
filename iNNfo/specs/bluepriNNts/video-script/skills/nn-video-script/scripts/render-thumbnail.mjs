#!/usr/bin/env node

/**
 * nn-video-script/scripts/render-thumbnail.mjs
 *
 * Programmatic typography and branding compositor for video thumbnails
 * (two-phase-thumbnail spec). Takes a clean 16:9 base image and renders a
 * one-frame HyperFrames composition (base image + title + subtitle + brand pill)
 * through the pinned HyperFrames CLI, writing a production-ready thumbnail
 * (default 2560x1440). The skill does NOT depend on `sharp`.
 *
 * Font and accent come from the resolved `frame` tokens of the nearest series
 * (design D18); absent a frame, the built-in neutral defaults apply.
 *
 * Usage:
 *   node render-thumbnail.mjs --base <path> --title <str> [--subtitle <str>] [--badge <str>] --out <path> [--series <dir>]
 *
 * Options:
 *   --base <path>        Path to clean 16:9 base image (required)
 *   --title <str>        Main innovation/video title (required)
 *   --subtitle <str>     Secondary title, creator, or year (default: the Series title)
 *   --badge <str>        Brand pill text (default: the Series title, else 'iNNtrevistas')
 *   --out <path>         Output image destination path (required)
 *   --series <dir>       Series folder whose `series_NN.md` supplies the default
 *                        subtitle/badge; otherwise the cascade walks from --out's folder
 *   --width <number>     Target width in pixels (default: 2560)
 *   --height <number>    Target height in pixels (default: 1440)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadSeriesFor } from './build-script-from-draft.mjs';
import { loadCascadeBags, resolve } from './lib/cascade.mjs';
import { findNearest } from './lib/nearest.mjs';
import { loadFrame, frameCss } from './lib/frame-tokens.mjs';
import { resolveWorkspace } from './lib/video-guard.mjs';
import { HYPERFRAMES_PIN } from './scene-project.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Raised when the pinned HyperFrames CLI cannot be run. Callers surface it as a loud error. */
export class HyperframesCliError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HyperframesCliError';
  }
}

/**
 * Resolves the Series `title` for a thumbnail: an explicit `--series <dir>` wins,
 * otherwise the parameter cascade walks from `--out`'s folder to the nearest
 * series document. Returns undefined when no series is found — the series default
 * is optional here.
 * @param {object} [options]
 * @param {string} [options.outputPath]
 * @param {string} [options.seriesDir]
 * @returns {string|undefined}
 */
export function resolveSeriesTitle({ outputPath, seriesDir } = {}) {
  try {
    const inputDir = outputPath ? path.dirname(path.resolve(outputPath)) : process.cwd();
    const series = loadSeriesFor(inputDir, seriesDir);
    return series && series.title ? series.title : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pure: resolves the effective subtitle and badge. Explicit values win; otherwise
 * both fall back to the Series `title`, and the badge alone falls back to the
 * brand pill when no series is found.
 * @param {object} [options]
 * @param {string} [options.subtitle]
 * @param {string} [options.badge]
 * @param {string} [options.seriesTitle]
 * @returns {{ subtitle: string|undefined, badge: string }}
 */
export function resolveThumbnailText({ subtitle, badge, seriesTitle } = {}) {
  return {
    subtitle: subtitle || seriesTitle,
    badge: badge || seriesTitle || 'iNNtrevistas',
  };
}

/**
 * Splits title text into wrapped lines (explicit newlines preserved).
 * @param {string} text
 * @param {number} [maxCharsPerLine=20]
 * @returns {string[]}
 */
export function wrapText(text, maxCharsPerLine = 20) {
  if (!text) return [];
  const result = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      if (!current) current = word;
      else if (`${current} ${word}`.length <= maxCharsPerLine) current += ` ${word}`;
      else {
        result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
  }
  return result.length > 0 ? result : [text];
}

/** @param {string} value */
function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Pure: builds the one-frame HyperFrames thumbnail project. Returns the
 * `index.html` text and a `files` map ready for the guarded writer.
 * @param {{ width?: number, height?: number, title: string, subtitle?: string, badge?: string,
 *   baseFileName: string, frameTokens?: object | null }} options
 * @returns {{ indexHtml: string, files: Record<string, string> }}
 */
export function buildThumbnailProject({ width = 2560, height = 1440, title, subtitle, badge, baseFileName, frameTokens = null }) {
  const titleFont = Math.round(height * 0.105);
  const subtitleFont = Math.round(height * 0.048);
  const badgeFont = Math.round(height * 0.028);
  const marginX = Math.round(width * 0.05);
  const { fontFamily, accent } = frameCss(frameTokens);
  const fontDecl = fontFamily ? `font-family:'${String(fontFamily).replace(/'/g, "\\'")}',sans-serif;` : '';
  const accentColor = accent || '#38BDF8';

  const titleLines = wrapText(title, 20);
  const titleHtml = titleLines.map((l) => escHtml(l)).join('<br>');
  const subtitleHtml = subtitle ? `<div id="subtitle" class="clip" data-start="0" data-duration="1" data-track-index="3">${escHtml(subtitle)}</div>` : '';

  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
      #root { position: relative; width: ${width}px; height: ${height}px; ${fontDecl} }
      #base { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      #badge { position: absolute; top: ${Math.round(height * 0.06)}px; left: ${marginX}px; padding: 10px 28px;
               border-radius: ${Math.round(badgeFont)}px; background: rgba(15,23,42,0.88);
               border: 3px solid ${accentColor}; color: ${accentColor}; font-size: ${badgeFont}px;
               font-weight: 800; letter-spacing: 3px; }
      #title { position: absolute; left: ${marginX}px; bottom: ${Math.round(height * 0.18)}px; color: #FFFFFF;
               font-size: ${titleFont}px; font-weight: 900; letter-spacing: 2px; line-height: 1.15;
               -webkit-text-stroke: 16px #000; paint-order: stroke fill;
               text-shadow: 0 8px 12px rgba(0,0,0,0.95); max-width: ${width - 2 * marginX}px; }
      #subtitle { position: absolute; left: ${marginX}px; bottom: ${Math.round(height * 0.10)}px; color: #F1F5F9;
                  font-size: ${subtitleFont}px; font-weight: 700; letter-spacing: 1px;
                  -webkit-text-stroke: 8px #000; paint-order: stroke fill; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="thumbnail" data-start="0" data-duration="1" data-width="${width}" data-height="${height}" data-fps="30">
      <img id="base" class="clip" data-start="0" data-duration="1" data-track-index="0" src="assets/${escHtml(baseFileName)}" />
      <div id="badge" class="clip" data-start="0" data-duration="1" data-track-index="1">${escHtml(badge)}</div>
      <div id="title" class="clip" data-start="0" data-duration="1" data-track-index="2">${titleHtml}</div>
      ${subtitleHtml}
    </div>
    <script>window.__timelines["thumbnail"] = gsap.timeline({ paused: true });</script>
  </body>
</html>
`;
  return { indexHtml, files: { 'index.html': indexHtml } };
}

/**
 * Resolves the frame tokens for the thumbnail's nearest series (best effort):
 * a missing package, frame name or file simply yields no tokens.
 * @param {{ outputPath?: string, seriesDir?: string }} options
 * @returns {object | null}
 */
export function resolveThumbnailFrameTokens({ outputPath, seriesDir } = {}) {
  const inputDir = seriesDir || (outputPath ? path.dirname(path.resolve(outputPath)) : process.cwd());
  try {
    const bags = loadCascadeBags(inputDir);
    const { value: name } = resolve('frame', bags);
    if (!name) return null;
    const { path: framePath } = findNearest(inputDir, `frames/${name}.md`, {
      stopDir: resolveWorkspace(inputDir).root,
      fallbackDir: SKILL_DIR,
    });
    if (!framePath) return null;
    return loadFrame(framePath).tokens;
  } catch {
    return null;
  }
}

/** Resolves the pinned CLI binary; throws `HyperframesCliError` when absent or mismatched. */
function resolveCli({ cliPath, installedVersion } = {}) {
  const binName = process.platform === 'win32' ? 'hyperframes.cmd' : 'hyperframes';
  const resolved = cliPath || path.join(SKILL_DIR, 'node_modules', '.bin', binName);
  if (installedVersion !== undefined) {
    if (installedVersion !== null && installedVersion !== HYPERFRAMES_PIN) {
      throw new HyperframesCliError(`hyperframes-version-mismatch: ${installedVersion}!=${HYPERFRAMES_PIN}`);
    }
    return resolved;
  }
  const pkgPath = path.join(SKILL_DIR, 'node_modules', 'hyperframes', 'package.json');
  if (!cliPath && (!fs.existsSync(resolved) || !fs.existsSync(pkgPath))) {
    throw new HyperframesCliError(`hyperframes-missing: run 'node skills-manager.js update video-script' or install hyperframes@${HYPERFRAMES_PIN}`);
  }
  let version = null;
  if (!cliPath) {
    try {
      version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    } catch {
      version = null;
    }
  }
  if (version !== null && version !== HYPERFRAMES_PIN) {
    throw new HyperframesCliError(`hyperframes-version-mismatch: ${version}!=${HYPERFRAMES_PIN}`);
  }
  return resolved;
}

function defaultRun(cmd, args, opts = {}) {
  // `shell: true` is needed for the .cmd shim on Windows.
  return spawnSync(cmd, args, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
}

/**
 * Renders a thumbnail through the pinned HyperFrames CLI.
 * @param {{ basePath: string, title: string, subtitle?: string, badge?: string, seriesDir?: string,
 *   outputPath: string, width?: number, height?: number,
 *   deps?: { run?: Function, cliPath?: string, installedVersion?: string | null, appDir?: string, ffmpegRun?: Function } }} options
 * @returns {Promise<{ outputPath: string, width: number, height: number }>}
 */
export async function renderThumbnail({
  basePath,
  title,
  subtitle,
  badge,
  seriesDir,
  outputPath,
  width = 2560,
  height = 1440,
  deps = {},
}) {
  if (!basePath || !fs.existsSync(basePath)) throw new Error(`Base image not found at path: ${basePath}`);
  if (!title) throw new Error('Title parameter is required for thumbnail rendering');
  if (!outputPath) throw new Error('Output path parameter is required');

  const outDir = path.dirname(path.resolve(outputPath));
  fs.mkdirSync(outDir, { recursive: true });

  const seriesTitle = resolveSeriesTitle({ outputPath, seriesDir });
  const text = resolveThumbnailText({ subtitle, badge, seriesTitle });
  const frameTokens = resolveThumbnailFrameTokens({ outputPath, seriesDir });

  const workDir = deps.appDir || fs.mkdtempSync(path.join(os.tmpdir(), 'nn-thumbnail-'));
  const ownWorkDir = !deps.appDir;
  try {
    const projectDir = path.join(workDir, 'project');
    const assetsDir = path.join(projectDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const baseExt = path.extname(basePath) || '.png';
    const baseFileName = `base_${crypto.createHash('sha256').update(fs.readFileSync(basePath)).digest('hex').slice(0, 12)}${baseExt}`;
    fs.copyFileSync(basePath, path.join(assetsDir, baseFileName));

    const project = buildThumbnailProject({ width, height, title, subtitle: text.subtitle, badge: text.badge, baseFileName, frameTokens });
    fs.writeFileSync(path.join(projectDir, 'index.html'), project.indexHtml, 'utf8');

    const cli = resolveCli({ cliPath: deps.cliPath, installedVersion: deps.installedVersion });
    const shotsDir = path.join(workDir, 'shots');
    fs.mkdirSync(shotsDir, { recursive: true });
    const run = deps.run || defaultRun;
    const res = run(cli, ['snapshot', projectDir, '--at', '0', '--no-end', '--output', shotsDir], { cwd: projectDir });
    if (res?.error) throw new HyperframesCliError(`hyperframes snapshot failed: ${res.error.message || String(res.error)}`);
    if (typeof res?.status === 'number' && res.status !== 0) {
      const detail = String(res.stderr || res.stdout || '').trim().slice(-800);
      throw new HyperframesCliError(`hyperframes snapshot exited ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    const png = fs.readdirSync(shotsDir).filter((f) => f.endsWith('.png')).sort()[0];
    if (!png) throw new HyperframesCliError('hyperframes snapshot produced no PNG');

    const ext = path.extname(outputPath).toLowerCase();
    if (ext === '.png' || ext === '.webp' || ext === '') {
      fs.copyFileSync(path.join(shotsDir, png), outputPath);
    } else {
      // JPEG (or any other extension): convert the rendered PNG with ffmpeg.
      const ffmpegRun = deps.ffmpegRun || defaultRun;
      const conv = ffmpegRun('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(shotsDir, png), '-q:v', '2', outputPath]);
      if (conv?.error || (typeof conv?.status === 'number' && conv.status !== 0)) {
        throw new HyperframesCliError(`thumbnail conversion failed for ${ext}`);
      }
    }

    return { outputPath, width, height };
  } finally {
    // The CLI's browser may still hold a handle on the temp dir (Windows EBUSY);
    // cleanup is best-effort and must never mask a successful render.
    if (ownWorkDir) {
      try {
        fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // leave the temp dir for the OS to reap
      }
    }
  }
}

/**
 * Parses CLI arguments.
 * @param {string[]} argv
 * @returns {object}
 */
export function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base' && argv[i + 1]) args.basePath = argv[++i];
    else if (arg === '--title' && argv[i + 1]) args.title = argv[++i];
    else if (arg === '--subtitle' && argv[i + 1]) args.subtitle = argv[++i];
    else if (arg === '--badge' && argv[i + 1]) args.badge = argv[++i];
    else if (arg === '--out' && argv[i + 1]) args.outputPath = argv[++i];
    else if (arg === '--series' && argv[i + 1]) args.seriesDir = argv[++i];
    else if (arg === '--width' && argv[i + 1]) args.width = parseInt(argv[++i], 10);
    else if (arg === '--height' && argv[i + 1]) args.height = parseInt(argv[++i], 10);
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// CLI entry point. Symlink/junction-safe guard: compare realpaths, not the typed path.
const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help || !args.basePath || !args.title || !args.outputPath) {
    console.log(`
Usage:
  node render-thumbnail.mjs --base <path> --title <str> [--subtitle <str>] [--badge <str>] --out <path> [--series <dir>]

Options:
  --base <path>        Path to clean 16:9 base image (required)
  --title <str>        Main title text (required)
  --subtitle <str>     Secondary line / subtitle / year (default: the Series title)
  --badge <str>        Brand pill text (default: the Series title, else 'iNNtrevistas')
  --out <path>         Output image destination path (required)
  --series <dir>       Series folder supplying the default subtitle/badge from series_NN.md
  --width <num>        Width in pixels (default: 2560)
  --height <num>       Height in pixels (default: 1440)
`);
    process.exit(args.help ? 0 : 1);
  }

  try {
    const result = await renderThumbnail(args);
    console.log(`✅ Thumbnail rendered successfully: ${result.outputPath} (${result.width}x${result.height})`);
  } catch (err) {
    console.error(`❌ Thumbnail rendering failed: ${err.message}`);
    process.exit(1);
  }
}
