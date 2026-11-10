/**
 * nn-conntent/scripts/lib/review-hash.mjs
 *
 * The review subjects and their hashes, shared by the engine and the console data
 * module so no second implementation can drift (capability conntent-review-gates,
 * "Script gate hash..." and "Preview gate hash..."; design D-P1, C3).
 *
 * The subjects are built from ALREADY-RESOLVED input: the caller passes the cascade
 * values and the resolved library references, so moving a value's source level never
 * changes a hash.
 *
 * Zero external dependencies. ESM module.
 */

import { canonicalJson, sha256Hex } from './canonical.mjs';

export { canonicalJson, sha256Hex } from './canonical.mjs';

/**
 * Fields that never contribute to a review subject: the engine-written mirror, the
 * lifecycle status, titles, comments and citations.
 */
export const REVIEW_SUBJECT_EXCLUDED = new Set([
  'review',
  'status',
  'title',
  'sources',
  'comments',
]);

function cleanFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (value === undefined) continue;
    if (REVIEW_SUBJECT_EXCLUDED.has(key)) continue;
    if (key.endsWith('_source')) continue;
    out[key] = value;
  }
  return out;
}

/**
 * The `script` gate subject of one scene:
 * `{ scene, language, narration, layers, params }`, plus `source` for a translation.
 *
 * A translation carries `source: { scene, hash }` -- the hash of the original scene it
 * was derived from. Recording it is what lets the console say "the original changed since
 * you reviewed this translation"; it is absent for every other episode, so their hashes
 * do not move.
 *
 * @param {{ scene: string, language?: string|null, narration?: string,
 *   layers?: Array<Record<string, unknown>>, params?: Record<string, unknown>,
 *   source?: { scene?: string, hash?: string|null }|null }} input
 */
export function scriptSubject({ scene, language, narration, layers, params, source }) {
  const subject = {
    scene: String(scene ?? ''),
    language: language === undefined || language === null ? null : String(language),
    narration: String(narration ?? ''),
    layers: (layers || []).map(cleanFields),
    params: cleanFields(params),
  };
  if (source && source.hash) {
    subject.source = { scene: String(source.scene ?? ''), hash: String(source.hash) };
  }
  return subject;
}

/**
 * The `preview` gate subject of one scene:
 * `{ script_hash, tts_key, image_keys, alignment_key, still }`.
 *
 * Avatar clip keys are deliberately absent: avatars are the spend the gate authorizes
 * (design "Avatar clip does not matter").
 *
 * @param {{ scriptHash: string|null, ttsKey?: string|null, imageKeys?: string[],
 *   alignmentKey?: string|null, still?: string|null }} input
 */
export function previewSubject({ scriptHash, ttsKey, imageKeys, alignmentKey, still }) {
  return {
    script_hash: scriptHash === undefined ? null : scriptHash,
    tts_key: ttsKey === undefined ? null : ttsKey,
    image_keys: (imageKeys || []).map(String),
    alignment_key: alignmentKey === undefined ? null : alignmentKey,
    still: still === undefined ? null : still,
  };
}

/** The lowercase hex sha256 of a subject's canonical JSON. */
export function reviewHash(subject) {
  return sha256Hex(canonicalJson(subject));
}
