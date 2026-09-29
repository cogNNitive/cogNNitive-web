<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useModelStore } from '../../stores/modelStore'
import { useUiStore } from '../../stores/uiStore'
import { useMetamodelStore } from '../../stores/metamodelStore'
import { FileText, Calendar, Layers, Database, ChevronRight, Maximize2, X } from 'lucide-vue-next'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { mergeMatrixDefs } from '../../composables/useMatrixDefinitions'
import { getHexColor, getHexColorLight } from '../../composables/useConceptVisuals'
import IconRenderer from './IconRenderer.vue'
import Pill from './Pill.vue'
import mermaid from 'mermaid'

const props = defineProps<{
  rootNodeId: string
}>()

const modelStore = useModelStore()
const uiStore = useUiStore()
const metamodelStore = useMetamodelStore()

const rootNode = computed(() => modelStore.getNode(props.rootNodeId))

// Resolve model metadata
const modelTitle = computed(() => {
  return rootNode.value?.fields?.title?.value || rootNode.value?.name || 'iNNfo Model'
})

const modelVersion = computed(() => {
  if (!rootNode.value?.rawContent) return '0.1.0'
  const fm = parseFrontmatter(rootNode.value.rawContent)
  return ((fm as any)?.knowledge_version || '0.1.0') as string
})

const templateName = computed(() => {
  if (!rootNode.value?.rawContent) return ''
  const fm = parseFrontmatter(rootNode.value.rawContent)
  return ((fm as any)?.parent_spec?.name || (fm as any)?.parent?.name || '') as string
})

const templateVersion = computed(() => {
  if (!rootNode.value?.rawContent) return ''
  const fm = parseFrontmatter(rootNode.value.rawContent)
  return ((fm as any)?.parent_spec?.version || (fm as any)?.parent?.version || '') as string
})

const lastSaved = computed(() => {
  if (!rootNode.value?.rawContent) return '—'
  const fm = parseFrontmatter(rootNode.value.rawContent)
  return ((fm as any)?.last_updated || '—') as string
})

// Resolve effective concepts for this specific model
const concepts = computed(() => metamodelStore.concepts)

const conceptCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const node of Object.values(modelStore.nodes)) {
    if (node.type && node.kind === 'element') {
      const nodeRootId = modelStore.getModelRootForNode(node.id)
      if (nodeRootId === props.rootNodeId) {
        counts[node.type] = (counts[node.type] || 0) + 1
      }
    }
  }
  return counts
})

// Resolve associated matrix definitions
const matrices = computed(() => {
  if (!rootNode.value) return []
  return mergeMatrixDefs(rootNode.value)
})

// Resolve reference fields
const referenceFields = computed(() => {
  const refs: Array<{ source: string; name: string; target: string }> = []
  for (const concept of concepts.value) {
    for (const field of concept.fields || []) {
      if (field.type === 'reference' && field.target_concepts) {
        for (const target of field.target_concepts) {
          // Normalize names to match case sensitivity in node IDs
          refs.push({ source: concept.name, name: field.name, target })
        }
      }
    }
  }
  return refs
})

function selectConcept(conceptName: string): void {
  const virtualId = `virtual:${props.rootNodeId}:${conceptName}`
  uiStore.selectNode(virtualId)
}

// ── Mermaid Diagram Rendering ──
const svgContainer = ref<HTMLDivElement | null>(null)
const renderError = ref('')
let diagramId = 0

const mermaidCode = computed(() => {
  if (concepts.value.length === 0) return ''

  const getMermaidId = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_')

  // Custom styling config using mermaid theme configuration
  const lines = [
    '%%{init: {"theme": "base", "themeVariables": { "primaryColor": "#e0e7ff", "primaryBorderColor": "#6366f1", "lineColor": "#6366f1", "textColor": "#1e293b", "fontSize": "11px" }}}%%',
    'graph TD',
    '  classDef activeConcept fill:#e0e7ff,stroke:#6366f1,stroke-width:2px,color:#312e81,font-weight:bold;',
    '  classDef ghostConcept fill:#f8fafc,stroke:#cbd5e1,stroke-dasharray: 3 3,stroke-width:1px,color:#64748b;',
  ]

  // Define nodes
  for (const concept of concepts.value) {
    const hasElements = (conceptCounts.value[concept.name] || 0) > 0
    const className = hasElements ? 'activeConcept' : 'ghostConcept'
    const label = `${concept.name} (${conceptCounts.value[concept.name] || 0})`
    const id = getMermaidId(concept.name)
    lines.push(`  ${id}["${label}"]`)
    lines.push(`  class ${id} ${className}`)
  }

  // Reference fields: dotted line with arrow and field name
  for (const refField of referenceFields.value) {
    const hasSource = concepts.value.some((c) => c.name === refField.source)
    const hasTarget = concepts.value.some((c) => c.name === refField.target)
    if (hasSource && hasTarget) {
      lines.push(`  ${getMermaidId(refField.source)} -.->|"${refField.name}"| ${getMermaidId(refField.target)}`)
    }
  }

  // Matrices: thick lines representing bidirectional cell evaluation
  for (const matrix of matrices.value) {
    if (matrix.source && matrix.target) {
      const hasSource = concepts.value.some((c) => c.name === matrix.source)
      const hasTarget = concepts.value.some((c) => c.name === matrix.target)
      if (hasSource && hasTarget) {
        lines.push(`  ${getMermaidId(matrix.source)} ===|"${matrix.label || matrix.name}"| ${getMermaidId(matrix.target)}`)
      }
    }
  }

  return lines.join('\n')
})

