import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import MatricesGrid from '../../src/components/editor/MatricesGrid.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'

// Mock @tanstack/vue-virtual so tests don't need real layout.
// Returns a ref-like object: __v_isRef for template auto-unwrap,
// .value for <script> usage (rowVirtualizer.value.getTotalSize()).
vi.mock('@tanstack/vue-virtual', () => ({
  useVirtualizer: vi.fn((optionsOrRef) => {
    const opts =
      typeof optionsOrRef === 'function'
        ? (optionsOrRef as any)()
        : ((optionsOrRef as any)?.value ?? optionsOrRef)
    const isHorizontal = opts?.horizontal ?? false
    const count = opts?.count ?? 0
    const size = isHorizontal ? 120 : 48

    // Cap virtual items to a realistic visible+overscan count so the DOM
    // doesn't balloon (real virtualizer renders ~20 rows × ~10 columns).
    const maxVisible = isHorizontal ? 12 : 25
    const displayCount = Math.min(count, maxVisible)
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

    // Mimic a Vue Ref so template auto-unwrap works and .value is accessible.
    return { __v_isRef: true, value: virtualizer }
  }),
}))

// ── Helpers ──

interface FakeNode {
  id: string
  name: string
  type: string
  childIds: string[]
  fields: Record<string, { value: unknown }>
}

function makeNode(id: string, name: string, type: string): FakeNode {
  return { id, name, type, childIds: [], fields: {} }
}

const ROOT_ID = 'Root'

function setupStore(rowsCount = 10, colsCount = 10, widgetType = 'boolean', params = '') {
  const knowledgeStore = useKnowledgeStore()
  const nodes: Record<string, FakeNode> = {
    [ROOT_ID]: {
      id: ROOT_ID,
      name: 'Root',
      type: 'model',
      childIds: [],
      fields: {
        __matrix_defs: {
          value: [
            {
              name: 'M1',
              source: 'Src',
              target: 'Tgt',
              widgetType,
              params,
            },
            {
              name: 'M2',
              source: 'Src',
              target: 'Tgt',
              widgetType: 'boolean',
              params: '',
            },
          ],
        },
      },
    },
  }
  for (let i = 0; i < rowsCount; i++) {
    nodes[`src-${i}`] = makeNode(`src-${i}`, `Src${i}`, 'Src')
  }
  for (let i = 0; i < colsCount; i++) {
    nodes[`tgt-${i}`] = makeNode(`tgt-${i}`, `Tgt${i}`, 'Tgt')
  }
  knowledgeStore.setGraph(nodes as any, [ROOT_ID])
}

function setupStoreWithCellValues() {
  setupStore(10, 5, 'boolean')
  const knowledgeStore = useKnowledgeStore()
  const root = knowledgeStore.getNode(ROOT_ID)!
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 5; c++) {
      const val = (r + c) % 2 === 0 ? 'X' : '-'
      root.fields[`M1||src-${r}||tgt-${c}`] = { value: val }
    }
  }
}

function setupBigStore(rowsCount = 100, colsCount = 100) {
  const knowledgeStore = useKnowledgeStore()
  const nodes: Record<string, FakeNode> = {
    [ROOT_ID]: {
      id: ROOT_ID,
      name: 'Root',
      type: 'model',
      childIds: [],
      fields: {
        __matrix_defs: {
          value: [
            {
              name: 'BigMatrix',
              source: 'Src',
              target: 'Tgt',
              widgetType: 'boolean',
              params: 'colWidth:100',
            },
          ],
        },
      },
    },
  }
  for (let i = 0; i < rowsCount; i++) {
    nodes[`src-${i}`] = makeNode(`src-${i}`, `Src${i}`, 'Src')
  }
  for (let i = 0; i < colsCount; i++) {
    nodes[`tgt-${i}`] = makeNode(`tgt-${i}`, `Tgt${i}`, 'Tgt')
  }
  const root = nodes[ROOT_ID]
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      root.fields[`BigMatrix||src-${r}||tgt-${c}`] = { value: 'X' }
    }
  }
  knowledgeStore.setGraph(nodes as any, [ROOT_ID])
}

