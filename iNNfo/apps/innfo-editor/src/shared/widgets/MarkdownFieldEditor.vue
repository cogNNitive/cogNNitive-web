<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { renderMarkdown } from '../../utils/markdown'
import { FileText, Pencil, Save, X, ArrowLeftFromLine } from 'lucide-vue-next'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import type { FileHandleLike } from '@cognnitive/innfo-core'
import MinimalMarkdownEditor from '../../components/ui/MinimalMarkdownEditor.vue'

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
    readonly?: boolean
    nodeId?: string
    fieldKey?: string
  }>(),
  {
    readonly: false,
    widgetType: 'markdown_inline',
    nodeId: '',
    fieldKey: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const workspaceStore = useWorkspaceStore()
const knowledgeStore = useKnowledgeStore()

// ── Mode detection ──────────────────────────────────────────────
const isFileMode = computed(() => props.widgetType === 'markdown_file')
const isInlineMode = computed(() => props.widgetType === 'markdown_inline')

// ── Local state ─────────────────────────────────────────────────
const fileContent = ref('')
const editContent = ref('')
const isLoading = ref(false)
const isEditing = ref(false)
const loadError = ref('')

// Derived filename when in file mode
const fileName = computed(() => {
  if (!isFileMode.value) return ''
  const raw = props.modelValue || ''
  const str = Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : String(raw)
  const cleanStr = str.split('#')[0].trim()
  return cleanStr.split('/').pop() || cleanStr
})

// ── File I/O helpers (File System Access API) ───────────────────

async function resolveMarkdownHandle(
  nodeId: string,
  fieldKey: string,
  create: boolean,
): Promise<{ handle: FileHandleLike; relativePath: string } | null> {
  const rootHandle = workspaceStore.handle
  if (!rootHandle) return null

  const node = knowledgeStore.getNode(nodeId)
  if (!node) return null

  const slug = node.slug || node.name.toLowerCase().replace(/[^a-z0-9-]/g, '_')
  const filename = `${fieldKey}.md`

  // Strategy: try per-element slug/ dir first, fall back to assets/, then root
  try {
    const elDir = await rootHandle.getDirectoryHandle(slug, { create })
    const fh = await elDir.getFileHandle(filename, { create })
    return { handle: fh, relativePath: `${slug}/${filename}` }
  } catch {
    try {
      const assetsDir = await rootHandle.getDirectoryHandle('assets', { create })
      const prefixed = `${slug}_${filename}`
      const fh = await assetsDir.getFileHandle(prefixed, { create })
      return { handle: fh, relativePath: `assets/${prefixed}` }
    } catch {
      try {
        const rootName = `${slug}_${filename}`
        const fh = await rootHandle.getFileHandle(rootName, { create })
        return { handle: fh, relativePath: rootName }
      } catch {
        return null
      }
    }
  }
}

async function resolveExistingHandle(
  nodeId: string,
  fieldKey: string,
  storedPath: unknown,
): Promise<FileHandleLike | null> {
  const rootHandle = workspaceStore.handle
  if (!rootHandle) return null

  const rawPath = Array.isArray(storedPath) ? storedPath[0] : storedPath
  if (typeof rawPath !== 'string' || !rawPath) return null

  const cleanPath = rawPath.split('#')[0].trim()
  const parts = cleanPath.split('/').filter(Boolean)
  if (parts.length === 0) return null

  try {
    let current: any = rootHandle
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i])
    }
    return await current.getFileHandle(parts[parts.length - 1])
  } catch {
    return null
  }
}

async function loadFromFile(): Promise<void> {
  if (!props.nodeId || !props.modelValue || (Array.isArray(props.modelValue) && props.modelValue.length === 0)) {
    fileContent.value = ''
    return
  }

  isLoading.value = true
  loadError.value = ''

  try {
    const handle = await resolveExistingHandle(props.nodeId, props.fieldKey, props.modelValue)
    if (!handle) {
      const displayPath = Array.isArray(props.modelValue) ? props.modelValue.join(', ') : props.modelValue
      loadError.value = `File not found: ${displayPath}`
      fileContent.value = ''
      return
    }
    const file = await handle.getFile()
    fileContent.value = await file.text()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
    fileContent.value = ''
  } finally {
    isLoading.value = false
  }
}

