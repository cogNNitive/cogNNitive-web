/**
 * Platform-neutral workspace integrity report builder.
 *
 * `buildWorkspaceIntegrityReport(ports, options)` is the single interface both
 * `innfo-mcp` (`check_workspace`) and `innfo-editor` (`workspaceStore.open()`)
 * call. Everything that varies by platform — model discovery, diagnostics
 * collection, catalog fetch, template resolution/hydration, byte-hash freshness
 * — is a PORT injected by the caller. The builder is pure orchestration: no
 * `node:fs`, no `fetch`, no `node:path`.
 *
 * See `openspec/changes/2026-09-07-workspace-integrity-check/design.md` AD-1.
 */

import {
  classifyAgainstCatalog,
  type TemplateCatalog,
  type VersionGap,
  type VersionStatus,
} from './versionStatus.js'

export type { TemplateCatalog, VersionGap, VersionStatus }

/** How the Level-2 template catalog was resolved for this pass. */
export type CatalogSource = 'in-repo' | 'remote' | 'offline'

/**
 * Per-model template freshness (byte-hash vs canonical remote).
 * `not-checked` — the platform has no freshness port.
 * `offline` — a freshness port exists but the catalog/remote was unreachable.
 * `unknown` — a fetch was attempted and failed.
 */
export type FreshnessField = 'fresh' | 'stale' | 'unknown' | 'not-checked' | 'offline'

/** Outcome of the self-healing resolve + hydrate step for one model's template. */
export type TemplateResolution = 'resolved' | 'hydrated' | 'unresolved' | 'not-checked'

export interface WorkspaceModelRef {
  /** Workspace-relative, forward-slashed. Identity key for the whole report. */
  path: string
  /** Model id (filename stem) when the adapter has one. */
  id?: string
  /** `parent_spec.url` (or `spec_url`), verbatim. `null` ⇒ unpinned. */
  parentUrl: string | null
  parentName: string | null
}

export interface IntegrityDiagnostic {
  path: string
  message: string
  severity: 'error' | 'warning'
  code?: string
}

export interface TemplateResolutionResult {
  outcome: TemplateResolution
  /** Resolver tier when resolved locally: 'workspace-package' | 'workspace-flat' | … */
  tier?: string
  /** Local raw content of the resolved depth-0 template, for the freshness hash. */
  localContent?: string
  detail?: string
}

export interface WorkspaceIntegrityPorts {
  /** REQUIRED. Every Level-3 model in the workspace. */
  discoverModels(): Promise<WorkspaceModelRef[]>
  /** REQUIRED. One call for the whole workspace, keyed by `WorkspaceModelRef.path`. */
  validateAll(
    models: WorkspaceModelRef[],
  ): Promise<Map<string, { errors: IntegrityDiagnostic[]; warnings: IntegrityDiagnostic[] }>>
  /** REQUIRED. `catalog: null` ⇒ source is 'offline'. Never throws (best-effort). */
  fetchCatalog(): Promise<{ catalog: TemplateCatalog | null; source: CatalogSource }>
  /** OPTIONAL. Self-healing resolve + hydrate. Omitted ⇒ 'not-checked'. Never throws. */
  resolveBlueprint?(model: WorkspaceModelRef): Promise<TemplateResolutionResult>
  /** OPTIONAL. Byte-hash vs canonical remote. Omitted ⇒ 'not-checked'. Never throws. */
  checkFreshness?(templateUrl: string, localContent: string): Promise<'fresh' | 'stale' | 'unknown'>
}

export interface ModelIntegrityReport {
  path: string
  template: string | null
  pinnedVersion: string | null
  adoptedVersion: string | null
  versionStatus: VersionStatus
  gap: VersionGap
  templateResolved: TemplateResolution
  templateTier?: string
  freshness: FreshnessField
  errors: IntegrityDiagnostic[]
  warnings: IntegrityDiagnostic[]
}

export interface WorkspaceIntegrityAggregate {
  modelsScanned: number
  /** The ONLY failure count: models with ≥1 error. */
  invalid: number
  withWarnings: number
  versionStatus: Record<VersionStatus, number>
  templateResolution: Record<TemplateResolution, number>
  freshness: Record<FreshnessField, number>
}

export interface WorkspaceIntegrityReport {
  schemaVersion: 1
  generatedAt: string
  models: ModelIntegrityReport[]
  aggregate: WorkspaceIntegrityAggregate
  catalogSource: CatalogSource
  offline: boolean
  /** Human-readable notes on what could NOT be determined. */
  degraded: string[]
}

export interface BuildWorkspaceIntegrityOptions {
  now?: () => Date
  /** Max in-flight freshness fetches. Default 4. */
  freshnessConcurrency?: number
}

const VERSION_STATUSES: VersionStatus[] = [
  'current',
  'upgrade-available',
  'ahead',
  'unlisted',
  'unpinned',
  'unknown',
]
const BLUEPRINT_RESOLUTIONS: TemplateResolution[] = [
  'resolved',
  'hydrated',
  'unresolved',
  'not-checked',
]
const FRESHNESS_FIELDS: FreshnessField[] = ['fresh', 'stale', 'unknown', 'not-checked', 'offline']

const DEFAULT_FRESHNESS_CONCURRENCY = 4

function zeroed<K extends string>(keys: K[]): Record<K, number> {
  const out = {} as Record<K, number>
  for (const key of keys) out[key] = 0
  return out
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Run `worker` over `items` with at most `limit` promises in flight at once.
 * Resolves when every item has been processed. `worker` must not reject.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  const width = Math.max(1, Math.min(limit, items.length))
  let cursor = 0
  const runners = Array.from({ length: width }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index])
    }
  })
  await Promise.all(runners)
}

