/**
 * nn-video-script/scripts/lib/animations.mjs
 *
 * Authored-animation resolution (design D7/D8). An `animation` Layer points at an
 * authored HyperFrames project directory through `asset::`. The pre-pass reads the
 * project's `index.html` root `data-composition-id` (its id) and `data-duration`
 * (its intended length, in seconds) BEFORE any synthesis or render, so a missing
 * project fails loudly with nothing spent and the scene length can be
 * `max(narration, animation)`.
 *
 * Convention (documented, no engine precedent): the authored project's ROOT
 * element declares `data-composition-id` and `data-duration` (seconds). The first
 * `data-composition-id`/`data-duration` pair in `index.html` is the root's.
 *
 * Ids must be unique across the emitted root: an authored id equal to a scene
 * slug, the root composition id, a component id or another animation's id is an
 * error naming both (design D8).
 *
 * Pure filesystem module: imports no provider and no HyperFrames module.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Raised when an `animation` Layer's project directory has no readable project. */
export class AnimationProjectError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnimationProjectError';
  }
}

/** Raised when two root-level composition ids would collide (design D8). */
export class AnimationIdCollisionError extends Error {
  /**
   * @param {{ id: string, other: string, kind: string }} entry
   */
  constructor({ id, other, kind }) {
    super(`animation id "${id}" collides with ${kind} "${other}"`);
    this.name = 'AnimationIdCollisionError';
    this.id = id;
    this.other = other;
    this.kind = kind;
  }
}

const ID_RE = /data-composition-id\s*=\s*["']([^"']+)["']/;
const DURATION_RE = /data-duration\s*=\s*["']([0-9.]+)["']/;

/**
 * Reads an authored project's root composition id and duration (seconds).
 * @param {string} projectDir
 * @returns {{ id: string, durationSeconds: number, indexPath: string, projectDir: string } | null}
 *   null when `index.html` is absent or declares no `data-composition-id`.
 */
export function readAuthoredProject(projectDir) {
  const indexPath = path.join(projectDir, 'index.html');
  if (!fs.existsSync(indexPath)) return null;
  let html;
  try {
    html = fs.readFileSync(indexPath, 'utf8');
  } catch {
    return null;
  }
  const idMatch = ID_RE.exec(html);
  if (!idMatch) return null;
  const durMatch = DURATION_RE.exec(html);
  const durationSeconds = durMatch ? Number(durMatch[1]) : 0;
  return { id: idMatch[1], durationSeconds, indexPath, projectDir };
}

/**
 * Resolves every `animation` Layer to its authored project, keyed by scene id.
 * A project directory with no readable `index.html` fails loudly.
 * @param {{ scenes: Array<{ id: string, layers?: object[] }>, scriptDir: string }} params
 * @returns {Record<string, Array<{ id: string, durationSeconds: number, sourceDir: string, layerSlug: string }>>}
 */
export function resolveAnimations({ scenes, scriptDir }) {
  /** @type {Record<string, Array<{ id: string, durationSeconds: number, sourceDir: string, layerSlug: string }>>} */
  const byScene = {};
  for (const sc of scenes || []) {
    const layers = (sc.layers || []).filter((l) => l.type === 'animation');
    if (layers.length === 0) continue;
    const entries = [];
    for (const layer of layers) {
      const asset = layer.properties?.layer_asset_source;
      if (!asset) {
        throw new AnimationProjectError(`animation Layer "${layer.name}" has no asset::`);
      }
      const projectDir = path.isAbsolute(asset) ? asset : path.resolve(scriptDir, asset);
      const project = readAuthoredProject(projectDir);
      if (!project) {
        throw new AnimationProjectError(
          `animation project not found for Layer "${layer.name}": expected ${path.join(projectDir, 'index.html')}`,
        );
      }
      entries.push({
        id: project.id,
        durationSeconds: project.durationSeconds,
        sourceDir: projectDir,
        layerSlug: layer.slug,
      });
    }
    byScene[sc.id] = entries;
  }
  return byScene;
}

/**
 * Asserts every authored id is unique across the emitted root (design D8): it must
 * differ from every scene slug, the root composition id, every component id and
 * every other animation id.
 * @param {{ animations: Record<string, Array<{ id: string }>>, sceneSlugs?: string[], rootId?: string | null, componentIds?: string[] }} params
 * @returns {true}
 */
export function assertAnimationIds({ animations, sceneSlugs = [], rootId = null, componentIds = [] }) {
  const sceneSet = new Set(sceneSlugs);
  const componentSet = new Set(componentIds);
  const seen = new Map();
  for (const [sceneId, entries] of Object.entries(animations || {})) {
    for (const entry of entries || []) {
      const { id } = entry;
      if (rootId && id === rootId) {
        throw new AnimationIdCollisionError({ id, other: rootId, kind: 'root composition' });
      }
      if (sceneSet.has(id)) {
        throw new AnimationIdCollisionError({ id, other: id, kind: 'scene slug' });
      }
      if (componentSet.has(id)) {
        throw new AnimationIdCollisionError({ id, other: id, kind: 'component' });
      }
      if (seen.has(id)) {
        throw new AnimationIdCollisionError({ id, other: seen.get(id), kind: 'animation' });
      }
      seen.set(id, sceneId);
    }
  }
  return true;
}
