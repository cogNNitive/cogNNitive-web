<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  FolderOpen,
  FolderClock,
  Folder,
  FileText,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Loader2,
  Info,
  Sparkles,
  ExternalLink,
  PlusCircle,
  Copy,
  Check,
  X,
  ChevronDown,
} from 'lucide-vue-next'
import { useRouter, useRoute } from 'vue-router'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { DirectoryHandleLike } from '../model/fs-types'
import type { FolderHistoryEntry } from '../shared/validation-types'
import {
  loadHistory,
  addToHistory,
  removeFromHistory,
  clearHistory,
  formatTimestamp,
  getStoredHandle,
} from '../stores/historyStore'
import { useToast } from '../shared/useToast'
import { modelStemMatches } from '../utils/knowledgeMatching'
import { createDirectoryHandleFromFileList } from '../utils/fileListDirectoryHandle'

import { resolveWorkspacePreset } from '../config/workspaces'

const router = useRouter()
const route = useRoute()
const workspace = useWorkspaceStore()
const { show: showToast } = useToast()
const error = ref<string | null>(null)
const history = ref<FolderHistoryEntry[]>([])
const reopenBusy = ref<string | null>(null)
const folderBusy = ref(false)
const folderInputRef = ref<HTMLInputElement | null>(null)

// Collapsible Sections State
const activeSection = ref<'new' | 'open' | null>(null)

function toggleSection(section: 'new' | 'open'): void {
  activeSection.value = activeSection.value === section ? null : section
}

// Bootstrap Modal State
const showBootstrapModal = ref(false)
const pendingBootstrapHandle = ref<DirectoryHandleLike | null>(null)
const pendingBootstrapName = ref('')
const copiedPrompt = ref(false)
const copiedCd = ref(false)
const isPollingBootstrap = ref(false)
const pollingIntervalId = ref<number | null>(null)

const hasDeepLink = !!(
  route.query.workspace ||
  route.query.models ||
  route.query.model ||
  route.query.url ||
  route.query.doc
)
const isDeepLinkLoading = ref(hasDeepLink)

function getInitialDeepLinkMessage(): string {
  if (route.query.workspace) return 'Loading workspace preset...'
  if (route.query.models) return 'Loading models...'
  const directUrl = (route.query.model || route.query.url || route.query.doc) as string | undefined
  if (directUrl && /^(https?:\/\/|\/|\.\/)/i.test(directUrl)) {
    return 'Loading remote model...'
  }
  if (route.query.model) {
    return `Opening workspace for "${route.query.model}"...`
  }
  return 'Loading workspace...'
}

const deepLinkMessage = ref(getInitialDeepLinkMessage())

