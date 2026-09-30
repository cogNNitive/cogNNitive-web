import { describe, it, expect } from 'vitest'
import {
  QUALIFIED_REF_RE,
  parseQualifiedRef,
  collectQualifiedReferenceCandidates,
  validateWorkspaceReferences,
  MissingWorkspaceIndexError,
} from '../src/validator/workspaceReferences'
import { buildWorkspaceIndex, type WorkspaceIndex } from '../src/recursiveParser/workspaceIndex'
import type { ParseIssue, RecursiveParseResult } from '../src/recursiveParser/types'
import type { KnowledgeNode, Concept } from '../src/types'
import type { BlueprintSchema } from '../src/schema'
import { validateFormatContent } from '../src/validator/content'

function field(value: unknown): KnowledgeNode['fields'][string] {
  return { value, editAttribution: { author: { kind: 'system', id: 'test' }, timestamp: '' } }
}

function makeSchema(concepts: Concept[]): BlueprintSchema {
  return { concepts, markers: [], matrices: [], taxonomy: [] }
}

function emptyIndex(overrides: Partial<WorkspaceIndex> = {}): WorkspaceIndex {
  return {
    pathToNodeId: {},
    titleToNodeIds: {},
    fileNameToNodeIds: {},
    nodeTemplate: {},
    nodeElementConcepts: {},
    nodeSchema: {},
    extraParents: {},
    missing: [],
    issues: [],
    ...overrides,
  }
}

/** Builds a minimal root + one child element node, wired via parentId/childIds. */
function makeRootAndElement(opts: {
  elementType: string
  fields: Record<string, unknown>
  description?: string
}): { result: RecursiveParseResult; root: KnowledgeNode; element: KnowledgeNode } {
  const root: KnowledgeNode = {
    id: 'root-1',
    name: 'root_01',
    parentId: null,
    childIds: ['elem-1'],
    type: 'document',
    kind: 'root',
    fields: { title: field('Root Model') },
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: 'root_01.md' },
  }
  const element: KnowledgeNode = {
    id: 'elem-1',
    name: 'Jane Doe',
    parentId: 'root-1',
    childIds: [],
    type: opts.elementType,
    kind: 'element',
    fields: Object.fromEntries(Object.entries(opts.fields).map(([k, v]) => [k, field(v)])),
    markers: {},
    relationships: [],
    rawSections: opts.description ? { description: opts.description } : {},
    source: { path: 'root_01.md' },
  }
  const result: RecursiveParseResult = {
    nodes: { [root.id]: root, [element.id]: element },
    rootIds: [root.id],
    issues: [],
  }
  return { result, root, element }
}

describe('QUALIFIED_REF_RE / parseQualifiedRef', () => {
  it('qualified-ref-parsing: only the qualified `[[Title :: Element]]` form parses', () => {
    const cases: Array<[string, { modelTitle: string; elementName: string } | null]> = [
      ['[[A :: B]]', { modelTitle: 'A', elementName: 'B' }],
      ['[[ A::B ]]', { modelTitle: 'A', elementName: 'B' }],
      ['[[A]]', null],
      ['A :: B', null],
      ['[[A :: B :: C]]', { modelTitle: 'A', elementName: 'B :: C' }],
    ]

    for (const [input, expected] of cases) {
      const result = parseQualifiedRef(input)
      if (expected === null) {
        expect(result, `expected null for ${JSON.stringify(input)}`).toBeNull()
      } else {
        expect(result, `expected a match for ${JSON.stringify(input)}`).not.toBeNull()
        expect(result!.modelTitle).toBe(expected.modelTitle)
        expect(result!.elementName).toBe(expected.elementName)
        expect(result!.raw).toBe(input)
      }
    }
  })

  it('QUALIFIED_REF_RE is anchored (no partial-string matches)', () => {
    expect(QUALIFIED_REF_RE.test('prefix [[A :: B]] suffix')).toBe(false)
    expect(QUALIFIED_REF_RE.test('[[A :: B]]')).toBe(true)
  })
})

