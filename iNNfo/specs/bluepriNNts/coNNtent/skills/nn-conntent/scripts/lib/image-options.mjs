/**
 * nn-conntent/scripts/lib/image-options.mjs
 *
 * The single definition of the image cache identity of a prompt layer: the options compile
 * passes to `resolveMedia` (which hashes prompt + options). The cost estimator reads the same
 * key to price a cached image at $0. No path, output name or pixel size belongs in these options.
 *
 * Zero external dependencies. ESM module.
 */

/** The prompt compile generates an image from, or undefined for a layer that has none. */
export function layerPrompt(layer) {
  return layer.properties?.layer_prompt || layer.properties?.prompt;
}

/**
 * Options for `resolveMedia` (which hashes prompt + options). The key follows the
 * cascaded `image_model`, so changing the model re-bills and renaming a scene or a
 * layer never does. No display title, path, output name or pixel size belongs here.
 * @param {{ name?: string }} sc Lowered scene
 * @param {{ name?: string }} layer Lowered layer
 * @param {{ image?: string, modelOverride?: string }} [models] Chosen models
 * @returns {Record<string, unknown>}
 */
export function buildImageOptions(sc, layer, models = {}) {
  const options = {
    provider: 'wavespeed',
    model: models.image || 'wavespeed-v1-flux',
    ...(models.imageSize ? { size: String(models.imageSize) } : {}),
    accentColor: '#ef4444',
  };
  if (models.modelOverride) options.modelOverride = models.modelOverride;
  return options;
}

/**
 * The image cache entry for a layer's CURRENT prompt and options (the same key compile writes).
 * @param {{ computeHash: Function, getSync: Function }} cacheManager
 * @returns {string | undefined} Absolute cache file path, or undefined on a miss or a layer without prompt
 */
export function imageCachePathFor(sc, layer, { cacheManager, models = {} }) {
  const prompt = layerPrompt(layer);
  if (!prompt) return undefined;
  const key = cacheManager.computeHash(String(prompt).trim(), buildImageOptions(sc, layer, models));
  return cacheManager.getSync(key, 'png', 'images') || undefined;
}
