<template>
  <div class="flex flex-col gap-1">
    <!-- Top Horizontal Scrollbar Container -->
    <div
      ref="topScrollRef"
      @scroll="syncTopScroll"
      class="overflow-x-auto overflow-y-hidden rounded-t-lg bg-slate-100 dark:bg-slate-800/80 border border-b-0 border-slate-200 dark:border-slate-700 h-3"
    >
      <div :style="{ width: tableWidth + 'px' }" class="h-px"></div>
    </div>

    <!-- Table Container -->
    <div
      ref="tableContainerRef"
      @scroll="syncTableScroll"
      class="overflow-auto max-h-[70vh] rounded-b-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
    >
      <table
        ref="tableRef"
        class="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-[600px]"
      >
        <thead class="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800/95 shadow-2xs">
          <tr>
            <th
              class="sticky left-0 top-0 z-30 bg-slate-50 dark:bg-slate-800/95 text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[280px]"
            >
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
                  title="Sort by element name"
                  data-testid="sort-name"
                  @click="toggleSort('__name__')"
                >
                  <span>Element</span>
                  <component
                    :is="sortIcon('__name__')"
                    class="w-3.5 h-3.5"
                    :class="sortKey === '__name__' ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'"
                  />
                </button>
                <button
                  @click="addElement"
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xs hover:scale-110 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Add element"
                  aria-label="Add element"
                  data-testid="add-element-btn"
                >
                  <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <button
                  @click="isEditMode = !isEditMode"
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full shadow-xs hover:scale-110 active:scale-95 transition-all cursor-pointer shrink-0"
                  :class="isEditMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'"
                  :title="isEditMode ? 'Save changes' : 'Edit element fields'"
                  aria-label="Toggle edit mode"
                  data-testid="toggle-edit-btn"
                >
                  <Check v-if="isEditMode" class="w-3 h-3 stroke-[2.5]" />
                  <Pencil v-else class="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>
            </th>
            <th
              v-for="field in conceptFields"
              :key="field.name"
              class="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800/95 text-left px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[140px]"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                :title="`Sort by ${field.name}`"
                :data-testid="`sort-${field.name}`"
                @click="toggleSort(field.name)"
              >
                <span>{{ field.name.replace(/_/g, ' ') }}</span>
                <component
                  :is="sortIcon(field.name)"
                  class="w-3.5 h-3.5"
                  :class="sortKey === field.name ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'"
                />
              </button>
            </th>
            <th
              class="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800/95 text-left px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[160px]"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Sort by tags"
                data-testid="sort-tags"
                @click="toggleSort('__tags__')"
              >
                <span>Tags</span>
                <component
                  :is="sortIcon('__tags__')"
                  class="w-3.5 h-3.5"
                  :class="sortKey === '__tags__' ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'"
                />
              </button>
            </th>
            <th
              class="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800/95 text-center px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[80px] w-[80px]"
            >
              Order
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(child, idx) in displayChildren"
            :key="child.id"
            :data-node-id="child.id"
            @click="navigateTo(child.id)"
            :draggable="!isSorted && draggableRowId === child.id"
            @dragstart="onDragStart($event, idx)"
            @dragover.prevent="onDragOver($event, idx)"
            @dragend="onDragEnd"
            @drop="onDrop($event, idx)"
            class="group transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
            :class="[
              idx === displayChildren.length - 1 ? 'border-b-0' : '',
              draggedIndex === idx ? 'opacity-40 bg-slate-100 dark:bg-slate-700/50' : '',
              dragOverIndex === idx ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
            ]"
          >
            <td
              class="sticky left-0 z-10 px-2 py-1 border-r border-slate-100 dark:border-slate-700/50 min-w-[280px]"
              :class="[
                draggedIndex === idx ? 'bg-slate-100/40 dark:bg-slate-700/20' : (dragOverIndex === idx ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : 'bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30')
              ]"
            >
              <Pill
                kind="instance"
                :concept-type="conceptType"
                :name="child.name"
                :node-id="child.id"
                :block-id="child.id"
                :description="getDescription(child)"
                :fields="getRawFields(child)"
                :concept-fields="conceptFields || []"
                :show-markers="true"
                interactive
                full-width
              />
            </td>
            <td
              v-for="field in conceptFields"
              :key="field.name"
              @click.stop
              @dblclick="!isEditMode && handleFieldDblClick(child.id, field)"
              class="px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
              :class="{ 'cursor-zoom-in hover:bg-slate-50 dark:hover:bg-slate-700/20 select-text': !isEditMode && isTruncatableType(field.type) }"
            >
              <div
                v-if="!isEditMode && isTruncatableType(field.type)"
                class="max-w-[300px] line-clamp-3 overflow-hidden text-ellipsis break-words"
                title="Double click to view full content"
              >
                <WidgetField
                  :node-id="child.id"
                  :field-key="field.name"
                  :widget-type="field.type || 'string'"
                  :field-definition="field"
                  :readonly="true"
                />
              </div>
              <WidgetField
                v-else
                :node-id="child.id"
                :field-key="field.name"
                :widget-type="field.type || 'string'"
                :field-definition="field"
                :readonly="!isEditMode"
              />
            </td>
            <td class="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
              <TagList
                v-if="!isEditMode"
                :tags="getTags(child)"
                label="Tags"
                compact
              />
              <TagInput
                v-else
                :model-value="getTags(child)"
                @update:model-value="(tags) => updateTags(child, tags)"
              />
            </td>
            <td class="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 text-center">
              <div class="flex items-center justify-center">
                <span
                  class="p-1 rounded transition-colors flex items-center justify-center"
                  :class="isSorted ? 'opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-500' : 'cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500'"
                  :title="isSorted ? 'Clear sort to reorder' : 'Drag to reorder'"
                  @mousedown="onGripMouseDown(child)"
                  @mouseup="draggableRowId = null"
                  @mouseleave="draggableRowId = null"
                >
                  <GripVertical class="w-4 h-4" />
                </span>
              </div>
            </td>
          </tr>
          <tr v-if="displayChildren.length === 0">
            <td
              :colspan="3 + (conceptFields?.length || 0)"
              class="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500 italic"
            >
              No elements for this concept.
              <button
                @click="addElement"
                class="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold ml-1 cursor-pointer"
              >
                Add the first one.
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Field Detail Modal -->
    <FieldDetailModal
      :is-open="isModalOpen"
      :node-id="selectedNodeId"
      :field-key="selectedFieldKey"
      :field-type="selectedFieldType"
      :field-definition="selectedFieldDefinition"
      @close="isModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { GripVertical, Plus, Pencil, Check, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useConfirmStore } from '../../stores/confirmStore'