describe('collectQualifiedReferenceCandidates', () => {
  it('untyped-field-ignored: only reference/model typed fields are collected, string fields are not', () => {
    const schema = makeSchema([
      {
        name: 'Person',
        type: 'text',
        fields: [
          { name: 'bio', type: 'string' },
          { name: 'contact', type: 'reference' },
        ],
      },
    ])
    const { result } = makeRootAndElement({
      elementType: 'Person',
      fields: {
        bio: '[[Acme Org :: Jane Doe]]', // qualified-shaped, but the field is untyped (string)
        contact: '[[Acme Org :: Jane Doe]]', // typed reference — must be collected
      },
    })
    const index = emptyIndex({ nodeSchema: { 'root-1': schema } })

    const candidates = collectQualifiedReferenceCandidates(result, index)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].fieldDef.name).toBe('contact')
    expect(candidates[0].ref).toEqual({
      modelTitle: 'Acme Org',
      elementName: 'Jane Doe',
      raw: '[[Acme Org :: Jane Doe]]',
    })
  })

  it('a `model`-typed field is collected the same as a `reference`-typed field', () => {
    const schema = makeSchema([
      {
        name: 'Models',
        type: 'knowledge',
        fields: [{ name: 'manifest', type: 'knowledge' }],
      },
    ])
    const { result } = makeRootAndElement({
      elementType: 'Models',
      fields: { manifest: '[[Acme Org :: Jane Doe]]' },
    })
    const index = emptyIndex({ nodeSchema: { 'root-1': schema } })

    const candidates = collectQualifiedReferenceCandidates(result, index)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].fieldDef.type).toBe('knowledge')
  })

  it('prose-not-scanned: qualified-looking text in element prose (rawSections.description) is not a field value and is never collected', () => {
    const schema = makeSchema([
      {
        name: 'Person',
        type: 'text',
        fields: [{ name: 'contact', type: 'reference' }],
      },
    ])
    const { result, element } = makeRootAndElement({
      elementType: 'Person',
      fields: { contact: '[[Acme Org :: Jane Doe]]' },
      description: 'See also [[Other Model :: Someone Else]] for context.',
    })
    const index = emptyIndex({ nodeSchema: { 'root-1': schema } })

    // Sanity: the prose text really is qualified-ref shaped and really is on the node.
    expect(element.rawSections.description).toContain('[[Other Model :: Someone Else]]')

    const candidates = collectQualifiedReferenceCandidates(result, index)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].ref.modelTitle).toBe('Acme Org')
  })

  it('intra-model-refs-untouched: an unqualified `[[Element]]` value in a typed field is not collected', () => {
    const schema = makeSchema([
      {
        name: 'Person',
        type: 'text',
        fields: [{ name: 'contact', type: 'reference' }],
      },
    ])
    const { result } = makeRootAndElement({
      elementType: 'Person',
      fields: { contact: '[[Jane Doe]]' },
    })
    const index = emptyIndex({ nodeSchema: { 'root-1': schema } })

    const candidates = collectQualifiedReferenceCandidates(result, index)

    expect(candidates).toHaveLength(0)
  })

  it('no-schema-node-skipped: a root with no resolvable template schema is skipped gracefully, not an error', () => {
    const { result } = makeRootAndElement({
      elementType: 'Person',
      fields: { contact: '[[Acme Org :: Jane Doe]]' },
    })
    const index = emptyIndex() // nodeSchema deliberately empty — resolver never produced one

    expect(() => collectQualifiedReferenceCandidates(result, index)).not.toThrow()
    expect(collectQualifiedReferenceCandidates(result, index)).toHaveLength(0)
  })
})

/** Builds a root node directly (bypassing `recursiveParse`), for multi-model `checkOne` fixtures. */
function makeRoot(opts: {
  id: string
  path: string
  title?: string
  templateSchema?: BlueprintSchema
  parentSpec?: { name: string; url?: string }
  childIds?: string[]
}): KnowledgeNode {
  return {
    id: opts.id,
    name: opts.id,
    parentId: null,
    childIds: opts.childIds ?? [],
    type: 'document',
    kind: 'root',
    fields: {
      ...(opts.title !== undefined ? { title: field(opts.title) } : {}),
      ...(opts.parentSpec ? { parent_spec: field(opts.parentSpec) } : {}),
    },
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: opts.path },
    ...(opts.templateSchema ? { templateSchema: opts.templateSchema } : {}),
  }
}

