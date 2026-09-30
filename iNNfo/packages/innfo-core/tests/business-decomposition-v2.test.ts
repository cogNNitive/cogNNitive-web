import { describe, it, expect } from 'vitest'
import {
  resolveBlueprintSchema,
  validateBlueprintAgainstMetaschema,
  parseKnowledge,
  validateKnowledge,
} from '../src/index'
import { readSpec, decomposedTemplates, decomposedResolver } from './fixtures/decomposed'

const decomposed = decomposedTemplates()
const BUSINESS_MODEL = decomposed['business-model']
const ANALYSIS = decomposed.analysis
const BUSINESS_V2 = readSpec('bluepriNNts/business/spec_NN.md')
const INNFO_V2 = readSpec('iNNfo_V_0-2-0_NN.md')

const resolver = decomposedResolver()

describe('business-model_V_0-2-0 — composite of organization + projects', () => {
  it('resolves with zero errors', () => {
    const { errors } = resolveBlueprintSchema(BUSINESS_MODEL, resolver)
    expect(errors, JSON.stringify(errors)).toEqual([])
  })

  it('keeps its own concepts and drops the ones that left', () => {
    const { schema } = resolveBlueprintSchema(BUSINESS_MODEL, resolver)
    const names = new Set(schema.concepts.map((c) => c.name))

    for (const kept of ['Team', 'Goals', 'Unfair advantage', 'Misc', 'Procedure']) {
      expect(names.has(kept), `expected concept ${kept}`).toBe(true)
    }
    // Concepts removed by the decomposition. `Analysis` / `Validation` moved to
    // the `analysis` template; the plural human-structure names were renamed to
    // singular and moved to `organization` / `projects`.
    for (const gone of [
      'Analysis',
      'Validation',
      'Persons',
      'Positions',
      'Milestones',
      'Project plan',
    ]) {
      expect(names.has(gone), `concept ${gone} should be gone`).toBe(false)
    }
  })

  it('no longer declares the moved concepts in its own body', () => {
    // Without a resolver, only business-model's own Definitions are seen.
    const { schema } = resolveBlueprintSchema(BUSINESS_MODEL, () => null)
    const own = new Set(schema.concepts.map((c) => c.name))
    for (const moved of [
      'Roles',
      'Functions',
      'Skills',
      'Persons',
      'Positions',
      'Milestones',
      'Phases',
      'Analysis',
      'Validation',
    ]) {
      expect(own.has(moved), `${moved} must not be declared locally`).toBe(false)
    }
    expect(own.has('Team')).toBe(true)
  })

  it("declares the stakeholder-sense role concept as `Stakeholder roles` (renamed to avoid colliding with organization's canonical `Roles`)", () => {
    // Own body only: the renamed concept is local to business-model.
    const { schema: own } = resolveBlueprintSchema(BUSINESS_MODEL, () => null)
    const ownNames = own.concepts.map((c) => c.name)
    expect(ownNames).toContain('Stakeholder roles')
    expect(ownNames).not.toContain('Roles') // the bare name belongs to organization
  })

  it('validates as standalone L2 template without includes', () => {
    const { schema, errors } = resolveBlueprintSchema(BUSINESS_MODEL, () => null)
    expect(errors, JSON.stringify(errors)).toEqual([])
    const names = new Set(schema.concepts.map((c) => c.name))
    expect(names.has('Stakeholder roles')).toBe(true)
    expect(names.has('Business summary')).toBe(true)
    expect(names.has('Value propositions')).toBe(true)
  })

  it('the `Team` it keeps is a text concept (root aggregator replaced)', () => {
    const { schema } = resolveBlueprintSchema(BUSINESS_MODEL, resolver)
    const team = schema.concepts.find((c) => c.name === 'Team')!
    expect(team.type).toBe('text')
  })

  it('validates green against the iNNfo_V_0-2-0 metaschema', () => {
    const errors = validateBlueprintAgainstMetaschema(BUSINESS_MODEL, INNFO_V2).filter(
      (d) => d.severity === 'error',
    )
    expect(errors, JSON.stringify(errors)).toEqual([])
  })
})

