<template>
  <div data-testid="matrices-grid" class="flex-1 flex flex-col min-h-0">
    <!-- Matrix Dropdown Selector Header -->
    <div class="flex items-center justify-between gap-3 shrink-0 pb-2 mb-2 w-full">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0"
          >Select Matrix:</span
        >
        <div v-if="matrixDefs.length" ref="dropdownRef" class="relative flex-1 min-w-0">
          <button
            @click="isOpen = !isOpen"
            class="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs hover:border-slate-300 dark:hover:border-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer transition-all"
            data-testid="matrix-selector"
          >
            <span class="truncate min-w-0 flex-1 text-left">{{
              activeMatrix ? activeMatrix.name : 'Select Matrix'
            }}</span>
            <ChevronDown
              class="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200"
              :class="{ 'rotate-180': isOpen }"
            />
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isOpen"
            class="absolute left-0 right-0 z-20 mt-1 min-w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1 max-h-60 overflow-y-auto"
          >
            <MatrixPill
              v-for="(matrix, idx) in matrixDefs"
              :key="matrix.name"
              :name="matrix.name"
              :source="matrix.source"
              :target="matrix.target"
              :label="matrix.label"
              :description="matrix.description"
              :value-count="getMatrixValueCount(matrix.name)"
              :selected="activeMatrixIndex === idx"
              :full-width="true"
              interactive
              show-source-target
              as="button"
              @click="selectMatrix(idx)"
            />
          </div>
        </div>
        <div v-else class="text-slate-400 dark:text-slate-500 text-xs italic">
          No relational matrices defined. Define them in Metamatrix Config.
        </div>
      </div>

      <div v-if="activeMatrix" class="text-slate-400 dark:text-slate-500 text-xs font-medium">
        Total: {{ matrixDefs.length }} matrices
      </div>
    </div>

    <!-- When no matrix is selected, show a prompt -->
    <div v-if="activeMatrixIndex < 0" class="flex-1 flex items-center justify-center">
      <div class="text-slate-400 dark:text-slate-500 text-xs italic text-center">
        Select a matrix from the sidebar or dropdown to begin.
      </div>
    </div>

    <!-- Active Matrix View -->
    <div v-else-if="activeMatrix" class="flex-1 flex flex-col min-h-0">
      <!-- Value Distribution Card -->
      <div
        v-if="Object.keys(valueDistribution).length > 0"
        class="mb-2 flex items-center gap-1.5 flex-wrap text-xs"
      >
        <span
          class="font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0"
          >Values:</span
        >
        <span
          v-for="(count, value) in valueDistribution"
          :key="value"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold border"
          :class="getDistClasses(value)"
        >
          {{ value === '-' ? '\u2014' : value }}: {{ count }}
        </span>
      </div>

      <!-- Virtual Scrolling Grid -->
      <div
        class="border border-slate-200 dark:border-slate-700 rounded-lg flex-1 flex flex-col overflow-hidden min-h-0"
      >
        <!-- ── Header Row (sticky column labels) ── -->
        <div
          class="flex shrink-0 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60"
        >
          <!-- Corner cell -->
          <div
            class="shrink-0 relative border-r border-slate-200 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] overflow-hidden bg-slate-50/40 dark:bg-slate-900/20"
            :style="{
              width: FIRST_COL_WIDTH + 'px',
              minWidth: FIRST_COL_WIDTH + 'px',
              height: headerHeight + 'px',
            }"
          >
            <!-- Diagonal slash line -->
            <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
              <svg
                class="w-full h-full text-slate-200 dark:text-slate-700/80"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" stroke-width="0.75" />
              </svg>
            </div>

            <!-- Top-Right: Columns (Target Concept) -->
            <div
              class="absolute top-2.5 right-3 flex items-center gap-1.5 max-w-[70%] justify-end select-none"
            >
              <span
                class="truncate font-semibold tracking-wide text-slate-600 dark:text-slate-300"
                >{{ activeMatrix.target }}</span
              >
              <IconRenderer
                v-if="getConceptMeta(activeMatrix.target).icon"
                :icon="getConceptMeta(activeMatrix.target).icon"
                custom-class="shrink-0 w-3.5 h-3.5"
                :style="{ color: getConceptMeta(activeMatrix.target).color }"
              />
            </div>

            <!-- Bottom-Left: Rows (Source Concept) -->
            <div
              class="absolute bottom-2.5 left-3 flex items-center gap-1.5 max-w-[70%] select-none"
            >
              <IconRenderer
                v-if="getConceptMeta(activeMatrix.source).icon"
                :icon="getConceptMeta(activeMatrix.source).icon"
                custom-class="shrink-0 w-3.5 h-3.5"
                :style="{ color: getConceptMeta(activeMatrix.source).color }"
              />
              <span
                class="truncate font-semibold tracking-wide text-slate-600 dark:text-slate-300"
                >{{ activeMatrix.source }}</span
              >
            </div>
          </div>
          <!-- Column header virtual scroll overlay -->
          <div class="overflow-visible flex-1 relative" style="scrollbar-width: none">
            <div
              v-if="columns.length"
              :style="{
                height: headerHeight + 'px',
                position: 'relative',
                width: colTotalSize + 'px',
              }"
            >
              <div
                v-for="vCol in colVirtualizer.getVirtualItems()"
                :key="'hc-' + String(vCol.key)"
                class="absolute top-0 overflow-visible border-r border-slate-100 dark:border-slate-800 text-xs"
                :style="{
                  left: 0,
                  width: colWidth + 'px',
                  height: headerHeight + 'px',
                  transform: 'translateX(' + (vCol.start - scrollLeft) + 'px)',
                }"
              >
                <div
                  class="absolute bottom-2.5 whitespace-nowrap"
                  :style="{
                    left: '50%',
                    transform: 'rotate(' + HEADER_LABEL_ROTATION + 'deg)',
                    transformOrigin: '0 100%',
                  }"
                >
                  <Pill
                    kind="instance"
                    :concept-type="activeMatrix.target"
                    :name="columns[vCol.index].name"
                    :interactive="true"
                    :block-id="columns[vCol.index].id"
                    :node-id="columns[vCol.index].id"
                    :description="getNodeDescription(columns[vCol.index].id)"
                    :fields="getNodeFields(columns[vCol.index].id)"
                    :concept-fields="getConceptFields(activeMatrix.target)"
                    hide-empty
                    shape="pill"
                    no-wrap
                  />
                </div>
              </div>
            </div>
            <div
              v-else
              class="px-3 py-3 text-center font-bold text-slate-400 dark:text-slate-500 text-xs"
            >
              No items defined in {{ activeMatrix.target }}
            </div>
          </div>
        </div>

        <!-- ── Body (first column + scrollable grid) ── -->
        <div class="flex flex-1 min-h-0">
          <!-- First column (row labels, synced with vertical scroll) -->
          <div
            class="shrink-0 overflow-hidden border-r border-slate-200 dark:border-slate-700 relative"
            :style="{ width: FIRST_COL_WIDTH + 'px' }"
          >
            <div v-if="rows.length" :style="{ height: rowTotalSize + 'px', position: 'relative' }">
              <div
                v-for="vRow in rowVirtualizer.getVirtualItems()"
                :key="'row-' + String(vRow.key)"
                class="absolute left-0 right-0 flex items-center px-2 py-1 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs text-xs"
                :style="{
                  top: 0,
                  height: ROW_HEIGHT + 'px',
                  transform: 'translateY(' + (vRow.start - scrollTop) + 'px)',
                }"
              >
                <Pill
                  kind="instance"
                  :concept-type="activeMatrix.source"
                  :name="rows[vRow.index].name"
                  :interactive="true"
                  :block-id="rows[vRow.index].id"
                  :node-id="rows[vRow.index].id"
                  :description="getNodeDescription(rows[vRow.index].id)"
                  :fields="getNodeFields(rows[vRow.index].id)"
                  :concept-fields="getConceptFields(activeMatrix.source)"
                  hide-empty
                  :full-width="true"
                  :lines="2"
                />
              </div>
            </div>
            <div v-else class="text-center text-slate-400 dark:text-slate-500 text-xs italic py-6">
              No items defined in {{ activeMatrix.source }}
            </div>
          </div>

          <!-- Scrollable grid (both axes) with sticky first row/col via layout sync -->
          <div ref="scrollRef" class="flex-1 overflow-auto" @scroll="onMatrixScroll">
            <div
              v-if="rows.length && columns.length"
              :style="{
                height: rowTotalSize + 'px',
                width: colTotalSize + 'px',
                position: 'relative',
              }"
            >
              <div
                v-for="vRow in rowVirtualizer.getVirtualItems()"
                :key="'br-' + String(vRow.key)"
                class="absolute"
                :style="{
                  top: 0,
                  height: ROW_HEIGHT + 'px',
                  transform: 'translateY(' + vRow.start + 'px)',
                }"
              >
                <div
                  v-for="vCol in colVirtualizer.getVirtualItems()"
                  :key="'bc-' + String(vRow.key) + '-' + String(vCol.key)"
                  class="absolute flex items-center justify-center px-2 py-2 border-r border-b border-slate-100 dark:border-slate-800"
                  :class="getHeatmapClasses(rows[vRow.index].id, columns[vCol.index].id)"
                  :style="{
                    left: 0,
                    width: colWidth + 'px',
                    height: ROW_HEIGHT + 'px',
                    transform: 'translateX(' + vCol.start + 'px)',
                  }"
                >
                  <!-- 1. Widget Boolean Checkbox -->
                  <div
                    v-if="activeMatrix.widgetType === 'boolean'"
                    class="flex items-center justify-center"
                  >
                    <input
                      type="checkbox"
                      :checked="
                        getVal(rows[vRow.index].id, columns[vCol.index].id) !== '-' &&
                        getVal(rows[vRow.index].id, columns[vCol.index].id) !== '' &&
                        getVal(rows[vRow.index].id, columns[vCol.index].id) !== false
                      "
                      @change="
                        setVal(
                          rows[vRow.index].id,
                          columns[vCol.index].id,
                          ($event.target as HTMLInputElement).checked ? 'X' : '-',
                        )
                      "
                      class="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  <!-- 2. Widget Cycle Buttons -->
                  <button
                    v-else-if="activeMatrix.widgetType === 'cycle'"
                    @click="rotateCycle(rows[vRow.index].id, columns[vCol.index].id)"
                    :class="[
                      getCycleBgColor(getVal(rows[vRow.index].id, columns[vCol.index].id)),
                      'px-2 py-1 rounded border text-xs font-bold w-full transition-all cursor-pointer',
                    ]"
                  >
                    {{
                      getVal(rows[vRow.index].id, columns[vCol.index].id) === '-'
                        ? ''
                        : getVal(rows[vRow.index].id, columns[vCol.index].id)
                    }}
                  </button>

                  <!-- 3. Widget Rating Scale -->
                  <select
                    v-else-if="activeMatrix.widgetType === 'scale'"
                    :value="
                      getVal(rows[vRow.index].id, columns[vCol.index].id) === '-'
                        ? ''
                        : getVal(rows[vRow.index].id, columns[vCol.index].id)
                    "
                    @change="
                      setVal(
                        rows[vRow.index].id,
                        columns[vCol.index].id,
                        ($event.target as HTMLSelectElement).value || '-',
                      )
                    "
                    class="border rounded px-1.5 py-1 text-xs w-full text-center outline-none focus:ring-1 focus:ring-primary border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-300"
                  >
                    <option value="">-</option>
                    <option
                      v-if="isOutOfSetValue(getVal(rows[vRow.index].id, columns[vCol.index].id))"
                      :value="String(getVal(rows[vRow.index].id, columns[vCol.index].id))"
                    >
                      {{ getVal(rows[vRow.index].id, columns[vCol.index].id) }}
                    </option>
                    <option v-for="num in scaleRange" :key="num" :value="num">{{ num }}</option>
                  </select>

                  <!-- 4. Widget Custom Set Options -->
                  <select
                    v-else-if="activeMatrix.widgetType === 'set'"
                    :value="
                      getVal(rows[vRow.index].id, columns[vCol.index].id) === '-'
                        ? ''
                        : getVal(rows[vRow.index].id, columns[vCol.index].id)
                    "
                    @change="
                      setVal(
                        rows[vRow.index].id,
                        columns[vCol.index].id,
                        ($event.target as HTMLSelectElement).value || '-',
                      )
                    "
                    class="border rounded px-1.5 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-300"
                  >
                    <option value="">-</option>
                    <option
                      v-if="isOutOfSetValue(getVal(rows[vRow.index].id, columns[vCol.index].id))"
                      :value="String(getVal(rows[vRow.index].id, columns[vCol.index].id))"
                    >
                      {{ getVal(rows[vRow.index].id, columns[vCol.index].id) }}
                    </option>
                    <option v-for="opt in getSetOptionsList()" :key="opt" :value="opt">
                      {{ opt }}
                    </option>
                  </select>

                  <!-- 5. Widget Free Text -->
                  <input
                    v-else-if="activeMatrix.widgetType === 'text'"
                    type="text"
                    :maxlength="textMaxLength"
                    :value="
                      getVal(rows[vRow.index].id, columns[vCol.index].id) === '-'
                        ? ''
                        : getVal(rows[vRow.index].id, columns[vCol.index].id)
                    "
                    @input="
                      setVal(
                        rows[vRow.index].id,
                        columns[vCol.index].id,
                        ($event.target as HTMLInputElement).value || '-',
                      )
                    "
                    placeholder="-"
                    class="border rounded px-1.5 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-300"
                  />
                </div>
              </div>
            </div>
            <div
              v-else-if="!rows.length"
              class="text-center text-slate-400 dark:text-slate-500 text-xs italic py-6"
            >
              No items defined in {{ activeMatrix.source }}. Make sure to add items to the hierarchy
              tree.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { ChevronDown } from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useUiStore } from '../../stores/uiStore'
