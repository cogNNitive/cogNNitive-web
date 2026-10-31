/**
 * nn-video-script/scripts/overlay-blocks.mjs
 *
 * The overlay slot contract and mount emitter (design D1). An overlay renders by
 * mounting, as a ROOT-level host with global times, the component whose name the
 * cascade resolves for its slot. The engine emits no overlay markup or CSS of its
 * own: layout and look live in the component.
 *
 * The slot's fallback `components/<slot>.html` declares `data-composition-variables`;
 * that list IS the contract. A resolved component MUST declare a superset of the
 * slot's variables, else `SlotContractError`.
 *
 * Pure module (no HyperFrames import), unit-testable without the renderer.
 */

import { frameCss } from './lib/frame-tokens.mjs';

/** `type` (manifest) → slot name (the key of the `components` cascade parameter). */
export const SLOT_OF = {
  kineticTitle: 'title',
  lowerThird: 'lower-third',
  captions: 'caption',
  quote: 'quote',
  watermark: 'watermark',
  broll: 'b-roll',
};

/** Raised when a resolved component does not accept a variable its slot declares. */
export class SlotContractError extends Error {
  /**
   * @param {{ slot: string, path: string, missing: string[] }} entry
   */
  constructor({ slot, path, missing = [] }) {
    super(`slot "${slot}": ${path} missing variables: ${missing.join(', ')}`);
    this.name = 'SlotContractError';
    this.slot = slot;
    this.path = path;
    this.missing = missing;
  }
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const roundMs = (seconds) => Math.round(seconds * 1000) / 1000;

/**
 * Reads the variable ids a component declares in `data-composition-variables`
 * (`[{"id":"text",...}]`). Returns `[]` when absent or malformed.
 * @param {string} html
 * @returns {string[]}
 */
export function readVariableIds(html) {
  const m = String(html ?? '').match(/data-composition-variables\s*=\s*(['"])([\s\S]*?)\1/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[2]);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => v && v.id).filter((id) => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

/**
 * Asserts that a resolved component declares a superset of its slot's variables.
 * @param {string} slot
 * @param {{ path: string, html: string, contractHtml: string }} entry - `contractHtml`
 *   is the slot's fallback component (`components/<slot>.html`); its variables ARE
 *   the contract.
 * @returns {true}
 */
export function assertSlotContract(slot, { path: componentPath, html, contractHtml }) {
  const required = readVariableIds(contractHtml);
  const declared = new Set(readVariableIds(html));
  const missing = required.filter((v) => !declared.has(v));
  if (missing.length > 0) throw new SlotContractError({ slot, path: componentPath, missing });
  return true;
}

/** The variable values an overlay passes to its component. */
function overlayVariables(overlay, frame) {
  const cfg = overlay.config || {};
  const f = frameCss(frame?.tokens);
  const values = {
    text: cfg.text || cfg.title || cfg.heading || '',
    src: cfg.assetPath ? `assets/${cfg.assetPath}` : '',
    position: cfg.position || cfg.anchor || '',
    enter: overlay.enterAnimation || '',
    exit: overlay.exitAnimation || '',
    font: f.fontFamily || '',
    accent: f.accent || '',
  };
  if (overlay.type === 'broll') values.fit = cfg.fit || 'cover';
  return values;
}

/**
 * Emits the root-level host that mounts one overlay's slot component with global
 * times. Returns null for an unknown overlay type.
 * @param {object} overlay manifest overlay track
 * @param {{ componentName?: string, noTimeline?: boolean, fps?: number, frame?: object, trackIndex?: number, zIndex?: number, width?: number, height?: number }} [opts]
 * @returns {string | null}
 */
export function overlayMount(overlay, opts = {}) {
  const slot = SLOT_OF[overlay.type];
  if (!slot) return null;
  const componentName = opts.componentName || slot;
  const fps = Number(opts.fps) || 30;
  const start = roundMs((overlay.fromFrame || 0) / fps);
  const duration = roundMs((overlay.durationInFrames || 0) / fps);
  const vars = overlayVariables(overlay, opts.frame);
  const values = JSON.stringify(vars)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/'/g, '&#39;');
  const z = Number.isFinite(opts.zIndex) ? ` style="z-index:${opts.zIndex}"` : '';
  // A static component (its root declares `data-no-timeline`) never registers a
  // sub-composition timeline, so the host must say so too or HyperFrames waits the
  // full 45s readiness timeout on every render.
  const noTimeline = opts.noTimeline ? ' data-no-timeline' : '';
  const pos = vars.position ? String(vars.position).toLowerCase().replace(/[^a-z0-9-]/g, '') : '';
  const posClass = pos ? ` nn-pos-${pos}` : '';
  return (
    `<div id="${esc(overlay.id)}" class="clip nn-overlay${posClass}" data-composition-id="${esc(slot)}" ` +
    `data-composition-src="components/${esc(componentName)}.html" data-start="${start}" data-duration="${duration}" ` +
    `data-track-index="${opts.trackIndex ?? 10}" data-track-kind="graphics"${noTimeline} ` +
    `data-variable-values='${values}'${z}></div>`
  );
}
