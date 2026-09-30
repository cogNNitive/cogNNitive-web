<template>
  <div class="flex flex-1 min-h-[400px] overflow-hidden w-full">
    <!-- Detail Editor Column -->
    <div class="flex-1 flex flex-col overflow-y-auto">
      <!-- Single node selected: show detail -->
      <template v-if="selectedNode">
        <div class="flex-1 flex flex-col justify-between">
          <BlockSheet
            :block="blockFromNode(selectedNode)"
            :kind="'instance'"
            :concept-name="conceptName"
            :concept-type="selectedNodeConceptType || 'text'"
            :concept-color="selectedNodeColor"
            :concept-icon="selectedNodeIcon"
            :concept-fields="activeConceptFields"
            :has-markers="selectedNodeConceptType === 'weight'"
            :show-delete="true"
            :collapsed="isCollapsed"
            :is-editing="isEditing"
            @update:collapsed="isCollapsed = $event"
            @edit-toggle="isEditing = !isEditing"
            @delete="handleDelete"
            @change="handleChange"
            @navigate-to-node="(nodeId) => $emit('navigate-to-node', nodeId)"
          />
        </div>
      </template>

      <!-- No node selected: show all child nodes as collapsed BlockSheets -->
      <template v-else-if="childNodes.length > 0">
        <div
          class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700 shrink-0 mb-3"
        >
          <h4 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {{ conceptName }} ({{ childNodes.length }})
          </h4>
        </div>
        <div class="space-y-2">
          <BlockSheet
            v-for="child in childNodes"
            :key="child.id"
            :block="blockFromNode(child)"
            :kind="'instance'"
            :concept-name="conceptName"
            :concept-type="child.type || activeConceptType || 'text'"
            :concept-icon="childIcon(child)"
            :concept-color="childColor(child)"
            :concept-fields="getConceptFieldsForNode(child)"
            :has-markers="activeConceptType === 'weight'"
            :show-delete="true"
            :collapsed="true"
            :disable-expand="true"
            :is-editing="editingInstanceId === child.id"
            @edit-toggle="toggleEditInstance(child.id)"
            @delete="handleChildDelete(child.id)"
            @change="handleChange"
          />
        </div>
      </template>

      <!-- Fallback when no node is selected and no children -->
      <div
        v-else
        class="text-slate-400 dark:text-slate-500 text-xs italic text-center my-auto flex flex-col items-center justify-center gap-2.5"
      >
        <FolderOpen class="w-8 h-8 text-slate-300 dark:text-slate-600" />
        <span>No elements yet. Select a node from the left panel to edit.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FolderOpen } from 'lucide-vue-next'
import { useModelStore } from '../../stores/modelStore'
import { useConfirmStore } from '../../stores/confirmStore'
import { useMetamodelStore } from '../../stores/metamodelStore'
import {
  getConceptFieldsForNode as getConceptFieldsForNodeHelper,
  getMergedBlockFields,
} from '../../utils/metamodelHelper'
import BlockSheet from './BlockSheet.vue'
import type { KnowledgeNode } from '../../model/types'

const props = defineProps<{
  nodeId: string | null
  conceptName: string
}>()

const _emit = defineEmits<{
  'navigate-to-node': [nodeId: string]
}>()

const modelStore = useModelStore()
const confirmStore = useConfirmStore()
const metamodelStore = useMetamodelStore()

const isCollapsed = ref(false)
const isEditing = ref(false)
const editingInstanceId = ref<string | null>(null)

// Reset edit state when selected node changes
watch(
  () => props.nodeId,
  () => {
    isEditing.value = false
    isCollapsed.value = false
    editingInstanceId.value = null
  },
  { immediate: true },
)

const selectedNode = computed(() => {
  if (!props.nodeId) return null
  return modelStore.getNode(props.nodeId) ?? null
})

const selectedNodeConceptType = computed(() => {
  return selectedNode.value?.type ?? null
})

const selectedNodeColor = computed(() => '')
const selectedNodeIcon = computed(() => '')

// Children of the current node (or roots if no node selected)
const childNodes = computed(() => {
  if (props.nodeId) {
    return modelStore.getChildren(props.nodeId)
  }
  return modelStore.getRoots()
})

// Active concept type for metadata
const activeConceptType = computed(() => {
  if (childNodes.value.length > 0) {
    return childNodes.value[0].type || 'text'
  }
  return 'text'
})

const getConceptFieldsForNode = (node: KnowledgeNode) => {
  return getConceptFieldsForNodeHelper(node, metamodelStore.getConceptFields)
}

const activeConceptFields = computed(() => {
  const node = selectedNode.value
  if (!node) return []
  return getConceptFieldsForNode(node)
})

// Build a BlockData-compatible object from a KnowledgeNode
const blockFromNode = (node: KnowledgeNode) => {
  return {
    id: node.id,
    name: node.name,
    description: node.rawSections?.description || '',
    fields: getMergedBlockFields(node, metamodelStore.getConceptFields),
  }
}

const childIcon = (_child: KnowledgeNode) => ''
const childColor = (_child: KnowledgeNode) => ''

const handleDelete = async (): Promise<void> => {
  if (!props.nodeId) return
  const isElement = selectedNode.value?.kind === 'element'
  const ok = await confirmStore.confirm({
    title: isElement ? 'Delete element?' : 'Delete concept?',
    message: isElement
      ? 'This will permanently remove the element and all its content.'
      : 'This will permanently remove the concept and all its content.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  modelStore.removeNodeTree(props.nodeId)
}

const handleChildDelete = async (childId: string): Promise<void> => {
  const ok = await confirmStore.confirm({
    title: 'Delete element?',
    message: 'This will permanently remove the element and all its content.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  modelStore.removeNodeTree(childId)
}

const handleChange = () => {
  // Changes are already tracked via provenance — nothing extra needed
}

const toggleEditInstance = (id: string) => {
  editingInstanceId.value = editingInstanceId.value === id ? null : id
}
</script>
