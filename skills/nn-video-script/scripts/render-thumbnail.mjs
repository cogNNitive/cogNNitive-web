#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/render-thumbnail.mjs
 *
 * Programmatic typography and branding compositor for video thumbnails
 * (two-phase-thumbnail spec). Takes a clean 16:9 base image, composites
 * high-contrast title, subtitle, and brand badge via SVG + sharp, and
 * outputs a production-ready thumbnail (default 2560x1440).
 *
 * Usage:
 *   node render-thumbnail.mjs --base <path> --title <str> [--subtitle <str>] [--badge <str>] --out <path>
 *
 * Options:
 *   --base <path>        Path to clean 16:9 base image (required)
 *   --title <str>        Main innovation/video title (required)
 *   --subtitle <str>     Secondary title, creator, or year (optional)
 *   --badge <str>        Brand pill text (default: 'iNNtrevistas')
 *   --out <path>         Output image destination path (required)
 *   --width <number>     Target width in pixels (default: 2560)
 *   --height <number>    Target height in pixels (default: 1440)
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

/**
 * Escapes special XML/SVG characters.
 * @param {string} str
 * @returns {string}
 */
export function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Splits title text into wrapped lines for SVG tspans.
 * Respects explicit newlines and wraps long lines.
 * @param {string} text
 * @param {number} maxCharsPerLine
 * @returns {string[]}
 */
