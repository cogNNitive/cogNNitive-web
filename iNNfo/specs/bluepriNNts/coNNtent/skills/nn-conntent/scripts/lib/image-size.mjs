/**
 * nn-conntent/scripts/lib/image-size.mjs
 *
 * Pixel size of a media asset, needed at compile time to classify a layer's `fit` as
 * `native` or `mismatch` (spec S2). Images are read from their header (PNG, JPEG, WebP,
 * GIF, and the SVG the offline synthesizer writes); videos go through the engine's
 * ffprobe helper. Nothing is guessed: an unreadable size is `null`, and the caller turns
 * it into `AssetSizeUnknownError` when the layer needs it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { probeVideoSize } from './media-duration.mjs';

/** A media layer whose fit needs the asset size, but the size cannot be read. */
export class AssetSizeUnknownError extends Error {
  constructor(asset, detail = '') {
    super(
      `asset-size-unknown: cannot read the pixel size of "${asset}"${detail ? ` (${detail})` : ''}; ` +
        'its fit needs it to choose the native or mismatch treatment. Use a PNG, JPEG, WebP, GIF, SVG or a video ffprobe can read, or set one fit value for both keys.',
    );
    this.name = 'AssetSizeUnknownError';
    this.code = 'ASSET_SIZE_UNKNOWN';
    this.asset = asset;
  }
}

const ok = (width, height) => (width > 0 && height > 0 ? { width, height } : null);

function pngSize(b) {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return ok(b.readUInt32BE(16), b.readUInt32BE(20));
}

function gifSize(b) {
  if (b.length < 10 || !/^GIF8[79]a$/.test(b.toString('ascii', 0, 6))) return null;
  return ok(b.readUInt16LE(6), b.readUInt16LE(8));
}

function jpegSize(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    // Start-of-frame markers carry the size; C4 (DHT), C8 (JPG) and CC (DAC) do not.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return ok(b.readUInt16BE(i + 7), b.readUInt16BE(i + 5));
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

function webpSize(b) {
  if (b.length < 25 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (b.length < 30 && chunk !== 'VP8L') return null;
  if (chunk === 'VP8X') return ok(b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1);
  if (chunk === 'VP8L' && b[20] === 0x2f) {
    const bits = b.readUInt32LE(21);
    return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return ok(b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff);
  }
  return null;
}

function svgSize(b) {
  const head = b.toString('utf8', 0, Math.min(b.length, 4096));
  const tag = /<svg\b[^>]*>/i.exec(head);
  if (!tag) return null;
  const attr = (name) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i').exec(tag[0]);
    return m ? Number(m[1]) : NaN;
  };
  const w = attr('width');
  const h = attr('height');
  if (w > 0 && h > 0) return ok(Math.round(w), Math.round(h));
  const vb = /\sviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(tag[0]);
  return vb ? ok(Math.round(Number(vb[1])), Math.round(Number(vb[2]))) : null;
}

/**
 * Pure: the pixel size an image header declares, or null.
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number } | null}
 */
export function readImageSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  return pngSize(buffer) || jpegSize(buffer) || webpSize(buffer) || gifSize(buffer) || svgSize(buffer);
}

const VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v)$/i;
const HEADER_BYTES = 64 * 1024;

/**
 * The pixel size of a staged asset: the header for an image, ffprobe for a video.
 * @param {string} file
 * @param {{ run?: (cmd: string, args: string[]) => any }} [deps] ffprobe runner seam
 * @returns {Promise<{ width: number, height: number } | null>}
 */
export async function probeAssetSize(file, deps = {}) {
  if (!file || !fs.existsSync(file)) return null;
  if (VIDEO_EXT.test(path.extname(file))) return probeVideoSize(file, deps);
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(HEADER_BYTES);
    const read = fs.readSync(fd, buf, 0, HEADER_BYTES, 0);
    return readImageSize(buf.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
}