import Pill from './Pill.vue'
import MatrixPill from './MatrixPill.vue'
import IconRenderer from './IconRenderer.vue'
import { extractMatrixDefs, useMatrixDefinitions } from '../../composables/useMatrixDefinitions'
import { getConceptMeta } from '../../composables/useConceptVisuals'
import { useMatrixCells } from './composables/useMatrixCells'
import {
  getCycleBgColor,
  getDistClasses,
  getHeatmapClasses as getHeatmapClassesForValue,
} from './composables/useMatrixColors'

// ── Constants ──
const ROW_HEIGHT = 56
const HEADER_LABEL_ROTATION = -45
const FIRST_COL_WIDTH = 180
const MIN_COL_WIDTH = 48
const OVERSCAN = 3

const props = defineProps<{
  matrixIndex: number
}>()

const emit = defineEmits<{
  'cell-change': [cellKey: string, value: unknown]
}>()

const knowledgeStore = useKnowledgeStore()

// ── Matrix definitions stored on root node fields ──
const rootIds = computed(() => knowledgeStore.rootIds)
const { matrixDefs, getMatrixValueCount } = useMatrixDefinitions(rootIds, { strategy: 'merge' })

const rootNode = computed(() => {
  if (knowledgeStore.rootIds.length === 0) return null
  if (activeMatrix.value) {
    const matrixName = activeMatrix.value.name
    for (const id of knowledgeStore.rootIds) {
      const r = knowledgeStore.getNode(id)
      if (!r) continue
      const defs = extractMatrixDefs(r)
      if (defs.some((d: any) => d.name === matrixName)) {
        return r
      }
    }
  }
  const nonSpecId = knowledgeStore.rootIds.find((id) => !id.startsWith('spec:'))
  return knowledgeStore.getNode(nonSpecId || knowledgeStore.rootIds[0])
})