onMounted(async () => {
  try {
    history.value = await loadHistory()

    // Intercept workspace preset deep-links (e.g. ?workspace=startup-founder)
    const wsSlug = route.query.workspace as string | undefined
    if (wsSlug) {
      deepLinkMessage.value = 'Loading workspace preset...'
      const preset = resolveWorkspacePreset(wsSlug)
      if (preset) {
        try {
          await workspace.loadVirtualWorkspace(preset.modelUrls, preset.name, preset.templateName)
          await router.push({ path: '/workspace', query: route.query, hash: route.hash })
          return
        } catch (err) {
          error.value = `Failed to load virtual workspace "${preset.name}": ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }

    // Intercept multi-model deep-links (e.g. ?models=url1,url2)
    const multiModels = route.query.models as string | undefined
    if (multiModels) {
      deepLinkMessage.value = 'Loading models...'
      const urls = multiModels.split(',').map((u) => u.trim()).filter(Boolean)
      if (urls.length > 0) {
        try {
          await workspace.loadVirtualWorkspace(urls)
          await router.push({ path: '/workspace', query: route.query, hash: route.hash })
          return
        } catch (err) {
          error.value = `Failed to load models: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }

    // Intercept remote model URLs (?model=https://... or ?url=https://... or ?doc=https://...)
    const directUrl = (route.query.model || route.query.url || route.query.doc) as string | undefined
    if (directUrl && /^(https?:\/\/|\/|\.\/)/i.test(directUrl)) {
      deepLinkMessage.value = 'Loading remote model...'
      try {
        await workspace.loadVirtualWorkspace([directUrl])
        await router.push({ path: '/workspace', query: route.query, hash: route.hash })
        return
      } catch (err) {
        error.value = `Failed to load remote model: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    // Auto-reopen local workspace containing the deep-linked model if found in history
    if (route.query.model && history.value.length > 0) {
      deepLinkMessage.value = `Opening workspace for "${route.query.model}"...`
      const modelId = typeof route.query.model === 'string' ? route.query.model : undefined
      const wsHint = typeof route.query.ws === 'string' ? route.query.ws : undefined
      const entry = await resolveWorkspaceForDeepLink(history.value, modelId, wsHint)
      if (entry) {
        try {
          const handle = await getStoredHandle(entry.handleKey)
          if (handle) {
            await workspace.open(handle, { force: true })
            if (workspace.hasParsed) {
              await router.push({
                path: '/workspace',
                query: route.query,
                hash: route.hash,
              })
              return
            }
          }
        } catch (e) {
          console.warn('Failed to auto-reopen workspace:', e)
        }
      }
    }

    // No deep-link workspace: user stays on Home to pick a folder or recent workspace.
  } finally {
    isDeepLinkLoading.value = false
  }
})

onUnmounted(() => {
  stopBootstrapPolling()
})

/**
 * Checks whether a directory handle contains at least one `*_NN.md` model file.
 */
async function checkFolderHasModels(handle: DirectoryHandleLike): Promise<boolean> {
  try {
    for await (const [name, child] of handle.entries()) {
      if (child.kind === 'file' && name.endsWith('_NN.md')) {
        return true
      }
      if (child.kind === 'directory') {
        for await (const [subName, subChild] of child.entries()) {
          if (subChild.kind === 'file' && subName.endsWith('_NN.md')) {
            return true
          }
        }
      }
    }
  } catch {
    return false
  }
  return false
}

/**
 * Picks the workspace entry a deep link (`?view=editor&model=<id>[&ws=<hint>]`)
 * should reopen. Priority: explicit `&ws=` hint, then the most recent entry
 * whose folder actually contains a model matching the deep-linked id. Falls
 * back to the most recent entry when nothing matches.
 */
async function resolveWorkspaceForDeepLink(
  entries: FolderHistoryEntry[],
  modelId?: string,
  wsHint?: string,
): Promise<FolderHistoryEntry | null> {
  if (wsHint) {
    const hinted = entries.find(
      (e) => e.handleKey === wsHint || e.name.toLowerCase() === wsHint.toLowerCase(),
    )
    if (hinted && (await isWorkspaceOpenable(hinted))) return hinted
  }

  if (modelId) {
    for (const entry of entries) {
      if (!(await isWorkspaceOpenable(entry))) continue
      const handle = await getStoredHandle(entry.handleKey)
      if (handle && (await folderContainsModel(handle, modelId))) return entry
    }
  }

  return entries[0] ?? null
}

async function isWorkspaceOpenable(entry: FolderHistoryEntry): Promise<boolean> {
  if (!entry.handleKey) return false
  const handle = await getStoredHandle(entry.handleKey)
  if (!handle) return false
  const status = await (
    handle as unknown as { queryPermission?: (opts: { mode: string }) => Promise<string> }
  ).queryPermission?.({ mode: 'read' })
  return status === 'granted'
}

async function folderContainsModel(root: DirectoryHandleLike, modelId: string): Promise<boolean> {
  let found = false
  const visit = async (dir: DirectoryHandleLike, depth: number): Promise<void> => {
    if (found || depth > 10) return
    for await (const [name, child] of dir.entries()) {
      if (found) return
      if (child.kind === 'directory') {
        await visit(child, depth + 1)
      } else if (modelStemMatches(name, modelId)) {
        found = true
        return
      }
    }
  }
  await visit(root, 0)
  return found
}

watch(
  () => workspace.emptyFolderError,
  (val) => {
    if (val && !showBootstrapModal.value) {
      showToast(
        workspace.error
          ? `Could not load the model: ${workspace.error}`
          : 'No iNNfo models found in this folder.',
        'warning',
      )
      workspace.emptyFolderError = false
    }
  },
)

async function reopenFolder(entry: FolderHistoryEntry): Promise<void> {
  error.value = null
  if (reopenBusy.value) return
  reopenBusy.value = entry.handleKey
  try {
    const handle = await getStoredHandle(entry.handleKey)
    if (!handle) {
      await removeFromHistory(entry.handleKey)
      history.value = await loadHistory()
      error.value = `"${entry.name}" is no longer accessible. It has been removed from your recent list.`
      return
    }

    const perm = await (
      handle as unknown as { requestPermission?: (opts: { mode: string }) => Promise<string> }
    ).requestPermission?.({ mode: 'read' })

    if (perm === 'denied' || perm === 'prompt') {
      await removeFromHistory(entry.handleKey)
      history.value = await loadHistory()
      error.value = `Cannot open "${entry.name}" — permission was denied.`
      return
    }

    await workspace.open(handle, { force: true })
    await router.push({ path: '/workspace', query: route.query, hash: route.hash })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    reopenBusy.value = null
  }
}

async function removeEntry(handleKey: string): Promise<void> {
  await removeFromHistory(handleKey)
  history.value = await loadHistory()
}

async function clearAllHistory(): Promise<void> {
  await clearHistory()
  history.value = await loadHistory()
}

async function openWorkspace(_mode?: 'new' | 'open'): Promise<void> {
  error.value = null
  folderBusy.value = true
  try {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: (opts?: { id?: string }) => Promise<DirectoryHandleLike>
      }
    ).showDirectoryPicker
    if (picker) {
      const handle = await picker.call(window, { id: 'innfo-workspace' })
      const hasModels = await checkFolderHasModels(handle)

      if (!hasModels) {
        // Empty directory: activate contextual Bootstrap Modal
        pendingBootstrapHandle.value = handle
        pendingBootstrapName.value = handle.name
        showBootstrapModal.value = true
        startBootstrapPolling()
        return
      }

      await workspace.open(handle)
      if (!workspace.hasParsed) {
        if (workspace.error) {
          error.value = workspace.error
        }
        return
      }
      await addToHistory(handle.name, handle)
      history.value = await loadHistory()
      await router.push({ path: '/workspace', query: route.query, hash: route.hash })
    } else {
      error.value =
        'Your browser does not support the File System Access API. Using fallback folder picker (read-only).'
      folderInputRef.value?.click()
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    folderBusy.value = false
  }
}

function startBootstrapPolling(): void {
  stopBootstrapPolling()
  isPollingBootstrap.value = true
  pollingIntervalId.value = window.setInterval(async () => {
    if (!pendingBootstrapHandle.value || !showBootstrapModal.value) {
      stopBootstrapPolling()
      return
    }
    const hasModels = await checkFolderHasModels(pendingBootstrapHandle.value)
    if (hasModels) {
      const handle = pendingBootstrapHandle.value
      stopBootstrapPolling()
      showBootstrapModal.value = false
      await workspace.open(handle)
      await addToHistory(handle.name, handle)
      history.value = await loadHistory()
      router.push({ path: '/workspace', query: route.query, hash: route.hash })
    }
  }, 3000)
}

function stopBootstrapPolling(): void {
  if (pollingIntervalId.value !== null) {
    clearInterval(pollingIntervalId.value)
    pollingIntervalId.value = null
  }
  isPollingBootstrap.value = false
}

async function manualCheckBootstrap(): Promise<void> {
  if (!pendingBootstrapHandle.value) return
  error.value = null
  const hasModels = await checkFolderHasModels(pendingBootstrapHandle.value)
  if (hasModels) {
    const handle = pendingBootstrapHandle.value
    stopBootstrapPolling()
    showBootstrapModal.value = false
    await workspace.open(handle)
    await addToHistory(handle.name, handle)
    history.value = await loadHistory()
    router.push({ path: '/workspace', query: route.query, hash: route.hash })
  } else {
    showToast('No _NN.md model files detected yet. Run the prompt in your AI agent.', 'info')
  }
}

function closeBootstrapModal(): void {
  stopBootstrapPolling()
  showBootstrapModal.value = false
  pendingBootstrapHandle.value = null
  pendingBootstrapName.value = ''
}

async function copyToClipboard(text: string, type: 'prompt' | 'cd'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    if (type === 'prompt') {
      copiedPrompt.value = true
      setTimeout(() => {
        copiedPrompt.value = false
      }, 2500)
    } else {
      copiedCd.value = true
      setTimeout(() => {
        copiedCd.value = false
      }, 2500)
    }
    showToast('Copied to clipboard!', 'success')
  } catch {
    showToast('Failed to copy text', 'error')
  }
}

async function onFolderInputChange(event: Event): Promise<void> {
  error.value = null
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  folderBusy.value = true
  try {
    const nnFiles = Array.from(files).filter((f) => f.name.endsWith('_NN.md'))
    if (nnFiles.length === 0) {
      error.value = 'No iNNfo model files (_NN.md) found in this folder.'
      return
    }

    const handle = createDirectoryHandleFromFileList(files)
    await workspace.open(handle, { force: true })

    if (!workspace.hasParsed) {
      error.value = workspace.emptyFolderError
        ? 'No iNNfo model files (_NN.md) found in this folder.'
        : workspace.error || 'Could not load any iNNfo model from this folder.'
      return
    }

    const relPath = nnFiles[0].webkitRelativePath
    const dirName = relPath.split('/')[0] || 'workspace'
    await addToHistory(dirName, null, relPath, { reopenable: false })
    history.value = await loadHistory()
    router.push({ path: '/workspace', query: route.query, hash: route.hash })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    folderBusy.value = false
    input.value = ''
  }
}
</script>

<template>
  <div class="home max-w-4xl mx-auto p-6 space-y-8">
    <!-- Deep Link Loading State -->
    <div
      v-if="isDeepLinkLoading"
      class="min-h-[50vh] flex flex-col items-center justify-center space-y-5 text-center"
      data-testid="deep-link-loader"
    >
      <div
        class="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center shadow-md"
      >
        <Loader2 class="w-8 h-8 text-purple-700 dark:text-purple-300 animate-spin" />
      </div>
      <div class="space-y-1.5 max-w-sm">
        <h2 class="text-base font-bold text-slate-800 dark:text-slate-100">
          {{ deepLinkMessage }}
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Opening and preparing the workspace...
        </p>
      </div>
    </div>

    <template v-else>
      <!-- Hero Card with Stacked Expandable Action Pathways -->
      <section class="hero text-center space-y-4">
        <div
          class="bg-gradient-to-br from-purple-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-purple-900/20 dark:border-purple-900/40 rounded-2xl p-6 sm:p-8 shadow-xs"
        >
          <h1 class="text-3xl font-black text-purple-950 dark:text-purple-300">
            cogNNitive Modeler
          </h1>
          <p class="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto mt-2 leading-relaxed">
            Open a local folder (workspace) containing iNNfo model files (<code class="font-mono text-purple-700 dark:text-purple-300">*_NN.md</code>)
            to explore, edit, and visualize your knowledge base.
          </p>

          <!-- Stacked Expandable Action Cards -->
          <div class="space-y-3.5 mt-6 text-left max-w-xl mx-auto">
            <!-- Card 1: Create New Workspace -->
            <div
              class="bg-white dark:bg-slate-900/90 border rounded-2xl transition-all shadow-xs overflow-hidden"
              :class="activeSection === 'new' ? 'border-purple-500 dark:border-purple-600 ring-2 ring-purple-500/20' : 'border-purple-200/80 dark:border-purple-800/60 hover:border-purple-300 dark:hover:border-purple-700'"
              data-testid="card-new-workspace"
            >
              <!-- Accordion Header -->
              <button
                type="button"
                class="w-full p-4 sm:p-4.5 flex items-center justify-between gap-3 text-left cursor-pointer select-none transition-colors"
                :class="activeSection === 'new' ? 'bg-purple-50/50 dark:bg-purple-950/20' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'"
                @click="toggleSection('new')"
              >
                <div class="flex items-center gap-3">
                  <span
                    class="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shrink-0"
                  >
                    <Sparkles class="w-4 h-4" />
                  </span>
                  <div>
                    <h2 class="text-sm font-bold text-purple-950 dark:text-purple-100">
                      Create New Workspace
                    </h2>
                    <span class="text-3xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Bootstrap with AI Agent
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                  <ChevronDown
                    class="w-5 h-5 transition-transform duration-200"
                    :class="{ 'rotate-180 text-purple-700 dark:text-purple-300': activeSection === 'new' }"
                  />
                </div>
              </button>

              <!-- Collapsible Body -->
              <div
                v-if="activeSection === 'new'"
                class="p-4 sm:p-5 pt-0 border-t border-purple-100/60 dark:border-purple-900/30 space-y-3.5"
              >
                <div class="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-3">
                  <p>
                    1. Create an empty folder on your computer (e.g. in your
                    <code class="font-semibold bg-purple-50 dark:bg-slate-800 px-1 py-0.5 rounded text-purple-900 dark:text-purple-300">Documents</code> folder).
                  </p>
                  <p class="flex items-start gap-1.5 text-2xs text-purple-900 dark:text-purple-300 font-medium bg-purple-50/60 dark:bg-purple-950/40 p-2 rounded-lg border border-purple-200/60 dark:border-purple-900/40">
                    <Info class="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
                    <span><strong>Convention tip:</strong> Recommend ending folder name with <code class="font-bold text-purple-700 dark:text-purple-300">_NN</code> (e.g. <code class="font-mono">my-project_NN</code>).</span>
                  </p>
                </div>

                <!-- Prerequisite Callout -->
                <div class="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-2xs space-y-1.5">
                  <div class="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>Prerequisite: Local AI Coding Agent</span>
                  </div>
                  <p class="text-slate-600 dark:text-slate-300 text-3xs leading-relaxed">
                    Requires <strong class="text-slate-800 dark:text-slate-100">OpenCode</strong> (recommended), <strong class="text-slate-800 dark:text-slate-100">Claude Code</strong>, <strong class="text-slate-800 dark:text-slate-100">Antigravity</strong>, or <strong class="text-slate-800 dark:text-slate-100">Codex</strong>.
                  </p>
                  <a
                    href="https://cognnitive.com/innfo/documentation/#/installing-ai-agents"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 font-bold hover:underline text-3xs mt-0.5"
                  >
                    <span>Installing AI Agents Guide</span>
                    <ExternalLink class="w-3 h-3" />
                  </a>
                </div>

                <div class="pt-1">
                  <button
                    class="w-full py-2.5 rounded-xl bg-purple-900 hover:bg-purple-950 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    :disabled="folderBusy"
                    @click="openWorkspace('new')"
                  >
                    <PlusCircle class="w-4 h-4" />
                    <span>{{ folderBusy ? 'Opening...' : 'Select Folder for New Workspace' }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Card 2: Open Existing Workspace -->
            <div
              class="bg-white dark:bg-slate-900/90 border rounded-2xl transition-all shadow-xs overflow-hidden"
              :class="activeSection === 'open' ? 'border-purple-500 dark:border-purple-600 ring-2 ring-purple-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700'"
              data-testid="card-existing-workspace"
            >
              <!-- Accordion Header -->
              <button
                type="button"
                class="w-full p-4 sm:p-4.5 flex items-center justify-between gap-3 text-left cursor-pointer select-none transition-colors"
                :class="activeSection === 'open' ? 'bg-purple-50/50 dark:bg-purple-950/20' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'"
                @click="toggleSection('open')"
              >
                <div class="flex items-center gap-3">
                  <span
                    class="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0"
                  >
                    <FolderOpen class="w-4 h-4" />
                  </span>
                  <div>
                    <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Open Existing Workspace
                    </h2>
                    <span class="text-3xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Local Knowledge Base
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                  <ChevronDown
                    class="w-5 h-5 transition-transform duration-200"
                    :class="{ 'rotate-180 text-purple-700 dark:text-purple-300': activeSection === 'open' }"
                  />
                </div>
              </button>

              <!-- Collapsible Body -->
              <div
                v-if="activeSection === 'open'"
                class="p-4 sm:p-5 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-3.5"
              >
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-3">
                  Select the root directory of an existing project containing <code class="font-mono text-purple-700 dark:text-purple-300 font-semibold">*_NN.md</code> model files.
                </p>

                <!-- Folder vs File visual guide -->
                <div class="flex flex-col sm:flex-row items-center justify-center gap-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-2.5 text-left text-2xs">
                  <div class="flex flex-col gap-0.5 font-mono text-[10px] select-none shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2 shadow-2xs w-full sm:w-auto">
                    <div class="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 font-semibold folder-glow">
                      <Folder class="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>my-project_NN/</span>
                      <CheckCircle2 class="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 ml-1" />
                    </div>
                    <div class="flex items-center gap-1 pl-3.5 py-0.5 text-slate-400 dark:text-slate-500 opacity-70">
                      <FileText class="w-2.5 h-2.5 text-purple-400" />
                      <span>Model_NN.md</span>
                    </div>
                  </div>
                  <div class="text-slate-500 dark:text-slate-400 text-3xs leading-relaxed">
                    <strong>Tip:</strong> File dialogs only show folders. Select the parent folder and confirm.
                  </div>
                </div>

                <div class="pt-1 space-y-2">
                  <button
                    class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white dark:bg-purple-900 dark:hover:bg-purple-950 font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    :disabled="folderBusy"
                    @click="openWorkspace('open')"
                  >
                    <FolderOpen class="w-4 h-4" />
                    <span>{{ folderBusy ? 'Opening...' : 'Open Workspace Folder' }}</span>
                  </button>
                  <p class="text-center text-3xs text-slate-400 dark:text-slate-500">
                    Already opened recently? Find it below in <strong class="text-slate-600 dark:text-slate-300">Recent Workspaces</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="error"
            class="mt-4 p-3 rounded-lg text-xs bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 flex items-center justify-center gap-2"
            role="alert"
          >
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span>{{ error }}</span>
          </div>

          <input
            ref="folderInputRef"
            type="file"
            webkitdirectory
            multiple
            class="hidden"
            @change="onFolderInputChange"
          />
        </div>
      </section>

      <!-- Contextual Bootstrap Modal -->
      <div
        v-if="showBootstrapModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        data-testid="bootstrap-modal"
      >
        <div
          class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-purple-200 dark:border-purple-800/60 p-6 space-y-5 text-left"
        >
          <button
            class="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
            @click="closeBootstrapModal"
          >
            <X class="w-5 h-5" />
          </button>

          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0"
            >
              <Sparkles class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-base font-bold text-purple-950 dark:text-purple-100">
                Bootstrap New Workspace
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Selected Folder:
                <code
                  class="font-mono font-bold text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded"
                >
                  {{ pendingBootstrapName }}
                </code>
              </p>
            </div>
          </div>

          <div class="space-y-4 text-xs">
            <!-- Step 1: Terminal / Agent -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span
                    class="flex items-center justify-center w-5 h-5 rounded-full bg-purple-900 text-white text-3xs font-bold"
                  >
                    1
                  </span>
                  <span>Open your AI Agent or Terminal in this folder</span>
                </span>
                <button
                  class="text-3xs text-purple-700 dark:text-purple-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  @click="copyToClipboard(`cd ~/Documents/${pendingBootstrapName}`, 'cd')"
                >
                  <component :is="copiedCd ? Check : Copy" class="w-3 h-3" />
                  <span>{{ copiedCd ? 'Copied cd' : 'Copy command' }}</span>
                </button>
              </div>
              <div
                class="bg-slate-900 text-purple-200 font-mono text-2xs p-2.5 rounded-lg border border-slate-800 flex items-center justify-between"
              >
                <span>cd ~/Documents/{{ pendingBootstrapName }}</span>
              </div>
              <p class="text-3xs text-slate-500 dark:text-slate-400">
                Launch <strong>OpenCode</strong> (recommended), <strong>Claude Code</strong>,
                <strong>Antigravity</strong>, or <strong>Codex</strong>.
              </p>
            </div>

            <!-- Step 2: Bootstrap Prompt -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span
                    class="flex items-center justify-center w-5 h-5 rounded-full bg-purple-900 text-white text-3xs font-bold"
                  >
                    2
                  </span>
                  <span>Paste this prompt into your AI Agent</span>
                </span>
                <button
                  class="text-3xs text-purple-700 dark:text-purple-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  @click="
                    copyToClipboard(
                      'innfo: bootstrap a new workspace model in this directory',
                      'prompt',
                    )
                  "
                >
                  <component :is="copiedPrompt ? Check : Copy" class="w-3 h-3" />
                  <span>{{ copiedPrompt ? 'Copied prompt!' : 'Copy prompt' }}</span>
                </button>
              </div>
              <div
                class="bg-purple-950/80 text-purple-100 font-mono text-xs p-3 rounded-lg border border-purple-800 flex items-center justify-between select-all"
              >
                <span>innfo: bootstrap a new workspace model in this directory</span>
                <button
                  class="p-1.5 rounded-md bg-purple-800 hover:bg-purple-700 text-white transition-colors cursor-pointer shrink-0 ml-2"
                  title="Copy prompt"
                  @click="
                    copyToClipboard(
                      'innfo: bootstrap a new workspace model in this directory',
                      'prompt',
                    )
                  "
                >
                  <component :is="copiedPrompt ? Check : Copy" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Step 3: Detection & Status -->
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div
                class="flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 p-3 rounded-xl"
              >
                <div class="flex items-center gap-2.5">
                  <Loader2 class="w-4 h-4 text-purple-700 dark:text-purple-400 animate-spin" />
                  <div class="text-2xs">
                    <span class="font-bold text-slate-800 dark:text-slate-200 block">
                      Listening for file creation...
                    </span>
                    <span class="text-slate-500 dark:text-slate-400">
                      The modeler will automatically load once your agent writes the model file.
                    </span>
                  </div>
                </div>
                <button
                  class="px-3 py-1.5 rounded-lg bg-purple-900 hover:bg-purple-950 text-white font-bold text-2xs shadow-xs transition-all shrink-0 cursor-pointer"
                  @click="manualCheckBootstrap"
                >
                  Check &amp; Open
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Workspaces -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2
            class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
          >
            <FolderClock class="w-3.5 h-3.5" />
            <span>Recent Workspaces</span>
          </h2>
          <button
            v-if="history.length"
            class="text-2xs font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            @click="clearAllHistory"
          >
            Clear all
          </button>
        </div>

        <!-- History entries -->
        <div v-if="history.length" class="space-y-2">
          <button
            v-for="entry in history"
            :key="entry.handleKey"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-purple-400 dark:hover:border-purple-600 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all cursor-pointer group disabled:opacity-50"
            :disabled="reopenBusy === entry.handleKey || entry.reopenable === false"
            :title="
              entry.reopenable === false
                ? 'Opened via the fallback folder picker — pick the folder again to reopen it.'
                : undefined
            "
            data-testid="history-entry"
            @click="reopenFolder(entry)"
          >
            <span
              class="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0"
            >
              <FolderOpen class="w-4 h-4" />
            </span>
            <span class="flex-1 min-w-0">
              <span class="flex items-center gap-1.5">
                <span class="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {{ entry.name }}
                </span>
                <span
                  v-if="entry.reopenable === false"
                  class="shrink-0 px-1.5 py-0.5 rounded text-3xs font-semibold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
                  data-testid="history-entry-not-reopenable"
                >
                  Not reopenable
                </span>
              </span>
              <span
                v-if="entry.path && entry.path !== entry.name"
                class="block text-3xs text-slate-400 dark:text-slate-500 truncate"
              >
                {{ entry.path }}
              </span>
            </span>
            <span class="text-3xs text-slate-400 dark:text-slate-500 shrink-0">
              {{ formatTimestamp(entry.timestamp) }}
            </span>
            <button
              type="button"
              class="p-1.5 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:text-slate-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
              :aria-label="`Remove ${entry.name} from recent workspaces`"
              @click.stop="removeEntry(entry.handleKey)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </button>
        </div>

        <!-- Empty state -->
        <div
          v-else
          class="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 space-y-1.5"
        >
          <p class="text-xs font-semibold text-slate-600 dark:text-slate-400">
            No recent workspaces yet
          </p>
          <p class="text-3xs">
            Open a local workspace folder containing iNNfo models to get started.
          </p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
@keyframes folderPulse {
  0%,
  100% {
    transform: translateY(0);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    transform: translateY(-1px);
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
  }
}

.folder-glow {
  animation: folderPulse 2.5s ease-in-out infinite;
}
</style>
