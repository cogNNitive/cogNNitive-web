import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { initKnowledge } from './init-knowledge'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-init-model')
const specsDir = join(rootDir, 'specs')

const TEMPLATE_URL = 'https://example.com/business_V_0-2-0_NN.md'
const blueprint_name = 'business_V_0-2-0'

/** Write the level-1 + level-0 spec chain locally so resolution never hits the network. */
async function stubSpecChain() {
  await writeFile(
    join(specsDir, 'iNNfo_V_0-3-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 1',
      'title: "Local iNNfo Spec"',
      'parent_spec:',
      '  name: "defiNNition_V_0-1-0"',
      '  url: "https://example.com/defiNNition_V_0-1-0_NN.md"',
      '---',
    ].join('\n'),
    'utf-8',
  )
  await writeFile(
    join(specsDir, 'defiNNition_V_0-1-0_NN.md'),
    ['---', 'spec_version: "V_0-1-0"', 'level: 0', 'title: "Local defiNNition Spec"', '---'].join('\n'),
    'utf-8',
  )
}

/** Write a level-2 business template (declaring a "Work" list concept), resolvable
 * locally by `resolveBlueprintWithCache` without any network I/O. */
async function stubBusinessTemplate() {
  await writeFile(
    join(specsDir, 'business_V_0-2-0_NN.md'),
    [
      '---',
      'blueprint_version: "V_0-2-0"',
      'level: 2',
      'title: "Local Business Template"',
      'parent_spec:',
      '  name: "iNNfo_V_0-3-0"',
      '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
      '---',
      '',
      '# NN Concept Definition',
      '',
      '## NN Concept Definition: Work',
      'type:: list',
      '',
    ].join('\n'),
    'utf-8',
  )
  await stubSpecChain()
}

