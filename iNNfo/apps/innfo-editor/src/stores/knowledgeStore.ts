import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { KnowledgeNode, ModelRelationship } from '../model/types'
import type { DirectoryHandleLike } from '../model/fs-types'

import { DEFAULT_INNFO_VERSION, buildSpecificationUrl } from '../utils/constants'

export interface SourceCitation {
  nodeId: string
  nodeName: string
  conceptType: string
  modelPath: string
  headingSlug?: string
  relationships: ModelRelationship[]
}
import { recursiveParse } from '../model/recursiveParser'
import {
  validateFormatContent,
  updateReferenceString,
  buildWorkspaceIndex,
  validateWorkspaceReferences,
} from '@cognnitive/innfo-core'
import type {
  KnowledgeDriver,
  ParseIssue,
  ValidationReport,
  ReferenceDiagnostic,
} from '@cognnitive/innfo-core'
import { resolveParentSpecs, warmTemplateCache } from '../services/SpecResolverService'

import { useUiStore } from './uiStore'

export interface ModelState {
  nodes: Record<string, KnowledgeNode>
  rootIds: string[]
  dirtyIds: Set<string>
  parseIssues: ParseIssue[]
  validationReport: ValidationReport | null
  validationReports: Record<string, ValidationReport>
}

/**
 * knowledgeStore is the single normalized element graph. It replaces the
 * previously planned documentStore + folderStore split: every node,
 * regardless of storageMode, lives in this one graph (R2, R3).
 */
