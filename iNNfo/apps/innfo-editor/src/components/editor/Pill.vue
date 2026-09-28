<template>
  <component
    :is="as"
    ref="triggerEl"
    data-testid="block-pill"
    :class="pillClasses"
    :style="pillStyle"
    @mouseenter="showInfoIcon = true"
    @mouseleave="showInfoIcon = false"
  >
    <!-- Identity row: icon + name + active markers -->
    <div class="flex items-center w-full min-w-0" :class="props.lines ? 'gap-1' : 'gap-1.5'">
      <!-- Scanned image thumbnail (first discovered image, small) -->
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        class="shrink-0 w-5 h-5 rounded object-cover border border-slate-200 dark:border-slate-600"
        @error="onThumbnailError"
      />
      <IconRenderer
        v-else-if="visuals.iconToShow.value === 'icon' && visuals.resolvedIcon.value"
        :icon="visuals.resolvedIcon.value"
        custom-class="shrink-0 w-3.5 h-3.5 text-current/80"
      />
      <component v-else :is="visuals.typeIcon.value" class="shrink-0 w-3.5 h-3.5 text-current/70" />
      <span
        class="leading-tight text-left flex-1 min-w-0"
        :class="{
          italic: isEmpty,
          'text-slate-400': isEmpty,
          truncate: props.lines === 1 && !props.noWrap,
          'line-clamp-2': props.lines === 2,
          'whitespace-nowrap': props.noWrap || props.lines === 1,
        }"
      >
        <slot>
          <template v-if="conceptLabel">
            <span class="font-medium">{{ conceptLabel }}:</span>
            {{ name }}
          </template>
          <template v-else>{{ name }}</template>
        </slot>
      </span>

      <!-- Active markers, read-only, rendered inside the pill -->
      <Info v-if="blockId && showInfoIcon" :class="infoIconClass" @click.stop="togglePopup" />
      <span v-if="activeMarkers.length > 0" class="flex items-center gap-1 shrink-0">
        <MarkerButton
          v-for="marker in activeMarkers"
          :key="marker.name"
          :marker-name="marker.name"
          :node-id="blockId"
          :interactive="false"
        />
      </span>

      <!-- Active workspace tags, read-only, rendered inside the pill as circular badges like markers -->
      <span v-if="activeWorkspaceTags.length > 0" class="flex items-center gap-1 shrink-0">
        <span
          v-for="tag in activeWorkspaceTags"
          :key="tag.name"
          class="w-4 h-4 rounded-full flex items-center justify-center shrink-0 border border-white/20 dark:border-slate-800/20 shadow-xs"
          :style="{ backgroundColor: tag.color || '#64748b' }"
          :title="tag.description ? `${tag.name}: ${tag.description}` : tag.name"
          data-testid="pill-workspace-tag"
        >
          <IconRenderer :icon="tag.icon || 'tag'" custom-class="w-2.5 h-2.5 text-white" />
        </span>
      </span>
    </div>

    <!-- Info popup (only when blockId is provided and popup is open) -->
    <Teleport v-if="blockId && popupVisible" to="body">
      <Transition name="fade-fast">
        <div
          v-if="popupVisible"
          :style="popupStyle"
          class="fixed z-[998] w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl p-4 text-xs select-none"
        >
          <!-- Close button -->
          <X
            class="absolute top-2 right-2 w-4 h-4 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer transition-colors"
            @click.stop="popupVisible = false"
          />
          <!-- Header -->
          <div class="flex items-center gap-1.5 mb-2">
            <component
              v-if="visuals.iconToShow.value === 'type'"
              :is="visuals.typeIcon.value"
              class="shrink-0 w-4 h-4 text-slate-500"
            />
            <IconRenderer
              v-else-if="visuals.resolvedIcon.value"
              :icon="visuals.resolvedIcon.value"
              custom-class="shrink-0 w-4 h-4 text-slate-500"
            />
            <button
              class="font-semibold text-sm text-slate-800 dark:text-slate-200 break-words hover:text-primary transition-colors cursor-pointer text-left"
              @click="navigateToBlock"
            >
              {{ name || '(Empty)' }}
            </button>
            <!-- Navigate to the block's page -->
            <button
              class="ml-auto mr-6 shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary cursor-pointer transition-colors"
              title="Open block page"
              data-testid="block-pill-nav"
              @click.stop="navigateToBlock"
            >
              <ArrowUpRight class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Fields -->
          <div v-if="visibleFields.length" class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="field in visibleFields"
              :key="field.name"
              class="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200/60 dark:border-slate-600"
            >
              <span class="text-slate-400 dark:text-slate-500 mr-1 uppercase font-bold"
                >{{ field.name.replace(/_/g, ' ') }}:</span
              >
              <span v-if="field.isWikiLink" class="text-primary underline decoration-dotted"
                >[[{{ field.value }}]]</span
              >
              <span v-else>{{ field.value }}</span>
            </span>
          </div>

          <!-- Tags -->
          <div v-if="nodeTags.length" class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="t in nodeTags"
              :key="t"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shadow-xs"
              :style="
                modelStore.workspaceTagsMap[t.toLowerCase().trim()]?.color
                  ? {
                      borderColor:
                        modelStore.workspaceTagsMap[t.toLowerCase().trim()]?.color + '55',
                      backgroundColor:
                        modelStore.workspaceTagsMap[t.toLowerCase().trim()]?.color + '15',
                      color: modelStore.workspaceTagsMap[t.toLowerCase().trim()]?.color,
                    }
                  : {}
              "
              :class="
                !modelStore.workspaceTagsMap[t.toLowerCase().trim()]?.color
                  ? 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-600'
                  : ''
              "
              :title="modelStore.workspaceTagsMap[t.toLowerCase().trim()]?.description"
            >
              <IconRenderer
                v-if="modelStore.workspaceTagsMap[t.toLowerCase().trim()]?.icon"
                :icon="modelStore.workspaceTagsMap[t.toLowerCase().trim()]?.icon!"
                custom-class="w-3 h-3"
              />
              <span>#{{ t }}</span>
            </span>
          </div>

          <!-- Description -->
          <p
            v-if="description && description.trim()"
            class="text-slate-600 dark:text-slate-400 leading-relaxed text-xs mb-3 break-words"
          >
            {{ description }}
          </p>
          <p v-else class="text-slate-400 dark:text-slate-500 italic text-xs mb-3">No content.</p>

          <!-- Marker cycling toolbar -->
          <div
            v-if="showMarkers && allMarkers.length"
            class="border-t border-slate-100 dark:border-slate-600 pt-2.5"
          >
            <div
              class="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-1.5"
            >
              Markers
            </div>
            <div class="flex items-center gap-1.5">
              <MarkerButton
                v-for="marker in allMarkers"
                :key="marker.name"
                :marker-name="marker.name"
                :node-id="blockId"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { Info, X, ArrowUpRight } from 'lucide-vue-next'
