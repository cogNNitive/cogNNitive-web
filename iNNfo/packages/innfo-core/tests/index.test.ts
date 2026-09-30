import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseModel,
  parseFrontmatter,
  validateModel,
  validateFormatContent,
  slugify,
  deriveElementSlugs,
  IdentityRegistry,
  applyMutation,
  uniqueSlugify,
  validateReferences,
  serializeModel,
  deriveMatrixWidgetType,
  normalizeMatrixDecl,
} from '../src/index'
import type { ElementNode } from '../src/types'
import { decomposedResolver } from './fixtures/decomposed'

const specsRoot = join(import.meta.dirname!, '..', '..', '..', 'specs')

function readSpec(pathSegments: string): string {
  return readFileSync(join(specsRoot, pathSegments), 'utf-8')
}

// NOTE: the `defiNNe (level 0)`, `iNNfo (level 1)`, `business template (level 2)`,
// and `procedures template (level 2)` describe blocks that used to live here read
// the frozen `specs/v0.2.0/**` snapshot, which used the OLD frontmatter-array
// grammar (`concepts:`/`markers:`/`matrices:` blocks) predating the unified `NN`
// syntax migration. `spec-versioning` (R-SV-06) deletes that frozen snapshot
// outright — it was never meant to coexist with the new immutable `specs/`
// tree — so those old-grammar-specific assertions have no live fixture to read
// anymore. Equivalent frontmatter/schema-extraction coverage against the
// CURRENT unified-syntax specs (defiNNe, iNNfo, and all four L2 templates)
// lives in `tests/metaplantilla-specs.test.ts`.

describe('iNNfo model with _NN markers (level 3)', () => {
  // Use inline content with _NN markers — legacy fixtures with _F are out of scope
  const modelContent = [
    '---',
    'spec_version: "V_0-2-0"',
    'level: 3',
    'knowledge_version: "V_0-1-2"',
    'title: "Test Model"',
    'mode: "FILE"',
    'parent_spec:',
    '  name: "business_V_0-1-1"',
    '  url: "https://example.com/business"',
    'matrices:',
    '  - name: "problems-value propositions matrix"',
    '    source: "Problems"',
    '    target: "Value propositions"',
    'concepts:',
    '  - name: "Stakeholders"',
    '    type: list',
    '  - name: "Problems"',
    '    type: list',
    '  - name: "Value propositions"',
    '    type: list',
    '---',
    '',
    '> [!NOTE]',
    '> This is an **iNNfo document**.',
    '',
    '# NN index',
    '',
    '* [[Market]]',
    '  * [[Segments]]',
    '* [[Stakeholders]]',
    '* [[Problems]]',
    '* [[Value propositions]]',
    '',
    '# NN Stakeholders',
    '',
    '## NN Stakeholders: Founder One',
    '  A founder.',
    '## NN Stakeholders: Founder Two',
    '  Another founder.',
    '## NN Stakeholders: Investor',
    '  An investor.',
    '',
    '# NN Problems',
    '',
    '## NN Problems: Problem Alpha',
    '  Description of alpha.',
    '## NN Problems: Problem Beta',
    '  Description of beta.',
    '',
    '# NN Value propositions',
    '',
    '## NN Value propositions: Prop A',
    '  Value prop A.',
    '',
    '# NN matrices: problems-value propositions matrix',
    '| Problems \\ Value propositions | Prop A |',
    '| :--- | :---: |',
    '| Problem Alpha | X |',
    '| Problem Beta | - |',
    '',
    '# NN matrices: item-markers matrix',
    '| Item \\ Marker | weight |',
    '| :--- | :---: |',
    '| Problem Alpha | 9 |',
    '',
  ].join('\n')

  const model = parseModel(modelContent)
  const fm = model.frontmatter

  it('parses frontmatter', () => {
    expect(fm.level).toBe(3)
    expect(fm.parent_spec!.name).toBe('business_V_0-1-1')
    expect(fm.knowledge_version).toBe('V_0-1-2')
    expect(fm.mode).toBe('FILE')
  })

  it('parses taxonomy from index block', () => {
    expect(model.taxonomy.length).toBeGreaterThan(0)
    const marketChild = model.taxonomy.find((e) => e.parent === 'Market')
    expect(marketChild).toBeDefined()
    expect(marketChild!.child).toBe('Segments')
  })

  it('parses concept elements', () => {
    expect(model.elements.has('Stakeholders')).toBe(true)
    expect(model.elements.has('Problems')).toBe(true)
    expect(model.elements.has('Value propositions')).toBe(true)

    const stakeholders = model.elements.get('Stakeholders')!
    expect(stakeholders.length).toBeGreaterThanOrEqual(3)
    expect(stakeholders[0].name).toContain('Founder One')
    expect(stakeholders[0].type).toBe('Stakeholders')
  })

  it('parses matrix values', () => {
    expect(model.matrices.length).toBeGreaterThanOrEqual(1)
    const vpMatrix = model.matrices.find((m) => m.name.toLowerCase().includes('problems-value'))
    expect(vpMatrix).toBeDefined()
    expect(vpMatrix!.cells.length).toBeGreaterThan(0)
    expect(vpMatrix!.cells[0].value).toBeTruthy()
  })

  it('parses item-markers matrix into nodeMarkers', () => {
    expect(Object.keys(model.nodeMarkers).length).toBeGreaterThan(0)
    expect(model.nodeMarkers['Problem Alpha']).toBeDefined()
    expect(model.nodeMarkers['Problem Alpha'].weight).toBe(9)
  })

  it('serializes and re-parses correctly', async () => {
    const { serializeModel } = await import('../src/index')
    const serialized = serializeModel(model)
    expect(serialized).toContain('url: "https://example.com/business"')
    expect(serialized).toContain('# NN Stakeholders')
    expect(serialized).toContain('# NN matrices: problems-value propositions matrix')
    expect(serialized).toContain('## NN Stakeholders:')
  })

  it('serializes and re-parses preserving full structure', async () => {
    const { serializeModel, parseModel } = await import('../src/index')
    const serialized = serializeModel(model)
    const reparsed = parseModel(serialized)

    // Frontmatter
    expect(reparsed.frontmatter.title).toBe(model.frontmatter.title)
    expect(reparsed.frontmatter.level).toBe(model.frontmatter.level)
    expect(reparsed.frontmatter.mode).toBe(model.frontmatter.mode)
    expect(reparsed.frontmatter.knowledge_version).toBe(model.frontmatter.knowledge_version)

    // Matrix declarations (round-trip critical)
    expect(reparsed.matrices.length).toBe(model.matrices.length)
    if (model.matrices.length > 0) {
      expect(reparsed.matrices[0].name).toBe(model.matrices[0].name)
      expect(reparsed.matrices[0].source).toBe(model.matrices[0].source)
      expect(reparsed.matrices[0].cells.length).toBe(model.matrices[0].cells.length)
    }

    // Node markers
    expect(Object.keys(reparsed.nodeMarkers).length).toBe(Object.keys(model.nodeMarkers).length)

    // Elements preserved
    expect(reparsed.elements.size).toBe(model.elements.size)
    for (const [key] of model.elements.entries()) {
      expect(reparsed.elements.has(key)).toBe(true)
      const origNodes = model.elements.get(key)!
      const reparsedNodes = reparsed.elements.get(key)!
      expect(reparsedNodes.length).toBe(origNodes.length)
    }

    // Taxonomy preserved
    expect(reparsed.taxonomy.length).toBe(model.taxonomy.length)
  })
})

