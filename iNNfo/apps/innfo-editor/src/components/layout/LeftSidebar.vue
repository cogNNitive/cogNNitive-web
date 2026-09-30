<template>
  <aside
    data-testid="left-sidebar"
    class="relative border-r border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 flex flex-col overflow-y-auto shrink-0"
    :style="{ width: width + 'px' }"
  >
    <!-- Resize handle (right edge) -->
    <div
      @pointerdown="startResize"
      class="absolute top-0 right-0 z-30 h-full w-3 touch-none cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
      title="Drag to resize"
      data-testid="resize-handle"
    ></div>

    <div class="px-3 py-4 space-y-4">
      <!-- Breadcrumb navigation for Focused Model Mode -->
      <div
        v-if="uiStore.sidebarMode === 'focused_model'"
        class="flex flex-col gap-1.5 p-2 bg-blue-50/60 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800/60 text-xs"
        data-testid="focused-model-breadcrumbs"
      >
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            class="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-primary transition-colors cursor-pointer text-xs font-medium"
            @click="uiStore.returnToWorkspaceOverview()"
            data-testid="breadcrumb-back-workspace"
            title="Back to Workspace Overview"
          >
            <ArrowLeft class="w-3 h-3 shrink-0" />
            <span>Workspace</span>
            <span class="sr-only">Back to Workspace Overview</span>
          </button>
          <template v-for="(seg, idx) in breadcrumbs.filter((s) => !s.isRoot)" :key="seg.id || idx">
            <span class="text-slate-300 dark:text-slate-600">/</span>
            <span
              v-if="seg.isCurrent"
              class="font-semibold text-blue-700 dark:text-blue-300 truncate max-w-[120px]"
              :title="seg.label"
              data-testid="breadcrumb-terminal"
            >
              {{ seg.label }}
            </span>
            <button
              v-else
              type="button"
              class="text-slate-600 dark:text-slate-400 hover:text-primary transition-colors cursor-pointer truncate max-w-[100px]"
              :title="seg.label"
              @click="seg.id ? uiStore.focusModel(seg.id) : undefined"
              data-testid="breadcrumb-segment"
            >
              {{ seg.label }}
            </button>
          </template>
        </div>
      </div>

      <!-- Header with expand/collapse all (for editor/graph view) -->
      <div class="flex items-center justify-between px-2">
        <div class="flex items-center gap-2 min-w-0">
          <div class="flex items-center gap-1.5 shrink-0">
            <Database class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Workspace
            </h2>
          </div>

          <!-- Compact status pill with tooltip -->
          <div
            v-if="totalModelCount > 0"
            class="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 select-none cursor-help"
            :title="workspaceMetricsTooltip"
            data-testid="workspace-metrics-pill"
          >
            <span class="flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span data-testid="metric-active-count">{{ activeSubmodelCount }}</span>
            </span>
            <span v-if="draftSubmodelCount > 0" class="text-slate-300 dark:text-slate-600">/</span>
            <span v-if="draftSubmodelCount > 0" class="flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span data-testid="metric-draft-count">{{ draftSubmodelCount }}</span>
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="expandAll"
            class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-2xs text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center justify-center"
            title="Expand All"
            data-testid="expand-all"
          >
            <ChevronsDown class="w-3.5 h-3.5" />
          </button>
          <button
            @click="collapseAll"
            class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-2xs text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center justify-center"
            title="Collapse All"
            data-testid="collapse-all"
          >
            <ChevronsUp class="w-3.5 h-3.5" />
          </button>
          <button
            @click.stop="navigateToConfig"
            class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-primary transition-colors cursor-pointer"
            title="Metamatrix Config"
            data-testid="metamatrix-config-button"
          >
            <Settings class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Tree section: complete-only or merged all, grouped by model -->
      <div class="space-y-2 relative overflow-hidden">
        <Transition :name="slideTransitionName" mode="out-in">
          <div :key="uiStore.sidebarMode + '-' + (uiStore.focusedModelId || 'workspace')" class="space-y-2">
            <div v-for="rootId in visibleRootIds" :key="rootId" class="space-y-1">
              <!-- Model Header (File) -->
              <div
                class="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors"
                :class="
                  rootId === activeModelId
                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-100 font-bold ring-1 ring-primary/20'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                "
                data-testid="model-header"
              >
                <!-- Disclosure toggle: expands/collapses the model inline WITHOUT
                     leaving workspace overview mode (F-12). -->
                <button
                  type="button"
                  class="flex items-center justify-center shrink-0 cursor-pointer"
                  @click.stop="toggleModelInline(rootId)"
                  :aria-label="isModelExpanded(rootId) ? 'Collapse model' : 'Expand model'"
                  data-testid="model-header-toggle"
                >
                  <ChevronDown
                    class="transition-transform duration-200 w-3 h-3 text-slate-400 dark:text-slate-500"
                    :class="{ '-rotate-90': !isModelExpanded(rootId) }"
                  />
                </button>
                <!-- Model name: focuses the model (Focused Model Mode). -->
                <button
                  type="button"
                  class="flex items-center gap-1 flex-1 min-w-0 cursor-pointer text-left"
                  @click="focusModelHeader(rootId)"
                  data-testid="model-header-name"
                >
                  <FileText
                    class="w-3.5 h-3.5 shrink-0"
                    :class="
                      rootId === activeModelId ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                    "
                  />
                  <span class="truncate flex-1">{{ getModelName(rootId) }}</span>
                </button>
              </div>

              <!-- Concepts under this Model -->
              <div
                v-if="isModelExpanded(rootId)"
                class="ml-1 pl-0.5 border-l border-slate-200 dark:border-slate-700 space-y-0.5"
              >
                <!-- Active concepts (with items) -->
                <div v-for="item in (activeConceptsByRoot.get(rootId) || [])" :key="item.name">
                  <VirtualGroupNode
                    :concept-name="item.name"
                    :elements="item.elements"
                    :sub-groups="item.children"
                    :selected-id="selectedId"
                    :depth="0"
                    :expanded-generation="expandedGeneration"
                    :ghost="item.ghost"
                    @select="(id: string) => handleSelectNode(rootId, id)"
                    @click-ghost="(cname: string) => handleClickGhost(cname, rootId)"
                  />
                </div>

                <!-- Empty concepts (collapsible accordion at bottom) -->
                <div
                  v-if="(emptyConceptsByRoot.get(rootId)?.length ?? 0) > 0"
                  class="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1"
                  data-testid="empty-groups-section"
                >
                  <div
                    class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none cursor-pointer hover:text-slate-600 dark:hover:text-slate-300"
                    @click.stop="toggleEmptyGroups(rootId)"
                    data-testid="empty-groups-toggle"
                  >
                    <ChevronDown
                      class="transition-transform duration-200 w-2.5 h-2.5 text-slate-400 dark:text-slate-500"
                      :class="{ '-rotate-90': !isEmptyGroupsExpanded(rootId) }"
                    />
                    <Boxes class="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Empty ({{ emptyConceptsByRoot.get(rootId)?.length ?? 0 }})</span>
                  </div>
                  <div
                    v-if="isEmptyGroupsExpanded(rootId)"
                    class="space-y-0.5 mt-0.5 opacity-60 hover:opacity-100 transition-opacity"
                    data-testid="empty-groups-list"
                  >
                    <div v-for="item in (emptyConceptsByRoot.get(rootId) || [])" :key="item.name">
                      <VirtualGroupNode
                        :concept-name="item.name"
                        :elements="item.elements"
                        :sub-groups="item.children"
                        :selected-id="selectedId"
                        :depth="0"
                        :expanded-generation="expandedGeneration"
                        :ghost="item.ghost"
                        @select="(id: string) => handleSelectNode(rootId, id)"
                        @click-ghost="(cname: string) => handleClickGhost(cname, rootId)"
                      />
                    </div>
                  </div>
                </div>

                <p
                  v-if="(activeConceptsByRoot.get(rootId)?.length ?? 0) === 0 && (emptyConceptsByRoot.get(rootId)?.length ?? 0) === 0"
                  class="px-2 py-2 text-2xs text-slate-400 dark:text-slate-500 italic"
                >
                  No nodes loaded
                </p>

                <!-- Relations / Matrices intrinsic to this Model -->
                <div
                  v-if="getMatricesForModel(rootId).length > 0"
                  class="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1"
                >
                  <div
                    class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none cursor-pointer hover:text-slate-600 dark:hover:text-slate-300"
                    @click="toggleRelations(rootId)"
                    data-testid="relations-header"
                  >
                    <ChevronDown
                      class="transition-transform duration-200 w-2.5 h-2.5 text-slate-400 dark:text-slate-500"
                      :class="{ '-rotate-90': !isRelationsExpanded(rootId) }"
                    />
                    <Table2 class="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Relations ({{ getMatricesForModel(rootId).length }})</span>
                  </div>
                  <template v-if="isRelationsExpanded(rootId)">
                    <p
                      v-if="hasUnresolvedMatrixDefs(rootId)"
                      class="px-1.5 text-[10px] leading-snug text-amber-600 dark:text-amber-400"
                      title="Template not resolved — matrices render from model data with empty source/target"
                    >
                      Template not resolved — matrices shown from model data (source/target empty)
                    </p>
                    <div class="space-y-0.5 pl-1">
                      <MatrixPill
                        v-for="matrix in getMatricesForModel(rootId)"
                        :key="matrix.name"
                        :name="matrix.name"
                        :source="matrix.source"
                        :target="matrix.target"
                        :label="matrix.label"
                        :value-count="getMatrixValueCount(matrix.name)"
                        :selected="
                          uiStore.activeMatrixIndex === resolveMatrixIndexByName(matrix.name) &&
                          uiStore.activeView === 'matrices'
                        "
                        :full-width="true"
                        interactive
                        show-source-target
                        as="button"
                        @click="selectModelMatrix(rootId, matrix.name)"
                      />
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <p
              v-if="visibleRootIds.length === 0"
              class="px-2 py-4 text-xs text-slate-400 dark:text-slate-500 italic text-center"
            >
              No models loaded
            </p>
          </div>
        </Transition>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { KnowledgeNode, MetamodelConcept } from '../../model/types'
