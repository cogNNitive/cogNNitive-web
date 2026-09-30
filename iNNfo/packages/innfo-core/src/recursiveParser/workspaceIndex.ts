import type { BlueprintSchema } from '../schema/index.js'
import { normalizeSeparators } from '../parser/slug.js'
import type { ParseIssue, RecursiveParseResult, BlueprintSchemaResolver } from './types.js'
import { normalizePathKey, stripMdSuffix, basename } from './paths.js'
import { readWorkspaceId } from './workspaceId.js'
import { computeModelDagTopology, type ModelDagTopology } from './topology.js'

export interface WorkspaceIndex {
  /** normalizePathKey(path) -> root node id */
  pathToNodeId: Record<string, string>
  /** lowercased frontmatter `title` -> node id(s). >1 id === title collision (error). */
  titleToNodeIds: Record<string, string[]>
  /** lowercased stripMdSuffix(basename) -> node id(s). Repeats are ambiguity, not error (AD-05). */
  fileNameToNodeIds: Record<string, string[]>
  /** root node id -> resolved template identity from `parent_spec` */
  nodeBlueprint: Record<string, { name: string; url?: string }>
  /** root node id -> (lowercased element name -> owning concept name[]) */
  nodeElementConcepts: Record<string, Record<string, string[]>>
  /** root node id -> composed BlueprintSchema (from KnowledgeNode.templateSchema, or the fallback resolver) */
  nodeSchema: Record<string, BlueprintSchema>
  /** diamond: child node id -> parent ids other than KnowledgeNode.parentId */
  extraParents: Record<string, string[]>
  /** DAG topology across all workspace root models (in-degrees, out-degrees, edges, roots) */
  topology?: ModelDagTopology
  /** paths referenced but never parsed (ParseIssue code MODEL_NOT_FOUND) — lets hosts
   *  distinguish "title unknown" from "file absent from the workspace" */
  missing: string[]
  /** entrypoint frontmatter workspace_id, when present */
  workspaceId?: string
  /** collisions/ambiguities found while indexing; fed to the validator */
  issues: ParseIssue[]
}

/**
 * Derives a pure, standalone view over a `RecursiveParseResult`: title,
 * template, element/concept, schema, and multi-parent lookups needed by
 * cross-model reference validation, manifest reconciliation, and host UIs.
 *
 * Pure and synchronous — performs no I/O and never mutates `result`.
 */
export function buildWorkspaceIndex(
  result: RecursiveParseResult,
  resolveBlueprintSchema?: BlueprintSchemaResolver,
): WorkspaceIndex {
  const pathToNodeId: Record<string, string> = {}
  const titleToNodeIds: Record<string, string[]> = {}
  const fileNameToNodeIds: Record<string, string[]> = {}
  const nodeBlueprint: Record<string, { name: string; url?: string }> = {}
  const nodeElementConcepts: Record<string, Record<string, string[]>> = {}
  const nodeSchema: Record<string, BlueprintSchema> = {}
  const extraParents: Record<string, string[]> = {}
  const issues: ParseIssue[] = []

  const roots = Object.values(result.nodes).filter((n) => n.kind === 'root')

  for (const root of roots) {
    const path = root.source?.path

    if (path) {
      pathToNodeId[normalizePathKey(path)] = root.id
    }

    const title = String(root.fields['title']?.value ?? '')
      .trim()
      .toLowerCase()
    if (title) {
      titleToNodeIds[title] = [...(titleToNodeIds[title] ?? []), root.id]
    }

    if (path) {
      const fileNameKey = stripMdSuffix(basename(path)).toLowerCase()
      fileNameToNodeIds[fileNameKey] = [...(fileNameToNodeIds[fileNameKey] ?? []), root.id]
    }

    const parentSpec = root.fields['parent_spec']?.value as
      { name?: string; url?: string } | undefined
    if (parentSpec?.name) {
      nodeBlueprint[root.id] = { name: parentSpec.name, url: parentSpec.url }
    }

    if (root.templateSchema) {
      nodeSchema[root.id] = root.templateSchema
    } else if (resolveBlueprintSchema) {
      const frontmatter: Record<string, unknown> = {}
      for (const [key, fieldValue] of Object.entries(root.fields)) {
        frontmatter[key] = fieldValue.value
      }
      try {
        const schema = resolveBlueprintSchema({
          path: path ?? '',
          name: root.name,
          content: root.rawContent ?? '',
          frontmatter,
        })
        if (schema) nodeSchema[root.id] = schema
      } catch (err) {
        /* v8 ignore start */
        // swallow deliberately: AD-04 contract — a throwing resolver degrades
        // this node to "no schema", never aborts the parse.
        console.warn(`[workspace-index] Schema resolution degraded for ${root.name}: ${err}`)
        /* v8 ignore stop */
      }
    }

    // nodeElementConcepts: walk descendants of this root, stopping at any
    // node that is itself a document root (diamond/submodel boundary) — its
    // elements belong to its own entry in `roots`, not this one.
    const elementConcepts: Record<string, string[]> = {}
    const stack = [...root.childIds]
    while (stack.length > 0) {
      const id = stack.pop()!
      const node = result.nodes[id]
      if (!node || node.kind === 'root') continue
      if (node.kind === 'element') {
        const key = node.name.toLowerCase()
        const owners = elementConcepts[key] ?? []
        if (!owners.includes(node.type)) owners.push(node.type)
        elementConcepts[key] = owners

        const normalizedKey = normalizeSeparators(key)
        if (normalizedKey !== key) {
          const normalizedOwners = elementConcepts[normalizedKey] ?? []
          if (!normalizedOwners.includes(node.type)) normalizedOwners.push(node.type)
          elementConcepts[normalizedKey] = normalizedOwners
        }
      }
      stack.push(...(node.childIds ?? []))
    }
    if (Object.keys(elementConcepts).length > 0) {
      nodeElementConcepts[root.id] = elementConcepts
    }

    // extraParents (AD-02): derived, never stored on KnowledgeNode.
    for (const childId of root.childIds) {
      const child = result.nodes[childId]
      if (child && child.parentId !== root.id) {
        extraParents[childId] = [...(extraParents[childId] ?? []), root.id]
      }
    }
  }

  // Duplicate-title errors come ONLY from titleToNodeIds (AD-05) — filename
  // repeats across directories are ambiguity at lookup time, not an error.
  for (const [title, ids] of Object.entries(titleToNodeIds)) {
    if (ids.length > 1) {
      const paths = ids.map((id) => result.nodes[id]?.source?.path ?? id)
      issues.push({
        path: '<workspace>',
        message: `Duplicate model title "${title}" in models: ${paths.join(', ')}`,
        severity: 'error',
      })
    }
  }

  const missingSet = new Set<string>()
  for (const issue of result.issues) {
    if (issue.code === 'MODEL_NOT_FOUND') {
      missingSet.add(normalizePathKey(issue.path))
    }
  }

  const topology = result.topology ?? computeModelDagTopology(result.nodes, result.entrypointPath)

  return {
    pathToNodeId,
    titleToNodeIds,
    fileNameToNodeIds,
    nodeBlueprint,
    nodeElementConcepts,
    nodeSchema,
    extraParents,
    topology,
    missing: [...missingSet],
    workspaceId: readWorkspaceId(result),
    issues,
  }
}
