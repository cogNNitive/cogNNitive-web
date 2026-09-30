import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ActiveView =
  | 'editor'
  | 'explorer'
  | 'graph'
  | 'matrices'
  | 'info'
  | 'consoles'
  | 'ai-guide'

export type SidebarMode = 'workspace' | 'focused_model'

export interface BreadcrumbSegment {
  id: string | null
  label: string
  isRoot: boolean
  isCurrent: boolean
}

/**
 * UI-only state that does not belong in knowledgeStore.
 *
 * Following the design decision: knowledgeStore stays a clean data graph with zero
 * UI state. All view-only state (selected node, active view) lives in uiStore.
 */
export const useUiStore = defineStore('ui', () => {
  const activeModelId = ref<string | null>(null)
  const activeConcept = ref<string | null>(null)
  const activeView = ref<ActiveView>('editor')
  const selectedNodeId = ref<string | null>(null)
  const selectedInstanceId = ref<string | null>(null)
  const activeMatrixIndex = ref<number>(-1)
  const showValidationReport = ref(false)
  const showMetamatrixConfig = ref(false)
  const showSaveWorkspaceModal = ref(false)
  const showAiModal = ref(false)
  const isSearchOpen = ref(false)
  const searchQuery = ref('')
  const searchConceptFilter = ref('all')
  const selectedConceptFilters = ref<string[]>(['all'])
  const selectedTagFilters = ref<string[]>([])
  const sidebarMode = ref<SidebarMode>('workspace')
  const focusedModelId = ref<string | null>(null)

  const searchFilterTab = ref<'concepts' | 'tags'>('concepts')

  const isAllConceptsSelected = computed(() => {
    return selectedConceptFilters.value.includes('all')
  })

  function setSearchFilterTab(tab: 'concepts' | 'tags') {
    searchFilterTab.value = tab
  }

  function isTagSelected(tag: string): boolean {
    return selectedTagFilters.value.includes(tag)
  }

  function toggleTagFilter(tag: string) {
    const index = selectedTagFilters.value.indexOf(tag)
    if (index === -1) selectedTagFilters.value.push(tag)
    else selectedTagFilters.value.splice(index, 1)
  }

  function selectAllTags(availableTags: string[]) {
    selectedTagFilters.value = [...availableTags]
  }

  function deselectAllTags() {
    selectedTagFilters.value = []
  }

  function clearTagFilters() {
    selectedTagFilters.value = []
  }

  function isConceptSelected(conceptName: string): boolean {
    if (isAllConceptsSelected.value) return true
    return selectedConceptFilters.value.includes(conceptName)
  }

  function selectAllConcepts(): void {
    selectedConceptFilters.value = ['all']
    searchConceptFilter.value = 'all'
  }

  function deselectAllConcepts(): void {
    selectedConceptFilters.value = []
    searchConceptFilter.value = ''
  }

  function toggleConceptFilter(conceptName: string, availableConcepts?: string[]): void {
    if (isAllConceptsSelected.value) {
      selectedConceptFilters.value = [conceptName]
      searchConceptFilter.value = conceptName
      return
    }

    const current = [...selectedConceptFilters.value]
    const idx = current.indexOf(conceptName)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(conceptName)
    }

    if (availableConcepts && availableConcepts.length > 0) {
      const allSelected = availableConcepts.every((c) => current.includes(c))
      if (allSelected) {
        selectedConceptFilters.value = ['all']
        searchConceptFilter.value = 'all'
        return
      }
    }

    selectedConceptFilters.value = current
    searchConceptFilter.value = current.join(',')
  }

  function setActiveModel(id: string | null): void {
    activeModelId.value = id
  }

  function setActiveConcept(name: string | null): void {
    activeConcept.value = name
  }

  function setActiveView(view: ActiveView): void {
    activeView.value = view
  }

  function selectNode(id: string | null): void {
    selectedNodeId.value = id
    // The validation report is a modal overlay over the editor. Every
    // navigation path routes through selectNode, so dismissing it here is
    // what makes "click anywhere else" show that place again.
    showValidationReport.value = false
    if (activeView.value !== 'editor') {
      activeView.value = 'editor'
    }
  }

  function selectInstance(id: string | null): void {
    selectedInstanceId.value = id
  }

  function setActiveMatrixIndex(index: number): void {
    activeMatrixIndex.value = index
  }

  function setShowValidationReport(val: boolean): void {
    showValidationReport.value = val
  }

  function setShowSaveWorkspaceModal(val: boolean): void {
    showSaveWorkspaceModal.value = val
  }

  function setShowAiModal(val: boolean): void {
    showAiModal.value = val
  }

  function toggleSearchOpen(): void {
    isSearchOpen.value = !isSearchOpen.value
    if (!isSearchOpen.value) {
      clearSearch()
    }
  }

  function setSearchOpen(val: boolean): void {
    isSearchOpen.value = val
    if (!val) {
      clearSearch()
    }
  }

  function setSearchQuery(query: string): void {
    searchQuery.value = query
  }

  function setSearchConceptFilter(concept: string): void {
    searchConceptFilter.value = concept
    if (concept === 'all' || !concept) {
      selectedConceptFilters.value = ['all']
    } else {
      selectedConceptFilters.value = [concept]
    }
  }

  function clearSearch(): void {
    searchQuery.value = ''
    searchConceptFilter.value = 'all'
    selectedConceptFilters.value = ['all']
    clearTagFilters()
  }

  function setSidebarMode(mode: SidebarMode, modelId?: string | null): void {
    sidebarMode.value = mode
    if (modelId !== undefined) {
      focusedModelId.value = modelId
    }
  }

  function focusModel(modelId: string): void {
    focusedModelId.value = modelId
    sidebarMode.value = 'focused_model'
    activeModelId.value = modelId
  }

  function returnToWorkspaceOverview(): void {
    sidebarMode.value = 'workspace'
    focusedModelId.value = null
  }

  function resolveModelAncestry(
    modelId: string,
    nodes?: Record<string, any>,
  ): BreadcrumbSegment[] {
    const segments: BreadcrumbSegment[] = [
      {
        id: null,
        label: 'Workspace',
        isRoot: true,
        isCurrent: false,
      },
    ]

    if (!modelId) return segments

    const chain: Array<{ id: string; name: string }> = []
    let currentId: string | null = modelId
    const visited = new Set<string>()

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      let node: any = nodes ? nodes[currentId] : null
      if (!node && nodes) {
        node = Object.values(nodes).find(
          (n: any) =>
            n.id === currentId ||
            n.name === currentId ||
            n.source?.path === currentId ||
            n.source?.path?.replace(/\.md$/i, '').endsWith(currentId),
        )
      }

      const name =
        node?.name || node?.source?.path?.split('/').pop()?.replace(/\.md$/i, '') || currentId
      chain.unshift({ id: node?.id || currentId, name })
      currentId = node?.parentId || null
    }

    chain.forEach((item, idx) => {
      segments.push({
        id: item.id,
        label: item.name,
        isRoot: false,
        isCurrent: idx === chain.length - 1,
      })
    })

    return segments
  }

  return {
    resolveModelAncestry,
    activeModelId,
    activeConcept,
    activeView,
    selectedNodeId,
    selectedInstanceId,
    activeMatrixIndex,
    showValidationReport,
    showMetamatrixConfig,
    showSaveWorkspaceModal,
    showAiModal,
    isSearchOpen,
    searchQuery,
    searchConceptFilter,
    selectedConceptFilters,
    selectedTagFilters,
    searchFilterTab,
    sidebarMode,
    focusedModelId,
    isAllConceptsSelected,
    isConceptSelected,
    isTagSelected,
    selectAllConcepts,
    deselectAllConcepts,
    selectAllTags,
    deselectAllTags,
    setSearchFilterTab,
    toggleConceptFilter,
    toggleTagFilter,
    clearTagFilters,
    setActiveModel,
    setActiveConcept,
    setActiveView,
    selectNode,
    selectInstance,
    setActiveMatrixIndex,
    setShowValidationReport,
    setShowSaveWorkspaceModal,
    setShowAiModal,
    toggleSearchOpen,
    setSearchOpen,
    setSearchQuery,
    setSearchConceptFilter,
    clearSearch,
    setSidebarMode,
    focusModel,
    returnToWorkspaceOverview,
  }
})
