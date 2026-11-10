/**
 * nn-conntent/scripts/lib/preview-subject.mjs
 *
 * The per-scene preview subject the preview gate hashes: what the reviewer heard and
 * saw, never the avatar clip (capability conntent-review-gates; design D-P1).
 *
 * The cache keys come from the SAME helpers the synthesizer uses, so the gate cannot
 * drift from the cache (ttsCacheKeyFor / imageCacheKeyFor).
 *
 * Zero external dependencies. ESM module.
 */

import { previewSubject, reviewHash } from './review-hash.mjs';
import { evaluateGate } from './gates.mjs';
import { ttsCacheKeyFor } from './avatar-jobs.mjs';
import { imageCacheKeyFor } from './image-options.mjs';

/**
 * @param {Array<Record<string, any>>} scenes lowered scenes
 * @param {Record<string, { hash?: string }>} scriptByScene scene slug → script subject entry
 * @param {{ cacheManager: { computeHash: Function }, config?: object, models?: object,
 *   bags?: object, alignmentKeys?: Record<string, string|null>,
 *   stills?: Record<string, string|null> }} options
 * @returns {Array<{ scene: string, subject: object, hash: string }>}
 */
export function previewSubjectsFromScenes(scenes = [], scriptByScene = {}, options = {}) {
  const {
    cacheManager,
    config = {},
    models = {},
    bags = {},
    alignmentKeys = {},
    stills = {},
    planHashes = {},
  } = options;

  return scenes.map((scene) => {
    const slug = String(scene.slug || scene.id || '');
    const script = scriptByScene[slug] || {};
    const imageKeys = (scene.layers || [])
      .map((layer) => imageCacheKeyFor(scene, layer, { cacheManager, models }))
      .filter(Boolean);
    const subject = previewSubject({
      scriptHash: script.hash ?? null,
      ttsKey: ttsCacheKeyFor(scene, { cacheManager, config, models, bags }) ?? null,
      imageKeys,
      alignmentKey: alignmentKeys[slug] ?? null,
      still: stills[slug] ?? null,
    });
    return { scene: slug, subject, hash: reviewHash(subject), planHash: planHashes[slug] ?? null };
  });
}

/** The `preview` gate state of every subject, against the applied verdicts. */
export function previewGateStates(subjects = [], verdicts = []) {
  return subjects.map((entry) =>
    evaluateGate({ gate: 'preview', scene: entry.scene, currentHash: entry.hash, planHash: entry.planHash ?? null, verdicts }),
  );
}