describe('validator', () => {
  const validModelContent = [
    '---',
    'spec_version: "V_0-2-0"',
    'level: 3',
    'knowledge_version: "V_0-1-2"',
    'title: "Inline Model"',
    'mode: "FILE"',
    'parent_spec:',
    '  name: "business_V_0-1-1"',
    '  url: "https://example.com/business"',
    '---',
    '',
    '# NN index',
    '',
    '* [[Stakeholders]]',
    '',
    '# NN Stakeholders',
    '## NN Stakeholders: Alice',
    '',
  ].join('\n')

  const bizTemplateContent = readSpec('templates/business/spec_NN.md')
  const bizTemplateFm = parseFrontmatter(bizTemplateContent)!

  // Canonical `business` is a composition shell — its schema is resolved from
  // the five decomposed templates it `includes` (shared fixture).
  const resolveBizInclude = decomposedResolver()

  it('validates a model against the migrated business template', () => {
    const model = parseModel(validModelContent)

    const result = validateModel(
      model,
      {
        name: 'business_V_0-3-0',
        level: 2,
        parentName: 'iNNfo_V_0-3-0',
        frontmatter: bizTemplateFm,
        rawContent: bizTemplateContent,
      },
      null,
      resolveBizInclude,
    )

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects model with unknown concept', () => {
    const model = parseModel(validModelContent)

    model.elements.set('NonExistentConcept', [
      { type: 'NonExistentConcept', name: 'Test', description: '', fields: {}, markers: {} },
    ])

    const result = validateModel(
      model,
      {
        name: 'business_V_0-3-0',
        level: 2,
        parentName: 'iNNfo_V_0-3-0',
        frontmatter: bizTemplateFm,
        rawContent: bizTemplateContent,
      },
      null,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('NonExistentConcept'))).toBe(true)
  })
})

describe('reserved names validation (R-MM-02)', () => {
  it('rejects template with reserved concept name "Concepts"', () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Bad Template"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Concepts',
      'type:: text',
      '',
      '# NN index',
      '* [[Concepts]]',
      '',
    ].join('\n')

    const result = validateFormatContent(content, 'test_NN.md')
    const reservedCheck = result.checks.find((c) => c.id === 'fm-reserved-names')
    expect(reservedCheck).toBeDefined()
    expect(reservedCheck!.passed).toBe(false)
    expect(reservedCheck!.severity).toBe('error')
    expect(reservedCheck!.message).toMatch(/Concepts/)
  })

  it('rejects template with reserved concept name "Elements"', () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Bad Model"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Elements',
      'type:: list',
      '',
      '# NN index',
      '* [[Elements]]',
      '',
    ].join('\n')

    const result = validateFormatContent(content, 'bad_NN.md')
    const reservedCheck = result.checks.find((c) => c.id === 'fm-reserved-names')
    expect(reservedCheck).toBeDefined()
    expect(reservedCheck!.passed).toBe(false)
    expect(reservedCheck!.message).toMatch(/Elements/)
  })

  it('rejects template with reserved concept name "Markers"', () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Bad Template"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Markers',
      'type:: text',
      '',
      '# NN index',
      '* [[Markers]]',
      '',
    ].join('\n')

    const result = validateFormatContent(content, 'test_NN.md')
    const reservedCheck = result.checks.find((c) => c.id === 'fm-reserved-names')
    expect(reservedCheck).toBeDefined()
    expect(reservedCheck!.passed).toBe(false)
    expect(reservedCheck!.message).toMatch(/Markers/)
  })

  it('passes when no reserved concept names are used', () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Good Template"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Customer',
      'type:: text',
      '',
      '## NN Concept Definition: Product',
      'type:: text',
      '',
      '# NN index',
      '* [[Customer]]',
      '* [[Product]]',
      '',
    ].join('\n')

    const result = validateFormatContent(content, 'good_NN.md')
    const reservedCheck = result.checks.find((c) => c.id === 'fm-reserved-names')
    expect(reservedCheck).toBeUndefined()
  })
})

describe('identity collision throws error (R-IE-02)', () => {
  it('throws on duplicate sibling name instead of returning #2', () => {
    const reg = new IdentityRegistry()
    reg.register(null, 'Root')
    expect(() => reg.register(null, 'Root')).toThrow(/duplicate/i)
    expect(() => reg.register(null, 'Root')).toThrow(/Root/i)
  })

  it('normalizeSingleModel reports collision as issue', async () => {
    const { normalizeSingleModel } = await import('../src/recursiveParser')
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Collision Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '* [[Duplicate]]',
      '',
      '# NN Components',
      '## NN Components: Duplicate',
      '  First element.',
      '## NN Components: Duplicate',
      '  Second element — same name.',
      '',
    ].join('\n')

    const result = normalizeSingleModel(content, 'test_NN.md', 'CollisionTest')
    const collisionIssues = result.issues.filter((i) =>
      i.message.toLowerCase().includes('duplicate'),
    )
    expect(collisionIssues.length).toBeGreaterThan(0)
    expect(collisionIssues[0].message).toMatch(/Duplicate/i)
    // Verify no node with #2 suffix exists
    const hasHashSuffix = Object.keys(result.nodes).some((id) => id.includes('#2'))
    expect(hasHashSuffix).toBe(false)
  })

  it('same-named elements across concepts are reported in normalizeSingleModel', async () => {
    const { normalizeSingleModel } = await import('../src/recursiveParser')
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Duplicate Element"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '* [[Review]]',
      '',
      '# NN Work',
      '## NN Work: Review',
      '  First.',
      '',
      '# NN Steps',
      '## NN Steps: Review',
      '  Second — same name across concepts.',
      '',
    ].join('\n')

    const result = normalizeSingleModel(content, 'test_NN.md', 'DupTest')
    const collisionIssues = result.issues.filter((i) =>
      i.message.toLowerCase().includes('duplicate'),
    )
    expect(collisionIssues.length).toBeGreaterThan(0)
  })

  it('catches matching names under different taxonomy parents', async () => {
    const { normalizeSingleModel } = await import('../src/recursiveParser')
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Nested Dup"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '* [[Work]]',
      '  * [[Review]]',
      '* [[Steps]]',
      '  * [[Review]]',
      '',
      '# NN Work',
      '## NN Work: Review',
      '  First review.',
      '',
      '# NN Steps',
      '## NN Steps: Review',
      '  Colliding review.',
      '',
    ].join('\n')

    const result = normalizeSingleModel(content, 'test_NN.md', 'NestedDup')
    const collisionIssues = result.issues.filter((i) =>
      i.message.toLowerCase().includes('duplicate'),
    )
    expect(collisionIssues.length).toBeGreaterThan(0)
  })
})

