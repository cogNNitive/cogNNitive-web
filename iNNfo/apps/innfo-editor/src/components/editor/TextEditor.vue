<template>
  <div class="flex flex-col flex-1 gap-4 overflow-y-auto p-1">
    <!-- Toolbar: Save button -->
    <div
      class="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700 shrink-0"
    >
      <h4 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        Raw Content
        <span v-if="nodeId" class="font-normal normal-case ml-1 text-slate-400"
          >— {{ nodeId }}</span
        >
      </h4>
      <div class="flex items-center gap-2">
        <span v-if="saved" class="text-xs text-emerald-600 font-semibold">Saved</span>
        <button
          @click="saveContent"
          class="text-xs bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
        >
          <Save class="w-3.5 h-3.5" />
          Save
        </button>
      </div>
    </div>

    <!-- Raw markdown textarea -->
    <div class="flex-1 flex flex-col min-h-0">
      <textarea
        ref="textareaRef"
        :value="rawContent"
        @input="onInput"
        class="w-full flex-1 border border-slate-200 dark:border-slate-600 rounded-md p-3 text-sm font-mono leading-relaxed focus:ring-1 focus:ring-indigo-500 outline-none resize-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 min-h-[300px]"
        placeholder="Raw markdown content..."
      ></textarea>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Save } from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { commitFieldValue } from '../../shared/editAttribution'

const props = defineProps<{
  nodeId: string
  conceptName: string
  conceptType: string
  rootNodeId?: string
}>()

const emit = defineEmits<{
  change: []
}>()

const knowledgeStore = useKnowledgeStore()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const saved = ref(false)

const rawContent = computed(() => {
  // `text` concepts store their content in the root node's rawSections
  // keyed by concept name. The selected node may be a virtual concept node
  // (not present in the store), so resolve content via the root node.
  if (props.conceptType === 'text') {
    const root = props.rootNodeId ? knowledgeStore.getNode(props.rootNodeId) : undefined
    return root?.rawSections?.[props.conceptName] ?? ''
  }
  const node = knowledgeStore.getNode(props.nodeId)
  return node?.rawContent ?? ''
})

const localContent = ref<string | null>(null)

// Initialize local content when nodeId changes
watch(
  () => props.nodeId,
  () => {
    localContent.value = null
    saved.value = false
  },
  { immediate: true },
)

const onInput = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  localContent.value = textarea.value
  saved.value = false
}

const saveContent = () => {
  const content = localContent.value
  if (content === null) return

  const node = knowledgeStore.getNode(props.nodeId)
  if (!node) return

  if (props.conceptType === 'text') {
    // Write back into the root node's rawSections keyed by concept name.
    const rootId = props.rootNodeId || props.nodeId
    const root = knowledgeStore.getNode(rootId)
    if (root) {
      const rawSections = { ...(root.rawSections ?? {}) }
      rawSections[props.conceptName] = content
      knowledgeStore.upsertNode({ ...root, rawSections })
      knowledgeStore.markDirty(rootId)
      commitFieldValue(knowledgeStore, rootId, `_rawSection:${props.conceptName}`, content, {
        kind: 'user',
        id: 'anonymous',
      })
    }
  } else {
    // Update the node's rawContent and stamp editAttribution
    knowledgeStore.upsertNode({ ...node, rawContent: content })
    commitFieldValue(knowledgeStore, props.nodeId, '_rawContent', content, {
      kind: 'user',
      id: 'anonymous',
    })
  }
  localContent.value = null
  saved.value = true
  emit('change')

  // Reset saved indicator after 2s
  setTimeout(() => {
    saved.value = false
  }, 2000)
}
</script>
