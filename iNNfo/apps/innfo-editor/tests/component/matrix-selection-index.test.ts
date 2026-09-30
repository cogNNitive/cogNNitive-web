import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { useUiStore } from '../../src/stores/uiStore'
import {
  mergeMatrixDefs,
  resolveMatrixIndexByName,
} from '../../src/composables/useMatrixDefinitions'
import type { KnowledgeNode } from '../../src/model/types'
import LeftSidebar from '../../src/components/layout/LeftSidebar.vue'
import MatricesGrid from '../../src/components/editor/MatricesGrid.vue'

// Mock the virtualizer so the grid renders without real layout.
vi.mock('@tanstack/vue-virtual', () => ({
  useVirtualizer: vi.fn((optionsOrRef) => {
    const opts =
      typeof optionsOrRef === 'function'
        ? (optionsOrRef as any)()
        : ((optionsOrRef as any)?.value ?? optionsOrRef)
    const isHorizontal = opts?.horizontal ?? false
    const count = opts?.count ?? 0
    const size = isHorizontal ? 120 : 48
    const displayCount = Math.min(count, isHorizontal ? 12 : 25)
    const items = Array.from({ length: displayCount }, (_, i) => ({
      key: i,
      index: i,
      start: i * size,
      size,
      end: (i + 1) * size,
      lane: 0,
    }))
    const virtualizer = {
      getVirtualItems: () => items,
      getTotalSize: () => items.length * size,
      getElement: () => null,
    }
    return { __v_isRef: true, value: virtualizer }
  }),
}))

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

function defs(names: string[]): { value: Array<Record<string, unknown>> } {
  return {
    value: names.map((name) => ({
      name,
      source: 'Src',
      target: 'Tgt',
      widgetType: 'boolean',
      params: '',
    })),
  }
}

/** Mirrors WorkspaceView's wiring of LeftSidebar emits into uiStore. */
function mountSidebar() {
  const uiStore = useUiStore()
  return mount(LeftSidebar, {
    attachTo: document.body,
    attrs: {
      onSelectMatrix: (idx: number) => {
        uiStore.setActiveMatrixIndex(idx)
        uiStore.setActiveView('matrices')
      },
      onSelectView: () => {},
      onSelectNode: () => {},
    },
  })
}

/** Real MatrixPill root elements (excludes count/source-count/target-count sub-elements). */
function realPills(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid^="matrix-pill-"]').filter((p) => {
    const t = p.attributes('data-testid') ?? ''
    return !t.includes('-count-')
  })
}

function sidebarPillNames(wrapper: ReturnType<typeof mount>): string[] {
  return realPills(wrapper).map((p) => (p.attributes('data-testid') ?? '').replace('matrix-pill-', ''))
}

describe('matrix selection index space (sidebar ↔ grid)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('clicking a sidebar pill shows the clicked matrix even when a lower-version root declares extra matrices', async () => {
    // Regression: two versions of the same model. The sidebar (highest version
    // only) used to list [A, B, C] while the grid merged [X, A, B, C], so
    // clicking pill idx=1 rendered the grid's matrixDefs[1] = "A matrix" — the
    // immediately previous pill. Both sides must share one index space.
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()

    const v1 = makeNode('HolaMundo_V_0-0-1_business_NN', {
      kind: 'root',
      source: { path: 'HolaMundo_V_0-0-1_business_NN.md' },
      fields: { __matrix_defs: defs(['X matrix', 'A matrix', 'B matrix']) },
    })
    const v2 = makeNode('HolaMundo_V_0-0-2_business_NN', {
      kind: 'root',
      source: { path: 'HolaMundo_V_0-0-2_business_NN.md' },
      fields: { __matrix_defs: defs(['A matrix', 'B matrix', 'C matrix']) },
    })
    knowledgeStore.setGraph(
      { 'HolaMundo_V_0-0-1_business_NN': v1, 'HolaMundo_V_0-0-2_business_NN': v2 },
      ['HolaMundo_V_0-0-1_business_NN', 'HolaMundo_V_0-0-2_business_NN'],
    )

    const sidebar = mountSidebar()
    // Models start collapsed by default (feature: "collapsed initial state");
    // expand the model header before reaching its nested relations section.
    await sidebar.find('[data-testid="model-header-toggle"]').trigger('click')
    await nextTick()
    await sidebar.find('[data-testid="relations-header"]').trigger('click')
    const pills = realPills(sidebar)
    const names = sidebarPillNames(sidebar)

    // Sidebar pill list reflects active model matrix definitions.
    expect(names).toEqual(['A matrix', 'B matrix', 'C matrix'])

    for (const target of ['A matrix', 'B matrix', 'C matrix']) {
      const idx = names.indexOf(target)
      expect(idx).toBeGreaterThanOrEqual(0)
      await pills[idx].trigger('click')
      await nextTick()
      expect(uiStore.activeMatrixIndex).toBe(resolveMatrixIndexByName(target))

      const grid = mount(MatricesGrid, { props: { matrixIndex: uiStore.activeMatrixIndex } })
      const label = grid.find('[data-testid="matrix-selector"]')
      expect(label.text()).toContain(target)
      grid.unmount()
    }

    sidebar.unmount()
  })

  it('keeps working for a plain single-model workspace', async () => {
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()

    const root = makeNode('Model', {
      kind: 'root',
      fields: { __matrix_defs: defs(['M1', 'M2', 'M3']) },
    })
    const spec = makeNode('spec:business', { kind: 'root', fields: {} })
    knowledgeStore.setGraph({ Model: root, 'spec:business': spec }, ['Model', 'spec:business'])

    const sidebar = mountSidebar()
    // Models start collapsed by default (feature: "collapsed initial state");
    // expand the model header before reaching its nested relations section.
    await sidebar.find('[data-testid="model-header-toggle"]').trigger('click')
    await nextTick()
    await sidebar.find('[data-testid="relations-header"]').trigger('click')
    const pills = realPills(sidebar)
    expect(sidebarPillNames(sidebar)).toEqual(['M1', 'M2', 'M3'])

    await pills[1].trigger('click')
    await nextTick()
    expect(uiStore.activeMatrixIndex).toBe(1)

    const grid = mount(MatricesGrid, { props: { matrixIndex: uiStore.activeMatrixIndex } })
    expect(grid.find('[data-testid="matrix-selector"]').text()).toContain('M2')
    grid.unmount()
    sidebar.unmount()
  })
})

describe('mergeMatrixDefs case-insensitive dedupe', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('dedupes matrix names that differ only by case (template vs model naming)', () => {
    const root = makeNode('Root', {
      fields: {
        __matrix_defs: defs(['Problems-Value propositions Matrix']),
        matrices: defs(['problems-value propositions matrix']),
      },
    })
    const merged = mergeMatrixDefs(root)
    expect(merged.map((d) => d.name)).toEqual(['Problems-Value propositions Matrix'])
  })
})

describe('resolveMatrixIndexByName', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resolves a name against the merged list across all roots', () => {
    const knowledgeStore = useKnowledgeStore()
    const v1 = makeNode('A', { kind: 'root', fields: { __matrix_defs: defs(['X matrix']) } })
    const v2 = makeNode('B', { kind: 'root', fields: { __matrix_defs: defs(['A matrix', 'B matrix']) } })
    knowledgeStore.setGraph({ A: v1, B: v2 }, ['A', 'B'])

    expect(resolveMatrixIndexByName('X matrix')).toBe(0)
    expect(resolveMatrixIndexByName('B matrix')).toBe(2)
    expect(resolveMatrixIndexByName('Missing')).toBe(-1)
  })
})