export function wrapText(text, maxCharsPerLine = 18) {
  if (!text) return [];
  const rawLines = text.split(/\r?\n/);
  const result = [];

  for (const rawLine of rawLines) {
    const words = rawLine.trim().split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      if (!currentLine) {
        currentLine = word;
      } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine += ' ' + word;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result.length > 0 ? result : [text];
}

/**
 * Generates the SVG overlay string with branding pill, title, and subtitle.
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {string} [options.badge]
 * @returns {string}
 */
export function generateThumbnailSvg({
  width = 2560,
  height = 1440,
  title,
  subtitle,
  badge = 'iNNtrevistas',
}) {
  const marginX = Math.round(width * 0.05); // 128px on 2560
  const titleFontSize = Math.round(height * 0.105); // ~150px on 1440
  const subtitleFontSize = Math.round(height * 0.048); // ~70px on 1440
  const badgeFontSize = Math.round(height * 0.028); // ~40px on 1440
  const lineSpacing = Math.round(titleFontSize * 1.15);

  const titleLines = wrapText(title, 20);

  // Calculate bottom-anchored positioning to leave safe margins
  const totalTitleHeight = titleLines.length * lineSpacing;
  const subtitleHeight = subtitle ? subtitleFontSize * 1.5 : 0;
  const bottomMargin = Math.round(height * 0.10); // 144px bottom margin
  const titleStartY = height - bottomMargin - subtitleHeight - totalTitleHeight + titleFontSize;

  const escapedBadge = escapeXml(badge);
  const escapedSubtitle = escapeXml(subtitle);

  // Badge pill measurements
  const badgeTextWidthEst = badge ? badge.length * (badgeFontSize * 0.65) + 60 : 0;
  const badgeHeight = Math.round(badgeFontSize * 1.8);
  const badgeY = Math.round(height * 0.06);

  let badgeSvg = '';
  if (badge) {
    badgeSvg = `
    <!-- Brand Badge Pill -->
    <g transform="translate(${marginX}, ${badgeY})">
      <rect
        x="0"
        y="0"
        width="${Math.round(badgeTextWidthEst)}"
        height="${badgeHeight}"
        rx="${Math.round(badgeHeight / 2)}"
        ry="${Math.round(badgeHeight / 2)}"
        fill="#0F172A"
        fill-opacity="0.88"
        stroke="#38BDF8"
        stroke-width="3"
      />
      <text
        x="${Math.round(badgeTextWidthEst / 2)}"
        y="${Math.round(badgeHeight / 2 + badgeFontSize * 0.35)}"
        font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        font-size="${badgeFontSize}px"
        font-weight="800"
        letter-spacing="3px"
        fill="#38BDF8"
        text-anchor="middle"
      >${escapedBadge}</text>
    </g>`;
  }

  // Title tspans
  const tspans = titleLines
    .map((line, idx) => {
      const yPos = titleStartY + idx * lineSpacing;
      return `<tspan x="${marginX}" y="${yPos}">${escapeXml(line)}</tspan>`;
    })
    .join('\n        ');

  let subtitleSvg = '';
  if (subtitle) {
    const subtitleY = titleStartY + (titleLines.length - 1) * lineSpacing + subtitleFontSize * 1.6;
    subtitleSvg = `
    <!-- Subtitle / Creator / Year -->
    <text
      x="${marginX}"
      y="${subtitleY}"
      font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      font-size="${subtitleFontSize}px"
      font-weight="700"
      letter-spacing="1px"
      fill="#F1F5F9"
      stroke="#000000"
      stroke-width="8"
      stroke-linejoin="round"
      stroke-linecap="round"
      paint-order="stroke fill"
      filter="url(#shadow-sub)"
    >${escapedSubtitle}</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Drop shadow for title readability on complex backgrounds -->
    <filter id="shadow-main" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.95"/>
    </filter>
    <filter id="shadow-sub" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.90"/>
    </filter>
  </defs>

  ${badgeSvg}

  <!-- Main Title -->
  <text
    font-family="'Montserrat', 'Arial Black', Impact, system-ui, -apple-system, sans-serif"
    font-size="${titleFontSize}px"
    font-weight="900"
    letter-spacing="2px"
    fill="#FFFFFF"
    stroke="#000000"
    stroke-width="16"
    stroke-linejoin="round"
    stroke-linecap="round"
    paint-order="stroke fill"
    filter="url(#shadow-main)"
  >
    ${tspans}
  </text>

  ${subtitleSvg}
</svg>`;
}

/**
 * Composes the final thumbnail image using sharp.
 * @param {object} options
 * @param {string} options.basePath
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {string} [options.badge]
 * @param {string} options.outputPath
 * @param {number} [options.width=2560]
 * @param {number} [options.height=1440]
 */
export async function renderThumbnail({
  basePath,
  title,
  subtitle,
  badge = 'iNNtrevistas',
  outputPath,
  width = 2560,
  height = 1440,
}) {
  if (!basePath || !fs.existsSync(basePath)) {
    throw new Error(`Base image not found at path: ${basePath}`);
  }
  if (!title) {
    throw new Error('Title parameter is required for thumbnail rendering');
  }
  if (!outputPath) {
    throw new Error('Output path parameter is required');
  }

  // Ensure target directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Generate SVG typographic overlay
  const svgMarkup = generateThumbnailSvg({
    width,
    height,
    title,
    subtitle,
    badge,
  });

  const svgBuffer = Buffer.from(svgMarkup, 'utf8');

  // Resize base image to exact 16:9 canvas and composite SVG overlay
  const baseResized = await sharp(basePath)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .toBuffer();

  const pipeline = sharp(baseResized).composite([
    {
      input: svgBuffer,
      top: 0,
      left: 0,
    },
  ]);

  const ext = path.extname(outputPath).toLowerCase();
  if (ext === '.png') {
    await pipeline.png().toFile(outputPath);
  } else if (ext === '.webp') {
    await pipeline.webp({ quality: 92 }).toFile(outputPath);
  } else {
    // Default to high quality JPEG
    await pipeline.jpeg({ quality: 92 }).toFile(outputPath);
  }

  return {
    outputPath,
    width,
    height,
  };
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
    if (arg === '--base' && argv[i + 1]) {
      args.basePath = argv[++i];
    } else if (arg === '--title' && argv[i + 1]) {
      args.title = argv[++i];
    } else if (arg === '--subtitle' && argv[i + 1]) {
      args.subtitle = argv[++i];
    } else if (arg === '--badge' && argv[i + 1]) {
      args.badge = argv[++i];
    } else if (arg === '--out' && argv[i + 1]) {
      args.outputPath = argv[++i];
    } else if (arg === '--width' && argv[i + 1]) {
      args.width = parseInt(argv[++i], 10);
    } else if (arg === '--height' && argv[i + 1]) {
      args.height = parseInt(argv[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

// CLI Execution entry point
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help || !args.basePath || !args.title || !args.outputPath) {
    console.log(`
Usage:
  node render-thumbnail.mjs --base <path> --title <str> [--subtitle <str>] [--badge <str>] --out <path>

Options:
  --base <path>        Path to clean 16:9 base image (required)
  --title <str>        Main title text (required)
  --subtitle <str>     Secondary line / subtitle / year (optional)
  --badge <str>        Brand pill text (default: 'iNNtrevistas')
  --out <path>         Output image destination path (required)
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
