import {
  ParsedKnowledge,
  ElementsMap,
  MatrixData,
  SpecFrontmatter,
  TaxonomyEdge,
} from '../types/index.js'
import { normalizeSource, YAML_BLOCK_RE, parseMarkdownTable } from './markdown.js'
import { parseFrontmatter } from './yaml.js'
import { parseIndexBlock } from './taxonomy.js'
import {
  parseConceptSection,
  parseMatrixSection,
  parseMatrixHeaderAxis,
  getSectionType,
  sectionTitle,
} from './sections.js'
import { slugify } from './slug.js'

/**
 * Derive slugs for all elements that don't have one, and detect collisions.
 * Called after all sections are parsed, once all elements are known.
 * Returns aggregated collisions keyed by slug.
 */
export function deriveElementSlugs(
  elements: ElementsMap,
): Array<{ slug: string; elements: string[]; concept: string }> {
  const usedSlugs = new Map<string, { name: string; concept: string }>()
  const colliding = new Map<string, { elements: Set<string>; concept: string }>()

  for (const [conceptName, elementNodes] of elements.entries()) {
    for (const el of elementNodes) {
      if (el.slug === undefined) {
        const ownerConcept =
          typeof el.fields['concept'] === 'string' && el.fields['concept'].trim() !== ''
            ? el.fields['concept'].trim()
            : undefined
        el.slug = ownerConcept ? slugify(`${ownerConcept}.${el.name}`) : slugify(el.name)
      }
      const existing = usedSlugs.get(el.slug!)
      if (existing) {
        if (!colliding.has(el.slug!)) {
          const set = new Set<string>([existing.name, el.name])
          colliding.set(el.slug!, { elements: set, concept: conceptName })
        } else {
          colliding.get(el.slug!)!.elements.add(el.name)
        }
      } else {
        usedSlugs.set(el.slug!, { name: el.name, concept: conceptName })
      }
    }
  }

  return Array.from(colliding.entries()).map(([slug, info]) => ({
    slug,
    elements: Array.from(info.elements),
    concept: info.concept,
  }))
}

function splitTopLevelSections(text: string): string[] {
  const lines = text.split('\n')
  const sections: string[] = []
  let currentLines: string[] = []
  let inCodeFence = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeFence = !inCodeFence
    }
    if (!inCodeFence && /^#\s/.test(line)) {
      if (currentLines.length > 0) {
        sections.push(currentLines.join('\n'))
        currentLines = []
      }
    }
    currentLines.push(line)
  }
  if (currentLines.length > 0) {
    sections.push(currentLines.join('\n'))
  }
  return sections
}