describe('applyMutation (R-IE-01)', () => {
  const makeModel = () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '* [[Work]]',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Work',
      'type:: list',
      '',
      '# NN Field Definition',
      '',
      '## NN Field Definition: status',
      'concept:: Work',
      'type:: string',
      '',
      '# NN Marker Definition',
      '',
      '## NN Marker Definition: priority',
      'symbol:: !',
      '',
      '# NN Work',
      '## NN Work: Triage',
      '  First element.',
      '',
    ].join('\n')
    return parseModel(content)
  }

  it('adds a concept', () => {
    const model = makeModel()
    const result = applyMutation(model, 'add_concept', { conceptName: 'Steps', type: 'list' })
    expect(result.success).toBe(true)
    expect(model.elements.get('Concept Definition')!.some((d) => d.name === 'Steps')).toBe(true)
  })

  it('rejects duplicate concept', () => {
    const model = makeModel()
    const result = applyMutation(model, 'add_concept', { conceptName: 'Work', type: 'list' })
    expect(result.success).toBe(false)
    expect(result.errors!.length).toBeGreaterThan(0)
  })

  it('adds an element', () => {
    const model = makeModel()
    const result = applyMutation(model, 'add_element', {
      conceptName: 'Work',
      elementName: 'Review',
      description: 'Code review step.',
    })
    expect(result.success).toBe(true)
    const elements = model.elements.get('Work')!
    expect(elements.some((e) => e.name === 'Review')).toBe(true)
  })

  it('rejects duplicate element across concepts (model-wide)', () => {
    // Add a second concept, then try adding an element with same name
    const model = makeModel()
    applyMutation(model, 'add_concept', { conceptName: 'Steps', type: 'list' })
    // Triage already exists in Work; try adding Triage in Steps
    const result = applyMutation(model, 'add_element', {
      conceptName: 'Steps',
      elementName: 'Triage',
    })
    expect(result.success).toBe(false)
  })

  it('removes an element', () => {
    const model = makeModel()
    const result = applyMutation(model, 'remove_element', {
      conceptName: 'Work',
      elementName: 'Triage',
    })
    expect(result.success).toBe(true)
    const elements = model.elements.get('Work')!
    expect(elements.some((e) => e.name === 'Triage')).toBe(false)
  })

  it('renames a concept and updates references', () => {
    const model = makeModel()
    const result = applyMutation(model, 'rename_concept', {
      conceptName: 'Work',
      newName: 'Task',
    })
    expect(result.success).toBe(true)
    const defs = model.elements.get('Concept Definition')!
    expect(defs.some((d) => d.name === 'Task')).toBe(true)
    expect(defs.some((d) => d.name === 'Work')).toBe(false)
    const fds = model.elements.get('Field Definition')!
    expect(fds.every((f) => f.fields['concept'] !== 'Work')).toBe(true)
    const elements = model.elements.get('Task')
    expect(elements).toBeDefined()
    expect(elements![0].type).toBe('Task')
  })

  it('renames an element', () => {
    const model = makeModel()
    const result = applyMutation(model, 'rename_element', {
      conceptName: 'Work',
      elementName: 'Triage',
      newName: 'Prioritize',
    })
    expect(result.success).toBe(true)
    const elements = model.elements.get('Work')!
    expect(elements.some((e) => e.name === 'Prioritize')).toBe(true)
    expect(elements.some((e) => e.name === 'Triage')).toBe(false)
  })

  it('rejects rename to existing element name (model-wide)', () => {
    const model = makeModel()
    applyMutation(model, 'add_concept', { conceptName: 'Steps', type: 'list' })
    applyMutation(model, 'add_element', {
      conceptName: 'Steps',
      elementName: 'Prioritize',
    })
    const result = applyMutation(model, 'rename_element', {
      conceptName: 'Work',
      elementName: 'Triage',
      newName: 'Prioritize',
    })
    expect(result.success).toBe(false)
  })

  it('adds a field', () => {
    const model = makeModel()
    const result = applyMutation(model, 'add_field', {
      conceptName: 'Work',
      fieldName: 'assignee',
      fieldType: 'string',
    })
    expect(result.success).toBe(true)
    const fds = model.elements.get('Field Definition')!
    expect(fds.some((f) => f.name === 'assignee' && f.fields['concept'] === 'Work')).toBe(true)
  })

  it('sets a marker', () => {
    const model = makeModel()
    const result = applyMutation(model, 'set_marker', {
      markerName: 'urgency',
      symbol: '!!',
    })
    expect(result.success).toBe(true)
    expect(model.elements.get('Marker Definition')!.some((m) => m.name === 'urgency')).toBe(true)
  })

  it('rename_concept updates matrix declaration source/target', () => {
    const model = parseModel([
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'knowledge_version: "V_0-0-1"',
      'title: "Rename Concept Matrix"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '* [[Open PR]]',
      '* [[Reviewer]]',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Work',
      'type:: list',
      '',
      '## NN Concept Definition: Roles',
      'type:: list',
      '',
      '# NN Matrix Definition',
      '',
      '## NN Matrix Definition: work-roles matrix',
      'source:: Work',
      'target:: Roles',
      '',
      '# NN Work',
      '## NN Work: Open PR',
      '',
      '# NN Roles',
      '## NN Roles: Reviewer',
      '',
      '# NN matrices: work-roles matrix',
      '| Work \\ Roles | Reviewer |',
      '| Open PR      | ✅ |',
      '',
    ].join('\n'))

    // Rename "Work" concept to "Task"
    applyMutation(model, 'rename_concept', { conceptName: 'Work', newName: 'Task' })

    const mds = model.elements.get('Matrix Definition')!
    const matrixDecl = mds.find((m) => m.name === 'work-roles matrix')
    expect(matrixDecl).toBeDefined()
    // Source and target should be updated
    expect(matrixDecl!.fields['source']).toBe('Task')
  })

  it('rename_element updates taxonomy entries', () => {
    const model = parseModel([
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Rename Element Taxonomy"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'concepts:',
      '  - name: "Work"',
      '    type: "list"',
      '---',
      '',
      '# NN index',
      '* [[Parent]]',
      '  * [[Open PR]]',
      '',
      '# NN Work',
      '## NN Work: Parent',
      '  Top-level.',
      '## NN Work: Open PR',
      '  Nested child.',
      '',
    ].join('\n'))

    expect(model.taxonomy.length).toBeGreaterThan(0)
    // Open PR has a parent in the index (nested), so it gets a taxonomy edge
    const oldEdge = model.taxonomy.find((t) => t.child === 'Open PR')
    expect(oldEdge).toBeDefined()
    expect(oldEdge!.parent).toBe('Parent')

    const result = applyMutation(model, 'rename_element', {
      conceptName: 'Work',
      elementName: 'Open PR',
      newName: 'Create PR',
    })
    expect(result.success).toBe(true)

    const newEdge = model.taxonomy.find((t) => t.child === 'Create PR')
    expect(newEdge).toBeDefined()
    expect(newEdge!.parent).toBe('Parent')
    expect(model.taxonomy.some((t) => t.child === 'Open PR')).toBe(false)
  })
})

describe('CRLF line-ending handling', () => {
  it('parses a CRLF-encoded model with the same fidelity as LF', () => {
    const lfContent = [
      '---',
      'spec_version: "V_0-1-1"',
      'level: 3',
      'knowledge_version: "V_0-1-1"',
      'title: "CRLF fixture"',
      'mode: "FILE"',
      '---',
      '',
      '# NN index',
      '',
      '* [[Parent]]',
      '  * [[Child]]',
      '',
      '# NN Stakeholders',
      '## NN Stakeholders: First Stakeholder',
      '  Description text for the stakeholder.',
      '## NN Stakeholders: Second Stakeholder',
      '  Another description.',
      '',
    ].join('\n')
    const crlfContent = lfContent.replace(/\n/g, '\r\n')

    const lfModel = parseModel(lfContent)
    const crlfModel = parseModel(crlfContent)

    expect(crlfModel.taxonomy.length).toBe(lfModel.taxonomy.length)
    expect(crlfModel.taxonomy.length).toBeGreaterThan(0)

    expect(crlfModel.elements.has('Stakeholders')).toBe(true)
    expect(crlfModel.elements.get('Stakeholders')!.length).toBe(2)
    expect(crlfModel.elements.get('Stakeholders')![0].name).toBe('First Stakeholder')
    expect(crlfModel.elements.get('Stakeholders')![0].description).toBe(
      'Description text for the stakeholder.',
    )

    expect(crlfModel.elements.size).toBe(lfModel.elements.size)
  })

  it('parses a model with _NN markers from CRLF content with full fidelity', () => {
    const lfContent = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-1-2"',
      'title: "Inline Test"',
      'mode: "FILE"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '',
      '* [[Market]]',
      '  * [[Segments]]',
      '* [[Stakeholders]]',
      '* [[Problems]]',
      '',
      '# NN Stakeholders',
      '## NN Stakeholders: S1',
      '## NN Stakeholders: S2',
      '## NN Stakeholders: S3',
      '## NN Stakeholders: S4',
      '## NN Stakeholders: S5',
      '## NN Stakeholders: S6',
      '## NN Stakeholders: S7',
      '',
      '# NN Problems',
      '## NN Problems: P1',
      '## NN Problems: P2',
      '',
    ].join('\n')
    const crlfContent = lfContent.replace(/\n/g, '\r\n')
    const model = parseModel(crlfContent)

    expect(model.taxonomy.length).toBeGreaterThan(0)
    const segEdge = model.taxonomy.find((e) => e.parent === 'Market')
    expect(segEdge).toBeDefined()
    expect(segEdge!.child).toBe('Segments')
    expect(model.elements.size).toBeGreaterThan(1)
    expect(model.elements.has('Stakeholders')).toBe(true)
    expect(model.elements.get('Stakeholders')!.length).toBeGreaterThanOrEqual(7)
  })
})

