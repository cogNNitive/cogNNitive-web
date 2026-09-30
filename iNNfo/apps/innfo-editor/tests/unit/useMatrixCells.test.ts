import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import type { KnowledgeNode } from '../../src/model/types'
import type { MatrixDef } from '../../src/composables/useMatrixDefinitions'
import { useMatrixCells } from '../../src/components/editor/composables/useMatrixCells'

function makeNode(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    type: 'text',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
    ...overrides,
  } as KnowledgeNode
}

const MATRIX: MatrixDef = {
  name: 'M1',
  source: 'Src',
  target: 'Tgt',
  widgetType: 'boolean',
  params: '',
}

describe('useMatrixCells', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('matrixCellKey builds the MatrixName||row||col key, and getVal reads the stored value', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', { fields: { 'M1||Src0||Tgt0': { value: 'X' } } as any })
    knowledgeStore.setGraph({ Root: root }, ['Root'])

    const activeMatrix = ref<MatrixDef | null>(MATRIX)
    const rootNode = ref<KnowledgeNode | null>(root)
    const { matrixCellKey, getVal } = useMatrixCells(activeMatrix, rootNode, () => {})

    expect(matrixCellKey('Src0', 'Tgt0')).toBe('M1||Src0||Tgt0')
    expect(getVal('Src0', 'Tgt0')).toBe('X')
    expect(getVal('Src1', 'Tgt1')).toBe('-')
  })

  it('setVal commits the value on the root node and invokes onChange with the key/value', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root')
    knowledgeStore.setGraph({ Root: root }, ['Root'])

    const activeMatrix = ref<MatrixDef | null>(MATRIX)
    const rootNode = ref<KnowledgeNode | null>(root)
    const changes: Array<[string, unknown]> = []
    const { setVal, getVal } = useMatrixCells(activeMatrix, rootNode, (key, value) =>
      changes.push([key, value]),
    )

    setVal('Src0', 'Tgt0', 'X')

    expect(getVal('Src0', 'Tgt0')).toBe('X')
    expect(changes).toEqual([['M1||Src0||Tgt0', 'X']])
  })

  it('valueDistribution counts stored values across the given rows/cols, defaulting missing cells to "-"', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', {
      fields: {
        'M1||Src0||Tgt0': { value: 'X' },
        'M1||Src0||Tgt1': { value: 'X' },
      } as any,
    })
    knowledgeStore.setGraph({ Root: root }, ['Root'])

    const activeMatrix = ref<MatrixDef | null>(MATRIX)
    const rootNode = ref<KnowledgeNode | null>(root)
    const { valueDistribution } = useMatrixCells(activeMatrix, rootNode, () => {})

    expect(
      valueDistribution(
        [{ id: 'Src0', name: 'Src0' }],
        [
          { id: 'Tgt0', name: 'Tgt0' },
          { id: 'Tgt1', name: 'Tgt1' },
          { id: 'Tgt2', name: 'Tgt2' },
        ],
      ),
    ).toEqual({ X: 2, '-': 1 })
  })

  it('valueDistribution uses the exact matrixCellKey() normalization get/set use (E2)', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root')
    knowledgeStore.setGraph({ Root: root }, ['Root'])

    const activeMatrix = ref<MatrixDef | null>(MATRIX)
    const rootNode = ref<KnowledgeNode | null>(root)
    const { setVal, valueDistribution } = useMatrixCells(activeMatrix, rootNode, () => {})

    // setVal stores under the matrixCellKey-normalized form: `–` → `-`.
    setVal('Src–A', 'Tgt–B', 'X')
    setVal('Src–A', 'Tgt–C', 'X')

    expect(Object.keys(root.fields)).toContain('M1||Src-A||Tgt-B')

    // Distribution must use the same normalized key so badge counts agree
    // with the visible cells, even when the display name keeps the `–`.
    expect(
      valueDistribution(
        [{ id: 'Src–A', name: 'Src–A' }],
        [
          { id: 'Tgt–B', name: 'Tgt–B' },
          { id: 'Tgt–C', name: 'Tgt–C' },
          { id: 'Tgt–D', name: 'Tgt–D' },
        ],
      ),
    ).toEqual({ X: 2, '-': 1 })
  })

  it('keys cells by the stable node id, so same-named elements in different parents are independent cells (E1)', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root')
    knowledgeStore.setGraph({ Root: root }, ['Root'])

    const activeMatrix = ref<MatrixDef | null>(MATRIX)
    const rootNode = ref<KnowledgeNode | null>(root)
    const { matrixCellKey, setVal, getVal, valueDistribution } = useMatrixCells(
      activeMatrix,
      rootNode,
      () => {},
    )

    // Two elements with the SAME display name ("Review") under different
    // parents: rows/cols carry {id, name}; the cell key uses the id.
    const rowA = { id: 'doc/Projects/Review', name: 'Review' }
    const rowB = { id: 'doc/Initiatives/Review', name: 'Review' }
    const col = { id: 'doc/Projects/Task', name: 'Task' }

    setVal(rowA.id, col.id, 'X')
    setVal(rowB.id, col.id, 'Y')

    expect(matrixCellKey(rowA.id, col.id)).not.toBe(matrixCellKey(rowB.id, col.id))
    expect(getVal(rowA.id, col.id)).toBe('X')
    expect(getVal(rowB.id, col.id)).toBe('Y')

    // Distribution counts by id, not by display name: two Review rows.
    expect(
      valueDistribution(
        [
          { id: rowA.id, name: rowA.name },
          { id: rowB.id, name: rowB.name },
        ],
        [{ id: col.id, name: col.name }],
      ),
    ).toEqual({ X: 1, Y: 1 })
  })

  it('getSetOptionsList reads declared "values", falling back to parsing "params"', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root')
    knowledgeStore.setGraph({ Root: root }, ['Root'])
    const rootNode = ref<KnowledgeNode | null>(root)

    const withValues = ref<MatrixDef | null>({ ...MATRIX, widgetType: 'set', values: ['A', 'B'] })
    const cellsWithValues = useMatrixCells(withValues, rootNode, () => {})
    expect(cellsWithValues.getSetOptionsList()).toEqual(['A', 'B'])

    const withParams = ref<MatrixDef | null>({ ...MATRIX, widgetType: 'set', params: 'Low;Medium;High' })
    const cellsWithParams = useMatrixCells(withParams, rootNode, () => {})
    expect(cellsWithParams.getSetOptionsList()).toEqual(['Low', 'Medium', 'High'])
  })

  it('isOutOfSetValue flags set-widget values outside the declared options', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root')
    knowledgeStore.setGraph({ Root: root }, ['Root'])
    const rootNode = ref<KnowledgeNode | null>(root)
    const activeMatrix = ref<MatrixDef | null>({ ...MATRIX, widgetType: 'set', values: ['A', 'B'] })
    const { isOutOfSetValue } = useMatrixCells(activeMatrix, rootNode, () => {})

    expect(isOutOfSetValue('A')).toBe(false)
    expect(isOutOfSetValue('Z')).toBe(true)
    expect(isOutOfSetValue('-')).toBe(false)
  })

  it('rotateCycle advances through set options, wrapping to "-" past the last option', () => {
    const knowledgeStore = useKnowledgeStore()
    const root = makeNode('Root', { fields: { 'M1||Src0||Tgt0': { value: 'B' } } as any })
    knowledgeStore.setGraph({ Root: root }, ['Root'])
    const rootNode = ref<KnowledgeNode | null>(root)
    const activeMatrix = ref<MatrixDef | null>({ ...MATRIX, widgetType: 'set', values: ['A', 'B'] })
    const { rotateCycle, getVal } = useMatrixCells(activeMatrix, rootNode, () => {})

    rotateCycle('Src0', 'Tgt0')
    expect(getVal('Src0', 'Tgt0')).toBe('-')
  })
})