import { parseFrontmatter, computeModelDagTopology } from '@cognnitive/innfo-core'
import { parseFormatFilename, compareSemVer, type SemVer } from '../../utils/version'
import { resolveEffectiveMetamodel } from '../../model/metamodel'
import {
  ChevronsDown,
  ChevronsUp,
  Table2,
  Settings,
  FileText,
  Database,
  ChevronDown,
  ArrowLeft,
  Boxes,
} from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useMetamodelStore } from '../../stores/metamodelStore'
import { useUiStore } from '../../stores/uiStore'
import { useResizablePanel } from '../../composables/useResizablePanel'
import {
  useMatrixDefinitions,
  mergeMatrixDefs,
  resolveMatrixIndexByName,
  type MatrixDef,
} from '../../composables/useMatrixDefinitions'
import { getConceptMeta } from '../../composables/useConceptVisuals'
import { useTreeExpansion } from '../../composables/useTreeExpansion'
import ConceptTreeNode from './ConceptTreeNode.vue'
import VirtualGroupNode, { type TreeGroup } from './VirtualGroupNode.vue'
import MatrixPill from '../editor/MatrixPill.vue'
import Pill from '../editor/Pill.vue'
import { findMatchingKnowledgeNode, isTemplateNode } from '../../utils/knowledgeMatching'
import { useKnowledgeConcepts } from '../../composables/useKnowledgeConcepts'

