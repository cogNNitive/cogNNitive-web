/**
 * Browser adapters for the workspace integrity report (AD-6).
 *
 * The editor supplies 3 of the 5 ports — `discoverModels` reads the already
 * parsed knowledgeStore graph (zero extra IO), `validateAll` reuses the in-memory
 * per-model validation reports, `fetchCatalog` does one same-origin
 * `catalog.json` fetch. `resolveBlueprint` and `checkFreshness` are OMITTED
 * (Resolved Decision 4): the browser has no fs tiers and byte-hash freshness
 * is reserved for the `check_workspace` MCP tool, so the builder degrades both
 * fields to `not-checked` rather than failing.
 */

import type {
  WorkspaceIntegrityPorts,
  WorkspaceModelRef,
  IntegrityDiagnostic,
  TemplateCatalog,
  CatalogSource,
} from '@cognnitive/innfo-core'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { validateFormatContent } from '@cognnitive/innfo-core'

/** Same-origin canonical catalog URL (AD-3 tier 1, staged by build-docs.mjs). */
export const CATALOG_URL = 'https://cognnitive.com/innfo/templates/catalog.json'

const CATALOG_TIMEOUT_MS = 2500

async function fetchCatalogJson(): Promise<{ catalog: TemplateCatalog | null; source: CatalogSource }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS)
  try {
    const resp = await fetch(CATALOG_URL, { signal: controller.signal })
    if (!resp.ok) return { catalog: null, source: 'offline' }
    const json = (await resp.json()) as unknown
    if (!json || typeof json !== 'object') return { catalog: null, source: 'offline' }
    const catalog = json as TemplateCatalog
    if (!catalog.blueprints || typeof catalog.blueprints !== 'object') {
      return { catalog: null, source: 'offline' }
    }
    return { catalog, source: 'remote' }
  } catch {
    return { catalog: null, source: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Build the browser ports. `resolveBlueprint` / `checkFreshness` are
 * deliberately absent so `buildWorkspaceIntegrityReport` reports them as
 * `not-checked` (Resolved Decision 4).
 */
export function createWorkspaceIntegrityPorts(): WorkspaceIntegrityPorts {
  const knowledgeStore = useKnowledgeStore()

  return {
    discoverModels: async (): Promise<WorkspaceModelRef[]> => {
      const refs: WorkspaceModelRef[] = []
      for (const id of knowledgeStore.rootIds) {
        if (id.startsWith('spec:')) continue
        const node = knowledgeStore.nodes[id]
        if (!node?.rawContent) continue
        const fm = parseFrontmatter(node.rawContent)
        if (!fm || fm.level !== 3) continue
        const parent = fm.parent_spec as { name?: string; url?: string } | undefined
        const path = (node.source?.path ?? id).replace(/\\/g, '/')
        refs.push({
          path,
          id,
          parentUrl: parent?.url ?? null,
          parentName: parent?.name ?? null,
        })
      }
      return refs
    },

    validateAll: async (
      models: WorkspaceModelRef[],
    ): Promise<Map<string, { errors: IntegrityDiagnostic[]; warnings: IntegrityDiagnostic[] }>> => {
      const out = new Map<string, { errors: IntegrityDiagnostic[]; warnings: IntegrityDiagnostic[] }>()
      for (const model of models) {
        const node = model.id ? knowledgeStore.nodes[model.id] : undefined
        const errors: IntegrityDiagnostic[] = []
        const warnings: IntegrityDiagnostic[] = []
        if (node?.rawContent) {
          const fileName = (model.path.split('/').pop() ?? 'model').replace(/\\/g, '/')
          const report = validateFormatContent(node.rawContent, fileName)
          for (const check of report.checks) {
            const diag = {
              path: model.path,
              message: check.message ?? '',
              severity: check.severity === 'error' ? ('error' as const) : ('warning' as const),
            }
            ;(check.severity === 'error' ? errors : warnings).push(diag)
          }
          // Merge schema-conformance diagnostics computed during parse.
          const sv = node.schemaValidation as
            | { errors?: Array<{ message: string }>; warnings?: Array<{ message: string }> }
            | undefined
          if (sv) {
            for (const diag of sv.errors ?? []) {
              errors.push({ path: model.path, message: diag.message, severity: 'error' })
            }
            for (const diag of sv.warnings ?? []) {
              warnings.push({ path: model.path, message: diag.message, severity: 'warning' })
            }
          }
        }
        out.set(model.path, { errors, warnings })
      }
      return out
    },

    fetchCatalog: fetchCatalogJson,
  }
}