/* ── FR-002: Slug derivation ─────────────────────────────────── */

describe('slugify (FR-002)', () => {
  it('converts a simple name to kebab-case', () => {
    expect(slugify('My Great Element')).toBe('my-great-element')
  })

  it('lowercases the input', () => {
    expect(slugify('ALLCAPS Name')).toBe('allcaps-name')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world test')).toBe('hello-world-test')
  })

  it('strips accented characters', () => {
    expect(slugify('José Martínez')).toBe('jose-martinez')
    expect(slugify('Café Crème')).toBe('cafe-creme')
    expect(slugify('München')).toBe('munchen')
  })

  it('removes non-alphanumeric characters except hyphens', () => {
    expect(slugify('Hello (World)!')).toBe('hello-world')
    expect(slugify('Price: $10')).toBe('price-10')
    expect(slugify('A&B Special')).toBe('ab-special')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('hello   world')).toBe('hello-world')
    expect(slugify('a--b')).toBe('a-b')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world')
    expect(slugify('-hello-')).toBe('hello')
  })

  it('handles empty and whitespace-only input', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
  })
})

describe('slugify R-IE-06 enhancements', () => {
  it('converts underscore to hyphen', () => {
    expect(slugify('hello_world')).toBe('hello-world')
    expect(slugify('my_var_name')).toBe('my-var-name')
    expect(slugify('_leading')).toBe('leading')
    expect(slugify('trailing_')).toBe('trailing')
  })

  it('uniqueSlugify appends -1 on collision', () => {
    const existing = new Set(['my-slug'])
    expect(uniqueSlugify('My Slug', existing)).toBe('my-slug-1')
    expect(existing.has('my-slug-1')).toBe(true)
  })

  it('uniqueSlugify appends -2 when -1 also exists', () => {
    const existing = new Set(['my-slug', 'my-slug-1'])
    expect(uniqueSlugify('My Slug', existing)).toBe('my-slug-2')
  })

  it('uniqueSlugify returns slugify result if no collision', () => {
    const existing = new Set<string>()
    expect(uniqueSlugify('Hello World', existing)).toBe('hello-world')
    expect(existing.has('hello-world')).toBe(true)
  })
})

describe('diagnostic policy (R-IE-05) — slug collisions surfaced', () => {
  it('normalizeSingleModel surfaces slug collisions as issues', async () => {
    const { normalizeSingleModel } = await import('../src/recursiveParser')
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Slug Collision"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '* [[My Element]]',
      '* [[my element]]',
      '',
      '# NN Components',
      '## NN Components: My Element',
      '  First one.',
      '## NN Components: my element',
      '  Second one — same slug.',
      '',
    ].join('\n')

    const result = normalizeSingleModel(content, 'test_NN.md', 'SlugTest')
    const slugIssues = result.issues.filter((i) =>
      i.message.toLowerCase().includes('slug'),
    )
    expect(slugIssues.length).toBeGreaterThan(0)
  })
})

describe('validateReferences (R-IE-04)', () => {
  it('reports dangling matrix reference', () => {
    const parsed = parseModel([
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Ref Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'matrices:',
      '  - name: "work-roles matrix"',
      '    source: "Work"',
      '    target: "Roles"',
      '---',
      '',
      '# NN index',
      '* [[Open PR]]',
      '* [[Reviewer]]',
      '',
      '# NN Work',
      '## NN Work: Open PR',
      '',
      '# NN Roles',
      '## NN Roles: Reviewer',
      '',
      '# NN matrices: work-roles matrix',
      '| Work \\ Roles | Reviewer |',
      '| Open PR      | ✅ |',
      '| NonExistent  | ✅ |',
      '',
    ].join('\n'))

    const result = validateReferences(parsed)
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((d) => d.message.includes('NonExistent'))).toBe(true)
    expect(result.some((d) => d.severity === 'error')).toBe(true)
  })

  it('passes when all matrix references resolve', () => {
    const parsed = parseModel([
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Ref Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'matrices:',
      '  - name: "work-roles matrix"',
      '    source: "Work"',
      '    target: "Roles"',
      '---',
      '',
      '# NN index',
      '* [[Open PR]]',
      '* [[Reviewer]]',
      '',
      '# NN Work',
      '## NN Work: Open PR',
      '',
      '# NN Roles',
      '## NN Roles: Reviewer',
      '',
      '# NN matrices: work-roles matrix',
      '| Work \\ Roles | Reviewer |',
      '| Open PR      | ✅ |',
      '',
    ].join('\n'))

    const result = validateReferences(parsed)
    expect(result.length).toBe(0)
  })

  it('resolves a matrix reference that differs only by dash character, as a WARNING not an ERROR (Fix 3)', () => {
    const parsed = parseModel([
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Ref Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'matrices:',
      '  - name: "revenue-roles matrix"',
      '    source: "Work"',
      '    target: "Roles"',
      '---',
      '',
      '# NN index',
      '* [[Revenue-Cost Structure]]',
      '* [[Reviewer]]',
      '',
      '# NN Work',
      '## NN Work: Revenue-Cost Structure',
      '',
      '# NN Roles',
      '## NN Roles: Reviewer',
      '',
      '# NN matrices: revenue-roles matrix',
      '| Work \\ Roles | Reviewer |',
      '| --- | --- |',
      '| Revenue—Cost Structure | ✅ |',
      '',
    ].join('\n'))

    const result = validateReferences(parsed)
    expect(result.some((d) => d.severity === 'error')).toBe(false)
    expect(result.some((d) => d.severity === 'warning' && d.message.includes('separator character differs'))).toBe(
      true,
    )
  })
})

