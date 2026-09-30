import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile, readdir } from 'node:fs/promises'
import { buildAgentModificationBlock } from '@cognnitive/innfo-core'
import { resolveSources, EXCERPT_CHAR_CAP } from './resolve-sources'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-resolve-sources')
const specsDir = join(rootDir, 'specs')

/** Local level-1/level-0 chain so template resolution never hits the network. */
async function stubSpecChain() {
  await writeFile(
    join(specsDir, 'iNNfo_V_0-1-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-1-0"',
      'level: 1',
      'title: "Local iNNfo Spec"',
      'parent_spec:',
      '  name: "defiNNe_V_0-1-0"',
      '  url: "https://example.com/defiNNe_V_0-1-0_NN.md"',
      '---',
    ].join('\n'),
    'utf-8',
  )
  await writeFile(
    join(specsDir, 'defiNNe_V_0-1-0_NN.md'),
    ['---', 'spec_version: "V_0-1-0"', 'level: 0', 'title: "Local defiNNe Spec"', '---'].join('\n'),
    'utf-8',
  )
}

/** A local level-2 template declaring `precio_source` as `type:: citation`. */
async function stubPricingTemplate() {
  await writeFile(
    join(specsDir, 'pricing_V_0-1-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-1-0"',
      'level: 2',
      'title: "Local Pricing Template"',
      'parent_spec:',
      '  name: "iNNfo_V_0-1-0"',
      '  url: "https://example.com/iNNfo_V_0-1-0_NN.md"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Producto',
      'type:: category',
      '',
      '# NN Field Definition',
      '',
      '## NN Field Definition: precio_source',
      'concept:: Producto',
      'type:: citation',
      '',
    ].join('\n'),
    'utf-8',
  )
  await stubSpecChain()
}

