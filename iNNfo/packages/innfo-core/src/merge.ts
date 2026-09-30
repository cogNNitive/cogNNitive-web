import type { ParsedKnowledge, ElementNode, MatrixData } from './types/index.js'
import { ElementsMap } from './types/index.js'

/**
 * Merges an on-disk AST with an in-memory (UI) AST without textual conflicts.
 *
 * Rules:
 * - Concepts: union of concepts from both.
 * - Elements: disk elements preserve authored order. If an element exists in both,
 *   its fields, markers, and tags are merged (memory edits override disk values for the same field).
 *   New elements added only in memory are appended to the concept.
 * - Matrices: cells are combined. Non-empty memory cells take precedence over disk cells.
 * - NodeMarkers: item marker scores are merged.
 * - Level-3 models: taxonomy is cleared to prevent illegal `# NN index` emission.
 */
export function mergeKnowledge(disk: ParsedKnowledge, memory: ParsedKnowledge): ParsedKnowledge {
  // 1. Frontmatter
  const frontmatter = {
    ...disk.frontmatter,
    ...memory.frontmatter,
  }

  // 2. Elements
  const mergedElements = new ElementsMap()
  const allConceptKeys = new Set<string>([
    ...Array.from(disk.elements.keys()),
    ...Array.from(memory.elements.keys()),
  ])

  for (const conceptName of allConceptKeys) {
    const diskList = disk.elements.get(conceptName) ?? []
    const memList = memory.elements.get(conceptName) ?? []

    const memByName = new Map<string, ElementNode>()
    for (const el of memList) {
      memByName.set(el.name.toLowerCase(), el)
    }

    const mergedList: ElementNode[] = []
    const seenMemNames = new Set<string>()

    // Start with disk order
    for (const diskEl of diskList) {
      const lowerName = diskEl.name.toLowerCase()
      const memEl = memByName.get(lowerName)
      if (memEl) {
        seenMemNames.add(lowerName)
        // Merge element
        const mergedFields = { ...diskEl.fields, ...memEl.fields }
        const mergedRawFields = { ...(diskEl.rawFields ?? {}), ...(memEl.rawFields ?? {}) }
        const mergedMarkers = { ...diskEl.markers, ...memEl.markers }
        const tags = Array.from(new Set([...(diskEl.tags ?? []), ...(memEl.tags ?? [])]))

        mergedList.push({
          type: memEl.type || diskEl.type,
          name: memEl.name || diskEl.name,
          description: memEl.description?.trim() ? memEl.description : diskEl.description,
          fields: mergedFields,
          markers: mergedMarkers,
          tags: tags.length > 0 ? tags : undefined,
          slug: memEl.slug ?? diskEl.slug,
          slugExplicit: memEl.slugExplicit ?? diskEl.slugExplicit,
          rawFields: Object.keys(mergedRawFields).length > 0 ? mergedRawFields : undefined,
          trailingBlankLine: memEl.trailingBlankLine ?? diskEl.trailingBlankLine,
          descriptionBlankLine: memEl.descriptionBlankLine ?? diskEl.descriptionBlankLine,
        })
      } else {
        // Disk element not in memory (e.g. added by agent)
        mergedList.push(structuredClone(diskEl))
      }
    }

    // Add memory elements that were not on disk (e.g. added by UI user)
    for (const memEl of memList) {
      const lowerName = memEl.name.toLowerCase()
      if (!seenMemNames.has(lowerName)) {
        mergedList.push(structuredClone(memEl))
      }
    }

    if (mergedList.length > 0) {
      mergedElements.set(conceptName, mergedList)
    }
  }

  // 3. Matrices
  const diskMatrices = disk.matrices ?? []
  const memMatrices = memory.matrices ?? []
  const matrixNames = new Set<string>([
    ...diskMatrices.map((m) => m.name.toLowerCase()),
    ...memMatrices.map((m) => m.name.toLowerCase()),
  ])

  const mergedMatrices: MatrixData[] = []
  for (const nameLower of matrixNames) {
    const diskM = diskMatrices.find((m) => m.name.toLowerCase() === nameLower)
    const memM = memMatrices.find((m) => m.name.toLowerCase() === nameLower)

    if (diskM && !memM) {
      mergedMatrices.push(structuredClone(diskM))
    } else if (!diskM && memM) {
      mergedMatrices.push(structuredClone(memM))
    } else if (diskM && memM) {
      const cellMap = new Map<string, string>()
      // Seed with disk cells
      for (const c of diskM.cells) {
        cellMap.set(`${c.row}||${c.col}`, c.value)
      }
      // Overlay memory cells (if value is not empty or if explicitly set)
      for (const c of memM.cells) {
        const key = `${c.row}||${c.col}`
        if (c.value !== '-' && c.value !== '') {
          cellMap.set(key, c.value)
        } else if (!cellMap.has(key)) {
          cellMap.set(key, c.value)
        }
      }

      const mergedCells = Array.from(cellMap.entries()).map(([k, val]) => {
        const [row, col] = k.split('||')
        return { row, col, value: val }
      })

      mergedMatrices.push({
        name: memM.name || diskM.name,
        source: memM.source || diskM.source,
        target: memM.target || diskM.target,
        cells: mergedCells,
      })
    }
  }

  // 4. Node markers (item-markers matrix)
  const mergedNodeMarkers: Record<string, Record<string, number | string>> = {}
  const allItemKeys = new Set<string>([
    ...Object.keys(disk.nodeMarkers ?? {}),
    ...Object.keys(memory.nodeMarkers ?? {}),
  ])
  for (const item of allItemKeys) {
    mergedNodeMarkers[item] = {
      ...(disk.nodeMarkers?.[item] ?? {}),
      ...(memory.nodeMarkers?.[item] ?? {}),
    }
  }

  const mergedMarkerColumns = Array.from(
    new Set([...(disk.nodeMarkerColumns ?? []), ...(memory.nodeMarkerColumns ?? [])]),
  )

  // 5. Taxonomy (only for non-Level 3)
  const isLevel3 = frontmatter.level === 3
  const taxonomy = isLevel3
    ? []
    : Array.from(
        new Map(
          [...(disk.taxonomy ?? []), ...(memory.taxonomy ?? [])].map((edge) => [
            `${edge.parent}->${edge.child}`,
            edge,
          ]),
        ).values(),
      )

  // 6. Section order & raw sections
  const sectionOrder = Array.from(
    new Set([...(disk.sectionOrder ?? []), ...(memory.sectionOrder ?? [])]),
  )

  const rawSections = {
    ...(disk.rawSections ?? {}),
    ...(memory.rawSections ?? {}),
  }

  const conceptTags = {
    ...(disk.conceptTags ?? {}),
    ...(memory.conceptTags ?? {}),
  }

  return {
    frontmatter,
    elements: mergedElements,
    matrices: mergedMatrices,
    nodeMarkers: mergedNodeMarkers,
    nodeMarkerColumns: mergedMarkerColumns,
    taxonomy,
    sectionOrder,
    rawSections: Object.keys(rawSections).length > 0 ? rawSections : undefined,
    conceptTags: Object.keys(conceptTags).length > 0 ? conceptTags : undefined,
    rawContent: disk.rawContent ?? memory.rawContent ?? '',
  }
}
