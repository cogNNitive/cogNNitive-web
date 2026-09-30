import { computed } from 'vue'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { resolveEffectiveMetamodel } from '../model/metamodel'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { MetamodelConcept, KnowledgeNode } from '../model/types'

export interface TreeGroup {
  name: string
  ghost: boolean
  elements: KnowledgeNode[]
  children: TreeGroup[]
}

interface TreeGroupsInput {
  taxonomyRoots: string[]
  taxonomyChildren: Map<string, string[]>
  childrenByType: Map<string, KnowledgeNode[]>
  templateByName: Map<string, MetamodelConcept>
  templateOrder: Map<string, number>
  hasContent: (conceptName: string) => boolean
}

/** Builds the ordered concept tree (taxonomy + template fallback) shared by every tree-view caller. */
export function buildTreeGroups(input: TreeGroupsInput): TreeGroup[] {
  const {
    taxonomyRoots,
    taxonomyChildren,
    childrenByType,
    templateByName,
    templateOrder,
    hasContent,
  } = input
  const seen = new Set<string>()
  const items: TreeGroup[] = []

  function buildTree(name: string): TreeGroup {
    const directElements = childrenByType.get(name) ?? []
    const rawKids = (taxonomyChildren.get(name) ?? []).filter((k) => templateByName.has(k))
    const kids = Array.from(new Set(rawKids))
    const subGroups: TreeGroup[] = []
    for (const k of kids) {
      subGroups.push(buildTree(k))
    }
    subGroups.sort((a, b) => {
      const ta = templateOrder.get(a.name) ?? 99999
      const tb = templateOrder.get(b.name) ?? 99999
      if (ta !== tb) return ta - tb
      return a.name.localeCompare(b.name)
    })

    const isPresent = hasContent(name) || subGroups.some((s) => !s.ghost)

    return {
      name,
      ghost: !isPresent,
      elements: directElements,
      children: subGroups,
    }
  }

  function markSeenRecursively(name: string): void {
    if (seen.has(name)) return
    seen.add(name)
    const kids = taxonomyChildren.get(name) ?? []
    for (const k of kids) markSeenRecursively(k)
  }

  for (const root of taxonomyRoots) {
    if (seen.has(root)) continue
    const isTemplateConcept = templateByName.has(root)
    if (isTemplateConcept) {
      items.push(buildTree(root))
    }
    markSeenRecursively(root)
  }

  for (const [cname] of templateByName) {
    if (!seen.has(cname)) {
      seen.add(cname)
      items.push({
        name: cname,
        ghost: !hasContent(cname),
        elements: childrenByType.get(cname) ?? [],
        children: [],
      })
    }
  }

  const orderedTaxonomyRoots = new Map(taxonomyRoots.map((r, i) => [r, i]))
  items.sort((a, b) => {
    const ta = templateOrder.get(a.name) ?? 99999
    const tb = templateOrder.get(b.name) ?? 99999
    if (ta !== tb) return ta - tb
    const ia = orderedTaxonomyRoots.get(a.name) ?? 99999
    const ib = orderedTaxonomyRoots.get(b.name) ?? 99999
    return ia - ib
  })

  return items.map(compactTreeGroup)
}

/**
 * Recursively compacts unary chains in tree groups (like VS Code explorer.compactFolders).
 * When a group has no direct elements and exactly one child group, they are merged
 * into a single group with a path-like name: "Parent / Child".
 */
export function compactTreeGroup(group: TreeGroup): TreeGroup {
  const compactedChildren = group.children.map(compactTreeGroup)
  if (group.elements.length === 0 && compactedChildren.length === 1) {
    const onlyChild = compactedChildren[0]
    return {
      name: `${group.name} / ${onlyChild.name}`,
      ghost: onlyChild.ghost,
      elements: onlyChild.elements,
      children: onlyChild.children,
    }
  }
  return {
    ...group,
    children: compactedChildren,
  }
}

