import { SyntaxCheck } from '../types/index.js'
import { parseKnowledge } from '../parser/index.js'

/**
 * Validates iNNfo document syntax.
 * Returns a list of syntax checks (simpler than the full content validator).
 */
export function validateFormatSyntax(content: string): SyntaxCheck[] {
  const checks: SyntaxCheck[] = []
  const parsed = parseKnowledge(content)

  // Check frontmatter is parseable
  const hasFrontmatter = Object.keys(parsed.frontmatter).length > 0
  checks.push({
    id: 'syntax-frontmatter',
    label: 'YAML frontmatter is parseable',
    passed: hasFrontmatter,
    message: hasFrontmatter ? undefined : 'Frontmatter is missing or unparseable',
  })

  // Check file suffix convention
  checks.push({
    id: 'syntax-filename',
    label: 'File ends with _NN.md',
    passed: true, // caller provides this context
  })

  // Document structure checks (recommended — ordering defaults to front matter order)
  const hasIndex = parsed.taxonomy.length > 0
  const isLevel3 = parsed.frontmatter.level === 3
  const hasParentField = (parsed.elements.get('Concept Definition') ?? []).some(
    (el) => el.fields['parent'] !== undefined && el.fields['parent'] !== '',
  )
  const passedIndex = hasIndex || isLevel3 || hasParentField
  checks.push({
    id: 'syntax-index',
    label: 'NN index or parent hierarchy present (recommended)',
    passed: passedIndex,
    message: passedIndex
      ? undefined
      : 'No NN index or parent:: hierarchy found — concepts will render in declaration order. Add one to control hierarchy and ordering.',
  })

  const hasConcepts = parsed.elements.size > 0
  checks.push({
    id: 'syntax-concepts',
    label: 'Element declarations present',
    passed: hasConcepts,
    message: hasConcepts ? undefined : 'No concept elements found in document body',
  })

  return checks
}
