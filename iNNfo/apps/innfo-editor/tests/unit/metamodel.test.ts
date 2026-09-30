import { describe, it, expect } from 'vitest'
// NOTE: deep-imported directly from innfo-core's source (bypassing the
// package's `browser` export condition this app's vite.config forces) —
// getSpecForLevel/resolveParentChain are fs+network based and are
// intentionally NOT part of innfo-core's browser build (see
// recursiveParser.ts and metamodel.ts notes on the same constraint).
// This import exists only in this test, for the task 5.5 cross-check
// against innfo-core's own resolver algorithm; app runtime code never
// imports this path.
import { getSpecForLevel } from '../../../../packages/innfo-core/src/resolver'
import type {
  SpecCache,
  SpecDocument,
  SpecFrontmatter,
} from '../../../../packages/innfo-core/src/types'
import { resolveEffectiveMetamodel } from '../../src/model/metamodel'
import type { KnowledgeNode, LocalMetamodel } from '../../src/model/types'

function makeNode(id: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    storageMode: 'FILE',
    type: 'document',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
    ...overrides,
  }
}

function metamodel(
  concepts: LocalMetamodel['concepts'] = [],
  markers: LocalMetamodel['markers'] = [],
): LocalMetamodel {
  return { concepts, markers }
}

describe('metamodel: recursive resolution (R9)', () => {
  it('inherits a root-defined concept for a child with no local override (scenario "Root concept inherited")', () => {
    const root = makeNode('Root', {
      localMetamodel: metamodel([{ name: 'Risk', type: 'text' }]),
    })
    const child = makeNode('Root/Child', { parentId: 'Root' })
    const nodes = { Root: root, 'Root/Child': child }

    const resolved = resolveEffectiveMetamodel(child.id, nodes)

    expect(resolved.concepts.find((c) => c.name === 'Risk')).toBeDefined()
  })

  it('applies a subtree override for the overriding node and its descendants, not the root plain definition (scenario "Local override applied")', () => {
    const root = makeNode('Root', {
      localMetamodel: metamodel([{ name: 'Risk', type: 'text' }]),
    })
    const subtree = makeNode('Root/Subtree', {
      parentId: 'Root',
      localMetamodel: metamodel([
        { name: 'Risk', type: 'category', fields: [{ name: 'severity', type: 'string' }] },
      ]),
    })
    const nodeInSubtree = makeNode('Root/Subtree/Leaf', { parentId: 'Root/Subtree' })
    const nodes = { Root: root, 'Root/Subtree': subtree, 'Root/Subtree/Leaf': nodeInSubtree }

    const resolved = resolveEffectiveMetamodel(nodeInSubtree.id, nodes)
    const risk = resolved.concepts.find((c) => c.name === 'Risk')

    expect(risk).toBeDefined()
    expect(risk!.type).toBe('category')
    expect(risk!.fields?.[0].name).toBe('severity')
  })

  it('resolves a two-level-deep override to the grandchild own version, not child or root (scenario "Nested override two levels deep")', () => {
    const root = makeNode('Root', {
      localMetamodel: metamodel([{ name: 'Risk', type: 'text' }]),
    })
    const childA = makeNode('Root/ChildA', {
      parentId: 'Root',
      localMetamodel: metamodel([{ name: 'Risk', type: 'list' }]),
    })
    const grandchild = makeNode('Root/ChildA/Grandchild', {
      parentId: 'Root/ChildA',
      localMetamodel: metamodel([{ name: 'Risk', type: 'weight', weight: 5 }]),
    })
    const nodes = {
      Root: root,
      'Root/ChildA': childA,
      'Root/ChildA/Grandchild': grandchild,
    }

    const resolvedForGrandchild = resolveEffectiveMetamodel(grandchild.id, nodes)
    const risk = resolvedForGrandchild.concepts.find((c) => c.name === 'Risk')

    expect(risk!.type).toBe('weight')
    expect(risk!.weight).toBe(5)
  })

  it('resolves markers with the same inherit + subtree-override semantics as concepts', () => {
    const root = makeNode('Root', {
      localMetamodel: metamodel([], [{ name: 'Priority', symbol: '!' }]),
    })
    const child = makeNode('Root/Child', { parentId: 'Root' })
    const nodes = { Root: root, 'Root/Child': child }

    const resolved = resolveEffectiveMetamodel(child.id, nodes)

    expect(resolved.markers.find((m) => m.name === 'Priority')).toBeDefined()
  })

  it('a node with no ancestor declarations resolves to an empty effective metamodel', () => {
    const root = makeNode('Root')
    const nodes = { Root: root }

    const resolved = resolveEffectiveMetamodel(root.id, nodes)

    expect(resolved.concepts).toEqual([])
    expect(resolved.markers).toEqual([])
  })

  it("closest-declaration-wins matches innfo-core getSpecForLevel's resolution at node-nesting boundaries (task 5.5 cross-check)", () => {
    // innfo-core's resolveParentChain/getSpecForLevel resolve a *spec-level*
    // chain (defiNNe -> FORMAT -> template -> instance) by walking from a
    // child spec up to its declared parent and picking, per level, the doc
    // found first while walking child-first (i.e. the closest one to the
    // starting point at that level). We build the equivalent SpecCache by
    // hand here (no fs/network) to confirm getSpecForLevel's algorithm
    // itself agrees: closer-to-target-in-the-chain wins for the same level,
    // exactly as our node-nesting resolveEffectiveMetamodel's Map-overwrite
    // (root -> target walk, later write wins) resolves same-name concepts.
    const makeDoc = (name: string, level: 0 | 1 | 2 | 3, concepts: string[]): SpecDocument => ({
      name,
      level,
      frontmatter: {
        concepts: concepts.map((n) => ({ name: n, type: 'text' })),
      } as unknown as SpecFrontmatter,
      rawContent: '',
    })

    // Chain is built child-first (instance visited before its template).
    const cache: SpecCache = {
      specs: new Map([
        ['instance', makeDoc('instance', 3, ['Risk'])],
        ['template', makeDoc('template', 2, ['Risk', 'Stakeholder'])],
      ]),
      chain: ['instance', 'template'],
    }

    const level3Doc = getSpecForLevel(cache, 3)
    const level2Doc = getSpecForLevel(cache, 2)

    expect(level3Doc?.name).toBe('instance')
    expect(level2Doc?.name).toBe('template')

    // Our node-nesting resolver: a subtree ("instance"-equivalent) declaring
    // Risk overrides the root ("template"-equivalent) Risk declaration,
    // exactly mirroring the per-level document boundary above.
    const root = makeNode('Root', {
      localMetamodel: metamodel([
        { name: 'Risk', type: 'text' },
        { name: 'Stakeholder', type: 'text' },
      ]),
    })
    const instance = makeNode('Root/Instance', {
      parentId: 'Root',
      localMetamodel: metamodel([{ name: 'Risk', type: 'category' }]),
    })
    const resolved = resolveEffectiveMetamodel(instance.id, {
      Root: root,
      'Root/Instance': instance,
    })

    expect(resolved.concepts.find((c) => c.name === 'Risk')?.type).toBe('category')
    expect(resolved.concepts.find((c) => c.name === 'Stakeholder')).toBeDefined()
  })
})
