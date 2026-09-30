import { describe, it, expect } from 'vitest'
import { parseKnowledge } from '../src/parser/index'
import { validateKnowledge } from '../src/validator/knowledge'
import { readSpec, decomposedResolver } from './fixtures/decomposed'

describe('parent spec resolution failure diagnostics', () => {
  const modelContent = [
    '---',
    'spec_version: "V_0-2-0"',
    'level: 3',
    'knowledge_version: "V_0-1-2"',
    'title: "Model With Missing Parent"',
    'parent_spec:',
    '  name: "missing_parent"',
    '  url: "https://example.com/non-existent-spec"',
    '---',
    '',
    '# NN index',
    '* [[ConceptOne]]',
    '',
    '# NN ConceptOne',
    '## NN ConceptOne: ElementA',
    '',
  ].join('\n')

  it('emits [PARENT_RESOLUTION_FAILED] error when parent spec is missing', () => {
    const model = parseKnowledge(modelContent)
    const result = validateKnowledge(model, null, null)

    expect(result.valid).toBe(false)
    const parentError = result.errors.find((e) => e.message.includes('[PARENT_RESOLUTION_FAILED]'))
    expect(parentError).toBeDefined()
    expect(parentError?.severity).toBe('error')
  })

  it('suppresses downstream concept validation warnings when parent resolution fails', () => {
    const model = parseKnowledge(modelContent)
    const result = validateKnowledge(model, null, null)

    // Downstream concept warnings (e.g. "Concept 'X' is undocumented in parent template") must be suppressed
    const conceptWarnings = result.warnings.filter((w) => w.path.startsWith('parent.concepts.'))
    expect(conceptWarnings).toHaveLength(0)
  })

  it('does not emit [PARENT_RESOLUTION_FAILED] when parent template is provided', () => {
    const model = parseKnowledge(modelContent)
    const mockTemplate = {
      name: 'missing_parent',
      level: 2 as const,
      frontmatter: {
        spec_version: 'V_0-2-0',
        level: 2 as const,
        title: 'Mock Parent',
      },
      rawContent: [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 2',
        'title: "Mock Parent"',
        '---',
        '# NN Concept Definition',
        '## NN Concept Definition: ConceptOne',
        'type:: list',
      ].join('\n'),
    }

    const result = validateKnowledge(model, mockTemplate, null)
    const parentError = result.errors.find((e) => e.message.includes('[PARENT_RESOLUTION_FAILED]'))
    expect(parentError).toBeUndefined()
  })

  it('validates the official Ghostbusters sample successfully against the updated Business template', () => {
    const modelContent = readSpec('bluepriNNts/business/samples/Ghostbusters_V_0-2-1_business_NN.md')
    const templateContent = readSpec('bluepriNNts/business/spec_NN.md')

    // Canonical `business` composes its schema from the five decomposed templates (shared fixture).
    const resolveInclude = decomposedResolver()

    const model = parseKnowledge(modelContent)
    const mockTemplate = {
      name: 'business_V_0-2-1',
      level: 2 as const,
      frontmatter: model.frontmatter,
      rawContent: templateContent,
    }

    const result = validateKnowledge(model, mockTemplate, null, resolveInclude)
    const undefinedConceptErrors = result.errors.filter((e) => e.message.includes('is not defined in template'))
    expect(undefinedConceptErrors).toEqual([])
  })
})


