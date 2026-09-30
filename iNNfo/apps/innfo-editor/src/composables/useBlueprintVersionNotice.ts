/**
 * useBlueprintVersionNotice — detects when a model's `parent_spec` pins an
 * older L2 `blueprint_version` than the newest one discoverable, and builds
 * the passive D3 migration notice (badge + copyable `innfo:` prompt).
 *
 * Detection (design.md A1): union the versions found by scanning the
 * resolver's own local search dirs (`specs/`, `.specs/`, `.spec-cache/`) for
 * `{slug}_V_*_NN.md` files with the bundled `SHIPPED_BLUEPRINT_VERSIONS` map.
 * Fires when the highest version found is strictly newer than the version
 * pinned by `parent_spec.name`. Read-only observer — never mutates anything.
 */
import { ref, type Ref } from 'vue'
import type { DirectoryHandleLike } from '../model/fs-types'
import { innfoPrompt } from '../ai-guide/prompt'
import { SHIPPED_BLUEPRINT_VERSIONS } from '../config/samples'

export interface TemplateVersionNotice {
  current: string
  latest: string
  prompt: string
}

export interface ParsedBlueprintName {
  slug: string
  version: string
}

/** Trailing `_V_x-y-z` on a `parent_spec.name`-shaped string, e.g. "business_V_0-1-0". */
const VERSION_SUFFIX_RE = /_V_(\d+)-(\d+)-(\d+)$/i
/** A versioned template filename, e.g. "business_V_0-1-2_NN.md". */
const VERSIONED_FILENAME_RE = /^(.+)_V_(\d+)-(\d+)-(\d+)_NN\.md$/i

/** Splits a `parent_spec.name` into template slug + version; `null` for unversioned/self-contained models. */
export function parseBlueprintName(name: string): ParsedBlueprintName | null {
  const match = VERSION_SUFFIX_RE.exec(name)
  if (!match || match.index === 0) return null
  return { slug: name.slice(0, match.index), version: `V_${match[1]}-${match[2]}-${match[3]}` }
}

/** Splits a versioned template filename into slug + version. */
export function parseVersionedFilename(filename: string): ParsedBlueprintName | null {
  const match = VERSIONED_FILENAME_RE.exec(filename)
  return match ? { slug: match[1], version: `V_${match[2]}-${match[3]}-${match[4]}` } : null
}

/** Compares two "V_x-y-z" strings numerically. Returns <0, 0, or >0 (a vs b). */
export function compareVersions(a: string, b: string): number {
  const pa = /(\d+)-(\d+)-(\d+)/.exec(a)
  const pb = /(\d+)-(\d+)-(\d+)/.exec(b)
  if (!pa || !pb) return 0
  for (let i = 1; i <= 3; i++) {
    const diff = Number(pa[i]) - Number(pb[i])
    if (diff !== 0) return diff
  }
  return 0
}

/** Returns the highest "V_x-y-z" among `versions` (or `null` if empty). */
export function pickLatestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null
  return versions.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best))
}

const MAX_SCAN_DEPTH = 6

/** Recursively collects `{slug}_V_x-y-z_NN.md` version matches under `dir`. Bounded depth guards circular trees. */
export async function scanDirForBlueprintVersions(
  dir: DirectoryHandleLike,
  slug: string,
  depth = 0,
): Promise<string[]> {
  if (depth > MAX_SCAN_DEPTH) return []
  const found: string[] = []
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === 'file') {
      const parsed = parseVersionedFilename(name)
      if (parsed && parsed.slug === slug) found.push(parsed.version)
    } else if (entry.kind === 'directory') {
      found.push(...(await scanDirForBlueprintVersions(entry as DirectoryHandleLike, slug, depth + 1)))
    }
  }
  return found
}

/** The resolver's own local search dirs (spec-versioning A1) — every hit is unioned. */
const SEARCH_DIR_NAMES = ['specs', '.specs', '.spec-cache']