const activeMatrixIndex = ref(props.matrixIndex)
watch(
  () => props.matrixIndex,
  (idx) => {
    activeMatrixIndex.value = idx
  },
)

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const selectMatrix = (idx: number) => {
  activeMatrixIndex.value = idx
  isOpen.value = false
  useUiStore().setActiveMatrixIndex(idx)
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const activeMatrix = computed(() => {
  if (matrixDefs.value.length === 0) return null
  if (activeMatrixIndex.value < 0) return null
  return matrixDefs.value[activeMatrixIndex.value]
})

// ── Derive rows/cols from knowledgeStore nodes by concept type ──
// Rows/columns carry `{ id, name }`: the cell key uses the stable node id so
// that two same-named elements in different parents resolve to independent
// cells (E1). Display (Pill, labels) uses `.name`.
const rows = computed(() => {
  if (!activeMatrix.value) return []
  const source = activeMatrix.value.source
  return Object.values(knowledgeStore.nodes)
    .filter((n) => n.type === source)
    .map((n) => ({ id: n.id, name: n.name }))
})

const columns = computed(() => {
  if (!activeMatrix.value) return []
  const target = activeMatrix.value.target
  return Object.values(knowledgeStore.nodes)
    .filter((n) => n.type === target)
    .map((n) => ({ id: n.id, name: n.name }))
})

// ── Column width from params (default 120px) ──
const colWidth = computed(() => {
  if (!activeMatrix.value) return MIN_COL_WIDTH
  const params = activeMatrix.value.params
  const match = params?.match(/colWidth:(\d+)/)
  const w = match ? parseInt(match[1]) : 120
  return Math.max(w, MIN_COL_WIDTH)
})

// ── Free-text widget max length from widget_config.max_length ──
const textMaxLength = computed(() => {
  const raw = activeMatrix.value?.widgetConfig?.max_length
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
})

// ── Adaptive header height: sized so the widest rotated column pill fits ──
const headerHeight = computed(() => {
  const longest = columns.value.reduce((a, b) => (b.name.length > a.name.length ? b : a), columns.value[0] ?? { name: '' })
  const estPillWidth = longest.name.length * 6.6 + 34
  const needed = Math.ceil((estPillWidth + 26) / Math.SQRT2) + 12
  return Math.min(Math.max(needed, 72), 200)
})

const {
  matrixCellKey,
  getVal,
  setVal,
  valueDistribution: valueDistributionFor,
  getSetOptionsList,
  isOutOfSetValue,
  rotateCycle,
  scaleRange,
} = useMatrixCells(activeMatrix, rootNode, (key, value) => emit('cell-change', key, value))

// ── Virtual Scroller Setup ──
const scrollRef = ref<HTMLElement | null>(null)
const scrollLeft = ref(0)
const scrollTop = ref(0)

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })),
)

