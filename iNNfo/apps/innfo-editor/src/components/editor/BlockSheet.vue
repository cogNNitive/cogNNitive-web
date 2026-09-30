<template>
  <div
    data-testid="block-sheet"
    class="rounded-lg bg-slate-50 dark:bg-slate-800/50 transition-all duration-200 flex flex-col relative border border-slate-200 dark:border-slate-700 overflow-hidden"
  >
    <!-- Header: concept label + markers + controls -->
    <BlockSheetHeader
      :block="block"
      :kind="kind"
      :concept-type="conceptType"
      :concept-name="conceptName"
      :palette="palette"
      :resolved-icon="resolvedIcon"
      :clean-concept-name="cleanConceptName"
      :is-editing="isEditing"
      :local-block-name="localBlockName"
      :has-markers="hasMarkers"
      :all-markers="allMarkers"
      :active-workspace-tags="activeWorkspaceTags"
      :show-add-child="showAddChild"
      :show-reorder="showReorder"
      :is-first="isFirst"
      :is-last="isLast"
      :show-delete="showDelete"
      :collapsed="collapsed"
      :disable-expand="disableExpand"
      @update:collapsed="$emit('update:collapsed', $event)"
      @edit-toggle="$emit('edit-toggle')"
      @move-up="$emit('move-up')"
      @move-down="$emit('move-down')"
      @delete="$emit('delete')"
      @add-child="$emit('add-child')"
      @change="$emit('change')"
      @save="handleSaveClick"
      @open-prompt-modal="isPromptModalOpen = true"
      @update:concept-name="onConceptNameInput"
      @update:block-name-input="onNameInput"
      @change-block-name="onNameChange"
      @navigate-to-instance="navigateToInstance"
    />

    <!-- Expandable body / edit form -->
    <div
      v-show="(!collapsed && !disableExpand) || isEditing"
      class="overflow-hidden transition-all duration-300"
    >
      <div class="px-3 pb-4 pt-2 space-y-6 flex flex-col">
        <!-- Edit-mode field inputs -->
        <BlockSheetEditForm
          v-if="isEditing"
          :is-concept="isConcept"
          :template-node="templateNode"
          :template-filename="templateFilename"
          :generated-prompt="generatedPrompt"
          :copied="copied"
          :local-tags="localTags"
          :concept-fields="conceptFields"
          :block-id-for-fields="blockIdForFields"
          :description="block.description"
          @copy-prompt="copyPrompt"
          @open-prompt-modal="isPromptModalOpen = true"
          @update:concept-tags="onConceptTagsUpdate"
          @update:tags="onTagsUpdate"
          @update:description="onDescriptionUpdate"
        />

        <!-- Read-mode layout -->
        <template v-else>
          <BlockSheetConceptBody
            v-if="isConcept"
            :block-id="block.id"
            :concept-type="conceptType"
            :concept-name="conceptName"
            :concept-fields="conceptFields"
            :current-tags="currentTags"
            :rendered-description="renderedDescription"
            :has-relationships="hasRelationships"
            :has-matrices="hasMatrices"
            :root-node-id="rootNodeId"
            :relationships-list="relationshipsList"
            :resolved-asset-items="resolvedAssetItems"
            :on-navigate="navigateToNode"
          />
          <BlockSheetElementBody
            v-else
            :block-id="block.id"
            :block-id-for-fields="blockIdForFields"
            :concept-type="conceptType"
            :concept-fields="conceptFields"
            :is-editing="isEditing"
            :current-tags="currentTags"
            :rendered-description="renderedDescription"
            :has-relationships="hasRelationships"
            :has-matrices="hasMatrices"
            :root-node-id="rootNodeId"
            :relationships-list="relationshipsList"
            :resolved-asset-items="resolvedAssetItems"
            :on-navigate="navigateToNode"
            @edit-toggle="$emit('edit-toggle')"
          />
        </template>
      </div>
    </div>

    <!-- Prompt Generator Modal -->
    <OpenCodePromptModal
      :is-open="isPromptModalOpen"
      :context="{
        modelName: modelFilename,
        modelPath: modelPath,
        conceptName: conceptName || conceptType,
        elementName: block.name,
        elementType: conceptType,
      }"
      @close="isPromptModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BlockSheetHeader from './BlockSheetHeader.vue'
