<script setup lang="ts">
/**
 * Renders a reference field as an autocomplete input that filters
 * suggestions from modelStore.nodes by target_concepts.
 * Part of the unified widget registry (rebuild-format-editor-ui Phase 4).
 * Uses v-model contract: modelValue / update:modelValue.
 * Supports Qualified Cross-Model References (Idea 1).
 */
import { ref, computed, watch } from 'vue'
import { useModelStore } from '../../stores/modelStore'
import { useUiStore } from '../../stores/uiStore'
import Pill from '../../components/editor/Pill.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    fieldDefinition?: { target_concepts?: string[] }
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const modelStore = useModelStore()
const uiStore = useUiStore()
const showDropdown = ref(false)
const query = ref(props.modelValue || '')

watch(() => props.modelValue, (newVal) => {
  query.value = newVal || ''
})

const cleanQuery = computed(() => {
  const val = props.modelValue || query.value || ''
  if (typeof val !== 'string') return ''
  let name = val.replace(/^\[\[\s*/, '').replace(/\s*\]\]$/, '').trim()
  if (name.startsWith('[[') && name.endsWith(']]')) {
    name = name.slice(2, -2).trim()
  }
  return name
})

const refNode = computed(() => {
  const val = props.modelValue || query.value || ''
  if (!val || typeof val !== 'string') return null

  let name = val.replace(/^\[\[\s*/, '').replace(/\s*\]\]$/, '').trim()
  if (name.startsWith('[[') && name.endsWith(']]')) {
    name = name.slice(2, -2).trim()
  }

  let modelPrefix = ''
  if (name.startsWith('[') && name.includes(']')) {
    const closingBracket = name.indexOf(']')
    modelPrefix = name.slice(1, closingBracket).trim().toLowerCase()
    name = name.slice(closingBracket + 1).trim()
  }

  const searchName = name.toLowerCase()
  const searchNorm = searchName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  return (
    Object.values(modelStore.nodes).find((n) => {
      if (!n) return false
      if (modelPrefix) {
        const path = n.source?.path || ''
        const modelFileName = path.split('/').pop()?.split('\\').pop() || ''
        const modelBaseName = modelFileName
          .replace(/\.md$/i, '')
          .replace(/_NN$/i, '')
          .toLowerCase()
        if (modelBaseName !== modelPrefix) return false
      }
      const nName = (n.name || '').toLowerCase()
      const nNorm = nName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (nName === searchName || nNorm === searchNorm) return true

      const fVal = String(
        n.fields?.nombre?.value ??
          n.fields?.nombre ??
          n.fields?.name?.value ??
          n.fields?.name ??
          n.fields?.title?.value ??
          n.fields?.title ??
          '',
      ).toLowerCase()
      const fNorm = fVal.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (fVal && (fVal === searchName || fNorm === searchNorm)) return true

      return n.id.toLowerCase() === searchName || n.id.toLowerCase() === searchNorm
    }) || null
  )
})

const getConceptFields = (typeName: string | undefined) => {
  if (!typeName) return []
  const rootId = modelStore.rootIds[0]
  if (!rootId) return []
  const root = modelStore.getNode(rootId)
  return root?.localMetamodel?.concepts?.find(
    (c) => c.name.toLowerCase() === typeName.toLowerCase(),
  )?.fields ?? []
}

const placeholderText = computed(() => {
  const targets = props.fieldDefinition?.target_concepts || []
  if (targets.length === 0) return 'Search...'
  return targets.join(', ')
})

interface ReferenceSuggestion {
  name: string
  qualifiedName: string
  modelName: string
  rootId: string
  isCrossModel: boolean
}

const filteredSuggestions = computed<ReferenceSuggestion[]>(() => {
  const targets = props.fieldDefinition?.target_concepts || []
  const lowerQuery = query.value.toLowerCase()
  const matches: ReferenceSuggestion[] = []

  const activeModelId =
    uiStore.activeModelId || modelStore.rootIds.find((id) => !id.startsWith('spec:')) || ''

  for (const node of Object.values(modelStore.nodes)) {
    if (node.kind !== 'element' && node.kind !== 'concept') continue
    if (targets.length === 0 || targets.includes(node.type)) {
      const rootId = modelStore.getModelRootForNode(node.id) || ''
      const path = node.source?.path || ''
      const modelFileName = path.split('/').pop()?.split('\\').pop() || ''
      const modelBaseName = modelFileName.replace(/\.md$/i, '').replace(/_NN$/i, '')
      const isCrossModel = Boolean(rootId && activeModelId && rootId !== activeModelId)
      const qualifiedName = modelBaseName ? `[${modelBaseName}] ${node.name}` : node.name

      if (
        !lowerQuery ||
        node.name.toLowerCase().includes(lowerQuery) ||
        qualifiedName.toLowerCase().includes(lowerQuery)
      ) {
        matches.push({
          name: node.name,
          qualifiedName,
          modelName: modelFileName,
          rootId,
          isCrossModel,
        })
      }
    }
  }
  return matches
})