const colVirtualizer = useVirtualizer(
  computed(() => ({
    horizontal: true,
    count: columns.value.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => colWidth.value,
    overscan: OVERSCAN,
  })),
)

const colTotalSize = computed(() => colVirtualizer.value.getTotalSize())
const rowTotalSize = computed(() => rowVirtualizer.value.getTotalSize())

// ── Scroll position tracking per matrix ──
const scrollPositions = new Map<string, { scrollTop: number; scrollLeft: number }>()

function onMatrixScroll() {
  const el = scrollRef.value
  if (!el) return
  scrollLeft.value = el.scrollLeft
  scrollTop.value = el.scrollTop

  if (activeMatrixIndex.value < 0) return
  const name = matrixDefs.value[activeMatrixIndex.value]?.name
  if (name) {
    scrollPositions.set(name, { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft })
  }
}

// Save/restore scroll position on matrix switch
watch(activeMatrixIndex, (newIdx, oldIdx) => {
  const el = scrollRef.value
  if (!el) return

  const defs = matrixDefs.value

  // Save old position
  if (oldIdx >= 0 && oldIdx < defs.length) {
    scrollPositions.set(defs[oldIdx].name, {
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
    })
  }

  // Restore or reset new position
  if (newIdx >= 0 && newIdx < defs.length) {
    const pos = scrollPositions.get(defs[newIdx].name)
    nextTick(() => {
      if (scrollRef.value) {
        scrollRef.value.scrollTop = pos?.scrollTop ?? 0
        scrollRef.value.scrollLeft = pos?.scrollLeft ?? 0
      }
    })
  }
})