import IconRenderer from './IconRenderer.vue'
import MarkerButton from './MarkerButton.vue'
import { getMarkerDefinitions } from './MarkerIcons'
import { useBlockVisuals } from '../../composables/useBlockVisuals'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUiStore } from '../../stores/uiStore'
import {
  useConceptVisuals,
  getHexColorLight,
  textColor as yiqTextColor,
  COLOR_HEX,
  getHexColor,
} from '../../composables/useConceptVisuals'
import { useModelStore } from '../../stores/modelStore'
import type { BlockKind, ConceptType } from '../../utils/conceptVisuals'

const props = withDefaults(
  defineProps<{
    name?: string
    kind?: BlockKind
    conceptType?: string
    color?: string
    icon?: string
    iconMode?: 'type' | 'own'
    typeName?: ConceptType
    selected?: boolean
    interactive?: boolean
    fullWidth?: boolean
    as?: string
    /** Block id — enables popup, active markers, and content-aware (empty) state. */
    blockId?: string
    /** Node id for parent-chain color resolution (V_0-1-5). When set, overrides `color` prop. */
    nodeId?: string
    /** Shown in the popup and used to detect the empty state. */
    description?: string
    fields?: Record<string, any>
    /** Field definitions for labelled field chips in the popup. */
    conceptFields?: any[]
    /** Number of child instances. An instanciable block with instances counts as having content. */
    instanceCount?: number
    /** Show the marker-cycling toolbar inside the popup. */
    showMarkers?: boolean
    /** Suppress the "Empty" indicator (used for structural concept pills in matrix headers). */
    hideEmpty?: boolean
    /** Truncate the name text after a specific number of lines (0 or undefined for no truncation). */
    lines?: number
    /** Shape / border-radius variant: 'rounded' (default rounded-lg) or 'pill' (rounded-full). */
    shape?: 'rounded' | 'pill'
    /** When true, prevents text wrapping and width-clamping (useful for rotated labels in table headers). */
    noWrap?: boolean
    /** Explicit tags array. If omitted, resolved from blockId or nodeId in modelStore. */
    tags?: string[]
  }>(),
  {
    selected: false,
    interactive: false,
    fullWidth: false,
    as: 'div',
    kind: 'instance',
    showMarkers: true,
    conceptFields: () => [],
    lines: 0,
    shape: 'rounded',
    noWrap: false,
    tags: () => [],
  },
)