describe('reference-typed element fields via validateModel (R-IE-04)', () => {
  function buildTemplate(targetConcepts?: string[]): {
    name: string
    level: 2
    parentName: string
    frontmatter: { spec_version: string; spec_url: string; level: 2 }
    rawContent: string
  } {
    const fieldDef = targetConcepts
      ? `type:: reference
target_concepts:: [${targetConcepts.join(', ')}]`
      : 'type:: reference'
    return {
      name: 'ref_V_1-0-0',
      level: 2,
      parentName: 'iNNfo_V_0-3-0',
      frontmatter: {
        spec_version: 'V_0-3-0',
        spec_url: 'https://example.com/ref',
        level: 2,
      },
      rawContent: [
        '# NN Concept Definition',
        '',
        '## NN Concept Definition: Work',
        'type:: list',
        '',
        '## NN Concept Definition: Gardens',
        'type:: list',
        '',
        '# NN Field Definition',
        '',
        '## NN Field Definition: location',
        'concept:: Work',
        fieldDef,
        '',
      ].join('\n'),
    }
  }

  function buildModel(locationValue?: string, withGardenElement = false): ReturnType<typeof parseModel> {
    const gardenSection = withGardenElement
      ? '# NN Gardens\n\n## NN Gardens: Jardín Exterior\n  A garden.\n'
      : ''
    return parseModel(
      [
        '---',
        'spec_version: "V_0-3-0"',
        'level: 3',
        'knowledge_version: "V_1-0-0"',
        'title: "Ref Model"',
        'parent_spec:',
        '  name: "ref_V_1-0-0"',
        '  url: "https://example.com/ref_V_1-0-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Patio]]',
        '',
        '# NN Work',
        '## NN Work: Patio',
        locationValue !== undefined ? `location:: ${locationValue}` : '',
        '  A patio.',
        '',
        gardenSection,
      ].join('\n'),
    )
  }

  it('passes when a reference field value resolves to an existing element', () => {
    const result = validateModel(buildModel('Jardín Exterior', true), buildTemplate() as any, null)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a dangling reference field value (location:: Jardín Exterior)', () => {
    const result = validateModel(buildModel('Jardín Exterior', false), buildTemplate() as any, null)
    expect(result.valid).toBe(false)
    const err = result.errors.find((e) => e.message.includes('does not match any element name'))
    expect(err).toBeDefined()
    expect(err!.path).toBe('elements.Work.Patio.fields.location')
    expect(err!.message).toContain('"location"')
    expect(err!.message).toContain('Jardín Exterior')
  })

  it('passes when the resolved element belongs to an allowed target_concept', () => {
    const model = buildModel('Jardín Exterior', true)
    const result = validateModel(model, buildTemplate(['Gardens']) as any, null)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a reference resolving to an element outside the field target_concepts', () => {
    const model = parseModel(
      [
        '---',
        'spec_version: "V_0-3-0"',
        'level: 3',
        'knowledge_version: "V_1-0-0"',
        'title: "Ref Model"',
        'parent_spec:',
        '  name: "ref_V_1-0-0"',
        '  url: "https://example.com/ref_V_1-0-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Patio]]',
        '* [[Workspace]]',
        '',
        '# NN Work',
        '## NN Work: Patio',
        'location:: Workspace',
        '  A patio.',
        '## NN Work: Workspace',
        '  A work space.',
        '',
      ].join('\n'),
    )
    const result = validateModel(model, buildTemplate(['Gardens']) as any, null)
    expect(result.valid).toBe(false)
    const err = result.errors.find((e) => e.message.includes('target_concepts'))
    expect(err).toBeDefined()
    expect(err!.message).toContain('"Workspace"')
    expect(err!.message).toContain('belongs to concept(s) "Work"')
    expect(err!.message).toContain('not in target_concepts')
  })

  it('reports a matrix row/col that does not resolve to an element as a WARNING via validateModel', () => {
    const template = {
      name: 'mx_V_1-0-0',
      level: 2 as const,
      parentName: 'iNNfo_V_0-3-0',
      frontmatter: {
        spec_version: 'V_0-3-0',
        spec_url: 'https://example.com/mx',
        level: 2 as const,
      },
      rawContent: [
        '# NN Concept Definition',
        '',
        '## NN Concept Definition: Work',
        'type:: list',
        '',
        '## NN Concept Definition: Roles',
        'type:: list',
        '',
        '# NN Matrix Definition',
        '',
        '## NN Matrix Definition: work-roles matrix',
        'source:: Work',
        'target:: Roles',
        '',
      ].join('\n'),
    }
    const model = parseModel(
      [
        '---',
        'spec_version: "V_0-3-0"',
        'level: 3',
        'knowledge_version: "V_1-0-0"',
        'title: "Matrix Ref Model"',
        'parent_spec:',
        '  name: "mx_V_1-0-0"',
        '  url: "https://example.com/mx_V_1-0-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Open PR]]',
        '* [[Reviewer]]',
        '',
        '# NN Work',
        '## NN Work: Open PR',
        '',
        '# NN Roles',
        '## NN Roles: Reviewer',
        '',
        '# NN matrices: work-roles matrix',
        '| Work \\ Roles | Reviewer |',
        '| :--- | :---: |',
        '| Open PR | ✅ |',
        '| NonExistent | ✅ |',
        '',
      ].join('\n'),
    )
    const result = validateModel(model, template as any, null)
    // Matrix label drift is advisory (WARNING): real V_0-3-0 fixtures use
    // numbered/abbreviated labels, so it must not invalidate the model.
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.message.includes('NonExistent'))).toBe(true)
    expect(result.errors.some((e) => e.message.includes('NonExistent'))).toBe(false)
  })
})

describe('legacy params → values reader tolerance (4.5)', () => {
  it('converts semicolon-delimited params to values array', () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Legacy Test"',
      'matrices:',
      '  - name: "test matrix"',
      '    source: "A"',
      '    target: "B"',
      '    params: "Red;Green;Blue"',
      '---',
      '',
      '# NN index',
      '* [[Test]]',
      '',
    ].join('\n')

    const parsed = parseModel(content)
    const matrix = parsed.frontmatter.matrices?.find((m) => m.name === 'test matrix')
    expect(matrix).toBeDefined()
    expect((matrix as any).values).toEqual(['Red', 'Green', 'Blue'])
  })

  it('keeps native values when both params and values present', () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Native Test"',
      'matrices:',
      '  - name: "test matrix"',
      '    source: "A"',
      '    target: "B"',
      '    values: [Responsible, Accountable]',
      '    params: "Red;Green;Blue"',
      '---',
      '',
      '# NN index',
      '* [[Test]]',
      '',
    ].join('\n')

    const parsed = parseModel(content)
    const matrix = parsed.frontmatter.matrices?.find((m) => m.name === 'test matrix')
    expect(matrix).toBeDefined()
    expect((matrix as any).values).toEqual(['Responsible', 'Accountable'])
  })
})

describe('element slug derivation (FR-002)', () => {
  it('derives slug from element name when slug field is absent', () => {
    const content = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN Problems',
      '',
      '## NN Problems: My Great Element',
      '  A description.',
      '',
    ].join('\n')

    const model = parseModel(content)
    const elements = model.elements.get('Problems')
    expect(elements).toBeDefined()
    expect(elements![0].slug).toBe('my-great-element')
  })

  it('uses explicit slug from YAML fields when declared', () => {
    const content = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN Problems',
      '',
      '## NN Problems: My Element',

      'slug:: my-custom-slug',
      'severity:: high',

      '  A description.',
      '',
    ].join('\n')

    const model = parseModel(content)
    const elements = model.elements.get('Problems')
    expect(elements).toBeDefined()
    expect(elements![0].slug).toBe('my-custom-slug')
    // slug should NOT remain in fields
    expect(elements![0].fields['slug']).toBeUndefined()
    // other fields should remain
    expect(elements![0].fields['severity']).toBe('high')
  })

  it('detects collisions when two elements derive the same slug', async () => {
    const { ElementsMap } = await import('../src/types')
    const elements = new ElementsMap()

    // Manually create elements with names that would slugify to the same value
    const el1: ElementNode = {
      type: 'Components',
      name: 'My Element',
      description: '',
      fields: {},
      markers: {},
    }
    const el2: ElementNode = {
      type: 'Components',
      name: 'my element',
      description: '',
      fields: {},
      markers: {},
    }

    elements.set('Components', [el1, el2])
    const collisions = deriveElementSlugs(elements)

    expect(collisions).toHaveLength(1)
    expect(collisions[0].slug).toBe('my-element')
    expect(collisions[0].elements).toContain('My Element')
    expect(collisions[0].elements).toContain('my element')
  })

  it('emits slugCollisions on parsed model when names collide', () => {
    const content = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN Components',
      '',
      '## NN Components: My Element',
      '  First one.',
      '## NN Components: my element',
      '  Second one with same slug.',
      '',
    ].join('\n')

    const model = parseModel(content)
    expect(model.slugCollisions).toBeDefined()
    expect(model.slugCollisions!.length).toBeGreaterThanOrEqual(1)
    expect(model.slugCollisions![0].slug).toBe('my-element')
    expect(model.slugCollisions![0].elements).toContain('My Element')
  })

  it('passes slug from ElementNode to ModelNode via recursiveParser', async () => {
    // This is tested via recursiveParse which maps elements to model nodes.
    // We verify the slug field is populated on the model node.
    const { recursiveParse } = await import('../src/recursiveParser')

    const fakeFile = (name: string, content: string) => ({
      kind: 'file' as const,
      name,
      getFile: async () => ({ text: async () => content }),
    })

    const fakeDir = (entries: Array<[string, unknown]>) => ({
      kind: 'directory' as const,
      name: 'ws',
      entries: async function* () {
        for (const e of entries) yield e
      },
      getFileHandle: async (name: string) => {
        const found = entries.find(([n]) => n === name)
        if (!found) throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
        return found[1]
      },
    })

    const modelContent = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '* [[TestEl]]',
      '',
      '# NN Components',
      '',
      '## NN Components: Test El',
      '  A test element.',
      '',
    ].join('\n')

    const indexContent = [
      '---',
      'spec_version: "V_0-1-2"',
      'level: 0',
      'title: "Index"',
      '---',
      '',
      '# NN index',
      '',
      '* [[test_NN.md]]',
      '',
    ].join('\n')

    const root = fakeDir([
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', indexContent)],
      ['test_NN.md', fakeFile('test_NN.md', modelContent)],
    ])

    const result = await recursiveParse(root as any)
    const elementNodes = Object.values(result.nodes).filter((n) => n.kind === 'element')
    expect(elementNodes.length).toBeGreaterThan(0)
    expect(elementNodes[0].slug).toBe('test-el')
  })
})

