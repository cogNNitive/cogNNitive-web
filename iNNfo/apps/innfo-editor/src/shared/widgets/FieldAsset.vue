<script setup lang="ts">
/**
 * Renders an asset field (image/file/video/audio/animation).
 * Part of the unified widget registry (FR-003).
 * Uses v-model contract: modelValue / update:modelValue.
 *
 * widgetType determines rendering:
 * - 'image': thumbnail preview with click-to-open lightbox modal
 * - 'animation': simplified minimalist animation card with click-to-open interactive player & TSX code modal
 * - 'video': video player
 * - 'audio': audio player
 * - 'file': file icon + filename
 */
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  X,
  Code,
  Film,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-vue-next'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useModelStore } from '../../stores/modelStore'
import InnovationVisual from './InnovationVisual.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    widgetType?: string
    fieldDefinition?: {
      name: string
      type: string
      options?: string[]
      target_concepts?: string[]
      default?: unknown
    }
    nodeId?: string
    fieldKey?: string
    readonly?: boolean
  }>(),
  { widgetType: 'file', readonly: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const assetType = computed(() => props.fieldDefinition?.type ?? props.widgetType)
const assetPath = computed(() => props.modelValue ?? '')

const fileName = computed(() => {
  const p = assetPath.value
  return p.split('/').pop() ?? p.split('\\').pop() ?? p
})

const isAnimation = computed(() => {
  const t = assetType.value.toLowerCase()
  const k = (props.fieldKey || props.fieldDefinition?.name || '').toLowerCase()
  const fn = fileName.value.toLowerCase()
  return (
    t === 'animation' ||
    k === 'animation' ||
    k.includes('animation') ||
    fn.endsWith('.tsx') ||
    fn.endsWith('.jsx')
  )
})

const isImage = computed(() => !isAnimation.value && assetType.value === 'image')
const isVideo = computed(() => !isAnimation.value && assetType.value === 'video')
const isAudio = computed(() => !isAnimation.value && assetType.value === 'audio')
const isFile = computed(
  () => !isAnimation.value && !isImage.value && !isVideo.value && !isAudio.value,
)

const ws = useWorkspaceStore()
const modelStore = useModelStore()
const resolvedAssetUrl = ref('')
const fileContent = ref('')
const fileExists = ref(true)
const blobUrlCache = new Map<string, string>()

// ── Lightbox & Animation Modal States ───────────────────────────
const lightboxOpen = ref(false)
const animationModalOpen = ref(false)
const activeTab = ref<'preview' | 'code'>('preview')
const isPlaying = ref(true)
const currentFrame = ref(0)
const totalFrames = ref(150)
const fps = ref(30)
const playbackSpeed = ref(1)
const isLooping = ref(true)
const isCopied = ref(false)
let animationTimer: number | null = null

const currentNode = computed(() => (props.nodeId ? modelStore.getNode(props.nodeId) : null))

// ── Multi-Strategy File Resolution ──────────────────────────────
async function findFileInDir(dirHandle: any, pathParts: string[]): Promise<any> {
  let current = dirHandle
  for (let i = 0; i < pathParts.length - 1; i++) {
    const seg = pathParts[i]
    const decodedSeg = decodeURIComponent(seg)
    try {
      current = await current.getDirectoryHandle(seg)
    } catch {
      try {
        current = await current.getDirectoryHandle(decodedSeg)
      } catch {
        let found = null
        for await (const [name, entry] of current.entries()) {
          if (entry.kind === 'directory') {
            if (
              name.toLowerCase() === seg.toLowerCase() ||
              name.toLowerCase() === decodedSeg.toLowerCase() ||
              name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
                decodedSeg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            ) {
              found = entry
              break
            }
          }
        }
        if (!found) return null
        current = found
      }
    }
  }

  const fileSeg = pathParts[pathParts.length - 1]
  const decodedFileSeg = decodeURIComponent(fileSeg)
  try {
    return await current.getFileHandle(fileSeg)
  } catch {
    try {
      return await current.getFileHandle(decodedFileSeg)
    } catch {
      for await (const [name, entry] of current.entries()) {
        if (entry.kind === 'file') {
          if (
            name.toLowerCase() === fileSeg.toLowerCase() ||
            name.toLowerCase() === decodedFileSeg.toLowerCase() ||
            name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
              decodedFileSeg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
          ) {
            return entry
          }
        }
      }
      return null
    }
  }
}

watch(
  [() => assetPath.value, () => ws.handle],
  async ([path, handle]) => {
    if (!path) {
      resolvedAssetUrl.value = ''
      fileContent.value = ''
      fileExists.value = true
      return
    }
    if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) {
      resolvedAssetUrl.value = path
      fileExists.value = true
      return
    }
    const cached = blobUrlCache.get(path)
    if (cached) {
      resolvedAssetUrl.value = cached
      fileExists.value = true
      return
    }
    if (!handle) {
      resolvedAssetUrl.value = path
      fileExists.value = true
      return
    }

    const node = currentNode.value
    let slug = ''
    if (node) {
      slug =
        node.slug ||
        node.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim()
          .replace(/[\s_]+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
    }

    async function getModelDirectoryHandle(rootHandle: any, modelPath: string): Promise<any> {
      const parts = modelPath.replace(/\\/g, '/').split('/').filter(Boolean)
      parts.pop()
      let current = rootHandle
      for (const part of parts) {
        current = await current.getDirectoryHandle(part)
      }
      return current
    }

    let modelDirHandle = handle
    const modelPath = node?.source?.path || ''
    if (modelPath) {
      try {
        modelDirHandle = await getModelDirectoryHandle(handle, modelPath)
      } catch (err) {
        console.warn('[FieldAsset] Failed to resolve model directory handle:', err)
      }
    }

    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '')
    const parts = cleanPath.split('/').filter(Boolean)

    let fileHandle: any = null

    // 1. Try workspace root direct path
    fileHandle = await findFileInDir(handle, parts)

    // 2. Try model directory handle
    if (!fileHandle && modelDirHandle && modelDirHandle !== handle) {
      fileHandle = await findFileInDir(modelDirHandle, parts)
    }

    // 3. Try per-element canonical folder: assets/{slug}/{filename}
    if (!fileHandle && slug && parts.length === 1) {
      fileHandle = await findFileInDir(handle, ['assets', slug, parts[0]])
    }

    // 4. Try centralized folder: assets/{filename}
    if (!fileHandle && parts.length === 1) {
      fileHandle = await findFileInDir(handle, ['assets', parts[0]])
    }

    if (fileHandle) {
      try {
        const file = await fileHandle.getFile()
        const url = URL.createObjectURL(file)
        blobUrlCache.set(path, url)
        resolvedAssetUrl.value = url
        fileExists.value = true

        if (isAnimation.value || fileName.value.endsWith('.tsx') || fileName.value.endsWith('.jsx')) {
          fileContent.value = await file.text()
        }
        return
      } catch (err) {
        console.warn('[FieldAsset] Failed to read file from handle:', err)
      }
    }

    resolvedAssetUrl.value = path
    fileExists.value = false
  },
  { immediate: true },
)

