<template>
  <MarkerTooltip
    v-if="showTooltip"
    :marker="markerInfo"
    :score="effectiveScore"
    data-testid="marker-tooltip"
  >
    <component
      :is="getMarkerIcon(markerName)"
      :data-testid="testId"
      :aria-label="markerName"
      :class="classes"
      @click="handleClick"
    />
  </MarkerTooltip>
  <component
    v-else
    :is="getMarkerIcon(markerName)"
    :data-testid="testId"
    :aria-label="markerName"
    :class="classes"
    @click="handleClick"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkerTooltip from './MarkerTooltip.vue'
import type { MarkerInfo } from './MarkerTooltip.vue'
import { getMarkerIcon, getMarkerClasses, getMarkerDefinition } from './MarkerIcons'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { commitMarkerValue } from '../../shared/editAttribution'
import { MARKER_CYCLE_COUNT } from '../../utils/constants'

/**
 * Single, unified component for interacting with markers.
 *
 * Renders the marker glyph (icon + score-based styling), shows a hover
 * tooltip with the marker's meaning and its possible values, and cycles the
 * marker score on click when `interactive` is enabled.
 */
const props = withDefaults(
  defineProps<{
    /** Canonical marker name (e.g. 'completion', 'certainty', 'priority'). */
    markerName: string
    /** Node whose `markers` map is read/written. */
    nodeId?: string
    /** Explicit score override (0-3). When omitted, resolved from the node. */
    score?: number
    /** Whether clicking the icon cycles the marker value. Default true. */
    interactive?: boolean
    /** Show the hover tooltip with marker info and its values. Default true. */
    showTooltip?: boolean
    /** Size class overriding the default ('w-4 h-4'). */
    sizeClass?: string
  }>(),
  {
    nodeId: '',
    score: undefined,
    interactive: true,
    showTooltip: true,
    sizeClass: '',
  },
)

const emit = defineEmits<{ change: [] }>()

const knowledgeStore = useKnowledgeStore()

const nodeScore = computed(() => {
  if (!props.nodeId) return 0
  const node = knowledgeStore.getNode(props.nodeId)
  if (!node?.markers) return 0
  return (node.markers[props.markerName] as number) ?? 0
})

const effectiveScore = computed(() => props.score ?? nodeScore.value)

const markerInfo = computed<MarkerInfo>(() => getMarkerDefinition(props.markerName))

const testId = computed(() => `marker-${props.markerName}`)

const classes = computed(() => {
  let cls = getMarkerClasses(props.markerName, effectiveScore.value, props.sizeClass || 'w-4 h-4')
  if (!props.interactive) {
    cls = cls.replace('cursor-pointer', 'cursor-default')
  }
  return cls
})

const handleClick = (event: Event) => {
  if (!props.interactive || !props.nodeId) return
  event.stopPropagation()
  const next = (effectiveScore.value + 1) % MARKER_CYCLE_COUNT
  commitMarkerValue(knowledgeStore, props.nodeId, props.markerName, next)
  emit('change')
}
</script>
