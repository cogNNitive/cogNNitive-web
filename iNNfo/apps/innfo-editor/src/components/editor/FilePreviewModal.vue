<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      @click.self="close"
    >
      <div
        class="relative flex flex-col w-[92vw] max-w-4xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-label="File Preview"
        @keydown.escape="close"
      >
        <!-- Modal Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center border"
              :class="meta.iconWrap"
            >
              <component :is="meta.headerIcon" class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-xs font-bold border" :class="meta.badge">
                  {{ meta.label }}
                </span>
                <h2 class="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {{ fileName }}
                </h2>
                <span
                  v-if="slug || unit"
                  class="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  {{
                    unit
                      ? unitLabel(unit, subunits ?? [])
                      : resolvedSection
                        ? resolvedSection.heading.text
                        : slug
                  }}
                </span>
              </div>
              <p
                class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate max-w-xl"
              >
                {{ filePath }}
              </p>
            </div>

            <!-- Toggle Mode (only if Markdown, HTML or source) -->
            <div
              v-if="isMarkdown || isHtml || kind === 'source'"
              class="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-2xs ml-4 shrink-0"
            >
              <button
                @click="viewMode = 'preview'"
                class="px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer"
                :class="
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                "
              >
                Vista Previa
              </button>
              <button
                @click="viewMode = 'code'"
                class="px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer"
                :class="
                  viewMode === 'code'
                    ? 'bg-white dark:bg-slate-700 text-slate-850 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                "
              >
                Código
              </button>
              <button
                @click="viewMode = 'lineage'"
                class="px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1"
                :class="
                  viewMode === 'lineage'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                "
              >
                <GitFork class="w-3 h-3" />
                Linaje
              </button>
            </div>
          </div>
          <button
            @click="close"
            class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Metadata Panel -->
        <div
          class="px-6 py-3 bg-slate-100/60 dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800 shrink-0"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div
              class="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700"
            >
              <FileText class="w-4 h-4 shrink-0" :class="meta.metaIcon" />
              <div class="min-w-0 flex-1">
                <span class="text-[10px] uppercase font-bold text-slate-400 block leading-none"
                  >Archivo Original</span
                >
                <span
                  class="font-mono text-xs truncate block font-medium"
                  :title="metadata.source_file || filePath"
                >
                  {{ metadata.source_file || 'N/A' }}
                </span>
              </div>
              <button
                v-if="metadata.source_file"
                type="button"
                class="p-1 rounded-md text-slate-400 transition-colors cursor-pointer shrink-0"
                :class="meta.openHover"
                title="Abrir archivo original en una pestaña nueva"
                @click="openOriginalFile"
              >
                <ExternalLink class="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              class="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700"
            >
              <Hash class="w-4 h-4 text-indigo-500 shrink-0" />
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block leading-none"
                  >SHA-256 Hash</span
                >
                <span
                  class="font-mono text-[11px] truncate block font-medium"
                  :title="metadata.sha256 || 'N/A'"
                >
                  {{ metadata.sha256 ? metadata.sha256.substring(0, 14) + '...' : 'Trazable' }}
                </span>
              </div>
            </div>

            <div
              class="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700"
            >
              <HardDrive class="w-4 h-4 text-emerald-500 shrink-0" />
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block leading-none"
                  >Tamaño / Estado</span
                >
                <span class="font-mono text-xs truncate block font-medium">
                  {{ metadata.size_bytes ? formatBytes(metadata.size_bytes) : 'Normalizado' }}
                </span>
              </div>
            </div>

            <div
              class="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700"
            >
              <Clock class="w-4 h-4 text-amber-500 shrink-0" />
              <div class="min-w-0">
                <span class="text-[10px] uppercase font-bold text-slate-400 block leading-none"
                  >Normalizado At</span
                >
                <span class="font-mono text-[11px] truncate block font-medium">
                  {{ metadata.normalized_at ? formatDate(metadata.normalized_at) : 'Reciente' }}
                </span>
              </div>
            </div>
          </div>
          <p v-if="openOriginalError" class="mt-2 text-[11px] text-red-500 dark:text-red-400">
            No se pudo abrir el archivo original: {{ openOriginalError }}
          </p>
        </div>

        <!-- File Content Display Area -->
        <div
          class="flex-1 overflow-y-auto p-6 transition-all"
          :class="[
            viewMode === 'preview' && isMarkdown
              ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-8 max-w-none'
              : viewMode === 'lineage'
                ? 'bg-slate-50 dark:bg-slate-900/60 p-6'
                : 'font-mono text-xs leading-relaxed bg-slate-900 text-slate-100 dark:bg-slate-950',
          ]"
        >
          <div
            v-if="loading"
            class="flex flex-col items-center justify-center py-16 gap-3 text-slate-400"
          >
            <div
              class="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
              :class="meta.spinner"
            ></div>
            <span>Cargando contenido...</span>
          </div>

          <div
            v-else-if="error"
            class="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs"
          >
            <p class="font-bold flex items-center gap-2">
              <X class="w-4 h-4 text-red-400" />
              No se pudo cargar el archivo
            </p>
            <p class="mt-1 font-mono text-slate-400">{{ error }}</p>
          </div>

          <!-- Preview Mode for Images -->
          <div
            v-else-if="viewMode === 'preview' && isImage"
            class="flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900 rounded-xl h-[60vh] overflow-auto"
          >
            <img
              :src="objectUrl"
              class="max-w-full max-h-full object-contain rounded-lg shadow-md border border-slate-200 dark:border-slate-800"
              :alt="fileName"
            />
          </div>

          <!-- Preview Mode for PDFs -->
          <div
            v-else-if="viewMode === 'preview' && isPdf"
            class="w-full h-[60vh] bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden"
          >
            <iframe :src="objectUrl" class="w-full h-full border-0 rounded-xl"></iframe>
          </div>

          <!-- Preview Mode for HTML -->
          <div
            v-else-if="viewMode === 'preview' && isHtml"
            class="w-full h-[60vh] bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <iframe
              :src="objectUrl"
              :srcdoc="rawContent"
              class="w-full h-full border-0 rounded-xl"
              sandbox="allow-scripts allow-forms allow-popups"
            ></iframe>
          </div>

          <!-- Preview Mode for Markdown -->
          <div
            v-else-if="viewMode === 'preview' && isMarkdown"
            class="markdown-body"
            v-html="formattedHtml"
          ></div>

          <!-- Preview Mode for CSV -->
          <div
            v-else-if="viewMode === 'preview' && isCsv"
            class="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800"
          >
            <table class="w-full text-xs font-mono border-collapse">
              <thead class="sticky top-0 bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th
                    v-for="(h, cIdx) in csvHeaders"
                    :key="cIdx"
                    class="px-3 py-2 text-left font-bold border-b border-slate-200 dark:border-slate-700"
                  >
                    {{ h }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, rIdx) in csvRows"
                  :key="rIdx"
                  :data-csv-row="rIdx"
                  :class="isCsvRowTargeted(rIdx) ? `unit-targeted font-bold ${meta.highlight}` : ''"
                >
                  <td
                    v-for="(cell, cIdx) in row"
                    :key="cIdx"
                    :data-csv-cell="`${rIdx}:${cIdx}`"
                    class="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800"
                    :class="
                      isCsvCellTargeted(rIdx, cIdx)
                        ? `unit-targeted font-bold ${meta.highlight}`
                        : ''
                    "
                  >
                    {{ cell }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Lineage Mode (Mermaid) -->
          <div
            v-else-if="viewMode === 'lineage'"
            class="flex flex-col items-center justify-center min-h-[300px] w-full"
          >
            <div
              v-if="!lineageMermaidCode"
              class="text-center text-slate-400 py-12 text-xs font-sans"
            >
              No hay información de linaje disponible para este archivo.
            </div>
            <template v-else>
              <button
                v-if="hiddenOutgoingCount > 0"
                type="button"
                class="mb-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer self-end"
                @click="showOutgoing = !showOutgoing"
              >
                {{
                  showOutgoing
                    ? 'Ocultar relaciones salientes'
                    : `Mostrar +${hiddenOutgoingCount} hidden`
                }}
              </button>
              <div class="w-full overflow-auto py-4">
                <div class="w-max mx-auto">
                  <MermaidWidget :model-value="lineageMermaidCode" readonly />
                </div>
              </div>
            </template>
          </div>

          <!-- Code / Text Line-by-Line Mode -->
          <div v-else class="space-y-1">
            <div
              v-for="(line, idx) in lines"
              :key="idx"
              :id="`line-${idx + 1}`"
              class="flex items-start gap-4 px-2 py-0.5 rounded transition-colors"
              :class="
                isLineTargeted(idx + 1)
                  ? `unit-targeted font-bold border-l-4 pl-3 ${meta.highlight}`
                  : ''
              "
            >
              <span
                class="w-8 shrink-0 text-right select-none text-slate-600 text-[11px] font-mono"
              >
                {{ idx + 1 }}
              </span>
              <span class="whitespace-pre-wrap break-words flex-1 font-mono">
                {{ line }}
              </span>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div
          class="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between shrink-0"
        >
          <span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 class="w-4 h-4 text-emerald-500" />
            Trazabilidad verificada con especificación iNNfo V_0-2-1
          </span>
          <button
            @click="close"
            class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Link,
  FileOutput,
  Sparkles,
  X,
  FileText,
  Hash,
  HardDrive,
  Clock,
  CheckCircle2,
  ExternalLink,
  GitFork,
} from 'lucide-vue-next'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useModelStore } from '../../stores/modelStore'
import MermaidWidget from '../../shared/widgets/MermaidWidget.vue'
import {
  resolveHeadingSection,
  parseCsvTable,
  normalizeName,
  unitLabel,
  type KnowledgeUnit,
} from '../../utils/sourceRef'
import { useUnitResolution } from '../../composables/useUnitResolution'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { renderMarkdown } from '../../utils/markdown'
import { toSafeNavigationUrl } from '../../utils/safe-url'