async function renderDiagram(source: string): Promise<void> {
  if (!svgContainer.value || !source) return
  renderError.value = ''
  try {
    diagramId++
    const id = `mermaid-diagram-${diagramId}`
    const { svg } = await mermaid.render(id, source)
    svgContainer.value.innerHTML = svg
    
    // Override sizing constraints to let the container display a scrollbar rather than scaling down to 0px
    const svgEl = svgContainer.value.querySelector('svg')
    if (svgEl) {
      svgEl.style.maxWidth = 'none'
      svgEl.style.height = 'auto'
    }
  } catch (err) {
    renderError.value = `Metamodel graph rendering error: ${err instanceof Error ? err.message : String(err)}`
    svgContainer.value.innerHTML = ''
    console.error(err)
  }
}

onMounted(() => {
  mermaid.initialize({ startOnLoad: false, theme: 'neutral' })
  if (mermaidCode.value) {
    renderDiagram(mermaidCode.value)
  }
})

watch(mermaidCode, (newCode) => {
  if (newCode) {
    renderDiagram(newCode)
  } else if (svgContainer.value) {
    svgContainer.value.innerHTML = ''
  }
})

// ── Zoom & Pan Interactive Modal state ──
const showModal = ref(false)
const modalSvgContainer = ref<HTMLDivElement | null>(null)
const modalContainerRef = ref<HTMLDivElement | null>(null)

const zoomScale = ref(1.0)
const panX = ref(0)
const panY = ref(0)

const isDragging = ref(false)
let startX = 0
let startY = 0

function zoomIn() {
  zoomScale.value = Math.min(zoomScale.value + 0.15, 3.0)
}

function zoomOut() {
  zoomScale.value = Math.max(zoomScale.value - 0.15, 0.4)
}

function resetZoom() {
  zoomScale.value = 1.0
  panX.value = 0
  panY.value = 0
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.15 : 0.85
  zoomScale.value = Math.max(0.4, Math.min(3.0, zoomScale.value * factor))
}

function startPan(e: MouseEvent) {
  isDragging.value = true
  startX = e.clientX - panX.value
  startY = e.clientY - panY.value
}

function doPan(e: MouseEvent) {
  if (!isDragging.value) return
  panX.value = e.clientX - startX
  panY.value = e.clientY - startY
}

function endPan() {
  isDragging.value = false
}

// When the modal opens, clone the compiled Mermaid SVG into the zoomable workspace
watch(showModal, async (isOpen) => {
  if (isOpen) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (modalSvgContainer.value && svgContainer.value) {
      modalSvgContainer.value.innerHTML = svgContainer.value.innerHTML
      const svgEl = modalSvgContainer.value.querySelector('svg')
      if (svgEl) {
        svgEl.style.maxWidth = 'none'
        svgEl.style.height = 'auto'
      }
      resetZoom()
    }
  }
})
</script>