export function parseKnowledge(content: string): ParsedKnowledge {
  const normalizedContent = normalizeSource(content)
  const parseWarnings: string[] = []
  const frontmatter = parseFrontmatter(normalizedContent, (msg) => parseWarnings.push(msg))
  const elements = new ElementsMap()
  const matrices: MatrixData[] = []
  const nodeMarkers: Record<string, Record<string, number | string>> = {}
  const nodeMarkerColumns: string[] = []
  let taxonomy: TaxonomyEdge[] = []
  const conceptTags: Record<string, string[]> = {}
  const rawConceptTags: Record<string, string> = {}

  // Raw frontmatter + preamble capture, for round-trip fidelity. The
  // constructed emit path in `serializeKnowledge` is an allow-list of known keys
  // plus one hardcoded `> [!NOTE]` banner, so anything else the author wrote
  // there is lost on save unless the original text is carried through.
  const frontmatterMatch = normalizedContent.match(YAML_BLOCK_RE)
  const rawFrontmatter = frontmatterMatch ? frontmatterMatch[0] : undefined
  let rawPreamble: string | undefined
  if (frontmatterMatch) {
    const afterFrontmatter = normalizedContent.slice(frontmatterMatch[0].length)
    const firstSection = afterFrontmatter.search(/^#\s/m)
    const preamble = (
      firstSection === -1 ? afterFrontmatter : afterFrontmatter.slice(0, firstSection)
    ).trim()
    if (preamble) rawPreamble = preamble
  }

  const body = normalizedContent.replace(YAML_BLOCK_RE, '').trim()
  const sections = splitTopLevelSections(body)
  const rawSections: Record<string, string> = {}
  const sectionOrder: string[] = []
  const sectionBlankLine: Record<string, boolean> = {}

  for (const section of sections) {
    const headerMatch = section.match(/^#\s+(.*)$/m)
    if (!headerMatch) continue
    const rawTitle = headerMatch[1].trim()
    const type = getSectionType(rawTitle)
    const name = sectionTitle(rawTitle)
    const bodyContent = section.replace(/^#\s+.*$/m, '').trim()

    // AD-2: record document order of top-level `# NN` sections so
    // `serializeKnowledge` can walk them back in the author's original order,
    // instead of the fixed elements→rawSections→matrices emit order.
    let sectionKey: string | undefined
    if (type === 'index') {
      sectionKey = 'index'
    } else if (type === 'concept') {
      sectionKey = name
    } else if (type === 'matrix') {
      sectionKey = `matrices: ${name}`
    }
    if (sectionKey !== undefined) {
      sectionOrder.push(sectionKey)
      // The corpus is inconsistent about a blank line between a `# NN`
      // heading and the first line of its body — record what this document
      // actually had (`bodyContent` above is already `.trim()`-ed, which is
      // why this reads the untrimmed lines instead).
      const linesAfterHeading = section.split('\n').slice(1)
      sectionBlankLine[sectionKey.toLowerCase()] =
        linesAfterHeading.length > 0 && linesAfterHeading[0].trim() === ''
    }

    if (type === 'index') {
      if (taxonomy.length === 0) {
        taxonomy = parseIndexBlock(bodyContent)
      }
    } else if (type === 'concept') {
      const parsed = parseConceptSection(name, bodyContent)
      if (parsed.elements.length > 0) {
        const existing = elements.get(name)
        if (existing) {
          existing.push(...parsed.elements)
        } else {
          elements.set(name, parsed.elements)
        }
      }
      if (parsed.tags) {
        conceptTags[name] = parsed.tags
        if (parsed.rawTags !== undefined) rawConceptTags[name] = parsed.rawTags
      }
      // Preserve the concept's raw body for round-trip fidelity AND as the
      // concept-level description/content of `text` concepts. Concepts with
      // element markers carry their content in `elements`; element-free
      // concepts (e.g. `text`) keep their free-form Markdown here. Empty
      // sections are skipped so ghost detection still flags no-content
      // concepts.
      if (parsed.elements.length === 0 && bodyContent.trim()) {
        rawSections[name] = bodyContent
      }
    } else if (type === 'matrix') {
      if (name.toLowerCase() === 'item-markers matrix') {
        const rows = parseMarkdownTable(bodyContent)
        for (const row of rows) {
          const keys = Object.keys(row)
          if (keys.length > 0) {
            const itemName = row[keys[0]]
            if (itemName) {
              nodeMarkers[itemName] = {}
              for (let i = 1; i < keys.length; i++) {
                // A column whose every cell is `-` (marker not set) would
                // otherwise leave no trace in `nodeMarkers` at all, and the
                // serializer — which derives its columns from the recorded
                // keys — would silently drop that marker from the table.
                // Record the declared column set separately so an all-empty
                // marker column survives the round-trip.
                if (!nodeMarkerColumns.includes(keys[i])) nodeMarkerColumns.push(keys[i])
                if (row[keys[i]] && row[keys[i]] !== '-') {
                  nodeMarkers[itemName][keys[i]] = isNaN(Number(row[keys[i]]))
                    ? row[keys[i]]
                    : Number(row[keys[i]])
                }
              }
            }
          }
        }
      } else {
        const matrixDecl = frontmatter?.matrices?.find(
          (m) => m.name.toLowerCase() === name.toLowerCase(),
        )
        const cells = parseMatrixSection(bodyContent, name)
        // Requirement 3 / AD-4: the table header itself is the source of
        // truth for axis labels (`| Metrics \ Variables | ... |`); the
        // frontmatter `matrices:` declaration (level-2 template metadata) is
        // only a fallback for a matrix whose header carries no labels.
        const axis = parseMatrixHeaderAxis(bodyContent)
        matrices.push({
          name,
          source: axis?.source || matrixDecl?.source || '',
          target: axis?.target || matrixDecl?.target || '',
          cells,
        })
      }
    }
  }

  // Derive slugs and detect collisions (FR-002)
  const collisions = deriveElementSlugs(elements)
  const slugCollisions =
    collisions.length > 0
      ? collisions.map((c) => ({ slug: c.slug, elements: c.elements, concept: c.concept }))
      : undefined

  // FR-007: Warn about deprecated FOLDER mode. `parseWarnings` also already
  // carries any frontmatter YAML parse error surfaced above.
  if (frontmatter?.mode === 'FOLDER') {
    parseWarnings.push(
      'FOLDER mode is removed in V_0-1-3. Use index.md-based workspace with single-file models.',
    )
  }

  return {
    frontmatter: frontmatter ?? ({} as SpecFrontmatter),
    taxonomy,
    elements,
    matrices,
    nodeMarkers,
    slugCollisions,
    parseWarnings: parseWarnings.length > 0 ? parseWarnings : undefined,
    conceptTags: Object.keys(conceptTags).length > 0 ? conceptTags : undefined,
    rawConceptTags: Object.keys(rawConceptTags).length > 0 ? rawConceptTags : undefined,
    rawSections: Object.keys(rawSections).length > 0 ? rawSections : undefined,
    rawContent: content,
    sectionOrder: sectionOrder.length > 0 ? sectionOrder : undefined,
    sectionBlankLine: Object.keys(sectionBlankLine).length > 0 ? sectionBlankLine : undefined,
    nodeMarkerColumns: nodeMarkerColumns.length > 0 ? nodeMarkerColumns : undefined,
    rawFrontmatter,
    rawPreamble,
  }
}
