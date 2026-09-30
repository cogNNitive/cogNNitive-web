import { describe, it, expect } from 'vitest'
import { buildAgentModificationBlock, type AgentModificationContext } from './agentModification.js'
import { slugifyHeading, extractHeadings } from './sourceRef.js'

const CTX: AgentModificationContext = {
  model: 'Ghostbusters_V_0-1-0_business',
  modelVersion: 'V_0-1-0',
  timestamp: '2026-09-07T12:00:00.000Z',
}

/** Parse `key:: value` lines out of a block body (skips the heading + blanks). */
function fields(block: string): Array<[string, string]> {
  return block
    .split('\n')
    .map((l) => l.match(/^([a-z_]+):: (.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]] as [string, string])
}

describe('buildAgentModificationBlock', () => {
  it('is deterministic: identical (op, args, ctx) yields an identical block', () => {
    const a = buildAgentModificationBlock(
      'add_field',
      { conceptName: 'Stakeholders', fieldName: 'budget' },
      CTX,
    )
    const b = buildAgentModificationBlock(
      'add_field',
      { conceptName: 'Stakeholders', fieldName: 'budget' },
      CTX,
    )
    expect(a).toBe(b)
    expect(a).not.toBeNull()
  })

  it('only the timestamp may differ when ctx.timestamp is not pinned', () => {
    const a = buildAgentModificationBlock(
      'add_concept',
      { conceptName: 'Risks' },
      { ...CTX, timestamp: undefined },
    )!
    const b = buildAgentModificationBlock(
      'add_concept',
      { conceptName: 'Risks' },
      { ...CTX, timestamp: undefined },
    )!
    const strip = (s: string) => s.replace(/^timestamp:: .*$/m, 'timestamp:: <t>')
    expect(strip(a)).toBe(strip(b))
  })

  it('emits keys in the fixed order scope, change, rationale, approved_by, author, model, knowledge_version, timestamp', () => {
    const block = buildAgentModificationBlock('add_concept', { conceptName: 'Risks' }, CTX)!
    expect(fields(block).map(([k]) => k)).toEqual([
      'scope',
      'change',
      'rationale',
      'approved_by',
      'author',
      'knowledge',
      'knowledge_version',
      'timestamp',
    ])
  })

  it('inserts version_transition between knowledge and knowledge_version for bump_version only, keeping author after approved_by', () => {
    const block = buildAgentModificationBlock(
      'bump_version',
      { version: 'V_0-2-0' },
      { ...CTX, modelVersion: 'V_0-2-0', versionTransition: { from: 'V_0-1-0', to: 'V_0-2-0' } },
    )!
    expect(fields(block).map(([k]) => k)).toEqual([
      'scope',
      'change',
      'rationale',
      'approved_by',
      'author',
      'knowledge',
      'version_transition',
      'knowledge_version',
      'timestamp',
    ])
    expect(block).toContain('version_transition:: V_0-1-0 → V_0-2-0')
    expect(block).toContain('knowledge_version:: V_0-2-0')
  })

  it('falls back to `rationale:: _` when the caller supplies none; never omits the key', () => {
    const block = buildAgentModificationBlock('add_concept', { conceptName: 'Risks' }, CTX)!
    expect(block).toContain('rationale:: _')
  })

  it('carries the caller rationale verbatim when supplied', () => {
    const block = buildAgentModificationBlock(
      'add_concept',
      { conceptName: 'Risks' },
      { ...CTX, rationale: 'the client asked for an explicit risk register' },
    )!
    expect(block).toContain('rationale:: the client asked for an explicit risk register')
    expect(block).not.toContain('rationale:: _')
  })

  it('defaults approved_by to agent and honours an explicit user override', () => {
    expect(buildAgentModificationBlock('add_concept', { conceptName: 'R' }, CTX)!).toContain(
      'approved_by:: agent',
    )
    expect(
      buildAgentModificationBlock(
        'add_concept',
        { conceptName: 'R' },
        { ...CTX, approvedBy: 'user' },
      )!,
    ).toContain('approved_by:: user')
  })

  it('emits author:: between approved_by:: and knowledge:: when the caller supplies one', () => {
    const block = buildAgentModificationBlock(
      'add_concept',
      { conceptName: 'Risks' },
      { ...CTX, approvedBy: 'user', author: 'OpenCode' },
    )!
    const keys = fields(block).map(([k]) => k)
    expect(keys.indexOf('author')).toBe(keys.indexOf('approved_by') + 1)
    expect(keys.indexOf('author')).toBe(keys.indexOf('knowledge') - 1)
    expect(block).toContain('author:: OpenCode')
    // The two attribution keys coexist and stay distinct.
    expect(block).toContain('approved_by:: user')
    expect(fields(block).filter(([k]) => k === 'author')).toHaveLength(1)
  })

  it('falls back to `author:: _` when the caller supplies none or only whitespace; never omits the key', () => {
    const omitted = buildAgentModificationBlock('add_concept', { conceptName: 'Risks' }, CTX)!
    expect(omitted).toContain('author:: _')
    const whitespace = buildAgentModificationBlock(
      'add_concept',
      { conceptName: 'Risks' },
      { ...CTX, author: '   ' },
    )!
    expect(whitespace).toContain('author:: _')
  })

  it('same (op, args) with different authors differs only in the author line', () => {
    const a = buildAgentModificationBlock(
      'add_concept',
      { conceptName: 'Risks' },
      { ...CTX, author: 'OpenCode' },
    )!
    const b = buildAgentModificationBlock(
      'add_concept',
      { conceptName: 'Risks' },
      { ...CTX, author: 'Architect' },
    )!
    expect(a).not.toBe(b)
    expect(a).toContain('author:: OpenCode')
    expect(b).toContain('author:: Architect')
    // scope/change ARE identical — only the author attribution differs.
    const scopeOf = (s: string) => fields(s).find(([k]) => k === 'scope')![1]
    const changeOf = (s: string) => fields(s).find(([k]) => k === 'change')![1]
    expect(scopeOf(a)).toBe(scopeOf(b))
    expect(changeOf(a)).toBe(changeOf(b))
    const stripAuthor = (s: string) => s.replace(/^author:: .*$/m, 'author:: <a>')
    expect(stripAuthor(a)).toBe(stripAuthor(b))
  })

  it('trims surrounding whitespace from a caller-supplied author', () => {
    const block = buildAgentModificationBlock(
      'add_concept',
      { conceptName: 'Risks' },
      { ...CTX, author: '  OpenCode  ' },
    )!
    expect(block).toContain('author:: OpenCode')
    expect(block).not.toContain('author::   OpenCode')
  })

  it('derives the exact scope:: string per op (design table)', () => {
    const scopeOf = (op: string, args: Record<string, unknown>, ctx = CTX) =>
      fields(buildAgentModificationBlock(op, args, ctx)!).find(([k]) => k === 'scope')![1]

    expect(scopeOf('add_element', { conceptName: 'Stakeholders', elementName: 'City Hall' })).toBe(
      'add_element concept "Stakeholders" element "City Hall"',
    )
    expect(scopeOf('add_concept', { conceptName: 'Risks' })).toBe('add_concept concept "Risks"')
    expect(scopeOf('add_field', { conceptName: 'Stakeholders', fieldName: 'budget' })).toBe(
      'add_field concept "Stakeholders" field "budget"',
    )
    expect(
      scopeOf('update_field', {
        conceptName: 'Stakeholders',
        elementName: 'City Hall',
        fieldName: 'budget',
      }),
    ).toBe('update_field concept "Stakeholders" element "City Hall" field "budget"')
    expect(
      scopeOf('remove_element', { conceptName: 'Stakeholders', elementName: 'City Hall' }),
    ).toBe('remove_element concept "Stakeholders" element "City Hall"')
    expect(scopeOf('rename_concept', { conceptName: 'Risks', newName: 'Threats' })).toBe(
      'rename_concept "Risks" → "Threats"',
    )
    expect(
      scopeOf('rename_element', {
        conceptName: 'Stakeholders',
        elementName: 'City Hall',
        newName: 'Town Hall',
      }),
    ).toBe('rename_element concept "Stakeholders" element "City Hall" → "Town Hall"')
    expect(scopeOf('generate_index', {})).toBe('generate_index taxonomy')
    expect(scopeOf('set_marker', { markerName: 'priority' })).toBe('set_marker "priority"')
    expect(
      scopeOf(
        'bump_version',
        { version: 'V_0-2-0' },
        {
          ...CTX,
          versionTransition: { from: 'V_0-1-0', to: 'V_0-2-0' },
        },
      ),
    ).toBe('bump_version "V_0-1-0" → "V_0-2-0"')
  })

  it('returns null for add_marker and any unknown op (no block emitted)', () => {
    expect(buildAgentModificationBlock('add_marker', { markerName: 'priority' }, CTX)).toBeNull()
    expect(buildAgentModificationBlock('teleport_model', {}, CTX)).toBeNull()
  })

  it('heading slug keeps the Concept--Element boundary and round-trips through extractHeadings', () => {
    const scope = 'add_field concept "Stakeholders" field "budget"'
    const block = buildAgentModificationBlock(
      'add_field',
      { conceptName: 'Stakeholders', fieldName: 'budget' },
      CTX,
    )!
    const firstHeading = block.split('\n').find((l) => l.startsWith('## '))!
    expect(firstHeading).toBe(`## NN Agent Modification: ${slugifyHeading(scope)}`)

    const [h] = extractHeadings(block)
    expect(h.level).toBe(2)
    expect(h.concept).toBe('NN Agent Modification')
    expect(h.element).toBe(slugifyHeading(scope))
    expect(h.slug).toBe(`nn-agent-modification--${slugifyHeading(scope)}`)
  })

  it('performs no I/O and does not touch its args object', () => {
    const args = Object.freeze({ conceptName: 'Risks' })
    // A frozen args object would throw on any write attempt.
    expect(() => buildAgentModificationBlock('add_concept', args, CTX)).not.toThrow()
  })
})
