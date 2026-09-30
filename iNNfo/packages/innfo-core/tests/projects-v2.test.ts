import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTemplateSchema, validateTemplateAgainstMetaschema } from '../src/index'

const specsRoot = join(import.meta.dirname!, '..', '..', '..', 'specs')
const readSpec = (p: string): string => readFileSync(join(specsRoot, p), 'utf-8')

const projectsV2 = readSpec('bluepriNNts/projects/spec_NN.md')
const iNNfoV2 = readSpec('iNNfo_V_0-2-0_NN.md')

describe('projects_V_0-2-0 — standalone L2 resolution', () => {
  it('resolves with no errors and the renamed / added concepts', () => {
    const { schema, errors } = resolveTemplateSchema(projectsV2)
    expect(errors).toEqual([])

    const concepts = schema.concepts.map((c) => c.name)
    expect(concepts).toContain('Project roles')
    expect(concepts).toContain('Phases')
    expect(concepts).not.toContain('Roles')
  })

  it('re-attaches the scope field to Project roles', () => {
    const { schema } = resolveTemplateSchema(projectsV2)
    const projectRoles = schema.concepts.find((c) => c.name === 'Project roles')!
    expect(projectRoles.fields?.map((f) => f.name)).toContain('scope')
  })
})

describe('projects_V_0-2-0 — metaschema conformance', () => {
  it('validates green against iNNfo_V_0-2-0 (zero errors)', () => {
    const diags = validateTemplateAgainstMetaschema(projectsV2, iNNfoV2)
    const errors = diags.filter((d) => d.severity === 'error')
    expect(errors, JSON.stringify(errors)).toEqual([])
  })
})
