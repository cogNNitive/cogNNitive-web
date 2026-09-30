/**
 * check_workspace tool — one consolidated workspace integrity pass.
 *
 * Implements AD-5: self-heal first (resolve/hydrate missing template
 * packages), classify second (against the resolved catalog), dedup freshness
 * third. All five `buildWorkspaceIntegrityReport` ports are Node adapters
 * sharing one per-call context so the merged `SpecCache` (first-wins) reaches
 * `collectWorkspaceDiagnostics` and each model's resolution is computed once.
 *
 * See `openspec/changes/2026-09-07-workspace-integrity-check/design.md` AD-1,
 * AD-3, AD-4, AD-5.
 */

import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  buildWorkspaceIntegrityReport,
  summarizeWorkspaceIntegrity,
  parseFrontmatter,
  SpecResolutionError,
  type TemplateCatalog,
  type WorkspaceIntegrityPorts,
  type WorkspaceModelRef,
  type WorkspaceIntegrityReport,
  type TemplateResolutionResult,
  type IntegrityDiagnostic,
  type CatalogSource,
} from '@cognnitive/innfo-core'
import type { SpecCache } from '@cognnitive/innfo-core'
import { listModels } from './list-read.js'
import { deriveNameFromUrl } from './spec.js'
import {
  collectWorkspaceDiagnostics,
  filterDiagnosticsForModel,
  validateKnowledge,
} from './validate.js'
import {
  resolveParentChainNode,
  resolveTemplatePackage,
  freshnessVerdict,
} from './resolver-node.js'

/** Canonical Pages URL for the Level-2 template catalog (AD-3, tier 1). */
export const CATALOG_PAGES_URL = 'https://cognnitive.com/innfo/templates/catalog.json'
/** Raw fallback URL for the catalog (AD-3, tier 2). */
export const CATALOG_RAW_URL =
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/catalog.json'

const CATALOG_TIMEOUT_MS = 2500
const FRESHNESS_TIMEOUT_MS = 10000

export interface CheckWorkspaceOptions {
  summaryOnly?: boolean
  offline?: boolean
}

interface CheckContext {
  rootDir: string
  offline: boolean
  models: WorkspaceModelRef[]
  resolutions: Map<string, TemplateResolutionResult>
  /** Merged across every model's `resolveParentChainNode`, first-wins. */
  mergedCache: SpecCache
  /** Workspace-relative forward-slashed model path → absolute file path. */
  absByPath: Map<string, string>
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function newSpecCache(): SpecCache {
  return { specs: new Map(), chain: [] }
}

/** Merge `incoming` into `target`, first-wins per spec name. */
function mergeCache(target: SpecCache, incoming: SpecCache): void {
  for (const [name, doc] of incoming.specs) {
    if (!target.specs.has(name)) target.specs.set(name, doc)
  }
  for (const c of incoming.chain) {
    if (!target.chain.includes(c)) target.chain.push(c)
  }
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) return null
    return (await resp.json()) as unknown
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: an unreachable catalog degrades to null (offline).
    console.warn(`[check-workspace] Catalog fetch failed: ${err}`)
    return null
  } finally {
    clearTimeout(timer)
    /* v8 ignore stop */
  }
}

function parseCatalog(json: unknown): TemplateCatalog | null {
  if (!json || typeof json !== 'object') return null
  const cat = json as TemplateCatalog
  if (!cat.blueprints || typeof cat.blueprints !== 'object') return null
  return cat
}

/**
 * AD-3 catalog resolution: remote-first (Pages, then raw), then in-repo
 * (`<rootDir>/specs/bluepriNNts/catalog.json`, else the monorepo copy), then
 * offline. `offline: true` skips tiers 1–2 entirely.
 */
