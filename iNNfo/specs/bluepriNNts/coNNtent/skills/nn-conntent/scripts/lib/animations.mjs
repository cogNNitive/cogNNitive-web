/**
 * nn-conntent/scripts/lib/animations.mjs
 *
 * Authored-animation resolution (design D7/D8). An `animation` Layer points at an
 * authored HyperFrames project directory through `asset::`. The pre-pass reads the
 * project's `index.html` root `data-composition-id` (its id) and `data-duration`
 * (its intended length, in seconds) BEFORE any synthesis or render, so a missing
 * project fails loudly with nothing spent, and a scene without narration can take
 * the animation's length (a narrated scene trims or loops it).
 *
 * Convention (documented, no engine precedent): the authored project's ROOT
 * element declares `data-composition-id` and `data-duration` (seconds). The first
 * `data-composition-id`/`data-duration` pair in `index.html` is the root's.
 *
 * Ids must be unique across the emitted root: an authored id equal to a scene
 * slug, the root composition id, a component id or a DIFFERENT project's id is an
 * error naming both (design D8). One project mounted by several scenes is allowed.
 *
 * Data inputs (issue #612 item 4): an `animation` Layer's `inputs` are checked against the
 * variables the project root declares in `data-composition-variables` (the HyperFrames
 * variable contract: `{ id, type, default, options }`) and typed for the mount host's
 * `data-variable-values`. `asset:: component:<name>` names a library component
 * (`components/<name>`, the library walk `fit:: component:<name>` uses) in place of an
 * authored project directory; a component is always checked, so its required inputs must be
 * given. An authored project without `inputs` is mounted as before, unchecked.
 *
 * Pure filesystem module: imports no provider and no HyperFrames module.
 */

import fs from 'node:fs';
import path from 'node:path';

import { resolveLibrary } from './library.mjs';
import { readVariables } from '../overlay-blocks.mjs';

/** Raised when an `animation` Layer's project directory has no readable project. */
export class AnimationProjectError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnimationProjectError';
  }
}

/** Raised when an `animation` Layer's inputs do not match what its project declares. */
export class AnimationInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnimationInputError';
    this.code = 'animation-input';
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

const COMPONENT_RE = /^component:([A-Za-z0-9][A-Za-z0-9._-]*)$/;

/**
 * Checks a Layer's inputs against the declared variables and types them for the mount.
 * Every given input must be declared; a declared variable with no `default` is required; a
 * `number` must be finite, a `boolean` `true` or `false`, an `enum` one of its option values.
 * The result holds every declared variable that has a value (given, else its default).
 * @param {Record<string, string>} inputs
 * @param {Array<{ id: string, type?: string, default?: unknown, options?: Array<{ value: unknown }> }>} declared
 * @param {string} where names the Layer and its project in every error
 * @returns {Record<string, unknown>}
 */
export function checkAnimationInputs(inputs, declared, where) {
  const byId = new Map(declared.map((v) => [v.id, v]));
  for (const name of Object.keys(inputs)) {
    if (!byId.has(name)) {
      throw new AnimationInputError(
        `${where}: input "${name}" is not declared (declared: ${declared.map((v) => v.id).join(', ') || 'none'})`,
      );
    }
  }
  const values = {};
  for (const variable of declared) {
    if (!Object.hasOwn(inputs, variable.id)) {
      if (!Object.hasOwn(variable, 'default')) throw new AnimationInputError(`${where}: required input "${variable.id}" is not given`);
      values[variable.id] = variable.default;
      continue;
    }
    const raw = inputs[variable.id];
    if (variable.type === 'number') {
      const n = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(n)) {
        throw new AnimationInputError(`${where}: input "${variable.id}" must be a number, got "${raw}"`);
      }
      values[variable.id] = n;
    } else if (variable.type === 'boolean') {
      if (raw !== 'true' && raw !== 'false') {
        throw new AnimationInputError(`${where}: input "${variable.id}" must be true or false, got "${raw}"`);
      }
      values[variable.id] = raw === 'true';
    } else if (variable.type === 'enum') {
      const allowed = (variable.options || []).map((o) => String(o?.value));
      if (!allowed.includes(raw)) {
        throw new AnimationInputError(`${where}: input "${variable.id}" must be one of ${allowed.join(', ')}, got "${raw}"`);
      }
      values[variable.id] = raw;
    } else {
      values[variable.id] = raw;
    }
  }
  return values;
}

/**
 * The project directory an `animation` Layer mounts: an authored directory relative to the
 * script, or the folder of the library component `component:<name>` names.
 */
function projectDirOf(layer, asset, { scriptDir, workspaceRoot, packageFloor }) {
  const component = COMPONENT_RE.exec(String(asset).trim());
  if (!component) return { projectDir: path.isAbsolute(asset) ? asset : path.resolve(scriptDir, asset), component: null };
  const name = component[1];
  const { file, searched } = resolveLibrary({
    kind: 'components',
    ref: `components/${name}`,
    fromDir: scriptDir,
    root: workspaceRoot,
    packageFloor,
    throwOnMiss: false,
  });
  if (!file) {
    throw new AnimationProjectError(
      `animation Layer "${layer.name}": component "${name}" not found; searched:\n${(searched || []).map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return { projectDir: fs.statSync(file).isDirectory() ? file : path.dirname(file), component: name };
}

/**
 * Resolves every `animation` Layer to its authored project or library component, keyed by
 * scene id, and checks its inputs. A project directory with no readable `index.html` fails
 * loudly, and so does a component the library walk does not find.
 * @param {{ scenes: Array<{ id: string, layers?: object[] }>, scriptDir: string, workspaceRoot?: string, packageFloor?: string }} params
 *   `packageFloor` is the blueprint's `library/components` folder, the last library level.
 * @returns {Record<string, Array<{ id: string, durationSeconds: number, sourceDir: string, layerSlug: string, values?: Record<string, unknown> }>>}
 */
export function resolveAnimations({ scenes, scriptDir, workspaceRoot, packageFloor }) {
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
      const { projectDir, component } = projectDirOf(layer, asset, { scriptDir, workspaceRoot, packageFloor });
      const project = readAuthoredProject(projectDir);
      if (!project) {
        throw new AnimationProjectError(
          `animation project not found for Layer "${layer.name}": expected ${path.join(projectDir, 'index.html')}`,
        );
      }
      const inputs = layer.properties?.layer_inputs;
      // A component is always checked; an authored project only when the Layer gives inputs,
      // so a Layer without inputs mounts its project exactly as before.
      const values =
        inputs || component
          ? checkAnimationInputs(
              inputs || {},
              readVariables(fs.readFileSync(project.indexPath, 'utf8')),
              `animation Layer "${layer.name}" (${project.indexPath})`,
            )
          : null;
      entries.push({
        id: project.id,
        durationSeconds: project.durationSeconds,
        sourceDir: projectDir,
        layerSlug: layer.slug,
        ...(values ? { values } : {}),
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
      // The SAME project mounted by several scenes is one staged copy with one
      // namespaced host per mount; two DIFFERENT projects sharing an id collide.
      const prior = seen.get(id);
      if (prior && !(entry.sourceDir && prior.sourceDir && path.resolve(entry.sourceDir) === path.resolve(prior.sourceDir))) {
        throw new AnimationIdCollisionError({ id, other: prior.sceneId, kind: 'animation' });
      }
      if (!prior) seen.set(id, { sceneId, sourceDir: entry.sourceDir });
    }
  }
  return true;
}
