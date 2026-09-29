/**
 * Current iNNfo specification version.
 * This is the SINGLE SOURCE OF TRUTH for the spec version.
 * Every other artifact (code, markdown, skills, models) MUST derive from this
 * constant or be validated against it by scripts/check-spec-version.ts.
 *
 * When bumping the spec version:
 *   1. Update DEFAULT_INNFO_VERSION here.
 *   2. Run `npm run check:spec-version` — it will list every stale file.
 *   3. Update each stale file to match.
 *   4. Never duplicate this value as a hardcoded string elsewhere in .ts/.vue.
 */
export const DEFAULT_INNFO_VERSION = 'V_0-3-0'

/** Default template/blueprint name for new documents. */
export const DEFAULT_blueprint_name = ''
export const DEFAULT_BLUEPRINT_NAME = ''

/** Default template/blueprint version. */
export const DEFAULT_blueprint_version = 'V_0-2-0'
export const DEFAULT_BLUEPRINT_VERSION = 'V_0-2-0'

/** Maximum marker score value (scores range from 0 to this value). */
export const MAX_MARKER_SCORE = 3

/** Number of marker states (0 through MAX_MARKER_SCORE). */
export const MARKER_CYCLE_COUNT = MAX_MARKER_SCORE + 1

/**
 * Builds the canonical raw GitHub URL for an iNNfo (L1) specification version.
 * Use this instead of concatenating the URL by hand.
 *
 * Every spec file under `specs/` is immutable and filename-encoded, so the
 * `main` branch is already content-pinned — there is no separate tag-pinned
 * vs. main-branch strategy to choose between (see `spec-versioning`, A4).
 */
export function buildSpecificationUrl(version: string = DEFAULT_INNFO_VERSION): string {
  return `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_${version}_NN.md`
}

/**
 * Builds the canonical raw GitHub URL for an L2 blueprint version, grouped
 * under its own `specs/bluepriNNts/{name}/` folder alongside its samples.
 */
export function buildTemplateUrl(name: string, version: string = DEFAULT_blueprint_version): string {
  return `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/${name}/${name}_${version}_NN.md`
}

export function buildBlueprintUrl(name: string, version: string = DEFAULT_BLUEPRINT_VERSION): string {
  return buildTemplateUrl(name, version)
}

const KNOWN_TEMPLATES = new Set([
  'business',
  'business-model',
  'analysis',
  'organization',
  'projects',
  'procedures',
  'innovation',
  'metrics',
  'workspace',
  'domaiNN',
  'blank',
  'cogNNitive',
])

/**
 * Normalizes a `target_blueprint` (or legacy `target_blueprint`) field value (e.g. `business` or
 * `business_V_0-2-0`) into the canonical blueprint URL used in a model's
 * `parent_spec.url`.
 *
 * Blueprints evolved from a per-version file (`{name}_{version}_NN.md`) to
 * a stable `spec_NN.md` leaf under `specs/bluepriNNts/{name}/` (their
 * `spec_url` today points at that immutable path). `buildSubmodelTemplateUrl`
 * produces the current canonical form so a freshly scaffolded submodel
 * resolves without a network 404.
 */
export function buildSubmodelTemplateUrl(template: string): string {
  const normalized = (template || '').trim()
  if (KNOWN_TEMPLATES.has(normalized)) {
    return `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/${normalized}/spec_NN.md`
  }
  // Known templates may arrive version-suffixed (e.g. "business_V_0-2-0").
  const baseName = normalized.match(/^(.*?)(?:_V_\d+-\d+-\d+)?$/i)?.[1] || normalized
  if (KNOWN_TEMPLATES.has(baseName)) {
    return `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/${baseName}/spec_NN.md`
  }
  return buildBlueprintUrl(normalized, DEFAULT_blueprint_version)
}
