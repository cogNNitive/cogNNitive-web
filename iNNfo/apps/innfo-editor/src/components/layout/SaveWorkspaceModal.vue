<script setup lang="ts">
import { ref, computed } from 'vue'
import { FolderOpen, X, AlertTriangle } from 'lucide-vue-next'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useModelStore } from '../../stores/modelStore'
import { useUiStore } from '../../stores/uiStore'
import { recursiveSerialize } from '../../model/recursiveSerializer'
import { parseFormatFilename } from '../../utils/version'
import { addToHistory } from '../../stores/historyStore'
import { useToast } from '../../shared/useToast'
import { serializeKnowledge } from '@cognnitive/innfo-core'
import { _ensureGeneralSpec } from '../../services/WorkspacePersistenceService'
import type { DirectoryHandleLike } from '../../model/fs-types'

const workspaceStore = useWorkspaceStore()
const modelStore = useModelStore()
const uiStore = useUiStore()
const { show } = useToast()

const error = ref<string | null>(null)
const busy = ref(false)

const isOpen = computed(() => uiStore.showSaveWorkspaceModal)

const rootId = computed(() => modelStore.rootIds[0])
const rootNode = computed(() => (rootId.value ? modelStore.getNode(rootId.value) : null))

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || name
  const cleanBase = base.split(/[?#]/)[0]
  return cleanBase.replace(/[^a-zA-Z0-9._-]/g, '_').trim()
}

function closeModal(): void {
  uiStore.setShowSaveWorkspaceModal(false)
}

async function handleSaveWorkspace(): Promise<void> {
  error.value = null
  busy.value = true

  const picker = (
    window as unknown as {
      showDirectoryPicker?: () => Promise<DirectoryHandleLike>
    }
  ).showDirectoryPicker

  if (!picker) {
    error.value =
      'File System Access API is not supported by this browser. Please use Chrome or Edge.'
    busy.value = false
    return
  }

  try {
    const handle = await picker.call(window)

    // Extract target filename from sourceUrl
    let targetFilename = ''
    if (workspaceStore.sourceUrl) {
      try {
        const url = new URL(workspaceStore.sourceUrl)
        const lastSegment = url.pathname.split('/').pop()
        if (lastSegment && parseFormatFilename(lastSegment)) {
          targetFilename = lastSegment
        }
      } catch {
        // Fallback on invalid url
      }
    }

    if (!targetFilename) {
      const rootName = rootNode.value?.name ?? 'Untitled'
      targetFilename = rootName.endsWith('_NN') ? `${rootName}.md` : `${rootName}_NN.md`
    }

    targetFilename = sanitizeFilename(targetFilename)

    // Custom driver to intercept and execute writes into the chosen folder handle
    const writtenPaths = new Set<string>()
    const customDriver = {
      readModel: async () => {
        throw new Error('Not implemented')
      },
      writeModel: async (path: string, parsed: any) => {
        const content = serializeKnowledge(parsed)
        const isRoot =
          rootNode.value &&
          (path === rootNode.value.source.path ||
            path.endsWith(rootNode.value.name + '_NN.md') ||
            path.endsWith(targetFilename))
        const rawFilename = isRoot ? targetFilename : (path.split('/').pop() ?? path)
        const filename = sanitizeFilename(rawFilename)

        const fileHandle = await handle.getFileHandle(filename, { create: true })
        if (!fileHandle.createWritable) {
          throw new Error(`File handle for "${filename}" does not support writing`)
        }
        const writable = await fileHandle.createWritable()
        await writable.write(content)
        await writable.close()

        writtenPaths.add(filename)
      },
      listChildren: async () => [],
      listAssets: async () => [],
    }

    // Force serialize root node even if not marked dirty
    const dirtyIds = new Set(modelStore.dirtyIds)
    if (rootId.value) {
      dirtyIds.add(rootId.value)
    }

    // Run serialization
    await recursiveSerialize(modelStore.nodes, dirtyIds, customDriver)

    // Fallback direct write for rootNode
    if (!writtenPaths.has(targetFilename) && rootNode.value) {
      const content = rootNode.value.rawContent ?? ''
      const fileHandle = await handle.getFileHandle(targetFilename, { create: true })
      if (!fileHandle.createWritable) {
        throw new Error(`File handle for "${targetFilename}" does not support writing`)
      }
      const writable = await fileHandle.createWritable()
      await writable.write(content)
      await writable.close()
    }

    // Update rootNode's path in memory and all child nodes belonging to this model
    if (rootNode.value) {
      const oldPath = rootNode.value.source.path
      rootNode.value.source.path = targetFilename
      if (oldPath && oldPath !== targetFilename) {
        for (const node of Object.values(modelStore.nodes)) {
          if (node.source && (node.source.path === oldPath || modelStore.getModelRootForNode(node.id) === rootId.value)) {
            node.source.path = targetFilename
          }
        }
      }
    }

    // Write all specs and templates to a local specs/ directory
    const specsDir = await handle.getDirectoryHandle('specs', { create: true })
    for (const [id, node] of Object.entries(modelStore.nodes)) {
      if (id.startsWith('spec:') && node.rawContent) {
        const specName = node.name || id.substring(5)
        const filename = specName.endsWith('_NN') ? `${specName}.md` : `${specName}_NN.md`
        const specFileHandle = await specsDir.getFileHandle(filename, { create: true })
        if (specFileHandle.createWritable) {
          const specWritable = await specFileHandle.createWritable()
          await specWritable.write(node.rawContent)
          await specWritable.close()
        }
      }
    }

    // Write internet shortcut as a safe HTML redirect
    const redirectUrl = window.location.origin
    const shortcutContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Open iNNfo Editor</title>
  <meta http-equiv="refresh" content="0; url=${redirectUrl}">
  <script>
    window.location.href = "${redirectUrl}";
  <\/script>
</head>
<body>
  <p>Redirecting to <a href="${redirectUrl}">iNNfo Editor</a>...</p>
</body>
</html>
`
    const shortcutHandle = await handle.getFileHandle('Open iNNfo Editor.html', { create: true })
    if (!shortcutHandle.createWritable) {
      throw new Error('File handle for shortcut does not support writing')
    }
    const shortcutWritable = await shortcutHandle.createWritable()
    await shortcutWritable.write(shortcutContent)
    await shortcutWritable.close()

    // Write README.md instructions
    const readmeContent = `# Workspace Instructions

This local workspace is linked to the iNNfo Editor.
To open this workspace:
1. Go to ${window.location.origin}
2. Click "Open folder" and select this directory.
`
    const readmeHandle = await handle.getFileHandle('README.md', { create: true })
    if (!readmeHandle.createWritable) {
      throw new Error('File handle for README.md does not support writing')
    }
    const readmeWritable = await readmeHandle.createWritable()
    await readmeWritable.write(readmeContent)
    await readmeWritable.close()

    // Add folder to recent folders list
    await addToHistory(handle.name, handle)

    // Transition editor state
    workspaceStore.isParsing = false
    await workspaceStore.open(handle, { force: true })

    // Ensure the generic iNNfo spec is present locally
    await _ensureGeneralSpec(handle, modelStore, uiStore)

    // Clear dirty flags
    for (const id of Array.from(modelStore.dirtyIds)) {
      modelStore.clearDirty(id)
    }

    uiStore.setShowSaveWorkspaceModal(false)
    show('Workspace saved and transitioned successfully.', 'success')
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      busy.value = false
      return
    }
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
    @click.self="closeModal"
  >
    <div
      class="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800"
      >
        <h3 id="modal-title" class="text-base font-bold text-slate-900 dark:text-slate-50">
          Save Workspace
        </h3>
        <button
          @click="closeModal"
          class="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6 overflow-y-auto">
        <div
          v-if="error"
          class="flex gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ error }}</span>
        </div>

        <div class="space-y-2">
          <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            This model was loaded dynamically and has no local workspace. To edit and save it on
            your computer, please choose a local folder (e.g., your
            <strong>Documents</strong> folder or a subfolder inside your user profile).
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            We will write the model file, a shortcut to open the editor, and a README.md file in the
            chosen folder.
          </p>
        </div>
      </div>

      <!-- Footer Actions -->
      <div
        class="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800"
      >
        <button
          @click="closeModal"
          class="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition"
          :disabled="busy"
        >
          Cancel
        </button>
        <button
          @click="handleSaveWorkspace"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-white cursor-pointer transition disabled:opacity-50"
          :disabled="busy"
        >
          <FolderOpen class="w-4 h-4" />
          <span>{{ busy ? 'Saving...' : 'Choose Folder' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
