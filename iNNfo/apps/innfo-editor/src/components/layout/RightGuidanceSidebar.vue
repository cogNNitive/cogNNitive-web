<template>
  <div
    data-testid="right-guidance-sidebar"
    class="relative flex shrink-0"
    :class="[isCollapsed ? 'w-0 transition-all duration-300 ease-in-out' : '']"
    :style="isCollapsed ? {} : { width: width + 'px' }"
  >
    <!-- Resize handle (left edge) -->
    <div
      v-if="!isCollapsed"
      @pointerdown="startResize"
      class="absolute top-0 left-0 z-30 h-full w-3 touch-none cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
      title="Drag to resize"
      data-testid="resize-handle"
    ></div>

    <!-- Collapse Button Trigger when Collapsed -->
    <button
      v-if="isCollapsed"
      @click="isCollapsed = false"
      class="absolute top-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary transition-all duration-200 cursor-pointer hover:scale-105"
      title="Show Guidance Panel"
    >
      <BookOpen class="w-4 h-4" />
    </button>

    <!-- Sidebar Container -->
    <aside
      :class="[
        isCollapsed
          ? 'w-0 opacity-0 border-l-0 p-0 pointer-events-none'
          : 'w-full opacity-100 border-l border-slate-200 dark:border-slate-700 p-6',
        'bg-slate-50 dark:bg-slate-900/40 flex flex-col overflow-y-auto shrink-0 transition-all duration-300 ease-in-out relative h-full',
      ]"
    >
      <!-- Collapse Button Inside Sidebar (top right when open) -->
      <button
        v-if="!isCollapsed"
        @click="isCollapsed = true"
        class="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        title="Hide Guidance Panel"
      >
        <ChevronRight class="w-4 h-4" />
      </button>

      <!-- Guidance Content (only when a concept is selected) -->
      <div v-if="conceptType" class="space-y-6 mt-8">
        <!-- Title -->
        <div>
          <div class="flex items-center gap-2">
            <IconRenderer
              icon="info"
              fallback="info"
              custom-class="w-6 h-6 text-primary shrink-0"
            />
            <h2
              class="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide"
            >
              {{ conceptName || conceptType }} Guidance
            </h2>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Methodology and instructions to fill this section.
          </p>
        </div>

        <!-- Taxonomy / Perspective -->
        <div v-if="treeBreadcrumb.length > 0" class="space-y-2">
          <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Perspective
          </h3>
          <div class="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div class="flex items-center gap-1 flex-wrap">
              <template v-for="(crumb, i) in treeBreadcrumb" :key="i">
                <span v-if="i > 0" class="text-slate-300 dark:text-slate-600">&rarr;</span>
                <span
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium"
                  :class="crumbClass(crumb)"
                  >{{ crumb.name }}</span
                >
              </template>
            </div>
          </div>
        </div>

        <!-- Taxonomy Fields -->
        <div v-if="taxonomyFields.length > 0" class="space-y-2">
          <h3 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Classification
          </h3>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="tf in taxonomyFields"
              :key="tf.name"
              class="inline-flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-full border border-primary/20 bg-primary/5 text-primary"
            >
              {{ tf.name }}: {{ tf.value }}
            </span>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="flex items-center justify-center py-8">
          <span class="text-xs text-slate-400 italic">Loading guidance...</span>
        </div>

        <template v-else>
          <!-- Summary (highlighted block) -->
          <div
            v-if="guidance?.summary"
            class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200 font-medium leading-relaxed"
          >
            {{ guidance.summary }}
          </div>

          <!-- Description -->
          <div v-if="guidance?.description" class="space-y-2">
            <h3
              class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
            >
              Description
            </h3>
            <div
              class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed"
              v-html="renderMarkdown(guidance.description)"
            ></div>
          </div>

          <!-- Associated Matrices -->
          <div v-if="associatedMatrices.length > 0" class="space-y-2">
            <h3
              class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
            >
              Associated Matrices
            </h3>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="matrix in associatedMatrices"
                :key="matrix.name"
                @click="navigateToMatrix(matrix.name)"
                class="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer"
              >
                {{ matrix.name }}
              </button>
            </div>
          </div>

          <!-- Suggested Prompts -->
          <div v-if="guidance?.prompts?.length" class="space-y-2">
            <h3
              class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
            >
              Suggested Prompts
            </h3>
            <ul class="space-y-1">
              <li
                v-for="(prompt, i) in guidance.prompts"
                :key="i"
                class="flex items-start gap-2 group"
              >
                <code
                  class="flex-1 text-2xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-1 leading-relaxed break-all"
                  >{{ prompt }}</code
                >
                <button
                  @click="copyPrompt(prompt)"
                  class="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  title="Copy prompt"
                >
                  <Copy class="w-3 h-3 text-slate-400" />
                </button>
              </li>
            </ul>
          </div>

          <!-- No Guidance Fallback -->
          <div
            v-if="!guidance"
            class="text-slate-400 dark:text-slate-500 text-xs italic text-center my-auto"
          >
            No guidance available for this concept.
          </div>
        </template>
      </div>

      <!-- No Concept Selected Fallback -->
      <div v-else class="text-slate-400 dark:text-slate-500 text-xs italic text-center my-auto">
        Select a node to view guidance.
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ChevronRight, BookOpen, Copy } from 'lucide-vue-next'
import IconRenderer from '../editor/IconRenderer.vue'
import { useResizablePanel } from '../../composables/useResizablePanel'
import { useMetamodelStore } from '../../stores/metamodelStore'
import { useModelStore } from '../../stores/modelStore'
import { useUiStore } from '../../stores/uiStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { parseFormatFilename } from '../../utils/version'
import { resolveMatrixIndexByName } from '../../composables/useMatrixDefinitions'
import type { DocumentationEntry } from '../../utils/documentationParser'
import type { MatrixDecl } from '@cognnitive/innfo-core'

