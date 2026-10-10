/**
 * nn-video-script/scripts/scene/layer-primitive.mjs
 *
 * Pure mapping from a Layer `type::` to the Remotion primitive kind that draws
 * it. Kept in a plain `.mjs` module with zero Remotion/React imports so the
 * mapping is unit-testable without the renderer runtime.
 *
 *   image           → 'image'   <Img>
 *   video           → 'video'   <OffthreadVideo>
 *   talking_avatar  → 'avatar'  <AvatarFrame>
 *   anything else   → 'image'   (generic still-image path)
 */

export const IMAGE_PRIMITIVE = 'image';
export const VIDEO_PRIMITIVE = 'video';
export const AVATAR_PRIMITIVE = 'avatar';

/**
 * @param {unknown} layerType
 * @returns {'image' | 'video' | 'avatar'}
 */
export function pickLayerPrimitive(layerType) {
  const t = String(layerType || '').toLowerCase().trim();
  if (t === 'video') return VIDEO_PRIMITIVE;
  if (t === 'talking_avatar' || t === 'talking-avatar' || t === 'avatar') return AVATAR_PRIMITIVE;
  return IMAGE_PRIMITIVE;
}

/**
 * The asset source of a layer: `layer_asset_source` (the canonical compiler
 * field) with a `src` fallback. Returns an empty string when absent.
 * @param {Record<string, unknown>} layer
 * @returns {string}
 */
export function layerSource(layer) {
  return String((layer?.layer_asset_source ?? layer?.src ?? '') || '');
}
