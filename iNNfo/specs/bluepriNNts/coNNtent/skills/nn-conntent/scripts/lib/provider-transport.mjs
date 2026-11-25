/**
 * nn-conntent/scripts/lib/provider-transport.mjs
 *
 * The call contract of a catalog `Provider`, read as data (#752 step 1). A Model names its
 * Provider; the Provider declares where and how a job is submitted and polled:
 *
 *   api_base     base URL every path is appended to
 *   env_key      environment variable holding the credential (never the credential itself)
 *   auth_scheme  scheme word of the `Authorization` header (`Bearer`, `Token`)
 *   submit_path  path a job is POSTed to; `{api_id}` is the Model's own `api_id`
 *   poll_path    path the job is polled at; `{id}` is the task id the submit returned
 *   envelope     optional keyed list `[model=<key>, input=<key>]`: the body is wrapped as
 *                `{ <model key>: api_id, <input key>: body }` instead of being sent bare
 *   size_format  how an image size is sent: `star` (`size: "W*H"`) or `aspect_ratio`
 *
 * The engine owns no provider URL, credential name or model id: a model resolves to its
 * route here, and a model or provider that is not declared is refused before any call.
 *
 * Zero external dependencies. ESM module.
 */

import { CatalogError, parseKeyedList, providerCredentialKeys, resolveModel } from './catalog.mjs'

/** Transport fields a Provider must declare before any of its models can be called. */
export const REQUIRED_TRANSPORT_FIELDS = [
  'api_base',
  'env_key',
  'auth_scheme',
  'submit_path',
  'poll_path',
]

/** Values `size_format` accepts. */
export const SIZE_FORMATS = ['star', 'aspect_ratio']

const blank = (value) => value === undefined || value === null || String(value).trim() === ''

function fill(template, vars, what) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) => {
    if (blank(vars[name]))
      throw new CatalogError('incomplete-provider', `${what} uses {${name}}, which has no value.`)
    return String(vars[name])
  })
}

/**
 * The transport of one declared Provider.
 * @param {{ providers?: Record<string, Record<string, unknown>> }} catalog
 * @param {string} slug
 */
export function transportOf(catalog, slug) {
  const provider = (catalog?.providers || {})[String(slug ?? '')]
  if (!provider) {
    throw new CatalogError(
      'unknown-provider',
      `Provider "${slug}" is not declared in the merged catalog (known: ${Object.keys(
        catalog?.providers || {},
      )
        .sort()
        .join(', ')}).`,
    )
  }
  for (const field of REQUIRED_TRANSPORT_FIELDS) {
    if (blank(provider[field])) {
      throw new CatalogError(
        'incomplete-provider',
        `Provider "${provider.slug}" must declare ${field} before any of its models is called.`,
      )
    }
  }
  const sizeFormat = blank(provider.size_format) ? 'star' : String(provider.size_format)
  if (!SIZE_FORMATS.includes(sizeFormat)) {
    throw new CatalogError(
      'incomplete-provider',
      `Provider "${provider.slug}" declares size_format "${sizeFormat}" (allowed: ${SIZE_FORMATS.join(', ')}).`,
    )
  }
  const envelope = parseKeyedList(provider.envelope, `Provider "${provider.slug}" envelope`)
  const base = String(provider.api_base).replace(/\/+$/, '')
  const scheme = String(provider.auth_scheme)
  return {
    slug: String(provider.slug),
    envKey: String(provider.env_key),
    sizeFormat,
    submitUrl: (apiId) =>
      base +
      fill(provider.submit_path, { api_id: apiId }, `Provider "${provider.slug}" submit_path`),
    pollUrl: (id) =>
      base +
      fill(
        provider.poll_path,
        { id: encodeURIComponent(String(id)) },
        `Provider "${provider.slug}" poll_path`,
      ),
    authorization: (key) => scheme + ' ' + key,
    wrap: (apiId, body) =>
      envelope.input
        ? { ...(envelope.model ? { [envelope.model]: apiId } : {}), [envelope.input]: body }
        : body,
  }
}

/**
 * The route of one catalog Model: the Model itself, its `api_id`, and its Provider's
 * transport. An unknown model or provider throws a CatalogError (nothing is called).
 * @param {{ models: object, providers?: object }} catalog
 * @param {string} idOrSlug
 */
export function providerRoute(catalog, idOrSlug) {
  const model = resolveModel(catalog, idOrSlug)
  const transport = transportOf(catalog, model.provider)
  return { model, apiId: String(model.api_id), ...transport }
}

/**
 * The credential variable a model would be called with, or null when the model or its
 * Provider is not declared. Never throws: callers use it to decide billable vs offline.
 */
export function envKeyFor(catalog, idOrSlug) {
  try {
    return providerRoute(catalog, idOrSlug).envKey
  } catch {
    return null
  }
}

/** Every credential variable a declared Provider names (for "is any provider configured"). */
export function declaredEnvKeys(catalog) {
  return providerCredentialKeys(catalog)
}

/** Reads a provider response field tolerant of a `data` wrapper. */
const pick = (obj, key) => obj?.data?.[key] ?? obj?.[key]

/** The task id a submit response carries. */
export function taskIdOf(data) {
  return pick(data, 'id') || pick(data, 'task_id')
}

/** `done`, `failed` or null (still running) for a poll response. */
export function jobStateOf(data) {
  const status = String(pick(data, 'status') ?? '')
  if (status === 'completed' || status === 'succeeded') return 'done'
  if (['failed', 'canceled', 'cancelled', 'error'].includes(status)) return 'failed'
  return null
}

/** The raw status word of a poll response. */
export function statusOf(data) {
  return pick(data, 'status')
}

/** The first output URL of a finished job (`outputs[0]`, or `output` as a list or a string). */
export function outputUrlOf(data) {
  const outputs = pick(data, 'outputs')
  if (Array.isArray(outputs) && outputs[0]) return outputs[0]
  const output = pick(data, 'output')
  return Array.isArray(output) ? output[0] : output
}
