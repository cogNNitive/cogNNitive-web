import { describe, it, expect } from 'vitest'
import {
  normalizeModelPath,
  extractModelBasename,
  findMatchingModelNode,
  modelStemMatches,
} from '../../src/utils/modelMatching'
import type { ModelNode } from '../../src/model/types'

function makeNode(id: string, path: string, name?: string): ModelNode {
  return {
    id,
    name: name || id,
    parentId: null,
    childIds: [],
    storageMode: 'FILE',
    type: 'text',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path },
  }
}

describe('modelMatching utility', () => {
  it('normalizes paths, trims wikilinks and backslashes', () => {
    expect(normalizeModelPath('[[kNNowledge/test.md]]')).toBe('kNNowledge/test.md')
    expect(normalizeModelPath('models\\test_NN.md')).toBe('kNNowledge/test_NN.md')
    expect(normalizeModelPath('  [[  models\\nested\\doc.md ]] ')).toBe('kNNowledge/nested/doc.md')
  })

  it('extracts basename correctly', () => {
    expect(extractModelBasename('kNNowledge/rehabilitacion_NN.md')).toBe('rehabilitacion_NN')
    expect(extractModelBasename('models\\nested\\rehabilitacion.md')).toBe('rehabilitacion')
    expect(extractModelBasename('[[rehabilitacion]]')).toBe('rehabilitacion')
  })

  it('finds matching node by Windows path against POSIX target', () => {
    const node = makeNode(
      'kNNowledge/rehabilitacion_NN.md',
      'models\\rehabilitacion_reja_pozuelo_V_0-1-0_rejas_rehabilitacion_NN.md',
    )
    const match = findMatchingModelNode(
      [node],
      'kNNowledge/rehabilitacion_reja_pozuelo_V_0-1-0_rejas_rehabilitacion_NN.md',
    )
    expect(match).toBeDefined()
    expect(match?.id).toBe(node.id)
  })

  it('finds matching node by basename when target has full path', () => {
    const node = makeNode('rehabilitacion_node', 'rehabilitacion_reja_pozuelo_V_0-1-0_rejas_rehabilitacion_NN.md')
    const match = findMatchingModelNode(
      [node],
      'kNNowledge/rehabilitacion_reja_pozuelo_V_0-1-0_rejas_rehabilitacion_NN.md',
    )
    expect(match).toBeDefined()
  })

  it('finds matching node when target has wikilinks', () => {
    const node = makeNode('kNNowledge/foo.md', 'kNNowledge/foo.md', 'Foo Model')
    const match = findMatchingModelNode([node], '[[kNNowledge/foo.md]]')
    expect(match).toBeDefined()
  })

  it('modelStemMatches matches full stem, _NN suffix and submodel suffix', () => {
    expect(
      modelStemMatches('rehabilitacion_reja_pozuello_V_0-1-0_rejas_rehabilitacion_NN.md', 'rehabilitacion_reja_pozuello_V_0-1-0_rejas_rehabilitacion'),
    ).toBe(true)
    expect(
      modelStemMatches('rejas_rehabilitacion_NN.md', 'rejas_rehabilitacion'),
    ).toBe(true)
    expect(
      modelStemMatches('kNNowledge/rehabilitacion_reja_pozuello_V_0-1-0_rejas_rehabilitacion_NN.md', 'rejas_rehabilitacion'),
    ).toBe(true)
  })

  it('modelStemMatches rejects unrelated files and empty targets', () => {
    expect(modelStemMatches('ghostbusters_V_0-2-0_business_NN.md', 'rejas_rehabilitacion')).toBe(false)
    expect(modelStemMatches('not_a_model.txt', 'rejas_rehabilitacion')).toBe(false)
    expect(modelStemMatches('rejas_rehabilitacion_NN.md', '')).toBe(false)
    expect(modelStemMatches('rejas_rehabilitacion_NN.md', '  ')).toBe(false)
  })
})
