#!/usr/bin/env node
/**
 * nn-video-script/scripts/thumbnail-v1.mjs
 *
 * Series-parameterized thumbnail V1 compositor: a big concept title bottom-left,
 * a subtitle and a top-left badge pill. The subtitle/badge text come from a
 * `video.series.json` config (or --subtitle/--badge); nothing is series-hardcoded.
 * Typography scales with the width, so the same style fits any size.
 *
 * Usage:
 *   node thumbnail-v1.mjs --base <base.png> --title <str> --out <png>
 *     [--subtitle <str>] [--badge <str>] [--w 2560] [--h 1440]
 *     [--series <dir> | --config <video.series.json>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSeriesConfig } from './build-script-from-draft.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Pure: the thumbnail SVG overlay. */
export function buildThumbnailSvg({ title, subtitle = 'Series', badge = 'Series', width = 2560, height = 1440 } = {}) {
  const W = width;
  const H = height;
  const k = W / 2560;
  const ts = Math.round(192 * k);
  const ss = Math.round(80 * k);
  const bh = Math.round(130 * k);
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <filter id="sh"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.95"/><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.90"/></filter>
  <text x="${Math.round(120 * k)}" y="${Math.round(H - 260 * k)}" font-family="Verdana, Geneva, sans-serif" font-size="${ts}px" font-weight="900" fill="#ffffff" filter="url(#sh)">${esc(title)}</text>
  <text x="${Math.round(120 * k)}" y="${Math.round(H - 260 * k + ss + 36 * k)}" font-family="Verdana, sans-serif" font-size="${ss}px" font-weight="700" fill="#ffffff" filter="url(#sh)">${esc(subtitle)}</text>
  <rect x="${Math.round(120 * k)}" y="${Math.round(72 * k)}" width="${Math.round(860 * k)}" height="${bh}" rx="${Math.round(65 * k)}" fill="#0b0f19"/><text x="${Math.round(550 * k)}" y="${Math.round(160 * k)}" font-family="Verdana" font-size="${Math.round(76 * k)}px" font-weight="800" fill="#ffffff" text-anchor="middle">${esc(badge)}</text>
</svg>`;
}

function argValue(argv, name) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const base = argValue(argv, 'base');
  const title = argValue(argv, 'title');
  const out = argValue(argv, 'out');
  if (!base || !title || !out) {
    console.error('usage: node thumbnail-v1.mjs --base <png> --title <str> --out <png> [--subtitle <str>] [--badge <str>] [--w 2560] [--h 1440] [--series <dir>]');
    process.exit(1);
  }
  const cfg = loadSeriesConfig(argv);
  const seriesTitle = cfg.seriesTitle || cfg.series || 'Series';
  const W = Number(argValue(argv, 'w')) || 2560;
  const H = Number(argValue(argv, 'h')) || 1440;
  const subtitle = argValue(argv, 'subtitle') || seriesTitle;
  const badge = argValue(argv, 'badge') || seriesTitle;

  let sharp;
  try {
    sharp = createRequire(import.meta.url)('sharp');
  } catch {
    console.error('thumbnail-v1: sharp is required (install the skill dependencies).');
    process.exit(1);
  }
  const svg = buildThumbnailSvg({ title, subtitle, badge, width: W, height: H });
  const buf = await sharp(path.resolve(base))
    .resize(W, H, { fit: 'cover' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(path.resolve(out), buf);
  console.log(`Thumbnail V1 ${W}x${H} -> ` + path.resolve(out));
}

const isMain =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) main();
