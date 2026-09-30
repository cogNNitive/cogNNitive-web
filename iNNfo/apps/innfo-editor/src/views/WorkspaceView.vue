<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  defineAsyncComponent,
  type Component,
  watch,
} from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Header from '../components/layout/Header.vue'
import SampleBanner from '../components/layout/SampleBanner.vue'
import LegacyDomainBanner from '../components/layout/LegacyDomainBanner.vue'
import LeftSidebar from '../components/layout/LeftSidebar.vue'
import RightGuidanceSidebar from '../components/layout/RightGuidanceSidebar.vue'
import ValidationReport from '../components/ValidationReport.vue'
import ToastMessage from '../components/ToastMessage.vue'
import SaveWorkspaceModal from '../components/layout/SaveWorkspaceModal.vue'
import WorkspaceDashboard from '../components/layout/WorkspaceDashboard.vue'
import ModelDashboard from '../components/editor/ModelDashboard.vue'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useConfirmStore } from '../stores/confirmStore'
import { useUiStore, type ActiveView } from '../stores/uiStore'
import { useMetamodelStore } from '../stores/metamodelStore'
import { useToast } from '../shared/useToast'
import { useHashSync } from '../composables/useHashSync'
import { useViewSync } from '../composables/useViewSync'
import { useLivePreview } from '../composables/useLivePreview'
import { ValidationService } from '../services/ValidationService'
import type { KnowledgeNode } from '../model/types'
import { isImageFieldName, isImageFieldValue } from '../utils/imageDetection'
import { MATRIX_DEFS_KEY } from '../composables/useMatrixDefinitions'

// Dynamic sub-editors
const BlockFeed = defineAsyncComponent(() => import('../components/editor/BlockFeed.vue'))
const BlockSheet = defineAsyncComponent(() => import('../components/editor/BlockSheet.vue'))
const TextEditor = defineAsyncComponent(() => import('../components/editor/TextEditor.vue'))
const TreeEditor = defineAsyncComponent(() => import('../components/editor/TreeEditor.vue'))
const GraphViewer = defineAsyncComponent(() => import('../components/editor/GraphViewer.vue'))
const MatricesGrid = defineAsyncComponent(() => import('../components/editor/MatricesGrid.vue'))
const ConceptTableView = defineAsyncComponent(
  () => import('../components/editor/ConceptTableView.vue'),
)
const MetamatrixConfig = defineAsyncComponent(
  () => import('../components/editor/MetamatrixConfig.vue'),
)
const KnowledgeInfoPanel = defineAsyncComponent(() => import('../components/editor/KnowledgeInfoPanel.vue'))
const AiWorkflowPanel = defineAsyncComponent(
  () => import('../components/editor/AiWorkflowPanel.vue'),
)
const SearchResultsView = defineAsyncComponent(
  () => import('../components/editor/SearchResultsView.vue'),
)
const ConsoleHubView = defineAsyncComponent(
  () => import('../components/editor/ConsoleHubView.vue'),
)

const router = useRouter()
const route = useRoute()
const workspaceStore = useWorkspaceStore()
const knowledgeStore = useKnowledgeStore()
const confirmStore = useConfirmStore()
const uiStore = useUiStore()
const metamodelStore = useMetamodelStore()
const { show } = useToast()
const validationService = new ValidationService(knowledgeStore, show)

// ── Hash sync ──
// Syncs uiStore.selectedNodeId with the URL hash (#conceptName.elementName)
useHashSync()

// ── View sync ──
// Syncs uiStore.activeView with the ?view= query param so browser
// back/forward navigates between views instead of jumping to home.
useViewSync()

// ── Toolbar / validation state ──
const validationReport = computed(() => knowledgeStore.validationReport)
const validating = ref(false)

// Validation report is set silently on import (auto-run in setGraph → validateKnowledge).
// The overlay only opens on explicit Validate button click (runValidation).

const isEditingTable = ref(false)

const selectedNodeId = computed(() => uiStore.selectedNodeId)

watch(selectedNodeId, () => {
  isEditingTable.value = false
})

const selectedNode = computed(() => {
  const id = selectedNodeId.value
  if (!id) return null
  if (id.startsWith('virtual:')) {
    const parts = id.split(':')
    const parentId = parts[1]
    const conceptName = parts[2]
    const parentNode = knowledgeStore.getNode(parentId)
    if (!parentNode) return null

    const childIds = parentNode.childIds.filter((cid) => {
      const child = knowledgeStore.getNode(cid)
      return child?.type === conceptName && child?.kind === 'element'
    })

    // Resolve the real concept type from the metamodel (e.g. `text`, `weight`).
    const metaConcept = metamodelStore.getConceptByName(conceptName)
    const realType = metaConcept?.type ?? conceptName

    return {
      id,
      name: conceptName,
      parentId,
      childIds,
      type: realType,
      kind: 'concept',
      fields: {},
      markers: {},
      relationships: [],
      rawSections: { description: parentNode.rawSections?.[conceptName] ?? '' },
      source: parentNode.source,
    } as any
  }
  return knowledgeStore.getNode(id)
})

