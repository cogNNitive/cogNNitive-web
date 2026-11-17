/**
 * nn-conntent/scripts/lib/image-options.mjs
 *
 * The single definition of the image cache identity of a prompt layer: the options compile
 * passes to `resolveMedia` (which hashes prompt + options). The cost estimator reads the same
 * key to price a cached image at $0, and the preview gate (produce and the console) hashes
 * the same key. No path or output name belongs in these options.
 *
 * It is also the one resolver of the EFFECTIVE `image_size` (spec S4): an explicit value
 * wins; otherwise the size derives from the primary format (`output_formats[0]`) as the
 * nearest size the image Model's catalog `sizes` offer. Every caller (compile, estimator,
 * generation, cache key, preview hash) goes through `imageModelsFor`, so the keys never
 * diverge.
 *
 * Zero external dependencies. ESM module.
 */

import { resolve } from './cascade.mjs';
import { assertImageSize, resolveModel, sizesOf } from './catalog.mjs';
import { normalizeModelId } from './video-guard.mjs';
import { FIT_ASPECT_TOLERANCE } from '../scene-project.mjs';

/** The prompt compile generates an image from, or undefined for a layer that has none. */
export function layerPrompt(layer) {
  return layer.properties?.layer_prompt || layer.properties?.prompt;
}

/** `<W>x<H>` (or `<W>*<H>`) as `{ width, height }`, or null. */
export function parseImageSize(value) {
  const m = /^\s*(\d+)\s*[x*]\s*(\d+)\s*$/i.exec(String(value ?? ''));
  if (!m || Number(m[1]) <= 0 || Number(m[2]) <= 0) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
}

/** True when `size` has the aspect of `canvas` within the fit tolerance (spec S2, 5%). */
function sameAspect(size, canvas) {
  const ratio = size.width / size.height / (canvas.width / canvas.height);
  return Math.round(Math.abs(ratio - 1) * 1e9) / 1e9 <= FIT_ASPECT_TOLERANCE;
}

/**
 * The supported size nearest to the target aspect, deterministically: the smallest
 * |ln(size aspect / target aspect)|, then the larger pixel area, then the lexically
 * smaller entry. Entries that are not `<W>x<H>` are ignored.
 * @param {string[]} sizes
 * @param {{ width: number, height: number }} target
 * @returns {string | undefined}
 */
export function nearestImageSize(sizes, target) {
  const goal = Math.log(target.width / target.height);
  const ranked = (sizes || [])
    .map((s) => ({ s: String(s), p: parseImageSize(s) }))
    .filter((c) => c.p)
    .map((c) => ({ ...c, d: Math.round(Math.abs(Math.log(c.p.width / c.p.height) - goal) * 1e9) / 1e9, a: c.p.width * c.p.height }))
    .sort((x, y) => x.d - y.d || y.a - x.a || (x.s < y.s ? -1 : x.s > y.s ? 1 : 0));
  return ranked[0]?.s;
}

/**
 * The effective image size (spec S4).
 * - An explicit `image_size` (any cascade level) wins and is validated against the Model's
 *   catalog `sizes` (`unsupported-size` before any spend).
 * - Otherwise it derives from the primary format: the nearest catalog size to its aspect.
 *   `nearest: true` discloses that the Model offers no size of that aspect; the other
 *   formats then consume the asset through `fit`.
 * - A Model without the `size` control, without declared `sizes`, or unknown to the
 *   catalog derives no size: nothing is sent and the key carries none, so a derived size
 *   never breaks a size-less Model (`adapters/_intent.mjs`).
 * @param {{ value?: unknown, imageModel?: string, catalog?: object|null,
 *   primary?: { width: number, height: number } | null }} o
 * @returns {{ size: string | undefined, source: 'explicit'|'derived'|'none',
 *   target: string | null, nearest: boolean, reason?: string }}
 */
export function resolveImageSize({ value, imageModel, catalog = null, primary = null } = {}) {
  const target = primary && primary.width > 0 && primary.height > 0 ? `${primary.width}x${primary.height}` : null;
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    const size = String(value).trim();
    if (catalog) assertImageSize(catalog, imageModel, size);
    return { size, source: 'explicit', target, nearest: false };
  }
  const none = (reason) => ({ size: undefined, source: 'none', target, nearest: false, reason });
  if (!target) return none('no-primary-format');
  if (!catalog) return none('no-catalog');
  let model;
  try {
    model = resolveModel(catalog, imageModel);
  } catch {
    return none('unknown-model');
  }
  if (!(model.controls || []).map(String).includes('size')) return none('no-size-control');
  const size = nearestImageSize(sizesOf(model), primary);
  if (!size) return none('no-sizes');
  return { size, source: 'derived', target, nearest: !sameAspect(parseImageSize(size), primary) };
}

/**
 * The image model and effective size every image-key caller uses: compile, the cost
 * estimator, produce's preview gate and the console. `parsed` is the lowered episode
 * (its `outputFormats[0]` is the primary format).
 * @param {{ bags?: object, parsed?: { outputFormats?: Array<{ width: number, height: number }> },
 *   catalog?: object|null }} o
 * @returns {{ image: string, imageSize: string | undefined, imageSizing: ReturnType<typeof resolveImageSize> }}
 */
export function imageModelsFor({ bags = {}, parsed = null, catalog = null } = {}) {
  const image = normalizeModelId(resolve('image_model', bags).value);
  const imageSizing = resolveImageSize({
    value: resolve('image_size', bags).value,
    imageModel: image,
    catalog,
    primary: parsed?.outputFormats?.[0] || null,
  });
  return { image, imageSize: imageSizing.size, imageSizing };
}

/**
 * Options for `resolveMedia` (which hashes prompt + options). The key follows the
 * cascaded `image_model` and the effective `image_size`, so changing either re-bills and
 * renaming a scene or a layer never does. No display title, path or output name belongs here.
 * @param {{ name?: string }} sc Lowered scene
 * @param {{ name?: string }} layer Lowered layer
 * @param {{ image?: string, imageSize?: string, modelOverride?: string }} [models] Chosen models
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
export function imageCacheKeyFor(sc, layer, { cacheManager, models = {} }) {
  const prompt = layerPrompt(layer);
  if (!prompt) return undefined;
  return cacheManager.computeHash(String(prompt).trim(), buildImageOptions(sc, layer, models));
}

export function imageCachePathFor(sc, layer, opts) {
  const key = imageCacheKeyFor(sc, layer, opts);
  return key ? opts.cacheManager.getSync(key, 'png', 'images') || undefined : undefined;
}