const modelStore = useModelStore()
const uiStore = useUiStore()
const conceptVisuals = useConceptVisuals()

// ── Parent chain color/icon resolution ─────────────────────────
function resolveNodeColor(nodeId: string | undefined): string {
  if (!nodeId) return ''
  const node = modelStore.getNode(nodeId)
  if (!node) return ''
  return conceptVisuals.resolveColor(node)
}

function resolveNodeColorName(nodeId: string | undefined): string {
  if (!nodeId) return ''
  const node = modelStore.getNode(nodeId)
  if (!node) return ''
  return conceptVisuals.resolveColorName(node)
}

// In Phase 2, markers come from a hardcoded default list since the metamodel
// adapter is not yet in place. Phase 6 will wire useMetamodelStore().
const allMarkers = computed(() => getMarkerDefinitions())

// Resolved color name (like 'blue') or fallback to color prop
const effectiveColorName = computed(() => {
  const nodeBased = resolveNodeColorName(props.nodeId)
  if (nodeBased) return nodeBased
  if (props.color) {
    if (props.color.startsWith('#')) {
      const entry = Object.entries(COLOR_HEX).find(
        ([_, hex]) => hex.toLowerCase() === props.color?.toLowerCase(),
      )
      if (entry) return entry[0]
      return 'slate'
    }
    return props.color
  }
  return ''
})

const effectiveColorHex = computed(() => {
  const nodeBased = resolveNodeColor(props.nodeId)
  if (nodeBased) return nodeBased
  if (props.color) {
    if (props.color.startsWith('#')) return props.color
    return getHexColor(props.color)
  }
  return ''
})

const effectiveIcon = computed(() => {
  if (props.icon) return props.icon
  if (props.nodeId) {
    const node = modelStore.getNode(props.nodeId)
    if (node) {
      return conceptVisuals.resolveIcon(node)
    }
  }
  return ''
})

const isStandardColor = computed(() => {
  if (props.nodeId) return true
  if (props.color && !props.color.startsWith('#')) return true
  return false
})

const visuals = useBlockVisuals({
  kind: computed(() => props.kind ?? 'instance'),
  conceptType: computed(() => props.conceptType),
  color: effectiveColorName,
  icon: effectiveIcon,
  typeName: computed(() => props.typeName),
})

// ── Empty state ─────────────────────────────────────────────────
const isEmpty = computed(() => {
  if (props.hideEmpty) return false
  const node = props.blockId ? modelStore.getNode(props.blockId) : null
  const desc = props.description ?? (node as any)?.description ?? node?.rawContent ?? ''
  const fieldsObj = props.fields ?? node?.fields
  const hasDescription = !!desc && desc.trim().length > 0
  const hasFields =
    !!fieldsObj &&
    Object.values(fieldsObj).some((v: any) => {
      const val = typeof v === 'object' && v !== null && 'value' in v ? v.value : v
      return val !== undefined && val !== null && val !== '' && val !== false
    })
  const hasInstances = (props.instanceCount ?? 0) > 0
  return !hasDescription && !hasFields && !hasInstances
})

// Element pills no longer prefix the concept name — context is always clear.
const conceptLabel = computed(() => '')

// ── Markers ─────────────────────────────────────────────────────

const getMarkerScore = (markerName: string): number => {
  if (!props.blockId) return 0
  const node = modelStore.getNode(props.blockId)
  if (!node?.markers) return 0
  return (node.markers[markerName] as number) ?? 0
}

const activeMarkers = computed(() => {
  if (!props.blockId) return []
  return allMarkers.value.filter((m) => getMarkerScore(m.name) > 0)
})

// ── Workspace Tags ──────────────────────────────────────────────
interface WorkspaceTagBadge {
  name: string
  icon?: string
  color?: string
  description?: string
}

const nodeTags = computed<string[]>(() => {
  if (props.tags && Array.isArray(props.tags) && props.tags.length > 0) {
    return props.tags
  }
  const targetId = props.blockId || props.nodeId
  if (!targetId) return []
  const node = modelStore.getNode(targetId)
  if (node?.tags && Array.isArray(node.tags)) {
    return node.tags
  }
  return []
})

