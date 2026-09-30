/**
 * Platform-neutral template-version classification primitives.
 *
 * Ported verbatim (behaviour-for-behaviour) from
 * `skills/nn-preflight/scripts/upgrade-check.js:37-215` so the whole
 * cogNNitive ecosystem — the preflight CLI, `innfo-mcp`, and `innfo-editor` —
 * classifies template versions through ONE implementation with no private copy.
 *
 * Pure: no `node:fs`, no `require`, no network of their own. Remote data (the
 * Level-2 template catalog) is always passed in by the caller.
 */

export interface SemVerTriple {
  major: number
  minor: number
  patch: number
}

/**
 * The five published classification values kept in exact parity with the
 * preflight CLI, plus the additive `unknown` — reachable ONLY when the catalog
 * is offline (`catalog === null`). `upgrade-check.js` skips its scan entirely
 * when the catalog is unreachable, so the CLI can never emit `unknown`.
 */
export type VersionStatus =
  | 'current'
  | 'upgrade-available'
  | 'ahead'
  | 'unlisted'
  | 'unpinned'
  | 'unknown'

/**
 * SemVer bump of the catalog `adopted` version over the model's pinned version.
 * `same` when equal, `null` when a version is unparseable, `none` when there is
 * no meaningful comparison (unpinned / unlisted / offline).
 */
export type VersionGap = 'same' | 'major' | 'minor' | 'patch' | 'none' | null

export interface VersionClassification {
  status: VersionStatus
  template: string | null
  pinned: string | null
  adopted: string | null
  gap: VersionGap
  detail?: string
}

/** One published version entry in the Level-2 template catalog. */
export interface TemplateCatalogVersion {
  blueprint_version: string
  spec_version?: string | null
  title?: string | null
  url?: string
}

/** One template family in the Level-2 template catalog. */
export interface TemplateCatalogEntry {
  name: string
  adopted: string
  versions: TemplateCatalogVersion[]
}

/**
 * The machine-readable Level-2 blueprint catalog produced by
 * `scripts/blueprint-catalog.mjs`. Only `blueprints` participates in
 * classification; `frozen` families are deliberately excluded (they are never
 * an upgrade target).
 */
export interface TemplateCatalog {
  blueprints: Record<string, TemplateCatalogEntry>
  frozen?: Record<string, TemplateCatalogEntry>
  generator?: string
  warnings?: string[]
}

const VERSION_RE = /V_(\d+)-(\d+)-(\d+)/i

/** Extract `{ major, minor, patch }` from any string containing a `V_x-y-z` token. */
export function parseSemVer(v: string): SemVerTriple | null {
  const m = String(v).match(VERSION_RE)
  if (!m) return null
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) }
}

/**
 * Gap between two template versions as the SemVer bump of `adopted` over
 * `pinned`. Returns `same` | `major` | `minor` | `patch`, or `null` when either
 * side is unparseable.
 */
export function gapKind(pinned: string, adopted: string): VersionGap {
  const a = parseSemVer(pinned)
  const b = parseSemVer(adopted)
  if (!a || !b) return null
  if (a.major === b.major && a.minor === b.minor && a.patch === b.patch) return 'same'
  if (a.major !== b.major) return 'major'
  if (a.minor !== b.minor) return 'minor'
  return 'patch'
}

/** Numeric SemVer comparison: negative | 0 | positive. `0` when unparseable. */
export function compareVersions(a: string, b: string): number {
  const va = parseSemVer(a)
  const vb = parseSemVer(b)
  if (!va || !vb) return 0
  return va.major - vb.major || va.minor - vb.minor || va.patch - vb.patch
}

/**
 * Extract `{ name, version }` from a canonical blueprint URL. Handles both the
 * flat layout (`<name>_V_x-y-z(_spec)?_NN.md`) and the versioned-directory
 * package layout (`bluepriNNts/<name>/V_x-y-z/spec_NN.md`). Returns `null` when
 * the URL does not pin a versioned canonical template (e.g. a local
 * specialization).
 */
export function parsePinnedUrl(url: string): { name: string; version: string } | null {
  const basename =
    String(url)
      .split('/')
      .pop()
      ?.replace(/\.md$/i, '') ?? ''
  const flat = basename.match(/^(.+?)_V_(\d+)-(\d+)-(\d+)(?:_spec)?_NN$/i)
  if (flat) return { name: flat[1], version: `V_${flat[2]}-${flat[3]}-${flat[4]}` }
  const pkg = String(url).match(/bluepriNNts\/([^/]+)\/V_(\d+)-(\d+)-(\d+)\/spec_NN\.md/i)
  if (pkg) return { name: pkg[1], version: `V_${pkg[2]}-${pkg[3]}-${pkg[4]}` }
  return null
}

/**
 * Classify a Level-3 model's pinned template URL against the resolved catalog.
 *
 * Mirrors the `scanWorkspaceUpgrades` decision tree in `upgrade-check.js`
 * exactly for the five published statuses. `catalog === null` (offline) short
 * circuits to `unknown` with `gap: 'none'` — informational `template` / `pinned`
 * fields are still parsed from the URL when possible.
 */
export function classifyAgainstCatalog(
  parentUrl: string | null,
  catalog: TemplateCatalog | null,
): VersionClassification {
  const pinned = parentUrl ? parsePinnedUrl(parentUrl) : null

  // Additive sixth value: the catalog was unreachable. The pass degrades every
  // model to `unknown` rather than guessing a status from stale data.
  if (catalog === null) {
    return {
      status: 'unknown',
      template: pinned?.name ?? null,
      pinned: pinned?.version ?? null,
      adopted: null,
      gap: 'none',
      detail: 'Catalog unavailable (offline)',
    }
  }

  if (!parentUrl) {
    return {
      status: 'unpinned',
      template: null,
      pinned: null,
      adopted: null,
      gap: 'none',
      detail: 'No parent_spec.url',
    }
  }

  if (!pinned) {
    return {
      status: 'unlisted',
      template: null,
      pinned: null,
      adopted: null,
      gap: 'none',
      detail: 'Not a versioned canonical template URL',
    }
  }

  const entry = catalog.blueprints?.[pinned.name]
  if (!entry) {
    return {
      status: 'unlisted',
      template: pinned.name,
      pinned: pinned.version,
      adopted: null,
      gap: 'none',
      detail: 'Template not in catalog',
    }
  }

    const known = entry.versions.some((v) => v.blueprint_version === pinned.version)
  if (!known && compareVersions(pinned.version, entry.adopted) > 0) {
    return {
      status: 'ahead',
      template: pinned.name,
      pinned: pinned.version,
      adopted: entry.adopted,
      gap: 'none',
      detail: 'Model is ahead of the catalog adopted version',
    }
  }
  if (!known) {
    return {
      status: 'unlisted',
      template: pinned.name,
      pinned: pinned.version,
      adopted: entry.adopted,
      gap: 'none',
      detail: 'Version not in catalog',
    }
  }

  const kind = gapKind(pinned.version, entry.adopted)
  const cmp = compareVersions(pinned.version, entry.adopted)
  let status: VersionStatus
  if (kind === 'same') status = 'current'
  else if (cmp < 0) status = 'upgrade-available'
  else if (cmp > 0) status = 'ahead'
  else status = 'unlisted'

  return {
    status,
    template: pinned.name,
    pinned: pinned.version,
    adopted: entry.adopted,
    gap: status === 'upgrade-available' ? kind : status === 'current' ? 'same' : 'none',
    detail:
      status === 'ahead' ? 'Model is ahead of the catalog adopted version' : undefined,
  }
}