const emit = defineEmits<{
  'select-node': [nodeId: string]
  'select-matrix': [idx: number]
  'select-view': [view: string]
}>()

const knowledgeStore = useKnowledgeStore()
const metamodelStore = useMetamodelStore()
const uiStore = useUiStore()

function getModelInfo(rootId: string): { baseName: string; version: SemVer } {
  const rootNode = knowledgeStore.getNode(rootId)
  const path = rootNode?.source?.path || ''
  const filename = path.split('/').pop()?.split('\\').pop() || rootNode?.name || ''

  const parsed = parseFormatFilename(filename)
  if (parsed) {
    return { baseName: parsed.baseName, version: parsed.version }
  }

  let version: SemVer = { major: 0, minor: 0, patch: 0 }
  let baseName = filename.replace(/\.md$/i, '').replace(/_NN$/i, '')
  if (rootNode?.rawContent) {
    try {
      const fm = parseFrontmatter(rootNode.rawContent)
      if (fm?.title) baseName = fm.title
      if (typeof fm?.knowledge_version === 'string') {
        const vMatch =
          fm.knowledge_version.match(/(\d+)\.(\d+)\.(\d+)/) ||
          fm.knowledge_version.match(/(\d+)-(\d+)-(\d+)/)
        if (vMatch) {
          version = { major: Number(vMatch[1]), minor: Number(vMatch[2]), patch: Number(vMatch[3]) }
        }
      }
    } catch {
      // fallback
    }
  }

  const vMatch = filename.match(/_V_(\d+)-(\d+)-(\d+)/i)
  if (vMatch) {
    version = { major: Number(vMatch[1]), minor: Number(vMatch[2]), patch: Number(vMatch[3]) }
    const parts = filename.split(/_V_\d+-\d+-\d+/i)
    if (parts[0]) baseName = parts[0]
  }

  return { baseName, version }
}

