/**
 * nn-conntent/scripts/lib/animatic.mjs
 *
 * The preview animatic: a low-resolution cut with the real audio and the character pose
 * still (or the generated image), rendered before the preview gate so the reviewer sees
 * and hears the episode (capability conntent-produce-command "The animatic"; design
 * D-P4; task 3b-2.6/3b-2.7).
 *
 * Zero external dependencies. ESM module.
 */

import { renderVideo } from './render.mjs';

/** The animatic is always 640 px wide (named constant, testable). */
export const ANIMATIC_WIDTH = 640;

/** The animatic frame rate (named constant, testable). */
export const ANIMATIC_FPS = 15;

/**
 * The animatic profile for a master size: 640 px wide, the master aspect, 15 fps.
 * @param {{ masterWidth: number, masterHeight: number }} input
 */
export function animaticProfile({ masterWidth, masterHeight }) {
  const width = ANIMATIC_WIDTH;
  const height = Math.max(2, Math.round((width * Number(masterHeight)) / Number(masterWidth)));
  return { width, height, fps: ANIMATIC_FPS };
}

/** `<slug>_animatic_<W>x<H>.mp4`. */
export function animaticName({ slug, width, height }) {
  return `${slug}_animatic_${width}x${height}.mp4`;
}

/**
 * Renders the animatic beside the episode. The output name and the low-res profile are
 * owned here; the render primitive does the work.
 */
export async function renderAnimatic({ scriptPath, masterWidth, masterHeight, render = renderVideo, ...options }) {
  const profile = animaticProfile({ masterWidth, masterHeight });
  return render({ scriptPath, ...profile, kind: 'animatic', ...options });
}