const selectedNodeName = computed(() => selectedNode.value?.name ?? '')
const selectedNodeType = computed(() => selectedNode.value?.type ?? 'text')
const conceptType = computed(() => {
  return selectedNode.value?.conceptBinding?.name ?? selectedNode.value?.type ?? null
})
const rootNode = computed(() => {
  const ids = knowledgeStore.rootIds
  return ids.length > 0 ? knowledgeStore.getNode(ids[0]) : null
})

const isRootNode = computed(() => selectedNode.value?.kind === 'root')

/** Determines which editor sub-view to render based on node characteristics. */
const isConceptLike = (node: { kind?: string }) => node.kind === 'concept' || node.kind === 'root'

const editorView = computed<'text' | 'tree' | 'sheet' | 'table'>(() => {
  if (!selectedNode.value) return 'sheet'
  // If it's a concept-like node
  if (isConceptLike(selectedNode.value)) {
    if (selectedNode.value.type === 'text') {
      return 'text'
    }
    return 'table'
  }
  // Nodes with rawContent show TextEditor
  if (selectedNode.value.rawContent) {
    return 'text'
  }
  // Nodes with children get the TreeEditor (structural)
  if (selectedNode.value.childIds.length > 0) {
    return 'tree'
  }
  // Everything else gets a BlockSheet view
  return 'sheet'
})