const breadcrumbs = computed(() => {
  const modelId = uiStore.focusedModelId || uiStore.activeModelId || ''
  return uiStore.resolveModelAncestry(modelId, knowledgeStore.nodes)
})

const modelDagTopology = computed(() => {
  return computeModelDagTopology(knowledgeStore.nodes)
})

function isModelRoot(node: KnowledgeNode | undefined): boolean {
  if (!node || isTemplateNode(node)) return false
  return node.kind === 'root' || node.parentId === null || knowledgeStore.rootIds.includes(node.id)
}

const visibleRootIds = computed(() => {
  const allModelRoots = Object.values(knowledgeStore.nodes).filter(isModelRoot)
  if (allModelRoots.length === 0) return []

  if (uiStore.sidebarMode === 'focused_model') {
    const focused = uiStore.focusedModelId || uiStore.activeModelId
    if (focused && allModelRoots.some((n) => n.id === focused)) {
      return [focused]
    }
    if (focused) {
      const match = findMatchingKnowledgeNode(allModelRoots, focused)
      if (match) return [match.id]
    }
    return [allModelRoots[0].id]
  }

  // In Workspace Mode: resolve root models via DAG topology (models with inDegree === 0)
  const topology = modelDagTopology.value
  const candidateIds =
    topology.rootIds.length > 0 ? topology.rootIds : allModelRoots.map((n) => n.id)

  // Group by baseName -> keep highest version
  const bestByBaseName = new Map<string, { id: string; version: SemVer }>()
  for (const rid of candidateIds) {
    const node = knowledgeStore.getNode(rid)
    if (!node || isTemplateNode(node)) continue
    const info = getModelInfo(node.id)
    const existing = bestByBaseName.get(info.baseName)
    if (!existing || compareSemVer(info.version, existing.version) > 0) {
      bestByBaseName.set(info.baseName, { id: node.id, version: info.version })
    }
  }

  const deduplicatedRoots = Array.from(bestByBaseName.values()).map((v) => v.id)

  // Prioritize primary root (e.g. domaiNN_NN.md) at index 0 if present
  if (topology.primaryRootId && deduplicatedRoots.includes(topology.primaryRootId)) {
    return [
      topology.primaryRootId,
      ...deduplicatedRoots.filter((id) => id !== topology.primaryRootId),
    ]
  }

  return deduplicatedRoots
})

const totalModelCount = computed(() => {
  return Object.values(knowledgeStore.nodes).filter(isModelRoot).length
})

const activeSubmodelCount = computed(() => {
  let count = 0
  for (const node of Object.values(knowledgeStore.nodes)) {
    if (!isModelRoot(node)) continue
    if (!node.rawContent) {
      count++
      continue
    }
    try {
      const fm = parseFrontmatter(node.rawContent)
      if (fm?.status === 'active' || !fm?.status) count++
    } catch {
      count++
    }
  }
  return count
})

const draftSubmodelCount = computed(() => {
  let count = 0
  for (const node of Object.values(knowledgeStore.nodes)) {
    if (!isModelRoot(node)) continue
    if (!node.rawContent) continue
    try {
      const fm = parseFrontmatter(node.rawContent)
      if (fm?.status === 'draft') count++
    } catch {
      // silent
    }
  }
  return count
})

