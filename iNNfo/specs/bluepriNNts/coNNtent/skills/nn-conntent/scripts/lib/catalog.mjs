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

/** Error codes for catalog Voice validation (D-K6). */
export const VOICE_LANGUAGE_REQUIRED = 'voice-language-required';
export const INVALID_LANGUAGE_CODE = 'invalid-language-code';

/**
 * Validates every catalog Voice carries a required `language` as an ISO 639-1 lowercase
 * two-letter code (conntent-model-catalog "Blueprint Ships A Dated Reference Catalog").
 * @param {{ voices: Record<string, { slug?: string, language?: string }> }} parsed
 * @returns {true}
 */
export function validateCatalogVoices(parsed) {
  for (const [slug, voice] of Object.entries(parsed?.voices || {})) {
    const lang = voice?.language;
    if (lang === undefined || lang === null || String(lang).trim() === '') {
      const err = new Error(`voice-language-required: catalog Voice "${slug}" must declare a language (ISO 639-1 lowercase two-letter code)`);
      err.code = VOICE_LANGUAGE_REQUIRED;
      throw err;
    }
    if (!/^[a-z]{2}$/.test(String(lang).trim().toLowerCase())) {
      const err = new Error(
        `invalid-language-code: catalog Voice "${slug}" declares language "${lang}"; use the ISO 639-1 lowercase two-letter code (for example es or en)`,
      );
      err.code = INVALID_LANGUAGE_CODE;
      throw err;
    }
  }
  return true;
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
    let base = models[slug] || null;
    if (!base) {
      const slugNoVer = slug.replace(/-\d+(?:-\d+)*-/, '-').replace(/[-_.]/g, '').toLowerCase();
      for (const [k, v] of Object.entries(models)) {
        const kNoVer = k.replace(/-\d+(?:-\d+)*-/, '-').replace(/[-_.]/g, '').toLowerCase();
        if (kNoVer === slugNoVer) {
          base = v;
          break;
        }
      }
    }
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

/** The merged catalog's voices as the registry the TTS layer expects (slug -> voice). */
export function voiceRegistryOf(catalog) {
  const out = {};
  for (const [slug, voice] of Object.entries((catalog && catalog.voices) || {})) {
    if (!voice || !voice.voice_id) continue;
    out[slug] = { voice_id: voice.voice_id, language: voice.language, pending: false };
  }
  return out;
}

/** Error code when a catalog model declares `capability:: video` (D-K7). */
export const UNSUPPORTED_CAPABILITY = 'unsupported-capability';

/** Error codes for voice-language validation (D-K6). */
export const LANGUAGE_VOICE_MISMATCH = 'voice-language-mismatch';
export const UNKNOWN_VOICE = 'unknown-voice';
export const MISSING_VOICE = 'missing-voice';

/**
 * Enforces that a narrated scene has a resolved Voice before spend; there is no package
 * default `voice` (Q4). A scene with no narration needs no voice.
 * @param {{ narration?: string, voiceSlug: string | null | undefined }} input
 * @returns {true}
 */
export function assertVoiceResolved({ narration, voiceSlug }) {
  const hasNarration = String(narration || '').trim() !== '';
  const hasVoice = typeof voiceSlug === 'string' && String(voiceSlug).trim() !== '';
  if (hasNarration && !hasVoice) {
    const err = new Error(
      'missing-voice: the scene has narration but no resolved voice; declare `voice::` on the scene, series, character or domain before spend',
    );
    err.code = MISSING_VOICE;
    throw err;
  }
  return true;
}

/**
 * Validates the resolved Voice against the episode's language before spend: the Voice's
 * `language` MUST equal the episode `language`, and the slug MUST exist in the catalog.
 * (capability conntent-model-catalog "Voices Carry A Language And Must Match The
 * Episode".)
 * @param {{ voices: Record<string, { slug?: string, language?: string }>, language: string, voiceSlug: string }} input
 * @returns {true}
 */
export function validateVoiceLanguage({ voices, language, voiceSlug }) {
  const entry = voices && Object.hasOwn(voices, voiceSlug) ? voices[voiceSlug] : null;
  if (!entry) {
    const err = new Error(`unknown-voice: no Voice "${voiceSlug}" in the merged catalog`);
    err.code = UNKNOWN_VOICE;
    throw err;
  }
  const voiceLang = String(entry.language || '').toLowerCase().trim();
  const epLang = String(language || '').toLowerCase().trim();
  if (voiceLang !== epLang) {
    const err = new Error(
      `voice-language-mismatch: Voice "${voiceSlug}" is ${voiceLang || '(no language)'} but the episode is ${epLang}`,
    );
    err.code = LANGUAGE_VOICE_MISMATCH;
    throw err;
  }
  return true;
}

/**
 * Builds the merged catalog from model arrays and rejects any `capability:: video`
 * model before spend. (capability conntent-model-catalog "Video Capability Is Not
 * Supported Yet".) Each model is `{ slug, capability, ... }`.
 * @param {{ reference?: Array<{slug: string, capability: string}> , overlay?: Array<{slug: string, capability: string}> }} input
 */
export function buildMergedCatalog({ reference = [], overlay = [] } = {}) {
  for (const model of [...reference, ...overlay]) {
    if (String(model.capability || '').toLowerCase() === 'video') {
      const err = new Error(
        `generated video clips are not supported yet: model "${model.slug}" declares capability:: video. ` +
          `Remove it from the catalog or use a tts/image/avatar model.`,
      );
      err.code = UNSUPPORTED_CAPABILITY;
      throw err;
    }
  }
  const toModels = (arr) =>
    arr.reduce((acc, m) => {
      acc[m.slug] = { ...m };
      return acc;
    }, {});
  return mergeCatalog({ models: toModels(reference), providers: {}, voices: {} }, { models: toModels(overlay), providers: {}, voices: {} });
}

/** The catalog's `sizes` for an image model, used to validate `image_size`. */
export function sizesOf(model) {
  return asList(model?.sizes);
}
