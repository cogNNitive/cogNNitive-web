<template>
  <div
    data-testid="connection-pill"
    class="connection-pill inline-flex items-center gap-1.5 max-w-full select-none"
  >
    <!-- MODE FULL: [Source] — ( [Icon] Rol ) → [Target] -->
    <template v-if="mode === 'full'">
      <Pill
        v-if="sourceId || sourceName"
        :block-id="resolvedSourceId"
        :node-id="resolvedSourceId"
        :name="cleanName(sourceName || sourceId)"
        :interactive="interactive"
        @click="$emit('navigate', resolvedSourceId || sourceName || '')"
      />
      <span v-if="effectiveRole" class="text-xs text-slate-400 dark:text-slate-500 font-bold shrink-0">&mdash;</span>
      <span
        v-if="effectiveRole"
        class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 shrink-0 shadow-2xs"
      >
        <LayoutGrid v-if="origin === 'matrix'" class="w-3 h-3 text-indigo-500 shrink-0" />
        <Tag v-else-if="origin === 'field'" class="w-3 h-3 text-indigo-500 shrink-0" />
        <FileText v-else-if="origin === 'mention'" class="w-3 h-3 text-indigo-500 shrink-0" />
        {{ effectiveRole }}
      </span>
      <span v-if="effectiveRole" class="text-xs text-slate-400 dark:text-slate-500 font-bold shrink-0">&rarr;</span>
      <Pill
        v-if="targetId || targetName"
        :block-id="resolvedTargetId"
        :node-id="resolvedTargetId"
        :name="cleanName(targetName || targetId)"
        :interactive="interactive"
        @click="$emit('navigate', resolvedTargetId || targetName || '')"
      />
    </template>

    <!-- MODE COMPACT: INCOMING ([Source] < ( [Icon] Rol ) <) vs OUTGOING (> ( [Icon] Rol ) > [Target]) -->
    <template v-else>
      <!-- Incoming direction: [Source Pill] < ( [Icon] Rol ) < -->
      <template v-if="direction === 'incoming'">
        <Pill
          v-if="sourceId || sourceName"
          :block-id="resolvedSourceId"
          :node-id="resolvedSourceId"
          :name="cleanName(sourceName || sourceId)"
          :interactive="interactive"
          @click="$emit('navigate', resolvedSourceId || sourceName || '')"
        />
        <span v-if="effectiveRole" class="text-xs text-slate-400 dark:text-slate-500 font-bold shrink-0">&lt;</span>
        <span
          v-if="effectiveRole"
          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 shrink-0 shadow-2xs"
        >
          <LayoutGrid v-if="origin === 'matrix'" class="w-3 h-3 text-indigo-500 shrink-0" />
          <Tag v-else-if="origin === 'field'" class="w-3 h-3 text-indigo-500 shrink-0" />
          <FileText v-else-if="origin === 'mention'" class="w-3 h-3 text-indigo-500 shrink-0" />
          {{ effectiveRole }}
        </span>
        <span v-if="effectiveRole" class="text-xs text-slate-400 dark:text-slate-500 font-bold shrink-0">&lt;</span>
      </template>

      <!-- Outgoing direction (default): > ( [Icon] Rol ) > [Target Pill] -->
      <template v-else>
        <span v-if="effectiveRole" class="text-xs text-slate-400 dark:text-slate-500 font-bold shrink-0">&gt;</span>
        <span
          v-if="effectiveRole"
          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 shrink-0 shadow-2xs"
        >
          <LayoutGrid v-if="origin === 'matrix'" class="w-3 h-3 text-indigo-500 shrink-0" />
          <Tag v-else-if="origin === 'field'" class="w-3 h-3 text-indigo-500 shrink-0" />
          <FileText v-else-if="origin === 'mention'" class="w-3 h-3 text-indigo-500 shrink-0" />
          {{ effectiveRole }}
        </span>
        <span v-if="effectiveRole" class="text-xs text-slate-400 dark:text-slate-500 font-bold shrink-0">&gt;</span>
        <Pill
          v-if="targetId || targetName"
          :block-id="resolvedTargetId"
          :node-id="resolvedTargetId"
          :name="cleanName(targetName || targetId)"
          :interactive="interactive"
          @click="$emit('navigate', resolvedTargetId || targetName || '')"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LayoutGrid, Tag, FileText } from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import Pill from './Pill.vue'

const props = withDefaults(
  defineProps<{
    sourceId?: string
    sourceName?: string
    targetId?: string
    targetName?: string
    label?: string
    value?: string | number
    mode?: 'full' | 'compact'
    direction?: 'outgoing' | 'incoming'
    origin?: 'matrix' | 'field' | 'mention'
    interactive?: boolean
  }>(),
  {
    mode: 'compact',
    direction: 'outgoing',
    interactive: true,
  },
)

defineEmits<{
  navigate: [nodeId: string]
}>()

const knowledgeStore = useKnowledgeStore()

function resolveNodeId(idOrName?: string): string {
  if (!idOrName) return ''
  const direct = knowledgeStore.getNode(idOrName)
  if (direct) return direct.id
  const clean = idOrName.split('/').pop() || idOrName
  const found = Object.values(knowledgeStore.nodes).find(
    (n) => n.id === idOrName || n.name === idOrName || n.id.endsWith('/' + clean) || n.name === clean,
  )
  return found ? found.id : idOrName
}

const resolvedSourceId = computed(() => resolveNodeId(props.sourceId))
const resolvedTargetId = computed(() => resolveNodeId(props.targetId))

function cleanName(idOrName?: string): string {
  if (!idOrName) return ''
  const parts = idOrName.split('/')
  return parts[parts.length - 1] || idOrName
}

const effectiveRole = computed(() => {
  if (props.value !== undefined && props.value !== null && String(props.value).trim().length > 0) {
    return String(props.value)
  }
  if (props.label && props.label.trim().length > 0) return props.label
  return ''
})
</script>

