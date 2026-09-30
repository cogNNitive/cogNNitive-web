<script setup lang="ts">
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import IconRenderer from '../editor/IconRenderer.vue'

withDefaults(
  defineProps<{
    tags: string[]
    label: string
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const knowledgeStore = useKnowledgeStore()
</script>

<template>
  <div
    v-if="tags && tags.length > 0"
    class="flex flex-col gap-1.5"
    :class="compact ? '' : 'border-t border-slate-200 dark:border-slate-700 pt-5'"
  >
    <div
      v-if="!compact"
      class="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2"
    >
      <span class="w-1.5 h-4 rounded-full bg-slate-400 shrink-0"></span>
      {{ label }}
    </div>
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in tags"
        :key="tag"
        class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors shadow-xs"
        :style="
          knowledgeStore.workspaceTagsMap[tag.toLowerCase().trim()]?.color
            ? {
                borderColor: knowledgeStore.workspaceTagsMap[tag.toLowerCase().trim()]?.color + '55',
                backgroundColor:
                  knowledgeStore.workspaceTagsMap[tag.toLowerCase().trim()]?.color + '15',
                color: knowledgeStore.workspaceTagsMap[tag.toLowerCase().trim()]?.color,
              }
            : {}
        "
        :class="
          !knowledgeStore.workspaceTagsMap[tag.toLowerCase().trim()]?.color
            ? 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
            : ''
        "
        :title="knowledgeStore.workspaceTagsMap[tag.toLowerCase().trim()]?.description"
      >
        <IconRenderer
          v-if="knowledgeStore.workspaceTagsMap[tag.toLowerCase().trim()]?.icon"
          :icon="knowledgeStore.workspaceTagsMap[tag.toLowerCase().trim()]?.icon!"
          custom-class="w-3 h-3"
        />
        <span>#{{ tag }}</span>
      </span>
    </div>
  </div>
</template>