async function saveToFile(content: string): Promise<string | null> {
  if (!props.nodeId) return null

  isLoading.value = true
  try {
    const resolved = await resolveMarkdownHandle(props.nodeId, props.fieldKey, true)
    if (!resolved) {
      loadError.value = 'Cannot resolve file path — no workspace handle'
      return null
    }

    const writable = await resolved.handle.createWritable?.()
    if (!writable) {
      loadError.value = 'File handle does not support writing'
      return null
    }

    await writable.write(content)
    await writable.close()
    return resolved.relativePath
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
    return null
  } finally {
    isLoading.value = false
  }
}

// ── Lifecycle ───────────────────────────────────────────────────

watch(
  () => props.modelValue,
  (newVal) => {
    if (isFileMode.value && newVal) {
      loadFromFile()
    } else if (isFileMode.value && !newVal) {
      fileContent.value = ''
    }
  },
  { immediate: true },
)

// ── Edit actions ────────────────────────────────────────────────

function startEdit(): void {
  if (props.readonly) return
  editContent.value = isFileMode.value ? fileContent.value : (props.modelValue || '')
  isEditing.value = true
}

function cancelEdit(): void {
  isEditing.value = false
  editContent.value = ''
}

async function saveEdit(): Promise<void> {
  if (props.readonly) return
  isLoading.value = true

  try {
    if (isFileMode.value) {
      const relativePath = await saveToFile(editContent.value)
      if (relativePath) {
        fileContent.value = editContent.value
        emit('update:modelValue', relativePath)
      }
    } else {
      emit('update:modelValue', editContent.value)
    }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

// ── Rendering ───────────────────────────────────────────────────

// Rendering goes through the shared sanitized `renderMarkdown` (utils/markdown):
// field content is author-supplied, and the result is injected with `v-html`.
// Never call `marked.parse` directly here.

const displayContent = computed(() => {
  if (isFileMode.value) return fileContent.value
  return props.modelValue || ''
})

const renderedContent = computed(() => {
  if (isLoading.value) return ''
  return displayContent.value ? renderMarkdown(displayContent.value) : ''
})

// ── Insert formatting helpers (for edit mode) ───────────────────

const textareaRef = ref<HTMLTextAreaElement | null>(null)

function insertFormat(before: string, after: string): void {
  const ta = textareaRef.value
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const text = ta.value
  const selected = text.substring(start, end)
  const newText = text.substring(0, start) + before + selected + after + text.substring(end)
  editContent.value = newText
  requestAnimationFrame(() => {
    ta.focus()
    ta.selectionStart = start + before.length
    ta.selectionEnd = start + before.length + selected.length
  })
}

function insertBullet(): void {
  const ta = textareaRef.value
  if (!ta) return
  const start = ta.selectionStart
  const text = ta.value
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  editContent.value = text.substring(0, lineStart) + '- ' + text.substring(lineStart)
}

function insertHeading(): void {
  const ta = textareaRef.value
  if (!ta) return
  const start = ta.selectionStart
  const text = ta.value
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  editContent.value = text.substring(0, lineStart) + '## ' + text.substring(lineStart)
}
</script>

<template>
  <div class="markdown-field-editor">
    <!-- ═══ File mode: filename bar (read mode) ═══ -->
    <div v-if="isFileMode && !isEditing && !readonly" class="mfe-file-bar">
      <span v-if="isLoading" class="mfe-loading">Loading...</span>
      <template v-else>
        <span class="mfe-file-badge">
          <FileText class="w-3 h-3 shrink-0" />
          <span class="truncate">{{ fileName || props.modelValue || 'file.md' }}</span>
        </span>
        <span class="mfe-mode-label">external file</span>
        <button class="mfe-icon-btn" @click="startEdit" title="Edit file content">
          <Pencil class="w-3.5 h-3.5" />
        </button>
      </template>
    </div>

    <!-- ═══ Read mode: rendered Markdown ═══ -->
    <template v-if="!isEditing">
      <div v-if="isLoading && isFileMode" class="mfe-rendered mfe-loading-skeleton">
        <span class="text-slate-400 italic">Loading file content...</span>
      </div>
      <div v-else-if="loadError" class="mfe-error">
        <span class="text-amber-600 dark:text-amber-400 text-xs">{{ loadError }}</span>
      </div>
      <div
        v-else-if="renderedContent"
        class="mfe-rendered"
        v-html="renderedContent"
      />
      <span v-else class="mfe-empty">—</span>
    </template>

    <!-- ═══ Edit mode: WYSIWYG editor ═══ -->
    <div v-else class="mfe-edit space-y-2">
      <div class="flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-t-lg border border-slate-200 dark:border-slate-700 -mb-2 border-b-0">
        <button
          class="mfe-tb-action text-slate-500 hover:text-slate-700"
          @click="cancelEdit"
          title="Cancel"
          type="button"
        >
          <X class="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
        <button
          class="mfe-tb-action text-indigo-600 hover:text-indigo-800 font-semibold"
          :disabled="isLoading"
          @click="saveEdit"
          title="Save"
          type="button"
        >
          <Save class="w-3.5 h-3.5" />
          <span v-if="isLoading">Saving...</span>
          <span v-else>Save</span>
        </button>
      </div>
      <MinimalMarkdownEditor
        v-model="editContent"
        :placeholder="isFileMode ? 'Edit external markdown file...' : 'Enter Markdown...'"
      />
    </div>
  </div>
</template>

<style scoped>
.markdown-field-editor {
  font-family: system-ui, sans-serif;
}

/* File mode bar */
.mfe-file-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.3rem 0.5rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  font-size: 12px;
}

.mfe-file-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #166534;
  font-family: monospace;
  font-size: 11px;
  max-width: 200px;
  overflow: hidden;
}

