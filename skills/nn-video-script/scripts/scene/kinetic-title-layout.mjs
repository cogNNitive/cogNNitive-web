/**
 * skills/nn-video-script/scripts/scene/kinetic-title-layout.mjs
 *
 * Pure layout resolution for the kineticTitle overlay. Plain `.mjs` with no
 * Remotion/React imports so it is unit-testable without the renderer.
 *
 * Backward compatible: with no `headingSize` / `subheadingSize` / `anchor` in the
 * config the result is the historical look (88px / 40px, centered, no shadow).
 * Setting a size switches on "big" mode: a text shadow for legibility on busy
 * images and a width cap so long titles wrap instead of clipping.
 */

export const DEFAULT_HEADING_SIZE = 88;
export const DEFAULT_SUBHEADING_SIZE = 40;
const MAX_SIZE = 400;

const ANCHORS = { top: 'flex-start', center: 'center', bottom: 'flex-end' };

/** @returns {number | undefined} a positive px size (clamped), or undefined when absent/invalid. */
function parseSize(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, MAX_SIZE);
}

/**
 * @param {Record<string, unknown>} config kineticTitle overlay config from the manifest
 * @returns {{ headingSize: number, subheadingSize: number, justifyContent: string,
 *   textShadow: string | undefined, maxWidth: string | undefined, textWrap: string | undefined, big: boolean }}
 */
export function resolveKineticTitleLayout(config = {}) {
  const headingSize = parseSize(config.headingSize);
  const subheadingSize = parseSize(config.subheadingSize);
  const big = headingSize !== undefined || subheadingSize !== undefined;
  const anchor = typeof config.anchor === 'string' ? config.anchor.toLowerCase().trim() : '';
  return {
    headingSize: headingSize ?? DEFAULT_HEADING_SIZE,
    subheadingSize: subheadingSize ?? DEFAULT_SUBHEADING_SIZE,
    justifyContent: ANCHORS[anchor] ?? 'center',
    textShadow: big ? '0 4px 18px rgba(0, 0, 0, 0.85), 0 0 4px rgba(0, 0, 0, 0.9)' : undefined,
    maxWidth: big ? '92%' : undefined,
    textWrap: big ? 'balance' : undefined,
    big,
  };
}
