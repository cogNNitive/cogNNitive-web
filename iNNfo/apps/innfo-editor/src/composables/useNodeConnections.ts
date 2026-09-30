import { computed } from 'vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import { readMatrixDefsField } from './useMatrixDefinitions'
import type { MatrixDecl } from '@cognnitive/innfo-core'
import type { ModelRelationship } from '../model/types'

export type ConnectionOrigin = 'matrix' | 'field' | 'mention'

export interface ResolvedNodeConnection {
  key: string
  sourceId?: string
  targetId?: string
  value?: string | number
  label?: string
  direction: 'outgoing' | 'incoming'
  origin: ConnectionOrigin
  matrixName?: string
}

function normalizeConcept(name: string): string {
  const lower = (name || '').trim().toLowerCase()
  return lower.endsWith('s') ? lower.slice(0, -1) : lower
}

function matchesConcept(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeConcept(a) === normalizeConcept(b)
}

function matchesMatrixName(label: string, matrixName: string): boolean {
  if (!label || !matrixName) return false
  const cleanLabel = normalizeConcept(label.replace(/matrix|matriz/gi, ''))
  const cleanMatrix = normalizeConcept(matrixName.replace(/matrix|matriz/gi, ''))
  return cleanLabel === cleanMatrix || label.toLowerCase().includes(matrixName.toLowerCase()) || matrixName.toLowerCase().includes(label.toLowerCase())
}

function cleanTargetName(idOrName?: string): string {
  if (!idOrName) return ''
  const parts = idOrName.split('/')
  return parts[parts.length - 1] || idOrName
}