export const useKnowledgeStore = defineStore('model', () => {
  const nodes = ref<Record<string, KnowledgeNode>>({})
  const rootIds = ref<string[]>([])
  const dirtyIds = ref<Set<string>>(new Set<string>())
  const parseIssues = ref<ParseIssue[]>([])
  const validationReport = ref<ValidationReport | null>(null)
  const validationReports = ref<Record<string, ValidationReport>>({})

  // ── Getters ─────────────────────────────────────────────────────────────

  function getNode(id: string): KnowledgeNode | undefined {
    return nodes.value[id]
  }

  function getChildren(id: string): KnowledgeNode[] {
    return (nodes.value[id]?.childIds ?? []).map((cid) => nodes.value[cid]).filter(Boolean)
  }

  function getRoots(): KnowledgeNode[] {
    return rootIds.value
      .filter((id) => !id.startsWith('spec:'))
      .map((id) => nodes.value[id])
      .filter(Boolean)
  }

  /**
   * Aggregates and deduplicates all unique tags across all model nodes (concepts and elements).
   */
  const allTags = computed<string[]>(() => {
    const tagsSet = new Set<string>()
    for (const node of Object.values(nodes.value)) {
      if (node.tags && Array.isArray(node.tags)) {
        for (const tag of node.tags) {
          if (tag) tagsSet.add(tag)
        }
      }
      // Also include concept-level tags if they exist on the root node
      if (node.kind === 'root' && node.conceptTags) {
        for (const tags of Object.values(node.conceptTags)) {
          if (Array.isArray(tags)) {
            for (const tag of tags) {
              if (tag) tagsSet.add(tag)
            }
          }
        }
      }
      // Also include workspace-defined Tag concept elements
      const isTagNode = node.type === 'Tag' || node.conceptBinding?.name === 'Tag'
      if (isTagNode && node.name) {
        tagsSet.add(node.name.trim().toLowerCase())
      }
    }
    return Array.from(tagsSet).sort()
  })

  /**
   * Map of workspace-defined tags (from any Tag concept elements).
   * Keys include both original name and lowercase name.
   */
  const workspaceTagsMap = computed<
    Record<string, { name: string; icon?: string; color?: string; description?: string }>
  >(() => {
    const map: Record<
      string,
      { name: string; icon?: string; color?: string; description?: string }
    > = {}
    for (const node of Object.values(nodes.value)) {
      const isTagNode = node.type === 'Tag' || node.conceptBinding?.name === 'Tag'
      if (isTagNode && node.name) {
        const rawName = node.name.trim()
        const colorVal = (node.fields?.color as any)?.value ?? node.fields?.color
        const iconVal = (node.fields?.icon as any)?.value ?? node.fields?.icon
        const descVal =
          (node.fields?.description as any)?.value ??
          node.fields?.description ??
          node.rawSections?.description
        const entry = {
          name: rawName,
          color: typeof colorVal === 'string' ? colorVal : undefined,
          icon: typeof iconVal === 'string' ? iconVal : undefined,
          description: typeof descVal === 'string' ? descVal : undefined,
        }
        map[rawName] = entry
        map[rawName.toLowerCase()] = entry
      }
    }
    return map
  })

  /**
   * Returns the active model root node id or the first root node id as fallback.
   */
  const activeNodeId = computed<string | null>(() => {
    try {
      const uiStore = useUiStore()
      if (uiStore.activeModelId && nodes.value[uiStore.activeModelId]) {
        return uiStore.activeModelId
      }
    } catch {
      // Fallback if called outside Pinia active context
    }
    return rootIds.value.find((id) => !id.startsWith('spec:')) ?? rootIds.value[0] ?? null
  })

  /**
   * Map of elements grouped by root ID and concept type:
   * rootId -> (conceptType -> KnowledgeNode[])
   */
  const nodesByRootAndType = computed<Map<string, Map<string, KnowledgeNode[]>>>(() => {
    const rootMap = new Map<string, Map<string, KnowledgeNode[]>>()

    function findRoot(id: string): string | null {
      let curr = nodes.value[id]
      if (!curr) return null
      if (curr.kind === 'root' || rootIds.value.includes(curr.id)) return curr.id
      const seen = new Set<string>()
      while (curr && curr.parentId) {
        if (seen.has(curr.id)) break
        seen.add(curr.id)
        const parent = nodes.value[curr.parentId]
        if (!parent) break
        curr = parent
        if (curr.kind === 'root' || rootIds.value.includes(curr.id)) return curr.id
      }
      return curr?.id ?? null
    }

    for (const node of Object.values(nodes.value)) {
      if (node.kind !== 'element' || !node.type) continue
      const rootId = findRoot(node.id)
      if (!rootId) continue

      let typeMap = rootMap.get(rootId)
      if (!typeMap) {
        typeMap = new Map<string, KnowledgeNode[]>()
        rootMap.set(rootId, typeMap)
      }
      let list = typeMap.get(node.type)
      if (!list) {
        list = []
        typeMap.set(node.type, list)
      }
      list.push(node)
    }
    return rootMap
  })

  /**
   * Map of elements indexed by parent field name (for parent-based hierarchies).
   */
  const nodesByParentName = computed<Map<string, KnowledgeNode[]>>(() => {
    const map = new Map<string, KnowledgeNode[]>()
    for (const node of Object.values(nodes.value)) {
      const parentVal = node.fields?.parent?.value
      if (typeof parentVal === 'string' && parentVal.trim()) {
        const key = parentVal.trim()
        let list = map.get(key)
        if (!list) {
          list = []
          map.set(key, list)
        }
        list.push(node)
      }
    }
    return map
  })

  /**
   * Finds all model elements that cite a given source path in their `sources::` field.
   */
  function getSourceCitations(sourcePath: string): SourceCitation[] {
    if (!sourcePath) return []
    const normalizedTarget = sourcePath.replace(/\\/g, '/').toLowerCase()
    const results: SourceCitation[] = []

    for (const node of Object.values(nodes.value)) {
      if (!node.sources || !Array.isArray(node.sources)) continue

      for (const ref of node.sources) {
        const normalizedRef = (ref.filePath ?? '').replace(/\\/g, '/').toLowerCase()
        const isMatch =
          normalizedRef === normalizedTarget ||
          normalizedTarget.endsWith('/' + normalizedRef) ||
          normalizedRef.endsWith('/' + normalizedTarget)

        if (isMatch) {
          results.push({
            nodeId: node.id,
            nodeName: node.name,
            conceptType: node.type,
            modelPath: node.source?.path ?? '',
            headingSlug: ref.slug,
            relationships: node.relationships ?? [],
          })
          break
        }
      }
    }
    return results
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Replaces the whole graph (used by a fresh recursive parse). */
  function setGraph(newNodes: Record<string, KnowledgeNode>, newRootIds: string[]): void {
    nodes.value = newNodes
    rootIds.value = newRootIds
    dirtyIds.value = new Set<string>()
    validateKnowledge()
  }

  /**
   * Rebuilds `validationReport` / `validationReports`.
   *
   * When `scopedRootIds` is omitted, every root is re-validated (used by
   * `setGraph`, a full parse). When it is provided, only THOSE roots are
   * re-run through `validateFormatContent` — the per-root reports for
   * every other root are reused as-is from `validationReports` and
   * only the cheap aggregation into `combinedReport` re-runs over all of
   * them. This keeps a single-model edit (e.g. `renameElementNode`) from
   * re-validating every other model in the workspace on the main thread
   * (F-15).
   */
  function validateKnowledge(scopedRootIds?: string[]): void {
    const nonTemplateRoots = rootIds.value.filter(
      (id) => !id.startsWith('spec:') && nodes.value[id],
    )
    if (nonTemplateRoots.length === 0) {
      validationReport.value = null
      validationReports.value = {}
      return
    }

    const scopedSet = scopedRootIds ? new Set(scopedRootIds) : null
    const reports: Record<string, ValidationReport> = scopedSet
      ? { ...validationReports.value }
      : {}

    for (const rootId of nonTemplateRoots) {
      if (scopedSet && !scopedSet.has(rootId)) continue

      const rootNode = nodes.value[rootId]
      if (!rootNode?.rawContent) {
        delete reports[rootId]
        continue
      }
      const path = rootNode.source?.path ?? ''
      const fileName = path.split('/').pop() || path || 'unknown.md'
      const report = validateFormatContent(rootNode.rawContent, fileName)

      // Merge schema-conformance diagnostics (model vs. its composed template),
      // computed by the spec resolver, as additional checks so one report
      // covers both document hygiene and schema conformance.
      const sv = rootNode.schemaValidation
      if (sv) {
        for (const diag of [...sv.errors, ...sv.warnings]) {
          report.checks.push({
            id: `schema:${diag.path}`,
            label: 'Schema conformance',
            description: 'Model element/property against the resolved template schema',
            category: 'body',
            severity: diag.severity === 'error' ? 'error' : 'warning',
            passed: false,
            message: diag.message,
          })
        }
        report.summary.total += sv.errors.length + sv.warnings.length
        report.summary.errors += sv.errors.length
        report.summary.warnings += sv.warnings.length
      }

      reports[rootId] = report
    }

    // Cheap aggregation over the per-root reports (recomputed or reused) —
    // this loop never re-runs validateFormatContent.
    let combinedReport: ValidationReport | null = null
    for (const rootId of nonTemplateRoots) {
      const report = reports[rootId]
      if (!report) continue
      if (!combinedReport) {
        combinedReport = {
          checks: [...report.checks],
          summary: { ...report.summary },
        }
      } else {
        combinedReport.summary.total += report.summary.total
        combinedReport.summary.passed += report.summary.passed
        combinedReport.summary.errors += report.summary.errors
        combinedReport.summary.warnings += report.summary.warnings
        combinedReport.checks.push(...report.checks)
      }
    }

    validationReport.value = combinedReport
    validationReports.value = reports
  }

  function upsertNode(node: KnowledgeNode): void {
    nodes.value[node.id] = node
  }

  /**
   * Finds the root model ID that owns the given node.
   */
  function getKnowledgeRootForNode(nodeId: string): string | null {
    if (nodeId.startsWith('virtual:')) {
      const parentId = nodeId.split(':')[1]
      return getKnowledgeRootForNode(parentId)
    }
    let curr = nodes.value[nodeId]
    if (!curr) return null
    if (curr.kind === 'root' || rootIds.value.includes(curr.id)) return curr.id
    const seen = new Set<string>()
    while (curr && curr.parentId) {
      if (seen.has(curr.id)) break
      seen.add(curr.id)
      const parent = nodes.value[curr.parentId]
      if (!parent) break
      curr = parent
      if (curr.kind === 'root' || rootIds.value.includes(curr.id)) return curr.id
    }
    return curr?.id ?? null
  }

  function markDirty(id: string): void {
    dirtyIds.value.add(id)
    const rootId = getKnowledgeRootForNode(id)
    if (rootId) {
      dirtyIds.value.add(rootId)
    }
  }

  function clearDirty(id: string): void {
    dirtyIds.value.delete(id)
  }

  function clearParseIssues(): void {
    parseIssues.value = []
  }

  function isDirty(id: string): boolean {
    return dirtyIds.value.has(id)
  }

  function scaffoldSubmodel(options: {
    path: string
    template: string
    templateUrl?: string
    title?: string
    knowledgeVersion?: string
    modelVersion?: string
  }): string {
    const normalizedPath = options.path.replace(/\\/g, '/').trim()
    const id = normalizedPath
    const title =
      options.title || normalizedPath.split('/').pop()?.replace(/\.md$/i, '') || 'New Submodel'
    const version = options.knowledgeVersion || options.modelVersion || 'V_0-1-0'
    const template = options.template || 'base'
    const templateUrl = options.templateUrl || ''
    const specVersion = DEFAULT_INNFO_VERSION
    const specUrl = buildSpecificationUrl(specVersion)
    const conceptName = template.charAt(0).toUpperCase() + template.slice(1)

    const content = [
      '---',
      `spec_version: "${specVersion}"`,
      `spec_url: "${specUrl}"`,
      'level: 3',
      'parent_spec:',
      `  name: "${template}"`,
      `  url: "${templateUrl}"`,
      `knowledge_version: "${version}"`,
      `title: "${title}"`,
      '---',
      '',
      '> [!NOTE]',
      '> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).',
      '',
      '# NN index',
      `* [[${conceptName}]]`,
      '',
      `# NN ${conceptName}`,
      `## NN ${conceptName}: Example`,
      '',
    ].join('\n')

    const newNode: KnowledgeNode = {
      id,
      name: title,
      kind: 'root',
      type: template,
      parentId: null,
      childIds: [],
      fields: {},
      markers: {},
      tags: [],
      relationships: [],
      source: { path: normalizedPath },
      rawContent: content,
      rawSections: {},
    }

    upsertNode(newNode)
    if (!rootIds.value.includes(id)) {
      rootIds.value.push(id)
    }
    markDirty(id)
    return id
  }

  /**
   * Merges workspace-scope cross-model reference diagnostics
   * (`validateWorkspaceReferences`) into the aggregate `validationReport`
   * built by `validateKnowledge()`. Runs after `setGraph` (which rebuilds the
   * report from scratch) so these are never clobbered by the per-file pass.
   */
  function mergeWorkspaceDiagnostics(diagnostics: ReferenceDiagnostic[]): void {
    if (diagnostics.length === 0) return
    if (!validationReport.value) {
      validationReport.value = {
        checks: [],
        summary: { total: 0, passed: 0, errors: 0, warnings: 0 },
      }
    }
    for (const diag of diagnostics) {
      validationReport.value.checks.push({
        id: `workspace-ref:${diag.path}`,
        label: 'Cross-model reference',
        description: 'Qualified cross-model reference checked against the workspace index',
        category: 'body',
        severity: diag.severity,
        passed: false,
        message: diag.message,
      })
      validationReport.value.summary.total += 1
      if (diag.severity === 'error') {
        validationReport.value.summary.errors += 1
      } else {
        validationReport.value.summary.warnings += 1
      }
    }
  }

  /**
   * Populates this store directly from a workspace handle via a
   * recursive parse — no intermediate per-mode store. Real recursive
   * walking/parsing lands in Phase 3 (recursiveParser.ts); this wires
   * the call so workspaceStore.open() has a single integration point.
   */
  async function parseFromHandle(handle: DirectoryHandleLike, driver?: KnowledgeDriver): Promise<void> {
    // C1: warm a synchronously-servable template cache BEFORE the parse so
    // recursiveParse can follow `type:: knowledge` fields (AD-04). A cold/partial
    // cache is not an error — it degrades that node to today's traversal.
    const templateCache = await warmTemplateCache(handle)
    const result = await recursiveParse(handle, driver, {
      resolveBlueprintSchema: ({ frontmatter }) => {
        const name = (frontmatter as { parent_spec?: { name?: string } } | undefined)?.parent_spec
          ?.name
        return name ? (templateCache.get(name.toLowerCase()) ?? null) : null
      },
    })
    await resolveParentSpecs(result.nodes, result.rootIds, handle, result.issues)

    // Cross-model validation (PR5a wiring, checkOne stubbed to [] until
    // PR5b): the workspace index and qualified-ref pass run once per
    // parse, after per-file parsing/spec-resolution settle, so sibling
    // models are visible to `[[Model :: Element]]` lookups. v1 re-runs
    // the whole pass on every save — incremental invalidation is out of
    // scope (design.md Slice 5, "Host wiring").
    const workspaceIndex = buildWorkspaceIndex(result)
    const workspaceDiagnostics = validateWorkspaceReferences(result, workspaceIndex)

    parseIssues.value = [...result.issues, ...workspaceIndex.issues]
    setGraph(result.nodes, result.rootIds)
    mergeWorkspaceDiagnostics(workspaceDiagnostics)
  }

  /**
   * Reorders a child within its parent's childIds array.
   * @param direction 1 = move down, -1 = move up
   */
  function reorderChild(parentId: string, childId: string, direction: 1 | -1): void {
    const parent = nodes.value[parentId]
    if (!parent) return
    const idx = parent.childIds.indexOf(childId)
    if (idx === -1) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= parent.childIds.length) return
    parent.childIds.splice(idx, 1)
    parent.childIds.splice(newIdx, 0, childId)
    markDirty(parentId)
  }

  /**
   * Moves a child within its parent's childIds array to a specific target index.
   */
  function moveChildToIndex(parentId: string, childId: string, targetIdx: number): void {
    const parent = nodes.value[parentId]
    if (!parent) return
    const idx = parent.childIds.indexOf(childId)
    if (idx === -1) return
    if (targetIdx < 0 || targetIdx >= parent.childIds.length) return
    parent.childIds.splice(idx, 1)
    parent.childIds.splice(targetIdx, 0, childId)
    markDirty(parentId)
  }

  /**
   * Creates a new child node under the given parent.
   * @returns the new node's id
   */
  function createChild(
    parentId: string,
    name: string,
    type: string,
    kind?: 'concept' | 'element',
  ): string {
    const parent = nodes.value[parentId]
    if (!parent) throw new Error(`Parent node "${parentId}" not found`)
    const id = `${parentId}/${name}`
    if (nodes.value[id]) throw new Error(`Node "${id}" already exists`)

    nodes.value = {
      ...nodes.value,
      [id]: {
        id,
        name,
        parentId,
        childIds: [],
        type,
        kind: kind ?? 'element',
        fields: {},
        markers: {},
        tags: [],
        relationships: [],
        rawSections: {},
        source: { path: '' },
      },
    }

    parent.childIds = [...parent.childIds, id]
    markDirty(parentId)
    return id
  }

  /**
   * Creates a child element for a concept under the specified (or active) root node.
   * Convenience wrapper used by the ghost "Add first element" action.
   * @returns the new node's id
   */
  function addConceptElement(conceptName: string, elementName: string, targetModelId?: string): string {
    const uiStore = useUiStore()
    const rootId =
      targetModelId ??
      (uiStore.activeModelId && nodes.value[uiStore.activeModelId]
        ? uiStore.activeModelId
        : undefined) ??
      rootIds.value.find((id) => !id.startsWith('spec:')) ??
      rootIds.value[0]
    if (!rootId) throw new Error('No root node — cannot add element')
    return createChild(rootId, elementName, conceptName, 'element')
  }

  /**
   * Creates a text-type section under the specified (or active) root node.
   * For concepts of type `text` (single Markdown block).
   */
  function addTextSection(conceptName: string, targetModelId?: string): void {
    const uiStore = useUiStore()
    const rootId =
      targetModelId ??
      (uiStore.activeModelId && nodes.value[uiStore.activeModelId]
        ? uiStore.activeModelId
        : undefined) ??
      rootIds.value.find((id) => !id.startsWith('spec:')) ??
      rootIds.value[0]
    if (!rootId) throw new Error('No root node — cannot add section')
    const root = nodes.value[rootId]
    if (!root) throw new Error(`Root node "${rootId}" not found`)
    if (!root.rawSections) root.rawSections = {}
    root.rawSections[conceptName] = ''
    markDirty(rootId)
  }

  /**
   * Removes a node and all its descendants from the graph.
   */
  function removeNodeTree(nodeId: string): void {
    const node = nodes.value[nodeId]
    if (!node) return
    // Recursively remove children
    for (const childId of [...node.childIds]) {
      removeNodeTree(childId)
    }
    // Remove from parent
    if (node.parentId) {
      const parent = nodes.value[node.parentId]
      if (parent) {
        parent.childIds = parent.childIds.filter((id) => id !== nodeId)
      }
    }
    delete nodes.value[nodeId]
    dirtyIds.value.add(nodeId)
  }

  /**
   * Renames an element node in the graph and propagates the rename
   * to all referencing fields, wikilinks, and relationships across all nodes.
   */
  function renameElementNode(nodeId: string, newName: string): void {
    const node = nodes.value[nodeId]
    if (!node || !newName || node.name === newName) return

    const oldName = node.name
    const lowerOld = oldName.toLowerCase()
    const lowerNew = newName.toLowerCase()

    // Update target node properties
    node.name = newName
    node.slug = lowerNew.replace(/[^a-z0-9-]/g, '_')

    // Handle ID re-keying if ID is path-based (e.g. parentId/oldName)
    let currentId = nodeId
    if (node.parentId && nodeId === `${node.parentId}/${oldName}`) {
      const newId = `${node.parentId}/${newName}`
      if (!nodes.value[newId]) {
        // Update parent's childIds
        const parent = nodes.value[node.parentId]
        if (parent) {
          parent.childIds = parent.childIds.map((id) => (id === nodeId ? newId : id))
          markDirty(parent.id)
        }

        // Update node's children parentId
        for (const childId of node.childIds) {
          const child = nodes.value[childId]
          if (child) child.parentId = newId
        }

        node.id = newId
        delete nodes.value[nodeId]
        nodes.value[newId] = node
        dirtyIds.value.delete(nodeId)
        dirtyIds.value.add(newId)
        currentId = newId

        const uiStore = useUiStore()
        if (uiStore.selectedNodeId === nodeId) {
          uiStore.selectNode(newId)
        }
      }
    }

    markDirty(currentId)

    // Tracks which root(s) this rename actually touched, so validateKnowledge()
    // below only re-validates them instead of every root in the workspace.
    const affectedRootIds = new Set<string>()
    const trackAffectedRoot = (id: string): void => {
      const rootId = getKnowledgeRootForNode(id)
      if (rootId) affectedRootIds.add(rootId)
    }
    trackAffectedRoot(currentId)

    // Propagate rename across ALL graph nodes
    for (const otherNode of Object.values(nodes.value)) {
      let nodeModified = false

      // 1. Fields
      if (otherNode.fields) {
        for (const [fKey, fVal] of Object.entries(otherNode.fields)) {
          if (fVal && typeof fVal.value === 'string') {
            const updated = updateReferenceString(fVal.value, oldName, newName)
            if (updated !== fVal.value) {
              fVal.value = updated
              nodeModified = true
            }
          } else if (fVal && Array.isArray(fVal.value)) {
            let arrayModified = false
            const updatedArray = fVal.value.map((item) => {
              if (typeof item === 'string') {
                const updated = updateReferenceString(item, oldName, newName)
                if (updated !== item) arrayModified = true
                return updated
              }
              return item
            })
            if (arrayModified) {
              fVal.value = updatedArray
              nodeModified = true
            }
          }
        }
      }

      // 2. rawSections
      if (otherNode.rawSections) {
        for (const [sKey, sVal] of Object.entries(otherNode.rawSections)) {
          if (typeof sVal === 'string') {
            const updated = updateReferenceString(sVal, oldName, newName)
            if (updated !== sVal) {
              otherNode.rawSections[sKey] = updated
              nodeModified = true
            }
          }
        }
      }

      // 3. Relationships array
      if (otherNode.relationships && Array.isArray(otherNode.relationships)) {
        for (const rel of otherNode.relationships) {
          if (rel && typeof rel.targetId === 'string') {
            const parts = rel.targetId.split('/')
            const lastSegment = parts[parts.length - 1] || ''
            if (lastSegment.toLowerCase() === lowerOld) {
              parts[parts.length - 1] = newName
              rel.targetId = parts.join('/')
              nodeModified = true
            }
          }
        }
      }

      if (nodeModified) {
        markDirty(otherNode.id)
        trackAffectedRoot(otherNode.id)
      }
    }

    validateKnowledge(Array.from(affectedRootIds))
  }

  return {
    nodes,
    rootIds,
    dirtyIds,
    parseIssues,
    validationReport,
    validationReports,
    getNode,
    getChildren,
    getRoots,
    allTags,
    workspaceTagsMap,
    activeNodeId,
    nodesByRootAndType,
    nodesByParentName,
    getSourceCitations,
    setGraph,
    validateKnowledge,
    upsertNode,
    getKnowledgeRootForNode,
    markDirty,
    clearDirty,
    clearParseIssues,
    isDirty,
    scaffoldSubmodel,
    mergeWorkspaceDiagnostics,
    parseFromHandle,
    reorderChild,
    moveChildToIndex,
    createChild,
    addConceptElement,
    addTextSection,
    removeNodeTree,
    renameElementNode,
  }
})
