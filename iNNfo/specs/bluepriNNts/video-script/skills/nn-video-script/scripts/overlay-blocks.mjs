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

/**
 * Renders an overlay's visible markup (inline CSS, no external stylesheet) so the
 * emitted project actually paints it. Text overlays are static `.clip` elements;
 * a `broll` overlay embeds its media. Positions scale with the output width.
 * @param {object} overlay manifest overlay track
 * @param {number} sceneFromFrame
 * @param {number} fps
 * @param {{ seriesFrame?: object, sceneBlock?: object, trackIndex?: number, width?: number, height?: number, zIndex?: number }} [opts]
 * @returns {string | null}
 */
export function renderOverlay(overlay, sceneFromFrame, fps, opts = {}) {
  const resolved = resolveOverlayBlock(overlay.type, opts);
  if (!resolved) return null;
  const start = roundMs((overlay.fromFrame - sceneFromFrame) / fps);
  const duration = roundMs(overlay.durationInFrames / fps);
  const cfg = overlay.config || {};
  const k = (Number(opts.width) || 1080) / 1080;
  const px = (n) => Math.round(n * k);
  const base = `position:absolute; z-index:${opts.zIndex ?? 200}; overflow:hidden;`;
  let style = base;
  let inner = '';

  switch (overlay.type) {
    case 'watermark':
      style += `left:0; right:0; bottom:${px(20)}px; text-align:center; font-size:${px(20)}px; color:rgba(255,255,255,0.82); text-shadow:0 1px 3px rgba(0,0,0,0.9);`;
      inner = esc(cfg.text || '');
      break;
    case 'lowerThird':
      style += `left:${px(56)}px; bottom:${px(110)}px; max-width:70%; background:rgba(0,0,0,0.72); border-left:${px(6)}px solid #7c3aed; padding:${px(12)}px ${px(20)}px; font-size:${px(40)}px; font-weight:800; color:#fff;`;
      inner = esc(cfg.title || cfg.text || '');
      break;
    case 'kineticTitle':
      style += `left:0; right:0; bottom:${px(140)}px; text-align:center; font-size:${px(60)}px; font-weight:900; color:#fff; text-shadow:0 2px 10px rgba(0,0,0,0.9); padding:0 ${px(40)}px;`;
      inner = esc(cfg.heading || cfg.text || '');
      break;
    case 'captions':
      style += `right:${px(48)}px; bottom:${px(96)}px; max-width:60%; text-align:right; font-size:${px(26)}px; color:#fff; background:rgba(0,0,0,0.55); padding:${px(8)}px ${px(14)}px; border-radius:${px(8)}px;`;
      inner = esc(cfg.text || '');
      break;
    case 'quote':
      style += `left:50%; top:50%; transform:translate(-50%,-50%); max-width:80%; text-align:center; font-size:${px(44)}px; font-style:italic; color:#fff; background:rgba(0,0,0,0.75); padding:${px(28)}px ${px(36)}px; border-radius:${px(16)}px;`;
      inner = esc(cfg.text || '');
      break;
    case 'broll': {
      const name = String(cfg.assetPath || '');
      if (!name) return null;
      const tag = /\.(mp4|webm|mov|mkv|m4v)$/i.test(name) ? 'video' : 'img';
      const fit = cfg.fit === 'contain' ? 'contain' : 'cover';
      const attrs = tag === 'video' ? 'muted playsinline data-has-audio="false" ' : '';
      inner = `<${tag} ${attrs}src="assets/${esc(name)}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:${fit};"></${tag}>`;
      style += `inset:${px(100)}px;`;
      break;
    }
    default:
      return null;
  }

  return (
    `<div id="${esc(overlay.id)}" class="clip nn-overlay" data-block="${esc(resolved.blockId)}" ` +
    `data-overlay-type="${esc(overlay.type)}" data-start="${start}" data-duration="${duration}" ` +
    `data-track-index="${opts.trackIndex ?? 10}" style="${style}">${inner}</div>`
  );
}