const activeWorkspaceTags = computed<WorkspaceTagBadge[]>(() => {
  const wsMap = modelStore.workspaceTagsMap
  if (!wsMap || Object.keys(wsMap).length === 0) return []
  const badges: WorkspaceTagBadge[] = []
  for (const t of nodeTags.value) {
    if (!t) continue
    const key = t.toLowerCase().trim()
    const meta = wsMap[key] || wsMap[t]
    if (meta) {
      badges.push({
        name: t,
        icon: meta.icon,
        color: meta.color,
        description: meta.description,
      })
    }
  }
  return badges
})

// ── Navigation ──────────────────────────────────────────────────
const navigateToBlock = () => {
  popupVisible.value = false
  if (!props.blockId) return
  uiStore.selectNode(props.blockId)
  uiStore.setActiveView('editor')
}

// ── Main image (rule 1 only) ─────────────────────────────────────
// The default image of an element is the FIRST field of type `image`,
// in template declaration order. There is NO value-guessing, NO
// folder-scan fallback, and NO name-based heuristic.
const thumbnailUrl = ref('')
// Object URL created for the thumbnail; revoked on replace and on unmount so
// replaced on-disk assets never keep showing the stale blob (E5).
let thumbnailObjectUrl: string | null = null

function releaseThumbnailUrl() {
  if (thumbnailObjectUrl) {
    URL.revokeObjectURL(thumbnailObjectUrl)
    thumbnailObjectUrl = null
  }
}

function getTemplateImageValue(fieldsRecord: Record<string, any> | undefined): string | null {
  if (!props.conceptFields?.length || !fieldsRecord) return null
  for (const field of props.conceptFields) {
    if (field?.type !== 'image') continue
    const raw = fieldsRecord[field.name]
    const value =
      typeof raw === 'object' && raw !== null && 'value' in raw ? (raw as any).value : raw
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

watch(
  [() => props.blockId, () => props.fields],
  async () => {
    thumbnailUrl.value = ''
    releaseThumbnailUrl()

    const node = props.blockId ? modelStore.getNode(props.blockId) : null
    const explicitImg = getTemplateImageValue(node?.fields || props.fields)
    if (!explicitImg) return

    if (
      explicitImg.startsWith('http') ||
      explicitImg.startsWith('data:') ||
      explicitImg.startsWith('blob:')
    ) {
      thumbnailUrl.value = explicitImg
      return
    }
    const resolved = await resolveThumbnailUrlPath(explicitImg)
    if (resolved) thumbnailUrl.value = resolved
  },
  { immediate: true, deep: true },
)

async function resolveThumbnailUrlPath(relativePath: string): Promise<string | null> {
  if (
    relativePath.startsWith('http') ||
    relativePath.startsWith('data:') ||
    relativePath.startsWith('blob:')
  ) {
    return relativePath
  }
  const ws = useWorkspaceStore()
  const handle = ws.handle
  if (!handle) return relativePath

  try {
    const parts = relativePath.split('/').filter(Boolean)
    let current: any = handle
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i])
    }
    const fh = await current.getFileHandle(parts[parts.length - 1])
    const file = await fh.getFile()
    releaseThumbnailUrl()
    thumbnailObjectUrl = URL.createObjectURL(file)
    return thumbnailObjectUrl
  } catch {
    return relativePath
  }
}

onUnmounted(() => {
  releaseThumbnailUrl()
})

function onThumbnailError(e: Event) {
  const target = e.target as HTMLImageElement
  if (!target) return
  thumbnailUrl.value = ''
}

// ── Popup ───────────────────────────────────────────────────────
const triggerEl = ref<HTMLElement | null>(null)
const popupVisible = ref(false)
const showInfoIcon = ref(false)
const coords = ref({ top: 0, left: 0 })

const togglePopup = () => {
  if (!popupVisible.value) {
    const rect = triggerEl.value?.getBoundingClientRect()
    if (!rect) return
    coords.value = { left: rect.left, top: rect.bottom + 6 }
  }
  popupVisible.value = !popupVisible.value
}

const popupStyle = computed(() => ({
  top: `${coords.value.top}px`,
  left: `${coords.value.left}px`,
}))