const props = defineProps<{
  conceptName?: string | null
  conceptType?: string | null
}>()

const metamodelStore = useMetamodelStore()
const modelStore = useModelStore()
const uiStore = useUiStore()
const workspaceStore = useWorkspaceStore()

const isCollapsed = ref(false)

watch(
  () => uiStore.activeView,
  (newView) => {
    if (newView === 'matrices') {
      isCollapsed.value = true
    }
  },
  { immediate: true },
)
const guidance = ref<DocumentationEntry | null>(null)
const loading = ref(false)

const TAXONOMY_FIELD_NAMES = new Set([
  'category',
  'type',
  'domain',
  'sector',
  'industry',
  'field',
  'area',
  'discipline',
  'genre',
  'kind',
  'nature',
  'classification',
  'group',
  'family',
])

const selectedModelNode = computed(() => {
  const id = uiStore.selectedNodeId
  return id ? modelStore.getNode(id) : null
})

const treeBreadcrumb = computed(() => {
  const node = selectedModelNode.value
  if (!node) return []
  const crumbs: Array<{ name: string; type: string }> = []
  let current = node
  while (current) {
    crumbs.unshift({ name: current.name, type: current.type || 'node' })
    if (!current.parentId) break
    const nextNode = modelStore.getNode(current.parentId)
    if (!nextNode) break
    current = nextNode
  }
  return crumbs
})

const taxonomyFields = computed(() => {
  const node = selectedModelNode.value
  if (!node?.fields) return []
  const result: Array<{ name: string; value: string }> = []
  for (const [key, fv] of Object.entries(node.fields)) {
    if (TAXONOMY_FIELD_NAMES.has(key.toLowerCase()) && fv.value != null && fv.value !== '') {
      result.push({ name: key, value: String(fv.value) })
    }
  }
  return result
})

