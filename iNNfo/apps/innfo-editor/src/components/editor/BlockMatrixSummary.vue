<template>
  <div data-testid="block-matrix-summary" class="block-matrix-summary flex flex-col gap-1.5">
    <template v-if="chips.length > 0">
      <MatrixPill
        v-for="chip in chips"
        :key="chip.matrixName + '-' + chip.position"
        :name="chip.matrixName"
        :source="chip.source"
        :target="chip.target"
        :label="chip.label"
        :value-count="chip.count"
        :full-width="true"
        interactive
        show-source-target
        as="button"
        @click="onSelectMatrix(chip.matrixName)"
      />
    </template>
    <p v-else class="text-xs text-slate-400 dark:text-slate-500 italic">No matrix connections.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useUiStore } from '../../stores/uiStore'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { getHexColor } from '../../composables/useConceptVisuals'
import { readMatrixDefsField, resolveMatrixIndexByName } from '../../composables/useMatrixDefinitions'
import type { MatrixDecl } from '@cognnitive/innfo-core'
import MatrixPill from './MatrixPill.vue'

const props = withDefaults(
  defineProps<{
    rootNodeId: string
    nodeConcept: string
    nodeId: string
    isConcept?: boolean
  }>(),
  {
    isConcept: false,
  },
)

const knowledgeStore = useKnowledgeStore()
const uiStore = useUiStore()

interface MatrixChip {
  matrixName: string
  source?: string
  target?: string
  label?: string
  position: 'row' | 'col'
  count: number
  accentColor: string
}

function normalizeConcept(name: string): string {
  const lower = (name || '').trim().toLowerCase()
  return lower.endsWith('s') ? lower.slice(0, -1) : lower
}

function matchesConcept(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeConcept(a) === normalizeConcept(b)
}

const chips = computed<MatrixChip[]>(() => {
  const root = knowledgeStore.getNode(props.rootNodeId)
  if (!root) return []

  // Matrix declarations come from the template via __matrix_defs (populated by
  // the spec resolver) or, as a fallback, from the model's own frontmatter.
  const defsField = readMatrixDefsField(root)
  const rawMatrices = defsField.length > 0
    ? defsField
    : root.rawContent
      ? (parseFrontmatter(root.rawContent) as any)?.matrices
      : undefined
  const matrices: MatrixDecl[] = Array.isArray(rawMatrices) ? (rawMatrices as MatrixDecl[]) : []
  if (matrices.length === 0) return []

  const result: MatrixChip[] = []

  // Helper: count non-dash/empty cells for a matrix + concept instance
  // Cell keys are formatted as `{matrixName}||{rowInstance}||{colInstance}`.
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

  for (const m of matrices) {
    const conceptTarget = props.nodeConcept
    const isSource = matchesConcept(m.source, conceptTarget)
    const isTarget = matchesConcept(m.target, conceptTarget)

    if (!isSource && !isTarget) continue

    // Resolve concept color for accent
    const conceptColor = (() => {
      const rootNode = knowledgeStore.getNode(props.rootNodeId)
      if (rootNode?.rawContent) {
        const fmData = parseFrontmatter(rootNode.rawContent)
        const concepts: Array<{ name: string; color?: string }> = (fmData as any)?.concepts ?? []
        const found = concepts.find((c) => matchesConcept(c.name, conceptTarget))
        if (found?.color) return getHexColor(found.color)
      }
      return getHexColor(undefined)
    })()

    const node = knowledgeStore.getNode(props.nodeId)
    const count = props.isConcept || !node
      ? countTotalMatrixCells(m.name, props.rootNodeId)
      : countNonDashCells(m.name, props.rootNodeId, node.name)

    if (isSource) {
      result.push({
        matrixName: m.name,
        source: m.source,
        target: m.target,
        label: m.label,
        position: 'row',
        count,
        accentColor: conceptColor,
      })
    }

    if (isTarget && !result.some((r) => r.matrixName === m.name && r.position === 'row')) {
      result.push({
        matrixName: m.name,
        source: m.source,
        target: m.target,
        label: m.label,
        position: 'col',
        count,
        accentColor: conceptColor,
      })
    }
  }

  return result
})

function onSelectMatrix(matrixName: string): void {
  // Resolve against the authoritative merged list (same index space as
  // MatricesGrid), NOT the root's raw defs/frontmatter — those lists can
  // differ from what the grid renders, making the click show another matrix.
  const idx = resolveMatrixIndexByName(matrixName)
  if (idx !== -1) {
    uiStore.setActiveMatrixIndex(idx)
    uiStore.setActiveView('matrices')
  }
}
</script>
