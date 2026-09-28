<script setup lang="ts">
import { computed } from 'vue'
import { useModelStore } from '../../stores/modelStore'
import { commitFieldValue } from '../editAttribution'
import { resolveWidgetComponent, FallbackWidget } from './index'
import { isImageFieldName, isImageFieldValue } from '../../utils/imageDetection'

/**
 * Binds one resolved field/marker to its widget: resolves the ported
 * component for `widgetType` via the registry, falling back to
 * `FallbackWidget` for any unported type (R15). Every commit from the
 * ported widget is stamped with editAttribution via `commitFieldValue` (R16).
 *
 * Enhanced in Phase 4 (rebuild-format-editor-ui) with:
 * - `fieldDefinition` prop for field-type widgets (options, target_concepts)
 * - Backward-compatible with concept-type widget dispatch
 */
const props = withDefaults(
  defineProps<{
    nodeId: string
    fieldKey: string
    widgetType: string
    authorId?: string
    /** Optional field definition for field-type widgets (provides options, target_concepts, etc.) */
    fieldDefinition?: {
      name: string
      type: string
      options?: string[]
      target_concepts?: string[]
      target_template?: string
      default?: unknown
    }
    readonly?: boolean
  }>(),
  { authorId: 'anonymous', readonly: false },
)

const modelStore = useModelStore()

const currentValue = computed(() => modelStore.getNode(props.nodeId)?.fields[props.fieldKey]?.value)

const effectiveWidgetType = computed(() => {
  const t = props.widgetType || props.fieldDefinition?.type || 'string'
  if (t === 'image' || t === 'asset' || t === 'file' || t === 'video' || t === 'audio' || t === 'animation') {
    return t === 'asset' || t === 'animation' ? 'asset' : t
  }
  const name = props.fieldKey || props.fieldDefinition?.name || ''
  if (name.toLowerCase() === 'animation' || name.toLowerCase().includes('animation')) return 'asset'
  if (isImageFieldName(name)) return 'image'
  if (typeof currentValue.value === 'string' && currentValue.value.trim()) {
    if (isImageFieldValue(name, currentValue.value)) return 'image'
    const clean = currentValue.value.trim().toLowerCase()
    if (clean.endsWith('.tsx') || clean.endsWith('.jsx') || clean.endsWith('.mp4')) return 'asset'
    if (clean.startsWith('[[') && clean.endsWith(']]')) return 'reference'
  }
  if (name.toLowerCase().includes('creador') || name.toLowerCase().includes('inventor')) return 'reference'
  return t
})

const widgetComponent = computed(() => resolveWidgetComponent(effectiveWidgetType.value))

function onCommit(value: unknown): void {
  commitFieldValue(modelStore, props.nodeId, props.fieldKey, value, {
    kind: 'user',
    id: props.authorId,
  })
}
</script>

<template>
  <component
    :is="widgetComponent ?? FallbackWidget"
    :model-value="currentValue"
    :widget-type="widgetType"
    :field-definition="fieldDefinition"
    :node-id="nodeId"
    :field-key="fieldKey"
    :readonly="readonly"
    @update:model-value="onCommit"
  />
</template>
