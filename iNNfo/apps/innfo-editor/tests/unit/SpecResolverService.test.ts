import { describe, it, expect } from 'vitest'
import { warmTemplateCache } from '../../src/services/SpecResolverService'

describe('warmTemplateCache', () => {
  it('resolves a template named by a seed ref from the workspace specs/ directory into a composed BlueprintSchema map, keyed lowercased', async () => {
    const { buildFakeTree } = await import('../helpers/fakeFs')

    const specMd = [
      '---',
      'specification_version: "V_1-0-0"',
      'specification_url: "https://example.com/test-template"',
      'level: 2',
      'title: "Test Template"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Market',
      'type:: weight',
      'color:: blue',
      '',
      '# NN Field Definition',
      '',
      '## NN Field Definition: submodel_ref',
      'concept:: Market',
      'type:: knowledge',
      'target_blueprint:: sub_template',
    ].join('\n')

    const fakeTree = buildFakeTree('workspace', {
      specs: {
        'test-template_V_1-0-0_NN.md': specMd,
      },
    })

    const cache = await warmTemplateCache(fakeTree, [{ name: 'test-template_V_1-0-0' }])

    const schema = cache.get('test-template_v_1-0-0')
    expect(schema).toBeDefined()
    expect(schema!.concepts[0]!.name).toBe('Market')
    expect(schema!.concepts[0]!.fields?.[0]!.name).toBe('submodel_ref')
    expect(schema!.concepts[0]!.fields?.[0]!.type).toBe('knowledge')
  })

  it('returns an empty map when no seed refs are supplied and no root-level file declares a parent_spec', async () => {
    const { buildFakeTree } = await import('../helpers/fakeFs')
    const fakeTree = buildFakeTree('workspace', { 'index.md': '# NN index' })

    const cache = await warmTemplateCache(fakeTree)

    expect(cache.size).toBe(0)
  })
})