describe('initKnowledge', () => {
  const origCache = process.env.INNFO_CACHE_DIR

  beforeEach(async () => {
    // Hermetic temp cache: the OS temp dir is shared across test files/runs,
    // so resolution here must never see entries fetched by other suites.
    process.env.INNFO_CACHE_DIR = join(rootDir, 'isolated-cache')
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(specsDir, { recursive: true })
    vi.restoreAllMocks()
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network disabled in tests'))
  })

  afterEach(async () => {
    if (origCache !== undefined) process.env.INNFO_CACHE_DIR = origCache
    else delete process.env.INNFO_CACHE_DIR
    await rm(rootDir, { recursive: true, force: true })
  })

  it('creates a new model file with frontmatter and a body scaffolded from the resolved template', async () => {
    await stubBusinessTemplate()

    const result = await initKnowledge(rootDir, 'NewModel', {
      template_url: TEMPLATE_URL,
      blueprint_name: blueprint_name,
      title: 'New Model',
    })

    expect(result.success).toBe(true)
    expect(result.templateResolved).toBe(true)
    expect(result.scaffolded).toBe(true)
    expect(result.filePath).toBe(join(rootDir, 'NewModel_NN.md'))

    expect(result.content).toContain('parent_spec:')
    expect(result.content).toContain(`name: "${blueprint_name}"`)
    expect(result.content).toContain(`url: "${TEMPLATE_URL}"`)
    expect(result.content).toContain('title: "New Model"')
    expect(result.content).toContain('# NN Work')
    expect(result.content).toContain('## NN Work: Example Work')

    const onDisk = await readFile(result.filePath!, 'utf-8')
    expect(onDisk).toBe(result.content)
  })

  it('writes frontmatter without scaffolding a body when the template cannot be resolved', async () => {
    const result = await initKnowledge(rootDir, 'Orphan', {
      template_url: TEMPLATE_URL,
      blueprint_name: blueprint_name,
    })

    expect(result.success).toBe(true)
    expect(result.templateResolved).toBe(false)
    expect(result.scaffolded).toBe(false)
    expect(result.warnings.some((w) => /template resolution failed/i.test(w))).toBe(true)

    expect(result.content).toContain(`name: "${blueprint_name}"`)
    expect(result.content).not.toContain('# NN Work')

    const onDisk = await readFile(result.filePath!, 'utf-8')
    expect(onDisk).toBe(result.content)
  })

  it('preserves an existing body that already has concept sections instead of re-scaffolding it', async () => {
    await stubBusinessTemplate()
    const filePath = join(rootDir, 'Existing_NN.md')
    await writeFile(
      filePath,
      [
        '---',
        'title: "Old Title"',
        '---',
        '',
        '# NN Work',
        '## NN Work: PreExisting',
        '',
      ].join('\n'),
      'utf-8',
    )

    const result = await initKnowledge(rootDir, 'Existing', {
      template_url: TEMPLATE_URL,
      blueprint_name: blueprint_name,
    })

    expect(result.success).toBe(true)
    expect(result.templateResolved).toBe(true)
    expect(result.scaffolded).toBe(false)
    expect(result.filePath).toBe(filePath)
    expect(result.content).toContain('PreExisting')
    expect(result.content).not.toContain('Example Work')

    const onDisk = await readFile(filePath, 'utf-8')
    expect(onDisk).toBe(result.content)
  })

  it('escapes quotes and newlines in frontmatter title properly and roundtrips', async () => {
    await stubBusinessTemplate()
    const { parseKnowledge } = await import('@cognnitive/innfo-core')

    // Test quotes in title
    const resQuotes = await initKnowledge(rootDir, 'QuotesModel', {
      template_url: TEMPLATE_URL,
      blueprint_name: blueprint_name,
      title: 'The "Real" Deal',
    })
    expect(resQuotes.success).toBe(true)
    const onDiskQuotes = await readFile(resQuotes.filePath!, 'utf-8')
    const parsedQuotes = parseKnowledge(onDiskQuotes)
    expect(parsedQuotes.frontmatter?.title).toBe('The "Real" Deal')

    // Test newline in title
    const resNewlines = await initKnowledge(rootDir, 'NewlineModel', {
      template_url: TEMPLATE_URL,
      blueprint_name: blueprint_name,
      title: 'Line1\nLine2',
    })
    expect(resNewlines.success).toBe(true)
    const onDiskNewlines = await readFile(resNewlines.filePath!, 'utf-8')
    const parsedNewlines = parseKnowledge(onDiskNewlines)
    expect(parsedNewlines.frontmatter.title).toBe('Line1\nLine2')
  })

  /** Write a second level-2 template at a DIFFERENT spec_version so inference
   * triangulation can prove the emitted version comes from the resolved parent
   * (not a hardcoded constant). */
  async function stubBusinessTemplateV010() {
    await writeFile(
      join(specsDir, 'business_V_0-1-0_NN.md'),
      [
        '---',
        'blueprint_version: "V_0-1-0"',
        'level: 2',
        'title: "Local Business Template V010"',
        'parent_spec:',
        '  name: "iNNfo_V_0-3-0"',
        '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
        '---',
        '',
        '# NN Concept Definition',
        '',
        '## NN Concept Definition: Work',
        'type:: list',
        '',
      ].join('\n'),
      'utf-8',
    )
    await stubSpecChain()
  }

  describe('version-aware frontmatter (validator-robustness 4.1)', () => {
    it('Version inferred: frontmatter carries the resolved parent spec_version with no override', async () => {
      await stubBusinessTemplate()

      const result = await initKnowledge(rootDir, 'Inferred', {
        template_url: TEMPLATE_URL,
        blueprint_name: blueprint_name,
      })

      expect(result.success).toBe(true)
      expect(result.templateResolved).toBe(true)
      expect(result.content).toContain('knowledge_version: "V_0-2-0"')
    })

    it('Version inferred (triangulation): a different parent version yields that version, not a constant', async () => {
      await stubBusinessTemplateV010()

      const result = await initKnowledge(rootDir, 'InferredOld', {
        template_url: 'https://example.com/business_V_0-1-0_NN.md',
        blueprint_name: 'business_V_0-1-0',
      })

      expect(result.success).toBe(true)
      expect(result.templateResolved).toBe(true)
      expect(result.content).toContain('knowledge_version: "V_0-1-0"')
    })

    it('Override wins: explicit knowledge_version is used when the parent cannot be resolved', async () => {
      const result = await initKnowledge(rootDir, 'OverrideOnly', {
        template_url: TEMPLATE_URL,
        blueprint_name: blueprint_name,
        knowledge_version: 'V_0-3-0',
      })

      expect(result.success).toBe(true)
      expect(result.templateResolved).toBe(false)
      expect(result.content).toContain('knowledge_version: "V_0-3-0"')
    })

    it('Override wins (triangulation): a matching explicit version is accepted and carried', async () => {
      await stubBusinessTemplate()

      const result = await initKnowledge(rootDir, 'OverrideMatch', {
        template_url: TEMPLATE_URL,
        blueprint_name: blueprint_name,
        knowledge_version: 'V_0-2-0',
      })

      expect(result.success).toBe(true)
      expect(result.content).toContain('knowledge_version: "V_0-2-0"')
    })

    it('Mismatch refused: a differing explicit version fails with VERSION_MISMATCH and writes nothing', async () => {
      const { existsSync } = await import('node:fs')
      await stubBusinessTemplate()

      const result = await initKnowledge(rootDir, 'Mismatch', {
        template_url: TEMPLATE_URL,
        blueprint_name: blueprint_name,
        knowledge_version: 'V_9-9-9',
      })

      expect(result.success).toBe(false)
      expect(result.templateResolved).toBe(true)
      expect(result.validation.valid).toBe(false)
      expect(result.validation.errors.some((e) => e.code === 'VERSION_MISMATCH')).toBe(true)
      expect(existsSync(join(rootDir, 'Mismatch_NN.md'))).toBe(false)
    })
  })

  it('does not write file to disk if document validation fails', async () => {
    const { existsSync } = await import('node:fs')
    // Stub an invalid template that produces fatal validation errors
    await writeFile(
      join(specsDir, 'broken_V_0-2-0_NN.md'),
      [
        '---',
        'blueprint_version: "V_0-2-0"',
        'level: 2',
        'title: "Broken Template"',
        'parent_spec:',
        '  name: "iNNfo_V_0-3-0"',
        '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
        'includes:',
        '  - name: "missing_tpl_V_0-1-0"',
        '    url: "https://example.com/missing_tpl_V_0-1-0_NN.md"',
        '---',
        '',
        '# NN Concept Definition',
        '## NN Concept Definition: Broken',
        'type:: list',
        '',
      ].join('\n'),
      'utf-8',
    )
    await stubSpecChain()

    const targetFile = join(rootDir, 'ShouldNotExist_NN.md')

    // If validation fails prior to write, file should not exist on disk
    const result = await initKnowledge(rootDir, 'ShouldNotExist', {
      template_url: 'https://example.com/broken_V_0-2-0_NN.md',
      blueprint_name: 'broken_V_0-2-0',
    })

    expect(result.validation.valid).toBe(false)
    expect(existsSync(targetFile)).toBe(false)
    // model-scaffold-robustness (H1): a failed init must never return a
    // success-shaped payload — filePath/content are omitted entirely, not
    // just left pointing at a file that was never written.
    expect(result.success).toBe(false)
    expect(result.filePath).toBeUndefined()
    expect(result.content).toBeUndefined()
  })

  describe('model-scaffold-robustness (H1)', () => {
    /** A template with a `type:: reference` field carrying no concrete target
     * resolvable at scaffold time, alongside an ordinary `string` field. */
    async function stubReferenceFieldTemplate() {
      await writeFile(
        join(specsDir, 'reftpl_V_0-1-0_NN.md'),
        [
          '---',
          'blueprint_version: "V_0-1-0"',
          'level: 2',
          'title: "Reference Field Template"',
          'parent_spec:',
          '  name: "iNNfo_V_0-3-0"',
          '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
          '---',
          '',
          '# NN Concept Definition',
          '',
          '## NN Concept Definition: Item',
          'type:: list',
          '',
          '# NN Field Definition',
          '',
          '## NN Field Definition: linkedItem',
          'concept:: Item',
          'type:: reference',
          '',
          '## NN Field Definition: label',
          'concept:: Item',
          'type:: string',
          '',
        ].join('\n'),
        'utf-8',
      )
      await stubSpecChain()
    }

    it('omits the placeholder for a reference field with no concrete target instead of a dangling wikilink', async () => {
      await stubReferenceFieldTemplate()

      const result = await initKnowledge(rootDir, 'RefModel', {
        template_url: 'https://example.com/reftpl_V_0-1-0_NN.md',
        blueprint_name: 'reftpl_V_0-1-0',
      })

      expect(result.success).toBe(true)
      expect(result.validation.valid).toBe(true)
      expect(result.content).not.toContain('[[Target Element]]')
      expect(result.content).not.toContain('linkedItem::')
      expect(result.content).toContain('label:: <string>')
    })

    /** The REAL, shipped `blank` template (single `type:: text` concept, no
     * `includes`) — read from disk so this test proves the production
     * template scaffolds clean, not a synthetic stand-in. */
    async function stubRealBlankTemplate() {
      const blankRaw = await readFile(
        join(
          import.meta.dirname!,
          '..',
          '..',
          '..',
          '..',
          'specs',
          'bluepriNNts',
          'blank',
          'spec_NN.md',
        ),
        'utf-8',
      )
      await writeFile(join(specsDir, 'blank_V_0-2-0_NN.md'), blankRaw, 'utf-8')
      await stubSpecChain()
    }

    it('scaffolds the real blank template clean on first attempt (a lone type:: text concept gets a real element marker)', async () => {
      await stubRealBlankTemplate()

      const result = await initKnowledge(rootDir, 'BlankModel', {
        template_url: 'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/blank/spec_NN.md',
        blueprint_name: 'blank_V_0-2-0',
      })

      expect(result.success).toBe(true)
      expect(result.templateResolved).toBe(true)
      expect(result.scaffolded).toBe(true)
      expect(result.validation.valid).toBe(true)
      expect(
        result.validation.errors.some((e) => e.message.includes('No NN element markers found')),
      ).toBe(false)
      expect(result.content).toMatch(/##\s+NN\s+Content:\s+.+/)
    })
  })
})
