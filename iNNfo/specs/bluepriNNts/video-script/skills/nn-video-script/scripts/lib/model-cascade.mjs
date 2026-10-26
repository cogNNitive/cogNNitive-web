/**
 * nn-video-script/scripts/lib/model-cascade.mjs
 *
 * The single resolver for model selection. Precedence, most specific first:
 *
 *   cli > layer > scene > video > series > workspace > blueprint
 *
 * Every caller (estimator, engine CLI, compiler) obtains a model id only from
 * here, reporting the scope that supplied it. The spend guard GATES (allow/budget)
 * and never selects. Pure module, no provider import.
 */

/** Scope chain, most specific first. */
export const SCOPE_ORDER = ['cli', 'layer', 'scene', 'video', 'series', 'workspace', 'blueprint'];

/** @param {unknown} v */
function usable(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/**
 * @param {{ kind: 'tts'|'image'|'avatar', scope?: Record<string, Record<string, unknown>> }} input
 * @returns {{ id: string | null, source: string | null }}
 */
export function resolveModel({ kind, scope = {} } = {}) {
  for (const s of SCOPE_ORDER) {
    const bag = scope[s];
    if (bag && usable(bag[kind])) return { id: String(bag[kind]), source: s };
  }
  return { id: null, source: null };
}

/**
 * Resolves several kinds at once.
 * @param {{ kinds: string[], scope?: Record<string, Record<string, unknown>> }} input
 * @returns {Record<string, { id: string | null, source: string | null }>}
 */
export function resolveModels({ kinds, scope = {} } = {}) {
  const out = {};
  for (const kind of kinds) out[kind] = resolveModel({ kind, scope });
  return out;
}

/**
 * Convenience for the engine: resolves one kind from the concrete inputs a
 * compile/estimate run has, so the plan (estimator) and the execution
 * (compile/synthesize) pick the SAME model id and stay in lockstep.
 * @param {'tts'|'image'|'avatar'} kind
 * @param {{ cliModel?, layerModel?, sceneModel?, videoModel?, seriesModel?, workspaceModel?, defaultModel? }} opts
 * @returns {string | null}
 */
export function resolveEngineModel(kind, opts = {}) {
  const bag = (v) => ({ [kind]: v });
  return resolveModel({
    kind,
    scope: {
      cli: bag(opts.cliModel),
      layer: bag(opts.layerModel),
      scene: bag(opts.sceneModel),
      video: bag(opts.videoModel),
      series: bag(opts.seriesModel),
      workspace: bag(opts.workspaceModel),
      blueprint: bag(opts.defaultModel),
    },
  }).id;
}

