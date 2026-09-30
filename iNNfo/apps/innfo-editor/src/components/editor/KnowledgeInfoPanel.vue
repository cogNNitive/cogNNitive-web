<template>
  <div class="space-y-6 max-w-4xl mx-auto p-1">
    <!-- Header Section -->
    <div class="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
      <div
        class="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shadow-xs"
      >
        <span class="font-mono text-lg font-black text-primary select-none leading-none">_NN</span>
      </div>
      <div class="flex-1 min-w-0">
        <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
          Model Information & Workspace
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Manage your workspace files, inspect metamodel configurations, and view raw model data.
        </p>
      </div>
      <button
        @click="isPromptModalOpen = true"
        class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
        title="Generate OpenCode / Agent Prompt for this Model"
      >
        <Terminal class="w-4 h-4" />
        <span>Prompt Agent</span>
      </button>
    </div>

    <!-- Workspace Model Selector (Multi-Model Workspace) -->
    <div
      v-if="availableModels.length > 1"
      class="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
      data-testid="info-panel-model-selector"
    >
      <div class="flex items-center gap-2">
        <Database class="w-4 h-4 text-primary" />
        <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Inspeccionar Modelo:</span>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="m in availableModels"
          :key="m.id"
          @click="activeModelId = m.id"
          class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border"
          :class="
            activeModelId === m.id
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-primary/50'
          "
        >
          {{ m.name }}
        </button>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Left Column: Workspace & Files -->
      <div
        class="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs space-y-4"
      >
        <div
          class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3"
        >
          <h3
            class="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
          >
            <FolderOpen class="w-4 h-4 text-primary" />
            Workspace Directory
          </h3>
          <span
            :class="
              workspaceStore.handle
                ? 'bg-emerald-50 text-emerald-750 ring-emerald-600/10 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-900/30 dark:text-amber-400'
            "
            class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
          >
            {{ workspaceStore.handle ? 'Connected' : 'Demo Mode' }}
          </span>
        </div>

        <!-- Connected State -->
        <div v-if="workspaceStore.handle" class="space-y-3">
          <div
            class="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2 rounded-md border border-slate-200 dark:border-slate-700"
          >
            <span class="truncate font-mono font-semibold text-slate-900 dark:text-slate-100">{{
              workspaceStore.handle.name
            }}</span>
          </div>

          <div class="space-y-1.5">
            <label
              class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block px-1"
              >Model Info</label
            >
            <div
              class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2 text-xs"
            >
              <div class="flex justify-between">
                <span class="text-slate-500">Root Node:</span>
                <span class="font-medium text-slate-900 dark:text-slate-100 font-mono">{{
                  rootNodeId
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Total Nodes:</span>
                <span class="font-medium text-slate-900 dark:text-slate-100">{{ nodeCount }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Disconnected State -->
        <div v-else class="py-8 text-center space-y-4">
          <FolderOpen class="w-12 h-12 text-slate-400/45 mx-auto" />
          <div class="space-y-1">
            <p class="text-xs text-slate-500 dark:text-slate-400">
              No workspace directory connected. Load a model from the home page.
            </p>
          </div>
        </div>

        <!-- Sync / Local Status Card (from Modal) -->
        <div class="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-805 dark:text-slate-200">Local Status:</span>
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs font-semibold ring-1 ring-inset"
              :class="workspaceStore.handle
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-600/20'
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-amber-600/20'"
            >
              {{ workspaceStore.handle ? 'Downloaded & Synced' : 'Loaded from URL (Pending Save)' }}
            </span>
          </div>
          <p class="text-3xs text-slate-500 dark:text-slate-400 leading-normal">
            {{ workspaceStore.handle
              ? `This model is loaded from your local directory: "${workspaceStore.handle?.name}". All changes are saved directly to your local file system.`
              : 'This model is currently loaded directly from a remote GitHub repository URL. Any edits are only in memory and won\'t be saved permanently until you download it.' }}
          </p>
          
          <!-- Instructions for saving -->
          <div
            v-if="!workspaceStore.handle"
            class="border-t border-slate-200 dark:border-slate-700/60 pt-2 mt-2"
          >
            <span class="font-bold text-slate-700 dark:text-slate-350 block mb-1">How to save the model:</span>
            <p class="text-3xs text-slate-500 dark:text-slate-400 leading-normal">
              Click the <strong class="text-slate-700 dark:text-slate-300">Save</strong> button (or <strong class="text-slate-700 dark:text-slate-300">Ctrl+S</strong>) in the top-right header. You will be prompted to choose a local directory on your device. The editor will then download and save all template and model files into that folder, setting up your offline workspace.
            </p>
          </div>
        </div>

        <!-- Embedded Workspace Filesystem Explorer -->
        <div class="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
          <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block px-1">
            Filesystem Explorer
          </label>
          <div class="bg-slate-50/50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700 p-3 max-h-96 overflow-y-auto" data-testid="embedded-workspace-explorer">
            <WorkspaceExplorer />
          </div>
        </div>
      </div>

      <!-- Right Column: File & Metamodel Details (replacing iNNfo Metadata) -->
      <div
        class="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs space-y-4"
      >
        <div class="border-b border-slate-200 dark:border-slate-700 pb-3">
          <h3
            class="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
          >
            <Settings class="w-4 h-4 text-primary" />
            File & Metamodel Details
          </h3>
        </div>

        <div class="flex flex-col gap-3.5 text-xs">
          <!-- 1. Spec Info -->
          <div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/30">
            <span class="font-bold text-slate-800 dark:text-slate-200 block mb-1">1. Spec</span>
            <div class="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 mt-1.5 font-mono text-3xs text-slate-500">
              <span class="font-sans font-medium text-slate-400">Filename:</span>
              <span class="text-slate-750 dark:text-slate-300 break-all select-all font-semibold">{{ specFileName }}</span>
              
              <span class="font-sans font-medium text-slate-400">Version:</span>
              <span class="text-slate-750 dark:text-slate-300 font-semibold">{{ formatVersion }}</span>

              <span class="font-sans font-medium text-slate-400">Remote URL:</span>
              <a
                :href="`${REMOTE_SPEC_BASE}/iNNfo_${formatVersion}_NN.md`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline break-all select-all font-semibold"
              >
                {{ REMOTE_SPEC_BASE }}/iNNfo_{{ formatVersion }}_NN.md
              </a>
              
              <span class="font-sans font-medium text-slate-400">Local Path:</span>
              <span v-if="workspaceStore.handle" class="text-slate-750 dark:text-slate-300 break-all select-all font-semibold">
                specs/{{ specFileName }}
              </span>
              <span v-else class="text-red-555 text-red-500 dark:text-red-400 font-bold">
                Pending Save / Download
              </span>
            </div>
          </div>

          <!-- 2. Template Info -->
          <div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/30">
            <span class="font-bold text-slate-800 dark:text-slate-200 block mb-1">2. Template</span>
            <p class="text-3xs text-slate-505 text-slate-500 dark:text-slate-400 leading-normal mb-2 mt-0.5 font-sans">
              <span v-if="templateRemoteUrl" class="text-slate-500 dark:text-slate-400">
                <span v-if="workspaceStore.handle">
                  You are using a local template, downloaded from a remote URL. The model references it in the same folder to guarantee your technological sovereignty—ensuring you always own it and can always use it.
                </span>
                <span v-else>
                  You are currently using a remote template. When you save this model locally, the template will be downloaded to the same folder to guarantee your technological sovereignty—ensuring you always own it and can always use it.
                </span>
              </span>
              <span v-else class="text-slate-500 dark:text-slate-400">
                This document does not use an external template. Instead, it incorporates both the model and the template within the same file, making it 100% self-contained.
              </span>
            </p>
            <div class="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 mt-1.5 font-mono text-3xs text-slate-500">
              <span class="font-sans font-medium text-slate-400">Name:</span>
              <span class="text-slate-750 dark:text-slate-300 break-all select-all font-semibold">{{ fullTemplateName || '—' }}</span>
              
              <span class="font-sans font-medium text-slate-400">Version:</span>
              <span class="text-slate-750 dark:text-slate-300 font-semibold">{{ templateVersion || '—' }}</span>

              <span class="font-sans font-medium text-slate-400">Remote URL:</span>
              <template v-if="templateRemoteUrl">
                <a
                  :href="templateRemoteUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline break-all select-all font-semibold"
                >
                  {{ templateRemoteUrl }}
                </a>
              </template>
              <span v-else class="text-slate-750 dark:text-slate-300 break-all select-all">—</span>
              
              <template v-if="templateRemoteUrl">
                <span class="font-sans font-medium text-slate-400">Local Path:</span>
                <span v-if="workspaceStore.handle" class="text-slate-750 dark:text-slate-300 break-all select-all font-semibold">
                  specs/{{ templateFileName }}
                </span>
                <span v-else class="text-red-555 text-red-500 dark:text-red-400 font-bold">
                  Pending Save / Download
                </span>
              </template>
            </div>

            <!-- Template Version Notice (D3) — passive, never blocks editing -->
            <div
              v-if="templateVersionNotice"
              data-testid="template-version-badge"
              class="mt-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3 space-y-2"
            >
              <p class="text-3xs font-semibold text-amber-700 dark:text-amber-300">
                A newer template version is available: {{ templateVersionNotice.latest }} (current: {{ templateVersionNotice.current }})
              </p>
              <p class="text-3xs text-amber-600 dark:text-amber-400 leading-relaxed">
                Copy the prompt below and paste it into OpenCode to migrate this model to a new file. The original is never edited or deleted.
              </p>
              <div class="flex items-center justify-end">
                <button
                  data-testid="template-version-copy-prompt"
                  @click="copyMigrationPrompt"
                  class="inline-flex items-center gap-1.5 text-2xs font-medium px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                >
                  <Check v-if="copiedMigrationPrompt" class="w-3 h-3" />
                  <Copy v-else class="w-3 h-3" />
                  {{ copiedMigrationPrompt ? 'Copied' : 'Copy migration prompt' }}
                </button>
              </div>
            </div>
          </div>

          <!-- 3. Model Info -->
          <div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/30">
            <span class="font-bold text-slate-800 dark:text-slate-200 block mb-1">3. Model</span>
            <div class="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 mt-1.5 font-mono text-3xs text-slate-500">
              <span class="font-sans font-medium text-slate-400">Filename:</span>
              <div class="flex items-center gap-1.5">
                <span class="text-slate-750 dark:text-slate-300 break-all select-all font-semibold">{{ modelFileName }}</span>
                <button
                  @click="renameModelFile"
                  class="p-0.5 rounded text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                  title="Rename model file"
                >
                  <Edit2 class="w-3 h-3" />
                </button>
              </div>

              <span class="font-sans font-medium text-slate-400">Version:</span>
              <span class="text-slate-750 dark:text-slate-300 font-semibold">{{ modelVersion }}</span>

              <span class="font-sans font-medium text-slate-400">Last Saved:</span>
              <span class="text-slate-750 dark:text-slate-300 font-sans font-semibold">{{ lastSaved }}</span>

              <span class="font-sans font-medium text-slate-400">{{ workspaceStore.handle ? 'Local Path:' : 'Source URL:' }}</span>
              <template v-if="workspaceStore.handle">
                <span class="text-slate-750 dark:text-slate-300 break-all select-all font-semibold text-3xs">{{ displayLocalPath }}</span>
              </template>
              <template v-else>
                <a
                  :href="filePath"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline break-all select-all font-semibold"
                >
                  {{ filePath }}
                </a>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Version Management Section -->
    <div
      class="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs space-y-4"
    >
      <div
        class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 cursor-pointer select-none"
        @click="showVersionPanel = !showVersionPanel"
      >
        <h3
          class="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
        >
          <Tag class="w-4 h-4 text-primary" />
          Version Management
        </h3>
        <div class="flex items-center gap-2">
          <span v-if="currentVersionStr" class="text-xs font-mono text-slate-400">{{
            currentVersionStr
          }}</span>
          <ChevronDown v-if="showVersionPanel" class="w-4 h-4 text-slate-400" />
          <ChevronRight v-else class="w-4 h-4 text-slate-400" />
        </div>
      </div>

      <div v-if="showVersionPanel" class="space-y-4">
        <!-- Current version display -->
        <div
          class="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-700"
        >
          <span class="text-xs text-slate-500 dark:text-slate-400">Current Version</span>
          <span
            data-testid="current-version-display"
            class="font-mono font-bold text-slate-900 dark:text-slate-100"
            >{{ currentVersionStr || '—' }}</span
          >
        </div>

        <!-- Bump buttons with hover preview -->
        <div class="space-y-2">
          <label
            class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block"
            >Bump Level</label
          >
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="level in bumpLevels"
              :key="level"
              :disabled="isVersionDisabled"
              :title="versionButtonTitle(level)"
              :class="[
                'relative px-3 py-2 rounded-md text-xs font-semibold border transition-all duration-150 flex flex-col items-center justify-between min-h-[64px]',
                isVersionDisabled
                  ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 hover:border-primary/50 hover:bg-primary/5 active:scale-95',
                selectedLevel === level ? 'ring-2 ring-primary border-primary' : '',
              ]"
              @click="selectedLevel = level"
            >
              <span class="font-bold">{{ level.charAt(0).toUpperCase() + level.slice(1) }}</span>
              <span
                class="block text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5 font-mono"
                >{{ versionPreview(level) }}</span
              >
              <span
                class="block text-[9px] text-slate-400 dark:text-slate-500/70 truncate mt-1 font-mono max-w-full"
                >{{ filenamePreview(level) }}</span
              >
            </button>
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            <strong>Major</strong>: breaking changes &middot; <strong>Minor</strong>: additive
            changes &middot; <strong>Patch</strong>: fixes and refinements
          </p>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center justify-between pt-1">
          <p v-if="versionDisabledReason" class="text-xs text-amber-500 italic">
            {{ versionDisabledReason }}
          </p>
          <div v-else></div>
          <button
            :disabled="isVersionDisabled || !selectedLevel"
            :title="!selectedLevel ? 'Select a bump level first' : ''"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all duration-150 shadow-xs"
            :class="
              isVersionDisabled || !selectedLevel
                ? 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-700 text-slate-400'
                : 'bg-primary text-white hover:brightness-110 active:scale-95'
            "
            @click="saveVersion"
          >
            <Save class="w-3.5 h-3.5" />
            Save New Version
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Section: Plain Text View -->
    <div
      class="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs space-y-4"
    >
      <div
        class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3"
      >
        <h3
          class="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
        >
          <FileText class="w-4 h-4 text-primary" />
          Plain Text Model View
        </h3>

        <div class="flex items-center gap-2">
          <label class="relative inline-flex items-center cursor-pointer select-none">
            <input type="checkbox" v-model="showPlainTextView" class="sr-only peer" />
            <div
              class="w-9 h-5 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"
            ></div>
            <span class="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400"
              >Show Source Code</span
            >
          </label>
        </div>
      </div>

      <!-- Plain Text Content Display -->
      <div v-if="showPlainTextView" class="space-y-3">
        <div
          class="relative rounded-md border border-slate-200 dark:border-slate-700 bg-slate-900 overflow-hidden shadow-inner"
        >
          <textarea
            readonly
            :value="rawContent"
            rows="16"
            class="w-full bg-slate-950 text-slate-200 font-mono text-xs p-4 focus:outline-none resize-none border-none outline-none leading-relaxed select-all selection:bg-primary selection:text-white"
          ></textarea>
        </div>
      </div>

      <div v-else class="py-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">
        Toggle "Show Source Code" to display the raw Markdown model representation.
      </div>
    </div>

    <!-- OpenCode / Agent Prompt Modal -->
    <OpenCodePromptModal
      :is-open="isPromptModalOpen"
      :context="promptContext"
      @close="isPromptModalOpen = false"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useUiStore } from '../../stores/uiStore'
import {
  FolderOpen,
  FileText,
  Settings,
  Tag,
  Save,
  ChevronDown,
  ChevronRight,
  Edit2,
  Info,
  Database,
  Copy,
  Check,
  Terminal,
} from 'lucide-vue-next'
import OpenCodePromptModal from './OpenCodePromptModal.vue'
import WorkspaceExplorer from '../layout/WorkspaceExplorer.vue'
import type { PromptContext } from '../../utils/promptGenerator'
import { buildSpecificationUrl } from '../../utils/constants'
import type { BumpLevel } from '../../utils/version'
import { useToast } from '../../shared/useToast'
import { useModelFrontmatter } from './composables/useModelFrontmatter'
import { useVersionBump } from './composables/useVersionBump'
import { useBlueprintVersionNotice } from '../../composables/useBlueprintVersionNotice'
import { REMOTE_SPEC_BASE } from '../../config/samples'

const props = defineProps<{
  rootNodeId: string
}>()

const router = useRouter()
const workspaceStore = useWorkspaceStore()
const knowledgeStore = useKnowledgeStore()
const uiStore = useUiStore()
const { show } = useToast()
const isPromptModalOpen = ref(false)

const showPlainTextView = ref(false)
const selectedModelId = ref<string>('')

const availableModels = computed(() => {
  return knowledgeStore.rootIds
    .filter((id) => !id.startsWith('spec:'))
    .map((id) => {
      const node = knowledgeStore.getNode(id)
      const path = node?.source?.path || ''
      const name = path.split('/').pop()?.split('\\').pop() || node?.name || id
      return { id, name }
    })
})

const activeModelId = computed({
  get(): string {
    if (selectedModelId.value && availableModels.value.some((m) => m.id === selectedModelId.value)) {
      return selectedModelId.value
    }
    return uiStore.activeModelId || props.rootNodeId || availableModels.value[0]?.id || ''
  },
  set(newId: string): void {
    selectedModelId.value = newId
    uiStore.setActiveModel(newId)
  },
})

// ── Frontmatter resolution from root node rawContent ──
const rootNode = computed(() => knowledgeStore.getNode(activeModelId.value))

const rawContent = computed(() => rootNode.value?.rawContent ?? '')

const filePath = computed(() => {
  return rootNode.value?.source?.path || ''
})

const nodeCount = computed(() => Object.keys(knowledgeStore.nodes).length)

const { formatVersion, templateName, templateVersion, modelVersion, rawModelVersion, lastSaved } =
  useModelFrontmatter(rawContent)

const promptContext = computed<PromptContext>(() => ({
  modelName: activeModelId.value || 'Active Model',
  conceptName: templateName.value || 'Model',
  relativePath: filePath.value,
  rawContent: rawContent.value,
}))

const specUrl = computed(() => buildSpecificationUrl(formatVersion.value))

// ── Version Management ─────────────────────────────────────────────────

const showVersionPanel = ref(false)
const selectedLevel = ref<BumpLevel | null>(null)

const bumpLevels: BumpLevel[] = ['major', 'minor', 'patch']

const { currentModelSemVer, currentVersionStr, versionPreview, filenamePreview, currentFilename } =
  useVersionBump({ rawModelVersion, templateName, sourcePath: filePath })

/**
 * Computes the tooltip text for a bump button (R-VM-04 filename preview)
 */
function versionButtonTitle(level: BumpLevel): string {
  if (isVersionDisabled.value)
    return versionDisabledReason.value || 'Version management is unavailable'
  return `${currentFilename()} → ${filenamePreview(level)}`
}

// ── Disabled states ─────────────────────────────────────────────────────

const isVersionDisabled = computed(() => {
  return !workspaceStore.handle || workspaceStore.saving || knowledgeStore.rootIds.length === 0
})

const versionDisabledReason = computed(() => {
  if (!workspaceStore.handle) return 'Connect a workspace to save versions'
  if (workspaceStore.saving) return 'Workspace is currently saving'
  if (knowledgeStore.rootIds.length === 0) return 'No root node available'
  return null
})

// ── Save action ─────────────────────────────────────────────────────────

async function saveVersion(): Promise<void> {
  if (!selectedLevel.value || isVersionDisabled.value) return
  const level = selectedLevel.value

  try {
    await workspaceStore.saveActiveFileWithVersionBump(level, activeModelId.value)
    selectedLevel.value = null
  } catch (err) {
    console.error('Version save failed:', err)
  }
}

// ── Spec, Template, and Model details computed properties ──

const modelFileName = computed(() => {
  const path = filePath.value || ''
  if (!path) return 'model.md'
  return path.split('/').pop()?.split('\\').pop() || path
})

// ── Template Version Notice (D3) ────────────────────────────────────────
// Passive badge + copyable migration prompt when the model's parent_spec
// pins an older blueprint_version than the newest one discoverable locally
// or in the bundled SHIPPED_BLUEPRINT_VERSIONS map. Never blocks editing.

const workspaceHandle = computed(() => workspaceStore.handle ?? undefined)

const { notice: templateVersionNotice, refresh: refreshBlueprintVersionNotice } =
  useBlueprintVersionNotice({
    templateName,
    modelFileName,
    handle: workspaceHandle,
  })

watch(
  [templateName, workspaceHandle],
  () => {
    void refreshBlueprintVersionNotice()
  },
  { immediate: true },
)

const copiedMigrationPrompt = ref(false)

function copyMigrationPrompt(): void {
  const prompt = templateVersionNotice.value?.prompt
  if (!prompt) return
  navigator.clipboard.writeText(prompt).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = prompt
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  })
  copiedMigrationPrompt.value = true
  setTimeout(() => {
    copiedMigrationPrompt.value = false
  }, 2000)
}

