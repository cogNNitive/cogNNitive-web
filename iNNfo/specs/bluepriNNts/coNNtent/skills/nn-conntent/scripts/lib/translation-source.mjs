/**
 * nn-conntent/scripts/lib/translation-source.mjs
 *
 * A translation episode must be able to tell that the original it was derived from has
 * moved on (capability conntent-domain-console, "Stale translation is flagged"). The
 * original's per-scene script hashes join the translation's review subject as `source`,
 * and the console compares them with the hash recorded when the scene was approved.
 *
 * Zero external dependencies. ESM module.
 */

import path from 'node:path';

import { readEpisode, resolveForEpisode } from './episode.mjs';
import { loadCascadeBags, withScriptPresets } from './video-scope.mjs';
import { lowerEpisode, scriptSubjectsFromScenes } from './review-subject.mjs';

/** The `translation_of` reference of an episode model, or null. */
export function translationRef(model) {
  const video = (model?.elements?.Video || [])[0];
  const ref = video?.fields?.translation_of;
  return ref === undefined || ref === null || String(ref).trim() === '' ? null : String(ref).trim();
}

/** `<series>/<slug>` of an episode document, from the layout it sits in. */
export function episodeIdentity(scriptPath) {
  const dir = path.dirname(scriptPath);
  const slug = path.basename(dir);
  const series = path.basename(path.dirname(path.dirname(dir)));
  return { series, slug };
}

/**
 * The folder of the episode a `translation_of` reference names. `<slug>` stays in the
 * same series; `<series>/<slug>` crosses series.
 */
export function translationSourceDir({ rootDir, scriptPath, ref }) {
  const { series } = episodeIdentity(scriptPath);
  const parts = String(ref).split('/').filter(Boolean);
  if (parts.length === 2) return path.join(rootDir, 'series', parts[0], 'episodes', parts[1]);
  return path.join(rootDir, 'series', series, 'episodes', parts[0]);
}

/**
 * scene slug → the original scene's script hash, or `{}` when the episode is not a
 * translation or the original cannot be read (the engine reports that elsewhere; a
 * missing original never fails the review hash).
 *
 * @param {{ rootDir: string, scriptPath: string, model: object }} input
 * @returns {Record<string, string>}
 */
export function translationSourceHashes({ rootDir, scriptPath, model }) {
  const ref = translationRef(model);
  if (!ref) return {};
  try {
    const dir = translationSourceDir({ rootDir, scriptPath, ref });
    const doc = readEpisode(path.join(dir, `${path.basename(dir)}_coNNtent_NN.md`));
    const bags = withScriptPresets(loadCascadeBags(dir), doc.model, doc.scriptPath);
    const parsed = lowerEpisode({ model: doc.model, bags, scriptDir: dir });
    const language = resolveForEpisode(doc.model, doc.scriptPath, 'language').value;
    const subjects = scriptSubjectsFromScenes(parsed.scenes || [], language);
    return Object.fromEntries(subjects.map((entry) => [entry.scene, entry.hash]));
  } catch {
    return {};
  }
}
