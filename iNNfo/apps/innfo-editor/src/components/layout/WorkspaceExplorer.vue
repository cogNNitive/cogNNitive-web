<template>
  <div class="flex flex-col h-full space-y-3" data-testid="workspace-explorer">
    <!-- Explorer Header & Actions -->
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-1.5">
        <FolderTree class="w-3.5 h-3.5 text-primary-500 shrink-0" />
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Explorer
        </h2>
      </div>

      <button
        @click="refreshTree"
        class="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        title="Refresh workspace tree"
        data-testid="refresh-explorer"
      >
        <RotateCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
      </button>
    </div>

    <!-- Search Input -->
    <div class="relative px-1">
      <Search class="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Filter files..."
        class="w-full pl-8 pr-7 py-1.5 text-xs rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 text-slate-700 dark:text-slate-200 placeholder-slate-400"
      />
      <button
        v-if="searchQuery"
        @click="searchQuery = ''"
        class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Tree Content -->
    <div class="flex-1 overflow-y-auto space-y-0.5 pr-1">
      <div v-if="isLoading" class="p-4 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
        <Loader class="w-4 h-4 animate-spin text-primary" />
        <span>Scanning directory...</span>
      </div>

      <div v-else-if="treeItems.length === 0" class="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">
        No files found in workspace.
      </div>

      <FileTreeNode
        v-else
        v-for="item in treeItems"
        :key="item.path"
        :item="item"
        :search-query="searchQuery"
        @select-file="handleSelectFile"
        @view-file="handleViewFile"
        @download-file="handleDownloadFile"
      />
    </div>

    <!-- File Content Viewer Modal -->
    <FilePreviewModal
      v-if="showFileModal && activeFileForModal"
      :is-open="showFileModal"
      :kind="activeFileForModal.kind"
      :file-path="activeFileForModal.filePath"
      :file-name="activeFileForModal.fileName"
      @close="showFileModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { FolderTree, Search, RotateCw, Loader, X } from 'lucide-vue-next'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import FilePreviewModal from '../editor/FilePreviewModal.vue'
import { classifyExplorerItem } from '../../utils/explorerClassify'
import { useUiStore } from '../../stores/uiStore'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import FileTreeNode, { type FileItem } from './FileTreeNode.vue'
import type { DirectoryHandleLike } from '../../model/fs-types'

interface ActiveFileForModal {
  filePath: string
  fileName: string
  kind: 'artifact' | 'source' | 'model' | 'file'
}

const workspaceStore = useWorkspaceStore()
const uiStore = useUiStore()
const knowledgeStore = useKnowledgeStore()

const treeItems = ref<FileItem[]>([])
const isLoading = ref(false)
const searchQuery = ref('')

async function buildTreeFromHandle(handle: DirectoryHandleLike, pathPrefix = ''): Promise<FileItem[]> {
  const items: FileItem[] = []
  try {
    for await (const [name, entryHandle] of handle.entries()) {
      const currentPath = pathPrefix ? `${pathPrefix}/${name}` : name
      if (entryHandle.kind === 'directory') {
        const children = await buildTreeFromHandle(entryHandle, currentPath)
        items.push({
          name,
          kind: 'directory',
          path: currentPath,
          children,
        })
      } else {
        items.push({
          name,
          kind: 'file',
          path: currentPath,
        })
      }
    }
  } catch (err) {
    console.warn('[WorkspaceExplorer] Failed to read handle entries:', err)
  }

  // Sort directories first, then files alphabetically
  return items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function pathsToTree(paths: string[]): FileItem[] {
  const rootItems: FileItem[] = []

  for (const rawPath of paths) {
    const parts = rawPath.replace(/\\/g, '/').split('/').filter(Boolean)
    let currentLevel = rootItems

    let currentPath = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = i === parts.length - 1

      let existing = currentLevel.find((item) => item.name === part)
      if (!existing) {
        existing = {
          name: part,
          kind: isFile ? 'file' : 'directory',
          path: currentPath,
          children: isFile ? undefined : [],
        }
        currentLevel.push(existing)
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children
      }
    }
  }

  function sortTree(items: FileItem[]): FileItem[] {
    for (const item of items) {
      if (item.kind === 'directory' && item.children) {
        item.children = sortTree(item.children)
      }
    }
    return items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  return sortTree(rootItems)
}

function buildVirtualTree(): FileItem[] {
  const pathsSet = new Set<string>()

  // Collect all model node paths & source references
  for (const node of Object.values(knowledgeStore.nodes)) {
    if (node.source?.path) {
      pathsSet.add(node.source.path)
    }
    if (node.fields) {
      for (const val of Object.values(node.fields)) {
        const rawVal = val as unknown
        if (typeof rawVal === 'string' && (rawVal.includes('/') || rawVal.includes('\\')) && !rawVal.startsWith('http')) {
          pathsSet.add(rawVal)
        }
      }
    }
  }

  // Fallback if no paths were found
  if (pathsSet.size === 0) {
    for (const rootId of knowledgeStore.rootIds) {
      const node = knowledgeStore.nodes[rootId]
      if (node) {
        pathsSet.add(`${node.name || 'model'}_NN.md`)
      }
    }
  }

  return pathsToTree(Array.from(pathsSet))
}

async function refreshTree(): Promise<void> {
  isLoading.value = true
  try {
    if (workspaceStore.handle) {
      treeItems.value = await buildTreeFromHandle(workspaceStore.handle)
    } else {
      treeItems.value = buildVirtualTree()
    }
  } finally {
    isLoading.value = false
  }
}

const activeFileForModal = ref<ActiveFileForModal | null>(null)
const showFileModal = ref(false)

function handleViewFile(item: FileItem): void {
  activeFileForModal.value = {
    filePath: item.path,
    fileName: item.name,
    kind: classifyExplorerItem(item) ?? 'file',
  }
  showFileModal.value = true
}

async function handleDownloadFile(item: FileItem): Promise<void> {
  try {
    const handle = workspaceStore.handle
    let fileBlob: Blob

    if (handle) {
      fileBlob = (await workspaceStore.readFileBlob(item.path)) ?? new Blob()
    } else {
      // Fallback for virtual tree
      const resp = await fetch(item.path)
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`)
      fileBlob = await resp.blob()
    }

    const objectUrl = URL.createObjectURL(fileBlob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = item.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  } catch (err) {
    console.error('[WorkspaceExplorer] Failed to download file:', err)
    alert(`No se pudo descargar el archivo: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function handleSelectFile(item: FileItem): void {
  const matchingNode = Object.values(knowledgeStore.nodes).find(
    (n) => n.source?.path === item.path || n.source?.path?.endsWith(item.name),
  )

  if (matchingNode) {
    uiStore.selectNode(matchingNode.id)
    uiStore.setActiveView('editor')
  } else {
    handleViewFile(item)
  }
}

onMounted(() => {
  refreshTree()
})

watch(
  () => workspaceStore.handle,
  () => {
    refreshTree()
  },
)
</script>