<template>
  <div class="flex-1 p-6 md:p-10 max-w-5xl mx-auto space-y-8">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
      <div class="space-y-1.5 flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            Model Active
          </span>
          <span class="text-xs text-slate-400 dark:text-slate-500 font-mono">
            v{{ modelVersion }}
          </span>
        </div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 truncate tracking-tight font-sans">
          {{ modelTitle }}
        </h1>
        <p v-if="templateName" class="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Inherits from template: <strong class="text-indigo-600 dark:text-indigo-400 font-mono">{{ templateName }} v{{ templateVersion }}</strong>
        </p>
      </div>

      <!-- Quick Metadata Stats -->
      <div class="flex items-center gap-3.5 text-xs text-slate-500 shrink-0">
        <div class="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center min-w-[100px]">
          <span class="text-3xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Nodes</span>
          <span class="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">{{ Object.keys(modelStore.nodes).length }}</span>
        </div>
        <div class="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center min-w-[100px]">
          <span class="text-3xs text-slate-400 font-bold uppercase tracking-wider mb-1">Last Saved</span>
          <span class="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono truncate max-w-[120px]">{{ lastSaved }}</span>
        </div>
      </div>
    </div>

    <!-- Visual Metamodel Graph (Schema) -->
    <div class="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <Database class="w-4 h-4 text-indigo-500" />
          <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-sans">
            Metamodel Graphic Schema
          </h3>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-4 text-3xs font-medium text-slate-400 mr-2">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-indigo-500"></span> Has Elements</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2 rounded border border-dashed border-slate-400"></span> Empty (Ghost)</span>
          </div>
          <button
            @click="showModal = true"
            class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-650 transition-colors cursor-pointer flex items-center justify-center border border-slate-200 dark:border-slate-700/60"
            title="Full Screen / Zoom"
          >
            <Maximize2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Mermaid container -->
      <div class="relative bg-slate-50/50 dark:bg-slate-950/20 rounded-xl p-4 overflow-auto min-h-[220px] max-h-[360px] border border-slate-150 dark:border-slate-900 flex items-start justify-start">
        <div v-show="!renderError" ref="svgContainer" class="text-left max-w-none overflow-visible select-none"></div>
        <div v-if="renderError" class="text-xs text-rose-500 font-mono bg-rose-50 dark:bg-rose-950/20 px-3 py-2 rounded-lg border border-rose-200 w-full text-center">
          {{ renderError }}
        </div>
      </div>
      
      <p class="text-3xs text-slate-400 dark:text-slate-500 leading-normal leading-relaxed flex items-center justify-between">
        <span><strong>How to read:</strong> Solid lines show taxonomy hierarchy. Dotted lines (-.->) represent reference fields between concepts. Triple lines (===) represent evaluation matrices.</span>
        <button @click="showModal = true" class="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold font-sans cursor-pointer">
          Open interactive viewer &rarr;
        </button>
      </p>
    </div>

    <!-- Zoom & Pan Navigation Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
      <div class="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3.5 shrink-0">
          <div class="flex items-center gap-2">
            <Database class="w-4 h-4 text-indigo-500" />
            <div>
              <h3 class="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-sans">
                {{ modelTitle }} — Metamodel Explorer
              </h3>
              <p class="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">
                Navigate the structural relationship schema of your template.
              </p>
            </div>
          </div>
          <button
            @click="showModal = false"
            class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            title="Close Explorer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Zoom Controls Toolbar -->
        <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950/30 border border-slate-150 dark:border-slate-900 rounded-xl shrink-0">
          <button @click="zoomIn" class="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-250 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-2xs">Zoom In</button>
          <button @click="zoomOut" class="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-250 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-2xs">Zoom Out</button>
          <button @click="resetZoom" class="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-250 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-2xs">Reset View</button>
          <div class="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
          <span class="text-3xs text-slate-400 font-mono font-semibold">Scale: {{ Math.round(zoomScale * 100) }}%</span>
          <div class="flex-1"></div>
          <span class="text-3xs text-slate-400 italic font-medium hidden sm:inline">Drag mouse to pan. Use mouse wheel or scroll to zoom.</span>
        </div>

        <!-- Interactive Diagram Viewport -->
        <div
          ref="modalContainerRef"
          class="flex-1 min-h-0 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl relative overflow-hidden border border-slate-150 dark:border-slate-900 cursor-grab active:cursor-grabbing select-none"
          @mousedown="startPan"
          @mousemove="doPan"
          @mouseup="endPan"
          @mouseleave="endPan"
          @wheel="handleWheel"
        >
          <div
            :style="{
              transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }"
            class="w-full h-full flex items-center justify-center p-8 overflow-visible"
            ref="modalSvgContainer"
          >
            <!-- SVG cloned dynamically -->
          </div>
        </div>
      </div>
    </div>

    <!-- Concept Cards Grid -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-sans">
          Model Structure & concepts
        </h3>
        <span class="text-2xs text-slate-500 dark:text-slate-400 font-sans">
          {{ concepts.length }} concepts defined by template
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div
          v-for="concept in concepts"
          :key="concept.name"
          @click="selectConcept(concept.name)"
          class="group/card flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl hover:border-indigo-400 hover:shadow-xs transition-all duration-200 cursor-pointer"
        >
          <div class="flex items-center gap-3.5 min-w-0">
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/card:scale-105"
              :style="{ backgroundColor: getHexColorLight(getHexColor(concept.color)) }"
            >
              <IconRenderer
                :icon="concept.icon"
                fallback="folder"
                :style="{ color: getHexColor(concept.color), width: '16px', height: '16px' }"
              />
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover/card:text-indigo-650 dark:group-hover/card:text-indigo-400 truncate transition-colors font-sans">
                {{ concept.name }}
              </p>
              <p class="text-2xs text-slate-400 dark:text-slate-500 truncate font-sans">
                {{ concept.type }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Pill
              kind="instance"
              :color="concept.color"
              :name="String(conceptCounts[concept.name] || 0)"
              hide-empty
            />
            <ChevronRight class="w-3.5 h-3.5 text-slate-300 group-hover/card:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