async function writeWorkspace(): Promise<void> {
  await mkdir(join(rootDir, 'models'), { recursive: true })
  await mkdir(join(rootDir, 'sources', 'nn'), { recursive: true })

  await writeFile(
    join(rootDir, 'models', 'Plan_V_1-0-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-1-0"',
      'level: 3',
      'knowledge_version: "V_1-0-0"',
      'parent_spec:',
      '  name: "pricing_V_0-1-0"',
      '  url: "https://example.com/pricing_V_0-1-0_NN.md"',
      '---',
      '',
      '# NN Producto',
      '',
      '## NN Producto: Widget',
      'sources:: sources/nn/pricing.md@## Q3 Pricing',
      'precio_source:: sources/nn/pricing.md@## Q3 Pricing',
      'dangling_source:: sources/nn/missing.md@## Ghost',
      'unknown_anchor_source:: sources/nn/report.md@## Nonexistent Heading',
      'long_source:: sources/nn/long.md@## Long Section',
      'short_source:: sources/nn/short.md@## Short Section',
      'agent_known_source:: sources/nn/agent-mod.md@## NN Agent Modification: update-field-precio',
      'agent_unknown_marker_source:: sources/nn/agent-mod-unknown.md@## NN Agent Modification: update-field-precio',
      'agent_missing_author_source:: sources/nn/agent-mod-missing.md@## NN Agent Modification: update-field-precio',
      'human_source:: sources/nn/agent-mod-human.md@## NN Agent Modification: update-field-precio',
      'nested_source:: sources/nn/agent-mod-nested.md@### Sub Detail',
      'sibling_source:: sources/nn/agent-mod-sibling.md@## Sibling Heading',
      'reviewer_source:: sources/nn/reviewer-with-author.md@## Feedback Note',
      'reviewer_no_author_source:: sources/nn/reviewer-no-author.md@## Feedback Note',
      'document_source:: sources/nn/plain-doc.md@## Plain Heading',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'pricing.md'),
    [
      '---',
      'sha256: "abc123"',
      '---',
      '',
      '## Q3 Pricing',
      'Widget priced at $42 for Q3.',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'report.md'),
    ['---', 'sha256: "def456"', '---', '', '## Some Other Heading', 'Unrelated content.', ''].join(
      '\n',
    ),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'long.md'),
    ['---', 'sha256: "longhash"', '---', '', '## Long Section', 'x'.repeat(2000), ''].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'short.md'),
    ['---', 'sha256: "shorthash"', '---', '', '## Short Section', 'y'.repeat(120), ''].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'agent-mod.md'),
    [
      '## NN Agent Modification: update-field-precio',
      '',
      'scope:: add_field Producto.precio',
      'change:: added field',
      'rationale:: _',
      'approved_by:: agent',
      'author:: Claude Code',
      'model:: Plan',
      'knowledge_version:: V_1-0-0',
      'timestamp:: 2026-01-01T00:00:00.000Z',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'agent-mod-unknown.md'),
    [
      '## NN Agent Modification: update-field-precio',
      '',
      'scope:: add_field Producto.precio',
      'change:: added field',
      'rationale:: _',
      'approved_by:: agent',
      'author:: _',
      'model:: Plan',
      'knowledge_version:: V_1-0-0',
      'timestamp:: 2026-01-01T00:00:00.000Z',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'agent-mod-missing.md'),
    [
      '## NN Agent Modification: update-field-precio',
      '',
      'scope:: add_field Producto.precio',
      'change:: added field',
      'rationale:: _',
      'approved_by:: agent',
      'model:: Plan',
      'knowledge_version:: V_1-0-0',
      'timestamp:: 2026-01-01T00:00:00.000Z',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'agent-mod-human.md'),
    [
      '## NN Agent Modification: update-field-precio',
      '',
      'scope:: add_field Producto.precio',
      'change:: added field',
      'rationale:: _',
      'approved_by:: agent',
      'author:: Maria Lopez',
      'model:: Plan',
      'knowledge_version:: V_1-0-0',
      'timestamp:: 2026-01-01T00:00:00.000Z',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'agent-mod-nested.md'),
    [
      '## NN Agent Modification: update-field-precio',
      '',
      'scope:: add_field Producto.precio',
      'change:: added field',
      'rationale:: _',
      'approved_by:: agent',
      'author:: ClaudeCode',
      'model:: Plan',
      'knowledge_version:: V_1-0-0',
      'timestamp:: 2026-01-01T00:00:00.000Z',
      '',
      '### Sub Detail',
      '',
      'More detail text goes here.',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'agent-mod-sibling.md'),
    [
      '## NN Agent Modification: update-field-precio',
      '',
      'scope:: add_field Producto.precio',
      'change:: added field',
      'rationale:: _',
      'approved_by:: agent',
      'author:: ClaudeCode',
      'model:: Plan',
      'knowledge_version:: V_1-0-0',
      'timestamp:: 2026-01-01T00:00:00.000Z',
      '',
      '## Sibling Heading',
      '',
      'Text here that is separate from the Agent Modification block above.',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'reviewer-with-author.md'),
    [
      '---',
      'source_type: feedback',
      'author: "Jane Reviewer"',
      '---',
      '',
      '## Feedback Note',
      'This section is a reviewed note.',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'reviewer-no-author.md'),
    [
      '---',
      'source_type: feedback',
      '---',
      '',
      '## Feedback Note',
      'This section is a reviewed note.',
      '',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(rootDir, 'sources', 'nn', 'plain-doc.md'),
    ['---', 'sha256: "plaindoc1"', '---', '', '## Plain Heading', 'Just prose.', ''].join('\n'),
    'utf-8',
  )
}