const workspaceMetricsTooltip = computed(() => {
  return `Workspace Models: ${totalModelCount.value} total (${activeSubmodelCount.value} active, ${draftSubmodelCount.value} draft)`
})

const { width, startResize } = useResizablePanel({
  storageKey: 'format.leftSidebarWidth',
  defaultWidth: 384,
  minWidth: 240,
  maxWidth: 640,
  side: 'right',
})

const activeModelId = computed(() => uiStore.activeModelId || visibleRootIds.value[0] || null)

/** Expands/collapses a model's tree inline while staying in workspace overview mode (F-12). */
function toggleModelInline(rootId: string): void {
  toggleModel(rootId)
}

/** Focuses a model (Focused Model Mode) — distinct from inline expansion. */
function focusModelHeader(rootId: string): void {
  uiStore.focusModel(rootId)
  uiStore.selectNode(rootId)
}

function handleSelectNode(rootId: string, nodeId: string): void {
  uiStore.setActiveModel(rootId)
  emit('select-node', nodeId)
}

function handleClickGhost(conceptName: string, targetRootId?: string): void {
  const rootId = targetRootId ?? activeModelId.value ?? visibleRootIds.value[0]
  if (rootId) uiStore.setActiveModel(rootId)
  const terminalName = conceptName.split(' / ').pop() || conceptName
  const concept =
    metamodelStore.getConceptByName(terminalName) ||
    metamodelStore.getConceptByName(conceptName)
  const targetName = concept?.name ?? terminalName
  const type = concept?.type ?? 'text'
  if (type === 'text') {
    knowledgeStore.addTextSection(targetName, rootId ?? undefined)
    uiStore.selectNode(rootId ?? visibleRootIds.value[0])
  } else {
    const id = knowledgeStore.addConceptElement(targetName, `New ${targetName}`, rootId ?? undefined)
    if (id) uiStore.selectNode(id)
  }
}

// Expand/collapse all + per-model expand state
const { expandedGeneration, expandedModels, expandAll, collapseAll, toggleModel } =
  useTreeExpansion()

// Selected node for highlighting — driven by uiStore in Phase 6
const selectedId = computed(() => uiStore.selectedNodeId)

// Relations section.
const expandedRelations = ref<Record<string, boolean>>({})
const expandedEmptyGroups = ref<Record<string, boolean>>({})

function isRelationsExpanded(rootId: string): boolean {
  return expandedRelations.value[rootId] === true
}

function toggleRelations(rootId: string): void {
  expandedRelations.value[rootId] = !isRelationsExpanded(rootId)
}

function isEmptyGroupsExpanded(rootId: string): boolean {
  return expandedEmptyGroups.value[rootId] === true
}

function toggleEmptyGroups(rootId: string): void {
  expandedEmptyGroups.value[rootId] = !isEmptyGroupsExpanded(rootId)
}

watch(expandedGeneration, (val) => {
  if (val >= 0) {
    for (const rootId of visibleRootIds.value) {
      expandedRelations.value[rootId] = true
      expandedEmptyGroups.value[rootId] = true
    }
  } else {
    for (const rootId of visibleRootIds.value) {
      expandedRelations.value[rootId] = false
      expandedEmptyGroups.value[rootId] = false
    }
  }
})

// IMPORTANT: the pills must list the SAME matrices (and in the SAME order) as
// MatricesGrid renders, because uiStore.activeMatrixIndex is an index into this
// list. Resolving against `knowledgeStore.rootIds` + `merge` keeps the sidebar and
// the grid on one shared index space; using the filtered `visibleRootIds` +
// `fallback` made clicks drift to the previous matrix whenever a hidden
// (lower-version / spec) root declared matrices.
const rootIdsForMatrices = computed(() => knowledgeStore.rootIds)
const { matrixDefs, getMatrixValueCount } = useMatrixDefinitions(rootIdsForMatrices, {
  strategy: 'merge',
})

/** Returns matrix definitions belonging to a specific model node. */
function getMatricesForModel(rootId: string): MatrixDef[] {
  const rootNode = knowledgeStore.getNode(rootId)
  if (!rootNode) return []
  return mergeMatrixDefs(rootNode)
}

