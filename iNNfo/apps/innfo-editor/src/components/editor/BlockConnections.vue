<template>
  <div data-testid="block-connections" class="block-connections space-y-4">
    <!-- Header with Help Icon (?) -->
    <div class="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
      <span class="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Connections Overview
      </span>
      <a
        href="file:///d:/LC/github/iNNfo/docs/documentation/relationships.md"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 text-2xs font-semibold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        title="Open relationships documentation"
      >
        <HelpCircle class="w-3.5 h-3.5" />
        <span>Help &amp; Specs</span>
      </a>
    </div>

    <!-- 1. Matrix Cards with Embedded Connections -->
    <div v-if="matrixGroups.length > 0" class="space-y-3">
      <div
        v-for="group in matrixGroups"
        :key="group.matrixName + '-' + group.position"
        class="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden transition-all"
      >
        <!-- Matrix Pill / Header -->
        <div class="p-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/60">
          <MatrixPill
            :name="group.matrixName"
            :source="group.source"
            :target="group.target"
            :label="group.label"
            :value-count="group.count"
            :full-width="true"
            interactive
            show-source-target
            as="button"
            @click="onSelectMatrix(group.matrixName)"
          />
        </div>

        <!-- Embedded Relationship Items under Matrix -->
        <div v-if="group.items.length > 0" class="p-2 space-y-1.5 bg-white/40 dark:bg-slate-800/20">
          <div
            v-for="rel in group.items"
            :key="rel.key"
            class="flex items-center justify-between gap-2 py-1 px-2 rounded-lg hover:bg-white dark:hover:bg-slate-700/50 transition-colors border border-transparent hover:border-slate-200/60 dark:hover:border-slate-600/50 group"
          >
            <ConnectionPill
              :source-id="rel.sourceId"
              :target-id="rel.targetId"
              :value="rel.value"
              :label="rel.label"
              :direction="rel.direction"
              origin="matrix"
              mode="compact"
              @navigate="onNavigate"
            />
          </div>
        </div>
        <div v-else class="px-4 py-2 text-2xs italic text-slate-400 dark:text-slate-500">
          No active connections in this matrix.
        </div>
      </div>
    </div>

    <!-- 2. Direct Graph Edges (Non-Matrix Relationships) -->
    <div v-if="directRelationships.length > 0" class="pt-2">
      <div class="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
        <Tag class="w-3 h-3 text-indigo-500" />
        Direct Graph Edges
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 p-2 space-y-1.5">
        <div
          v-for="rel in directRelationships"
          :key="rel.targetId + '-' + rel.label"
          class="flex items-center justify-between gap-2 py-1 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
        >
          <ConnectionPill
            :target-id="rel.targetId"
            :label="rel.label"
            :value="rel.value"
            direction="outgoing"
            origin="field"
            mode="compact"
            @navigate="onNavigate"
          />
        </div>
      </div>
    </div>

    <!-- 3. Field References (Explicit key: Target fields) -->
    <div v-if="fieldConnections.length > 0" class="pt-2">
      <div class="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
        <Tag class="w-3 h-3 text-indigo-500" />
        Field References
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 p-2 space-y-1.5">
        <div
          v-for="rel in fieldConnections"
          :key="rel.key"
          class="flex items-center justify-between gap-2 py-1 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
        >
          <ConnectionPill
            :source-id="rel.sourceId"
            :target-id="rel.targetId"
            :label="rel.label"
            :direction="rel.direction"
            origin="field"
            mode="compact"
            @navigate="onNavigate"
          />
        </div>
      </div>
    </div>

    <!-- 4. Text Mentions & Backlinks (Mentions in descriptions) -->
    <div v-if="mentionConnections.length > 0" class="pt-2">
      <div class="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
        <FileText class="w-3 h-3 text-indigo-500" />
        Text Mentions &amp; Backlinks
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 p-2 space-y-1.5">
        <div
          v-for="rel in mentionConnections"
          :key="rel.key"
          class="flex items-center justify-between gap-2 py-1 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
        >
          <ConnectionPill
            :source-id="rel.sourceId"
            :target-id="rel.targetId"
            :label="rel.label"
            :direction="rel.direction"
            origin="mention"
            mode="compact"
            @navigate="onNavigate"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="matrixGroups.length === 0 && directRelationships.length === 0 && fieldConnections.length === 0 && mentionConnections.length === 0"
      class="text-xs text-slate-400 dark:text-slate-500 italic p-3 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"
    >
      No connections or relationships declared.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { HelpCircle, Tag, FileText } from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useUiStore } from '../../stores/uiStore'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { getHexColor } from '../../composables/useConceptVisuals'
