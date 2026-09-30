import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extractMetaschema,
  extractBlueprintSchemaFromContent,
  validateTemplateAgainstMetaschema,
} from '../src/index'

const specsRoot = join(import.meta.dirname!, '..', '..', '..', 'specs')
const readSpec = (p: string): string => readFileSync(join(specsRoot, p), 'utf-8')

describe('Metaschema (Self-Description)', () => {
  const iNNfo = readSpec('iNNfo_V_0-3-0_NN.md')

  it('the level-1 spec carries a resolvable metaschema block', () => {
    const meta = extractMetaschema(iNNfo)
    expect(meta).not.toBeNull()
    expect(meta!).toContain('## NN Concept Definition: Matrix Definition')
    expect(meta!).toContain('## NN Field Definition: applies_to')
    expect(meta!).toContain('## NN Field Definition: widget_config')
  })

  it('the metaschema describes the four root primitives with their fields', () => {
    const meta = extractMetaschema(iNNfo)!
    const schema = extractBlueprintSchemaFromContent(meta)
    const names = schema.concepts.map((c) => c.name).sort()
    expect(names).toEqual([
      'Concept Definition',
      'Field Definition',
      'Marker Definition',
      'Matrix Definition',
    ])
    const matrixDef = schema.concepts.find((c) => c.name === 'Matrix Definition')!
    expect(matrixDef.fields!.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        'source',
        'target',
        'values',
        'widget',
        'widget_config',
        'description',
      ]),
    )
    const conceptTypeField = schema.concepts
      .find((c) => c.name === 'Concept Definition')!
      .fields!.find((f) => f.name === 'type')!
    expect(conceptTypeField.type).toBe('select')
    expect(conceptTypeField.options).toEqual([
      'text',
      'category',
      'weight',
      'list',
      'steps',
      'sequence',
      'knowledge',
    ])
    const fieldTypeField = schema.concepts
      .find((c) => c.name === 'Field Definition')!
      .fields!.find((f) => f.name === 'type')!
    expect(fieldTypeField.options).toContain('knowledge')
    const targetTemplateField = schema.concepts
      .find((c) => c.name === 'Field Definition')!
      .fields!.find((f) => f.name === 'target_blueprint')
    expect(targetTemplateField).toBeDefined()
    expect(targetTemplateField?.type).toBe('string')
  })

  it('every shipped template validates green against the metaschema', () => {
    const templates = [
      'bluepriNNts/blank/spec_NN.md',
      'bluepriNNts/business/spec_NN.md',
      'bluepriNNts/cogNNitive/spec_NN.md',
      'bluepriNNts/innovation/spec_NN.md',
      'bluepriNNts/organization/spec_NN.md',
      'bluepriNNts/procedures/spec_NN.md',
      'bluepriNNts/projects/spec_NN.md',
      'bluepriNNts/repository/spec_NN.md',
    ]
    for (const rel of templates) {
      const diags = validateTemplateAgainstMetaschema(readSpec(rel), iNNfo)
      const errors = diags.filter((d) => d.severity === 'error')
      expect(errors, `${rel}: ${JSON.stringify(errors)}`).toEqual([])
    }
  })

  it('the metaschema validates against itself (bootstrap axiom)', () => {
    const meta = extractMetaschema(iNNfo)!
    // Wrap the metaschema body as a minimal level-2 template and check it
    // against the same metaschema: no errors — it is a fixpoint.
    const asTemplate = ['---', 'level: 2', 'title: Metaschema', '---', '', meta, ''].join('\n')
    const diags = validateTemplateAgainstMetaschema(asTemplate, iNNfo)
    expect(diags.filter((d) => d.severity === 'error')).toEqual([])
  })

  it('flags an out-of-enum concept type as an error', () => {
    const badTemplate = [
      '---',
      'level: 2',
      'title: Bad',
      'parent_spec:',
      '  name: iNNfo_V_0-1-0',
      '  url: https://example.com/iNNfo_V_0-1-0_NN.md',
      '---',
      '',
      '> [!NOTE]',
      '> x',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Stakeholders',
      'type:: importance',
      '',
    ].join('\n')
    const diags = validateTemplateAgainstMetaschema(badTemplate, iNNfo)
    expect(
      diags.some((d) => d.severity === 'error' && d.message.includes('Invalid value "importance"')),
    ).toBe(true)
  })

  it('flags an undeclared primitive property as a warning', () => {
    const badTemplate = [
      '---',
      'level: 2',
      'title: Bad',
      '---',
      '',
      '# NN Marker Definition',
      '',
      '## NN Marker Definition: priority',
      'applies_to:: [Element]',
      'bogus_prop:: 1',
      '',
    ].join('\n')
    const diags = validateTemplateAgainstMetaschema(badTemplate, iNNfo)
    expect(diags.some((d) => d.severity === 'warning' && d.message.includes('bogus_prop'))).toBe(
      true,
    )
  })
})