/** Builds an element node wired under `parentId`, for multi-model `checkOne` fixtures. */
function makeElement(opts: {
  id: string
  name: string
  parentId: string
  parentPath: string
  elementType: string
  fields?: Record<string, unknown>
}): KnowledgeNode {
  return {
    id: opts.id,
    name: opts.name,
    parentId: opts.parentId,
    childIds: [],
    type: opts.elementType,
    kind: 'element',
    fields: Object.fromEntries(Object.entries(opts.fields ?? {}).map(([k, v]) => [k, field(v)])),
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: opts.parentPath },
  }
}

/** Assembles a `RecursiveParseResult` from flat nodes and derives its `WorkspaceIndex` via PR4's real `buildWorkspaceIndex` (dogfooding the index this validator consumes). */
function workspace(
  nodesArr: KnowledgeNode[],
  issues: ParseIssue[] = [],
): { result: RecursiveParseResult; index: WorkspaceIndex } {
  const nodes: Record<string, KnowledgeNode> = {}
  for (const n of nodesArr) nodes[n.id] = n
  const rootIds = nodesArr.filter((n) => n.kind === 'root').map((n) => n.id)
  const result: RecursiveParseResult = { nodes, rootIds, issues }
  return { result, index: buildWorkspaceIndex(result) }
}

