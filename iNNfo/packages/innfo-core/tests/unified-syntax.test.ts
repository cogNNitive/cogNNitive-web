import { describe, it, expect } from 'vitest'
import { parseKnowledge, serializeKnowledge } from '../src/parser'
import {
  validateKnowledge,
  validateFormatContent,
  extractBlueprintSchema,
  applyMutation,
  CONCEPT_DEFINITION,
  FIELD_DEFINITION,
  MARKER_DEFINITION,
  MATRIX_DEFINITION,
} from '../src/index'
import type { SpecDocument } from '../src/types'

const miniTemplate = `---
spec_version: "V_0-3-0"
specification_version: "V_0-3-0"
level: 2
parent_spec:
  name: "iNNfo_V_0-3-0"
  url: "https://example.com/iNNfo_V_0-3-0_NN.md"
title: "Mini Template"
relationship_types:
  hierarchy:
    enabled: true
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
---

> [!NOTE]
> This is an **iNNfo document**.

# NN index

* [[Market]]
* [[Stakeholders]]

# NN Concept Definition

## NN Concept Definition: Market
icon:: store
type:: category
color:: blue
weight:: 90

## NN Concept Definition: Stakeholders
icon:: users
type:: weight
color:: blue
weight:: 80

# NN Field Definition

## NN Field Definition: relationship_model
concept:: Stakeholders
type:: string
description:: Strategic relationship model.

## NN Field Definition: status
concept:: Stakeholders
type:: select
options:: [Ideation, MVP, Validation]

# NN Marker Definition

## NN Marker Definition: weight
symbol:: *
color:: blue

# NN Matrix Definition

## NN Matrix Definition: market-stakeholders matrix
source:: Market
target:: Stakeholders
widget:: set
values:: [Max, High, Low]
`

const miniModel = `---
spec_version: "V_0-3-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Mini Model"
parent_spec:
  name: "mini_V_1-0-0"
  url: "https://example.com/mini_V_1-0-0_NN.md"
---

> [!NOTE]
> This is an **iNNfo document**.

# NN index

* [[Market]]
  * [[Stakeholders]]

# NN Market

Market narrative content.

# NN Stakeholders

## NN Stakeholders: Alice
importance:: high
needs:: [speed, accuracy]
count:: 3
active:: true
Alice leads customer relationships.

## NN Stakeholders: Bob
status:: MVP
Bob handles engineering.
`

describe('unified syntax (Metaplantilla Nivel 1)', () => {
  it('parses # NN concept sections and ## NN element headings', () => {
    const model = parseKnowledge(miniModel)
    expect(model.elements.has('Stakeholders')).toBe(true)
    expect(model.elements.has('Market')).toBe(false) // text concept → rawSections
    const stakeholders = model.elements.get('Stakeholders')!
    expect(stakeholders).toHaveLength(2)
    expect(stakeholders[0].name).toBe('Alice')
    expect(stakeholders[0].type).toBe('Stakeholders')
    expect(stakeholders[1].name).toBe('Bob')
  })

  it('parses key:: value properties into typed fields', () => {
    const model = parseKnowledge(miniModel)
    const alice = model.elements.get('Stakeholders')![0]
    expect(alice.fields['importance']).toBe('high')
    expect(alice.fields['needs']).toEqual(['speed', 'accuracy'])
    expect(alice.fields['count']).toBe(3)
    expect(alice.fields['active']).toBe(true)
    expect(alice.description).toContain('Alice leads customer relationships.')
  })

  it('parses taxonomy from # NN index', () => {
    const model = parseKnowledge(miniModel)
    expect(model.taxonomy.length).toBeGreaterThan(0)
    expect(model.taxonomy.some((e) => e.parent === 'Market' && e.child === 'Stakeholders')).toBe(
      true,
    )
    expect(model.taxonomy.map((e) => e.child)).toContain('Stakeholders')
  })

  it('preserves text-concept bodies in rawSections', () => {
    const model = parseKnowledge(miniModel)
    expect(model.rawSections!['Market']).toContain('Market narrative content.')
  })

  it('serializes back to unified syntax and round-trips', () => {
    const model = parseKnowledge(miniModel)
    const serialized = serializeKnowledge(model)

    expect(serialized).toContain('# NN index')
    expect(serialized).toContain('# NN Stakeholders')
    expect(serialized).toContain('## NN Stakeholders: Alice')
    expect(serialized).toContain('importance:: high')
    expect(serialized).toContain('needs:: [speed, accuracy]')
    expect(serialized).toContain('# NN Market')
    expect(serialized).not.toContain('# _NN')
    expect(serialized).not.toContain('* _NN')

    const reparsed = parseKnowledge(serialized)
    expect(reparsed.elements.size).toBe(model.elements.size)
    const alice = reparsed.elements.get('Stakeholders')![0]
    expect(alice.fields['importance']).toBe('high')
    expect(alice.fields['needs']).toEqual(['speed', 'accuracy'])
    expect(alice.fields['count']).toBe(3)
    expect(reparsed.rawSections!['Market']).toContain('Market narrative content.')
  })
})