// ── Animation Playback Engine ───────────────────────────────────
function startPlayback() {
  if (animationTimer) cancelAnimationFrame(animationTimer)
  let lastTime = performance.now()

  function step(now: number) {
    if (!isPlaying.value) return
    const delta = (now - lastTime) / 1000
    lastTime = now

    const frameIncrement = delta * fps.value * playbackSpeed.value
    let next = currentFrame.value + frameIncrement

    if (next >= totalFrames.value) {
      if (isLooping.value) {
        next = 0
      } else {
        next = totalFrames.value
        isPlaying.value = false
        currentFrame.value = totalFrames.value
        return
      }
    }
    currentFrame.value = next
    animationTimer = requestAnimationFrame(step)
  }

  animationTimer = requestAnimationFrame(step)
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (currentFrame.value >= totalFrames.value) {
      currentFrame.value = 0
    }
    startPlayback()
  } else if (animationTimer) {
    cancelAnimationFrame(animationTimer)
    animationTimer = null
  }
}

function restartAnimation() {
  currentFrame.value = 0
  isPlaying.value = true
  startPlayback()
}

function seekFrame(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  currentFrame.value = val
}

function openAnimationModal() {
  animationModalOpen.value = true
  isPlaying.value = true
  startPlayback()
}

function closeAnimationModal() {
  animationModalOpen.value = false
  isPlaying.value = false
  if (animationTimer) {
    cancelAnimationFrame(animationTimer)
    animationTimer = null
  }
}