describe('validateWorkspaceReferences — checkOne', () => {
  it('resolves-valid-cross-model-ref: a valid qualified reference produces zero diagnostics', () => {
    const targetSchema = makeSchema([{ name: 'Person', type: 'text', fields: [] }])
    const referrerSchema = makeSchema([
      { name: 'Founder', type: 'text', fields: [{ name: 'fundadores', type: 'reference' }] },
    ])
    const target = makeRoot({
      id: 'target',
      path: 'acme_org.md',
      title: 'Acme Org',
      templateSchema: targetSchema,
      childIds: ['jane'],
    })
    const jane = makeElement({
      id: 'jane',
      name: 'Jane Doe',
      parentId: 'target',
      parentPath: 'acme_org.md',
      elementType: 'Person',
    })
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['founder-elem'],
    })
    const founderElem = makeElement({
      id: 'founder-elem',
      name: 'Some Founder',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Founder',
      fields: { fundadores: '[[Acme Org :: Jane Doe]]' },
    })

    const { result, index } = workspace([target, jane, referrer, founderElem])

    // Sanity: no duplicate-title noise from the index that would confound the assertion below.
    expect(index.issues).toHaveLength(0)

    expect(validateWorkspaceReferences(result, index)).toEqual([])
  })

  it('dangling-model-errors: an unresolvable model title reports one error diagnostic', () => {
    const referrerSchema = makeSchema([
      { name: 'Founder', type: 'text', fields: [{ name: 'fundadores', type: 'reference' }] },
    ])
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['founder-elem'],
    })
    const founderElem = makeElement({
      id: 'founder-elem',
      name: 'Some Founder',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Founder',
      fields: { fundadores: '[[Nonexistent Model :: Jane Doe]]' },
    })

    const { result, index } = workspace([referrer, founderElem])
    const diagnostics = validateWorkspaceReferences(result, index)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].severity).toBe('error')
    expect(diagnostics[0].message).toContain('Nonexistent Model')
    expect(diagnostics[0].message).toContain('not present in this workspace')
  })

  it('dangling-element-errors: a resolvable model with a missing element reports one error diagnostic', () => {
    const targetSchema = makeSchema([{ name: 'Person', type: 'text', fields: [] }])
    const referrerSchema = makeSchema([
      { name: 'Founder', type: 'text', fields: [{ name: 'fundadores', type: 'reference' }] },
    ])
    const target = makeRoot({
      id: 'target',
      path: 'acme_org.md',
      title: 'Acme Org',
      templateSchema: targetSchema,
      childIds: ['jane'],
    })
    const jane = makeElement({
      id: 'jane',
      name: 'Jane Doe',
      parentId: 'target',
      parentPath: 'acme_org.md',
      elementType: 'Person',
    })
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['founder-elem'],
    })
    const founderElem = makeElement({
      id: 'founder-elem',
      name: 'Some Founder',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Founder',
      fields: { fundadores: '[[Acme Org :: Nonexistent Person]]' },
    })

    const { result, index } = workspace([target, jane, referrer, founderElem])
    const diagnostics = validateWorkspaceReferences(result, index)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].severity).toBe('error')
    expect(diagnostics[0].message).toContain('Nonexistent Person')
    expect(diagnostics[0].message).toContain('Acme Org')
  })

  it('dangling-model-mentions-missing-file: the MODEL_NOT_FOUND hint appears when a missing submodel basename matches the target', () => {
    const referrerSchema = makeSchema([
      { name: 'Founder', type: 'text', fields: [{ name: 'fundadores', type: 'reference' }] },
    ])
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['founder-elem'],
    })
    const founderElem = makeElement({
      id: 'founder-elem',
      name: 'Some Founder',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Founder',
      fields: { fundadores: '[[acme_org :: Jane Doe]]' },
    })
    const issues: ParseIssue[] = [
      {
        path: 'submodels/acme_org.md',
        message: 'referenced but not found',
        severity: 'error',
        code: 'MODEL_NOT_FOUND',
      },
    ]

    const { result, index } = workspace([referrer, founderElem], issues)

    // Sanity: the missing-file basename really is what checkOne must match against.
    expect(index.missing).toContain('submodels/acme_org.md')

    const diagnostics = validateWorkspaceReferences(result, index)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].severity).toBe('error')
    expect(diagnostics[0].message).toContain('not present in this workspace')
    expect(diagnostics[0].message).toContain('the file was not found')
  })

  it('duplicate-title-error: the index reports the duplicate title once; checkOne reports use-site ambiguity separately, not a re-emission', () => {
    const targetSchema = makeSchema([{ name: 'Person', type: 'text', fields: [] }])
    const rootA = makeRoot({
      id: 'root-a',
      path: 'a/acme_org.md',
      title: 'Acme Org',
      templateSchema: targetSchema,
      childIds: ['jane-a'],
    })
    const janeA = makeElement({
      id: 'jane-a',
      name: 'Jane Doe',
      parentId: 'root-a',
      parentPath: 'a/acme_org.md',
      elementType: 'Person',
    })
    const rootB = makeRoot({
      id: 'root-b',
      path: 'b/acme_org.md',
      title: 'Acme Org',
      templateSchema: targetSchema,
      childIds: ['jane-b'],
    })
    const janeB = makeElement({
      id: 'jane-b',
      name: 'Jane Doe',
      parentId: 'root-b',
      parentPath: 'b/acme_org.md',
      elementType: 'Person',
    })
    const referrerSchema = makeSchema([
      { name: 'Founder', type: 'text', fields: [{ name: 'fundadores', type: 'reference' }] },
    ])
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['founder-elem'],
    })
    const founderElem = makeElement({
      id: 'founder-elem',
      name: 'Some Founder',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Founder',
      fields: { fundadores: '[[Acme Org :: Jane Doe]]' },
    })

    const { result, index } = workspace([rootA, janeA, rootB, janeB, referrer, founderElem])

    // PR4's buildWorkspaceIndex already emitted the duplicate-title error.
    const duplicateIssues = index.issues.filter((i) => i.message.includes('Duplicate model title'))
    expect(duplicateIssues).toHaveLength(1)
    expect(duplicateIssues[0].severity).toBe('error')

    const diagnostics = validateWorkspaceReferences(result, index)

    // checkOne reports exactly one use-site ambiguity error — not a second copy of the duplicate-title error.
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].severity).toBe('error')
    expect(diagnostics[0].message).toContain('Ambiguous cross-model reference')
    expect(diagnostics[0].message).not.toContain('Duplicate model title')
  })

  it('filename-fallback-resolves: a title-less model resolves via fileNameToNodeIds with zero diagnostics', () => {
    const targetSchema = makeSchema([{ name: 'Person', type: 'text', fields: [] }])
    const target = makeRoot({
      id: 'target',
      path: 'kNNowledge/acme_org.md',
      templateSchema: targetSchema,
      childIds: ['jane'],
    }) // no title
    const jane = makeElement({
      id: 'jane',
      name: 'Jane Doe',
      parentId: 'target',
      parentPath: 'kNNowledge/acme_org.md',
      elementType: 'Person',
    })
    const referrerSchema = makeSchema([
      { name: 'Founder', type: 'text', fields: [{ name: 'fundadores', type: 'reference' }] },
    ])
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['founder-elem'],
    })
    const founderElem = makeElement({
      id: 'founder-elem',
      name: 'Some Founder',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Founder',
      fields: { fundadores: '[[acme_org :: Jane Doe]]' },
    })

    const { result, index } = workspace([target, jane, referrer, founderElem])

    // Sanity: title-based resolution is genuinely unavailable; only the filename ladder tier can resolve this.
    expect(Object.keys(index.titleToNodeIds)).not.toContain('acme_org')
    expect(index.fileNameToNodeIds['acme_org']).toEqual(['target'])

    expect(validateWorkspaceReferences(result, index)).toEqual([])
  })

  it('normalized-title-fallback-warns: a dash-variant title resolves via the normalized ladder tier with one warning, no error', () => {
    const targetSchema = makeSchema([{ name: 'Person', type: 'text', fields: [] }])
    const target = makeRoot({
      id: 'target',
      path: 'acme-org.md',
      title: 'Acme-Org',
      templateSchema: targetSchema,
      childIds: ['jane'],
    })
    const jane = makeElement({
      id: 'jane',
      name: 'Jane Doe',
      parentId: 'target',
      parentPath: 'acme-org.md',
      elementType: 'Person',
    })
    const referrerSchema = makeSchema([
      { name: 'Founder', type: 'text', fields: [{ name: 'fundadores', type: 'reference' }] },
    ])
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['founder-elem'],
    })
    const founderElem = makeElement({
      id: 'founder-elem',
      name: 'Some Founder',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Founder',
      // En dash (U+2013), not the ASCII hyphen the target's title actually uses.
      fields: { fundadores: '[[Acme–Org :: Jane Doe]]' },
    })

    const { result, index } = workspace([target, jane, referrer, founderElem])
    const diagnostics = validateWorkspaceReferences(result, index)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].severity).toBe('warning')
    expect(diagnostics[0].message).toContain('separator normalization')
  })

  it('concept-mismatch-warns: a target_concepts mismatch reports one warning, no error', () => {
    const targetSchema = makeSchema([{ name: 'Employee', type: 'text', fields: [] }])
    const target = makeRoot({
      id: 'target',
      path: 'acme_org.md',
      title: 'Acme Org',
      templateSchema: targetSchema,
      childIds: ['jane'],
    })
    const jane = makeElement({
      id: 'jane',
      name: 'Jane Doe',
      parentId: 'target',
      parentPath: 'acme_org.md',
      elementType: 'Employee', // not Founder — the field only accepts Founder
    })
    const referrerSchema = makeSchema([
      {
        name: 'Founder',
        type: 'text',
        fields: [{ name: 'fundadores', type: 'reference', target_concepts: ['Founder'] }],
      },
    ])
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['founder-elem'],
    })
    const founderElem = makeElement({
      id: 'founder-elem',
      name: 'Some Founder',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Founder',
      fields: { fundadores: '[[Acme Org :: Jane Doe]]' },
    })

    const { result, index } = workspace([target, jane, referrer, founderElem])
    const diagnostics = validateWorkspaceReferences(result, index)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].severity).toBe('warning')
    expect(diagnostics[0].message).toContain('Employee')
    expect(diagnostics[0].message).toContain('target_concepts')
  })

  it('template-mismatch-warns: a target_blueprint mismatch reports one warning, no error', () => {
    const targetSchema = makeSchema([{ name: 'Person', type: 'text', fields: [] }])
    const target = makeRoot({
      id: 'target',
      path: 'business_co.md',
      title: 'Business Co',
      templateSchema: targetSchema,
      parentSpec: { name: 'procedures_V_0-2-0' },
      childIds: ['jane'],
    })
    const jane = makeElement({
      id: 'jane',
      name: 'Jane Doe',
      parentId: 'target',
      parentPath: 'business_co.md',
      elementType: 'Person',
    })
    const referrerSchema = makeSchema([
      {
        name: 'Models',
        type: 'knowledge',
        fields: [{ name: 'business_model', type: 'knowledge', target_blueprint: 'business_V_0-2-0' }],
      },
    ])
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['ref-elem'],
    })
    const refElem = makeElement({
      id: 'ref-elem',
      name: 'Some Ref',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Models',
      fields: { business_model: '[[Business Co :: Jane Doe]]' },
    })

    const { result, index } = workspace([target, jane, referrer, refElem])
    const diagnostics = validateWorkspaceReferences(result, index)

    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].severity).toBe('warning')
    expect(diagnostics[0].message).toContain('business_V_0-2-0')
    expect(diagnostics[0].message).toContain('procedures_V_0-2-0')
  })
})

