import type { LocalMetamodel, MetamodelConcept, MetamodelMarker, KnowledgeNode, TaxonomyEdge } from './types/index.js'

/**
 * Builds the ancestor chain for `nodeId`, root-first (e.g. `[Root, Root/A,
 * Root/A/B]`), by walking `parentId` links in the graph. This mirrors
 * `innfo-core`'s `resolveParentChain` inherit/override walk, generalized
 * from the level-based spec chain (defiNNe -> FORMAT -> template ->
 * instance) to node-nesting (root node -> ... -> target node) — see
 * design.md "Metamodel resolution" decision. `resolveParentChain` itself
 * is not reused directly: it is fs+network based (`node:fs/promises`,
 * `fetch`) and is excluded from format-core's `browser` build condition
 * that this in-browser app resolves against (see recursiveParser.ts note
 * on the same constraint for FS drivers).
 */
function buildAncestorChain(nodeId: string, nodes: Record<string, KnowledgeNode>): KnowledgeNode[] {
  const chain: KnowledgeNode[] = []
  let current: KnowledgeNode | undefined = nodes[nodeId]
  while (current) {
    chain.unshift(current)
    current = current.parentId ? nodes[current.parentId] : undefined
  }
  return chain
}

/**
 * Resolves a node's effective metamodel by walking root -> node and merging
 * each ancestor's locally-declared `concepts`/`markers` (R9): a name
 * declared closer to the target node overrides the same name declared by
 * an ancestor further up the chain — mirroring `getSpecForLevel`'s
 * closest-wins resolution over the spec chain. Nodes without a local
 * metamodel (nested elements) contribute nothing and are transparent to
 * the walk.
 *
 * `taxonomy` follows a different rule than `concepts`/`markers`: it is a
 * coherent tree, not a bag of independently-keyed items, so it is resolved
 * by wholesale replacement rather than per-edge merge — the closest
 * ancestor with a non-empty taxonomy wins outright, same closest-wins
 * directionality as concepts/markers, just applied to the whole edge list
 * at once instead of per name.
 *
 * Template roots: if `allRootIds` is provided, every root-level node
 * (parentId === null) contributes its local metamodel to the result.
 * This makes template concepts (and, absent a closer taxonomy, template
 * taxonomy) from structural ghost roots available to child models that
 * reference them via parent_spec.
 */
export function resolveEffectiveMetamodel(
  nodeId: string,
  nodes: Record<string, KnowledgeNode>,
  allRootIds?: string[],
): LocalMetamodel {
  const chain = buildAncestorChain(nodeId, nodes)

  const conceptsByName = new Map<string, MetamodelConcept>()
  const markersByName = new Map<string, MetamodelMarker>()
  let taxonomy: TaxonomyEdge[] = []

  // Collect from ancestor chain (node-level inheritance)
  for (const ancestor of chain) {
    const local = ancestor.localMetamodel
    if (!local) continue
    for (const concept of local.concepts) {
      conceptsByName.set(concept.name, concept)
    }
    for (const marker of local.markers) {
      markersByName.set(marker.name, marker)
    }
    if (local.taxonomy && local.taxonomy.length > 0) {
      taxonomy = local.taxonomy
    }
  }

  // Collect from all roots (template structural nodes, sibling roots)
  if (allRootIds) {
    for (const rid of allRootIds) {
      if (rid === nodeId) continue // already in chain
      const root = nodes[rid]
      if (!root || root.parentId !== null) continue
      const local = root.localMetamodel
      if (!local) continue
      for (const concept of local.concepts) {
        if (!conceptsByName.has(concept.name)) {
          conceptsByName.set(concept.name, concept)
        }
      }
      for (const marker of local.markers) {
        if (!markersByName.has(marker.name)) {
          markersByName.set(marker.name, marker)
        }
      }
      if (taxonomy.length === 0 && local.taxonomy && local.taxonomy.length > 0) {
        taxonomy = local.taxonomy
      }
    }
  }

  return {
    concepts: [...conceptsByName.values()],
    markers: [...markersByName.values()],
    taxonomy,
  }
}
