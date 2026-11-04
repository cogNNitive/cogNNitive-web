/**
 * nn-conntent/scripts/lib/episode.mjs
 *
 * The Episode record: how the engine reads a Video document, which states it can be
 * produced from, and the field-key guard the intake applies to a proposed changeset
 * (capability video-episode-lifecycle and video-produce-command).
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKnowledgeModel } from './knowledge-model.mjs';
import { loadCascadeBags, resolve, withScriptPresets } from './video-scope.mjs';

/** The closed set of Episode states. */
export const EPISODE_STATUSES = ['idea', 'draft', 'approved', 'produced', 'published', 'archived'];

/** States `produce` refuses: they are history, not work. */
export const REFUSED_STATUSES = new Set(['published', 'archived']);

const REGISTRY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'field-registry.generated.json');

export class EpisodeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EpisodeError';
    this.code = code;
  }
}

/** The field registry generated from the blueprint (design A11). */
export function loadFieldRegistry(file = REGISTRY_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Reads the Video record and its Scenes from an episode document.
 * @param {string} scriptPath
 * @param {{ model?: object }} [deps]
 * @returns {{ scriptPath: string, slug: string, status: string, blueprintVersion: string|undefined,
 *   fields: Record<string, unknown>, scenes: Array<{ name: string, slug: string, review?: string, kind?: string }> }}
 */
export function readEpisode(scriptPath, deps = {}) {
  const model = deps.model || loadKnowledgeModel(scriptPath);
  const video = (model.elements?.Video || [])[0];
  if (!video) {
    throw new EpisodeError('missing-video', `${scriptPath} has no "## NN Video" element: it is not an episode.`);
  }
  const fields = video.fields || {};
  return {
    scriptPath,
    model,
    slug: String(fields.slug || video.slug || ''),
    status: String(fields.status || ''),
    blueprintVersion: model.frontmatter?.blueprint_version,
    fields,
    scenes: (model.elements?.Scene || []).map((scene) => ({
      name: scene.name,
      slug: String(scene.fields?.slug || scene.slug || ''),
      review: scene.fields?.review === undefined ? undefined : String(scene.fields.review),
      kind: scene.fields?.kind === undefined ? undefined : String(scene.fields.kind),
    })),
  };
}

/**
 * Every field key an element carries must be a Field Definition of the blueprint.
 * The apply engine does not police this, so the intake does (capability
 * video-field-registry "Unknown And Retired Keys Are Rejected").
 * @param {object} model Parsed iNNfo document
 * @param {{ fields: Record<string, unknown> }} [registry]
 * @returns {Array<{ code: 'unknown-key', key: string, element: string }>}
 */
export function unknownKeys(model, registry = loadFieldRegistry()) {
  const declared = new Set(Object.keys(registry.fields || {}));
  const problems = [];
  for (const [concept, elements] of Object.entries(model.elements || {})) {
    for (const element of elements) {
      for (const key of Object.keys(element.fields || {})) {
        if (!declared.has(key)) {
          problems.push({ code: 'unknown-key', key, element: `${concept}/${element.name || element.slug}` });
        }
      }
    }
  }
  return problems;
}

/**
 * Refuses an episode the engine cannot produce: a terminal state, or a blueprint pin
 * that is not the installed one (capability video-produce-command "Produce Refuses
 * Episodes It Cannot Produce").
 * @param {{ scriptPath: string, status: string, blueprintVersion?: string }} episode
 * @param {string} installedVersion
 */
export function assertProducible(episode, installedVersion) {
  if (REFUSED_STATUSES.has(episode.status)) {
    throw new EpisodeError(
      'refused-state',
      `Cannot produce ${path.basename(episode.scriptPath)}: its status is "${episode.status}". ` +
        `Only idea, draft, approved and produced can be produced.`,
    );
  }
  if (!EPISODE_STATUSES.includes(episode.status)) {
    throw new EpisodeError(
      'unknown-state',
      `Cannot produce ${path.basename(episode.scriptPath)}: "${episode.status}" is not an Episode status (${EPISODE_STATUSES.join(', ')}).`,
    );
  }
  if (episode.blueprintVersion !== installedVersion) {
    throw new EpisodeError(
      'blueprint-version-mismatch',
      `Cannot produce ${path.basename(episode.scriptPath)}: it pins blueprint_version ` +
        `${episode.blueprintVersion ?? '(none)'} but the installed coNNtent blueprint is ${installedVersion}. ` +
        'Old episodes stay archives; nothing was converted.',
    );
  }
}

/**
 * Resolves one delivery parameter for an episode: the document's own Video fields, then
 * the Series/domain/blueprint cascade. No `cli` level exists.
 * @param {object} model
 * @param {string} scriptPath
 * @param {string} param
 */
export function resolveForEpisode(model, scriptPath, param) {
  const bags = withScriptPresets(loadCascadeBags(path.dirname(scriptPath)), model, scriptPath);
  const video = (model.elements?.Video || [])[0]?.fields || {};
  return resolve(param, { ...bags, video });
}

/**
 * The scenes that are not approved. `needs-change` wins over a missing verdict: the
 * engine reports the scene and the reviewer's comment when it knows one.
 * @param {{ scenes: Array<{ name: string, slug: string, review?: string }> }} episode
 * @param {Record<string, string>} [comments] by scene slug
 */
export function pendingReviews(episode, comments = {}) {
  const pending = [];
  for (const scene of episode.scenes) {
    if (scene.review === 'approved') continue;
    pending.push({
      slug: scene.slug,
      name: scene.name,
      review: scene.review || 'unreviewed',
      needsChange: scene.review === 'needs-change',
      comment: comments[scene.slug] || null,
    });
  }
  return pending;
}