export async function resolveCatalog(
  rootDir: string,
  offline: boolean,
): Promise<{ catalog: TemplateCatalog | null; source: CatalogSource }> {
  if (!offline) {
    const remote = await fetchJson(CATALOG_PAGES_URL, CATALOG_TIMEOUT_MS)
    const parsedRemote = parseCatalog(remote)
    if (parsedRemote) return { catalog: parsedRemote, source: 'remote' }
    const raw = await fetchJson(CATALOG_RAW_URL, CATALOG_TIMEOUT_MS)
    const parsedRaw = parseCatalog(raw)
    if (parsedRaw) return { catalog: parsedRaw, source: 'remote' }
  }

  const localCandidates = [
    join(rootDir, 'specs', 'bluepriNNts', 'catalog.json'),
    join(rootDir, 'specs', 'templates', 'catalog.json'),
    join(rootDir, 'iNNfo', 'specs', 'bluepriNNts', 'catalog.json'),
    join(rootDir, 'iNNfo', 'specs', 'templates', 'catalog.json'),
  ]
  for (const path of localCandidates) {
    try {
      if (existsSync(path)) {
        const parsed = parseCatalog(JSON.parse(readFileSync(path, 'utf-8')))
        if (parsed) return { catalog: parsed, source: 'in-repo' }
      }
    } catch (err) {
      /* v8 ignore start */
      // log + continue: an unreadable local catalog — try the next candidate.
      console.warn(`[check-workspace] Failed to read local catalog ${path}: ${err}`)
      /* v8 ignore stop */
    }
  }
  return { catalog: null, source: 'offline' }
}

/**
 * Self-healing resolve + hydrate for one model's parent template. Reads
 * through `resolveParentChainNode({ checkFreshness: false, inPlace: true })`:
 * a 4-tier local
 * hit is `resolved` (with tier), a network fetch + write-once hydration is
 * `hydrated`, and a `SpecResolutionError` is `unresolved` — never throws out
 * of the port. Merges the returned `SpecCache` into the shared context.
 */
async function resolveTemplateForModel(
  ctx: CheckContext,
  model: WorkspaceModelRef,
): Promise<TemplateResolutionResult> {
  const { rootDir } = ctx
  if (!model.parentUrl || !model.parentName) {
    return { outcome: 'not-checked', detail: 'No parent_spec.url to resolve' }
  }
  const existingPkg = await resolveTemplatePackage(rootDir, model.parentName).catch(() => null)
  try {
    const cache = await resolveParentChainNode(rootDir, model.parentUrl, model.parentName, {
      checkFreshness: false,
      inPlace: true, // self-heal is an explicit in-tree write: hydrate beside the model
    })
    mergeCache(ctx.mergedCache, cache)
    const depth0 = cache.specs.get(model.parentName)
    const localContent = depth0?.rawContent
    const outcome = existingPkg ? 'resolved' : 'hydrated'
    return {
      outcome,
      tier: existingPkg?.tier,
      ...(localContent !== undefined ? { localContent } : {}),
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'SpecResolutionError' || err instanceof SpecResolutionError)
    ) {
      return { outcome: 'unresolved', detail: err.message }
    }
    return { outcome: 'unresolved', detail: errorMessage(err) }
  }
}

export function toIntegrityDiagnostics(
  diags: Array<{
    path: string
    message: string
    severity: 'error' | 'warning' | 'info'
    code?: string
  }>,
): IntegrityDiagnostic[] {
  // The workspace report has no `info` bucket: non-blocking notices surface
  // as warnings, keeping path/message/code intact.
  return diags.map((d) => ({
    path: d.path,
    message: d.message,
    severity: d.severity === 'info' ? 'warning' : d.severity,
    ...(d.code ? { code: d.code } : {}),
  }))
}

async function discoverModels(ctx: CheckContext): Promise<WorkspaceModelRef[]> {
  const infos = await listModels(ctx.rootDir)
  const refs: WorkspaceModelRef[] = []
  for (const info of infos) {
    try {
      const content = await readFile(info.path, 'utf-8')
      const fm = parseFrontmatter(content)
      if (!fm || fm.level !== 3) continue
      const parent = fm.parent_spec as { name?: string; url?: string } | undefined
      const parentUrl = parent?.url ?? (fm.spec_url as string | undefined) ?? null
      const parentName = parent?.name ?? (parentUrl ? deriveNameFromUrl(parentUrl) : null)
      const rel = relative(ctx.rootDir, info.path).replace(/\\/g, '/')
      ctx.absByPath.set(rel, info.path)
      refs.push({
        path: rel,
        id: info.id,
        parentUrl: parentUrl ?? null,
        parentName: parentName ?? null,
      })
    } catch (err) {
      /* v8 ignore start */
      // log + continue: an unreadable model file is skipped.
      console.warn(`[check-workspace] Failed to inspect model ${info.path}: ${err}`)
      /* v8 ignore stop */
    }
  }
  ctx.models = refs
  return refs
}

