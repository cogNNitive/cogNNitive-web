/**
 * nn-conntent/scripts/lib/catalog.mjs
 *
 * The merged model catalog: the blueprint's dated reference catalog plus the domaiNN overlay
 * (`<root>/model-catalog_NN.md`), merged per Model slug with the overlay winning. One merged
 * catalog feeds the guard, the estimator, the picklists and the adapters (design A9/A14,
 * capability video-model-catalog).
 *
 * Parsing goes through the core mirror (`parseKnowledge`); no private reader.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { parseKnowledge } = require('./nn-core.generated.cjs');

export const REFERENCE_CATALOG = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'catalog',
  'model-catalog_coNNtent_NN.md',
);
export const OVERLAY_FILENAME = 'model-catalog_NN.md';
export const DEFAULT_STALE_AFTER_DAYS = 90;

export class CatalogError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CatalogError';
    this.code = code;
  }
}

const asList = (value) => (Array.isArray(value) ? value.map(String) : value === undefined ? [] : [String(value)]);

/** Parses a catalog document into `{ providers, models, voices }`, keyed by slug. */
export function parseCatalog(text) {
  const parsed = parseKnowledge(String(text ?? ''));
  const collect = (concept) => {
    const out = {};
    for (const element of parsed.elements.get(concept) || []) {
      const fields = element.fields || {};
      const slug = element.slug || element.name;
      out[slug] = {
        slug,
        name: element.name,
        ...fields,
        ...(Array.isArray(fields.controls) ? { controls: fields.controls.map(String) } : {}),
        ...(Array.isArray(fields.sizes) ? { sizes: fields.sizes.map(String) } : {}),
      };
    }
    return out;
  };
  return { providers: collect('Provider'), models: collect('Model'), voices: collect('Voice') };
}

/** A Model must be complete enough to be priced, allowed and called. */
const REQUIRED_MODEL_FIELDS = ['provider', 'api_id', 'capability', 'adapter', 'price', 'price_unit', 'price_date'];

/**
 * Merges reference and overlay per Model slug; the overlay wins and an overlay-only Model must
 * declare every field. The allowlist is the overlay's `allowed:: true` set; with no overlay the
 * reference catalog's `status:: active` models are allowed.
 * @returns {{ providers: object, models: object, voices: object, allowed: string[] }}
 */
export function mergeCatalog(reference, overlay = null) {
  const models = { ...reference.models };
  const hasOverlay = Boolean(overlay);
  for (const [slug, override] of Object.entries(overlay?.models || {})) {
    const base = models[slug] || null;
    const merged = { ...(base || {}), ...override };
    for (const field of REQUIRED_MODEL_FIELDS) {
      const value = merged[field];
      if (value === undefined || value === null || String(value).trim() === '') {
        throw new CatalogError('incomplete-model', `Model "${slug}" must declare ${field} (overlay-only models declare every field).`);
      }
    }
    models[slug] = merged;
  }
  const allowed = [];
  for (const [slug, model] of Object.entries(models)) {
    const isAllowed = hasOverlay ? model.allowed === true || model.allowed === 'true' : model.status === 'active';
    if (isAllowed) allowed.push(slug);
  }
  allowed.sort();
  return {
    providers: { ...reference.providers, ...(overlay?.providers || {}) },
    models,
    voices: { ...reference.voices, ...(overlay?.voices || {}) },
    allowed,
  };
}

/** Resolves a model slug or api_id; unknown ids fail before any spend. */
export function resolveModel(catalog, idOrSlug) {
  const key = String(idOrSlug ?? '').trim();
  if (!key) throw new CatalogError('unknown-model', 'No model was resolved.');
  if (catalog.models[key]) return catalog.models[key];
  const byApiId = Object.values(catalog.models).find((m) => String(m.api_id) === key);
  if (byApiId) return byApiId;
  throw new CatalogError(
    'unknown-model',
    `Model "${key}" is not in the merged catalog (known: ${Object.keys(catalog.models).sort().join(', ')}).`,
  );
}

/** Refuses a model the domaiNN does not allow, before any spend. */
export function assertModelAllowed(catalog, idOrSlug) {
  const model = resolveModel(catalog, idOrSlug);
  if (!catalog.allowed.includes(model.slug)) {
    throw new CatalogError(
      'model-not-allowed',
      `Model "${model.slug}" is not allowed by the domaiNN overlay (allowed: ${catalog.allowed.join(', ')}). Add it to model-catalog_NN.md before spending.`,
    );
  }
  if (String(model.status) === 'blocked') {
    throw new CatalogError('model-blocked', `Model "${model.slug}" is status:: blocked in the merged catalog.`);
  }
  if (model.price === undefined || model.price === null || model.price === '') {
    throw new CatalogError('unpriced-model', `Model "${model.slug}" has no price in the merged catalog.`);
  }
  return model;
}

/**
 * Refuses an `image_size` the resolved image Model does not offer (design A7). A Model with
 * no declared `sizes` is not constrained; a declared list is authoritative.
 */
export function assertImageSize(catalog, idOrSlug, size) {
  const model = resolveModel(catalog, idOrSlug);
  const sizes = sizesOf(model);
  const value = String(size);
  if (sizes.length > 0 && !sizes.includes(value)) {
    throw new CatalogError(
      'unsupported-size',
      `image_size "${value}" is not offered by ${model.slug} (sizes: ${sizes.join(', ')}).`,
    );
  }
  return value;
}
/** True when a price dated `priceDate` is older than `staleAfterDays`. */
export function isPriceStale(priceDate, { now = new Date(), staleAfterDays = DEFAULT_STALE_AFTER_DAYS } = {}) {
  const then = Date.parse(String(priceDate));
  if (Number.isNaN(then)) return true;
  return now.getTime() - then > staleAfterDays * 24 * 3600 * 1000;
}

/** Reads the domaiNN overlay next to the domain root, when present. */
export function loadOverlay(domainRoot) {
  if (!domainRoot) return null;
  const file = path.join(domainRoot, OVERLAY_FILENAME);
  if (!fs.existsSync(file)) return null;
  return parseCatalog(fs.readFileSync(file, 'utf8'));
}

/**
 * Loads the merged catalog for a workspace.
 * @param {{ domainRoot?: string, referencePath?: string, overlay?: object|null }} [options]
 */
export function loadMergedCatalog({ domainRoot, referencePath = REFERENCE_CATALOG, overlay } = {}) {
  const reference = parseCatalog(fs.readFileSync(referencePath, 'utf8'));
  const overlayDoc = overlay === undefined ? loadOverlay(domainRoot) : overlay;
  return mergeCatalog(reference, overlayDoc);
}

/** The catalog's `sizes` for an image model, used to validate `image_size`. */
export function sizesOf(model) {
  return asList(model?.sizes);
}
