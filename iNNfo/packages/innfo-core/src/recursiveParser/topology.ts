import type { KnowledgeNode } from '../types/index.js'
import { normalizePathKey } from './paths.js'

export interface ModelDagEdge {
  fromNodeId: string
  toNodeId: string
  fromPath?: string
  toPath?: string
  field?: string
}

export interface ModelDagTopology {
  /** Map of root model node ID to count of incoming parent references (in-degree). */
  inDegree: Record<string, number>
  /** Map of root model node ID to count of outgoing submodel references (out-degree). */
  outDegree: Record<string, number>
  /** All directed edges between root model nodes. */
  edges: ModelDagEdge[]
  /** Root model IDs (models with in_degree === 0, entrypoint prioritized). */
  rootIds: string[]
  /** Primary entrypoint / top-level root model ID. */
  primaryRootId?: string
}

/**
 * Computes the directed acyclic graph (DAG) topology across all parsed model root nodes.
 * Identifies in-degree and out-degree per model, resolves parent-child model reference edges,
 * and discovers top-level root models (in_degree === 0) deterministically.
 */
export function computeModelDagTopology(
  nodes: Record<string, KnowledgeNode>,
  entrypointPath?: string,
): ModelDagTopology {
  const rootNodes = Object.values(nodes).filter(
    (n) =>
      !n.id.startsWith('spec:') &&
      (n.kind === 'root' || n.parentId === null || (!n.parentId && n.kind !== 'element')),
  )
  const inDegree: Record<string, number> = {}
  const outDegree: Record<string, number> = {}
  const edges: ModelDagEdge[] = []
  const edgeSet = new Set<string>()

  // Initialize degree maps
  for (const root of rootNodes) {
    inDegree[root.id] = 0
    outDegree[root.id] = 0
  }

  // Map normalized path to root node ID for fast lookup
  const pathToRootId = new Map<string, string>()
  for (const root of rootNodes) {
    if (root.source?.path) {
      pathToRootId.set(normalizePathKey(root.source.path), root.id)
    }
    pathToRootId.set(normalizePathKey(root.name), root.id)
    pathToRootId.set(root.id.toLowerCase(), root.id)
  }

  // 1. Traverse parent-child edges recorded on nodes (childIds / parentId)
  for (const parent of rootNodes) {
    for (const childId of parent.childIds ?? []) {
      const childNode = nodes[childId]
      if (childNode && childNode.kind === 'root' && childNode.id !== parent.id) {
        const edgeKey = `${parent.id}->${childNode.id}`
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({
            fromNodeId: parent.id,
            toNodeId: childNode.id,
            fromPath: parent.source?.path,
            toPath: childNode.source?.path,
          })
          outDegree[parent.id] = (outDegree[parent.id] ?? 0) + 1
          inDegree[childNode.id] = (inDegree[childNode.id] ?? 0) + 1
        }
      }
    }
  }

  // 2. Discover model-type reference fields across all elements of each root model
  for (const parent of rootNodes) {
    const stack = [...(parent.childIds ?? [])]
    while (stack.length > 0) {
      const elId = stack.pop()!
      const elNode = nodes[elId]
      if (!elNode || elNode.kind === 'root') continue // don't cross into child model's elements

      if (elNode.fields) {
        for (const [fieldName, fieldObj] of Object.entries(elNode.fields)) {
          const val = typeof fieldObj === 'string' ? fieldObj : (fieldObj as any)?.value
          if (typeof val === 'string' && val.trim()) {
            let targetRef = val.trim()
            if (targetRef.startsWith('[[') && targetRef.endsWith(']]')) {
              targetRef = targetRef.slice(2, -2).trim()
            }
            const normTarget = normalizePathKey(targetRef)
            const targetRootId = pathToRootId.get(normTarget)
            if (targetRootId && targetRootId !== parent.id) {
              const edgeKey = `${parent.id}->${targetRootId}`
              if (!edgeSet.has(edgeKey)) {
                edgeSet.add(edgeKey)
                edges.push({
                  fromNodeId: parent.id,
                  toNodeId: targetRootId,
                  fromPath: parent.source?.path,
                  toPath: nodes[targetRootId]?.source?.path,
                  field: fieldName,
                })
                outDegree[parent.id] = (outDegree[parent.id] ?? 0) + 1
                inDegree[targetRootId] = (inDegree[targetRootId] ?? 0) + 1
              }
            }
          }
        }
      }
      stack.push(...(elNode.childIds ?? []))
    }
  }

  // 3. Collect models with in-degree === 0
  let zeroInDegreeIds = rootNodes
    .filter((n) => (inDegree[n.id] ?? 0) === 0)
    .map((n) => n.id)

  // Prioritize entrypoint if available
  let primaryRootId: string | undefined
  if (entrypointPath) {
    const normEntry = normalizePathKey(entrypointPath)
    primaryRootId = pathToRootId.get(normEntry)
  }

  if (!primaryRootId && zeroInDegreeIds.length > 0) {
    // Look for workspace*.md by name
    const wsRoot = rootNodes.find((n) => {
      const p = (n.source?.path || n.name).toLowerCase()
      return p.startsWith('workspace')
    })
    primaryRootId = wsRoot?.id ?? zeroInDegreeIds[0]
  }

  if (zeroInDegreeIds.length === 0 && rootNodes.length > 0) {
    // In case of full circular dependency, pick entrypoint or min-degree node
    const minDegreeNode = [...rootNodes].sort(
      (a, b) => (inDegree[a.id] ?? 0) - (inDegree[b.id] ?? 0),
    )[0]
    zeroInDegreeIds = [primaryRootId ?? minDegreeNode.id]
  }

  // Ensure primaryRootId is first in rootIds
  if (primaryRootId && zeroInDegreeIds.includes(primaryRootId)) {
    zeroInDegreeIds = [
      primaryRootId,
      ...zeroInDegreeIds.filter((id) => id !== primaryRootId),
    ]
  }

  return {
    inDegree,
    outDegree,
    edges,
    rootIds: zeroInDegreeIds,
    primaryRootId: primaryRootId ?? zeroInDegreeIds[0],
  }
}
