<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      @click.self="close"
    >
      <div
        class="relative flex flex-col w-[92vw] max-w-2xl max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        @keydown.escape="close"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div>
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span class="text-indigo-600 dark:text-indigo-400 font-semibold">{{ fieldLabel }}</span>
              <span class="text-slate-400 dark:text-slate-500 font-normal">in</span>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-xs truncate" :title="elementName">
                {{ elementName }}
              </span>
            </h2>
          </div>
          <button
            @click="close"
            class="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/20 select-text">
          <WidgetField
            :node-id="nodeId"
            :field-key="fieldKey"
            :widget-type="fieldType"
            :field-definition="fieldDefinition"
            :readonly="true"
          />
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-end shrink-0">
          <button
            @click="close"
            class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import WidgetField from '../../shared/widgets/WidgetField.vue'

const props = defineProps<{
  isOpen: boolean
  nodeId: string
  fieldKey: string
  fieldType: string
  fieldDefinition?: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const knowledgeStore = useKnowledgeStore()

const node = computed(() => knowledgeStore.getNode(props.nodeId))
const elementName = computed(() => node.value?.name ?? '')

const fieldLabel = computed(() => {
  const rawName = props.fieldDefinition?.name || props.fieldKey || ''
  return rawName.replace(/_/g, ' ')
})

function close(): void {
  emit('close')
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.isOpen) {
    close()
  }
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      document.addEventListener('keydown', handleKeyDown)
    } else {
      document.removeEventListener('keydown', handleKeyDown)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scale-in {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.animate-fade-in { animation: fade-in 0.15s ease-out forwards; }
.animate-scale-in { animation: scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
</style>