async function validateAll(
  ctx: CheckContext,
  models: WorkspaceModelRef[],
): Promise<Map<string, { errors: IntegrityDiagnostic[]; warnings: IntegrityDiagnostic[] }>> {
  // AD-5 step 2: self-heal every model's template first so the merged cache
  // (and the one recursiveParse below) sees each model's template.
  for (const model of models) {
    if (!ctx.resolutions.has(model.path)) {
      ctx.resolutions.set(model.path, await resolveTemplateForModel(ctx, model))
    }
  }

  // AD-5 step 3: ONE workspace parse over the merged cache.
  const workspaceDiags = await collectWorkspaceDiagnostics(ctx.rootDir, ctx.mergedCache)

  const out = new Map<string, { errors: IntegrityDiagnostic[]; warnings: IntegrityDiagnostic[] }>()
  for (const model of models) {
    const abs = ctx.absByPath.get(model.path)
    const filtered = abs
      ? filterDiagnosticsForModel(workspaceDiags, ctx.rootDir, abs)
      : workspaceDiags

    // AD-5 step 4: per-model validation (workspace=false → single-file pass)
    // plus the filtered cross-model diagnostics.
    let fileErrors: IntegrityDiagnostic[] = []
    let fileWarnings: IntegrityDiagnostic[] = []
    if (model.id) {
      try {
        const result = await validateKnowledge(ctx.rootDir, model.id, undefined, undefined, false, {
          checkFreshness: false,
        })
        fileErrors = toIntegrityDiagnostics(result.errors)
        fileWarnings = toIntegrityDiagnostics(result.warnings)
      } catch (err) {
        /* v8 ignore start */
        // swallow deliberately: validateKnowledge never rejects by contract, but
        // never let it fail the pass.
        console.warn(`[check-workspace] validateKnowledge threw for ${model.id}: ${err}`)
        /* v8 ignore stop */
      }
    }

    const errors = [...filtered.filter((d) => d.severity === 'error'), ...fileErrors]
    const warnings = [...filtered.filter((d) => d.severity === 'warning'), ...fileWarnings]
    out.set(model.path, { errors, warnings })
  }
  return out
}

/**
 * AD-5 step 6 freshness port: per distinct URL, one byte-hash comparison via
 * `freshnessVerdict`. The builder dedups by URL and caps concurrency.
 */
function makeCheckFreshness(): NonNullable<WorkspaceIntegrityPorts['checkFreshness']> {
  return async (templateUrl, localContent) =>
    freshnessVerdict(templateUrl, localContent, FRESHNESS_TIMEOUT_MS)
}

export function buildCheckWorkspacePorts(ctx: CheckContext): WorkspaceIntegrityPorts {
  return {
    discoverModels: () => discoverModels(ctx),
    validateAll: (models) => validateAll(ctx, models),
    fetchCatalog: () => resolveCatalog(ctx.rootDir, ctx.offline),
    resolveTemplate: (model) => {
      const cached = ctx.resolutions.get(model.path)
      return cached ? Promise.resolve(cached) : resolveTemplateForModel(ctx, model)
    },
    checkFreshness: makeCheckFreshness(),
  }
}

/**
 * Run the workspace integrity check. Returns the builder's consolidated
 * report. With `summaryOnly`, `models` carries only rows with validation
 * errors or `upgrade-available` (capped at 25) plus `truncated: true` when the
 * cap was hit; `aggregate` always reflects the full set.
 */
export async function checkWorkspace(
  rootDir: string,
  options: CheckWorkspaceOptions = {},
): Promise<WorkspaceIntegrityReport & { truncated?: boolean }> {
  const ctx: CheckContext = {
    rootDir,
    offline: options.offline ?? false,
    models: [],
    resolutions: new Map(),
    mergedCache: newSpecCache(),
    absByPath: new Map(),
  }
  const report = await buildWorkspaceIntegrityReport(buildCheckWorkspacePorts(ctx))

  if (!options.summaryOnly) return report

  const included = report.models.filter(
    (m) => m.errors.length > 0 || m.versionStatus === 'upgrade-available',
  )
  const truncated = included.length > 25
  const trimmed = truncated ? included.slice(0, 25) : included
  return {
    ...report,
    models: trimmed,
    aggregate: summarizeWorkspaceIntegrity(report.models),
    ...(truncated ? { truncated: true } : {}),
  }
}

export const checkDomain = checkWorkspace

