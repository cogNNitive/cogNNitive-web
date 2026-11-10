/**
 * nn-conntent/scripts/lib/thumbnails.mjs
 *
 * Produces the declared thumbnails inside `produce`: the Video title, the first scene
 * still as the base, and no badge (capability two-phase-thumbnail; tasks 3b-5.4/3b-5.5).
 *
 * Zero external dependencies beyond the renderer. ESM module.
 */

import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { renderThumbnail } from '../render-thumbnail.mjs';

/** The blueprint defaults, in order. */
export const DEFAULT_THUMBNAIL_FORMATS = ['2560x1440', '1080x1920'];

const parseSize = (value) => {
  const match = /^(\d+)x(\d+)$/.exec(String(value).trim());
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
};

/**
 * The declared sizes, in order. An unset or wholly malformed list falls back to the
 * blueprint defaults; a malformed entry inside a valid list is ignored.
 * @param {unknown} value
 * @returns {Array<{ width: number, height: number }>}
 */
export function thumbnailSizes(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const parsed = list.map(parseSize).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_THUMBNAIL_FORMATS.map(parseSize);
}

/** One output path per size: `<slug>_thumbnail_<W>x<H>.png`. */
export function thumbnailOutputs({ episodeDir, slug, formats }) {
  return thumbnailSizes(formats).map(({ width, height }) => ({
    width,
    height,
    path: path.join(episodeDir, `${slug}_thumbnail_${width}x${height}.png`),
  }));
}

/** Extract the first frame of a master/animatic as the thumbnail base (ffmpeg). */
export function firstFrameFrom(videoPath, outputPath) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', videoPath, '-frames:v', '1', outputPath], {
    stdio: 'ignore',
  });
  return outputPath;
}

/**
 * Render every declared thumbnail. `basePath` is the first scene still.
 * @param {{ episodeDir: string, slug: string, title: string, basePath: string,
 *   formats?: unknown, render?: Function, deps?: object }} input
 */
export async function renderEpisodeThumbnails({
  episodeDir,
  slug,
  title,
  basePath,
  formats,
  badge = null,
  subtitle,
  render = renderThumbnail,
  deps,
}) {
  const outputs = thumbnailOutputs({ episodeDir, slug, formats });
  for (const output of outputs) {
    await render({
      basePath,
      title,
      subtitle,
      badge,
      outputPath: output.path,
      width: output.width,
      height: output.height,
      deps,
    });
  }
  return outputs;
}
