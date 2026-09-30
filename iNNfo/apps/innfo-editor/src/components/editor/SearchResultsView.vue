<script setup lang="ts">
import { ref, computed } from 'vue'
import BlockSheet from './BlockSheet.vue'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useMetamodelStore } from '../../stores/metamodelStore'
import { useUiStore } from '../../stores/uiStore'
import type { KnowledgeNode } from '../../model/types'
import { Search } from 'lucide-vue-next'

const knowledgeStore = useKnowledgeStore()
const metamodelStore = useMetamodelStore()
const uiStore = useUiStore()

const emit = defineEmits<{
  (e: 'navigate-to-node', nodeId: string): void
}>()

// Track collapsed state per node id (defaults to true)
const collapsedMap = ref<Record<string, boolean>>({})

function isCollapsed(nodeId: string): boolean {
  return collapsedMap.value[nodeId] ?? true
}

function setCollapsed(nodeId: string, val: boolean): void {
  collapsedMap.value[nodeId] = val
}

const matchingNodes = computed(() => {
  const query = uiStore.searchQuery.trim().toLowerCase()

  if (query.length < 3 && uiStore.selectedTagFilters.length === 0) {
    return []
  }

  const results: KnowledgeNode[] = []

  for (const node of Object.values(knowledgeStore.nodes)) {
    if (node.kind === 'root' || node.id.startsWith('spec:')) continue

    const conceptName =
      node.conceptBinding?.name || (node.kind === 'concept' ? node.name : node.type) || ''

    // Apply Concept Filter
    if (!uiStore.isConceptSelected(conceptName)) {
      continue
    }

    // Calculate effective tags (node tags + concept-level tags from root)
    const activeRootId = knowledgeStore.activeNodeId
    const rootNode = activeRootId ? knowledgeStore.getNode(activeRootId) : null
    const conceptTags = rootNode?.conceptTags?.[conceptName] || []
    const effectiveTags = Array.from(new Set([...(node.tags || []), ...conceptTags]))

    // Apply UI Tags Filter
    if (uiStore.selectedTagFilters.length > 0) {
      const hasAllTags = uiStore.selectedTagFilters.every((tag) => effectiveTags.includes(tag))
      if (!hasAllTags) continue
    }

    // Parse Text Search Query for #tags
    const queryParts = query.split(' ')
    const queryTags = queryParts
      .filter((p) => p.startsWith('#'))
      .map((p) => p.slice(1).toLowerCase())
    const queryText = queryParts.filter((p) => !p.startsWith('#')).join(' ')

    if (queryTags.length > 0) {
      const hasQueryTags = queryTags.every((tag) => effectiveTags.includes(tag))
      if (!hasQueryTags) continue
    }

    // If there is no text query but we matched tags, include and skip text match
    if (!queryText && (queryTags.length > 0 || uiStore.selectedTagFilters.length > 0)) {
      results.push(node)
      continue
    }

    // Apply Text Search Query
    const nameMatch = node.name?.toLowerCase().includes(queryText)
    const typeMatch = node.type?.toLowerCase().includes(queryText)
    const conceptMatch = conceptName.toLowerCase().includes(queryText)
    const descMatch = node.rawSections?.description?.toLowerCase().includes(queryText)

    let fieldMatch = false
    if (node.fields) {
      for (const [key, fv] of Object.entries(node.fields)) {
        const valStr = String((fv as any)?.value ?? fv).toLowerCase()
        if (key.toLowerCase().includes(queryText) || valStr.includes(queryText)) {
          fieldMatch = true
          break
        }
      }
    }

    if (!nameMatch && !typeMatch && !conceptMatch && !descMatch && !fieldMatch) {
      continue
    }

    results.push(node)
  }

  return results
})

function getConceptFieldsForNode(node: KnowledgeNode) {
  const conceptName = node.conceptBinding?.name ?? node.name ?? node.type
  const metamodelFields =
    metamodelStore.getConceptFields(conceptName) ?? metamodelStore.getConceptFields(node.type) ?? []
  return metamodelFields
}

function toBlock(node: KnowledgeNode) {
  const fields: Record<string, any> = {}
  if (node.fields) {
    for (const [k, fv] of Object.entries(node.fields)) {
      fields[k] = (fv as any).value ?? fv
    }
  }
  return {
    id: node.id,
    name: node.name,
    description: node.rawSections?.description || '',
    fields,
  }
}

function handleNavigate(nodeId: string) {
  uiStore.selectNode(nodeId)
  emit('navigate-to-node', nodeId)
}
</script>

<template>
  <div class="flex flex-col flex-1 space-y-4 p-4 overflow-y-auto" data-testid="search-results-view">
    <!-- Header summary of results -->
    <div
      class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700"
    >
      <div class="flex items-center gap-2">
        <Search class="w-4 h-4 text-primary" />
        <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Resultados de búsqueda
          <span v-if="uiStore.searchQuery" class="font-normal text-slate-500">
            para "{{ uiStore.searchQuery }}"
          </span>
          <span
            v-if="!uiStore.isAllConceptsSelected"
            class="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary ml-1"
          >
            Filtro: {{ uiStore.selectedConceptFilters.join(', ') }}
          </span>
          <span
            v-if="uiStore.selectedTagFilters.length > 0"
            class="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 ml-1"
          >
            Etiquetas: {{ uiStore.selectedTagFilters.join(', ') }}
          </span>
        </h2>
      </div>
      <span class="text-xs text-slate-500 font-mono">
        {{ matchingNodes.length }} {{ matchingNodes.length === 1 ? 'resultado' : 'resultados' }}
      </span>
    </div>

    <!-- Query too short state -->
    <div
      v-if="uiStore.searchQuery.trim().length < 3 && uiStore.selectedTagFilters.length === 0"
      class="text-center py-16 text-slate-400 dark:text-slate-500 italic text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700"
    >
      Ingresá al menos 3 caracteres para iniciar la búsqueda o seleccioná una etiqueta.
    </div>

    <!-- Empty state -->
    <div
      v-else-if="matchingNodes.length === 0"
      class="text-center py-16 text-slate-400 dark:text-slate-500 italic text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700"
    >
      No se encontraron conceptos ni elementos que coincidan con la búsqueda.
    </div>

    <!-- Results list (Collapsed BlockSheets) -->
    <div v-else class="space-y-3">
      <BlockSheet
        v-for="node in matchingNodes"
        :key="node.id"
        :block="toBlock(node)"
        :kind="node.kind === 'concept' ? 'concept' : 'instance'"
        :concept-name="
          node.conceptBinding?.name || (node.kind === 'concept' ? node.name : node.type)
        "
        :concept-type="node.type"
        :concept-fields="getConceptFieldsForNode(node)"
        :collapsed="isCollapsed(node.id)"
        :is-editing="false"
        :show-reorder="false"
        :show-delete="false"
        @update:collapsed="(val) => setCollapsed(node.id, val)"
        @navigate-to-node="handleNavigate"
      />
    </div>
  </div>
</template>