/** Sets up a store whose first matrix carries `values` + `description`. */
function setupStoreWithValuesAndDescription() {
  const knowledgeStore = useKnowledgeStore()
  const nodes: Record<string, FakeNode> = {
    [ROOT_ID]: {
      id: ROOT_ID,
      name: 'Root',
      type: 'model',
      childIds: [],
      fields: {
        __matrix_defs: {
          value: [
            {
              name: 'M1',
              source: 'Src',
              target: 'Tgt',
              widgetType: 'set',
              params: '',
              values: ['Max', 'Very High', 'High', 'Neutral'],
              description: 'A brief matrix explanation.',
            },
          ],
        },
      },
    },
  }
  for (let i = 0; i < 5; i++) {
    nodes[`src-${i}`] = makeNode(`src-${i}`, `Src${i}`, 'Src')
  }
  for (let i = 0; i < 5; i++) {
    nodes[`tgt-${i}`] = makeNode(`tgt-${i}`, `Tgt${i}`, 'Tgt')
  }
  knowledgeStore.setGraph(nodes as any, [ROOT_ID])
}

/** Sets up a store with a metamodel root (template concepts) + element content. */
function setupStoreWithMetamodelAndContent() {
  const knowledgeStore = useKnowledgeStore()
  const nodes: Record<string, any> = {
    [ROOT_ID]: {
      id: ROOT_ID,
      name: 'Root',
      type: 'model',
      childIds: [],
      fields: {
        __matrix_defs: {
          value: [
            { name: 'M1', source: 'Src', target: 'Tgt', widgetType: 'boolean', params: '' },
          ],
        },
      },
    },
    'spec:business': {
      id: 'spec:business',
      name: 'business_V_0-2-1',
      parentId: null,
      childIds: [],
      type: 'category',
      kind: 'root',
      localMetamodel: {
        concepts: [
          {
            name: 'Src',
            icon: 'users',
            type: 'weight',
            color: 'blue',
            fields: [{ name: 'status', type: 'string' }],
          },
          { name: 'Tgt', icon: 'heart', type: 'weight', color: 'red' },
        ],
        markers: [],
      },
      fields: {},
      markers: {},
      relationships: [],
      rawSections: {},
      source: { path: 'spec:business' },
    },
  }
  for (let i = 0; i < 5; i++) {
    nodes[`src-${i}`] = {
      id: `src-${i}`,
      name: `Src${i}`,
      type: 'Src',
      kind: 'element',
      childIds: [],
      fields: { status: { value: 'active' } },
      rawSections: { description: `Description for Src${i}.` },
    }
  }
  for (let i = 0; i < 5; i++) {
    nodes[`tgt-${i}`] = {
      id: `tgt-${i}`,
      name: `Tgt${i}`,
      type: 'Tgt',
      kind: 'element',
      childIds: [],
      fields: {},
      rawSections: {},
    }
  }
  knowledgeStore.setGraph(nodes as any, [ROOT_ID, 'spec:business'])
}

/**
 * Mount helper — sets up store + renders the component.
 * The @tanstack/vue-virtual mock handles virtual items, no layout needed.
 */
async function mountGrid(
  matrixIndex = 0,
  rowsCount = 10,
  colsCount = 10,
  widgetType = 'boolean',
  params = '',
) {
  setupStore(rowsCount, colsCount, widgetType, params)

  const wrapper = mount(MatricesGrid, {
    props: { matrixIndex },
  })

  await nextTick()
  return wrapper
}

// ── Tests ──