export function useKnowledgeConcepts() {
  const knowledgeStore = useKnowledgeStore()

  function getConceptsForModel(rootId: string): TreeGroup[] {
    const rootNode = knowledgeStore.getNode(rootId)
    if (!rootNode) return []

    const modelPath = rootNode.source?.path
    const childIdOrder = new Map((rootNode.childIds ?? []).map((id, i) => [id, i]))

    // Fast path: use indexed lookup from knowledgeStore
    const indexedByType = knowledgeStore.nodesByRootAndType.get(rootId)
    const childrenByType = new Map<string, KnowledgeNode[]>()

    if (indexedByType) {
      for (const [type, list] of indexedByType.entries()) {
        childrenByType.set(type, [...list])
      }
    } else {
      for (const node of Object.values(knowledgeStore.nodes)) {
        if (node.type && node.kind === 'element') {
          const nodeRootId = knowledgeStore.getKnowledgeRootForNode(node.id)
          const belongsToModel = nodeRootId
            ? nodeRootId === rootId
            : !modelPath || node.source?.path === modelPath
          if (belongsToModel) {
            const list = childrenByType.get(node.type)
            if (list) list.push(node)
            else childrenByType.set(node.type, [node])
          }
        }
      }
    }

    for (const list of childrenByType.values()) {
      list.sort((a, b) => {
        const ia = childIdOrder.get(a.id) ?? 99999
        const ib = childIdOrder.get(b.id) ?? 99999
        return ia - ib
      })
    }

    let modelConcepts: MetamodelConcept[] = []
    let taxonomyEdges: Array<{ parent: string; child: string }> = []
    if (rootNode.rawContent) {
      try {
        const fm = parseFrontmatter(rootNode.rawContent)
        const parentName = fm?.parent_spec?.name
        if (parentName) {
          const normalizedParent = parentName.replace(/_NN$/, '')
          const specNode = Object.values(knowledgeStore.nodes).find((n) => {
            if (!n.localMetamodel?.concepts?.length) return false
            const nameCandidate = (n.name || n.id).replace(/_NN$/, '').replace(/^spec:/, '')
            return nameCandidate === normalizedParent
          })
          if (specNode?.localMetamodel?.concepts) {
            modelConcepts = specNode.localMetamodel.concepts
            taxonomyEdges = specNode.localMetamodel?.taxonomy ?? []
          }
        }
      } catch {
        // fallback
      }
    }

    if (modelConcepts.length === 0 || taxonomyEdges.length === 0) {
      const effective = resolveEffectiveMetamodel(rootId, knowledgeStore.nodes, [rootId])
      if (modelConcepts.length === 0) {
        modelConcepts = effective.concepts
      }
      if (taxonomyEdges.length === 0) {
        taxonomyEdges = effective.taxonomy ?? []
      }
    }

    if (modelConcepts.length === 0) {
      modelConcepts = Array.from(childrenByType.keys()).map((type) => ({
        name: type,
        type: 'concept',
        icon: 'file-text',
        color: 'slate',
      }))
    }

    function hasContent(conceptName: string): boolean {
      if ((childrenByType.get(conceptName)?.length ?? 0) > 0) return true
      if (
        rootNode &&
        rootNode.rawSections &&
        Object.keys(rootNode.rawSections).some((k) => k.toLowerCase() === conceptName.toLowerCase())
      ) {
        return true
      }
      return false
    }

    const taxonomyChildren = new Map<string, string[]>()
    for (const e of taxonomyEdges) {
      const list = taxonomyChildren.get(e.parent) ?? []
      if (!list.includes(e.child)) {
        list.push(e.child)
        taxonomyChildren.set(e.parent, list)
      }
    }

    const taxonomyRoots = taxonomyChildren.get('') ?? []
    const templateByName = new Map(modelConcepts.map((c) => [c.name, c]))
    const templateOrder = new Map(modelConcepts.map((c, i) => [c.name, i]))

    const items = buildTreeGroups({
      taxonomyRoots,
      taxonomyChildren,
      childrenByType,
      templateByName,
      templateOrder,
      hasContent,
    })

    const isWorkspace =
      rootNode.id.toLowerCase().includes('workspace') ||
      (rootNode.name || '').toLowerCase().includes('workspace') ||
      (rootNode.source?.path || '').toLowerCase().includes('workspace')

    const filteredItems = items.filter((item) => {
      if (isWorkspace && item.name.toLowerCase() === 'workspace' && item.elements.length === 0) {
        return false
      }
      return true
    })

    return filteredItems
  }

  const conceptsByRoot = computed(() => {
    const map = new Map<string, TreeGroup[]>()
    for (const rid of knowledgeStore.rootIds) {
      map.set(rid, getConceptsForModel(rid))
    }
    return map
  })

  const activeConceptsByRoot = computed(() => {
    const map = new Map<string, TreeGroup[]>()
    for (const [rid, list] of conceptsByRoot.value.entries()) {
      map.set(
        rid,
        list.filter(
          (item) => !item.ghost && (item.elements.length > 0 || item.children.some((c) => !c.ghost)),
        ),
      )
    }
    return map
  })

  const emptyConceptsByRoot = computed(() => {
    const map = new Map<string, TreeGroup[]>()
    for (const [rid, list] of conceptsByRoot.value.entries()) {
      map.set(
        rid,
        list.filter(
          (item) =>
            item.ghost ||
            (item.elements.length === 0 && (!item.children || item.children.every((c) => c.ghost))),
        ),
      )
    }
    return map
  })

  function getActiveConceptsForModel(rootId: string): TreeGroup[] {
    const fromMap = activeConceptsByRoot.value.get(rootId)
    if (fromMap) return fromMap
    const all = getConceptsForModel(rootId)
    return all.filter(
      (item) => !item.ghost && (item.elements.length > 0 || item.children.some((c) => !c.ghost)),
    )
  }

  function getEmptyConceptsForModel(rootId: string): TreeGroup[] {
    const fromMap = emptyConceptsByRoot.value.get(rootId)
    if (fromMap) return fromMap
    const all = getConceptsForModel(rootId)
    return all.filter(
      (item) =>
        item.ghost ||
        (item.elements.length === 0 && (!item.children || item.children.every((c) => c.ghost))),
    )
  }

  return {
    getConceptsForModel,
    getActiveConceptsForModel,
    getEmptyConceptsForModel,
    activeConceptsByRoot,
    emptyConceptsByRoot,
    conceptsByRoot,
  }
}