describe('metaplantilla schema extraction', () => {
  it('extracts concepts from Concept Definition elements', () => {
    const schema = extractBlueprintSchema(parseKnowledge(miniTemplate))
    expect(schema.concepts.map((c) => c.name)).toEqual(['Market', 'Stakeholders'])
    const market = schema.concepts.find((c) => c.name === 'Market')!
    expect(market.type).toBe('category')
    expect(market.icon).toBe('store')
    expect(market.weight).toBe(90)
  })

  it('attaches Field Definition elements to their owning concept', () => {
    const schema = extractBlueprintSchema(parseKnowledge(miniTemplate))
    const stakeholders = schema.concepts.find((c) => c.name === 'Stakeholders')!
    expect(stakeholders.fields).toBeDefined()
    const names = stakeholders.fields!.map((f) => f.name)
    expect(names).toEqual(['relationship_model', 'status'])
    const status = stakeholders.fields!.find((f) => f.name === 'status')!
    expect(status.type).toBe('select')
    expect(status.options).toEqual(['Ideation', 'MVP', 'Validation'])
  })

  it('extracts markers and matrices from their definition elements', () => {
    const schema = extractBlueprintSchema(parseKnowledge(miniTemplate))
    expect(schema.markers.map((m) => m.name)).toEqual(['weight'])
    expect(schema.markers[0].symbol).toBe('*')
    expect(schema.matrices).toHaveLength(1)
    expect(schema.matrices[0].source).toBe('Market')
    expect(schema.matrices[0].target).toBe('Stakeholders')
    expect(schema.matrices[0].values).toEqual(['Max', 'High', 'Low'])
  })

  it('exposes the four root primitive section names', () => {
    expect(CONCEPT_DEFINITION).toBe('Concept Definition')
    expect(FIELD_DEFINITION).toBe('Field Definition')
    expect(MARKER_DEFINITION).toBe('Marker Definition')
    expect(MATRIX_DEFINITION).toBe('Matrix Definition')
  })
})

describe('validateKnowledge against a metaplantilla template', () => {
  const templateDoc: SpecDocument = {
    name: 'mini_V_1-0-0',
    level: 2,
    parentName: 'iNNfo_V_0-3-0',
    frontmatter: {
      spec_version: 'V_0-3-0',
      spec_url: 'https://example.com/mini',
      level: 2,
      relationship_types: {},
    },
    rawContent: miniTemplate,
  }

  it('validates a unified-syntax model against body-declared concepts', () => {
    const model = parseKnowledge(miniModel)
    const result = validateKnowledge(model, templateDoc, null)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a concept not declared in the metaplantilla', () => {
    const model = parseKnowledge(miniModel)
    model.elements.set('Ghost', [
      { type: 'Ghost', name: 'Boo', description: '', fields: {}, markers: {} },
    ])
    const result = validateKnowledge(model, templateDoc, null)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('Ghost'))).toBe(true)
  })
})

describe('validateFormatContent with unified syntax', () => {
  it('reports no body-syntax errors for a unified model', () => {
    const report = validateFormatContent(miniModel, 'mini_V_1-0-0_stakeholders_NN.md')
    const conceptSections = report.checks.find((c) => c.id === 'body-concept-sections')
    const elementMarkers = report.checks.find((c) => c.id === 'body-element-markers')
    expect(conceptSections!.passed).toBe(true)
    expect(elementMarkers!.passed).toBe(true)
  })
})

