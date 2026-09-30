import { watch, onMounted, onUnmounted } from 'vue'
import { useUiStore } from '../stores/uiStore'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { KnowledgeNode } from '../model/types'

/**
 * Synchronises the URL hash (`#conceptName.elementName`, `#nodeName` or
 * `#@conceptName` for virtual concept groups) with
 * `uiStore.selectedNodeId`.
 *
 * - **External hash change** (hashchange event, back/forward nav) → sync from
 *   hash to uiStore, finding the target node by walking the graph.
 * - **Internal navigation** (watch on uiStore.selectedNodeId) → sync from
 *   uiStore to hash using `pushState` so that browser back/forward
 *   navigates through previously selected nodes.
 * - **Guard**: a `updating` flag prevents infinite update loops when the watch
 *   triggers a hash write that in turn fires hashchange.
 */
export function useHashSync(): void {
  const uiStore = useUiStore()
  const knowledgeStore = useKnowledgeStore()

  /** Re-entrancy guard — set to true while an update is in progress. */
  let updating = false

  /** Prefix marker for virtual concept group hashes (`#@ConceptName`). */
  const VIRTUAL_PREFIX = '@'

  // ── Hash → Store ──────────────────────────────────────────────

  function syncHashToStore(): void {
    if (updating) return
    updating = true

    const raw = decodeURIComponent(window.location.hash.replace(/^#/, ''))
    if (!raw) {
      updating = false
      return
    }

    // Parse "#conceptName.elementName" or "#nodeName"
    const parts = raw.split('.')
    const conceptName = parts[0]
    const elementName = parts.length > 1 ? parts[1] : undefined

    // Virtual concept group: "#@ConceptName"
    if (conceptName.startsWith(VIRTUAL_PREFIX)) {
      const groupName = conceptName.slice(VIRTUAL_PREFIX.length)
      const firstElement = findFirstElementOfType(groupName)
      if (firstElement?.parentId) {
        uiStore.selectNode(`virtual:${firstElement.parentId}:${groupName}`)
      } else {
        const rootId = knowledgeStore.rootIds[0]
        if (rootId) uiStore.selectNode(`virtual:${rootId}:${groupName}`)
      }
      updating = false
      return
    }

    for (const nodeId of Object.keys(knowledgeStore.nodes)) {
      const node = knowledgeStore.getNode(nodeId)
      if (!node) continue

      if (elementName) {
        // Full match: conceptName.elementName
        if (node.name === elementName && node.parentId) {
          const parent = knowledgeStore.getNode(node.parentId)
          if (parent?.conceptBinding?.name === conceptName || parent?.name === conceptName) {
            uiStore.selectNode(nodeId)
            break
          }
        }
      } else {
        // Single segment: try concept-binding first, then node name
        if (node.conceptBinding?.name === conceptName || node.name === conceptName) {
          uiStore.selectNode(nodeId)
          break
        }
      }
    }

    updating = false
  }

  /**
   * Finds the first element node of the given concept type in document
   * (breadth-first from roots) order — used to reconstruct a virtual
   * concept group id from its `#@ConceptName` hash.
   */
  function findFirstElementOfType(type: string): KnowledgeNode | undefined {
    const seen = new Set<string>()
    const queue = [...knowledgeStore.rootIds]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const node = knowledgeStore.getNode(id)
      if (!node) continue
      if (node.kind === 'element' && node.type === type) return node
      queue.push(...node.childIds)
    }
    return undefined
  }

  // ── Store → Hash ──────────────────────────────────────────────

  function syncStoreToHash(nodeId: string | null): void {
    if (updating) return
    updating = true

    if (!nodeId) {
      window.history.pushState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
      updating = false
      return
    }

    let hash: string

    // Virtual concept group: `virtual:<parentId>:<conceptName>`
    if (nodeId.startsWith('virtual:')) {
      const parts = nodeId.split(':')
      const conceptName = parts[2] ?? ''
      hash = conceptName ? `${VIRTUAL_PREFIX}${conceptName}` : ''
    } else {
      const node = knowledgeStore.getNode(nodeId)
      if (!node) {
        updating = false
        return
      }

      // Build a meaningful hash from the node's context
      if (node.conceptBinding?.name) {
        hash = node.conceptBinding.name
        if (node.kind === 'element' || node.parentId) {
          hash += `.${node.name}`
        }
      } else if (node.parentId) {
        const parent = knowledgeStore.getNode(node.parentId)
        if (parent?.conceptBinding?.name) {
          hash = `${parent.conceptBinding.name}.${node.name}`
        } else {
          hash = node.name
        }
      } else {
        hash = node.name
      }
    }

    if (!hash) {
      updating = false
      return
    }

    // No-op push guard (E7): if the target hash already equals the current
    // one, pushing again would add a duplicate history entry — a back/forward
    // navigation to the same node would then re-push `#sameHash` in a microtask
    // after `syncHashToStore` cleared `updating`.
    const targetHash = `#${hash}`
    if (window.location.hash === targetHash) {
      updating = false
      return
    }

    window.history.pushState(null, '', targetHash)
    updating = false
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  onMounted(() => {
    window.addEventListener('hashchange', syncHashToStore)

    // Read initial hash on mount for deep-link support
    if (window.location.hash) {
      syncHashToStore()
    }
  })

  onUnmounted(() => {
    window.removeEventListener('hashchange', syncHashToStore)
  })

  // Watch uiStore selection changes → update hash
  watch(
    () => uiStore.selectedNodeId,
    (nodeId) => {
      syncStoreToHash(nodeId)
    },
  )
}