const props = defineProps<{
  isOpen: boolean
  kind: 'artifact' | 'source' | 'model' | 'file'
  filePath: string
  fileName: string
  slug?: string
  unit?: KnowledgeUnit
  subunits?: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const workspaceStore = useWorkspaceStore()
const modelStore = useModelStore()

const KIND_META = {
  source: {
    label: 'Fuente',
    headerIcon: Link,
    iconWrap:
      'bg-slate-600/10 dark:bg-slate-400/20 text-slate-600 dark:text-slate-300 border-slate-500/20',
    badge:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300/60 dark:border-slate-600',
    spinner: 'border-slate-500',
    metaIcon: 'text-slate-500',
    openHover:
      'hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60',
    highlight: 'bg-slate-700/60 text-slate-100 border-slate-400',
  },
  artifact: {
    label: 'Artefacto',
    headerIcon: FileOutput,
    iconWrap:
      'bg-slate-900/10 dark:bg-slate-100/10 text-slate-900 dark:text-slate-100 border-slate-900/20',
    badge:
      'bg-slate-900/10 dark:bg-slate-100/10 text-slate-900 dark:text-slate-100 border-slate-900/30 dark:border-slate-100/30',
    spinner: 'border-slate-900 dark:border-slate-100',
    metaIcon: 'text-slate-900 dark:text-slate-100',
    openHover:
      'hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60',
    highlight: 'bg-slate-900/70 text-white border-slate-400',
  },
  model: {
    label: 'Modelo',
    headerIcon: Sparkles,
    iconWrap:
      'bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    badge:
      'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300/60 dark:border-indigo-700',
    spinner: 'border-indigo-500',
    metaIcon: 'text-indigo-500',
    openHover:
      'hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40',
    highlight: 'bg-indigo-900/60 text-indigo-100 border-indigo-500',
  },
  file: {
    label: 'Archivo',
    headerIcon: FileText,
    iconWrap: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
    badge:
      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300/60 dark:border-slate-600',
    spinner: 'border-slate-400',
    metaIcon: 'text-slate-400',
    openHover:
      'hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60',
    highlight: 'bg-slate-600/60 text-slate-100 border-slate-400',
  },
} as const

const meta = computed(() => KIND_META[props.kind])

const loading = ref(false)
const error = ref<string | null>(null)
const rawContent = ref('')
const metadata = ref<{
  source_file?: string
  sha256?: string
  size_bytes?: number
  normalized_at?: string
}>({})
const openOriginalError = ref<string | null>(null)

const viewMode = ref<'preview' | 'code' | 'lineage'>('preview')
const objectUrl = ref('')

// 4th-level outgoing relationships (from a citing element) are collapsed by
// default; see lineage-graph-legibility spec.
const showOutgoing = ref(false)

const hiddenOutgoingCount = computed(() => {
  if (props.kind !== 'source' && !isMarkdown.value) return 0
  const citations = modelStore.getSourceCitations(props.filePath)
  let total = 0
  for (const c of citations) {
    const outRels = (c.relationships ?? []).filter((r) => r.origin !== 'source')
    if (showOutgoing.value) {
      if (outRels.length > 3) total += outRels.length - 3
    } else {
      total += outRels.length
    }
  }
  return total
})

const lineageMermaidCode = computed(() => {
  if (props.kind !== 'source' && !isMarkdown.value) return ''

  // 1. Upstream node (Original source file from frontmatter)
  const upFile = metadata.value.source_file
  const upHash = metadata.value.sha256 ? metadata.value.sha256.substring(0, 8) + '...' : ''

  // 2. Focal node (Current source)
  const focalTitle = props.fileName + (props.slug ? ' (#' + props.slug + ')' : '')

  // 3. Downstream citations from modelStore
  const citations = modelStore.getSourceCitations(props.filePath)

  // Build Mermaid graph TD lines, rendered at natural size (no shrink-to-fit).
  const chartLines: string[] = [
    '%%{init: {"flowchart": {"useMaxWidth": false}}}%%',
    'graph TD',
  ]

  // Sanitizer for Mermaid labels
  const sanitize = (text: string) => text.replace(/["\n\r\[\]\(\)\{\}]/g, ' ').trim()

  chartLines.push(`  FOCAL["🔍 ${sanitize(focalTitle)}"]:::focal`)

  if (upFile) {
    const upLabel = `📄 ${sanitize(upFile)}${upHash ? ` [${upHash}]` : ''}`
    chartLines.push(`  UP["${upLabel}"]:::upstream`)
    chartLines.push(`  UP -->|normalizado| FOCAL`)
  }

  if (citations.length === 0) {
    chartLines.push(`  EMPTY["(Sin citaciones en modelos)"]:::emptyNode`)
    chartLines.push(`  FOCAL -.-> EMPTY`)
  } else {
    // Group citations by nodeId to avoid duplicate nodes
    const seenNodes = new Set<string>()
    const seenEdges = new Set<string>()

    citations.forEach((c, idx) => {
      const nodeId = `N_${idx}`
      const nodeLabel = `🧩 ${sanitize(c.conceptType)}: ${sanitize(c.nodeName)}`
      if (!seenNodes.has(c.nodeId)) {
        seenNodes.add(c.nodeId)
        chartLines.push(`  ${nodeId}["${nodeLabel}"]:::modelNode`)
      }

      const edgeKey = `FOCAL->${nodeId}`
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey)
        const edgeLabel = c.headingSlug ? `cita #${sanitize(c.headingSlug)}` : 'cita'
        chartLines.push(`  FOCAL -->|${edgeLabel}| ${nodeId}`)
      }

      // Outgoing relationships from this citing element (4th nesting level).
      // Collapsed by default: hidden entirely behind a "+N hidden" node.
      const outRels = (c.relationships ?? []).filter((r) => r.origin !== 'source')
      if (!showOutgoing.value) {
        if (outRels.length > 0) {
          const moreId = `R_${idx}_more`
          chartLines.push(`  ${moreId}["+${outRels.length} hidden"]:::emptyNode`)
          chartLines.push(`  ${nodeId} -.-> ${moreId}`)
        }
      } else {
        outRels.slice(0, 3).forEach((rel, rIdx) => {
          const targetNode = modelStore.getNode(rel.targetId)
          const targetName = targetNode?.name ?? rel.targetId
          const targetType = targetNode?.type ?? 'Elemento'
          const targetId = `R_${idx}_${rIdx}`
          const targetLabel = `🔗 ${sanitize(targetType)}: ${sanitize(targetName)}`
          chartLines.push(`  ${targetId}["${targetLabel}"]:::relNode`)
          chartLines.push(`  ${nodeId} -.->|${sanitize(rel.label || 'rel')}| ${targetId}`)
        })
        if (outRels.length > 3) {
          const moreId = `R_${idx}_more`
          chartLines.push(`  ${moreId}["+${outRels.length - 3} hidden"]:::emptyNode`)
          chartLines.push(`  ${nodeId} -.-> ${moreId}`)
        }
      }
    })
  }

  // Styling
  chartLines.push('  classDef focal fill:#eef2ff,stroke:#6366f1,stroke-width:2px,font-weight:bold;')
  chartLines.push(
    '  classDef upstream fill:#f8fafc,stroke:#94a3b8,stroke-width:1px,stroke-dasharray: 4 4;',
  )
  chartLines.push('  classDef modelNode fill:#f0fdf4,stroke:#22c55e,stroke-width:1.5px;')
  chartLines.push('  classDef relNode fill:#fdf4ff,stroke:#d946ef,stroke-width:1px;')
  chartLines.push(
    '  classDef emptyNode fill:#f1f5f9,stroke:#cbd5e1,stroke-width:1px,stroke-dasharray: 3 3;',
  )

  return chartLines.join('\n')
})

const extension = computed(() => {
  const parts = props.fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
})

const isMarkdown = computed(() => extension.value === 'md')
const isHtml = computed(() => ['html', 'htm'].includes(extension.value))
const isImage = computed(() =>
  ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension.value),
)
const isPdf = computed(() => extension.value === 'pdf')
const formattedHtml = computed(() => renderMarkdown(rawContent.value))