describe('iNNfo_V_0-2-0 — metaschema still self-consistent', () => {
  const iNNfoV2 = readSpec('iNNfo_V_0-2-0_NN.md')

  it('carries a resolvable metaschema block describing the four root primitives', () => {
    const meta = extractMetaschema(iNNfoV2)
    expect(meta).not.toBeNull()
    const names = extractBlueprintSchemaFromContent(meta!)
      .concepts.map((c) => c.name)
      .sort()
    expect(names).toEqual([
      'Concept Definition',
      'Field Definition',
      'Marker Definition',
      'Matrix Definition',
    ])
  })

  it('the metaschema validates against itself (bootstrap axiom)', () => {
    const meta = extractMetaschema(iNNfoV2)!
    const asTemplate = ['---', 'level: 2', 'title: Metaschema', '---', '', meta, ''].join('\n')
    const diags = validateTemplateAgainstMetaschema(asTemplate, iNNfoV2)
    expect(diags.filter((d) => d.severity === 'error')).toEqual([])
  })

  it('every shipped V_0-1-0 template still validates green against it', () => {
    for (const rel of [
      'bluepriNNts/blank/spec_NN.md',
      'bluepriNNts/business/spec_NN.md',
      'bluepriNNts/organization/spec_NN.md',
      'bluepriNNts/projects/spec_NN.md',
    ]) {
      const errors = validateTemplateAgainstMetaschema(readSpec(rel), iNNfoV2).filter(
        (d) => d.severity === 'error',
      )
      expect(errors, `${rel}: ${JSON.stringify(errors)}`).toEqual([])
    }
  })

  })

describe('iNNfo_V_0-2-1 — metaschema still self-consistent (task G)', () => {
  const iNNfoV21 = readSpec('iNNfo_V_0-2-1_NN.md')

  it('carries a resolvable metaschema block describing the four root primitives', () => {
    const meta = extractMetaschema(iNNfoV21)
    expect(meta).not.toBeNull()
    const names = extractBlueprintSchemaFromContent(meta!)
      .concepts.map((c) => c.name)
      .sort()
    expect(names).toEqual([
      'Concept Definition',
      'Field Definition',
      'Marker Definition',
      'Matrix Definition',
    ])
  })

  it('declares target_blueprint on Field Definition — closes the V_0-2-0 regression (design.md §5)', () => {
    const meta = extractMetaschema(iNNfoV21)!
    const schema = extractBlueprintSchemaFromContent(meta)
    const targetTemplateField = schema.concepts
      .find((c) => c.name === 'Field Definition')!
      .fields!.find((f) => f.name === 'target_template')
    expect(targetTemplateField).toBeDefined()
    expect(targetTemplateField?.type).toBe('string')
  })

  it('accepts url as a Field Definition type', () => {
    const template = [
      '---',
      'level: 2',
      'title: Url Field',
      'parent_spec:',
      '  name: iNNfo_V_0-2-1',
      '  url: https://example.com/iNNfo_V_0-2-1_NN.md',
      '---',
      '',
      '> [!NOTE]',
      '> x',
      '',
      '# NN Field Definition',
      '',
      '## NN Field Definition: website',
      'concept:: Link',
      'type:: url',
      '',
    ].join('\n')
    const diags = validateTemplateAgainstMetaschema(template, iNNfoV21)
    expect(diags.filter((d) => d.severity === 'error'), JSON.stringify(diags)).toEqual([])
  })

  it('the metaschema validates against itself (bootstrap axiom)', () => {
    const meta = extractMetaschema(iNNfoV21)!
    const asTemplate = ['---', 'level: 2', 'title: Metaschema', '---', '', meta, ''].join('\n')
    const diags = validateTemplateAgainstMetaschema(asTemplate, iNNfoV21)
    expect(diags.filter((d) => d.severity === 'error')).toEqual([])
  })

  it('every shipped V_0-1-0 template still validates green against it', () => {
    for (const rel of [
      'bluepriNNts/blank/spec_NN.md',
      'bluepriNNts/business/spec_NN.md',
      'bluepriNNts/organization/spec_NN.md',
      'bluepriNNts/projects/spec_NN.md',
      'bluepriNNts/video/spec_NN.md',
    ]) {
      const errors = validateTemplateAgainstMetaschema(readSpec(rel), iNNfoV21).filter(
        (d) => d.severity === 'error',
      )
      expect(errors, `${rel}: ${JSON.stringify(errors)}`).toEqual([])
    }
  })

  it('base_V_0-1-0 (PR6, new composite template) validates green against it', () => {
    const errors = validateTemplateAgainstMetaschema(
      readSpec('bluepriNNts/base/spec_NN.md'),
      iNNfoV21,
    ).filter((d) => d.severity === 'error')
    expect(errors, JSON.stringify(errors)).toEqual([])
  })
})
