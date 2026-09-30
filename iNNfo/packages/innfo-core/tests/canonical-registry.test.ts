import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  findCanonicalBlueprint,
  getCanonicalSpecContent,
  listCanonicalBlueprints,
  CANONICAL_BLUEPRINTS,
  resolveBlueprintSchema,
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
    const templates = listCanonicalBlueprints()
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
    const biz = findCanonicalBlueprint('business')
    expect(biz).not.toBeNull()
    expect(biz?.name).toBe('business')

    const proc = findCanonicalBlueprint('procedures')
    expect(proc).not.toBeNull()
    expect(proc?.name).toBe('procedures')

    const org = findCanonicalBlueprint('organization')
    expect(org).not.toBeNull()
    expect(org?.name).toBe('organization')

    const metrics = findCanonicalBlueprint('metrics')
    expect(metrics).not.toBeNull()
    expect(metrics?.name).toBe('metrics')

    const ws = findCanonicalBlueprint('workspace')
    expect(ws).not.toBeNull()
    expect(ws?.name).toBe('workspace')

    const cog = findCanonicalBlueprint('cogNNitive')
    expect(cog).not.toBeNull()
    expect(cog?.name).toBe('cogNNitive')
  })

  it('resolves templates by shorthand spec name aliases', () => {
    expect(findCanonicalBlueprint('business_spec_NN')?.name).toBe('business')
    expect(findCanonicalBlueprint('business_V_0-2-0_NN.md')?.name).toBe('business')
    expect(findCanonicalBlueprint('procedures_spec_NN')?.name).toBe('procedures')
    expect(findCanonicalBlueprint('procedures_V_0-2-0_NN.md')?.name).toBe('procedures')
    expect(findCanonicalBlueprint('organization_spec_NN')?.name).toBe('organization')
    expect(findCanonicalBlueprint('metrics_spec_NN')?.name).toBe('metrics')
    expect(findCanonicalBlueprint('workspace_spec_NN')?.name).toBe('workspace')
    expect(findCanonicalBlueprint('cognnitive_spec_NN')?.name).toBe('cogNNitive')
  })

  it('resolves templates by remote raw GitHub URLs', () => {
    const url =
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/business_V_0-2-0_NN.md'
    const template = findCanonicalBlueprint(url)
    expect(template).not.toBeNull()
    expect(template?.name).toBe('business')

    const procUrl =
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md'
    expect(findCanonicalBlueprint(procUrl)?.name).toBe('procedures')
  })

  it('returns valid spec content for offline parsing', () => {
    const content = getCanonicalSpecContent('procedures')
    expect(content).not.toBeNull()
    expect(content).toContain('# NN Concept Definition')
    expect(content).toContain('## NN Concept Definition: Work')

    const schema = resolveBlueprintSchema(content!, () => null)
    expect(schema.schema.concepts.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Work', 'Artifact', 'Tools', 'Roles']),
    )
  })

  it('returns null for unknown template identifiers', () => {
    expect(findCanonicalBlueprint('completely_unknown_template_xyz')).toBeNull()
    expect(getCanonicalSpecContent('')).toBeNull()
  })

  it('resolves the new V_0-2-2 core-language aliases', () => {
    const url =
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md'

    expect(findCanonicalBlueprint('iNNfo_V_0-2-2_NN')?.name).toBe('innfo')
    expect(findCanonicalBlueprint('innfo_v_0-2-2')?.name).toBe('innfo')
    expect(findCanonicalBlueprint('specs/iNNfo_V_0-2-2_NN.md')?.name).toBe('innfo')
    expect(findCanonicalBlueprint(url)?.name).toBe('innfo')
  })

  it('resolves defiNNition (Level 0) and iNNfo V_0-3-0 (Level 1) canonical identities', () => {
    const defUrl =
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md'
    const def = findCanonicalBlueprint('defiNNition')
    expect(def).not.toBeNull()
    expect(def?.name).toBe('defiNNition')
    expect(findCanonicalBlueprint('defiNNition_V_0-1-0_NN')?.name).toBe('defiNNition')
    expect(findCanonicalBlueprint('specs/defiNNition_V_0-1-0_NN.md')?.name).toBe('defiNNition')
    expect(findCanonicalBlueprint(defUrl)?.name).toBe('defiNNition')

    const innfoUrl =
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md'
    const innfo3 = findCanonicalBlueprint('iNNfo_V_0-3-0_NN')
    expect(innfo3).not.toBeNull()
    expect(innfo3?.name).toBe('innfo')
    expect(findCanonicalBlueprint('innfo_v_0-3-0')?.name).toBe('innfo')
    expect(findCanonicalBlueprint('specs/iNNfo_V_0-3-0_NN.md')?.name).toBe('innfo')
    expect(findCanonicalBlueprint(innfoUrl)?.name).toBe('innfo')
  })

  it('verifies iNNfo V_0-3-0 parent points to defiNNition on main', () => {
    const content = getCanonicalSpecContent('iNNfo_V_0-3-0_NN')
    expect(content).not.toBeNull()
    expect(content).toContain('spec_version: "V_0-3-0"')
    expect(content).toContain(
      'parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md"',
    )
  })

  it('verifies iNNfo V_0-3-0 defines knowledge and blueprint keys and types', () => {
    const content = getCanonicalSpecContent('iNNfo_V_0-3-0_NN')!
    expect(content).not.toBeNull()
    expect(content).toContain('knowledge_version')
    expect(content).toContain('blueprint_version')
    expect(content).toContain('blueprint_name')
    expect(content).toContain('knowledge_dir')
    expect(content).toContain('blueprints_dir')
    expect(content).toContain('target_blueprint')
    expect(content).toContain('knowledge')
  })

  it('does not truncate or mis-split names with embedded NN token', () => {
    const def = findCanonicalBlueprint('defiNNition_V_0-1-0_NN.md')
    expect(def).not.toBeNull()
    expect(def?.name).toBe('defiNNition')
  })

  it('returns null for unregistered _V_ spec files', () => {
    expect(findCanonicalBlueprint('unregistered_spec_V_9-9-9_NN.md')).toBeNull()
    expect(findCanonicalBlueprint('custom_template_V_8-8-8_NN.md')).toBeNull()
  })

  it('mirrors on-disk defiNNition and iNNfo V_0-3-0 specs byte-for-byte in canonical registry', () => {
    const defDisk = readFileSync(join(specsRoot, 'defiNNition_V_0-1-0_NN.md'), 'utf-8')
    const defMirror = getCanonicalSpecContent('defiNNition')!
    expect(defMirror).toBe(defDisk)

    const innfoDisk = readFileSync(join(specsRoot, 'iNNfo_V_0-3-0_NN.md'), 'utf-8')
    const innfoMirror = getCanonicalSpecContent('innfo')!
    expect(innfoMirror).toBe(innfoDisk)
  })

  it('mirrors the workspace and artifacts V_0-2-2 templates without drift', () => {
    for (const [template, specPath] of [
      ['workspace', 'bluepriNNts/workspace_spec_NN.md'],
      ['artifacts', 'bluepriNNts/artifacts/spec_NN.md'],
    ] as const) {
      const disk = readFileSync(join(specsRoot, specPath), 'utf-8')
      const mirror = getCanonicalSpecContent(template)!

      expect(mirror, `${template} mirror exists`).not.toBeNull()
      expect(mirror, `${template} mirror carries a V_0 spec_version`).toContain('spec_version: "V_0-')
      expect(fieldNameTypes(mirror), `${template} field name=type drift`).toEqual(
        fieldNameTypes(disk),
      )
    }
  })
})