const lines = computed(() => rawContent.value.split('\n'))

const resolvedSection = computed(() => {
  if (!props.slug || !rawContent.value) return null
  return resolveHeadingSection(rawContent.value, props.slug)
})

const { resolveTarget, resolvedRowIndex, scrollToResolved } = useUnitResolution()

const isCsv = computed(() => extension.value === 'csv')

const resolvedUnit = computed(() => {
  if (!props.unit || !rawContent.value) return null
  return resolveTarget(
    rawContent.value,
    props.filePath,
    props.fileName,
    props.unit,
    props.subunits ?? [],
  )
})

const unitSection = computed(() => {
  if (!props.unit || props.unit.kind !== 'header' || !rawContent.value) return null
  return resolveHeadingSection(rawContent.value, props.unit.slug)
})

const csvTable = computed(() => {
  if (!isCsv.value || !rawContent.value) return null
  try {
    return parseCsvTable(rawContent.value)
  } catch {
    return null
  }
})
const csvHeaders = computed(() => csvTable.value?.headers ?? [])
const csvRows = computed(() => csvTable.value?.rows ?? [])

function isCsvRowTargeted(rowIdx: number): boolean {
  const idx = resolvedRowIndex(resolvedUnit.value)
  return idx !== null && idx === rowIdx
}