import { useUiStore } from '../../stores/uiStore'
import { useToast } from '../../shared/useToast'
import WidgetField from '../../shared/widgets/WidgetField.vue'
import Pill from './Pill.vue'
import FieldDetailModal from './FieldDetailModal.vue'
import TagList from '../ui/TagList.vue'
import TagInput from '../ui/TagInput.vue'
import type { FieldValue } from '@cognnitive/innfo-core'

const props = defineProps<{
  nodeId: string
  conceptType?: string
  conceptFields?: any[]
}>()

const knowledgeStore = useKnowledgeStore()
const confirmStore = useConfirmStore()
const uiStore = useUiStore()
const { show: showToast } = useToast()

const isEditMode = ref(false)

// ── Column sorting (view-only lens; never mutates document order) ──
type SortDir = 'asc' | 'desc'
const sortKey = ref<string | null>(null)
const sortDir = ref<SortDir>('asc')
const isSorted = computed(() => sortKey.value !== null)

function toggleSort(key: string): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function clearSort(): void {
  sortKey.value = null
  sortDir.value = 'asc'
}

function sortIcon(key: string) {
  if (sortKey.value !== key) return ArrowUpDown
  return sortDir.value === 'asc' ? ArrowUp : ArrowDown
}

function fieldValueFor(child: any, key: string): unknown {
  if (key === '__name__') return child.name ?? ''
  if (key === '__tags__') return (child.tags ?? []).join(', ')
  return getRawFields(child)[key]
}