describe('analysis_V_0-1-0 — standalone strategic-review template', () => {
  it('resolves standalone with zero errors and the review concepts', () => {
    const { schema, errors } = resolveBlueprintSchema(ANALYSIS, () => null)
    expect(errors).toEqual([])
    const names = schema.concepts.map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining(['Analysis', 'Validation', 'Experiments', 'Assumptions', 'Risks']),
    )
  })

  it('declares all five business markers', () => {
    const { schema } = resolveBlueprintSchema(ANALYSIS, () => null)
    expect(schema.markers.map((m) => m.name).sort()).toEqual([
      'certainty',
      'completion',
      'importance',
      'priority',
      'rating',
    ])
  })

  it('validates green against the iNNfo_V_0-2-0 metaschema', () => {
    const errors = validateBlueprintAgainstMetaschema(ANALYSIS, INNFO_V2).filter(
      (d) => d.severity === 'error',
    )
    expect(errors, JSON.stringify(errors)).toEqual([])
  })
})

describe('analysis_V_0-2-0 — sample model validates', () => {
  it('the Ghostbusters analysis sample has no "not defined in template" errors', () => {
    const modelContent = readSpec(
      'bluepriNNts/analysis/samples/Ghostbusters_V_0-2-0_analysis_NN.md',
    )
    const model = parseKnowledge(modelContent)
    const template = {
      name: 'analysis_V_0-2-0',
      level: 2 as const,
      frontmatter: parseKnowledge(ANALYSIS).frontmatter,
      rawContent: ANALYSIS,
    }
    const result = validateKnowledge(model, template, null)
    const undef = result.errors.filter((e) => /is not defined in template/.test(e.message))
    expect(undef, JSON.stringify(undef)).toEqual([])
  })
})

describe('business_V_0-2-0 — umbrella composite (D1 marker dedup)', () => {
  it('resolves with ZERO errors — the 5 shared markers merge, no collision', () => {
    const { errors } = resolveBlueprintSchema(BUSINESS_V2, resolver)
    expect(errors, JSON.stringify(errors)).toEqual([])
  })

  it('keeps exactly one entry per shared marker', () => {
    const { schema } = resolveBlueprintSchema(BUSINESS_V2, resolver)
    for (const shared of ['importance', 'completion', 'certainty', 'priority', 'rating']) {
      const hits = schema.markers.filter((m) => m.name === shared)
      expect(hits.length, `${shared} should appear once, got ${hits.length}`).toBe(1)
    }
    // and the per-template markers survive
    expect(schema.markers.map((m) => m.name)).toEqual(
      expect.arrayContaining(['complexity', 'health']),
    )
  })

  it('unions concepts from all five templates', () => {
    const { schema } = resolveBlueprintSchema(BUSINESS_V2, resolver)
    const names = new Set(schema.concepts.map((c) => c.name))
    for (const n of [
      'Business summary',
      'Team',
      'Procedure', // business-model
      'Analysis',
      'Validation', // analysis
      'Organization',
      'Person',
      'Skills', // organization
      'Project',
      'Phases',
      'Project roles', // projects
      'Metrics', // metrics
    ]) {
      expect(names.has(n), `expected umbrella concept ${n}`).toBe(true)
    }
  })

  it('deduplicates taxonomy edges across included templates and host index', () => {
    const { schema } = resolveBlueprintSchema(BUSINESS_V2, resolver)
    const roots = schema.taxonomy.filter((e) => e.parent === '').map((e) => e.child)
    const uniqueRoots = new Set(roots)
    expect(roots.length).toBe(uniqueRoots.size)
    expect(roots.filter((r) => r === 'Organization')).toHaveLength(1)
    expect(roots.filter((r) => r === 'Project')).toHaveLength(1)
    expect(roots.filter((r) => r === 'Business summary')).toHaveLength(1)

    // Roles should be placed under Organization, not at root
    expect(roots).not.toContain('Roles')
    const rolesEdge = schema.taxonomy.find((e) => e.child === 'Roles')
    expect(rolesEdge?.parent).toBe('Organization')

    // Team children should be preserved from business-model template
    expect(schema.taxonomy.find((e) => e.child === 'Contributions')?.parent).toBe('Team')
    expect(schema.taxonomy.find((e) => e.child === 'Compensations')?.parent).toBe('Team')
  })

  it('validates green against the iNNfo_V_0-2-0 metaschema', () => {
    const errors = validateBlueprintAgainstMetaschema(BUSINESS_V2, INNFO_V2).filter(
      (d) => d.severity === 'error',
    )
    expect(errors, JSON.stringify(errors)).toEqual([])
  })
})