async function copyCode() {
  if (!fileContent.value) return
  await navigator.clipboard.writeText(fileContent.value)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (lightboxOpen.value) lightboxOpen.value = false
    if (animationModalOpen.value) closeAnimationModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (animationTimer) cancelAnimationFrame(animationTimer)
})

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onImageError(e: Event): void {
  const img = e.target as HTMLImageElement
  if (!img) return
  img.style.display = 'none'
}
</script>

<template>
  <div class="field-asset">
    <!-- Simplified & Clean Animation Card -->
    <div v-if="isAnimation && assetPath" class="field-asset__animation-card">
      <div class="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800/60">
            <Film class="w-3.5 h-3.5" />
          </div>
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-mono text-xs text-slate-700 dark:text-slate-200 truncate">
              {{ fileName }}
            </span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
              .tsx
            </span>
          </div>
        </div>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white cursor-pointer transition-colors shrink-0 ml-2"
          @click="openAnimationModal"
          title="Ver animación interactiva"
        >
          <Play class="w-3 h-3 fill-current" />
          <span>Ver</span>
        </button>
      </div>
    </div>

    <!-- Image thumbnail preview with click-to-enlarge Lightbox -->
    <div v-else-if="isImage && assetPath" class="field-asset__preview group relative cursor-pointer" @click="lightboxOpen = true">
      <img
        v-if="resolvedAssetUrl"
        :src="resolvedAssetUrl"
        :alt="fileName"
        class="field-asset__image transition-transform duration-200 group-hover:scale-[1.02]"
        @error="onImageError"
      />
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium backdrop-blur-xs">
          <Maximize2 class="w-3.5 h-3.5" />
          <span>Ampliar</span>
        </span>
      </div>
      <span v-if="!assetPath" class="field-asset__placeholder">No image selected</span>
    </div>

    <!-- Video player -->
    <div v-else-if="isVideo && assetPath" class="field-asset__preview">
      <video v-if="resolvedAssetUrl" :src="resolvedAssetUrl" controls class="field-asset__video" preload="metadata">
        Your browser does not support the video element.
      </video>
    </div>

    <!-- Audio player -->
    <div v-else-if="isAudio && assetPath" class="field-asset__preview">
      <audio v-if="resolvedAssetUrl" :src="resolvedAssetUrl" controls class="field-asset__audio" preload="metadata">
        Your browser does not support the audio element.
      </audio>
    </div>

    <!-- File icon + name (fallback for file type) -->
    <div v-else-if="isFile && assetPath" class="field-asset__file">
      <span class="field-asset__file-icon">📄</span>
      <span class="field-asset__file-name">{{ fileName }}</span>
    </div>

    <!-- Editable path input in edit mode -->
    <div v-if="!readonly" class="field-asset__input-row">
      <input
        type="text"
        class="field-asset__input"
        :value="modelValue"
        :placeholder="`Enter ${assetType} path...`"
        @input="onInput"
      />
      <span class="field-asset__type-badge">{{ assetType }}</span>
    </div>

    <!-- Missing file warning -->
    <div v-if="assetPath && !fileExists && !readonly" class="field-asset__warning">
      <span class="field-asset__warning-icon">⚠️</span>
      Asset file not found in workspace:
      <code>{{ assetPath }}</code>
    </div>

    <!-- ── Image Lightbox Modal ────────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen"
        class="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none"
        @click.self="lightboxOpen = false"
      >
        <button
          type="button"
          class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors z-10"
          @click="lightboxOpen = false"
          title="Cerrar (Esc)"
        >
          <X class="w-6 h-6" />
        </button>

        <img
          :src="resolvedAssetUrl"
          :alt="fileName"
          class="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />

        <div class="mt-3 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 text-white text-xs font-mono">
          {{ fileName }} ({{ assetPath }})
        </div>
      </div>
    </Teleport>

    <!-- ── Remotion Animation Modal (Clean White Aesthetic) ────────── -->
    <Teleport to="body">
      <div
        v-if="animationModalOpen"
        class="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
        @click.self="closeAnimationModal"
      >
        <div class="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-100">
          <!-- Modal Header (Clean White / Light) -->
          <div class="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800/50">
                <Film class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold text-sm text-slate-900 dark:text-white truncate">
                  {{ currentNode?.name || 'Animación Remotion' }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                  {{ assetPath }}
                </p>
              </div>
            </div>

            <!-- Tabs & Close -->
            <div class="flex items-center gap-3">
              <div class="flex items-center bg-slate-200/80 dark:bg-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  class="px-3 py-1 rounded-md font-medium transition-colors cursor-pointer"
                  :class="activeTab === 'preview' ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
                  @click="activeTab = 'preview'"
                >
                  🎬 Preview
                </button>
                <button
                  type="button"
                  class="px-3 py-1 rounded-md font-medium transition-colors cursor-pointer"
                  :class="activeTab === 'code' ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
                  @click="activeTab = 'code'"
                >
                  💻 Código TSX
                </button>
              </div>

              <button
                type="button"
                class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                @click="closeAnimationModal"
                title="Cerrar (Esc)"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Tab 1: Interactive Preview Player (Clean White Stage) -->
          <div v-if="activeTab === 'preview'" class="flex flex-col flex-1 min-h-0">
            <!-- Viewport / Stage -->
            <div class="relative w-full aspect-video bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-200 dark:border-slate-800 select-none">
              <!-- Live Innovation Animated Graphic -->
              <InnovationVisual
                :innovation-name="currentNode?.name || ''"
                :asset-path="assetPath"
                :frame="currentFrame"
                :total-frames="totalFrames"
                :fps="fps"
              />

              <!-- Top Left Title Overlay -->
              <div class="absolute top-4 left-4 z-20 flex flex-col gap-1 pointer-events-none">
                <span class="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {{ currentNode?.name || 'Innovación' }}
                </span>
                <div class="flex items-center gap-2">
                  <span v-if="currentNode?.fields?.fecha?.value || currentNode?.fields?.fecha" class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {{ currentNode?.fields?.fecha?.value || currentNode?.fields?.fecha }}
                  </span>
                  <span v-if="currentNode?.fields?.inventor_creador?.value || currentNode?.fields?.inventor_creador" class="text-xs text-slate-500 dark:text-slate-400">
                    {{ String(currentNode?.fields?.inventor_creador?.value || currentNode?.fields?.inventor_creador).replace(/[\[\]]/g, '') }}
                  </span>
                </div>
              </div>

              <!-- Remotion Composition Watermark -->
              <div class="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono pointer-events-none">
                <span>Remotion 1920x1080</span>
                <span>•</span>
                <span>{{ fps }} FPS</span>
              </div>
            </div>

            <!-- Timeline & Controls Bar -->
            <div class="p-4 bg-slate-50 dark:bg-slate-950 flex flex-col gap-3">
              <!-- Scrubber Bar -->
              <div class="flex items-center gap-3">
                <span class="text-xs font-mono text-slate-500 w-12 text-right">
                  {{ (currentFrame / fps).toFixed(1) }}s
                </span>
                <input
                  type="range"
                  min="0"
                  :max="totalFrames"
                  step="0.5"
                  :value="currentFrame"
                  class="flex-1 accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
                  @input="seekFrame"
                />
                <span class="text-xs font-mono text-slate-500 w-12">
                  {{ (totalFrames / fps).toFixed(1) }}s
                </span>
              </div>

              <!-- Control Buttons -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white cursor-pointer shadow-xs transition-all"
                    @click="togglePlay"
                    :title="isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'"
                  >
                    <Pause v-if="isPlaying" class="w-4 h-4 fill-current" />
                    <Play v-else class="w-4 h-4 fill-current" />
                  </button>

                  <button
                    type="button"
                    class="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                    @click="restartAnimation"
                    title="Reiniciar"
                  >
                    <RotateCcw class="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border cursor-pointer transition-colors"
                    :class="isLooping ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'"
                    @click="isLooping = !isLooping"
                    title="Repetir en bucle"
                  >
                    Loop
                  </button>
                </div>

                <!-- Frame Counter & Speed Selector -->
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400">
                    <span class="text-slate-900 dark:text-white font-semibold">{{ Math.floor(currentFrame) }}</span>
                    <span>/</span>
                    <span>{{ totalFrames }} frames</span>
                  </div>

                  <div class="flex items-center bg-slate-200/80 dark:bg-slate-800 rounded-md p-0.5 text-xs font-mono">
                    <button
                      v-for="spd in [0.5, 1, 2]"
                      :key="spd"
                      type="button"
                      class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                      :class="playbackSpeed === spd ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
                      @click="playbackSpeed = spd"
                    >
                      {{ spd }}x
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 2: TSX Source Code -->
          <div v-else class="flex flex-col flex-1 min-h-0 bg-slate-900 text-slate-100">
            <div class="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800">
              <span class="text-xs font-mono text-slate-400">{{ fileName }}</span>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer transition-colors"
                @click="copyCode"
              >
                <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ isCopied ? '¡Copiado!' : 'Copiar TSX' }}</span>
              </button>
            </div>
            <div class="flex-1 overflow-auto p-4 text-xs font-mono text-indigo-200/90 leading-relaxed bg-slate-950 select-text">
              <pre v-if="fileContent">{{ fileContent }}</pre>
              <p v-else class="text-slate-500 italic">Cargando código fuente de la animación...</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.field-asset {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-asset__preview {
  max-width: 100%;
  border: 1px solid var(--border-soft, #e2e8f0);
  border-radius: 6px;
  overflow: hidden;
  background: #f8fafc;
}

.field-asset__image {
  display: block;
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}

.field-asset__video {
  display: block;
  max-width: 100%;
  max-height: 240px;
}

.field-asset__audio {
  display: block;
  width: 100%;
}

.field-asset__file {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-soft, #e2e8f0);
  border-radius: 6px;
  background: #f8fafc;
}

.field-asset__file-icon {
  font-size: 1.25rem;
}

.field-asset__file-name {
  font-size: 13px;
  color: #334155;
  font-family: monospace;
}

.field-asset__input-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.field-asset__input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  font-size: 13px;
  border: 1px solid var(--border-soft, #ccc);
  border-radius: 6px;
  background: #fff;
  font-family: monospace;
  box-sizing: border-box;
}

.field-asset__input:focus {
  outline: none;
  border-color: #4d0e4e;
  box-shadow: 0 0 0 2px rgba(77, 14, 78, 0.1);
}

.field-asset__type-badge {
  font-size: 11px;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: #e2e8f0;
  color: #475569;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.field-asset__placeholder {
  display: block;
  padding: 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.field-asset__warning {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  color: #d97706;
  padding: 0.3rem 0.5rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
}

.field-asset__warning code {
  font-size: 11px;
  background: #fef3c7;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}
</style>