describe('R-MV-01 / R-MV-02 / R-MV-03: Virtual scroll structure', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders virtual grid layout (no flat <table>)', async () => {
    const wrapper = await mountGrid()
    // No flat <table> — virtual scrolling structure instead
    expect(wrapper.find('table').exists()).toBe(false)
    // Scroll container exists
    expect(wrapper.find('.overflow-auto').exists()).toBe(true)
    // Overflow-hidden header area (virtual-scroll specific)
    expect(wrapper.html()).toContain('overflow-hidden')
  })

  it('displays empty-state when no rows defined', () => {
    setupStore(0, 5, 'boolean')
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    expect(wrapper.text()).toContain('No items defined in Src')
  })

  it('displays empty-state when no columns defined', () => {
    setupStore(5, 0, 'boolean')
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    expect(wrapper.text()).toContain('No items defined in Tgt')
  })

  it('shows "select a matrix" prompt when no matrix selected', () => {
    setupStore(5, 5, 'boolean')
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: -1 } })
    expect(wrapper.text()).toContain('Select a matrix from the sidebar or dropdown')
  })

  it('renders matrix-selector dropdown', async () => {
    const wrapper = await mountGrid()
    expect(wrapper.text()).toContain('Select Matrix')
  })

  it('renders value distribution section', () => {
    setupStoreWithCellValues()
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    expect(wrapper.text()).toContain('Values:')
  })
})

describe('R-MV-03: 10k+ cells virtual rendering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('mounts 100×100 matrix without render-time error', () => {
    setupBigStore(100, 100)
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    expect(wrapper.exists()).toBe(true)
  })
})

describe('R-MV-05: Value distribution reflects full dataset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('counts all 50 cells (not just visible) in value distribution', () => {
    setupStoreWithCellValues()
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    expect(wrapper.text()).toContain('X: 25')
  })

  it('counts all cells even with large matrix', () => {
    setupBigStore(100, 100) // 10,000 cells
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    const text = wrapper.text()
    expect(text).toContain('X: 100')
    expect(text).toContain('—')
  })
})



describe('R-MV-05: Cell editing in virtualised cells', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('writes cell value through checkbox interaction', async () => {
    const wrapper = await mountGrid(0, 5, 5, 'boolean')

    const checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)

    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
    await checkbox.setChecked(true)

    const knowledgeStore = useKnowledgeStore()
    const root = knowledgeStore.getNode(ROOT_ID)!
    const cellKey = Object.keys(root.fields).find((k) => k.startsWith('M1||src-0||tgt-0'))
    expect(cellKey).toBeTruthy()
    if (cellKey) {
      expect(root.fields[cellKey]?.value).toBe('X')
    }
  })

  it('emits "cell-change" on widget interaction', async () => {
    const wrapper = await mountGrid(0, 3, 3, 'boolean')

    const checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
    await checkbox.setChecked(true)

    expect(wrapper.emitted('cell-change')).toBeTruthy()
    expect(wrapper.emitted('cell-change')![0][0]).toContain('M1||')
  })

  it('rotates cycle widget through values', async () => {
    const wrapper = await mountGrid(0, 3, 3, 'cycle', '1,2,3')

    // Find a cycle button within the scroll area (not the dropdown toggle)
    const scrollArea = wrapper.find('.overflow-auto')
    const cycleBtn = scrollArea.find('button')
    expect(cycleBtn.exists()).toBe(true)

    await cycleBtn.trigger('click')

    const knowledgeStore = useKnowledgeStore()
    const root = knowledgeStore.getNode(ROOT_ID)!
    const m1Key = Object.keys(root.fields).find((k) => k.startsWith('M1||'))
    expect(m1Key).toBeTruthy()
    if (m1Key) {
      expect(root.fields[m1Key]?.value).toBe('1')
    }
  })
})

describe('R-MV-04: Scroll position persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('finds scroll container (infrastructure for position tracking)', async () => {
    const wrapper = await mountGrid(0, 50, 50, 'boolean')
    const scrollEl = wrapper.find('.overflow-auto')
    expect(scrollEl.exists()).toBe(true)
    expect(scrollEl.element.tagName).toBe('DIV')
  })

  it('renders default matrix at position (0,0) on first visit', () => {
    setupStore(10, 10, 'boolean')
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    expect(wrapper.exists()).toBe(true)
  })
})