// ── Value distribution iterates ALL cells, not just visible ──
const valueDistribution = computed(() => valueDistributionFor(rows.value, columns.value))

// ── Heatmap classes for a cell: resolve its value, then classify it ──
function getHeatmapClasses(row: string, col: string): string {
  return getHeatmapClassesForValue(getVal(row, col))
}

// ── Node + concept metadata for header pills ───────────────────

const getNodeById = (id: string) => knowledgeStore.nodes[id]

const getNodeDescription = (id: string): string => {
  return getNodeById(id)?.rawSections?.description ?? ''
}

/** Unwraps FieldValue entries into plain values for the Pill popup. */
const getNodeFields = (id: string): Record<string, any> => {
  const node = getNodeById(id)
  const out: Record<string, any> = {}
  if (node?.fields) {
    for (const [k, v] of Object.entries(node.fields)) {
      const val = (v as any)?.value
      if (val !== undefined && val !== null && val !== '' && val !== false) out[k] = val
    }
  }
  return out
}

const getConceptFields = (conceptType: string): any[] => {
  const lower = conceptType?.toLowerCase()
  for (const id of knowledgeStore.rootIds) {
    const r = knowledgeStore.getNode(id)
    const concepts = r?.localMetamodel?.concepts
    if (Array.isArray(concepts)) {
      const c = concepts.find((x) => x.name.toLowerCase() === lower)
      if (c?.fields) return c.fields
    }
  }
  return []
}
</script>