function emitValue(val: string) {
  let trimmed = val.trim()
  if (!trimmed) {
    emit('update:modelValue', '')
    return
  }

  if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
    emit('update:modelValue', trimmed)
    return
  }

  if (trimmed.startsWith('[') && trimmed.includes(']')) {
    emit('update:modelValue', `[[${trimmed}]]`)
  } else {
    emit('update:modelValue', `[[${trimmed}]]`)
  }
}

function onInput(event: Event): void {
  query.value = (event.target as HTMLInputElement).value
  showDropdown.value = true
  if (!query.value) {
    emit('update:modelValue', '')
  }
}

function formatWikiLink(name: string, isCrossModel: boolean, modelBaseName?: string): string {
  if (isCrossModel && modelBaseName) {
    const cleanModel = modelBaseName.replace(/\.md$/i, '').replace(/_NN$/i, '')
    return `[[[${cleanModel}] ${name}]]`
  }
  return `[[${name}]]`
}

function selectSuggestion(suggestion: ReferenceSuggestion): void {
  const modelBase = suggestion.modelName.replace(/\.md$/i, '').replace(/_NN$/i, '')
  const formattedVal = formatWikiLink(suggestion.name, suggestion.isCrossModel, modelBase)
  query.value = formattedVal
  showDropdown.value = false
  emit('update:modelValue', formattedVal)
}

function onBlur(): void {
  setTimeout(() => {
    showDropdown.value = false
    if (query.value) {
      emitValue(query.value)
    }
  }, 150)
}
</script>

<template>
  <div class="field-reference-container">
    <template v-if="readonly">
      <Pill
        v-if="refNode"
        :node-id="refNode.id"
        :name="refNode.name"
        :kind="refNode.conceptBinding?.name ? 'instance' : 'concept'"
        :concept-type="refNode.type"
        :block-id="refNode.id"
        :description="refNode.rawContent || refNode.rawSections?.description || ''"
        :fields="refNode.fields"
        :concept-fields="getConceptFields(refNode.type)"
        interactive
        class="cursor-pointer"
        @click="uiStore.selectNode(refNode.id)"
      />
      <Pill
        v-else-if="cleanQuery"
        :name="cleanQuery"
        kind="instance"
        :interactive="false"
      />
      <span v-else class="field-reference-readonly">—</span>
    </template>
    <input
      v-else
      type="text"
      class="field-reference-input"
      :value="query"
      :placeholder="placeholderText"
      @input="onInput"
      @focus="showDropdown = true"
      @blur="onBlur"
    />
    <ul v-if="!readonly && showDropdown && filteredSuggestions.length > 0" class="field-reference-dropdown">
      <li
        v-for="suggestion in filteredSuggestions"
        :key="suggestion.qualifiedName + '_' + suggestion.modelName"
        class="field-reference-option flex items-center justify-between"
        @mousedown.prevent="selectSuggestion(suggestion)"
      >
        <span class="flex items-center gap-1.5">
          <span v-if="suggestion.isCrossModel" class="px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
            Cross-Model
          </span>
          <span>{{ suggestion.name }}</span>
        </span>
        <span v-if="suggestion.modelName" class="text-3xs opacity-60 font-mono ml-2 shrink-0">
          {{ suggestion.modelName }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.field-reference-container {
  position: relative;
}
.field-reference-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  font-size: 13px;
  border: 1px solid var(--border-soft, #ccc);
  border-radius: 6px;
  background: #fff;
  font-family: system-ui, sans-serif;
  box-sizing: border-box;
}
.field-reference-input:focus {
  outline: none;
  border-color: #4d0e4e;
  box-shadow: 0 0 0 2px rgba(77, 14, 78, 0.1);
}
.field-reference-dropdown {
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
.field-reference-option {
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  color: #334155;
}
.field-reference-option:hover {
  background-color: rgba(77, 14, 78, 0.05);
}
</style>