/** True when a model's matrices have no source/target — template unresolved, defs came from model blocks. */
function hasUnresolvedMatrixDefs(rootId: string): boolean {
  const rootNode = knowledgeStore.getNode(rootId)
  if (!rootNode) return false
  return mergeMatrixDefs(rootNode).some((d) => !d.source || !d.target)
}

/** Handles selection of a matrix pill belonging to a specific model. */
function selectModelMatrix(rootId: string, matrixName: string): void {
  if (rootId) uiStore.setActiveModel(rootId)
  const idx = resolveMatrixIndexByName(matrixName)
  if (idx !== -1) {
    selectMatrix(idx)
  }
}

/** Matrix definitions for the active model (or all workspace matrices as fallback). */
const activeModelMatrices = computed(() => {
  if (!activeModelId.value) return matrixDefs.value
  const modelDefs = getMatricesForModel(activeModelId.value)
  return modelDefs.length > 0 ? modelDefs : matrixDefs.value
})

/** The matrix currently shown in the matrices view. */
const selectedMatrix = computed(() => {
  const idx = uiStore.activeMatrixIndex
  if (uiStore.activeView !== 'matrices' || idx < 0 || idx >= matrixDefs.value.length) return null
  return matrixDefs.value[idx]
})

/** Value distribution over ALL cells of the selected matrix (not just visible). */
const selectedMatrixDistribution = computed(() => {
  if (!selectedMatrix.value) return {} as Record<string, number>
  const counts: Record<string, number> = {}
  const prefix = selectedMatrix.value.name + '||'
  for (const node of Object.values(knowledgeStore.nodes)) {
    if (!node.fields) continue
    for (const [key, fv] of Object.entries(node.fields)) {
      if (!key.startsWith(prefix)) continue
      const val = (fv as any)?.value
      const strVal = val === undefined || val === null || val === '-' ? '-' : String(val)
      counts[strVal] = (counts[strVal] || 0) + 1
    }
  }
  return counts
})

function selectMatrix(idx: number): void {
  emit('select-matrix', idx)
  emit('select-view', 'matrices')
}

function navigateToConfig(): void {
  emit('select-view', 'metamatrix-config')
}

// ── Model-based Concept grouping (Opción A) ──

const slideTransitionName = computed(() => {
  return uiStore.sidebarMode === 'focused_model' ? 'sidebar-slide-forward' : 'sidebar-slide-backward'
})

function handleGlobalKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && uiStore.sidebarMode === 'focused_model') {
    uiStore.returnToWorkspaceOverview()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch(
  [visibleRootIds, () => uiStore.sidebarMode],
  ([ids, mode]) => {
    for (const id of ids) {
      if (mode === 'focused_model') {
        expandedModels.value[id] = true
      } else if (expandedModels.value[id] === undefined) {
        expandedModels.value[id] = false
      }
    }
  },
  { immediate: true },
)

function isModelExpanded(rootId: string): boolean {
  if (uiStore.sidebarMode === 'focused_model') return true
  return expandedModels.value[rootId] === true
}

function getModelName(rootId: string): string {
  const rootNode = knowledgeStore.getNode(rootId)
  const path = rootNode?.source?.path || ''
  if (!path) return 'model.md'
  return path.split('/').pop()?.split('\\').pop() || path
}

const {
  getConceptsForModel,
  getActiveConceptsForModel,
  getEmptyConceptsForModel,
  activeConceptsByRoot,
  emptyConceptsByRoot,
} = useKnowledgeConcepts()
</script>

<style scoped>
/* Slide Horizontal Transition (250ms) — a navigation-weight transition, not
   the previous 1.1s "Ultra Lenta" one, which made every model click feel
   broken (F-12). */
.sidebar-slide-forward-enter-active,
.sidebar-slide-forward-leave-active,
.sidebar-slide-backward-enter-active,
.sidebar-slide-backward-leave-active {
  transition:
    transform 250ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 250ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
}

.sidebar-slide-forward-enter-from {
  transform: translateX(36px);
  opacity: 0;
}

.sidebar-slide-forward-leave-to {
  transform: translateX(-36px);
  opacity: 0;
}

.sidebar-slide-backward-enter-from {
  transform: translateX(-36px);
  opacity: 0;
}

.sidebar-slide-backward-leave-to {
  transform: translateX(36px);
  opacity: 0;
}
</style>