/* ── FR-003: Asset field types ───────────────────────────────── */

describe('ConceptField.type with asset types (FR-003)', () => {
  it('accepts image/file/video/audio as field types', () => {
    const content = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Asset Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'concepts:',
      '  - name: Screenshots',
      '    type: text',
      '    fields:',
      '      - name: screenshot',
      '        type: image',
      '      - name: source',
      '        type: file',
      '      - name: demo',
      '        type: video',
      '      - name: narration',
      '        type: audio',
      '---',
      '',
      '# NN index',
      '* [[ScreenshotOne]]',
      '',
      '# NN Screenshots',
      '',
      '## NN Screenshots: ScreenshotOne',

      'screenshot:: photo.png',
      'source:: docs/report.pdf',
      'demo:: walkthrough.mp4',
      'narration:: voiceover.mp3',

      '  A test element with asset fields.',
      '',
    ].join('\n')

    const model = parseModel(content)
    expect(model.frontmatter.concepts).toBeDefined()
    const screenshotConcept = model.frontmatter.concepts!.find((c) => c.name === 'Screenshots')
    expect(screenshotConcept).toBeDefined()
    const fieldTypes = screenshotConcept!.fields!.map((f) => f.type)
    expect(fieldTypes).toContain('image')
    expect(fieldTypes).toContain('file')
    expect(fieldTypes).toContain('video')
    expect(fieldTypes).toContain('audio')
  })
})

/* ── Storage convention (single, canonical) ────────────────────── */

describe('asset storage convention', () => {
  it('ignores a stray asset_mode field in frontmatter (no such field exists)', () => {
    const content = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Asset Mode Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'asset_mode: per-element',
      '---',
      '',
      '# NN index',
      '* [[TestEl]]',
      '',
      '# NN Components',
      '',
      '## NN Components: TestEl',
      '  A test.',
      '',
    ].join('\n')

    // asset_mode is not part of SpecFrontmatter; it is preserved as an
    // unrecognized field but never consulted by the parser.
    const model = parseModel(content)
    expect(model.frontmatter.asset_mode).toBe('per-element')
  })

  it('resolves asset paths under {modelDir}/assets/{element-slug}/{filename}', async () => {
    const { recursiveParse } = await import('../src/recursiveParser')

    const fakeFile = (name: string, content: string) => ({
      kind: 'file' as const,
      name,
      getFile: async () => ({ text: async () => content }),
    })

    const fakeDir = (entries: Array<[string, unknown]>) => ({
      kind: 'directory' as const,
      name: 'ws',
      entries: async function* () {
        for (const e of entries) yield e
      },
      getFileHandle: async (name: string) => {
        const found = entries.find(([n]) => n === name)
        if (!found) throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
        return found[1]
      },
    })

    const modelContent = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Asset Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Screenshots',
      'type:: text',
      '',
      '# NN Field Definition',
      '',
      '## NN Field Definition: screenshot',
      'concept:: Screenshots',
      'type:: image',
      '',
      '# NN index',
      '* [[ScreenshotOne]]',
      '',
      '# NN Screenshots',
      '',
      '## NN Screenshots: ScreenshotOne',
      'screenshot:: photo.png',
      '  A screenshot element.',
      '',
    ].join('\n')

    const indexContent = [
      '---',
      'spec_version: "V_0-1-2"',
      'level: 0',
      'title: "Index"',
      '---',
      '',
      '# NN index',
      '',
      '* [[test_NN.md]]',
      '',
    ].join('\n')

    const root = fakeDir([
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', indexContent)],
      ['test_NN.md', fakeFile('test_NN.md', modelContent)],
    ])

    const result = await recursiveParse(root as any)
    // Locate the ScreenshotOne element (Concept Definition elements are also
    // graph nodes, so filter by name).
    const screenshotNode = Object.values(result.nodes).find((n) => n.name === 'ScreenshotOne')
    expect(screenshotNode).toBeDefined()
    // The single canonical convention: <model-dir>/assets/<element-slug>/<filename>
    // model-dir is '' (no directory prefix in the test), so path is 'assets/screenshotone/photo.png'
    expect(screenshotNode!.assets).toBeDefined()
    expect(screenshotNode!.assets!.length).toBeGreaterThan(0)
    expect(screenshotNode!.assets![0]).toContain('assets/screenshotone/photo.png')
  })
})

/* ── FR-007: FOLDER mode rejection ──────────────────────────── */

describe('FOLDER mode rejection (FR-007)', () => {
  it('parseModel emits a warning for FOLDER mode', () => {
    const content = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'mode: FOLDER',
      '---',
      '',
      '# NN index',
      '* [[TestEl]]',
      '',
      '# NN Components',
      '',
      '## NN Components: TestEl',
      '  A test.',
      '',
    ].join('\n')

    const model = parseModel(content)
    expect(model.parseWarnings).toBeDefined()
    expect(model.parseWarnings!.some((w) => w.includes('FOLDER'))).toBe(true)
  })

  it('validateFormatContent reports error for FOLDER mode', async () => {
    const { validateFormatContent } = await import('../src/validator')
    const content = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'mode: FOLDER',
      '---',
      '',
      '# NN index',
      '* [[TestEl]]',
      '',
      '# NN Components',
      '',
      '## NN Components: TestEl',
      '  A test.',
      '',
    ].join('\n')

    const report = validateFormatContent(content, 'test_NN.md')
    const folderCheck = report.checks.find((c) => c.id === 'fm-no-folder-mode')
    expect(folderCheck).toBeDefined()
    expect(folderCheck!.passed).toBe(false)
    expect(folderCheck!.severity).toBe('error')
    expect(folderCheck!.message).toContain('FOLDER')
  })

  it('validateModel reports error for FOLDER mode', () => {
    const content = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      'mode: FOLDER',
      '---',
      '',
      '# NN index',
      '* [[TestEl]]',
      '',
      '# NN Components',
      '',
      '## NN Components: TestEl',
      '  A test.',
      '',
    ].join('\n')

    const model = parseModel(content)
    const result = validateModel(model, null, null)
    const folderError = result.errors.find((e) => e.message.includes('FOLDER'))
    expect(folderError).toBeDefined()
    expect(folderError!.severity).toBe('error')
  })

  it('reports warnings for undocumented or incomplete parent concepts', () => {
    const modelContent = [
      '---',
      'spec_version: "V_0-1-3"',
      'level: 3',
      'knowledge_version: "V_0-0-1"',
      'title: "Test"',
      'parent_spec:',
      '  name: "test_V_0-1-1"',
      '  url: "https://example.com/test"',
      '---',
      '',
      '# NN index',
      '* [[Market]]',
      '* [[Product]]',
    ].join('\n')

    const model = parseModel(modelContent)
    const mockTemplate = {
      name: 'test_V_0-1-1',
      level: 2 as const,
      frontmatter: {
        spec_version: 'V_0-1-1',
        spec_url: 'https://example.com/test',
        level: 2 as const,
      },
      rawContent: [
        '# Test Template',
        '',
        '# NN Concept Definition',
        '',
        '## NN Concept Definition: Market',
        'type:: weight',
        '',
        '## NN Concept Definition: Product',
        'type:: weight',
        '',
        '## Market',
        '### Summary',
        'A summary.',
        '### Description',
        'A description.',
        '### Methodologies',
        'Methodology list.',
        // Missing prompts for Market
        '',
        // Missing ## Product completely
      ].join('\n'),
    }

    const result = validateModel(model, mockTemplate, null)
    expect(result.warnings.length).toBe(1)

    const docWarning = result.warnings.find((w) => w.path === 'parent.concepts')
    expect(docWarning).toBeDefined()
    expect(docWarning!.message).toContain('Market')
    expect(docWarning!.message).toContain('Product')
    expect(docWarning!.message).toContain('2')
  })
})