import { readMatrixDefsField, resolveMatrixIndexByName } from '../../composables/useMatrixDefinitions'
import { useNodeConnections } from '../../composables/useNodeConnections'
import type { MatrixDecl } from '@cognnitive/innfo-core'
import type { ModelRelationship } from '../../model/types'
import MatrixPill from './MatrixPill.vue'
import ConnectionPill from './ConnectionPill.vue'

const props = withDefaults(
  defineProps<{
    rootNodeId: string
    nodeConcept: string
    nodeId?: string
    isConcept?: boolean
    relationships?: ModelRelationship[]
    onNavigate: (targetId: string) => void
  }>(),
  {
    isConcept: false,
    relationships: () => [],
  },
)

const knowledgeStore = useKnowledgeStore()
const uiStore = useUiStore()

const { fieldConnections, mentionConnections } = useNodeConnections({
  rootNodeId: props.rootNodeId,
  nodeConcept: props.nodeConcept,
  nodeId: props.nodeId,
  isConcept: props.isConcept,
  relationships: props.relationships,
})

export interface ResolvedConnectionItem {
  key: string
  sourceId?: string
  targetId?: string
  value?: string | number
  label?: string
  direction: 'outgoing' | 'incoming'
}

interface MatrixGroup {
  matrixName: string
  source?: string
  target?: string
  label?: string
  position: 'row' | 'col'
  count: number
  accentColor: string
  items: ResolvedConnectionItem[]
}

function normalizeConcept(name: string): string {
  const lower = (name || '').trim().toLowerCase()
  return lower.endsWith('s') ? lower.slice(0, -1) : lower
}

function matchesConcept(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeConcept(a) === normalizeConcept(b)
}

function matchesMatrixName(label: string, matrixName: string): boolean {
  if (!label || !matrixName) return false
  const cleanLabel = normalizeConcept(label.replace(/matrix|matriz/gi, ''))
  const cleanMatrix = normalizeConcept(matrixName.replace(/matrix|matriz/gi, ''))
  return cleanLabel === cleanMatrix || label.toLowerCase().includes(matrixName.toLowerCase()) || matrixName.toLowerCase().includes(label.toLowerCase())
}