describe('business_V_0-2-0 — collision is still an ERROR (REQ-B4)', () => {
  it('a divergent same-named Definition across sources fails composition, naming both', () => {
    const divergentAnalysis = ANALYSIS.replace('symbol:: *', 'symbol:: @')
    const clashResolver = (ref: { name: string }): string | null => {
      if (ref.name.toLowerCase() === 'analysis') return divergentAnalysis
      return resolver(ref)
    }
    const { errors } = resolveBlueprintSchema(BUSINESS_V2, clashResolver)
    const collision = errors.find((e) => e.message.includes('importance'))
    expect(collision?.severity).toBe('error')
    expect(collision?.message).toMatch(/Business Model (Template|App)|Analysis (Template|App)/)
  })
})

describe('Ghostbusters_V_0-2-0 — sample validates against the composed umbrella', () => {
  it('parsing the sample against the resolved umbrella yields no "not defined in template" errors', () => {
    const modelContent = readSpec('bluepriNNts/business/samples/Ghostbusters_V_0-2-0_business_NN.md')
    const model = parseKnowledge(modelContent)
    const template = {
      name: 'business_V_0-2-0',
      level: 2 as const,
      frontmatter: parseKnowledge(BUSINESS_V2).frontmatter,
      rawContent: BUSINESS_V2,
    }
    const result = validateKnowledge(model, template, null, resolver)

    const undefinedConcept = result.errors.filter((e) =>
      /is not defined in template/.test(e.message),
    )
    expect(undefinedConcept, JSON.stringify(undefinedConcept)).toEqual([])

    const composeErrors = result.errors.filter((e) => e.path.startsWith('parent.includes'))
    expect(composeErrors, JSON.stringify(composeErrors)).toEqual([])
  })
})

describe('business_V_0-2-4 — composed umbrella with Metrics-Organizational goals', () => {
  const BUSINESS_V024 = BUSINESS_V2

  it('resolves with ZERO errors — all 5 sub-templates compose without collision', () => {
    const { schema, errors } = resolveBlueprintSchema(BUSINESS_V024, resolver)
    expect(errors, JSON.stringify(errors)).toEqual([])
    const conceptNames = new Set(schema.concepts.map((c) => c.name))
    expect(conceptNames.has('Metrics')).toBe(true)
    expect(conceptNames.has('Organizational goals')).toBe(true)
    expect(conceptNames.has('Business summary')).toBe(true)
    expect(conceptNames.has('Analysis')).toBe(true)
    expect(conceptNames.has('Organization')).toBe(true)
    expect(conceptNames.has('Project')).toBe(true)
  })

  it('Metrics-Organizational goals Matrix resolves its source and target concepts cleanly', () => {
    const { schema, errors } = resolveBlueprintSchema(BUSINESS_V024, resolver)
    expect(errors).toEqual([])
    const mx = schema.matrices.find((m) => m.name === 'Metrics-Organizational goals Matrix')
    expect(mx).toBeDefined()
    expect(mx?.source).toBe('Metrics')
    expect(mx?.target).toBe('Organizational goals')
  })

  it('validates a Level 3 model declaring parent_spec: business_V_0-2-4 cleanly', () => {
    const sampleModel = `---
level: 3
knowledge_version: "V_1-0-0"
title: "ACME Corp"
parent_spec:
  name: "business_V_0-2-4"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/spec_NN.md"
---

# NN Business summary
ACME Corp summary description.

# NN Organizational goals
## NN Organizational goals: Market Leadership
Target expansion across region.

# NN Metrics
## NN Metrics: Monthly Revenue
metricValue:: "$100k"
metricType:: revenue

# NN matrices: metrics-organizational goals matrix
| Metrics \\ Organizational goals | Market Leadership |
| :--- | :---: |
| Monthly Revenue | High |
`
    const parsedModel = parseKnowledge(sampleModel)
    const template = {
      name: 'business_V_0-2-4',
      level: 2 as const,
      frontmatter: parseKnowledge(BUSINESS_V024).frontmatter,
      rawContent: BUSINESS_V024,
    }
    const result = validateKnowledge(parsedModel, template, null, resolver)
    expect(result.errors.filter((e) => e.severity === 'error'), JSON.stringify(result.errors)).toEqual([])
    expect(result.valid).toBe(true)
  })
})
