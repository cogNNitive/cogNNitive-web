import type { Concept, ParsedKnowledge, TaxonomyEdge } from '../types/index.js'
import type { ReferenceDiagnostic } from './references.js'
import { conceptsByElementName, IMPLICIT_REF_FIELDS } from './elementIndex.js'

/**
 * Cross-checks the `# NN index` taxonomy (concept-to-concept nesting) against
 * `reference`-typed element fields (often `parent_component`). When the
 * taxonomy declares concept A as a child of concept B, an element of A whose
 * reference field resolves to an element of some concept C that is neither B
 * nor an ancestor of B is flagged — the element-level relationship
 * contradicts the declared concept-level hierarchy.
 *
 * WARNING only, never ERROR: only fires when BOTH a taxonomy edge exists
 * between the two concepts AND the reference resolves to a real (non-
 * dangling) element, to keep false positives at zero (dangling references
 * are already reported elsewhere).
 */
export function validateTaxonomyHierarchy(
  model: ParsedKnowledge,
  templateConcepts: Concept[],
  templateTaxonomy?: TaxonomyEdge[],
): ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = []
  const effectiveTaxonomy =
    templateTaxonomy && templateTaxonomy.length > 0 ? templateTaxonomy : model.taxonomy

  // child concept (lowercased) -> parent concept name, from index nesting.
  const parentOfConcept = new Map<string, string>()
  for (const edge of effectiveTaxonomy) {
    if (edge.parent) parentOfConcept.set(edge.child.toLowerCase(), edge.parent)
  }
  if (parentOfConcept.size === 0) return diagnostics

  function isConceptAncestor(ancestorLower: string, conceptLower: string): boolean {
    let current = conceptLower
    const seen = new Set<string>()
    while (!seen.has(current)) {
      seen.add(current)
      const parent = parentOfConcept.get(current)
      if (!parent) return false
      const parentLower = parent.toLowerCase()
      if (parentLower === ancestorLower) return true
      current = parentLower
    }
    return false
  }

  const conceptsByElement = conceptsByElementName(model)

  for (const [conceptName, elements] of model.elements.entries()) {
    const taxonomyParent = parentOfConcept.get(conceptName.toLowerCase())
    if (!taxonomyParent) continue

    const conceptDef = templateConcepts.find(
      (c) => c.name.toLowerCase() === conceptName.toLowerCase(),
    )
    const fieldDefs = conceptDef?.fields ?? []

    for (const el of elements) {
      for (const fieldName of Object.keys(el.fields)) {
        const fieldDef = fieldDefs.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())
        const isRef =
          (fieldDef && fieldDef.type === 'reference') || IMPLICIT_REF_FIELDS.has(fieldName.toLowerCase())
        if (!isRef) continue

        const raw = el.fields[fieldName]
        if (raw === undefined || raw === null || raw === '') continue
        const refs = Array.isArray(raw) ? raw.map(String) : [String(raw)]

        for (const ref of refs) {
          let value = ref.trim()
          if (!value) continue
          if (value.startsWith('[[') && value.endsWith(']]')) {
            value = value.slice(2, -2).trim()
          }
          // Skip cross-model references — outside the current model's taxonomy.
          if (value.startsWith('[') && value.includes(']')) continue
          if (value.includes('::')) continue

          const owningConcepts = conceptsByElement.get(value.toLowerCase())
          if (!owningConcepts || owningConcepts.size === 0) continue // dangling — reported elsewhere

          const consistent = [...owningConcepts].some((oc) => {
            const ocLower = oc.toLowerCase()
            return ocLower === taxonomyParent.toLowerCase() || isConceptAncestor(ocLower, taxonomyParent.toLowerCase())
          })

          if (!consistent) {
            diagnostics.push({
              path: `elements.${conceptName}.${el.name}.fields.${fieldDef?.name ?? fieldName}`,
              message: `Hierarchy inconsistency: element "${el.name}" of concept "${conceptName}" (a child of "${taxonomyParent}" per the index taxonomy) references element "${value}" via field "${fieldDef?.name ?? fieldName}", but "${value}" belongs to concept(s) "${[...owningConcepts].join(', ')}" — neither "${taxonomyParent}" nor an ancestor of it.`,
              severity: 'warning',
            })
          }
        }
      }
    }
  }

  return diagnostics
}