const matrixGroups = computed<MatrixGroup[]>(() => {
  const root = knowledgeStore.getNode(props.rootNodeId)
  if (!root) return []

  const defsField = readMatrixDefsField(root)
  const rawMatrices = defsField.length > 0
    ? defsField
    : root.rawContent
      ? parseFrontmatter(root.rawContent)?.matrices
      : undefined
  const matrices: MatrixDecl[] = Array.isArray(rawMatrices) ? (rawMatrices as MatrixDecl[]) : []
  if (matrices.length === 0) return []

  const result: MatrixGroup[] = []

  function countNonDashCells(
    matrixName: string,
    rootNodeId: string,
    conceptInstanceName: string,
  ): number {
    const rn = knowledgeStore.getNode(rootNodeId)
    if (!rn?.fields) return 0
    let count = 0
    for (const [key, fv] of Object.entries(rn.fields)) {
      const parts = key.split('||')
      if (parts.length >= 3 && parts[0] === matrixName) {
        if (parts[1] === conceptInstanceName || parts[2] === conceptInstanceName) {
          const val = (fv as any)?.value
          if (val !== undefined && val !== null && val !== '' && val !== '-' && val !== false) {
            count++
          }
        }
      }
    }
    return count
  }

  function countTotalMatrixCells(matrixName: string, rootNodeId: string): number {
    const rn = knowledgeStore.getNode(rootNodeId)
    if (!rn?.fields) return 0
    let count = 0
    for (const [key, fv] of Object.entries(rn.fields)) {
      const parts = key.split('||')
      if (parts.length >= 3 && parts[0] === matrixName) {
        const val = (fv as any)?.value
        if (val !== undefined && val !== null && val !== '' && val !== '-' && val !== false) {
          count++
        }
      }
    }
    return count
  }

  function resolveNodeId(idOrName?: string): string | undefined {
    if (!idOrName) return undefined
    const direct = knowledgeStore.getNode(idOrName)
    if (direct) return direct.id
    const clean = idOrName.split('/').pop() || idOrName
    const found = Object.values(knowledgeStore.nodes).find(
      (n) => n.id === idOrName || n.name === idOrName || n.id.endsWith('/' + clean) || n.name === clean,
    )
    return found ? found.id : idOrName
  }

  function extractNodeMatrixItems(
    matrixName: string,
    rootNodeId: string,
    nodeName: string,
    isSource: boolean,
  ): ResolvedConnectionItem[] {
    const rn = knowledgeStore.getNode(rootNodeId)
    if (!rn?.fields) return []
    const items: ResolvedConnectionItem[] = []
    for (const [key, fv] of Object.entries(rn.fields)) {
      const parts = key.split('||')
      if (parts.length >= 3 && parts[0] === matrixName) {
        const val = (fv as any)?.value
        if (val !== undefined && val !== null && val !== '' && val !== '-' && val !== false) {
          const rowName = parts[1]
          const colName = parts[2]
          const nodeClean = nodeName.split('/').pop() || nodeName
          if (isSource && (rowName === nodeName || (rowName.split('/').pop() || rowName) === nodeClean)) {
            items.push({
              key,
              targetId: resolveNodeId(colName),
              value: val,
              direction: 'outgoing',
            })
          } else if (!isSource && (colName === nodeName || (colName.split('/').pop() || colName) === nodeClean)) {
            items.push({
              key,
              sourceId: resolveNodeId(rowName),
              value: val,
              direction: 'incoming',
            })
          }
        }
      }
    }
    return items
  }

  for (const m of matrices) {
    const conceptTarget = props.nodeConcept
    const isSource = matchesConcept(m.source, conceptTarget)
    const isTarget = matchesConcept(m.target, conceptTarget)

    if (!isSource && !isTarget) continue

    const conceptColor = (() => {
      const rootNode = knowledgeStore.getNode(props.rootNodeId)
      if (rootNode?.rawContent) {
        const fmData = parseFrontmatter(rootNode.rawContent)
        const concepts = fmData?.concepts ?? []
        const found = concepts.find((c) => matchesConcept(c.name, conceptTarget))
        if (found?.color) return getHexColor(found.color)
      }
      return getHexColor(undefined)
    })()

    const node = props.nodeId ? knowledgeStore.getNode(props.nodeId) : undefined
    const count = props.isConcept || !node
      ? countTotalMatrixCells(m.name, props.rootNodeId)
      : countNonDashCells(m.name, props.rootNodeId, node.name)

    // Filter direct relationships matching this matrix
    const matchingRels = (props.relationships || [])
      .filter((r) => matchesMatrixName(r.label, m.name))
      .map((r) => ({
        key: r.targetId + '-' + (r.value || ''),
        targetId: isSource ? resolveNodeId(r.targetId) : undefined,
        sourceId: isTarget ? resolveNodeId(r.targetId) : undefined,
        value: r.value,
        direction: (isSource ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming',
      }))

    const extractedItems = node
      ? extractNodeMatrixItems(m.name, props.rootNodeId, node.name, isSource)
      : []

    // Merge extracted matrix cell items + direct relationships without duplicates
    const itemMap = new Map<string, ResolvedConnectionItem>()
    for (const item of [...extractedItems, ...matchingRels]) {
      const idKey = (item.sourceId || '') + '->' + (item.targetId || '') + ':' + (item.value || '')
      if (!itemMap.has(idKey)) {
        itemMap.set(idKey, item)
      }
    }
    const combinedItems = Array.from(itemMap.values())

    result.push({
      matrixName: m.name,
      source: m.source,
      target: m.target,
      label: m.label,
      position: isSource ? 'row' : 'col',
      count: Math.max(count, combinedItems.length),
      accentColor: conceptColor,
      items: combinedItems,
    })
  }

  return result
})

// Standalone direct relationships that don't belong to any matrix
const directRelationships = computed<ModelRelationship[]>(() => {
  const allRels = props.relationships || []
  if (allRels.length === 0) return []

  const matchedSet = new Set<string>()
  for (const group of matrixGroups.value) {
    for (const item of group.items) {
      if (item.targetId) matchedSet.add(item.targetId)
      if (item.sourceId) matchedSet.add(item.sourceId)
    }
  }

  return allRels.filter((r) => !matchedSet.has(r.targetId))
})

function onSelectMatrix(matrixName: string): void {
  const idx = resolveMatrixIndexByName(matrixName)
  if (idx !== -1) {
    uiStore.setActiveMatrixIndex(idx)
    uiStore.setActiveView('matrices')
  }
}
</script>