/** Scans every known local search dir in the workspace handle for a template slug's versions. */
export async function scanWorkspaceForBlueprintVersions(
  handle: DirectoryHandleLike,
  slug: string,
): Promise<string[]> {
  const all: string[] = []
  for (const dirName of SEARCH_DIR_NAMES) {
    try {
      const dir = await handle.getDirectoryHandle(dirName)
      all.push(...(await scanDirForBlueprintVersions(dir, slug)))
    } catch {
      // Directory absent in this workspace — not an error, just no hits from it.
    }
  }
  return all
}

/**
 * Builds the copyable `innfo:`-prefixed migration prompt (G4/A3, D3).
 * Mirrors ONLY the `parent_spec.name` regex-rewrite pattern from
 * `packages/innfo-mcp/src/tools/mutate.ts:271-274` — explicitly NOT that
 * function's delete-the-original logic, which would violate immutability.
 */
export function buildMigrationPrompt(opts: {
  modelFileName: string
  templateSlug: string
  currentVersion: string
  latestVersion: string
}): string {
  const { modelFileName, templateSlug, currentVersion, latestVersion } = opts
  const currentName = `${templateSlug}_${currentVersion}`
  const latestName = `${templateSlug}_${latestVersion}`
  return innfoPrompt(
    `My model "${modelFileName}" pins parent_spec.name "${currentName}" (blueprint_version ` +
      `${currentVersion}), but a newer template version is available: "${latestName}" ` +
      `(blueprint_version ${latestVersion}). Migrate it: create a NEW model file — do NOT edit or ` +
      `delete "${modelFileName}" — with knowledge_version bumped one MAJOR version. In the new file, ` +
      `rewrite parent_spec.name from "${currentName}" to "${latestName}" by replacing only the ` +
      `trailing _V_x-y-z version segment (mirror the parent_spec.name rewrite pattern used for ` +
      `template version bumps; do NOT reuse any operation that deletes the original model or ` +
      `template file). Update parent_spec.url to point at the "${latestName}" template file. Map ` +
      `any renamed concepts or fields introduced by the new template version. Then run ` +
      `validate_model to confirm the migrated file is valid.`,
  )
}

export interface UseBlueprintVersionNoticeCtx {
  templateName: Ref<string>
  modelFileName: Ref<string>
  handle?: Ref<DirectoryHandleLike | undefined>
}

/**
 * Exposes a `notice` ref (null when no newer version exists) and a
 * `refresh()` to call whenever the active model/workspace handle changes.
 * Kept explicit (no internal `watchEffect`) so it stays trivially testable
 * with a fake `DirectoryHandleLike`.
 */
export function useBlueprintVersionNotice(ctx: UseBlueprintVersionNoticeCtx): {
  notice: Ref<TemplateVersionNotice | null>
  refresh: () => Promise<void>
} {
  const notice = ref<TemplateVersionNotice | null>(null) as Ref<TemplateVersionNotice | null>

  async function refresh(): Promise<void> {
    const parsed = parseBlueprintName(ctx.templateName.value)
    if (!parsed) {
      notice.value = null
      return
    }

    const found: string[] = []
    const shipped = SHIPPED_BLUEPRINT_VERSIONS[parsed.slug]
    if (shipped) found.push(shipped)

    const handle = ctx.handle?.value
    if (handle) {
      try {
        found.push(...(await scanWorkspaceForBlueprintVersions(handle, parsed.slug)))
      } catch {
        // Best-effort: a scan failure never blocks editing (D3 — passive, non-blocking).
      }
    }

    const latest = pickLatestVersion(found)
    if (!latest || compareVersions(latest, parsed.version) <= 0) {
      notice.value = null
      return
    }

    notice.value = {
      current: parsed.version,
      latest,
      prompt: buildMigrationPrompt({
        modelFileName: ctx.modelFileName.value,
        templateSlug: parsed.slug,
        currentVersion: parsed.version,
        latestVersion: latest,
      }),
    }
  }

  return { notice, refresh }
}
