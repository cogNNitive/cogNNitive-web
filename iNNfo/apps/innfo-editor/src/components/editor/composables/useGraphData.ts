import { computed, Ref } from 'vue'
import { hsl } from 'd3-color'
import { useModelStore } from '../../../stores/modelStore'
import {
  getConceptMeta,
  getHexColor as resolveHexColor,
} from '../../../composables/useConceptVisuals'

import type { RelationshipOrigin } from '@cognnitive/innfo-core'

export interface GNode {
  id: string
  label: string
  concept: string
  color: string
  inst: boolean
}

export const ORIGIN_COLORS: Record<RelationshipOrigin, string> = {
  matrix: '#3b82f6',
  field: '#22c55e',
  mention: '#f59e0b',
  graph_edge: '#a855f7',
  // `source` edges point at a `sources/nn/…` file path, not a graph node id, so
  // they are filtered out before rendering (see `allEdges`); this entry only
  // keeps the map exhaustive.
  source: '#64748b',
}

export interface GEdge {
  source: string
  target: string
  label: string
  type: string
  color: string
  origin: RelationshipOrigin
}

export function useGraphData(localNodeId: Ref<string>) {
  const modelStore = useModelStore()

  // ── Build concept color map from node types ──
  const conceptColors: Record<string, string> = {}

  function initConceptColors() {
    // No-op: colors are now statically resolved via metamodel spec
  }

  function getHexColor(colorName: string): string {
    const metaColor = getConceptMeta(colorName).color
    return resolveHexColor(metaColor || colorName)
  }

  function hslStr(hex: string, satMult: number, lightOff: number): string {
    const c = hsl(hex)
    return hsl(c.h, Math.min(1, c.s * satMult), Math.max(0, Math.min(1, c.l + lightOff))).formatHex()
  }

  function textColor(bg: string) {
    return hsl(bg).l > 0.55 ? '#1e293b' : '#ffffff'
  }

  const allNodes = computed<GNode[]>(() => {
    const result: GNode[] = []
    const seen = new Set<string>()
    const typeColorMap = new Map<string, string>()

    function addNode(id: string, label: string, concept: string, color: string, inst: boolean) {
      if (seen.has(id)) return
      seen.add(id)
      result.push({ id, label, concept, color: getHexColor(color), inst })
    }

    // Collect unique types for concept-level grouping
    const conceptTypes = new Set<string>()
    for (const node of Object.values(modelStore.nodes)) {
      if (node.type) conceptTypes.add(node.type)
    }

    // Create concept-level nodes (column headers)
    for (const type of conceptTypes) {
      const c = getConceptMeta(type).color || 'slate'
      addNode(`concept:${type}`, type, type, c, false)
      typeColorMap.set(type, c)
    }

    // Create instance nodes from modelStore.nodes
    for (const node of Object.values(modelStore.nodes)) {
      const typeColor = typeColorMap.get(node.type)
      const conceptColor = node.conceptBinding?.name
        ? (getConceptMeta(node.conceptBinding.name).color ?? 'slate')
        : null
      const color = typeColor ?? conceptColor ?? 'slate'
      addNode(`inst:${node.id}`, node.name, node.type, color, true)
    }

    return result
  })

  const allEdges = computed<GEdge[]>(() => {
    const result: GEdge[] = []
    const nodeSet = new Set(allNodes.value.map((n) => n.id))

    // Build edges from KnowledgeNode.relationships[]
    for (const node of Object.values(modelStore.nodes)) {
      if (node.relationships && node.relationships.length > 0) {
        for (const rel of node.relationships) {
          // `source` edges target a `sources/nn/…` file, not a graph node.
          if (rel.origin === 'source') continue
          const sourceId = `inst:${node.id}`
          const targetId = `inst:${rel.targetId}`
          if (nodeSet.has(sourceId) && nodeSet.has(targetId)) {
            const origin = rel.origin ?? 'matrix'
            const edgeColor =
              ORIGIN_COLORS[origin] ?? getHexColor(getConceptMeta(node.type).color || 'slate')
            result.push({
              source: sourceId,
              target: targetId,
              label: rel.label,
              type: rel.label,
              color: edgeColor,
              origin,
            })
          }
        }
      }
    }

    return result
  })

  const displayNodes = computed(() => {
    if (!localNodeId.value) return allNodes.value
    const localId = `inst:${localNodeId.value}`
    const focal = allNodes.value.find((n) => n.id === localId)
    if (!focal) return allNodes.value
    const ids = new Set<string>([localId])
    const cnames = new Set<string>()
    allEdges.value.forEach((e) => {
      if (e.source === localId) {
        ids.add(e.target)
        cnames.add(allNodes.value.find((n) => n.id === e.target)?.concept || '')
      }
      if (e.target === localId) {
        ids.add(e.source)
        cnames.add(allNodes.value.find((n) => n.id === e.source)?.concept || '')
      }
    })
    allNodes.value.forEach((n) => {
      if (ids.has(n.id) && cnames.has(n.concept) && !n.inst) ids.add(n.id)
    })
    return allNodes.value.filter((n) => ids.has(n.id))
  })

  const displayEdges = computed(() => {
    if (!localNodeId.value) return allEdges.value
    const ids = new Set(displayNodes.value.map((n) => n.id))
    return allEdges.value.filter((e) => ids.has(e.source) && ids.has(e.target))
  })

  return {
    conceptColors,
    initConceptColors,
    getHexColor,
    hslStr,
    textColor,
    allNodes,
    allEdges,
    displayNodes,
    displayEdges,
  }
}
