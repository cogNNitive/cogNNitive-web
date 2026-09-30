import { describe, it, expect, vi } from 'vitest'
import { parseYaml, parseFrontmatter } from './yaml.js'
import { parseModel } from './core.js'

describe('parseYaml error surfacing', () => {
  it('still returns {} on malformed YAML but reports through onError', () => {
    const onError = vi.fn()
    const result = parseYaml('a: [1, 2\nb: : :', onError)
    expect(result).toEqual({})
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toMatch(/Frontmatter YAML failed to parse/)
  })

  it('does not call onError for valid YAML', () => {
    const onError = vi.fn()
    expect(parseYaml('a: 1', onError)).toEqual({ a: 1 })
    expect(onError).not.toHaveBeenCalled()
  })

  it('parseFrontmatter threads onError through', () => {
    const onError = vi.fn()
    parseFrontmatter('---\nx: [unclosed\n---\nbody', onError)
    expect(onError).toHaveBeenCalledOnce()
  })

  it('parseModel records a frontmatter parse error in parseWarnings instead of swallowing it', () => {
    const model = parseModel('---\nbroken: : :\n  - nope\n---\n\n# NN index\n')
    expect(model.parseWarnings ?? []).toEqual(
      expect.arrayContaining([expect.stringMatching(/Frontmatter YAML failed to parse/)]),
    )
  })

  it('a clean document produces no parse warnings', () => {
    const model = parseModel('---\nlevel: 3\n---\n\n# NN index\n')
    expect(model.parseWarnings).toBeUndefined()
  })

  it('handles UTF-8 BOM transparently in parseYaml', () => {
    const onError = vi.fn()
    const result = parseYaml('\uFEFFknowledge_version: V_0-1-0\nlevel: 3', onError)
    expect(result).toEqual({ knowledge_version: 'V_0-1-0', level: 3 })
    expect(onError).not.toHaveBeenCalled()
  })

  it('handles UTF-8 BOM transparently in parseFrontmatter', () => {
    const onError = vi.fn()
    const content = '\uFEFF---\nknowledge_version: V_0-1-0\nlevel: 3\n---\n\n# NN index\n'
    const fm = parseFrontmatter(content, onError)
    expect(fm).toBeDefined()
    expect(fm?.knowledge_version).toBe('V_0-1-0')
    expect(fm?.level).toBe(3)
    expect(onError).not.toHaveBeenCalled()
  })

  it('parses model starting with UTF-8 BOM cleanly', () => {
    const content = '\uFEFF---\nknowledge_version: V_0-1-0\nlevel: 3\n---\n\n# NN index\n* [[ConceptA]]\n\n# NN ConceptA\n## NN ConceptA: Item1\n'
    const model = parseModel(content)
    expect(model.frontmatter.knowledge_version).toBe('V_0-1-0')
    expect(model.elements.get('ConceptA')).toHaveLength(1)
    expect(model.parseWarnings).toBeUndefined()
  })
})
