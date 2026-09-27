<template>
  <div data-testid="virtual-group-node" class="select-none">
    <!-- ── Non-ghost: header + children ── -->
    <template v-if="!ghost">
      <div
        class="flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-xs group cursor-pointer"
        :style="headerStyle"
        :class="headerClasses"
        @click="onHeaderClick"
      >
        <!-- Expand/collapse -->
        <button
          v-if="hasChildren"
          @click.stop="toggleCollapsed"
          class="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center shrink-0"
        >
          <ChevronDown
            class="transition-transform duration-200 w-3.5 h-3.5"
            :class="{ '-rotate-90': isCollapsed }"
          />
        </button>
        <span v-else class="w-5 shrink-0"></span>

        <!-- Concept identity: unified Pill -->
        <Pill
          kind="concept"
          :color="conceptColorHex"
          :icon="conceptIcon"
          :name="conceptName"
          hide-empty
          full-width
          class="flex-1 min-w-0"
        />

        <!-- Count badge -->
        <span
          class="text-2xs px-1.5 py-0.5 rounded-full shrink-0 font-medium tabular-nums"
          :style="{
            backgroundColor: conceptColorHex + '18',
            color: conceptColorHex,
          }"
        >
          {{ totalElementCount }}
        </span>
      </div>

      <!-- ── Children (sub-groups + elements, collapsible) ── -->
      <div
        v-if="hasChildren && !isCollapsed"
        class="ml-4 pl-1 border-l border-slate-200 dark:border-slate-700 space-y-0.5"
      >
        <!-- Direct element children (flat, no parent hierarchy) -->
        <template v-if="!hasParentHierarchy">
          <ConceptTreeNode
            v-for="child in visibleElements"
            :key="child.id"
            :node-id="child.id"
            :selected-id="selectedId"
            :depth="depth + 1"
            :expanded-generation="expandedGeneration"
            @select="(id: string) => $emit('select', id)"
          />

          <!-- Progressive render: show more button -->
          <button
            v-if="hasMoreElements"
            type="button"
            @click.stop="showAllElements"
            class="w-full text-left px-2 py-1 text-2xs text-primary/80 hover:text-primary font-medium hover:bg-primary/5 rounded transition-colors flex items-center justify-between cursor-pointer"
            data-testid="show-more-elements"
          >
            <span>Showing {{ visibleElements.length }} of {{ elements.length }}</span>
            <span class="underline">Show all (+{{ remainingElementsCount }})</span>
          </button>
        </template>

        <!-- Element children with parent-based hierarchy (e.g. Work procedures) -->
        <template v-else>
          <ConceptTreeNode
            v-for="root in treeRoots"
            :key="root.id"
            :node-id="root.id"
            :selected-id="selectedId"
            :depth="depth + 1"
            :expanded-generation="expandedGeneration"
            @select="(id: string) => $emit('select', id)"
          />
        </template>

        <!-- Sub-concept groups (from _NN index nesting) -->
        <VirtualGroupNode
          v-for="sub in subGroups"
          :key="sub.name"
          :concept-name="sub.name"
          :sub-groups="sub.children"
          :elements="sub.elements"
          :selected-id="selectedId"
          :depth="depth + 1"
          :expanded-generation="expandedGeneration"
          :ghost="sub.ghost"
          @select="(id: string) => $emit('select', id)"
          @click-ghost="(name: string) => $emit('click-ghost', name)"
        />
      </div>
    </template>

    <!-- ── Ghost concept group header (click to convert) ── -->
    <template v-else>
      <div
        class="flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-xs group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"
        :style="ghostHeaderStyle"
        :class="ghostHeaderClasses"
        @click="onHeaderClick"
        data-testid="ghost-group-header"
      >
        <span class="w-5 shrink-0"></span>

        <Pill
          kind="concept"
          :color="conceptColorHex"
          :icon="conceptIcon"
          :name="conceptName"
          full-width
          class="flex-1 min-w-0 pointer-events-none"
        />
        <span class="text-2xs text-slate-400 dark:text-slate-500 italic tabular-nums shrink-0">0</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import {
  useConceptVisuals,
  getHexColor,
  getHexColorLight,
} from '../../composables/useConceptVisuals'
import { useMetamodelStore } from '../../stores/metamodelStore'
import { useModelStore } from '../../stores/modelStore'
import Pill from '../editor/Pill.vue'
import ConceptTreeNode from './ConceptTreeNode.vue'
import type { ModelNode } from '../../model/types'

export interface TreeGroup {
  name: string
  ghost: boolean
  elements: ModelNode[]
  children: TreeGroup[]
}

const props = withDefaults(
  defineProps<{
    conceptName: string
    elements?: ModelNode[]
    subGroups?: TreeGroup[]
    selectedId: string | null
    depth?: number
    expandedGeneration?: number
    /** When true, renders as a ghost placeholder (no instances exist). */
    ghost?: boolean
  }>(),
  {
    depth: 0,
    expandedGeneration: undefined,
    ghost: false,
    elements: () => [],
    subGroups: () => [],
  },
)

const _emit = defineEmits<{
  select: [nodeId: string]
  'click-ghost': [conceptName: string]
}>()

const hasChildren = computed(() => {
  if (props.subGroups.length > 0) return true
  if (hasParentHierarchy.value) return treeRoots.value.length > 0
  return props.elements.length > 0
})