import BlockSheetEditForm from './BlockSheetEditForm.vue'
import BlockSheetConceptBody from './BlockSheetConceptBody.vue'
import BlockSheetElementBody from './BlockSheetElementBody.vue'
import OpenCodePromptModal from './OpenCodePromptModal.vue'
import { getMarkerDefinitions } from './MarkerIcons'
import { renderMarkdown } from '../../utils/markdown'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useNodeMediaScan } from '../../composables/useNodeMediaScan'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { getColorClasses } from '../../utils/colors'
import type { BlockKind } from '../../utils/conceptVisuals'
import { useConceptVisuals, getConceptMeta } from '../../composables/useConceptVisuals'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { readMatrixDefsField } from '../../composables/useMatrixDefinitions'
import { useBlockAssets } from './composables/useBlockAssets'

const props = withDefaults(
  defineProps<{
    block: {
      id?: string
      name: string
      description: string
      fields?: Record<string, any>
      tags?: string[]
    }
    kind: BlockKind
    conceptType: string
    conceptName: string
    conceptFields?: any[]
    conceptColor?: string
    conceptIcon?: string
    collapsed: boolean
    isEditing: boolean
    disableExpand?: boolean
    hasMarkers?: boolean
    showDelete?: boolean
    showReorder?: boolean
    showAddChild?: boolean
    isFirst?: boolean
    isLast?: boolean
  }>(),
  {
    conceptFields: () => [],
    conceptColor: '',
    conceptIcon: '',
    disableExpand: false,
    hasMarkers: false,
    showDelete: false,
    showReorder: false,
    showAddChild: false,
    isFirst: false,
    isLast: false,
  },
)

const emit = defineEmits<{
  'update:collapsed': [val: boolean]
  'edit-toggle': []
  'move-up': []
  'move-down': []
  delete: []
  'add-child': []
  change: []
  'update:field': [fieldName: string, value: unknown]
  'update:concept-name': [name: string]
  'navigate-to-node': [nodeId: string]
}>()

const knowledgeStore = useKnowledgeStore()
const workspaceStore = useWorkspaceStore()
const conceptVisuals = useConceptVisuals()

const isConcept = computed(() => props.kind === 'concept')

// ── Palette & Visual Resolution ─────────────────────────────────

const effectiveColorName = computed(() => {
  if (props.conceptColor) return props.conceptColor
  if (props.block.id) {
    const node = knowledgeStore.getNode(props.block.id)
    if (node) return conceptVisuals.resolveColorName(node)
  }
  const targetConcept = props.conceptName || props.conceptType
  if (targetConcept) {
    const meta = getConceptMeta(targetConcept)
    if (meta.color) return meta.color
  }
  return ''
})

const resolvedIcon = computed(() => {
  if (props.conceptIcon) return props.conceptIcon
  if (props.block.id) {
    const node = knowledgeStore.getNode(props.block.id)
    if (node) return conceptVisuals.resolveIcon(node)
  }
  const targetConcept = props.conceptName || props.conceptType
  if (targetConcept) {
    const meta = getConceptMeta(targetConcept)
    if (meta.icon) return meta.icon
  }
  return 'layers'
})

const palette = computed(() => getColorClasses(effectiveColorName.value))

// ── Markers ─────────────────────────────────────────────────────

const allMarkers = computed(() => getMarkerDefinitions())

// ── Name helpers ────────────────────────────────────────────────

