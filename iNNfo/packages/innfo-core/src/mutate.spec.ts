import { describe, it, expect } from 'vitest'
import { parseModel } from './parser/index.js'
import { applyMutation } from './mutate.js'
import type { TemplateSchema } from './schema/index.js'

const TEMPLATE = `---
spec_version: "V_0-2-0"
spec_url: "https://example.test/iNNfo_V_0-2-0_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-0"
  url: "https://example.test/iNNfo_V_0-2-0_NN.md"
title: "Fixture"
---

# NN Concept Definition
## NN Concept Definition: Phase
type:: list

# NN Phase
## NN Phase: First
note:: keep
`

const LEVEL3_MODEL = `---
spec_version: "V_0-2-0"
spec_url: "https://example.test/iNNfo_V_0-2-0_NN.md"
level: 3
knowledge_version: "V_1-0-0"
parent_spec:
  name: "iNNfo_V_0-2-0"
  url: "https://example.test/iNNfo_V_0-2-0_NN.md"
title: "Fixture Model"
---

# NN Phase
## NN Phase: First
note:: keep
`

describe('applyMutation transactionality', () => {
  it('commits a successful op onto the caller model in place (same reference)', () => {
    const model = parseModel(TEMPLATE)
    const ref = model
    const result = applyMutation(model, 'add_concept', { conceptName: 'Risk', type: 'list' })
    expect(result.success).toBe(true)
    expect(model).toBe(ref) // not replaced
    const names = (model.elements.get('Concept Definition') ?? []).map((c) => c.name)
    expect(names).toContain('Risk')
  })

  it('leaves the model untouched when the op fails', () => {
    const model = parseModel(TEMPLATE)
    const before = JSON.stringify(model)
    const result = applyMutation(model, 'add_concept', { conceptName: 'Elements', type: 'list' })
    expect(result.success).toBe(false)
    expect(JSON.stringify(model)).toBe(before)
  })

  it('does not partially apply a rename that fails a model-wide uniqueness check', () => {
    const model = parseModel(TEMPLATE)
    applyMutation(model, 'add_concept', { conceptName: 'Task', type: 'list' })
    applyMutation(model, 'add_element', { conceptName: 'Task', elementName: 'Second' })
    const before = JSON.stringify(model)
    // "Second" already exists model-wide -> rename must be rejected whole
    const result = applyMutation(model, 'rename_element', {
      conceptName: 'Phase',
      elementName: 'First',
      newName: 'Second',
    })
    expect(result.success).toBe(false)
    expect(JSON.stringify(model)).toBe(before)
  })

  it('accumulates across sequential successful ops', () => {
    const model = parseModel(TEMPLATE)
    expect(applyMutation(model, 'add_concept', { conceptName: 'A', type: 'list' }).success).toBe(true)
    expect(applyMutation(model, 'add_concept', { conceptName: 'B', type: 'list' }).success).toBe(true)
    const names = (model.elements.get('Concept Definition') ?? []).map((c) => c.name)
    expect(names).toEqual(expect.arrayContaining(['Phase', 'A', 'B']))
  })
})

describe('level gate for template-authoring mutations (H5)', () => {
  const gatedOps: Array<{ op: string; args: Record<string, unknown> }> = [
    { op: 'add_concept', args: { conceptName: 'Risk', type: 'list' } },
    { op: 'add_field', args: { conceptName: 'Phase', fieldName: 'owner' } },
    { op: 'set_marker', args: { markerName: 'blocked', symbol: '!' } },
  ]

  for (const { op, args } of gatedOps) {
    it(`rejects "${op}" on a level: 3 model with an explicit level-mismatch error, not a downstream schema error`, () => {
      const model = parseModel(LEVEL3_MODEL)
      const before = JSON.stringify(model)
      const result = applyMutation(model, op, args)

      expect(result.success).toBe(false)
      expect(result.errors?.[0]?.message).toMatch(/level/i)
      expect(result.errors?.[0]?.message).toContain('level-2')
      expect(result.errors?.[0]?.message).toContain('level 3')
      expect(result.errors?.[0]?.message).not.toContain('not defined in template')

      // Rollback proof: the model on disk/in-memory is byte-identical.
      expect(JSON.stringify(model)).toBe(before)
    })

    it(`still allows "${op}" on the existing level: 2 TEMPLATE fixture`, () => {
      const model = parseModel(TEMPLATE)
      const result = applyMutation(model, op, args)
      expect(result.success).toBe(true)
    })
  }

  it('does not gate other mutation handlers (add_element) on a level: 3 model', () => {
    const model = parseModel(LEVEL3_MODEL)
    const result = applyMutation(model, 'add_element', { conceptName: 'Phase', elementName: 'Second' })
    expect(result.success).toBe(true)
  })
})