describe('validateWorkspaceReferences — canonical multivalue syntax (validator-robustness Unit 2)', () => {
  function twoPersonWorkspace(fieldValue: unknown): {
    result: RecursiveParseResult
    index: WorkspaceIndex
  } {
    const targetSchema = makeSchema([{ name: 'Person', type: 'text', fields: [] }])
    const referrerSchema = makeSchema([
      { name: 'Team', type: 'text', fields: [{ name: 'members', type: 'reference' }] },
    ])
    const target = makeRoot({
      id: 'target',
      path: 'acme_org.md',
      title: 'Acme Org',
      templateSchema: targetSchema,
      childIds: ['jane', 'john'],
    })
    const jane = makeElement({
      id: 'jane',
      name: 'Jane Doe',
      parentId: 'target',
      parentPath: 'acme_org.md',
      elementType: 'Person',
    })
    const john = makeElement({
      id: 'john',
      name: 'John Smith',
      parentId: 'target',
      parentPath: 'acme_org.md',
      elementType: 'Person',
    })
    const referrer = makeRoot({
      id: 'referrer',
      path: 'referrer.md',
      title: 'Referrer',
      templateSchema: referrerSchema,
      childIds: ['team-elem'],
    })
    const teamElem = makeElement({
      id: 'team-elem',
      name: 'Core Team',
      parentId: 'referrer',
      parentPath: 'referrer.md',
      elementType: 'Team',
      fields: { members: fieldValue },
    })
    return workspace([target, jane, john, referrer, teamElem])
  }

  it('Canonical multivalue accepted: YAML sequence of qualified refs resolves clean', () => {
    const { result, index } = twoPersonWorkspace([
      '[[Acme Org :: Jane Doe]]',
      '[[Acme Org :: John Smith]]',
    ])
    expect(index.issues).toHaveLength(0)
    expect(validateWorkspaceReferences(result, index)).toEqual([])
  })

  it('Canonical multivalue accepted: newline-separated qualified refs resolve clean', () => {
    const { result, index } = twoPersonWorkspace(
      '[[Acme Org :: Jane Doe]]\n[[Acme Org :: John Smith]]',
    )
    expect(collectQualifiedReferenceCandidates(result, index)).toHaveLength(2)
    expect(validateWorkspaceReferences(result, index)).toEqual([])
  })

  it('Non-canonical fails with code and migration hint: comma-joined refs', () => {
    const { result, index } = twoPersonWorkspace(
      '[[Acme Org :: Jane Doe]], [[Acme Org :: John Smith]]',
    )
    const diagnostics = validateWorkspaceReferences(result, index)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].code).toBe('MULTIVALUE_SYNTAX')
    expect(diagnostics[0].promptHint).toContain('[[Acme Org :: Jane Doe]]')
  })
})

