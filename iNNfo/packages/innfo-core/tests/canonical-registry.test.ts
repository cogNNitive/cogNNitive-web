import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  findCanonicalTemplate,
  getCanonicalSpecContent,
  listCanonicalTemplates,
  CANONICAL_TEMPLATES,
  resolveTemplateSchema,
} from '../src/schema'

const specsRoot = join(import.meta.dirname!, '..', '..', '..', 'specs')

/**
 * Extracts `name=type` for every Field Definition. Asserting on the pair (not
 * just the name) is what makes the mirror guard catch a semantic change such
 * as `derived_from_inputs`/`string` -> `sources`/`citation`, not only a rename.
 */
const fieldNameTypes = (content: string): string[] => {
  const lines = content.split(/\r?\n/)
  const pairs: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(/^## NN Field Definition: (.+)$/)
    if (!header) continue
    let type = '<none>'
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const match = lines[j].match(/^type:: (.+)$/)
      if (match) {
        type = match[1].trim()
        break
      }
      if (lines[j].startsWith('## NN Field Definition:')) break
    }
    pairs.push(`${header[1].trim()}=${type}`)
  }
  return pairs
}

describe('Canonical Template Registry & Offline Fallback', () => {
  it('bundles all standard Level 2 templates', () => {
    const templates = listCanonicalTemplates()
    const names = templates.map((t) => t.name)

    expect(names).toContain('business')
    expect(names).toContain('procedures')
    expect(names).toContain('sources')
    expect(names).toContain('artifacts')
    expect(names).toContain('organization')
    expect(names).toContain('metrics')
    expect(names).toContain('workspace')
    expect(names).toContain('cogNNitive')
  })

  it('resolves templates by exact canonical name', () => {
    const biz = findCanonicalTemplate('business')
    expect(biz).not.toBeNull()
    expect(biz?.name).toBe('business')

    const proc = findCanonicalTemplate('procedures')
    expect(proc).not.toBeNull()
    expect(proc?.name).toBe('procedures')

    const org = findCanonicalTemplate('organization')
    expect(org).not.toBeNull()
    expect(org?.name).toBe('organization')

    const metrics = findCanonicalTemplate('metrics')
    expect(metrics).not.toBeNull()
    expect(metrics?.name).toBe('metrics')

    const ws = findCanonicalTemplate('workspace')
    expect(ws).not.toBeNull()
    expect(ws?.name).toBe('workspace')

    const cog = findCanonicalTemplate('cogNNitive')
    expect(cog).not.toBeNull()
    expect(cog?.name).toBe('cogNNitive')
  })

  it('resolves templates by shorthand spec name aliases', () => {
    expect(findCanonicalTemplate('business_spec_NN')?.name).toBe('business')
    expect(findCanonicalTemplate('business_V_0-2-0_NN.md')?.name).toBe('business')
    expect(findCanonicalTemplate('procedures_spec_NN')?.name).toBe('procedures')
    expect(findCanonicalTemplate('procedures_V_0-2-0_NN.md')?.name).toBe('procedures')
    expect(findCanonicalTemplate('organization_spec_NN')?.name).toBe('organization')
    expect(findCanonicalTemplate('metrics_spec_NN')?.name).toBe('metrics')
    expect(findCanonicalTemplate('workspace_spec_NN')?.name).toBe('workspace')
    expect(findCanonicalTemplate('cognnitive_spec_NN')?.name).toBe('cogNNitive')
  })

  it('resolves templates by remote raw GitHub URLs', () => {
    const url =
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/business_V_0-2-0_NN.md'
    const template = findCanonicalTemplate(url)
    expect(template).not.toBeNull()
    expect(template?.name).toBe('business')

    const procUrl =
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md'
    expect(findCanonicalTemplate(procUrl)?.name).toBe('procedures')
  })

  it('returns valid spec content for offline parsing', () => {
    const content = getCanonicalSpecContent('procedures')
    expect(content).not.toBeNull()
    expect(content).toContain('# NN Concept Definition')
    expect(content).toContain('## NN Concept Definition: Work')

    const schema = resolveTemplateSchema(content!, () => null)
    expect(schema.schema.concepts.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Work', 'Artifact', 'Tools', 'Roles']),
    )
  })

  it('returns null for unknown template identifiers', () => {
    expect(findCanonicalTemplate('completely_unknown_template_xyz')).toBeNull()
    expect(getCanonicalSpecContent('')).toBeNull()
  })

  it('resolves the new V_0-2-2 core-language aliases', () => {
    const url =
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md'

    expect(findCanonicalTemplate('iNNfo_V_0-2-2_NN')?.name).toBe('innfo')
    expect(findCanonicalTemplate('innfo_v_0-2-2')?.name).toBe('innfo')
    expect(findCanonicalTemplate('specs/iNNfo_V_0-2-2_NN.md')?.name).toBe('innfo')
    expect(findCanonicalTemplate(url)?.name).toBe('innfo')
  })

  it('mirrors the workspace and artifacts V_0-2-2 templates without drift', () => {
    for (const [template, specPath] of [
      ['workspace', 'templates/workspace_spec_NN.md'],
      ['artifacts', 'templates/artifacts/spec_NN.md'],
    ] as const) {
      const disk = readFileSync(join(specsRoot, specPath), 'utf-8')
      const mirror = getCanonicalSpecContent(template)!

      expect(mirror, `${template} mirror exists`).not.toBeNull()
      expect(mirror, `${template} mirror carries V_0-2-2`).toContain('spec_version: "V_0-2-2"')
      expect(fieldNameTypes(mirror), `${template} field name=type drift`).toEqual(
        fieldNameTypes(disk),
      )
    }
  })
})