// ── Visible fields for popup ────────────────────────────────────
const visibleFields = computed(() => {
  if (!props.conceptFields?.length || !props.fields) return []
  return props.conceptFields
    .map((field: any) => {
      const val = props.fields?.[field.name]
      if (val === undefined || val === '' || val === null || val === false) return null
      const isReference = field.type === 'reference'
      return {
        name: field.name,
        value: typeof val === 'boolean' ? (val ? 'Yes' : 'No') : val,
        isWikiLink: isReference,
      }
    })
    .filter(
      (
        f: { name: string; value: any; isWikiLink: boolean } | null,
      ): f is { name: string; value: any; isWikiLink: boolean } => f !== null,
    )
})

// ── Info icon class ─────────────────────────────────────────────
const infoIconClass = computed(() => {
  const base = 'shrink-0 w-3.5 h-3.5 cursor-pointer transition-colors'
  if (props.selected && props.kind === 'concept') {
    return `${base} text-white/80 hover:text-white`
  }
  return `${base} text-slate-400 hover:text-primary`
})

// ── YIQ contrast text color ────────────────────────────────────
const contrastTextColor = computed(() => {
  if (!effectiveColorHex.value) return ''
  return yiqTextColor(effectiveColorHex.value)
})

// ── Pill inline style (YIQ background + text contrast) ─────────
const pillStyle = computed(() => {
  if (!effectiveColorHex.value) return {}

  // Selected concepts are styled entirely via solid background classes
  if (props.selected && props.kind === 'concept') {
    return {}
  }

  // Standard/palette colors mapped to nodes use pure Tailwind class systems,
  // avoiding inline styles to preserve visual consistency and design aesthetics.
  if (isStandardColor.value && props.nodeId) {
    return {}
  }

  // Solid-identity and firm-outline tiers (concept, model, source, artifact)
  // always carry their own complete Tailwind-based styling from
  // containerClasses, regardless of nodeId — never override with inline
  // YIQ tinting, which is reserved for the default (instance/soft-outline) tier.
  if (
    props.kind === 'concept' ||
    props.kind === 'model' ||
    props.kind === 'source' ||
    props.kind === 'artifact'
  ) {
    return {}
  }

  const style: Record<string, string> = {}
  style.backgroundColor = getHexColorLight(effectiveColorHex.value)
  if (contrastTextColor.value) {
    style.color = contrastTextColor.value
  }
  return style
})

// ── Pill classes ────────────────────────────────────────────────
const pillClasses = computed(() => {
  const radiusClass = props.shape === 'pill' ? 'rounded-full' : 'rounded-lg'

  const paddingClass =
    props.shape === 'pill'
      ? props.lines
        ? 'px-2.5 py-0.5 text-[11px] gap-1'
        : 'px-3 py-1 text-xs gap-1.5'
      : props.lines
        ? 'px-1.5 py-1 text-[11px] gap-0.5'
        : 'px-2 py-1.5 text-xs gap-1'

  const widthClass = props.fullWidth
    ? 'flex w-full items-center'
    : props.noWrap
      ? 'inline-flex items-center whitespace-nowrap shrink-0'
      : 'inline-flex items-center max-w-full'

  const textWrapClass = props.noWrap
    ? `${radiusClass} font-normal whitespace-nowrap transition-all duration-200 select-none min-w-0`
    : props.lines === 1
      ? `${radiusClass} font-normal whitespace-nowrap overflow-hidden transition-all duration-200 select-none min-w-0`
      : props.lines && props.lines > 1
        ? `${radiusClass} font-normal whitespace-normal overflow-hidden transition-all duration-200 select-none min-w-0`
        : `${radiusClass} font-normal whitespace-normal break-words transition-all duration-200 select-none min-w-0`

  const baseClasses = [
    widthClass,
    paddingClass,
    textWrapClass,
    props.interactive
      ? 'cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
      : '',
    // Ghost state (no content yet): composes with any fill tier — dashed border
    // where a border color exists, faded opacity always.
    isEmpty.value ? 'italic border-dashed opacity-[0.55]' : '',
  ]

  if (props.selected) {
    const p = visuals.palette.value
    if (props.kind === 'concept') {
      const textColor = p.conceptText ?? 'text-white'
      const borderColor = p.conceptBorder ?? 'border-transparent'
      return [...baseClasses, p.selectedBg, textColor, 'border', borderColor]
    }
    return [...baseClasses, p.text, 'border-primary ring-1 ring-primary shadow-xs']
  }

  return [
    ...baseClasses,
    ...visuals.containerClasses.value,
    props.interactive ? 'hover:shadow-xs' : '',
  ]
})
</script>

<style scoped>
.fade-fast-enter-active,
.fade-fast-leave-active {
  transition:
    opacity 0.12s ease-out,
    transform 0.12s ease-out;
}
.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
}
</style>
