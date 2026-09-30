import { describe, it, expect } from 'vitest'
import { validateWorkspaceSources, type SourceResolver } from '../src/validator/workspaceSources.js'
import { parseKnowledgeUnitRef, serializeKnowledgeUnitRef } from '../src/sourceRef.js'
import type { RecursiveParseResult } from '../src/recursiveParser/types.js'
import type { KnowledgeNode } from '../src/types/index.js'
import type { BlueprintSchema } from '../src/schema/index.js'
import { parseKnowledge, serializeKnowledge } from '../src/parser/index.js'

/**
 * Citation provenance typing (AD-5): whether a field carries provenance is a
 * DECLARED property of the field, not a guess from its name. Name matching
 * (`SOURCE_FIELD_NAMES`) survives only as the fallback for a model whose
 * template schema did not resolve.
 */

function field(value: unknown): KnowledgeNode['fields'][string] {
  return { value, editAttribution: { author: { kind: 'system', id: 'test' }, timestamp: '' } }
}

/** A model with one element of concept `Page` carrying `fieldName:: value`. */
function resultWith(
  fieldName: string,
  value: unknown,
  templateSchema?: BlueprintSchema,
): RecursiveParseResult {
  const root: KnowledgeNode = {
    id: 'root-1',
    name: 'doc_01',
    parentId: null,
    childIds: ['elem-1'],
    type: 'document',
    kind: 'root',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: 'kNNowledge/Handbook_NN.md' },
    templateSchema,
  }
  const element: KnowledgeNode = {
    id: 'elem-1',
    name: 'Proton Pack',
    parentId: 'root-1',
    childIds: [],
    type: 'Page',
    kind: 'element',
    fields: { [fieldName]: field(value) },
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: 'kNNowledge/Handbook_NN.md' },
  }
  return { nodes: { 'root-1': root, 'elem-1': element }, rootIds: ['root-1'], issues: [] }
}

function schemaWith(fieldName: string, type: string): BlueprintSchema {
  return {
    concepts: [
      {
        name: 'Page',
        type: 'category',
        fields: [{ name: fieldName, type: type as never }],
      },
    ],
    markers: [],
    matrices: [],
    taxonomy: [],
  }
}

/** Nothing exists on disk — any citation check must therefore report a dangling file. */
const emptyResolver: SourceResolver = () => ({ exists: false })

describe('citation fields are resolved from the schema', () => {
  it('does not treat a field named `source` as provenance when it is declared markdown_file', () => {
    // This is the shipped `documentation` template's `source:: <content path>`,
    // which is a page's Markdown body — not a citation into a primary source.
    const diags = validateWorkspaceSources(
      resultWith('source', 'content/proton-pack.md', schemaWith('source', 'markdown_file')),
      emptyResolver,
    )
    expect(diags.filter((d) => d.code?.startsWith('KU_'))).toEqual([])
  })

  it('validates a field declared `citation` regardless of its name', () => {
    const diags = validateWorkspaceSources(
      resultWith('evidence', 'sources/nn/missing.md@## Q4 Outlook', schemaWith('evidence', 'citation')),
      emptyResolver,
    )
    expect(diags.some((d) => d.code === 'KU_DANGLING_FILE')).toBe(true)
  })

  it('falls back to name matching when no schema resolved', () => {
    const diags = validateWorkspaceSources(
      resultWith('source', 'sources/nn/missing.md@## Q4 Outlook'),
      emptyResolver,
    )
    expect(diags.some((d) => d.code === 'KU_DANGLING_FILE')).toBe(true)
  })
})

describe('citation lists are deduplicated on write', () => {
  const doc = (sources: string) =>
    [
      '---',
      'spec_version: "V_0-2-1"',
      'level: 3',
      'title: "Citations"',
      '---',
      '',
      '> [!NOTE]',
      '> Banner.',
      '',
      '# NN Stakeholders',
      '',
      '## NN Stakeholders: Alice',
      `sources:: ${sources}`,
      '',
    ].join('\n')

  it('removes a repeated pointer, first occurrence winning', () => {
    const serialized = serializeKnowledge(
      parseKnowledge(doc('[sources/nn/a.md@## Intro, sources/nn/b.md@## Other, sources/nn/a.md@## Intro]')),
    )
    expect(serialized).toContain('sources:: [sources/nn/a.md@## Intro, sources/nn/b.md@## Other]')
  })

  it('leaves a duplicate-free citation list byte-identical', () => {
    const source = doc('[sources/nn/a.md@## Intro, sources/nn/b.md@## Other]')
    expect(serializeKnowledge(parseKnowledge(source))).toBe(source)
  })
})

describe('citation text fidelity', () => {
  it('emits the human-readable heading, not its slug', () => {
    const ref = parseKnowledgeUnitRef('sources/nn/report.md@## Q4 Outlook')
    expect(ref?.unit).toBeDefined()
    expect(serializeKnowledgeUnitRef('sources/nn/report.md', ref!.unit!)).toBe(
      'sources/nn/report.md@## Q4 Outlook',
    )
  })

  it('still derives the slug on read', () => {
    const ref = parseKnowledgeUnitRef('sources/nn/report.md@## Q4 Outlook')
    expect(ref!.unit!.kind).toBe('header')
    expect((ref!.unit as { slug: string }).slug).toBe('q4-outlook')
  })

  it('round-trips a subunit pointer', () => {
    const ref = parseKnowledgeUnitRef('sources/nn/report.md@## Q4 Outlook&owner')
    expect(serializeKnowledgeUnitRef('sources/nn/report.md', ref!.unit!, ['owner'])).toBe(
      'sources/nn/report.md@## Q4 Outlook&owner',
    )
  })
})
