/**
 * nn-conntent/scripts/lib/safe-area.mjs
 *
 * The safe area of one output canvas (spec S6): the region captions, overlays, authored
 * animations and `placement:: inset` media lay out in, and the region QA measures overlays
 * in. Every format computes its own; there is no central square of a master any more.
 *
 * Why it is computed here: spec S6 names `@hyperframes/core/safe-areas` as the data
 * source, but the pinned `hyperframes` package (0.8.192) ships only the CLI bundle and
 * does not export that module, so the engine cannot import it. The rule below reproduces
 * the two figures of that module this engine relies on:
 *   - the title-safe area, `TITLE_SAFE_PERCENT = 80`: 10% of each side on every canvas;
 *   - on a vertical canvas (height > width), the platform interface bands of the strictest
 *     preset, Instagram Reels `[14, 65, 6, 94]` percent: nothing above 14% of the height
 *     and nothing below 65% of it (a 35% bottom band). The sides keep the 10% title-safe
 *     inset, which is wider than Reels' 6%.
 *
 * Zero dependencies. ESM module.
 */

/** Title-safe inset on every side, as a fraction of that side's dimension. */
export const TITLE_SAFE_INSET = 0.1;

/** Vertical canvas: top and bottom interface bands, as fractions of the height. */
export const VERTICAL_TOP_BAND = 0.14;
export const VERTICAL_BOTTOM_BAND = 0.35;

/**
 * The safe area of a canvas, in whole pixels.
 * @param {{ width: number, height: number }} canvas
 * @returns {{ top: number, right: number, bottom: number, left: number, x: number, y: number, width: number, height: number, insets: { top: number, right: number, bottom: number, left: number } }}
 *   `top/right/bottom/left` are the pixel insets from each edge; `x/y/width/height` is the
 *   safe rectangle; `insets` are the same insets as fractions of the canvas side.
 */
export function safeArea({ width, height }) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0)) throw new Error(`safe-area: a canvas needs a positive width and height, got ${width}x${height}`);
  const vertical = h > w;
  const insets = {
    top: vertical ? Math.max(TITLE_SAFE_INSET, VERTICAL_TOP_BAND) : TITLE_SAFE_INSET,
    right: TITLE_SAFE_INSET,
    bottom: vertical ? Math.max(TITLE_SAFE_INSET, VERTICAL_BOTTOM_BAND) : TITLE_SAFE_INSET,
    left: TITLE_SAFE_INSET,
  };
  const top = Math.round(h * insets.top);
  const bottom = Math.round(h * insets.bottom);
  const left = Math.round(w * insets.left);
  const right = Math.round(w * insets.right);
  return { top, right, bottom, left, x: left, y: top, width: w - left - right, height: h - top - bottom, insets };
}

/**
 * The CSS custom properties a project root declares so every slot component lays out
 * inside its canvas's safe area: `--safe-top/right/bottom/left` in pixels and
 * `--safe-width/height`.
 * @param {{ width: number, height: number }} canvas
 * @returns {string} declarations, e.g. `--safe-top:108px;...`
 */
export function safeAreaCssVars(canvas) {
  const s = safeArea(canvas);
  return (
    `--safe-top:${s.top}px;--safe-right:${s.right}px;--safe-bottom:${s.bottom}px;--safe-left:${s.left}px;` +
    `--safe-width:${s.width}px;--safe-height:${s.height}px`
  );
}