const cleanConceptName = computed(() => {
  const name = props.conceptName
  return name.endsWith('s') ? name.slice(0, -1) : name
})

// ── Markdown rendering ──────────────────────────────────────────

/** Strip everything from the first _NN marker onwards. */
function stripBlockDefinitions(text: string): string {
  const blockPattern = /^[ \t]*(?:[-*+]|\d+\.)?[ \t]*_NN\s+[\w\s-]+?:/m
  const idx = text.search(blockPattern)
  if (idx === -1) return text
  return text.substring(0, idx).trim()
}

const renderedDescription = computed(() => {
  const text =
    props.kind === 'concept'
      ? stripBlockDefinitions(props.block.description)
      : props.block.description
  return renderMarkdown(text)
})

// ── Node from store (full model data) ───────────────────────────

const nodeFromStore = computed(() =>
  props.block.id ? knowledgeStore.getNode(props.block.id) : undefined,
)

// ── Relationships ───────────────────────────────────────────────

/** Last path segment of a node id/name (e.g. `youtube.com` from `Root/youtube.com`). */
function lastSegment(idOrName?: string): string {
  if (!idOrName) return ''
  const parts = idOrName.split('/')
  return parts[parts.length - 1] || idOrName
}

/**
 * True when some other node points at this node through a reference field or a
 * wikilink mention. `node.relationships` holds only outgoing edges, so a node
 * that is purely a reference target (e.g. a Platform that Resources point at)
 * would otherwise hide its Connections section even though `useNodeConnections`
 * already computes those incoming edges.
 */
const hasIncomingReferences = computed(() => {
  if (!props.block.id) return false
  const node = knowledgeStore.getNode(props.block.id)
  if (!node) return false
  const nameLower = (node.name || '').toLowerCase()
  const cleanLower = lastSegment(node.name).toLowerCase()

  for (const other of Object.values(knowledgeStore.nodes)) {
    if (other.id === props.block.id) continue
    const refs: string[] = []
    if (other.fields) {
      for (const fv of Object.values(other.fields)) {
        const val = typeof fv === 'object' && fv !== null && 'value' in fv ? fv.value : fv
        if (typeof val === 'string' && val.includes('[[')) {
          for (const m of val.matchAll(/\[\[(.*?)\]\]/g)) refs.push(m[1]?.trim() ?? '')
        }
      }
    }
    const desc = (other as any)?.description || other.rawContent || ''
    if (typeof desc === 'string' && desc.includes('[[')) {
      for (const m of desc.matchAll(/\[\[(.*?)\]\]/g)) refs.push(m[1]?.trim() ?? '')
    }
    for (const ref of refs) {
      if (ref && (ref.toLowerCase() === nameLower || lastSegment(ref).toLowerCase() === cleanLower)) {
        return true
      }
    }
  }
  return false
})

const hasRelationships = computed(() => {
  if (!props.block.id) return false
  const node = knowledgeStore.getNode(props.block.id)
  if (node && node.relationships && node.relationships.length > 0) return true
  return hasIncomingReferences.value
})

const relationshipsList = computed(() => {
  if (!props.block.id) return []
  const node = knowledgeStore.getNode(props.block.id)
  return node?.relationships ?? []
})

// ── Matrix summaries ────────────────────────────────────────────

const rootNodeId = computed(() => {
  if (!props.block.id) return knowledgeStore.rootIds[0] ?? ''
  let curr = knowledgeStore.getNode(props.block.id)
  while (curr && curr.parentId) {
    curr = knowledgeStore.getNode(curr.parentId)
  }
  return curr ? curr.id : (knowledgeStore.rootIds[0] ?? '')
})

const hasMatrices = computed(() => {
  if (!rootNodeId.value) return false
  const root = knowledgeStore.getNode(rootNodeId.value)
  if (!root) return false
  const defs = readMatrixDefsField(root)
  if (defs.length > 0) return true
  if (!root.rawContent) return false
  const fm = parseFrontmatter(root.rawContent)
  const matrices: unknown[] = (fm as any)?.matrices ?? []
  return matrices.length > 0
})

