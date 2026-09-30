import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useModelStore } from '../../src/stores/modelStore'
import type { KnowledgeNode } from '../../src/model/types'
import {
  MATRIX_DEFS_KEY,
  readMatrixDefsField,
  readRawMatricesField,
  extractMatrixDefs,
  mergeMatrixDefs,
  useMatrixDefinitions,
} from '../../src/composables/useMatrixDefinitions'

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

describe('MATRIX_DEFS_KEY', () => {
  it('is the literal field key used across all matrix-def consumers', () => {
    expect(MATRIX_DEFS_KEY).toBe('__matrix_defs')
  })
})

describe('readMatrixDefsField', () => {
  it('returns the raw __matrix_defs field array when present', () => {
    const root = makeNode('Root', {
      fields: { __matrix_defs: { value: [{ name: 'M1', source: 'Src', target: 'Tgt' }] } } as any,
    })
    expect(readMatrixDefsField(root)).toEqual([{ name: 'M1', source: 'Src', target: 'Tgt' }])
  })

  it('returns [] when the field is absent', () => {
    const root = makeNode('Root')
    expect(readMatrixDefsField(root)).toEqual([])
  })

  it('returns [] for a null/undefined root', () => {
    expect(readMatrixDefsField(null)).toEqual([])
    expect(readMatrixDefsField(undefined)).toEqual([])
  })
})

describe('readRawMatricesField', () => {
  it('returns the raw matrices frontmatter field array when present', () => {
    const root = makeNode('Root', {
      fields: { matrices: { value: [{ name: 'M2', source: 'A', target: 'B' }] } } as any,
    })
    expect(readRawMatricesField(root)).toEqual([{ name: 'M2', source: 'A', target: 'B' }])
  })

  it('returns [] when the field is absent', () => {
    const root = makeNode('Root')
    expect(readRawMatricesField(root)).toEqual([])
  })
})

// ── extractMatrixDefs: LeftSidebar.vue's fallback strategy ──
describe('extractMatrixDefs (fallback strategy — LeftSidebar.vue)', () => {
  it('returns __matrix_defs verbatim (not normalized) when non-empty', () => {
    const root = makeNode('Root', {
      fields: {
        __matrix_defs: {
          value: [{ name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: '' }],
        },
      } as any,
    })
    const result = extractMatrixDefs(root)
    expect(result).toEqual([{ name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: '' }])
  })

  it('falls back to normalized `matrices` field when __matrix_defs is absent', () => {
    const root = makeNode('Root', {
      fields: { matrices: { value: [{ name: 'M2', source: 'A', target: 'B' }] } } as any,
    })
    const result = extractMatrixDefs(root)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('M2')
    // normalizeMatrixDecl fills in a derived widgetType — proves normalization ran
    expect(result[0].widgetType).toBeDefined()
  })

  it('returns [] when both sources are absent', () => {
    const root = makeNode('Root')
    expect(extractMatrixDefs(root)).toEqual([])
  })
})

// ── mergeMatrixDefs: MatricesGrid.vue's merge strategy ──
describe('mergeMatrixDefs (merge strategy — MatricesGrid.vue)', () => {
  it('normalizes and includes both __matrix_defs and matrices entries', () => {
    const root = makeNode('Root', {
      fields: {
        __matrix_defs: {
          value: [{ name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: '' }],
        },
        matrices: { value: [{ name: 'M2', source: 'A', target: 'B' }] },
      } as any,
    })
    const result = mergeMatrixDefs(root)
    expect(result.map((d) => d.name)).toEqual(['M1', 'M2'])
    expect(result[1].widgetType).toBeDefined()
  })

  it('dedupes by name, __matrix_defs entries win over matrices entries', () => {
    const root = makeNode('Root', {
      fields: {
        __matrix_defs: {
          value: [{ name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: 'from-defs' }],
        },
        matrices: { value: [{ name: 'M1', source: 'X', target: 'Y', params: 'from-matrices' }] },
      } as any,
    })
    const result = mergeMatrixDefs(root)
    expect(result).toHaveLength(1)
    expect(result[0].params).toBe('from-defs')
  })

  it('returns [] when both sources are absent', () => {
    expect(mergeMatrixDefs(makeNode('Root'))).toEqual([])
  })
})

// ── useMatrixDefinitions: multi-root composable wrapper ──
describe('useMatrixDefinitions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('strategy "fallback": aggregates extractMatrixDefs across rootIds, deduped by name (first root wins)', () => {
    const modelStore = useModelStore()
    const rootA = makeNode('A', {
      fields: {
        __matrix_defs: { value: [{ name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: '' }] },
      } as any,
    })
    const rootB = makeNode('B', {
      fields: {
        __matrix_defs: { value: [{ name: 'M1', source: 'X', target: 'Y', widgetType: 'text', params: '' }, { name: 'M2', source: 'X', target: 'Y', widgetType: 'text', params: '' }] },
      } as any,
    })
    modelStore.setGraph({ A: rootA, B: rootB }, ['A', 'B'])

    const rootIds = ref(['A', 'B'])
    const { matrixDefs } = useMatrixDefinitions(rootIds, { strategy: 'fallback' })

    expect(matrixDefs.value.map((d) => d.name)).toEqual(['M1', 'M2'])
    expect(matrixDefs.value[0].source).toBe('Src') // root A's M1 wins over root B's M1
  })

  it('strategy "merge": aggregates mergeMatrixDefs across rootIds, deduped by name', () => {
    const modelStore = useModelStore()
    const rootA = makeNode('A', {
      fields: {
        __matrix_defs: { value: [{ name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: '' }] },
        matrices: { value: [{ name: 'M2', source: 'A', target: 'B' }] },
      } as any,
    })
    modelStore.setGraph({ A: rootA }, ['A'])

    const rootIds = ref(['A'])
    const { matrixDefs } = useMatrixDefinitions(rootIds, { strategy: 'merge' })

    expect(matrixDefs.value.map((d) => d.name)).toEqual(['M1', 'M2'])
  })

  it('defaults to the "fallback" strategy when opts is omitted', () => {
    const modelStore = useModelStore()
    const root = makeNode('A', {
      fields: {
        __matrix_defs: { value: [{ name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: '' }] },
      } as any,
    })
    modelStore.setGraph({ A: root }, ['A'])

    const { matrixDefs } = useMatrixDefinitions(ref(['A']))
    expect(matrixDefs.value).toHaveLength(1)
    // Verbatim (not normalized) proves the fallback strategy ran, not merge
    expect(matrixDefs.value[0]).toEqual({ name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: '' })
  })

  it('getMatrixValueCount counts non-empty/non-dash/non-false cell values across all nodes for a matrix', () => {
    const modelStore = useModelStore()
    const root = makeNode('A', { fields: { __matrix_defs: { value: [] } } as any })
    const cellNode = makeNode('cell', {
      fields: {
        'M1||Src0||Tgt0': { value: 'X' },
        'M1||Src1||Tgt0': { value: '-' },
        'M1||Src2||Tgt0': { value: '' },
        'M1||Src3||Tgt0': { value: false },
        'M1||Src4||Tgt0': { value: 'Y' },
      } as any,
    })
    modelStore.setGraph({ A: root, cell: cellNode }, ['A'])

    const { getMatrixValueCount } = useMatrixDefinitions(ref(['A']))
    expect(getMatrixValueCount('M1')).toBe(2)
  })
})