describe('validateFormatContent index block elements check', () => {
  it('passes when index contains only Concepts', () => {
    const content = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'knowledge_version: "V_0-1-0"',
      'title: "Test Model"',
      'parent_spec:',
      '  name: "business_V_0-3-0"',
      '  url: "https://example.com/business"',
      '---',
      '',
      '# NN index',
      '* [[Stakeholders]]',
      '* [[Problems]]',
      '',
      '# NN Stakeholders',
      '## NN Stakeholders: Customer',
      '',
      '# NN Problems',
      '## NN Problems: Pain Point',
      '',
    ].join('\n')

    const report = validateFormatContent(content, 'test_NN.md')
    const check = report.checks.find((c) => c.id === 'index-no-elements')
    expect(check).toBeDefined()
    expect(check!.passed).toBe(true)
  })

  it('fails when index contains Elements', () => {
    const content = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'knowledge_version: "V_0-1-0"',
      'title: "Test Model"',
      'parent_spec:',
      '  name: "business_V_0-3-0"',
      '  url: "https://example.com/business"',
      '---',
      '',
      '# NN index',
      '* [[Stakeholders]]',
      '  * [[Customer]]',
      '* [[Problems]]',
      '  * [[Pain Point]]',
      '',
      '# NN Stakeholders',
      '## NN Stakeholders: Customer',
      '',
      '# NN Problems',
      '## NN Problems: Pain Point',
      '',
    ].join('\n')

    const report = validateFormatContent(content, 'test_NN.md')
    const check = report.checks.find((c) => c.id === 'index-no-elements')
    expect(check).toBeDefined()
    expect(check!.passed).toBe(false)
    expect(check!.severity).toBe('error')
    expect(check!.message).toContain('Element')
    expect(check!.message).toContain('customer')
  })

  it('fails when level 3 model has inline schema in frontmatter', () => {
    const content = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'knowledge_version: "V_0-1-0"',
      'title: "Test Model"',
      'parent_spec:',
      '  name: "business_V_0-3-0"',
      '  url: "https://example.com/business"',
      'matrices:',
      '  - name: "test-matrix"',
      '---',
      '',
      '# NN index',
      '* [[Stakeholders]]',
      '',
      '# NN Stakeholders',
      '## NN Stakeholders: Customer',
      '',
    ].join('\n')

    const report = validateFormatContent(content, 'test_NN.md')
    const check = report.checks.find((c) => c.id === 'fm-no-inline-schema')
    expect(check).toBeDefined()
    expect(check!.passed).toBe(false)
    expect(check!.severity).toBe('error')
  })
  it('handles field definitions with duplicate names scoped to different concepts without slug collisions', () => {
    const specContent = [
      '# NN Concept Definition',
      '## NN Concept Definition: Fotos',
      'icon:: camera',
      'type:: weight',
      'color:: cyan',
      'weight:: 50',
      '',
      '## NN Concept Definition: Components',
      'type:: list',
      '',
      '# NN Field Definition',
      '## NN Field Definition: description',
      'concept:: Fotos',
      'type:: markdown_inline',
      '',
      '## NN Field Definition: description',
      'concept:: Components',
      'type:: markdown_inline',
    ].join('\n')

    const parsed = parseKnowledge(specContent)
    expect(parsed.slugCollisions).toBeUndefined()

    const schema = extractBlueprintSchema(parsed)
    expect(schema.concepts).toHaveLength(2)

    const fotos = schema.concepts.find((c) => c.name === 'Fotos')
    expect(fotos).toBeDefined()
    expect(fotos!.fields).toHaveLength(1)
    expect(fotos!.fields![0].name).toBe('description')

    const components = schema.concepts.find((c) => c.name === 'Components')
    expect(components).toBeDefined()
    expect(components!.fields).toHaveLength(1)
    expect(components!.fields![0].name).toBe('description')
  })
})

describe('applyMutation on a metaplantilla document', () => {
  it('adds a Concept Definition element when no frontmatter concepts block exists', () => {
    const model = parseKnowledge(miniTemplate)
    const result = applyMutation(model, 'add_concept', { conceptName: 'Products', type: 'list' })
    expect(result.success).toBe(true)
    const defs = model.elements.get(CONCEPT_DEFINITION)!
    expect(defs.some((d) => d.name === 'Products')).toBe(true)
    expect(defs.find((d) => d.name === 'Products')!.fields['type']).toBe('list')
  })

  it('adds a Field Definition element bound to a concept', () => {
    const model = parseKnowledge(miniTemplate)
    const result = applyMutation(model, 'add_field', {
      conceptName: 'Stakeholders',
      fieldName: 'owner',
      fieldType: 'string',
    })
    expect(result.success).toBe(true)
    const fds = model.elements.get(FIELD_DEFINITION)!
    const field = fds.find((f) => f.name === 'owner')!
    expect(field.fields['concept']).toBe('Stakeholders')
    expect(field.fields['type']).toBe('string')
  })

  it('sets a Marker Definition element', () => {
    const model = parseKnowledge(miniTemplate)
    const result = applyMutation(model, 'set_marker', { markerName: 'priority', symbol: '!' })
    expect(result.success).toBe(true)
    const defs = model.elements.get(MARKER_DEFINITION)!
    expect(defs.some((m) => m.name === 'priority')).toBe(true)
  })

  it('renames a Concept Definition and re-points its fields', () => {
    const model = parseKnowledge(miniTemplate)
    const result = applyMutation(model, 'rename_concept', {
      conceptName: 'Stakeholders',
      newName: 'Actors',
    })
    expect(result.success).toBe(true)
    const defs = model.elements.get(CONCEPT_DEFINITION)!
    expect(defs.some((d) => d.name === 'Actors')).toBe(true)
    expect(defs.some((d) => d.name === 'Stakeholders')).toBe(false)
    const fds = model.elements.get(FIELD_DEFINITION)!
    for (const f of fds) {
      expect(f.fields['concept']).not.toBe('Stakeholders')
    }
    expect(fds.filter((f) => f.fields['concept'] === 'Actors').length).toBe(2)
  })
})
