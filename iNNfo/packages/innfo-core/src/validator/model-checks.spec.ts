import { describe, it, expect } from 'vitest'
import { Diagnostics } from '../diagnostics.js'
import { ElementsMap, type ParsedModel } from '../types/index.js'
import { checkFrontmatterInvariants, checkTemplateDocumentation } from './model-checks.js'

function frontmatterModel(fm: Record<string, unknown>): ParsedModel {
  return {
    frontmatter: fm as ParsedModel['frontmatter'],
    taxonomy: [],
    elements: new ElementsMap(),
    matrices: [],
    nodeMarkers: {},
    rawContent: '',
  }
}

const BASE_FM = {
  level: 3,
  parent_spec: { name: 'business_V_0-2-0', url: 'https://example.com/business_NN.md' },
  knowledge_version: 'V_0-1-0',
}

describe('misuse-class stable codes (robustness-coda 1.2)', () => {
  it('L3 schema components carry a stable code and a fix example', () => {
    const d = new Diagnostics()
    checkFrontmatterInvariants(
      frontmatterModel({ ...BASE_FM, matrices: [{ name: 'persons-positions matrix' }] }),
      d,
    )

    expect(d.errors).toHaveLength(1)
    expect(d.errors[0].severity).toBe('error')
    expect(d.errors[0].code).toBe('L3_SCHEMA_COMPONENTS')
    expect(d.errors[0].message).toContain('Move them to the template')
    expect(d.errors[0].promptHint).toContain('parent template')
  })

  it('reserved concept names carry a stable code and a fix example', () => {
    const d = new Diagnostics()
    checkFrontmatterInvariants(
      frontmatterModel({ ...BASE_FM, concepts: [{ name: 'Concepts', type: 'text' }] }),
      d,
    )

    // `concepts` in a level-3 frontmatter is itself a schema component, so both
    // classes fire — and stay distinguished by code.
    const reserved = d.errors.find((e) => e.code === 'RESERVED_CONCEPT_NAME')
    expect(reserved).toBeDefined()
    expect(reserved!.severity).toBe('error')
    expect(reserved!.path).toBe('frontmatter.concepts.Concepts')
    expect(reserved!.message).toContain('Reserved concept name "Concepts"')
    expect(reserved!.promptHint).toContain('Rename')
  })

  it('codes stay stable across runs for the same misuse condition', () => {
    const run = (): string[] => {
      const d = new Diagnostics()
      checkFrontmatterInvariants(
        frontmatterModel({
          ...BASE_FM,
          matrices: [{ name: 'persons-positions matrix' }],
          concepts: [{ name: 'Markers', type: 'list' }],
        }),
        d,
      )
      return d.errors.map((e) => e.code ?? '')
    }

    const first = run()
    const second = run()
    expect(first).toEqual(['L3_SCHEMA_COMPONENTS', 'RESERVED_CONCEPT_NAME'])
    expect(second).toEqual(first)
  })

  it('both classes stay errors and fail validity (triangulation)', () => {
    const d = new Diagnostics()
    checkFrontmatterInvariants(
      frontmatterModel({
        ...BASE_FM,
        markers: [{ name: 'complexity' }],
        concepts: [{ name: 'Elements', type: 'list' }],
      }),
      d,
    )

    expect(d.valid).toBe(false)
    expect(d.errors.every((e) => e.severity === 'error')).toBe(true)
    expect(d.errors.map((e) => e.code).sort()).toEqual(
      ['L3_SCHEMA_COMPONENTS', 'RESERVED_CONCEPT_NAME'].sort(),
    )
  })
})

describe('diagnostic-signal-quality (H8) — aggregate template documentation warnings', () => {
  it('aggregates multiple undocumented concepts into exactly one warning with count and names', () => {
    const d = new Diagnostics()
    const concepts = [
      { name: 'Actor', type: 'list' as const },
      { name: 'Goal', type: 'list' as const },
      { name: 'Process', type: 'list' as const },
    ]
    const templateRaw = '# NN Concept Definition\n## NN Concept Definition: Actor\ntype:: list\n'
    checkTemplateDocumentation(concepts, templateRaw, d)

    expect(d.warnings).toHaveLength(1)
    expect(d.warnings[0].severity).toBe('warning')
    expect(d.warnings[0].message).toContain('3')
    expect(d.warnings[0].message).toContain('Actor')
    expect(d.warnings[0].message).toContain('Goal')
    expect(d.warnings[0].message).toContain('Process')
    expect(d.valid).toBe(true)
  })

  it('reports a single undocumented concept as exactly one warning', () => {
    const d = new Diagnostics()
    const concepts = [{ name: 'Solo', type: 'list' as const }]
    const templateRaw = '# NN Concept Definition\n'
    checkTemplateDocumentation(concepts, templateRaw, d)

    expect(d.warnings).toHaveLength(1)
    expect(d.warnings[0].severity).toBe('warning')
    expect(d.warnings[0].message).toContain('Solo')
    expect(d.valid).toBe(true)
  })

  it('emits no warning when all concepts have complete guidance', () => {
    const d = new Diagnostics()
    const concepts = [{ name: 'Documented', type: 'list' as const }]
    const templateRaw = [
      '# NN Concept Definition',
      '## Documented',
      '### Summary',
      '### Description',
      '### Methodologies',
      '### Prompts',
    ].join('\n')
    checkTemplateDocumentation(concepts, templateRaw, d)

    expect(d.warnings).toHaveLength(0)
    expect(d.valid).toBe(true)
  })
})