describe('addElement sources propagation (H3a)', () => {
  it('persists a sources field alongside fields when provided', () => {
    const model = parseModel(LEVEL3_MODEL)
    const result = applyMutation(model, 'add_element', {
      conceptName: 'Phase',
      elementName: 'Second',
      fields: { note: 'keep' },
      sources: ['a.md#x', 'b.md#y'],
    })
    expect(result.success).toBe(true)
    const el = (model.elements.get('Phase') ?? []).find((e) => e.name === 'Second')
    expect(el?.fields).toEqual({ note: 'keep', sources: ['a.md#x', 'b.md#y'] })
  })

  it('persists sources when it is the only argument beyond the required ones', () => {
    const model = parseModel(LEVEL3_MODEL)
    const result = applyMutation(model, 'add_element', {
      conceptName: 'Phase',
      elementName: 'Second',
      sources: 'a.md#x',
    })
    expect(result.success).toBe(true)
    const el = (model.elements.get('Phase') ?? []).find((e) => e.name === 'Second')
    expect(el?.fields).toEqual({ sources: 'a.md#x' })
  })

  it('behaves exactly as before when sources is omitted', () => {
    const model = parseModel(LEVEL3_MODEL)
    const result = applyMutation(model, 'add_element', {
      conceptName: 'Phase',
      elementName: 'Second',
      fields: { note: 'keep' },
    })
    expect(result.success).toBe(true)
    const el = (model.elements.get('Phase') ?? []).find((e) => e.name === 'Second')
    expect(el?.fields).toEqual({ note: 'keep' })
    expect(el?.fields.sources).toBeUndefined()
  })
})

describe('add_element schema conformance (mutation-schema-conformance R1-R5)', () => {
  const SCHEMA: TemplateSchema = {
    concepts: [
      { name: 'Assumptions', type: 'text' },
      { name: 'Risks', type: 'text' },
      { name: 'Keys', type: 'text' },
    ],
    markers: [],
    matrices: [],
    taxonomy: [],
  }

  it('rejects an undeclared conceptName when a schema is supplied, leaving the model untouched (R1)', () => {
    const model = parseModel(LEVEL3_MODEL)
    const before = JSON.stringify(model)
    const result = applyMutation(
      model,
      'add_element',
      { conceptName: 'Rsiks', elementName: 'X', description: 'd' },
      SCHEMA,
    )
    expect(result.success).toBe(false)
    expect(JSON.stringify(model)).toBe(before)
    expect(model.elements.get('Rsiks')).toBeUndefined()
  })

  it('names the offending concept and suggests the nearest declared concept within edit distance 2 (R2)', () => {
    const model = parseModel(LEVEL3_MODEL)
    const result = applyMutation(
      model,
      'add_element',
      { conceptName: 'Rsiks', elementName: 'X', description: 'd' },
      SCHEMA,
    )
    expect(result.success).toBe(false)
    const message = result.errors?.[0]?.message ?? ''
    expect(message).toContain('Rsiks')
    expect(message).toContain('Risks')
  })

  it('lists the declared concepts when no close match exists (R2)', () => {
    const model = parseModel(LEVEL3_MODEL)
    const result = applyMutation(
      model,
      'add_element',
      { conceptName: 'CompletelyUnrelatedName', elementName: 'X' },
      SCHEMA,
    )
    expect(result.success).toBe(false)
    const message = result.errors?.[0]?.message ?? ''
    expect(message).toContain('Assumptions')
    expect(message).toContain('Risks')
    expect(message).toContain('Keys')
  })

  it('accepts a declared conceptName matched case-insensitively when a schema is supplied', () => {
    const model = parseModel(LEVEL3_MODEL)
    const result = applyMutation(
      model,
      'add_element',
      { conceptName: 'risks', elementName: 'X' },
      SCHEMA,
    )
    expect(result.success).toBe(true)
    expect(model.elements.get('risks')?.some((e) => e.name === 'X')).toBe(true)
  })

  it('keeps the current permissive behaviour when no schema is supplied (R3)', () => {
    const model = parseModel(LEVEL3_MODEL)
    const result = applyMutation(model, 'add_element', {
      conceptName: 'Rsiks',
      elementName: 'X',
    })
    expect(result.success).toBe(true)
    expect(model.elements.get('Rsiks')?.some((e) => e.name === 'X')).toBe(true)
  })
})

describe('update_field rejects an unknown concept (R4, consistency with add_element)', () => {
  it('fails with a "not found" error and does not mutate the model', () => {
    const model = parseModel(LEVEL3_MODEL)
    const before = JSON.stringify(model)
    const result = applyMutation(model, 'update_field', {
      conceptName: 'Rsiks',
      elementName: 'First',
      fieldName: 'note',
      value: 'x',
    })
    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.message).toContain('Rsiks')
    expect(JSON.stringify(model)).toBe(before)
  })
})
