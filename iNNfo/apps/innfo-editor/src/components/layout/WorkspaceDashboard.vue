<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useUiStore } from '../../stores/uiStore'
import { Sparkles, Layout, Database, FileText, ArrowRight } from 'lucide-vue-next'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import WorkspaceIntegrityNotice from './WorkspaceIntegrityNotice.vue'

const workspaceStore = useWorkspaceStore()
const knowledgeStore = useKnowledgeStore()
const uiStore = useUiStore()

const availableModels = computed(() => {
  return knowledgeStore.rootIds
    .filter((id) => !id.startsWith('spec:'))
    .map((id) => {
      const node = knowledgeStore.getNode(id)
      const path = node?.source?.path || ''
      const filename = path.split('/').pop()?.split('\\').pop() || node?.name || id
      let title = filename
      let version = '0.1.0'
      let templateName = ''
      
      if (node?.rawContent) {
        try {
          const fm = parseFrontmatter(node.rawContent) as any
          if (fm?.title) title = fm.title
          if (fm?.knowledge_version) version = fm.knowledge_version
          if (fm?.parent_spec?.name) templateName = fm.parent_spec.name
        } catch {
          /* unparseable frontmatter — fall back to defaults */
        }
      }
      return { id, filename, title, version, templateName }
    })
})

function selectModel(modelId: string): void {
  uiStore.setActiveModel(modelId)
  uiStore.selectNode(modelId)
}

function selectAIGuide(): void {
  uiStore.setActiveView('ai-guide')
}
</script>

<template>
  <div class="flex-1 p-6 md:p-10 max-w-5xl mx-auto space-y-10">
    <!-- Workspace integrity report (AD-6): passive, dismissible, three bands -->
    <WorkspaceIntegrityNotice :report="workspaceStore.integrityReport" />

    <!-- Header -->
    <div class="text-center space-y-3">
      <div class="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/30">
        📂 Workspace Directory Connected
      </div>
      <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 font-sans tracking-tight">
        iNNfo Workspace Dashboard
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
        Welcome to your dynamic model editor. Select a model below to explore its data schema, or use our interactive paths to edit content.
      </p>
    </div>

    <!-- Onboarding choices -->
    <div class="grid md:grid-cols-2 gap-6">
      <!-- Option A: AI Agent -->
      <div class="group bg-gradient-to-br from-purple-500/5 to-violet-500/5 hover:from-purple-500/10 hover:to-violet-500/10 dark:from-purple-950/15 dark:to-violet-950/15 border border-purple-200/60 dark:border-purple-800/30 rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between space-y-6">
        <div class="space-y-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform duration-300">
            <Sparkles class="w-6 h-6 text-white" />
          </div>
          <div class="space-y-2">
            <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Option A: Edit using an AI Agent
            </h2>
            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Your models are stored as plain Markdown text files. You can use agentic AI tools like <span class="font-mono text-purple-600 dark:text-purple-400 font-bold">anti-gravity</span> or <span class="font-mono text-purple-600 dark:text-purple-400 font-bold">Claude Code</span> to edit files directly using natural language.
            </p>
          </div>
        </div>
        <div>
          <button
            @click="selectAIGuide"
            class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md shadow-purple-600/10 hover:shadow-lg transition-all cursor-pointer"
          >
            View AI guide
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Option B: Visual UI -->
      <div class="group bg-gradient-to-br from-blue-500/5 to-cyan-500/5 hover:from-blue-500/10 hover:to-cyan-500/10 dark:from-blue-950/15 dark:to-cyan-950/15 border border-blue-200/60 dark:border-blue-800/30 rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between space-y-6">
        <div class="space-y-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
            <Layout class="w-6 h-6 text-white" />
          </div>
          <div class="space-y-2">
            <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 font-sans">
              Option B: iNNfo Visual Editor
            </h2>
            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              Explore and visually edit concepts, matrices, and relationships. Click any model below or in the left sidebar to open its structured dashboard and visual schemas.
            </p>
          </div>
        </div>
        <div class="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-3 flex gap-2.5 items-start">
          <Database class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p class="text-2xs text-blue-800 dark:text-blue-300 leading-relaxed font-sans">
            <strong>Active Directory:</strong> {{ workspaceStore.handle?.name || 'In-Memory / Sandbox' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Models List -->
    <div class="space-y-4 pt-4 border-t border-slate-150 dark:border-slate-800">
      <div>
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-sans">
          Active Models in Workspace
        </h3>
        <p class="text-2xs text-slate-500 dark:text-slate-400">
          Select a model to view its metadata, structure, and graphic metamodel schemas.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="model in availableModels"
          :key="model.id"
          @click="selectModel(model.id)"
          class="group/card flex items-start justify-between p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <div class="flex gap-4 min-w-0">
            <div class="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover/card:scale-105 transition-transform">
              <FileText class="w-5 h-5" />
            </div>
            <div class="min-w-0 space-y-1">
              <h4 class="text-sm font-bold text-slate-800 dark:text-slate-200 truncate group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors">
                {{ model.title }}
              </h4>
              <p class="text-3xs text-slate-400 font-mono truncate">
                {{ model.filename }}
              </p>
              <span v-if="model.templateName" class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium font-sans">
                Template: {{ model.templateName }}
              </span>
            </div>
          </div>
          <div class="shrink-0 font-mono text-3xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
            v{{ model.version }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
