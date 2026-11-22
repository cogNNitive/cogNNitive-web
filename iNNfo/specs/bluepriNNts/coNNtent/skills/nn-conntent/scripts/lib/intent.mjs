/**
 * nn-conntent/scripts/lib/intent.mjs
 *
 * The one intent → provider-parameter translation. The catalog Model is authoritative: an
 * intent field is translated only when the Model declares the matching control in its
 * `controls`, and a value for an undeclared control fails before any spend. (The per-model
 * adapter files that repeated each Model's controls are gone; #752.)
 */

const CONTROL_OF = {
  voice_speed: { control: 'speed', cast: Number },
  voice_emotion: { control: 'emotion', cast: String },
  image_size: { control: 'size', cast: String },
  avatar_resolution: { control: 'resolution', cast: String },
}

/**
 * @param {Record<string, unknown>} intent
 * @param {{ slug?: string, api_id?: string, controls?: string[] }} model
 * @returns {Record<string, unknown>}
 */
export function translateIntent(intent, model = {}) {
  const controls = new Set((model.controls || []).map(String))
  const out = {}
  for (const [field, value] of Object.entries(intent || {})) {
    if (value === undefined || value === null || value === '') continue
    const mapping = CONTROL_OF[field]
    if (!mapping) {
      throw new Error(`unsupported-intent: "${field}" is not an intent field the engine knows`)
    }
    if (!controls.has(mapping.control)) {
      throw new Error(
        `unsupported-control: "${field}" is not a control of ${model.slug || model.api_id || 'this model'} ` +
          `(declared: ${[...controls].sort().join(', ') || 'none'}). Nothing was spent.`,
      )
    }
    out[mapping.control] = mapping.cast(value)
  }
  return out
}