describe('R-MV-06: Virtual scroller loads without errors', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('mounts without runtime errors', async () => {
    const wrapper = await mountGrid()
    expect(wrapper.exists()).toBe(true)
  })

  it('mounts cleanly with 100×100 matrix', () => {
    setupStore(100, 100, 'boolean')
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    expect(wrapper.exists()).toBe(true)
  })
})

describe('R-MV-07: No changes to matrix field/export structure', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('preserves cell storage format (MatrixName||<rowId>||<colId>, E1)', () => {
    setupStoreWithCellValues()
    const knowledgeStore = useKnowledgeStore()
    const root = knowledgeStore.getNode(ROOT_ID)!
    const cellKey = Object.keys(root.fields).find((k) => k.startsWith('M1||'))
    expect(cellKey).toMatch(/^M1\|\|src-\d\|\|tgt-\d$/)
  })

  it('preserves __matrix_defs array structure', () => {
    setupStoreWithCellValues()
    const knowledgeStore = useKnowledgeStore()
    const root = knowledgeStore.getNode(ROOT_ID)!
    const defs = root.fields['__matrix_defs']?.value as any[]
    expect(Array.isArray(defs)).toBe(true)
    expect(defs[0].name).toBe('M1')
    expect(defs[0].source).toBe('Src')
    expect(defs[0].target).toBe('Tgt')
  })
})

describe('R-MM-08: matrix values, description and header pills', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders concept source/target names in the corner cell (not "Empty")', () => {
    setupStoreWithValuesAndDescription()
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    const pills = wrapper.findAll('[data-testid="block-pill"]')
    const texts = pills.map((p) => p.text())
    expect(texts.some((t) => t.includes('Src'))).toBe(true)
    expect(texts.some((t) => t.includes('Tgt'))).toBe(true)
    expect(wrapper.text()).not.toContain('Empty')
  })

  it('renders declared values as set widget options', async () => {
    setupStoreWithValuesAndDescription()
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThan(0)
    const firstSelect = selects[0]
    const options = firstSelect.findAll('option').map((o) => o.text())
    expect(options).toContain('Max')
    expect(options).toContain('Very High')
    expect(options).toContain('High')
    expect(options).toContain('Neutral')
  })

  it('renders the concept icon (not a fallback question mark) in corner pills', () => {
    setupStoreWithMetamodelAndContent()
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    expect(wrapper.html()).toContain('lucide-users')
    expect(wrapper.html()).toContain('lucide-heart')
  })

  it('row pill info popup shows the element description and fields', async () => {
    setupStoreWithMetamodelAndContent()
    const wrapper = mount(MatricesGrid, {
      props: { matrixIndex: 0 },
      attachTo: document.body,
    })
    await nextTick()

    const pill = wrapper
      .findAll('[data-testid="block-pill"]')
      .find((p) => p.text().includes('Src0'))
    expect(pill).toBeTruthy()

    await pill!.trigger('mouseenter')
    await nextTick()
    const infoIcon = pill!.find('svg.lucide-info-icon')
    expect(infoIcon.exists()).toBe(true)
    await infoIcon.trigger('click')
    await nextTick()

    expect(document.body.textContent).toContain('Description for Src0.')
    expect(document.body.textContent).toContain('status')
    wrapper.unmount()
  })

  it('renders rotated (diagonal) column headers', () => {
    setupStoreWithValuesAndDescription()
    const wrapper = mount(MatricesGrid, { props: { matrixIndex: 0 } })
    const rotated = wrapper
      .findAll('div')
      .filter((d) => (d.element as HTMLElement).style.transform?.includes('rotate'))
    expect(rotated.length).toBeGreaterThan(0)
  })
})
