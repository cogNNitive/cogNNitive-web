import type { ElementNode, ParsedKnowledge, RelationshipOrigin } from '../types/index.js'
import { extractBlueprintSchema } from '../schema/index.js'
import type { ParseContext } from './types.js'

export const WIKILINK_RE = /\[\[(.*?)\]\]/g

/**
 * Extracts wikilink targets from a string.
 * Trims whitespace and drops empty targets (R7).
 */
export function extractWikilinkTargets(text: string): string[] {
  if (!text || typeof text !== 'string') return []
  const targets: string[] = []
  const matches = text.matchAll(WIKILINK_RE)
  for (const m of matches) {
    const trimmed = m[1].trim()
    if (trimmed.length > 0) {
      targets.push(trimmed)
    }
  }
  return targets
}

/**
 * Builds a lowercase element name -> qualifiedId index for case-insensitive lookup (R5).
 * Preserves first-registered element when names collide (R11).
 */
export function buildLowerNameIndex(ids: Map<string, string>): Map<string, string> {
  const index = new Map<string, string>()
  for (const [name, qid] of ids.entries()) {
    const lower = name.toLowerCase()
    if (!index.has(lower)) {
      index.set(lower, qid)
    }
  }
  return index
}

/**
 * Attaches field and mention relationships to normalized ModelNodes (R3, R4).
 * Deduplicates exact duplicates within each origin (R8) while preserving parallel origins.
 * Emits non-fatal warnings for dangling targets (R6).
 */
export function addFieldAndMentionEdges(
  parsed: ParsedKnowledge,
  rootId: string,
  sourcePath: string,
  ctx: ParseContext,
  qualifiedIdByElementName: Map<string, string>,
  elements?: ElementNode[],
): void {
  const lowerNameIndex = buildLowerNameIndex(qualifiedIdByElementName)

  // 1. Map concept -> set of field names with type 'reference'
  const referenceFieldsByConcept = new Map<string, Set<string>>()
  try {
    const schema = extractBlueprintSchema(parsed)
    for (const concept of schema.concepts) {
      const refFields = (concept.fields ?? [])
        .filter((f) => f.type === 'reference')
        .map((f) => f.name)
      if (refFields.length > 0) {
        referenceFieldsByConcept.set(concept.name, new Set(refFields))
      }
    }
  } catch (err) {
    /* v8 ignore start */
    // log + continue: schema extraction is a non-fatal enhancement; reference
    // fields degrade to name-based matching when the schema is unavailable.
    console.warn(`[relationships] Schema extraction failed; reference fields degraded: ${err}`)
    /* v8 ignore stop */
  }

  // Per-node dedup tracking (targetId|label|origin|value)
  const dedupByNode = new Map<string, Set<string>>()

  function addEdge(
    sourceNodeId: string,
    targetId: string,
    label: string,
    origin: RelationshipOrigin,
    value?: string | number,
  ): boolean {
    const sourceNode = ctx.nodes[sourceNodeId]
    if (!sourceNode) return false

    let seen = dedupByNode.get(sourceNodeId)
    if (!seen) {
      seen = new Set<string>()
      for (const rel of sourceNode.relationships) {
        seen.add(`${rel.targetId}|${rel.label}|${rel.origin}|${String(rel.value ?? '')}`)
      }
      dedupByNode.set(sourceNodeId, seen)
    }

    const key = `${targetId}|${label}|${origin}|${String(value ?? '')}`
    if (seen.has(key)) return false
    seen.add(key)
    sourceNode.relationships.push({ targetId, label, origin, value })
    return true
  }

  const allElements: ElementNode[] = elements ?? []
  if (!elements) {
    for (const [, elNodes] of parsed.elements.entries()) {
      for (const el of elNodes) {
        allElements.push(el)
      }
    }
  }

  // 2. Field and mention edges for element nodes
  for (const el of allElements) {
    const sourceQid = qualifiedIdByElementName.get(el.name)
    if (!sourceQid || !ctx.nodes[sourceQid]) continue

    // A. Field edges
    const refFields = referenceFieldsByConcept.get(el.type) ?? new Set()
    for (const [fieldName, rawVal] of Object.entries(el.fields)) {
      if (fieldName.toLowerCase() === 'description' || typeof rawVal !== 'string') continue
      const isRefType = refFields.has(fieldName)
      const hasWikilinks = rawVal.includes('[[')

      if (isRefType || hasWikilinks) {
        const targets = extractWikilinkTargets(rawVal)
        if (targets.length > 0) {
          for (const target of targets) {
            const targetQid = lowerNameIndex.get(target.toLowerCase())
            if (targetQid) {
              addEdge(sourceQid, targetQid, fieldName, 'field')
            } else {
              ctx.issues.push({
                path: `${sourcePath}#${el.name}`,
                message: `Reference "${target}" in field "${fieldName}" could not be resolved to any element in the model`,
                severity: 'warning',
              })
            }
          }
        } else if (isRefType) {
          const bare = rawVal.trim()
          if (bare.length > 0) {
            const targetQid = lowerNameIndex.get(bare.toLowerCase())
            if (targetQid) {
              addEdge(sourceQid, targetQid, fieldName, 'field')
            } else {
              ctx.issues.push({
                path: `${sourcePath}#${el.name}`,
                message: `Reference "${bare}" in field "${fieldName}" could not be resolved to any element in the model`,
                severity: 'warning',
              })
            }
          }
        }
      }
    }

    // B. Mention edges in element description (either markdown body el.description or description:: field)
    const desc = [
      el.description,
      typeof el.fields['description'] === 'string' ? el.fields['description'] : '',
      typeof el.fields['Description'] === 'string' ? el.fields['Description'] : '',
    ]
      .filter(Boolean)
      .join('\n')

    if (desc && desc.includes('[[')) {
      const targets = extractWikilinkTargets(desc)
      for (const target of targets) {
        const targetQid = lowerNameIndex.get(target.toLowerCase())
        if (targetQid) {
          addEdge(sourceQid, targetQid, 'mentions', 'mention')
        } else {
          ctx.issues.push({
            path: `${sourcePath}#${el.name}`,
            message: `Mention "${target}" in description could not be resolved to any element in the model`,
            severity: 'warning',
          })
        }
      }
    }
  }

  // 3. Mention edges from root description (parsed.rawSections?.['description'])
  const rootDesc = parsed.rawSections?.['description'] ?? parsed.rawSections?.['Description']
  if (rootDesc && typeof rootDesc === 'string' && rootDesc.includes('[[')) {
    const rootNode = ctx.nodes[rootId]
    if (rootNode) {
      const targets = extractWikilinkTargets(rootDesc)
      for (const target of targets) {
        const targetQid = lowerNameIndex.get(target.toLowerCase())
        if (targetQid) {
          addEdge(rootId, targetQid, 'mentions', 'mention')
        } else {
          ctx.issues.push({
            path: `${sourcePath}#${rootNode.name}`,
            message: `Mention "${target}" in root description could not be resolved to any element in the model`,
            severity: 'warning',
          })
        }
      }
    }
  }
}