// The frozen `specs/v0.2.1/**` snapshot this used to read from disk is deleted
// by `spec-versioning` (R-SV-06) — old-grammar frontmatter-array snapshots don't
// coexist with the new immutable `specs/` tree. This inline fixture preserves
// the exact per-matrix `description`/`widget`/`values` declarations the
// business_V_0-2-1 patch introduced (see root CHANGELOG.md, "Business template
// patch — business_V_0-2-1"), so `normalizeMatrixDecl`'s handling of rich
// matrix declarations keeps its regression coverage without depending on a
// deleted file.
describe('business template V_0-2-1 (patch)', () => {
  const content = [
    '---',
    'specification_version: "V_0-2-1"',
    'level: 2',
    'parent_spec:',
    '  name: "iNNfo_V_0-2-0"',
    '  url: "https://example.com/iNNfo_V_0-2-0_NN.md"',
    'title: "Business Template"',
    'matrices:',
    '  - name: "Journey map"',
    '    source: "Journey"',
    '    target: "Emotions"',
    '    widget: "set"',
    '    values: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]',
    '    description: "Cross-tabulates Journey steps (rows) against Emotions (columns) to score the emotional intensity of each touchpoint."',
    '  - name: "Functions-Positions Matrix"',
    '    source: "Functions"',
    '    target: "Positions"',
    '    widget: "boolean"',
    '    values: [Assumes]',
    '    description: "Boolean assignment of which Position assumes responsibility for each Function."',
    '---',
    '',
    '> [!NOTE]',
    '> This is an **iNNfo document**.',
  ].join('\n')
  const fm = parseFrontmatter(content)!

  it('declares V_0-2-1 with parent iNNfo_V_0-2-0', () => {
    expect(fm.specification_version).toBe('V_0-2-1')
    expect(fm.parent_spec!.name).toBe('iNNfo_V_0-2-0')
  })

  it('declares per-matrix description, widget and values', () => {
    const journey = fm.matrices!.find((m) => m.name === 'Journey map')
    expect(journey).toBeDefined()
    expect(journey!.description).toBeTruthy()
    expect(journey!.widgetType).toBe('set')
    expect((journey!.values as string[]).length).toBe(9)

    const functionsPositions = fm.matrices!.find((m) => m.name === 'Functions-Positions Matrix')
    expect(functionsPositions).toBeDefined()
    expect(functionsPositions!.widgetType).toBe('boolean')
    expect(functionsPositions!.values).toEqual(['Assumes'])
  })

  it('normalizes declarations to __matrix_defs shape', () => {
    const def = normalizeMatrixDecl(fm.matrices!.find((m) => m.name === 'Journey map')! as any)
    expect(def.widgetType).toBe('set')
    expect(def.values).toEqual([
      'Max',
      'Very High',
      'High',
      'Slightly High',
      'Neutral',
      'Slightly Low',
      'Low',
      'Very Low',
      'Min',
    ])
    expect(def.description).toBeTruthy()
    expect(def.params).toContain('Max')

    const boolDef = normalizeMatrixDecl(fm.matrices!.find((m) => m.name === 'Functions-Positions Matrix')! as any)
    expect(boolDef.widgetType).toBe('boolean')
    expect(boolDef.values).toEqual(['Assumes'])
  })
})

describe('matrix widget inference (R-MM-08)', () => {
  it('uses explicit widgetType first', () => {
    expect(deriveMatrixWidgetType({ widgetType: 'cycle', values: ['A', 'B'] })).toBe('cycle')
  })

  it('infers boolean from a single value', () => {
    expect(deriveMatrixWidgetType({ values: ['Assumes'] })).toBe('boolean')
  })

  it('infers scale from numeric value sets', () => {
    expect(deriveMatrixWidgetType({ values: ['1', '2', '3', '4', '5'] })).toBe('scale')
  })

  it('infers set from multi-value sets', () => {
    expect(deriveMatrixWidgetType({ values: ['Max', 'High', 'Low'] })).toBe('set')
  })

  it('falls back to text', () => {
    expect(deriveMatrixWidgetType({})).toBe('text')
  })
})

describe('matrix value-set validation (R-MM-08)', () => {
  function buildModel(cellValue: string) {
    return parseModel(
      [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 3',
        'knowledge_version: "V_0-1-2"',
        'title: "Val Test"',
        'parent_spec:',
        '  name: "business_V_0-2-1"',
        '  url: "https://example.com/business"',
        '---',
        '',
        '# NN index',
        '* [[Problems]]',
        '* [[Value propositions]]',
        '',
        '# NN Problems',
        '## NN Problems: Problem One',
        '  Description.',
        '',
        '# NN Value propositions',
        '## NN Value propositions: VP One',
        '  Description.',
        '',
        '# NN matrices: problems-value propositions matrix',
        '| Problems \\ Value propositions | VP One |',
        '| :--- | :---: |',
        `| Problem One | ${cellValue} |`,
        '',
      ].join('\n'),
    )
  }

  function buildTemplate() {
    return {
      name: 'business_V_0-2-1',
      level: 2 as const,
      frontmatter: {
        spec_version: 'V_0-2-0',
        spec_url: 'https://example.com/business',
        level: 2 as const,
      },
      rawContent: [
        '# Test Template',
        '',
        '# NN Concept Definition',
        '',
        '## NN Concept Definition: Problems',
        'type:: weight',
        '',
        '## NN Concept Definition: Value propositions',
        'type:: weight',
        '',
        '# NN Matrix Definition',
        '',
        '## NN Matrix Definition: Problems-Value propositions Matrix',
        'source:: Problems',
        'target:: Value propositions',
        'values:: [Max, Very High, High]',
        '',
      ].join('\n'),
    }
  }

  it('accepts declared values, the empty cell and the boolean marker X', () => {
    for (const value of ['High', '-', 'X']) {
      const result = validateModel(buildModel(value), buildTemplate() as any, null)
      const valueWarnings = result.warnings.filter((w) => w.message.includes('value set'))
      expect(valueWarnings).toHaveLength(0)
    }
  })

  it('flags cell values outside the declared set', () => {
    const result = validateModel(buildModel('Garbage'), buildTemplate() as any, null)
    const warning = result.warnings.find((w) => w.message.includes('value set'))
    expect(warning).toBeDefined()
    expect(warning!.message).toContain('Garbage')
    expect(warning!.message).toContain('Max')
  })
})

