import type { useKnowledgeStore } from '../stores/knowledgeStore'
import type { Author } from '../model/types'

type ModelStore = ReturnType<typeof useKnowledgeStore>

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Edit-attribution commit hook (R16): every widget commit calls this to
 * write `{ value, author, timestamp }` onto the field's `FieldValue` in
 * `knowledgeStore` and marks the owning node dirty (so `recursiveSerialize`
 * picks it up on the next save). Reading/loading a node for display never
 * calls this — only an explicit user (or ai/system) commit does, so
 * editAttribution never advances beyond parse-time state without an edit.
 */
export function commitFieldValue(
  knowledgeStore: ModelStore,
  nodeId: string,
  fieldKey: string,
  value: unknown,
  author: Author,
): void {
  const node = knowledgeStore.getNode(nodeId)
  if (!node) {
    throw new Error(`Cannot commit field "${fieldKey}": node "${nodeId}" not found`)
  }

  node.fields[fieldKey] = {
    value,
    editAttribution: { author, timestamp: nowIso() },
  }
  knowledgeStore.markDirty(nodeId)
}

/**
 * Same as `commitFieldValue` but for a node's `markers` (numeric/string
 * marker values from the item-markers matrix) — markers don't carry
 * per-value edit-attribution in `KnowledgeNode.markers` (it's a plain
 * `Record<string, number | string>`), so this only updates the value and
 * marks the node dirty.
 */
export function commitMarkerValue(
  knowledgeStore: ModelStore,
  nodeId: string,
  markerKey: string,
  value: number | string,
): void {
  const node = knowledgeStore.getNode(nodeId)
  if (!node) {
    throw new Error(`Cannot commit marker "${markerKey}": node "${nodeId}" not found`)
  }
  node.markers[markerKey] = value
  knowledgeStore.markDirty(nodeId)
}