function crumbClass(crumb: { name: string; type: string }): string {
  if (crumb.type === 'root') return 'bg-primary/10 text-primary font-semibold'
  if (crumb.type === 'concept' || ['Topic', 'Persona'].includes(crumb.type))
    return 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
  return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
}

const { width, startResize } = useResizablePanel({
  storageKey: 'format.rightSidebarWidth',
  defaultWidth: 320,
  minWidth: 240,
  maxWidth: 640,
  side: 'left',
})

/**
 * Computes matrices from the root node frontmatter where source or target
 * matches the current conceptType.
 */
const associatedMatrices = computed<MatrixDecl[]>(() => {
  if (!props.conceptType) return []
  const rootId = modelStore.rootIds[0]
  if (!rootId) return []
  const root = modelStore.getNode(rootId)
  if (!root?.rawContent) return []
  const fm = parseFrontmatter(root.rawContent)
  if (!fm?.matrices) return []
  const lowerType = props.conceptType.toLowerCase()
  return fm.matrices.filter(
    (m) => m.source.toLowerCase() === lowerType || m.target.toLowerCase() === lowerType,
  )
})

/**
 * Extracts template version from raw frontmatter (mirrors the logic in
 * metamodelStore.extractTemplateVersionFromRaw).
 */
function extractVersion(raw: string): string {
  const templateSection = raw.match(/^template:\s*\n((?:\s+[^\n]+\n)*)/m)
  if (templateSection) {
    const vMatch = templateSection[1].match(/version:\s*["']([^"'\n]+)["']/)
    if (vMatch) return vMatch[1]
  }
  const mvMatch = raw.match(/^knowledge_version:\s*["']([^"'\n]+)["']/m)
  return mvMatch?.[1] ?? ''
}

/**
 * Loads guidance for the current conceptType: triggers documentation load
 * from disk if not already cached, then reads the entry.
 */
async function loadGuidance(): Promise<void> {
  if (!props.conceptType) {
    guidance.value = null
    return
  }

  const key = props.conceptType.toLowerCase()
  // Serve from cache immediately if available
  if (metamodelStore.documentation[key]) {
    guidance.value = metamodelStore.documentation[key]
    return
  }

  // Trigger explicit documentation load if workspace is open
  if (Object.keys(metamodelStore.documentation).length === 0 && workspaceStore.handle) {
    const rootId = modelStore.rootIds[0]
    if (rootId) {
      const rootNode = modelStore.getNode(rootId)
      if (rootNode) {
        const parsed = parseFormatFilename(rootNode.source.path)
        const templateName = parsed?.templateName ?? ''
        const templateVersion = extractVersion(rootNode.rawContent ?? '')
        if (templateName && templateVersion) {
          loading.value = true
          try {
            await metamodelStore.loadDocumentation(
              workspaceStore.handle,
              templateName,
              templateVersion,
            )
          } finally {
            loading.value = false
          }
        }
      }
    }
  }

  guidance.value = metamodelStore.getConceptGuidance(props.conceptType)
}

watch(
  () => props.conceptType,
  () => {
    loadGuidance()
  },
)

onMounted(() => {
  loadGuidance()
})

/** Navigates to the matrices view and selects the given matrix by name. */
function navigateToMatrix(matrixName: string): void {
  // Resolve against the authoritative merged list (the same index space
  // MatricesGrid renders), not the raw frontmatter order of the first root.
  const idx = resolveMatrixIndexByName(matrixName)
  if (idx >= 0) {
    uiStore.setActiveMatrixIndex(idx)
    uiStore.setActiveView('matrices')
  }
}

/** Copies prompt text to clipboard with silent fallback for older browsers. */
function copyPrompt(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  })
}

/** Renders inline markdown (bold, code, line breaks) to HTML safely. */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(
      /`(.+?)`/g,
      '<code class="bg-amber-50 dark:bg-amber-900/30 px-1 rounded text-amber-700 dark:text-amber-300">$1</code>',
    )
    .replace(/\n/g, '<br>')
}
</script>