// ── Assets / Media ──────────────────────────────────────────────

const { scannedAssets, scan: scanMedia } = useNodeMediaScan()

// Trigger scan when the block is expanded and has an id
watch(
  () => props.block.id,
  (id) => {
    if (id && !props.collapsed && workspaceStore.handle) {
      scanMedia(id)
    }
  },
  { immediate: false },
)

// Also scan when uncollapsed
watch(
  () => props.collapsed,
  (collapsed) => {
    if (!collapsed && props.block.id && workspaceStore.handle) {
      scanMedia(props.block.id)
    }
  },
  { immediate: false },
)

const { resolveAssetUrl, assetItems } = useBlockAssets(nodeFromStore, scannedAssets)

// Resolve scanned asset paths to blob URLs for display
const resolvedAssetItems = ref<Array<{ filename: string; url: string }>>([])

watch(
  [assetItems, scannedAssets],
  async () => {
    const resolved = await Promise.all(
      assetItems.value.map(async (item) => ({
        filename: item.filename,
        url: await resolveAssetUrl(item.url),
      })),
    )
    resolvedAssetItems.value = resolved
  },
  { immediate: true, deep: true },
)

// ── Field viewer node ID ────────────────────────────────────────

const blockIdForFields = computed(() => props.block.id || '')

// ── Navigation ──────────────────────────────────────────────────

const navigateToNode = (targetId: string) => {
  emit('navigate-to-node', targetId)
}

const navigateToInstance = () => {
  if (!props.block.name || !props.conceptName) return
  emit('navigate-to-node', props.block.name)
  emit('update:collapsed', false)
}

const onConceptNameInput = (newName: string) => {
  emit('update:concept-name', newName)
}

// ── Tags ────────────────────────────────────────────────────────

const currentTags = computed<string[]>(() => {
  if (isConcept.value) {
    if (!rootNodeId.value) return []
    const root = knowledgeStore.getNode(rootNodeId.value)
    return root?.conceptTags?.[props.conceptName] ?? []
  }
  const node = nodeFromStore.value
  return node?.tags ?? props.block.tags ?? []
})

const activeWorkspaceTags = computed(() => {
  const wsMap = knowledgeStore.workspaceTagsMap
  if (!wsMap || Object.keys(wsMap).length === 0) return []
  const badges: { name: string; icon?: string; color?: string; description?: string }[] = []
  for (const t of currentTags.value) {
    if (!t) continue
    const key = t.toLowerCase().trim()
    const meta = wsMap[key] || wsMap[t]
    if (meta) {
      badges.push({
        name: t,
        icon: meta.icon,
        color: meta.color,
        description: meta.description,
      })
    }
  }
  return badges
})

const localTags = ref<string[]>([])

watch(
  [() => props.block.id, () => props.isEditing, currentTags],
  () => {
    localTags.value = [...(currentTags.value ?? [])]
  },
  { immediate: true, deep: true },
)

const onTagsUpdate = (newTags: string[]) => {
  localTags.value = newTags
  props.block.tags = newTags
  if (props.block.id) {
    const node = knowledgeStore.getNode(props.block.id)
    if (node) {
      knowledgeStore.upsertNode({
        ...node,
        tags: newTags,
      })
    }
    knowledgeStore.markDirty(props.block.id)
    if (rootNodeId.value) {
      knowledgeStore.markDirty(rootNodeId.value)
    }
    emit('change')
  }
}

const onConceptTagsUpdate = (newTags: string[]) => {
  localTags.value = newTags
  if (rootNodeId.value) {
    const root = knowledgeStore.getNode(rootNodeId.value)
    if (root) {
      const conceptTags = { ...(root.conceptTags ?? {}) }
      if (newTags.length > 0) {
        conceptTags[props.conceptName] = newTags
      } else {
        delete conceptTags[props.conceptName]
      }
      knowledgeStore.upsertNode({
        ...root,
        conceptTags,
      })
      knowledgeStore.markDirty(root.id)
      emit('change')
    }
  }
}

