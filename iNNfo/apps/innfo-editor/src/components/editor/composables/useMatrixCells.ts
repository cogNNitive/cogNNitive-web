import { computed, type ComputedRef, type Ref } from 'vue'
import { normalizeSeparators, scaleRangeFor } from '@cognnitive/innfo-core'
import { useKnowledgeStore } from '../../../stores/knowledgeStore'
import { commitFieldValue } from '../../../shared/editAttribution'
import type { MatrixDef } from '../../../composables/useMatrixDefinitions'
import type { KnowledgeNode } from '../../../model/types'

export interface UseMatrixCells {
  matrixCellKey(row: string, col: string): string
  getVal(row: string, col: string): string | number | boolean
  setVal(row: string, col: string, value: string | number | boolean): void
  valueDistribution(rows: CellEndpoint[], cols: CellEndpoint[]): Record<string, number>
  getSetOptionsList(): string[]
  isOutOfSetValue(value: string | number | boolean): boolean
  rotateCycle(row: string, col: string): void
  /** Numeric range for the 'scale' widget; also template-bound in MatricesGrid.vue's <select>. */
  scaleRange: ComputedRef<number[]>
}

/** A matrix row/column endpoint: the stable node id used for cell keys plus
 *  the display name shown in the grid. See E1 (same-named elements in
 *  different parents must resolve to independent cells). */
export interface CellEndpoint {
  id: string
  name: string
}

/**
 * useMatrixCells — cell read/write + widget-option helpers for MatricesGrid.vue.
 * Moved verbatim; `getVal`/`valueDistribution` still read across every
 * `knowledgeStore.rootIds` (matches pre-extraction behavior — a cell value may be
 * committed against a different root than the one used for writes).
 */
export function useMatrixCells(
  activeMatrix: Ref<MatrixDef | null>,
  rootNode: Ref<KnowledgeNode | null | undefined>,
  onChange: (key: string, value: unknown) => void,
): UseMatrixCells {
  const knowledgeStore = useKnowledgeStore()

  function matrixCellKey(row: string, col: string): string {
    if (!activeMatrix.value) return ''
    return `${activeMatrix.value.name}||${normalizeSeparators(row)}||${normalizeSeparators(col)}`
  }

  function getVal(row: string, col: string): string | number | boolean {
    if (!activeMatrix.value) return ''
    const key = matrixCellKey(row, col)
    for (const id of knowledgeStore.rootIds) {
      const r = knowledgeStore.getNode(id)
      if (!r) continue
      const field = r.fields[key]
      if (field && field.value !== undefined && field.value !== null) {
        return field.value as string | number | boolean
      }
    }
    return '-'
  }

  function setVal(row: string, col: string, value: string | number | boolean): void {
    if (!activeMatrix.value) return
    const root = rootNode.value
    if (!root) return
    const key = matrixCellKey(row, col)
    commitFieldValue(knowledgeStore, root.id, key, value, { kind: 'user', id: 'anonymous' })
    onChange(key, value)
  }

  function valueDistribution(rows: CellEndpoint[], cols: CellEndpoint[]): Record<string, number> {
    if (!activeMatrix.value || !rows.length || !cols.length) return {}
    const counts: Record<string, number> = {}
    for (const row of rows) {
      for (const col of cols) {
        const key = matrixCellKey(row.id, col.id)
        let val: unknown
        for (const id of knowledgeStore.rootIds) {
          const r = knowledgeStore.getNode(id)
          const field = r?.fields?.[key]
          if (field && field.value !== undefined && field.value !== null) {
            val = field.value
            break
          }
        }
        const strVal = val === undefined || val === null || val === '-' ? '-' : String(val)
        counts[strVal] = (counts[strVal] || 0) + 1
      }
    }
    return counts
  }

  function getSetOptionsList(): string[] {
    if (!activeMatrix.value) return []
    const values = activeMatrix.value.values
    if (Array.isArray(values) && values.length > 0) return values
    const params = activeMatrix.value.params
    return params
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  /** Derived purely from activeMatrix — used by isOutOfSetValue's 'scale' branch.
   *  Honors `widget_config` ({min,max,step}) first (iNNfo "Widget Configuration"),
   *  then a numeric `values` array, then the legacy `min:N;max:N` params string. */
  const scaleRange = computed<number[]>(() => {
    if (!activeMatrix.value) return []
    return scaleRangeFor({
      widgetConfig: activeMatrix.value.widgetConfig,
      values: activeMatrix.value.values,
      params: activeMatrix.value.params,
    })
  })

  function isOutOfSetValue(value: string | number | boolean): boolean {
    if (value === '-' || value === '' || value === undefined || value === null) return false
    if (activeMatrix.value?.widgetType === 'scale') {
      return !scaleRange.value.includes(Number(value))
    }
    if (activeMatrix.value?.widgetType === 'set') {
      return !getSetOptionsList().includes(String(value))
    }
    return false
  }

  function cycleOrder(): string[] {
    const order = activeMatrix.value?.widgetConfig?.order
    if (Array.isArray(order) && order.length > 0) return order.map(String)
    return getSetOptionsList()
  }

  function rotateCycle(row: string, col: string): void {
    if (!activeMatrix.value) return
    const current = getVal(row, col)
    const options = cycleOrder()
    if (options.length === 0) {
      // Default cycle: 1-2-3-4-5
      const defaultCycle = ['1', '2', '3', '4', '5']
      const idx = current === '-' ? -1 : defaultCycle.indexOf(String(current))
      const next = idx >= defaultCycle.length - 1 ? '-' : defaultCycle[idx + 1]
      setVal(row, col, next)
    } else {
      const idx = current === '-' ? -1 : options.indexOf(String(current))
      const next = idx >= options.length - 1 ? '-' : options[idx + 1]
      setVal(row, col, next)
    }
  }

  return {
    matrixCellKey,
    getVal,
    setVal,
    valueDistribution,
    getSetOptionsList,
    isOutOfSetValue,
    rotateCycle,
    scaleRange,
  }
}