const inferTypeFromValue = (key: string, val: any): string => {
  if (isImageFieldName(key)) return 'image'
  const rawType = typeof val
  if (rawType === 'boolean') return 'boolean'
  if (rawType === 'number')
    return Number.isInteger(val) && val >= 1 && val <= 5 ? 'rating' : 'number'
  if (rawType === 'string') {
    if (/^#[0-9a-fA-F]{6}$/.test(val)) return 'color'
    if (isImageFieldValue(key, val)) return 'image'
    if (/^https?:\/\//.test(val)) return 'url'
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return 'date'
  }
  return 'string'
}

const getConceptFieldsForNode = (node: KnowledgeNode) => {
  const isElement = node.kind === 'element' || (node.kind !== 'concept' && node.kind !== 'root')
  const conceptName = isElement ? node.type : (node.conceptBinding?.name ?? node.name)
  let metamodelFields = metamodelStore.getConceptFields(conceptName)
  if (
    (!metamodelFields || metamodelFields.length === 0) &&
    node.type &&
    node.type !== conceptName
  ) {
    metamodelFields = metamodelStore.getConceptFields(node.type)
  }
  if (!metamodelFields) {
    metamodelFields = []
  }
  const fieldsMap = new Map<string, { name: string; type: string; [key: string]: any }>()

  for (const f of metamodelFields) {
    fieldsMap.set(f.name, { ...f })
  }

  if (node.fields) {
    for (const [key, fv] of Object.entries(node.fields)) {
      if (!fieldsMap.has(key)) {
        const val = fv?.value ?? fv
        fieldsMap.set(key, { name: key, type: inferTypeFromValue(key, val) })
      }
    }
  }

  if (Array.isArray(node.childIds)) {
    for (const cid of node.childIds) {
      const child = knowledgeStore.getNode(cid)
      if (child?.fields) {
        for (const [key, fv] of Object.entries(child.fields)) {
          if (!fieldsMap.has(key)) {
            const val = fv?.value ?? fv
            fieldsMap.set(key, { name: key, type: inferTypeFromValue(key, val) })
          }
        }
      }
    }
  }

  return Array.from(fieldsMap.values())
}

const activeConceptFields = computed(() => {
  const node = selectedNode.value
  if (!node) return []
  return getConceptFieldsForNode(node)
})

const conceptBlock = computed(() => {
  const node = selectedNode.value
  if (!node) return { id: '', name: '', description: '' }
  const isElement = node.kind === 'element' || (node.kind !== 'concept' && node.kind !== 'root')
  const conceptName = isElement ? node.type : (node.conceptBinding?.name ?? node.name)
  let metamodelFields = metamodelStore.getConceptFields(conceptName)
  if (
    (!metamodelFields || metamodelFields.length === 0) &&
    node.type &&
    node.type !== conceptName
  ) {
    metamodelFields = metamodelStore.getConceptFields(node.type)
  }
  if (!metamodelFields) {
    metamodelFields = []
  }
  const fields: Record<string, unknown> = {}

  for (const f of metamodelFields) {
    fields[f.name] = f.type === 'boolean' ? false : ''
  }

  if (node.fields) {
    for (const [k, fv] of Object.entries(node.fields)) {
      fields[k] = fv && typeof fv === 'object' && 'value' in fv ? (fv as { value: unknown }).value : fv
    }
  }

  return {
    id: node.id,
    name: node.name,
    description: node.rawSections?.description || '',
    fields,
    tags: node.tags ?? [],
  }
})

const childItems = computed(() => {
  const node = selectedNode.value
  if (!node) return []
  return node.childIds
    .map((id: string) => knowledgeStore.getNode(id))
    .filter((n: KnowledgeNode | undefined): n is KnowledgeNode => !!n)
    .map((n: KnowledgeNode) => ({
      id: n.id,
      name: n.name,
      description: n.rawSections?.description || '',
      fields: Object.fromEntries(
        Object.entries(n.fields ?? {}).map(([k, fv]) => [k, fv?.value]),
      ),
      tags: n.tags ?? [],
    }))
})

const isListConcept = computed(() => childItems.value.length > 0)

// The active editor is a dynamic <component :is>: each editorView selects a
// different component with a different prop shape, correlated at runtime but
// not statically expressible. Type it as an opaque Component so vue-tsc does
// not try (and fail) to reconcile the prop unions at the binding site.
const activeEditorComponent = computed<Component>(() => {
  if (editorView.value === 'text') return TextEditor
  if (editorView.value === 'tree') return TreeEditor
  if (editorView.value === 'table') return BlockSheet
  return BlockFeed
})

const activeEditorProps = computed(() => {
  const nid = selectedNodeId.value ?? ''
  if (editorView.value === 'text') {
    return {
      nodeId: nid,
      conceptName: selectedNodeName.value,
      conceptType: selectedNodeType.value,
      rootNodeId: rootNode.value?.id ?? '',
    }
  }
  if (editorView.value === 'tree') {
    return {
      nodeId: nid,
      conceptName: selectedNodeName.value,
    }
  }
  if (editorView.value === 'table') {
    return {
      block: conceptBlock.value,
      kind: 'concept',
      conceptType: selectedNodeType.value,
      conceptName: selectedNodeName.value,
      conceptFields: activeConceptFields.value,
      collapsed: false,
      isEditing: isEditingTable.value,
    }
  }
  return {
    conceptName: selectedNodeName.value,
    conceptType: selectedNodeType.value,
    conceptBlock: conceptBlock.value,
    conceptFields: activeConceptFields.value,
    items: childItems.value,
    isListConcept: isListConcept.value,
    deletable: selectedNode.value?.kind === 'element',
    isElement: selectedNode.value?.kind === 'element',
  }
})

const activeEditorEvents = computed(() => {
  if (editorView.value === 'text') {
    return {
      change: onEditorChange,
    }
  }
  if (editorView.value === 'tree') {
    return {
      'navigate-to-node': onNavigateToNode,
    }
  }
  if (editorView.value === 'table') {
    return {
      change: onEditorChange,
      'navigate-to-node': onNavigateToNode,
      'update:concept-name': onConceptNameChange,
      'edit-toggle': () => {
        isEditingTable.value = !isEditingTable.value
      },
    }
  }
  return {
    'change-concept': onEditorChange,
    'change-item': onEditorChange,
    'change-concept-name': onConceptNameChange,
    'add-item': onAddItem,
    'delete-node': onDeleteSelectedNode,
    'delete-item': onDeleteItem,
    'move-item-up': (index: number) => onMoveItem(index, -1),
    'move-item-down': (index: number) => onMoveItem(index, 1),
    'navigate-to-node': onNavigateToNode,
  }
})

// ── Event handlers ──

function onSelectNode(nodeId: string): void {
  uiStore.selectNode(nodeId)
}

function onEditorChange(): void {
  // Editor changes are tracked through provenance — nothing extra needed
}

function onConceptNameChange(newName: string): void {
  const node = selectedNode.value
  if (!node || !selectedNodeId.value) return
  knowledgeStore.upsertNode({ ...node, name: newName })
  knowledgeStore.markDirty(selectedNodeId.value)
}

function onNavigateToNode(nodeId: string): void {
  uiStore.selectNode(nodeId)
}

/** Adds a new child element under the selected node (BlockFeed '+' button). */
function onAddItem(): void {
  const node = selectedNode.value
  const type = node?.type || conceptType.value
  if (!node || !type || !selectedNodeId.value) return

  let parentId = selectedNodeId.value
  if (selectedNodeId.value.startsWith('virtual:')) {
    parentId = selectedNodeId.value.split(':')[1]
  }

  let index = 1
  let elementName = `New ${type}`
  let targetId = `${parentId}/${elementName}`
  while (knowledgeStore.getNode(targetId)) {
    index++
    elementName = `New ${type} ${index}`
    targetId = `${parentId}/${elementName}`
  }

  const newId = knowledgeStore.createChild(parentId, elementName, type, 'element')
  if (newId) {
    uiStore.selectNode(newId)
  }
}

/** Deletes the currently selected element (BlockFeed sheet delete button). */
async function onDeleteSelectedNode(): Promise<void> {
  const node = selectedNode.value
  const id = selectedNodeId.value
  if (!node || !id) return
  const isElement = node.kind === 'element'
  const ok = await confirmStore.confirm({
    title: isElement ? 'Delete element?' : 'Delete concept?',
    message: isElement
      ? 'This will permanently remove the element and all its content.'
      : 'This will permanently remove the concept and all its content.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  const parentId = node.parentId
  knowledgeStore.removeNodeTree(id)
  uiStore.selectNode(parentId ?? knowledgeStore.rootIds[0] ?? null)
}

/** Deletes one of the child elements rendered as instance sheets. */
async function onDeleteItem(index: number): Promise<void> {
  const item = childItems.value[index]
  if (!item) return
  const ok = await confirmStore.confirm({
    title: 'Delete element?',
    message: 'This will permanently remove the element and all its content.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  knowledgeStore.removeNodeTree(item.id)
}

/** Moves a child element up/down within its parent. */
function onMoveItem(index: number, direction: 1 | -1): void {
  const node = selectedNode.value
  const item = childItems.value[index]
  if (!node || !item) return
  const parentId = node.id.startsWith('virtual:') ? node.id.split(':')[1] : node.id
  knowledgeStore.reorderChild(parentId, item.id, direction)
}

/** Switches the active view (editor / graph / matrices / info). */
function setActiveView(view: ActiveView): void {
  uiStore.setActiveView(view)
  if (view === 'matrices' && uiStore.activeMatrixIndex < 0) {
    for (const id of knowledgeStore.rootIds) {
      const root = knowledgeStore.getNode(id)
      if (!root) continue
      const defs = root.fields?.[MATRIX_DEFS_KEY]?.value ?? root.fields?.matrices?.value
      if (Array.isArray(defs) && defs.length > 0) {
        uiStore.setActiveMatrixIndex(0)
        break
      }
    }
  }
}

function onSelectMatrix(idx: number): void {
  uiStore.setActiveMatrixIndex(idx)
  uiStore.setActiveView('matrices')
}

function onSelectView(view: string): void {
  if (view === 'metamatrix-config') {
    uiStore.setActiveView('matrices')
    uiStore.showMetamatrixConfig = !uiStore.showMetamatrixConfig
  }
}

// ── Validation ──

async function runValidation(): Promise<void> {
  if (!selectedNodeId.value) return

  validating.value = true

  try {
    const report = await validationService.runValidation(selectedNodeId.value)
    knowledgeStore.validationReport = report
    if (report) {
      uiStore.setShowValidationReport(true)
    }
  } catch (err) {
    show(err instanceof Error ? err.message : 'Validation failed', 'error')
  } finally {
    validating.value = false
  }
}

/** Exits the sample session and returns to home. */
function onSampleCreate(): void {
  workspaceStore.reset()
  knowledgeStore.setGraph({}, [])
  uiStore.selectNode(null)
  router.push('/')
}

/** No-op — dismissal state handled by SampleBanner via sessionStorage. */
function onSampleBannerDismiss(): void {
  // handled internally by SampleBanner
}

/** Resets the workspace and returns to home. */
function closeWorkspace(): void {
  if (knowledgeStore.dirtyIds.size > 0) {
    const confirmLeave = confirm('Tenés cambios sin guardar. ¿Estás seguro de que querés salir?')
    if (!confirmLeave) return
  }
  workspaceStore.reset()
  knowledgeStore.setGraph({}, [])
  uiStore.selectNode(null)
  router.push('/')
}

// ── Keyboard shortcuts ──

async function onKeydown(e: KeyboardEvent): Promise<void> {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (!workspaceStore.hasHandle) {
      uiStore.setShowSaveWorkspaceModal(true)
      return
    }
    try {
      await workspaceStore.saveActiveFile()
      show('Saved successfully.', 'success')
    } catch {
      show('Save failed.', 'error')
    }
  }
}

function onBeforeUnload(e: BeforeUnloadEvent): string | void {
  if (knowledgeStore.dirtyIds.size > 0) {
    e.preventDefault()
    e.returnValue = 'Tenés cambios sin guardar. ¿Estás seguro de que querés salir?'
    return e.returnValue
  }
}

// ── MCP live preview ──
// When opened with `?live=<origin>&token=<t>`, subscribe to the MCP change
// stream so this tab mirrors the agent's mutations in read-only mode.
const livePreview = useLivePreview()

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)

  const live = typeof route.query.live === 'string' ? route.query.live : null
  const token = typeof route.query.token === 'string' ? route.query.token : null
  if (live && token) {
    livePreview.start({ live, token })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  livePreview.stop()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
    <Header @close-workspace="closeWorkspace" />

    <SampleBanner
      v-if="workspaceStore.isSampleSession"
      :template-name="workspaceStore.sampleBlueprintName"
      @create="onSampleCreate"
      @dismiss="onSampleBannerDismiss"
    />

    <LegacyDomainBanner />

    <div class="flex flex-1 overflow-hidden">
      <LeftSidebar
        @select-node="onSelectNode"
        @select-matrix="onSelectMatrix"
        @select-view="onSelectView"
      />

      <main class="flex-1 flex flex-col overflow-y-auto min-w-0">
        <!-- ── Search Results View ── -->
        <template v-if="uiStore.isSearchOpen">
          <SearchResultsView @navigate-to-node="onNavigateToNode" />
        </template>

        <!-- ── Editor View ── -->
        <template v-else-if="uiStore.activeView === 'editor'">
          <div
            v-if="selectedNodeId && !uiStore.showValidationReport"
            class="flex-1 p-4 overflow-y-auto"
          >
            <ModelDashboard v-if="isRootNode" :root-node-id="selectedNodeId" />
            <component
              v-else
              :is="activeEditorComponent"
              :key="selectedNodeId"
              v-bind="activeEditorProps"
              v-on="activeEditorEvents"
            />
          </div>

          <div
            v-else-if="uiStore.showValidationReport && validationReport"
            class="flex-1 p-4 overflow-y-auto"
          >
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold">Validation Report</h3>
              <button
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                @click="uiStore.setShowValidationReport(false)"
              >
                Back to editor
              </button>
            </div>
            <ValidationReport :report="validationReport" />
          </div>

          <WorkspaceDashboard v-else />
        </template>

        <!-- ── Graph View ── -->
        <template v-else-if="uiStore.activeView === 'graph'">
          <div class="flex-1 flex flex-col min-h-0">
            <GraphViewer
              :local-node-id="selectedNodeId ?? ''"
              :auto-select-concept="selectedNodeType"
              @select-node="onNavigateToNode"
            />
          </div>
        </template>

        <!-- ── Matrices View ── -->
        <template v-else-if="uiStore.activeView === 'matrices'">
          <div class="flex-1 flex flex-col min-h-0 p-4 overflow-y-auto">
            <MetamatrixConfig v-if="uiStore.showMetamatrixConfig" class="mb-6" />
            <MatricesGrid
              :matrix-index="uiStore.activeMatrixIndex"
              @cell-change="(_key, _val) => {}"
            />
          </div>
        </template>

        <!-- ── Consoles / Workspace Hub View ── -->
        <template v-else-if="uiStore.activeView === 'consoles'">
          <div class="flex-1 flex flex-col min-h-0">
            <ConsoleHubView />
          </div>
        </template>

        <!-- ── Info View ── -->
        <template v-else-if="uiStore.activeView === 'info'">
          <div class="flex-1 p-4 overflow-y-auto">
            <KnowledgeInfoPanel v-if="rootNode" :root-node-id="rootNode.id" />
            <p
              v-else
              class="flex items-center justify-center h-full text-sm text-slate-400 dark:text-slate-500"
            >
              No model loaded.
            </p>
          </div>
        </template>

        <!-- ── AI Workflow View ── -->
        <template v-else-if="uiStore.activeView === 'ai-guide'">
          <div class="flex-1 flex flex-col min-h-0">
            <AiWorkflowPanel />
          </div>
        </template>
      </main>

      <RightGuidanceSidebar
        :concept-name="selectedNodeId ? knowledgeStore.getNode(selectedNodeId)?.name : null"
        :concept-type="conceptType"
      />

      <ToastMessage />
      <SaveWorkspaceModal />
    </div>
  </div>
</template>