describe('conv-wikilinks — qualified cross-model reference bypass (H4)', () => {
  /** Minimal level-3 document with a `# NN index` (so `hasIndex` is true)
   *  and one `Founder` element carrying a `fundadores` field whose value
   *  is the wikilink under test. */
  function referrerDoc(wikilinkValue: string): string {
    return `---
spec_version: "V_0-3-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Referrer"
parent_spec:
  name: "mini_V_1-0-0"
  url: "https://example.com/mini_V_1-0-0_NN.md"
---

# NN index

* [[Founder]]

# NN Founder

## NN Founder: Some Founder
fundadores:: ${wikilinkValue}
`
  }

  function conveWikilinksCheck(content: string) {
    const report = validateFormatContent(content, 'referrer_V_1-0-0_NN.md')
    const check = report.checks.find((c) => c.id === 'conv-wikilinks')
    if (!check) throw new Error('conv-wikilinks check did not run (hasIndex must be true)')
    return check
  }

  it('valid qualified reference produces no conv-wikilinks warning', () => {
    const check = conveWikilinksCheck(referrerDoc('[[Acme Org :: Jane Doe]]'))
    expect(check.passed).toBe(true)
    expect(check.message).toBeUndefined()
  })

  it('invalid qualified reference is bypassed here (not the generic warning) — validateWorkspaceReferences reports it instead', () => {
    // Per-file conv-wikilinks must NOT emit the generic "N undefined
    // reference(s)" warning for a qualified value, valid or not — existence
    // is workspace-graph knowledge it deliberately does not have. The
    // "dangling-model-errors" test above proves validateWorkspaceReferences
    // is the one that reports this specific case.
    const check = conveWikilinksCheck(referrerDoc('[[Nonexistent Model :: Jane Doe]]'))
    expect(check.passed).toBe(true)
    expect(check.message).toBeUndefined()
  })

  it('non-qualified local wikilink is still checked normally', () => {
    const check = conveWikilinksCheck(referrerDoc('[[Ghost]]'))
    expect(check.passed).toBe(false)
    expect(check.message).toContain('undefined reference')
    expect(check.message).toContain('ghost')
  })

  it('a value containing "::" but not matching the qualified form is not silently hidden', () => {
    // "Broken::" has no text after the separator, so it does not match the
    // precise `[[<text> :: <text>]]` pattern and must stay subject to
    // normal local-reference checking.
    const check = conveWikilinksCheck(referrerDoc('[[Broken::]]'))
    expect(check.passed).toBe(false)
    expect(check.message).toContain('undefined reference')
  })
})

describe('validateWorkspaceReferences — missing WorkspaceIndex guard', () => {
  it('throws a named, actionable error instead of a raw TypeError when index is omitted', () => {
    const { result } = makeRootAndElement({ elementType: 'Person', fields: {} })

    // @ts-expect-error — deliberately calling without the required `index` argument
    expect(() => validateWorkspaceReferences(result)).toThrow(MissingWorkspaceIndexError)
    // @ts-expect-error — deliberately calling without the required `index` argument
    expect(() => validateWorkspaceReferences(result)).toThrow(/buildWorkspaceIndex/)
  })

  it('throws the same named error when index is null', () => {
    const { result } = makeRootAndElement({ elementType: 'Person', fields: {} })

    expect(() => validateWorkspaceReferences(result, null as unknown as WorkspaceIndex)).toThrow(
      MissingWorkspaceIndexError,
    )
  })

  it('a real WorkspaceIndex built via buildWorkspaceIndex does not trigger the guard', () => {
    const { result } = makeRootAndElement({ elementType: 'Person', fields: {} })
    const index = buildWorkspaceIndex(result)

    expect(() => validateWorkspaceReferences(result, index)).not.toThrow()
  })
})
