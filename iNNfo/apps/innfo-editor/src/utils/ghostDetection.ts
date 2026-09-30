import type { KnowledgeNode } from '../model/types'

/**
 * Checks whether a template-declared concept has been instantiated in the
 * model graph. Each concept type uses a different detection strategy:
 *
 * - `text`:      present if any root node's `rawSections` has a matching key
 * - `list`:      present if any node in the graph has a matching `type`
 * - `category`:  present if any node has a matching `type` AND has children
 * - `weight`,
 *   `steps`,
 *   `sequence`:  present if any node in the graph has a matching `type`
 *
 * Returns `false` when the model graph is empty (no roots).
 */
export function isConceptPresent(
  conceptName: string,
  conceptType: string,
  nodes: Record<string, KnowledgeNode>,
  rootIds: string[],
): boolean {
  const lowerName = conceptName.toLowerCase()

  if (rootIds.length === 0) return false

  if (conceptType === 'text') {
    // Text concepts are present via rawSections on root nodes
    for (const rootId of rootIds) {
      const root = nodes[rootId]
      if (!root?.rawSections) continue
      const sectionKeys = Object.keys(root.rawSections)
      if (sectionKeys.some((k) => k.toLowerCase() === lowerName)) return true
    }
    // Fallback: also check element nodes (in case of incorrect * _NN marker usage)
    for (const node of Object.values(nodes)) {
      if (node.type?.toLowerCase() === lowerName) return true
    }
    return false
  }

  if (conceptType === 'category') {
    // Category: present if a node has this type AND has children
    for (const node of Object.values(nodes)) {
      if (node.type?.toLowerCase() === lowerName && node.childIds.length > 0) return true
    }
    return false
  }

  // list, weight, steps, sequence: present if any node has this type
  for (const node of Object.values(nodes)) {
    if (node.type?.toLowerCase() === lowerName) return true
  }
  return false
}