const specFileName = computed(() => {
  return `iNNfo_${formatVersion.value}_NN.md`
})

const templateFileName = computed(() => {
  const name = fullTemplateName.value
  if (!name) return ''
  return name.endsWith('_NN') ? `${name}.md` : `${name}_NN.md`
})

const templateRemoteUrl = computed(() => {
  const node = rootNode.value
  return ((node?.fields?.parent_spec?.value as any)?.url ??
    (node?.fields?.parent?.value as any)?.url ??
    '') as string
})

const fullTemplateName = computed(() => {
  const name = templateName.value || ''
  if (!name || name.toLowerCase() === 'template') {
    return '—'
  }
  const hasVersion = /_V_?\d+/i.test(name)
  if (hasVersion || !templateVersion.value) {
    return name
  }
  return `${name}_${templateVersion.value}`
})

const displayLocalPath = computed(() => {
  if (!workspaceStore.handle) return ''
  const wsName = workspaceStore.handle?.name || ''
  const fullPath = filePath.value || ''
  
  if (!wsName) return fullPath
  
  const wsIndex = fullPath.indexOf('/' + wsName + '/')
  const wsBackslashIndex = fullPath.indexOf('\\' + wsName + '\\')
  
  if (wsIndex !== -1) {
    return '... / ' + wsName + fullPath.slice(wsIndex + wsName.length + 1)
  } else if (wsBackslashIndex !== -1) {
    const rel = fullPath.slice(wsBackslashIndex + wsName.length + 1).replace(/\\/g, '/')
    return '... / ' + wsName + '/' + rel
  }
  
  const parts = fullPath.replace(/\\/g, '/').split('/')
  if (parts.length > 2) {
    return '... / ' + parts.slice(-2).join('/')
  }
  return '... / ' + fullPath
})

function renameModelFile(): void {
  const currentName = modelFileName.value
  const newName = window.prompt('Enter new filename (e.g. MyModel_NN.md):', currentName)
  if (newName && newName.trim() && newName !== currentName) {
    workspaceStore.renameActiveFile(newName.trim(), activeModelId.value)
      .then(() => {
        show('Filename updated successfully.', 'success')
      })
      .catch((err) => {
        show(err instanceof Error ? err.message : 'Rename failed', 'error')
      })
  }
}
</script>