/**
 * Pure. Fold a per-model list into the workspace aggregate. Exported so callers
 * can re-summarise a filtered list (e.g. `summary_only`).
 */
export function summarizeWorkspaceIntegrity(
  models: ModelIntegrityReport[],
): WorkspaceIntegrityAggregate {
  const aggregate: WorkspaceIntegrityAggregate = {
    modelsScanned: models.length,
    invalid: 0,
    withWarnings: 0,
    versionStatus: zeroed(VERSION_STATUSES),
    templateResolution: zeroed(BLUEPRINT_RESOLUTIONS),
    freshness: zeroed(FRESHNESS_FIELDS),
  }
  for (const model of models) {
    aggregate.versionStatus[model.versionStatus]++
    aggregate.templateResolution[model.templateResolved]++
    aggregate.freshness[model.freshness]++
    if (model.errors.length > 0) aggregate.invalid++
    if (model.warnings.length > 0) aggregate.withWarnings++
  }
  return aggregate
}

/**
 * Single read-mostly integrity pass over a workspace. Non-blocking by contract:
 * a throwing port degrades its slice of the report and is recorded in
 * `degraded[]`; the pass always resolves with a full report.
 */
export async function buildWorkspaceIntegrityReport(
  ports: WorkspaceIntegrityPorts,
  options: BuildWorkspaceIntegrityOptions = {},
): Promise<WorkspaceIntegrityReport> {
  const now = options.now ?? (() => new Date())
  const freshnessConcurrency = Math.max(
    1,
    options.freshnessConcurrency ?? DEFAULT_FRESHNESS_CONCURRENCY,
  )
  const degraded: string[] = []

  const models = await ports.discoverModels()

  // Diagnostics — one workspace-scoped call.
  let diagnostics: Map<string, { errors: IntegrityDiagnostic[]; warnings: IntegrityDiagnostic[] }>
  try {
    diagnostics = await ports.validateAll(models)
  } catch (err) {
    diagnostics = new Map()
    degraded.push(`Workspace validation could not run: ${errorMessage(err)}`)
  }

  // Catalog — best-effort; any failure means offline.
  let catalog: TemplateCatalog | null = null
  let catalogSource: CatalogSource = 'offline'
  try {
    const resolved = await ports.fetchCatalog()
    catalog = resolved.catalog
    catalogSource = catalog === null ? 'offline' : resolved.source
  } catch (err) {
    catalog = null
    catalogSource = 'offline'
    degraded.push(`Template catalog could not be resolved: ${errorMessage(err)}`)
  }
  const offline = catalog === null
  if (offline) {
    degraded.push('Catalog offline — version status degraded to "unknown" for every model.')
  }

  // Template resolution (optional port).
  const resolutions = new Map<string, TemplateResolutionResult>()
  if (ports.resolveBlueprint) {
    for (const model of models) {
      try {
        resolutions.set(model.path, await ports.resolveBlueprint(model))
      } catch (err) {
        resolutions.set(model.path, { outcome: 'unresolved', detail: errorMessage(err) })
      }
    }
  } else {
    degraded.push('Template resolution not performed on this platform (not-checked).')
  }

  // Freshness (optional port). Deduplicated by URL, concurrency-capped, and
  // skipped entirely when offline.
  const freshnessByUrl = new Map<string, 'fresh' | 'stale' | 'unknown'>()
  if (!ports.checkFreshness) {
    degraded.push('Per-template byte-hash freshness not performed on this platform (not-checked).')
  } else if (!offline) {
    const checkFreshness = ports.checkFreshness
    const jobs: Array<{ url: string; localContent: string }> = []
    const seen = new Set<string>()
    for (const model of models) {
      const url = model.parentUrl
      if (!url || !/^https?:/i.test(url) || seen.has(url)) continue
      const localContent = resolutions.get(model.path)?.localContent
      if (localContent == null) continue
      seen.add(url)
      jobs.push({ url, localContent })
    }
    await runWithConcurrency(jobs, freshnessConcurrency, async (job) => {
      try {
        freshnessByUrl.set(job.url, await checkFreshness(job.url, job.localContent))
      } catch (err) {
        /* v8 ignore start */
        // swallow deliberately: freshness is advisory — an unreachable remote
        // records `unknown` and never fails the integrity pass.
        console.warn(`[integrity] Freshness check failed for ${job.url}: ${err}`)
        freshnessByUrl.set(job.url, 'unknown')
        /* v8 ignore stop */
      }
    })
  }

  const modelReports: ModelIntegrityReport[] = models.map((model) => {
    const diag = diagnostics.get(model.path) ?? { errors: [], warnings: [] }
    const classification = classifyAgainstCatalog(model.parentUrl, catalog)
    const resolution = resolutions.get(model.path)
    const templateResolved: TemplateResolution = ports.resolveBlueprint
      ? (resolution?.outcome ?? 'unresolved')
      : 'not-checked'

    let freshness: FreshnessField
    if (!ports.checkFreshness) {
      freshness = 'not-checked'
    } else if (offline) {
      freshness = 'offline'
    } else {
      const url = model.parentUrl
      freshness = url && freshnessByUrl.has(url) ? freshnessByUrl.get(url)! : 'not-checked'
    }

    return {
      path: model.path,
      template: classification.template ?? model.parentName ?? null,
      pinnedVersion: classification.pinned,
      adoptedVersion: classification.adopted,
      versionStatus: classification.status,
      gap: classification.gap,
      templateResolved,
      templateTier: resolution?.tier,
      freshness,
      errors: diag.errors,
      warnings: diag.warnings,
    }
  })

  return {
    schemaVersion: 1,
    generatedAt: now().toISOString(),
    models: modelReports,
    aggregate: summarizeWorkspaceIntegrity(modelReports),
    catalogSource,
    offline,
    degraded,
  }
}