function toComparable(value: unknown): number | string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).join(', ').toLowerCase()
  }
  if (typeof value === 'object') {
    const inner = (value as { value?: unknown }).value
    if (inner !== undefined) return toComparable(inner)
    return JSON.stringify(value).toLowerCase()
  }
  const s = String(value)
  const trimmed = s.trim()
  if (trimmed !== '') {
    const n = Number(trimmed)
    if (!Number.isNaN(n)) return n
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const d = Date.parse(trimmed)
      if (!Number.isNaN(d)) return d
    }
  }
  return s.toLowerCase()
}

function compareChildren(a: any, b: any): number {
  const key = sortKey.value
  if (!key) return 0
  const va = toComparable(fieldValueFor(a, key))
  const vb = toComparable(fieldValueFor(b, key))
  let cmp: number
  if (typeof va === 'number' && typeof vb === 'number') {
    cmp = va - vb
  } else {
    cmp = String(va).localeCompare(String(vb))
  }
  return sortDir.value === 'asc' ? cmp : -cmp
}

const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const draggableRowId = ref<string | null>(null)

const topScrollRef = ref<HTMLDivElement | null>(null)
const tableContainerRef = ref<HTMLDivElement | null>(null)
const tableRef = ref<HTMLTableElement | null>(null)
const tableWidth = ref(600)

let isSyncing = false

function syncTopScroll(e: Event): void {
  if (isSyncing) return
  isSyncing = true
  if (tableContainerRef.value && topScrollRef.value) {
    tableContainerRef.value.scrollLeft = (e.target as HTMLElement).scrollLeft
  }
  requestAnimationFrame(() => {
    isSyncing = false
  })
}

function syncTableScroll(e: Event): void {
  if (isSyncing) return
  isSyncing = true
  if (topScrollRef.value && tableContainerRef.value) {
    topScrollRef.value.scrollLeft = (e.target as HTMLElement).scrollLeft
  }
  requestAnimationFrame(() => {
    isSyncing = false
  })
}

function updateTableWidth(): void {
  if (tableRef.value) {
    tableWidth.value = tableRef.value.scrollWidth
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    updateTableWidth()
    if (tableRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateTableWidth())
      resizeObserver.observe(tableRef.value)
    }
  })
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

function getRawFields(child: { fields?: Record<string, FieldValue | unknown> }): Record<string, unknown> {
  if (!child.fields) return {}
  const raw: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(child.fields)) {
    if (val && typeof val === 'object' && 'value' in (val as FieldValue)) {
      raw[key] = (val as FieldValue).value
    } else {
      raw[key] = val
    }
  }
  return raw
}

function getDescription(child: { rawSections?: Record<string, string> }): string {
  return child.rawSections?.description ?? ''
}

function getTags(child: { tags?: string[] }): string[] {
  return child.tags ?? []
}

function updateTags(child: { id: string; tags?: string[] }, newTags: string[]): void {
  const node = knowledgeStore.getNode(child.id)
  if (node) {
    knowledgeStore.upsertNode({ ...node, tags: newTags })
    knowledgeStore.markDirty(child.id)
  }
}

const children = computed(() => {
  const id = props.nodeId
  if (id.startsWith('virtual:')) {
    const parts = id.split(':')
    const parentId = parts[1]
    const conceptName = parts[2]
    const parentNode = knowledgeStore.getNode(parentId)
    if (!parentNode) {
      return []
    }
    const result = parentNode.childIds
      .map((cid) => knowledgeStore.getNode(cid))
      .filter(
        (child): child is any => !!child && child.type === conceptName && child.kind === 'element',
      )
    return result
  }
  return knowledgeStore.getChildren(id)
})