describe('resolve_sources', () => {
  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(specsDir, { recursive: true })
    await writeWorkspace()
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('resolves a valid citation with excerpt and sha256', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'sources',
    })
    expect(results).toHaveLength(1)
    expect(results[0].path).toBe('sources/nn/pricing.md')
    expect(results[0].anchor).toBe('q3-pricing')
    expect(results[0].exists).toBe(true)
    expect(results[0].sha256).toBe('abc123')
    expect(results[0].excerpt).toContain('Widget priced at $42 for Q3.')
    expect(results[0].excerpt!.length).toBeLessThanOrEqual(EXCERPT_CHAR_CAP)
  })

  it('filters by fieldName so only that field is resolved', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'precio_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].path).toBe('sources/nn/pricing.md')
  })

  it('reports a dangling file without throwing', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'dangling_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].exists).toBe(false)
    expect(results[0].error).toBe('DANGLING_FILE')
    expect(results[0].excerpt).toBeUndefined()
    expect(results[0].sha256).toBeUndefined()
    expect(results[0].version).toBeUndefined()
  })

  it('reports an unknown anchor within an existing file', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'unknown_anchor_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].exists).toBe(true)
    expect(results[0].error).toBe('UNKNOWN_ANCHOR')
  })

  it('resolves a schema-typed non-sources field with an explicit fieldName, standalone (no A3 schema needed)', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'precio_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].exists).toBe(true)
  })

  it('resolves schema-typed citation fields when fieldName is omitted, without any network fetch or file writes', async () => {
    await stubPricingTemplate()
    const fetchSpy = vi.spyOn(global, 'fetch')
    const before = await snapshotFiles()

    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    const after = await snapshotFiles()
    expect(after).toEqual(before)

    const paths = results.map((r) => r.path)
    // Both the name-based `sources` field and the schema-typed `precio_source`
    // field resolve to the same target here, so the same path appears twice —
    // once per field — proving both selection paths fired.
    expect(paths.filter((p) => p === 'sources/nn/pricing.md')).toHaveLength(2)
  })

  it('truncates a long section to the excerpt cap', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'long_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].excerpt!.length).toBeLessThanOrEqual(EXCERPT_CHAR_CAP)
    expect(results[0].truncated).toBe(true)
  })

  it('returns a short section in full, uncapped', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'short_source',
    })
    expect(results).toHaveLength(1)
    expect(results[0].excerpt).toContain('y'.repeat(120))
    expect(results[0].excerpt!.length).toBeLessThan(EXCERPT_CHAR_CAP)
    expect(results[0].truncated).toBeUndefined()
  })

  it('every returned entry carries a field key', async () => {
    const results = await resolveSources(rootDir, {
      model: 'Plan_V_1-0-0',
      elementId: 'Widget',
      fieldName: 'sources',
    })
    expect(results).toHaveLength(1)
    expect(results[0].field).toBe('sources')
  })

  describe('origin classification', () => {
    it('classifies a known agent tool id as agent, normalizing case/spacing', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'agent_known_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('agent')
      expect(results[0].author).toBe('Claude Code')
    })

    it('classifies an unfilled author marker (_) as agent with author "unknown"', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'agent_unknown_marker_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('agent')
      expect(results[0].author).toBe('unknown')
    })

    it('classifies a missing author:: line as agent with author "unknown"', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'agent_missing_author_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('agent')
      expect(results[0].author).toBe('unknown')
    })

    it('classifies an unrecognized name inside an Agent Modification block as human', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'human_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('human')
      expect(results[0].author).toBe('Maria Lopez')
    })

    it('classifies a sub-heading nested under an Agent Modification block via ancestor walk', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'nested_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('agent')
      expect(results[0].author).toBe('ClaudeCode')
    })

    it('classifies a sibling heading of an Agent Modification block as document', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'sibling_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('document')
    })

    it('classifies a reviewer-feedback citation with frontmatter author', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'reviewer_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('reviewer')
      expect(results[0].author).toBe('Jane Reviewer')
    })

    it('classifies a reviewer-feedback citation without frontmatter author, omitting author', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'reviewer_no_author_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('reviewer')
      expect(results[0].author).toBeUndefined()
    })

    it('classifies a plain document heading as document, without crashing', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'document_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('document')
    })

    it('classifies a dangling file as document, without a throw', async () => {
      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'dangling_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('document')
    })

    it('contract test: a real buildAgentModificationBlock() output classifies as agent end-to-end', async () => {
      const block = buildAgentModificationBlock(
        'add_field',
        { conceptName: 'Producto', fieldName: 'precio' },
        { model: 'Plan', modelVersion: 'V_1-0-0', author: 'ClaudeCode' },
      )
      expect(block).toBeTruthy()

      const headingLine = block!.split('\n')[0]
      const headingText = headingLine.replace(/^#{1,6}\s+/, '')

      await writeFile(join(rootDir, 'sources', 'nn', 'contract-block.md'), block!, 'utf-8')

      // Add the citation field dynamically, referencing the block's own real heading text.
      const modelFile = join(rootDir, 'models', 'Plan_V_1-0-0_NN.md')
      const { readFile } = await import('node:fs/promises')
      const modelContent = await readFile(modelFile, 'utf-8')
      const withContractField = modelContent.replace(
        '## NN Producto: Widget\n',
        `## NN Producto: Widget\ncontract_source:: sources/nn/contract-block.md@${headingLine}\n`,
      )
      await writeFile(modelFile, withContractField, 'utf-8')

      const results = await resolveSources(rootDir, {
        model: 'Plan_V_1-0-0',
        elementId: 'Widget',
        fieldName: 'contract_source',
      })
      expect(results).toHaveLength(1)
      expect(results[0].origin).toBe('agent')
      expect(results[0].author).toBe('ClaudeCode')
      expect(headingText.toLowerCase()).toContain('nn agent modification')
    })
  })
})

async function snapshotFiles(): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else out.push(full)
    }
  }
  await walk(rootDir)
  return out.sort()
}
