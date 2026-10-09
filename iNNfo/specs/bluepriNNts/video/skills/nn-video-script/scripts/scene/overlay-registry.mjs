/**
 * nn-video-script/scripts/scene/overlay-registry.mjs
 *
 * Pure selector mapping a manifest overlay `type` to the React component that
 * renders it. `Scene.tsx` switches on `rendererForOverlay`, so an overlay type
 * with no entry here renders nothing (`default`). Keeping the map in a plain ESM
 * module lets the node test suite assert full render coverage without a DOM.
 */

export const OVERLAY_RENDERERS = {
  lowerThird: 'LowerThird',
  kineticTitle: 'KineticTitle',
  conceptCallout: 'ConceptCallout',
  captions: 'Captions',
  quote: 'Quote',
  broll: 'Broll',
};

/**
 * @param {string} type manifest overlay type
 * @returns {string|null} component key, or null when the type is not renderable
 */
export function rendererForOverlay(type) {
  return OVERLAY_RENDERERS[type] || null;
}