const sortedChildren = computed(() => {
  if (!sortKey.value) return children.value
  return [...children.value].sort(compareChildren)
})

const displayChildren = computed(() => (sortKey.value ? sortedChildren.value : children.value))

function navigateTo(nodeId: string): void {
  uiStore.selectNode(nodeId)
}

function onDragStart(e: DragEvent, index: number): void {
  if (isSorted.value) return
  draggedIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }
}

function onGripMouseDown(child: { id: string }): void {
  if (isSorted.value) return
  draggableRowId.value = child.id
}

function onDragOver(e: DragEvent, index: number): void {
  if (draggedIndex.value === null) return
  if (draggedIndex.value !== index) {
    dragOverIndex.value = index
  }
}

function onDragEnd(): void {
  draggedIndex.value = null
  dragOverIndex.value = null
  draggableRowId.value = null
}

function onDrop(e: DragEvent, targetIdx: number): void {
  e.preventDefault()
  if (isSorted.value) {
    draggedIndex.value = null
    dragOverIndex.value = null
    draggableRowId.value = null
    return
  }
  if (draggedIndex.value === null || draggedIndex.value === targetIdx) {
    draggedIndex.value = null
    dragOverIndex.value = null
    draggableRowId.value = null
    return
  }

  const childId = displayChildren.value[draggedIndex.value].id
  const id = props.nodeId
  const parentId = id.startsWith('virtual:') ? id.split(':')[1] : id

  knowledgeStore.moveChildToIndex(parentId, childId, targetIdx)

  draggedIndex.value = null
  dragOverIndex.value = null
  draggableRowId.value = null
}

async function deleteElement(childId: string): Promise<void> {
  const ok = await confirmStore.confirm({
    title: 'Delete element?',
    message: 'This will permanently remove the element and all its content.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  knowledgeStore.removeNodeTree(childId)
}

function addElement(): void {
  let parentId = props.nodeId
  let conceptName = props.conceptType || ''
  if (props.nodeId.startsWith('virtual:')) {
    const parts = props.nodeId.split(':')
    parentId = parts[1]
    conceptName = parts[2]
  }

  if (!conceptName) {
    console.error('ConceptTableView addElement: conceptName/conceptType is missing!')
    return
  }

  let index = 1
  let elementName = `New ${conceptName}`
  let targetId = `${parentId}/${elementName}`
  while (knowledgeStore.getNode(targetId)) {
    index++
    elementName = `New ${conceptName} ${index}`
    targetId = `${parentId}/${elementName}`
  }

  const newId = knowledgeStore.createChild(parentId, elementName, conceptName, 'element')
  if (newId) {
    isEditMode.value = true
    if (isSorted.value) clearSort()
    showToast(`New ${conceptName} added at the end of the table`, 'success')
    nextTick(() => {
      const rows = tableRef.value?.querySelectorAll<HTMLTableRowElement>('tr[data-node-id]')
      rows?.forEach((row) => {
        if (row.dataset.nodeId === newId && typeof row.scrollIntoView === 'function') {
          row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      })
    })
  }
}

const isModalOpen = ref(false)
const selectedNodeId = ref('')
const selectedFieldKey = ref('')
const selectedFieldType = ref('')
const selectedFieldDefinition = ref<any>(null)

function isTruncatableType(type?: string): boolean {
  const t = type || 'string'
  return t === 'string' || t === 'markdown_inline' || t === 'markdown_file' || t === 'markdown'
}

function handleFieldDblClick(nodeId: string, field: any): void {
  selectedNodeId.value = nodeId
  selectedFieldKey.value = field.name
  selectedFieldType.value = field.type || 'string'
  selectedFieldDefinition.value = field
  isModalOpen.value = true
}
</script>