const localBlockName = ref(props.block.name)

watch(
  () => props.block.name,
  (newVal) => {
    localBlockName.value = newVal
  },
)

const onDescriptionUpdate = (val: string) => {
  props.block.description = val
  if (props.block.id) {
    const node = knowledgeStore.getNode(props.block.id)
    if (node) {
      knowledgeStore.upsertNode({
        ...node,
        rawSections: { ...node.rawSections, description: val },
      })
    }
  }
  knowledgeStore.markDirty(props.block.id || '')
  emit('change')
}

const onNameChange = () => {
  const newName = localBlockName.value.trim()
  if (!newName) {
    localBlockName.value = props.block.name
    return
  }
  if (newName === props.block.name) return

  props.block.name = newName
  if (props.block.id) {
    knowledgeStore.renameElementNode(props.block.id, newName)
  }
  emit('change')
}

const onNameInput = (event: Event) => {
  localBlockName.value = (event.target as HTMLInputElement).value
}

const handleSaveClick = async () => {
  onNameChange()
  if (!isConcept.value && props.block.id) {
    const node = knowledgeStore.getNode(props.block.id)
    if (node) {
      knowledgeStore.upsertNode({
        ...node,
        tags: [...localTags.value],
      })
      props.block.tags = [...localTags.value]
    }
    knowledgeStore.markDirty(props.block.id)
    if (rootNodeId.value) {
      knowledgeStore.markDirty(rootNodeId.value)
    }
  }
  emit('change')
  emit('edit-toggle')

  if (workspaceStore.hasHandle) {
    try {
      await workspaceStore.saveActiveFile()
    } catch (err) {
      console.error('Auto-save on block save failed:', err)
    }
  }
}

watch(
  () => props.isEditing,
  (newVal, oldVal) => {
    if (oldVal === true && newVal === false) {
      onNameChange()
    }
  },
)

const copied = ref(false)
const isPromptModalOpen = ref(false)

const templateNode = computed(() => {
  if (!rootNodeId.value) return undefined
  const rootNode = knowledgeStore.getNode(rootNodeId.value)
  if (!rootNode?.rawContent) return undefined

  const fm = parseFrontmatter(rootNode.rawContent)
  const parentName = (fm as any)?.parent_spec?.name
  if (!parentName) return undefined

  const templateId = `spec:${parentName}`
  return knowledgeStore.getNode(templateId)
})

const templatePath = computed(() => templateNode.value?.source?.path || '')
const templateFilename = computed(() => {
  const path = templatePath.value
  return path.split('/').pop() || path.split('\\').pop() || 'template'
})

const modelPath = computed(() => {
  if (!rootNodeId.value) return ''
  const rootNode = knowledgeStore.getNode(rootNodeId.value)
  return rootNode?.source?.path || ''
})

const modelFilename = computed(() => {
  const path = modelPath.value
  return path.split('/').pop() || path.split('\\').pop() || 'model'
})

const generatedPrompt = computed(() => {
  const concept = props.conceptName || props.conceptType
  const templateName = templateFilename.value
  const templateLoc = templatePath.value ? ` (located at "${templatePath.value}")` : ''
  const modelName = modelFilename.value
  const modelLoc = modelPath.value ? ` (located at "${modelPath.value}")` : ''

  return `I need to edit the concept "${concept}" in the specification template "${templateName}"${templateLoc}.

This template is used by the model "${modelName}"${modelLoc}.

Please inspect the template file and perform the corresponding modifications to the definition of "${concept}" (e.g., modify fields, types, descriptions, or relationships as needed).`
})

const copyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(generatedPrompt.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}
</script>