describe('matrix metadata serializer round-trip', () => {
  it('preserves values, widget and description', () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Round Trip"',
      'matrices:',
      '  - name: "test matrix"',
      '    source: "A"',
      '    target: "B"',
      '    widget: "set"',
      '    values: [Red, Green, Blue]',
      '    description: "A test matrix."',
      '---',
      '',
      '# NN index',
      '* [[A]]',
      '',
    ].join('\n')

    const parsed = parseModel(content)
    const serialized = serializeModel(parsed)
    const reparsed = parseModel(serialized)

    const m = reparsed.frontmatter.matrices!.find((x) => x.name === 'test matrix')!
    expect(m.widgetType).toBe('set')
    expect(m.values).toEqual(['Red', 'Green', 'Blue'])
    expect(m.description).toBe('A test matrix.')
    expect(serialized).toContain('widget: "set"')
    expect(serialized).toContain('values: [Red, Green, Blue]')
    expect(serialized).toContain('description: "A test matrix."')
  })

  it('keeps legacy params when no values are declared', () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Round Trip Legacy"',
      'matrices:',
      '  - name: "test matrix"',
      '    source: "A"',
      '    target: "B"',
      '    params: "Low;Medium;High"',
      '---',
      '',
      '# NN index',
      '* [[A]]',
      '',
    ].join('\n')

    const parsed = parseModel(content)
    const reparsed = parseModel(serializeModel(parsed))
    const m = reparsed.frontmatter.matrices!.find((x) => x.name === 'test matrix')!
    expect(m.values).toEqual(['Low', 'Medium', 'High'])
  })
})

describe('implicit and explicit reference validation (P1)', () => {
  function buildTemplate(): any {
    return {
      name: 'ref_V_1-0-0',
      level: 2,
      parentName: 'iNNfo_V_0-3-0',
      frontmatter: {
        spec_version: 'V_0-3-0',
        spec_url: 'https://example.com/ref',
        level: 2,
      },
      rawContent: [
        '# NN Concept Definition',
        '',
        '## NN Concept Definition: Components',
        'type:: list',
        '',
        '## NN Concept Definition: Items',
        'type:: list',
        '',
        '# NN Field Definition',
        '',
        '## NN Field Definition: custom_ref',
        'concept:: Items',
        'type:: reference',
        'target_concepts:: [Components]',
        '',
      ].join('\n'),
    }
  }

  it('flags dangling implicit reference (location:: Jardín Exterior)', () => {
    const model = parseModel(
      [
        '---',
        'spec_version: "V_0-3-0"',
        'level: 3',
        'knowledge_version: "V_1-0-0"',
        'title: "Ref Model"',
        'parent_spec:',
        '  name: "ref_V_1-0-0"',
        '  url: "https://example.com/ref_V_1-0-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Items]]',
        '',
        '# NN Items',
        '## NN Items: Sombrilla',
        'location:: Jardín Exterior',
        '',
      ].join('\n'),
    )

    const result = validateModel(model, buildTemplate(), null)
    expect(result.valid).toBe(false)
    const err = result.errors.find((e) => e.path.includes('location'))
    expect(err).toBeDefined()
    expect(err!.message).toContain('Dangling reference')
    expect(err!.message).toContain('Jardín Exterior')
  })

  it('passes valid implicit reference (location:: Jardín)', () => {
    const model = parseModel(
      [
        '---',
        'spec_version: "V_0-3-0"',
        'level: 3',
        'knowledge_version: "V_1-0-0"',
        'title: "Ref Model"',
        'parent_spec:',
        '  name: "ref_V_1-0-0"',
        '  url: "https://example.com/ref_V_1-0-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Items]]',
        '* [[Components]]',
        '',
        '# NN Items',
        '## NN Items: Sombrilla',
        'location:: Jardín',
        '',
        '# NN Components',
        '## NN Components: Jardín',
        '',
      ].join('\n'),
    )

    const result = validateModel(model, buildTemplate(), null)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('flags target_concepts mismatch on custom_ref', () => {
    const model = parseModel(
      [
        '---',
        'spec_version: "V_0-3-0"',
        'level: 3',
        'knowledge_version: "V_1-0-0"',
        'title: "Ref Model"',
        'parent_spec:',
        '  name: "ref_V_1-0-0"',
        '  url: "https://example.com/ref_V_1-0-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Items]]',
        '',
        '# NN Items',
        '## NN Items: Sombrilla',
        '## NN Items: Mesa de jardín',
        'custom_ref:: Mesa de jardín',
        '',
      ].join('\n'),
    )

    const result = validateModel(model, buildTemplate(), null)
    expect(result.valid).toBe(false)
    const err = result.errors.find((e) => e.path.includes('custom_ref'))
    expect(err).toBeDefined()
    expect(err!.message).toContain('target_concepts')
    expect(err!.message).toContain('Mesa de jardín')
  })
})

describe('taxonomy hierarchy cross-check (Fix 4)', () => {
  function buildHierarchyTemplate(): any {
    return {
      name: 'hier_V_1-0-0',
      level: 2,
      parentName: 'iNNfo_V_0-3-0',
      frontmatter: {
        spec_version: 'V_0-3-0',
        spec_url: 'https://example.com/hier',
        level: 2,
      },
      rawContent: [
        '# NN Concept Definition',
        '',
        '## NN Concept Definition: Market',
        'type:: list',
        '',
        '## NN Concept Definition: Stakeholders',
        'type:: list',
        '',
        '## NN Concept Definition: Unrelated',
        'type:: list',
        '',
      ].join('\n'),
    }
  }

  it('does not warn when the reference resolves to the taxonomy parent concept (coherent)', () => {
    const model = parseModel(
      [
        '---',
        'spec_version: "V_0-3-0"',
        'level: 3',
        'knowledge_version: "V_1-0-0"',
        'title: "Hierarchy Model"',
        'parent_spec:',
        '  name: "hier_V_1-0-0"',
        '  url: "https://example.com/hier_V_1-0-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Market]]',
        '  * [[Stakeholders]]',
        '* [[Unrelated]]',
        '',
        '# NN Market',
        '## NN Market: Retail Market',
        '',
        '# NN Stakeholders',
        '## NN Stakeholders: Alice',
        'parent_component:: Retail Market',
        '',
        '# NN Unrelated',
        '## NN Unrelated: Something',
        '',
      ].join('\n'),
    )

    const result = validateModel(model, buildHierarchyTemplate(), null)
    const hierarchyWarnings = result.warnings.filter((w) => w.message.includes('Hierarchy inconsistency'))
    expect(hierarchyWarnings).toHaveLength(0)
  })

  it('warns when an element references an unrelated concept that contradicts the index taxonomy (incoherent)', () => {
    const model = parseModel(
      [
        '---',
        'spec_version: "V_0-3-0"',
        'level: 3',
        'knowledge_version: "V_1-0-0"',
        'title: "Hierarchy Model"',
        'parent_spec:',
        '  name: "hier_V_1-0-0"',
        '  url: "https://example.com/hier_V_1-0-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Market]]',
        '  * [[Stakeholders]]',
        '* [[Unrelated]]',
        '',
        '# NN Market',
        '## NN Market: Retail Market',
        '',
        '# NN Stakeholders',
        '## NN Stakeholders: Alice',
        'parent_component:: Something',
        '',
        '# NN Unrelated',
        '## NN Unrelated: Something',
        '',
      ].join('\n'),
    )

    const result = validateModel(model, buildHierarchyTemplate(), null)
    expect(result.valid).toBe(true) // WARNING only, never ERROR
    const hierarchyWarnings = result.warnings.filter((w) => w.message.includes('Hierarchy inconsistency'))
    expect(hierarchyWarnings).toHaveLength(1)
    const message = hierarchyWarnings[0].message
    expect(message).toContain('Stakeholders')
    expect(message).toContain('Alice')
    expect(message).toContain('Market')
    expect(message).toContain('Unrelated')
  })
})

