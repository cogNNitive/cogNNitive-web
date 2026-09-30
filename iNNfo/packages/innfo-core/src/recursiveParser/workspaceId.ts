import type { RecursiveParseResult } from './types.js'
import { normalizePathKey } from './paths.js'

/**
 * Reads the optional `workspace_id` frontmatter field from the workspace's
 * resolved entrypoint node.
 *
 * `normalizeSingleKnowledge` already materializes the entrypoint's whole
 * frontmatter onto the root node's `fields` (see `recursiveParser/model.ts`),
 * so no additional parse work is needed here: this finds the root node whose
 * `source.path` normalizes to `result.entrypointPath` and reads
 * `fields['workspace_id'].value` off it.
 *
 * Presence is optional and not validated in v1 (no uniqueness enforcement,
 * no error/warning on absence) — returns `undefined` when there is no
 * resolved entrypoint (root-scan fallback) or the field is absent / not a
 * non-empty string.
 */
export function readWorkspaceId(result: RecursiveParseResult): string | undefined {
  if (!result.entrypointPath) return undefined

  const entrypointKey = normalizePathKey(result.entrypointPath)
  const entrypointNode = Object.values(result.nodes).find((node) => {
    if (node.kind !== 'root') return false
    const nodePath = node.source?.path
    return nodePath !== undefined && normalizePathKey(nodePath) === entrypointKey
  })
  if (!entrypointNode) return undefined

  const value = entrypointNode.fields['workspace_id']?.value
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}
