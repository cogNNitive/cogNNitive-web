/**
 * nn-video-script/scripts/overlay-blocks.mjs
 *
 * Maps a manifest overlay `type` to the HyperFrames block that renders it. The
 * default is a HyperFrames registry block; a Series frame or a scene MAY override
 * it. Resolution precedence: `sceneBlock > seriesFrame > registry default`.
 *
 * Overlays stay modelled as intent in the script; only the visual is delegated.
 * Pure module (no HyperFrames import), unit-testable without the renderer.
 */

/** `type` (manifest) → default registry block id. */
export const DEFAULT_OVERLAY_BLOCKS = {
  kineticTitle: 'text-stagger',
  lowerThird: 'lower-third',
  captions: 'caption',
  quote: 'quote',
  broll: 'media-clip',
  watermark: 'watermark',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const roundMs = (seconds) => Math.round(seconds * 1000) / 1000;

/**
 * @param {string} type
 * @param {{ seriesFrame?: { blocks?: Record<string,string> }, sceneBlock?: Record<string,string> }} [opts]
 * @returns {{ blockId: string, source: 'scene'|'series'|'registry' } | null}
 */
export function resolveOverlayBlock(type, opts = {}) {
  const scene = opts.sceneBlock && opts.sceneBlock[type];
  if (scene) return { blockId: scene, source: 'scene' };
  const series = opts.seriesFrame && opts.seriesFrame.blocks && opts.seriesFrame.blocks[type];
  if (series) return { blockId: series, source: 'series' };
  const def = DEFAULT_OVERLAY_BLOCKS[type];
  if (!def) return null;
  return { blockId: def, source: 'registry' };
}

/**
 * Emits the stable overlay-host element for one overlay track, anchored inside its
 * Scene Sub-composition. Returns null for an unknown overlay type.
 * @param {object} overlay manifest overlay track
 * @param {number} sceneFromFrame
 * @param {number} fps
 * @param {{ seriesFrame?: object, sceneBlock?: object, trackIndex?: number }} [opts]
 */
export function overlayHostMarkup(overlay, sceneFromFrame, fps, opts = {}) {
  const resolved = resolveOverlayBlock(overlay.type, opts);
  if (!resolved) return null;
  const start = roundMs((overlay.fromFrame - sceneFromFrame) / fps);
  const duration = roundMs(overlay.durationInFrames / fps);
  const config = overlay.config || {};
  const vars = [];
  if (config.text) vars.push(`data-var-text="${esc(config.text)}"`);
  if (config.assetPath) vars.push(`data-var-src="assets/${esc(config.assetPath)}"`);
  if (config.position) vars.push(`data-var-position="${esc(config.position)}"`);
  return (
    `<div id="${esc(overlay.id)}" class="clip nn-overlay" data-block="${esc(resolved.blockId)}" ` +
    `data-overlay-type="${esc(overlay.type)}" data-start="${start}" data-duration="${duration}" ` +
    `data-track-index="${opts.trackIndex ?? 10}" ${vars.join(' ')}></div>`
  );
}
