<script setup lang="ts">
/**
 * Renders a `model`-type field as a sidebar-styled pillbadge (read mode) or
 * an autocomplete input listing the models available in the workspace
 * (edit mode). Part of the unified widget registry.
 * Uses v-model contract: modelValue / update:modelValue.
 *
 * Read mode reuses the same visual language as the active-model row in
 * LeftSidebar.vue (`bg-primary/10 text-primary`, FileText icon) and the
 * same node-matching logic as FieldViewer.vue's `handleModelPillClick` to
 * resolve the raw value to a `knowledgeStore.nodes` entry before calling
 * `uiStore.focusModel(...)`.
 */
import { ref, computed, watch } from 'vue'
import { FileText, Plus } from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useUiStore } from '../../stores/uiStore'
import { findMatchingKnowledgeNode } from '../../utils/knowledgeMatching'
import { deriveSuggestedSubmodelPath, slugify } from '../../utils/submodelPath'
import { buildSubmodelBlueprintUrl } from '../../utils/constants'

interface FieldDefinitionLike {
  name: string
  type: string
  options?: string[]
  target_concepts?: string[]
  target_blueprint?: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    readonly?: boolean
    nodeId?: string
    fieldKey?: string
    fieldDefinition?: FieldDefinitionLike
  }>(),
  { readonly: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const knowledgeStore = useKnowledgeStore()
const uiStore = useUiStore()
const showDropdown = ref(false)
const query = ref(props.modelValue || '')

watch(
  () => props.modelValue,
  (newVal) => {
    query.value = newVal || ''
  },
)

function basename(path: string): string {
  if (!path) return ''
  return path.split('/').pop()?.split('\\').pop() || path
}

function cleanValue(val: string): string {
  return val
    .replace(/^\[\[\s*/, '')
    .replace(/\s*\]\]$/, '')
    .trim()
}

const displayName = computed(() => basename(cleanValue(props.modelValue || '')))

/**
 * True when the field's raw value does not resolve to a model already
 * present in the workspace graph. In read mode a missing target hides the
 * dead pill and surfaces the create action instead.
 */
const modelMissing = computed(() => {
  const clean = cleanValue(props.modelValue || '')
  if (!clean) return true
  return !findMatchingKnowledgeNode(knowledgeStore.nodes, clean)
})

/**
 * The "Create & bind new model" action renders in edit mode and, in read
 * mode, whenever the bound model does not exist yet and the field declares
 * a target template to scaffold against.
 */
const showCreateAction = computed(
  () =>
    !props.readonly ||
    (props.readonly &&
      modelMissing.value &&
      !!props.fieldDefinition?.target_blueprint),
)

interface ModelSuggestion {
  id: string
  name: string
  path: string
  basename: string
}

const availableModels = computed<ModelSuggestion[]>(() => {
  const suggestions: ModelSuggestion[] = []
  const allRoots = Object.values(knowledgeStore.nodes).filter(
    (n) => (n.kind === 'root' || n.parentId === null) && !n.id.startsWith('spec:'),
  )
  for (const node of allRoots) {
    const path = node.source?.path || ''
    suggestions.push({
      id: node.id,
      name: node.name,
      path,
      basename: basename(path),
    })
  }
  return suggestions
})

const filteredSuggestions = computed<ModelSuggestion[]>(() => {
  const lowerQuery = query.value.trim().toLowerCase()
  if (!lowerQuery) return availableModels.value
  return availableModels.value.filter(
    (m) =>
      m.basename.toLowerCase().includes(lowerQuery) ||
      m.path.toLowerCase().includes(lowerQuery) ||
      m.name.toLowerCase().includes(lowerQuery),
  )
})

/** Mirrors FieldViewer.vue's handleModelPillClick node-matching logic. */
function handlePillClick(): void {
  const clean = cleanValue(props.modelValue || '')
  if (!clean) return

  const matchingNode = findMatchingKnowledgeNode(knowledgeStore.nodes, clean)
  const resolvedId = matchingNode ? matchingNode.id : clean
  uiStore.focusModel(resolvedId)
  uiStore.selectNode(resolvedId)
  uiStore.setActiveView('editor')
}

function onInput(event: Event): void {
  query.value = (event.target as HTMLInputElement).value
  showDropdown.value = true
  if (!query.value) {
    emit('update:modelValue', '')
  }
}

function selectSuggestion(suggestion: ModelSuggestion): void {
  const value = suggestion.path || suggestion.name
  query.value = value
  showDropdown.value = false
  emit('update:modelValue', value)
}

function onBlur(): void {
  setTimeout(() => {
    showDropdown.value = false
    emit('update:modelValue', query.value.trim())
  }, 150)
}

async function handleCreateSubmodel(): Promise<void> {
  const targetBlueprint =
    props.fieldDefinition?.target_blueprint || 'base'
  const targetNode = props.nodeId ? knowledgeStore.getNode(props.nodeId) : undefined
  const isElement = targetNode?.kind === 'element'
  const elementSlug = isElement
    ? targetNode?.slug || (targetNode?.name ? slugify(targetNode.name) : undefined)
    : undefined

  let conceptName = targetNode?.conceptBinding?.name
  if (!conceptName && targetNode?.parentId) {
    const parentNode = knowledgeStore.getNode(targetNode.parentId)
    if (parentNode?.kind === 'concept') {
      conceptName = parentNode.conceptBinding?.name || parentNode.name
    }
  }
  if (
    !conceptName &&
    isElement &&
    targetNode?.type &&
    targetNode.type !== 'text'
  ) {
    conceptName = targetNode.type
  }
  const conceptSlug = conceptName ? slugify(conceptName) : undefined

  const parentRootId = props.nodeId ? knowledgeStore.getKnowledgeRootForNode(props.nodeId) : undefined
  const parentRootNode = parentRootId ? knowledgeStore.getNode(parentRootId) : undefined
  const parentPath = parentRootNode?.source?.path || 'kNNowledge/knowledge_NN.md'

  const suggestedPath = deriveSuggestedSubmodelPath({
    parentPath,
    conceptSlug,
    elementSlug,
    fieldName: props.fieldKey,
    targetBlueprint,
  })

  const userPath = window.prompt(`Enter path for new submodel (${targetBlueprint}):`, suggestedPath)
  if (!userPath || !userPath.trim()) return

  const cleanPath = userPath.trim().replace(/\\/g, '/')
  const title = `${targetNode?.name || 'Submodel'} - ${targetBlueprint}`

  const newModelId = knowledgeStore.scaffoldSubmodel({
    path: cleanPath,
    template: targetBlueprint,
    templateUrl: buildSubmodelBlueprintUrl(targetBlueprint),
    title,
  })

  // Bind path to field
  emit('update:modelValue', cleanPath)
  query.value = cleanPath

  // Navigate to newly created submodel
  uiStore.focusModel(newModelId)
}
</script>

<template>
  <div class="field-model-container">
    <template v-if="readonly">
      <button
        v-if="modelValue"
        type="button"
        data-testid="model-field-pill"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-100 border border-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 cursor-pointer transition-colors"
        :title="modelValue"
        @click="handlePillClick"
      >
        <FileText class="w-3.5 h-3.5 shrink-0" />
        <span>{{ displayName }}</span>
      </button>
      <span
        v-if="!modelValue && !showCreateAction"
        class="text-slate-300 dark:text-slate-600 italic"
      >
        —
      </span>
    </template>
    <input
      v-else
      type="text"
      class="field-model-input"
      :value="query"
      placeholder="Search models..."
      @input="onInput"
      @focus="showDropdown = true"
      @blur="onBlur"
    />
    <ul
      v-if="!readonly && showDropdown && filteredSuggestions.length > 0"
      class="field-model-dropdown"
    >
      <li
        v-for="suggestion in filteredSuggestions"
        :key="suggestion.id"
        class="field-model-option flex items-center justify-between"
        @mousedown.prevent="selectSuggestion(suggestion)"
      >
        <span>{{ suggestion.basename }}</span>
        <span v-if="suggestion.path" class="text-3xs opacity-60 font-mono ml-2 shrink-0">
          {{ suggestion.path }}
        </span>
      </li>
    </ul>

    <div v-if="showCreateAction" class="flex items-center gap-2 mt-1">
      <button
        type="button"
        class="text-xs text-primary hover:text-primary-700 dark:text-primary-400 font-medium inline-flex items-center gap-1 hover:underline cursor-pointer"
        data-testid="create-submodel-button"
        @click="handleCreateSubmodel"
      >
        <Plus class="w-3.5 h-3.5 shrink-0" />
        <span>Create & bind new model</span>
        <span
          v-if="fieldDefinition?.target_blueprint"
          class="text-3xs px-1 py-0.2 rounded bg-primary/10 text-primary font-mono ml-0.5"
        >
          {{ fieldDefinition.target_blueprint }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.field-model-container {
  position: relative;
}
.field-model-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  font-size: 13px;
  border: 1px solid var(--border-soft, #ccc);
  border-radius: 6px;
  background: #fff;
  font-family: system-ui, sans-serif;
  box-sizing: border-box;
}
.field-model-input:focus {
  outline: none;
  border-color: #4d0e4e;
  box-shadow: 0 0 0 2px rgba(77, 14, 78, 0.1);
}
.field-model-dropdown {
  position: absolute;
  z-index: 50;
  margin-top: 0.25rem;
  width: 100%;
  max-height: 10rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  font-size: 0.75rem;
  list-style: none;
  padding: 0;
}
.field-model-option {
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  color: #334155;
}
.field-model-option:hover {
  background-color: rgba(77, 14, 78, 0.05);
}
</style>