.mfe-mode-label {
  font-size: 10px;
  color: #16a34a;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.03em;
  background: #dcfce7;
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
}

.mfe-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #475569;
  cursor: pointer;
  transition: all 0.1s ease;
  margin-left: auto;
}

.mfe-icon-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

/* Loading state */
.mfe-loading {
  color: #94a3b8;
  font-style: italic;
  font-size: 12px;
}

.mfe-loading-skeleton {
  padding: 0.75rem;
}

/* Error state */
.mfe-error {
  padding: 0.4rem 0.5rem;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  font-size: 12px;
}

/* Rendered markdown */
.mfe-rendered {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  line-height: 1.6;
  color: #1e293b;
}

.mfe-rendered :deep(p) {
  margin: 0 0 0.5rem 0;
}

.mfe-rendered :deep(p:last-child) {
  margin-bottom: 0;
}

.mfe-rendered :deep(strong) {
  font-weight: 600;
}

.mfe-rendered :deep(em) {
  font-style: italic;
}

.mfe-rendered :deep(code) {
  font-family: 'Geist Mono', 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  background: #f1f5f9;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.mfe-rendered :deep(pre) {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 0.5rem;
  overflow-x: auto;
}

.mfe-rendered :deep(pre code) {
  background: none;
  padding: 0;
}

.mfe-rendered :deep(ul),
.mfe-rendered :deep(ol) {
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.mfe-rendered :deep(h1),
.mfe-rendered :deep(h2),
.mfe-rendered :deep(h3) {
  margin: 0.5rem 0 0.25rem 0;
  font-weight: 600;
}

.mfe-empty {
  font-size: 13px;
  color: #94a3b8;
}

/* Edit mode */
.mfe-edit {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mfe-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0.25rem;
  border: 1px solid #e2e8f0;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: #f8fafc;
}

.mfe-tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  transition: all 0.1s ease;
}

.mfe-tb-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.mfe-tb-spacer {
  flex: 1;
}

.mfe-tb-action {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.4rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.1s ease;
}

.mfe-tb-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mfe-textarea {
  width: 100%;
  min-height: 100px;
  padding: 0.5rem;
  font-family: 'Geist Mono', 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid #e2e8f0;
  border-radius: 0 0 6px 6px;
  background: #fafbfc;
  resize: vertical;
  outline: none;
  color: #1e293b;
  box-sizing: border-box;
}

.mfe-textarea:focus {
  border-color: #4d0e4e;
  box-shadow: 0 0 0 2px rgba(77, 14, 78, 0.1);
  background: #fff;
}

.mfe-textarea::placeholder {
  color: #94a3b8;
}
</style>