function isCsvCellTargeted(rowIdx: number, colIdx: number): boolean {
  const u = resolvedUnit.value
  if (!u || u.kind !== 'cell') return false
  const header = csvHeaders.value[colIdx]
  if (header === undefined) return false
  return u.row === rowIdx && normalizeName(u.column) === normalizeName(header)
}

function isLineTargeted(lineNum: number): boolean {
  const u = resolvedUnit.value
  if (u?.kind === 'field') {
    // lineNum is 1-based; resolved lines are 0-based.
    return u.lines.includes(lineNum - 1)
  }
  // Matrix cells have no single line: fall back to the section context.
  const section = u?.kind === 'cell' ? unitSection.value : resolvedSection.value
  if (!section) return false
  // lineNum is 1-based; section.startLine/endLine are 0-based (endLine exclusive).
  return lineNum >= section.startLine + 1 && lineNum <= section.endLine
}

function close(): void {
  emit('close')
}

function formatBytes(bytes?: number): string {
  if (!bytes) return 'N/A'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    return (
      d.toLocaleDateString() +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    )
  } catch {
    return dateStr
  }
}

function cleanupObjectUrl(): void {
  if (objectUrl.value && objectUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
}

async function loadFileContent(): Promise<void> {
  if (!props.filePath) return
  loading.value = true
  error.value = null
  rawContent.value = ''
  metadata.value = {}
  cleanupObjectUrl()

  try {
    const handle = workspaceStore.handle

    if (isImage.value || isPdf.value) {
      if (handle) {
        const blob = await workspaceStore.readFileBlob(props.filePath)
        objectUrl.value = blob ? URL.createObjectURL(blob) : props.filePath
      } else {
        objectUrl.value = props.filePath
      }
      loading.value = false
      return
    }

    let textContent = ''

    if (handle) {
      textContent = (await workspaceStore.readText(props.filePath)) ?? ''
    } else {
      const resp = await fetch(props.filePath)
      if (!resp.ok) {
        throw new Error(`HTTP error ${resp.status} - ${resp.statusText}`)
      }
      textContent = await resp.text()
    }

    rawContent.value = textContent

    const fm = parseFrontmatter(textContent) as any
    if (fm) {
      metadata.value = {
        source_file: fm.source_file,
        sha256: fm.sha256,
        size_bytes: fm.size_bytes,
        normalized_at: fm.normalized_at,
      }
    }

    if (props.unit) {
      const resolved = resolveTarget(
        textContent,
        props.filePath,
        props.fileName,
        props.unit,
        props.subunits ?? [],
      )
      await nextTick()
      scrollToResolved(resolved)
    } else if (props.slug) {
      const section = resolveHeadingSection(textContent, props.slug)
      if (section) {
        await nextTick()
        const targetEl = document.getElementById(`line-${section.startLine + 1}`)
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function openOriginalFile(): Promise<void> {
  if (!metadata.value.source_file) return
  openOriginalError.value = null

  try {
    const handle = workspaceStore.handle
    const sourceFile = metadata.value.source_file

    if (handle) {
      const blob = await workspaceStore.readFileBlob(sourceFile)
      if (!blob) throw new Error(`Source file not found: ${sourceFile}`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      // `source_file` comes from the previewed document's frontmatter, so it
      // may carry a `javascript:` or `data:` payload — validate before opening.
      const safeUrl = toSafeNavigationUrl(sourceFile)
      if (!safeUrl) throw new Error(`Refusing to open unsafe source file URL: ${sourceFile}`)
      window.open(safeUrl, '_blank', 'noopener,noreferrer')
    }
  } catch (err) {
    openOriginalError.value = err instanceof Error ? err.message : String(err)
  }
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      if (props.slug || props.unit) {
        // Slugs and field pointers need code lines for highlight; CSV units
        // render their table in the preview slot.
        viewMode.value = isCsv.value ? 'preview' : 'code'
      } else {
        viewMode.value = isMarkdown.value || isImage.value || isPdf.value ? 'preview' : 'code'
      }
      loadFileContent()
    } else {
      cleanupObjectUrl()
    }
  },
  { immediate: true },
)
</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes scale-in {
  from {
    transform: scale(0.96);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
.animate-fade-in {
  animation: fade-in 0.15s ease-out forwards;
}
.animate-scale-in {
  animation: scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.markdown-body :deep(h1) {
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.25rem;
}
.markdown-body :deep(h2) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
.markdown-body :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}
.markdown-body :deep(p) {
  margin-bottom: 0.75rem;
  line-height: 1.6;
}
.markdown-body :deep(ul) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}
.markdown-body :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}
.markdown-body :deep(li) {
  margin-bottom: 0.25rem;
}
.markdown-body :deep(code) {
  font-family: monospace;
  font-size: 0.85em;
  background-color: #f1f5f9;
  padding: 0.15rem 0.3rem;
  border-radius: 0.25rem;
}
.dark .markdown-body :deep(code) {
  background-color: #1e293b;
  color: #f1f5f9;
}
.markdown-body :deep(pre) {
  background-color: #f8fafc;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}
.dark .markdown-body :deep(pre) {
  background-color: #0f172a;
}
.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
}
.markdown-body :deep(a) {
  color: #6366f1;
  text-decoration: underline;
}
.markdown-body :deep(blockquote) {
  border-left: 4px solid #e2e8f0;
  padding-left: 1rem;
  color: #64748b;
  font-style: italic;
  margin-bottom: 1rem;
}
.dark .markdown-body :deep(blockquote) {
  border-left-color: #334155;
  color: #94a3b8;
}
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  text-align: left;
}
.dark .markdown-body :deep(th),
.dark .markdown-body :deep(td) {
  border-color: #334155;
}
.markdown-body :deep(th) {
  background-color: #f8fafc;
}
.dark .markdown-body :deep(th) {
  background-color: #1e293b;
}
</style>
