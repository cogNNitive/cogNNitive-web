/**
 * useMatrixDefinitions
 *
 * Shared home for the `__matrix_defs` field pattern, duplicated (with two
 * genuinely different strategies) across LeftSidebar.vue and MatricesGrid.vue
 * before this extraction:
 *
 * - `extractMatrixDefs` (fallback strategy — LeftSidebar.vue): `__matrix_defs`
 *   verbatim when non-empty, else the raw `matrices` frontmatter field
 *   normalized via `normalizeMatrixDecl`.
 * - `mergeMatrixDefs` (merge strategy — MatricesGrid.vue): both sources,
 *   always normalized, deduped by name (`__matrix_defs` entries win).
 *
 * These are NOT unified into one algorithm — see design.md "`__matrix_defs`
 * helper is parameterized, not unified into one algorithm".
 */

import { computed, type ComputedRef, type Ref } from 'vue'
import { normalizeMatrixDecl } from '@cognnitive/innfo-core'
import type { MatrixWidgetType } from '@cognnitive/innfo-core'
import type { KnowledgeNode } from '../model/types'
import { useModelStore } from '../stores/modelStore'

export const MATRIX_DEFS_KEY = '__matrix_defs'

export interface MatrixDef {
  name: string
  source: string
  target: string
  widgetType: MatrixWidgetType
  params: string
  values?: string[]
  /** Widget-specific configuration (iNNfo "Widget Configuration"). */
  widgetConfig?: Record<string, unknown>
  description?: string
  min_color?: string
  max_color?: string
  label?: string
}

/** Raw `__matrix_defs` field value; [] when absent. */
export function readMatrixDefsField(root: KnowledgeNode | null | undefined): any[] {
  const defs = (root as any)?.fields?.[MATRIX_DEFS_KEY]?.value
  return Array.isArray(defs) ? defs : []
}

/** Raw `matrices` frontmatter field value; [] when absent. */
export function readRawMatricesField(root: KnowledgeNode | null | undefined): any[] {
  const raw = (root as any)?.fields?.matrices?.value
  return Array.isArray(raw) ? raw : []
}

/** LeftSidebar/BlockSheet/WorkspaceView/BlockMatrixSummary strategy: defs, else normalized matrices. */
export function extractMatrixDefs(root: KnowledgeNode | null | undefined): any[] {
  const defs = readMatrixDefsField(root)
  if (defs.length > 0) return defs
  const raw = readRawMatricesField(root)
  if (raw.length > 0) return raw.map((m: any) => normalizeMatrixDecl(m))
  return []
}

/** MatricesGrid strategy: both sources normalized, deduped by name (case-insensitive), defs first. */
export function mergeMatrixDefs(root: KnowledgeNode | null | undefined): MatrixDef[] {
  const result: MatrixDef[] = []
  const seen = new Set<string>()

  for (const m of readMatrixDefsField(root)) {
    const key = String(m.name ?? '').toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(normalizeMatrixDecl(m) as MatrixDef)
    }
  }
  for (const m of readRawMatricesField(root)) {
    const key = String(m.name ?? '').toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(normalizeMatrixDecl(m) as MatrixDef)
    }
  }
  return result
}

/**
 * The authoritative, merged matrix list across ALL workspace roots — the exact
 * list `MatricesGrid.vue` renders. Any consumer that maps a matrix NAME (or a
 * sidebar index) to the grid's index space MUST resolve against this list;
 * otherwise selection drifts (clicking pill N shows matrix N-1 when a lower
 * version/spec root declares matrices the sidebar hides).
 */
export function computeMergedMatrixDefs(rootIds: string[]): MatrixDef[] {
  const modelStore = useModelStore()
  const result: MatrixDef[] = []
  const seen = new Set<string>()

  for (const id of rootIds) {
    const root = modelStore.getNode(id)
    if (!root) continue
    for (const d of mergeMatrixDefs(root)) {
      const key = d.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        result.push(d)
      }
    }
  }
  return result
}

/**
 * Resolves a matrix name to its index in the authoritative merged list.
 * Returns -1 when the matrix is not declared by any workspace root.
 */
export function resolveMatrixIndexByName(matrixName: string): number {
  const modelStore = useModelStore()
  return computeMergedMatrixDefs(modelStore.rootIds).findIndex((d) => d.name === matrixName)
}

export function useMatrixDefinitions(
  rootIds: Ref<string[]>,
  opts?: { strategy?: 'fallback' | 'merge' },
): { matrixDefs: ComputedRef<MatrixDef[]>; getMatrixValueCount: (matrixName: string) => number } {
  const modelStore = useModelStore()
  const strategy = opts?.strategy ?? 'fallback'

  const matrixDefs = computed<MatrixDef[]>(() => {
    if (strategy === 'merge') return computeMergedMatrixDefs(rootIds.value)
    const result: MatrixDef[] = []
    const seen = new Set<string>()

    for (const id of rootIds.value) {
      const root = modelStore.getNode(id)
      if (!root) continue
      const defs = extractMatrixDefs(root)
      for (const d of defs) {
        const key = String(d.name ?? '').toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          result.push(d)
        }
      }
    }
    return result
  })

  function getMatrixValueCount(matrixName: string): number {
    let count = 0
    const prefix = `${matrixName}||`
    for (const node of Object.values(modelStore.nodes)) {
      if (!node.fields) continue
      for (const [key, fv] of Object.entries(node.fields)) {
        if (key.startsWith(prefix)) {
          const val = (fv as any)?.value
          if (val !== undefined && val !== null && val !== '' && val !== '-' && val !== false) {
            count++
          }
        }
      }
    }
    return count
  }

  return { matrixDefs, getMatrixValueCount }
}
