/**
 * nn-conntent/scripts/lib/review-subject.mjs
 *
 * Builds the per-scene review subjects the gate state hashes, from the same lowered
 * scenes the compiler and the estimator consume (capability conntent-review-gates).
 *
 * Zero external dependencies (the compiler module owns the lowering). ESM module.
 */

import { SceneCompiler } from '../scene-compiler.mjs';
import { reviewHash, scriptSubject } from './review-hash.mjs';
import { evaluateGate } from './gates.mjs';

/**
 * One lowered scene → one script subject plus its hash.
 * The layer shape is the compiler's: `{ type, slug, properties }`.
 *
 * @param {Array<Record<string, any>>} scenes lowered scenes
 * @param {string|null} language episode language, used when the scene declares none
 * @param {Record<string, Record<string, string>>} [sourcesByScene] scene → field → level
 * @param {Record<string, string>} [sourceHashes] scene → hash of the original scene, for a translation
 */
export function scriptSubjectsFromScenes(scenes = [], language = null, sourcesByScene = {}, sourceHashes = {}) {
  return scenes.map((scene) => {
    const slug = String(scene.slug || scene.id || '');
    const params = { ...(scene.properties || {}) };
    const layers = (scene.layers || []).map((layer) => ({
      type: layer.type,
      ...(layer.properties || {}),
    }));
    const sourceHash = sourceHashes[slug];
    const subject = scriptSubject({
      scene: slug,
      language: params.scene_language || language,
      narration: scene.narration || '',
      layers,
      params,
      ...(sourceHash ? { source: { scene: slug, hash: sourceHash } } : {}),
    });
    return {
      scene: slug,
      subject,
      hash: reviewHash(subject),
      sources: sourcesByScene[slug] || {},
    };
  });
}

export function lowerEpisode({ model, bags, scriptDir, fps, width, height }) {
  const compiler = new SceneCompiler();
  return compiler.lowerKnowledgeModel(model, { bags, scriptDir, fps, width, height });
}

/**
 * Lower the model and build its script subjects. This is the engine entry point; the
 * pure mapper above is what the tests drive.
 *
 * @param {{ model: object, bags: object, scriptDir: string, language?: string|null,
 *   fps?: number, width?: number, height?: number }} input
 */
export function scriptSubjectsForEpisode({ model, bags, scriptDir, language = null, fps, width, height }) {
  const parsed = lowerEpisode({ model, bags, scriptDir, fps, width, height });
  return scriptSubjectsFromScenes(parsed.scenes || [], language);
}

/** The `script` gate state of every subject, against the applied verdicts. */
export function scriptGateStates(subjects = [], verdicts = []) {
  return subjects.map((entry) =>
    evaluateGate({
      gate: 'script',
      scene: entry.scene,
      currentHash: entry.hash,
      verdicts,
    }),
  );
}