const totalElementCount = computed(() => {
  if (hasParentHierarchy.value) {
    return props.elements.length
  }
  let count = props.elements.length
  for (const sub of props.subGroups) {
    count += countElements(sub)
  }
  return count
})

function countElements(group: TreeGroup): number {
  let c = group.elements.length
  for (const sub of group.children) c += countElements(sub)
  return c
}

// ── Progressive batch rendering for large element lists ──
const PAGE_SIZE = 60
const currentLimit = ref(PAGE_SIZE)

const visibleElements = computed(() => {
  if (props.elements.length <= PAGE_SIZE) return props.elements
  return props.elements.slice(0, currentLimit.value)
})

const hasMoreElements = computed(() => props.elements.length > visibleElements.value.length)
const remainingElementsCount = computed(() => props.elements.length - visibleElements.value.length)

function showAllElements(): void {
  currentLimit.value = props.elements.length
}

watch(
  () => props.selectedId,
  (selId) => {
    if (!selId) return
    const idx = props.elements.findIndex((el) => el.id === selId)
    if (idx >= currentLimit.value) {
      currentLimit.value = Math.max(currentLimit.value, idx + 20)
    }
  },
  { immediate: true },
)

// ── Parent-based hierarchy (e.g. Work procedures with `parent` field) ──

const hasParentHierarchy = computed(() =>
  props.elements.some((el) => el.fields?.parent?.value),
)

const treeRoots = computed<ModelNode[]>(() => {
  if (!hasParentHierarchy.value) return []
  const allNames = new Set(props.elements.map((el) => el.name))
  return props.elements.filter((el) => {
    const parentName = el.fields?.parent?.value as string | undefined
    return !parentName || !allNames.has(parentName)
  })
})

function getSemanticChildren(parentName: string): ModelNode[] {
  return props.elements.filter((el) => el.fields?.parent?.value === parentName)
}

const treeCollapsed = ref<Record<string, boolean>>({})

function toggleTreeCollapsed(id: string): void {
  treeCollapsed.value = { ...treeCollapsed.value, [id]: !treeCollapsed.value[id] }
}

function rootRowClasses(node: ModelNode): Record<string, boolean> {
  return {
    'font-semibold bg-slate-100 dark:bg-slate-800/80': node.id === props.selectedId,
    'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60': node.id !== props.selectedId,
  }
}

const rootRowStyle = computed(() => ({
  paddingLeft: '0.5rem',
}))

const visuals = useConceptVisuals()
const metamodelStore = useMetamodelStore()
const isCollapsed = ref(false)

watch(
  () => props.expandedGeneration,
  (gen) => {
    if (gen !== undefined) {
      isCollapsed.value = gen < 0
      treeCollapsed.value = {}
    }
  },
  { immediate: true },
)

function toggleCollapsed(): void {
  isCollapsed.value = !isCollapsed.value
}

const isSelected = computed(() => {
  if (!props.selectedId) return false
  if (props.selectedId.startsWith('virtual:')) {
    const parts = props.selectedId.split(':')
    return parts[2] === props.conceptName
  }
  return false
})

const modelStore = useModelStore()

function onHeaderClick(): void {
  const firstEl = props.elements[0]
  const parentId = firstEl?.parentId ?? modelStore.rootIds[0] ?? 'Root'
  const virtualId = `virtual:${parentId}:${props.conceptName}`
  _emit('select', virtualId)
}

// Resolve icon and color for this concept group
const conceptColorHex = computed(() => {
  if (props.ghost) {
    // For ghost concepts, resolve from metamodel directly (no children)
    const terminalName = props.conceptName.split(' / ').pop() || props.conceptName
    const concept =
      metamodelStore.getConceptByName(terminalName) ||
      metamodelStore.getConceptByName(props.conceptName)
    if (concept?.color) return getHexColor(concept.color)
    return '#94a3b8'
  }
  const firstEl = props.elements[0] ?? props.subGroups[0]?.elements?.[0]
  if (firstEl) {
    const mc = visuals.getConceptForNode(firstEl)
    if (mc?.color) return getHexColor(mc.color)
  }
  return '#94a3b8'
})

const conceptIcon = computed(() => {
  if (props.ghost) {
    const terminalName = props.conceptName.split(' / ').pop() || props.conceptName
    const concept =
      metamodelStore.getConceptByName(terminalName) ||
      metamodelStore.getConceptByName(props.conceptName)
    return concept?.icon ?? 'folder'
  }
  const firstEl = props.elements[0] ?? props.subGroups[0]?.elements?.[0]
  if (firstEl) {
    return visuals.resolveIcon(firstEl)
  }
  return 'folder'
})

const headerStyle = computed(() => {
  const color = conceptColorHex.value
  const sel = isSelected.value
  return {
    paddingLeft: '0.5rem',
    backgroundColor: sel ? getHexColorLight(color) : 'transparent',
  }
})

const headerClasses = computed(() => {
  const base = 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
  return isSelected.value ? `${base} font-semibold bg-slate-100 dark:bg-slate-800/80` : base
})

// ── Ghost styling ───────────────────────────────────────────────
const ghostHeaderStyle = computed(() => {
  const color = conceptColorHex.value
  const sel = isSelected.value
  return {
    paddingLeft: '0.5rem',
    backgroundColor: sel ? getHexColorLight(color) : 'transparent',
  }
})

const ghostHeaderClasses = computed(() => {
  const base = 'text-slate-500 dark:text-slate-400'
  return isSelected.value ? `${base} font-semibold bg-slate-100 dark:bg-slate-800/80` : base
})
</script>