export function useNodeConnections(options: {
  rootNodeId: string
  nodeConcept: string
  nodeId?: string
  isConcept?: boolean
  relationships?: ModelRelationship[]
}) {
  const knowledgeStore = useKnowledgeStore()

  const matrixConnections = computed<ResolvedNodeConnection[]>(() => {
    const root = knowledgeStore.getNode(options.rootNodeId)
    if (!root) return []

    const defsField = readMatrixDefsField(root)
    const rawMatrices = defsField.length > 0
      ? defsField
      : root.rawContent
        ? parseFrontmatter(root.rawContent)?.matrices
        : undefined
    const matrices: MatrixDecl[] = Array.isArray(rawMatrices) ? (rawMatrices as MatrixDecl[]) : []
    if (matrices.length === 0) return []

    const node = options.nodeId ? knowledgeStore.getNode(options.nodeId) : undefined
    const items: ResolvedNodeConnection[] = []

    function resolveNodeId(idOrName?: string): string | undefined {
      if (!idOrName) return undefined
      const direct = knowledgeStore.getNode(idOrName)
      if (direct) return direct.id
      const clean = cleanTargetName(idOrName)
      const found = Object.values(knowledgeStore.nodes).find(
        (n) => n.id === idOrName || n.name === idOrName || n.id.endsWith('/' + clean) || cleanTargetName(n.name) === clean,
      )
      return found ? found.id : idOrName
    }

    for (const m of matrices) {
      const isSource = matchesConcept(m.source, options.nodeConcept)
      const isTarget = matchesConcept(m.target, options.nodeConcept)
      if (!isSource && !isTarget) continue

      // Direct model relationships matching this matrix
      const matchingRels = (options.relationships || [])
        .filter((r) => matchesMatrixName(r.label, m.name))
        .map((r) => ({
          key: 'rel-' + r.targetId + '-' + (r.value || ''),
          targetId: isSource ? resolveNodeId(r.targetId) : undefined,
          sourceId: isTarget ? resolveNodeId(r.targetId) : undefined,
          value: r.value,
          label: r.label,
          direction: (isSource ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming',
          origin: 'matrix' as ConnectionOrigin,
          matrixName: m.name,
        }))

      items.push(...matchingRels)

      // Cell entries from root fields
      if (node && root.fields) {
        for (const [key, fv] of Object.entries(root.fields)) {
          const parts = key.split('||')
          if (parts.length >= 3 && parts[0] === m.name) {
            const val = (fv as any)?.value
            if (val !== undefined && val !== null && val !== '' && val !== '-' && val !== false) {
              const rowName = parts[1]
              const colName = parts[2]
              const nodeClean = cleanTargetName(node.name)
              if (isSource && (rowName === node.name || cleanTargetName(rowName) === nodeClean)) {
                items.push({
                  key: 'matrix-' + key,
                  targetId: resolveNodeId(colName),
                  value: val,
                  label: m.label || m.name,
                  direction: 'outgoing',
                  origin: 'matrix',
                  matrixName: m.name,
                })
              } else if (isTarget && (colName === node.name || cleanTargetName(colName) === nodeClean)) {
                items.push({
                  key: 'matrix-' + key,
                  sourceId: resolveNodeId(rowName),
                  value: val,
                  label: m.label || m.name,
                  direction: 'incoming',
                  origin: 'matrix',
                  matrixName: m.name,
                })
              }
            }
          }
        }
      }
    }

    return items
  })

  const fieldConnections = computed<ResolvedNodeConnection[]>(() => {
    if (!options.nodeId) return []
    const currentNode = knowledgeStore.getNode(options.nodeId)
    if (!currentNode) return []

    const items: ResolvedNodeConnection[] = []
    const currentNodeClean = cleanTargetName(currentNode.name)

    // Outgoing field connections from current node fields
    if (currentNode.fields) {
      for (const [fieldName, fv] of Object.entries(currentNode.fields)) {
        const val = typeof fv === 'object' && fv !== null && 'value' in fv ? fv.value : fv
        if (typeof val === 'string' && val.includes('[[')) {
          const matches = val.matchAll(/\[\[(.*?)\]\]/g)
          for (const match of matches) {
            const targetName = match[1]?.trim()
            if (targetName) {
              items.push({
                key: `field-out-${fieldName}-${targetName}`,
                targetId: targetName,
                label: fieldName,
                direction: 'outgoing',
                origin: 'field',
              })
            }
          }
        }
      }
    }

    // Incoming field connections from other nodes pointing to current node
    for (const node of Object.values(knowledgeStore.nodes)) {
      if (node.id === options.nodeId || !node.fields) continue
      for (const [fieldName, fv] of Object.entries(node.fields)) {
        const val = typeof fv === 'object' && fv !== null && 'value' in fv ? fv.value : fv
        if (typeof val === 'string' && val.includes('[[')) {
          const matches = val.matchAll(/\[\[(.*?)\]\]/g)
          for (const match of matches) {
            const refName = match[1]?.trim()
            if (refName && (refName === currentNode.name || cleanTargetName(refName) === currentNodeClean)) {
              items.push({
                key: `field-in-${node.id}-${fieldName}`,
                sourceId: node.id,
                label: fieldName,
                direction: 'incoming',
                origin: 'field',
              })
            }
          }
        }
      }
    }

    return items
  })

  const mentionConnections = computed<ResolvedNodeConnection[]>(() => {
    if (!options.nodeId) return []
    const currentNode = knowledgeStore.getNode(options.nodeId)
    if (!currentNode) return []

    const items: ResolvedNodeConnection[] = []
    const currentNodeClean = cleanTargetName(currentNode.name)

    // Outgoing mentions from current node description / rawContent
    const desc = (currentNode as any)?.description || currentNode.rawContent || ''
    if (typeof desc === 'string' && desc.includes('[[')) {
      const matches = desc.matchAll(/\[\[(.*?)\]\]/g)
      for (const match of matches) {
        const targetName = match[1]?.trim()
        if (targetName) {
          items.push({
            key: `mention-out-${targetName}`,
            targetId: targetName,
            label: 'mentions',
            direction: 'outgoing',
            origin: 'mention',
          })
        }
      }
    }

    // Incoming mentions (backlinks) from other nodes pointing to current node
    for (const node of Object.values(knowledgeStore.nodes)) {
      if (node.id === options.nodeId) continue
      const nodeDesc = (node as any)?.description || node.rawContent || ''
      if (typeof nodeDesc === 'string' && nodeDesc.includes('[[')) {
        const matches = nodeDesc.matchAll(/\[\[(.*?)\]\]/g)
        for (const match of matches) {
          const refName = match[1]?.trim()
          if (refName && (refName === currentNode.name || cleanTargetName(refName) === currentNodeClean)) {
            items.push({
              key: `mention-in-${node.id}`,
              sourceId: node.id,
              label: 'mentioned by',
              direction: 'incoming',
              origin: 'mention',
            })
          }
        }
      }
    }

    return items
  })

  return { matrixConnections, fieldConnections, mentionConnections }
}
