import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { validateModel, validateModelUrl, applyChange, validateTemplate } from './mutate'
import { buildAgentModificationBlock } from '@cognnitive/innfo-core'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-mutate')
const specsDir = join(rootDir, 'specs')
const modelsDir = join(rootDir, 'models')

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

/** Write a level-2 business template (declaring a "Work" list concept) resolving
 * up to the stubbed level-1 spec chain — fully resolvable locally, no network. */
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

/** A minimal, valid iNNfo model instantiating the "Work" concept from
 * `stubBusinessTemplate()`. `parent_spec` points at `business_V_0-2-0`: when
 * `stubBusinessTemplate()` has been called first, resolution succeeds locally;
 * otherwise (default fetch-reject mock, no local stub) it resolves to null. */
const MUTABLE_MODEL_CONTENT = [
  '---',
  'level: 3',
  'knowledge_version: "V_0-0-1"',
  'title: "Test"',
  'parent_spec:',
  '  name: "business_V_0-2-0"',
  '  url: "https://example.com/business_V_0-2-0_NN.md"',
  '---',
  '',
  '# NN index',
  '* [[Work]]',
  '',
  '# NN Work',
  '## NN Work: Triage',
  '  First element.',
  '',
].join('\n')

describe('mutate tools', () => {
  const origCache = process.env.INNFO_CACHE_DIR

  beforeEach(async () => {
    // Hermetic temp cache: the OS temp dir is shared across test files/runs,
    // so resolution here must never see entries fetched by other suites.
    process.env.INNFO_CACHE_DIR = join(rootDir, 'isolated-cache')
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(specsDir, { recursive: true })
    await mkdir(modelsDir, { recursive: true })
    vi.restoreAllMocks()
    // Default: no real network I/O in tests. Individual tests override this
    // spy when they need to exercise a specific fetch outcome.
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network disabled in tests'))
  })

  afterEach(async () => {
    if (origCache !== undefined) process.env.INNFO_CACHE_DIR = origCache
    else delete process.env.INNFO_CACHE_DIR
    await rm(rootDir, { recursive: true, force: true })
  })

  describe('validateModel', () => {
    it('rejects when neither id nor content is provided', async () => {
      const result = await validateModel(rootDir)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toBe('Provide either id or content')
    })

    it('reports a model-not-found error in id mode', async () => {
      const result = await validateModel(rootDir, 'DoesNotExist')
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toBe('Model not found: DoesNotExist')
    })

    it('reports a clear PARENT_RESOLUTION_FAILED error when the declared parent_spec.url cannot be resolved', async () => {
      const result = await validateModel(rootDir, undefined, MUTABLE_MODEL_CONTENT)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => /PARENT_RESOLUTION_FAILED/.test(e.message))).toBe(true)
      expect(result.errors.some((e) => /business_V_0-2-0/.test(e.message))).toBe(true)
      expect(result.warnings.some((w) => /no template resolved/i.test(w.message))).toBe(false)
    })

    it('lists the searched directories in the PARENT_RESOLUTION_FAILED message', async () => {
      const result = await validateModel(rootDir, undefined, MUTABLE_MODEL_CONTENT)
      expect(result.valid).toBe(false)
      const err = result.errors.find((e) => /business_V_0-2-0/.test(e.message))
      expect(err).toBeDefined()
      expect(err!.message).toContain('(searched:')
      expect(err!.message).toContain('specs')
      expect(err!.message).toContain('network')
    })

    it('validates a model loaded from disk by id', async () => {
      await writeFile(join(rootDir, 'OnDisk_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')
      const result = await validateModel(rootDir, 'OnDisk')
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => /PARENT_RESOLUTION_FAILED/.test(e.message))).toBe(true)
      expect(result.errors.every((e) => 'filePath' in e)).toBe(true)
    })

    it('validates a model successfully against its resolved template', async () => {
      await stubBusinessTemplate()
      await writeFile(join(rootDir, 'OnDisk_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')
      const result = await validateModel(rootDir, 'OnDisk')
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('resolves a RELATIVE parent_spec.url against the workspace root in content mode, same as id mode (Fix 5a)', async () => {
      // Business template lives at a relative, non-`specs/` path — the model's
      // parent_spec.url is a workspace-relative path (no scheme, no leading
      // slash), which must resolve against rootDir just like it does when the
      // model itself is loaded from disk by id.
      await stubSpecChain()
      await mkdir(join(rootDir, 'custom-templates'), { recursive: true })
      await writeFile(
        join(rootDir, 'custom-templates', 'business_V_0-2-0_NN.md'),
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

      const contentWithRelativeParent = [
        '---',
        'level: 3',
        'knowledge_version: "V_0-0-1"',
        'title: "Test"',
        'parent_spec:',
        '  name: "business_V_0-2-0"',
        '  url: "custom-templates/business_V_0-2-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Work]]',
        '',
        '# NN Work',
        '## NN Work: Triage',
        '  First element.',
        '',
      ].join('\n')

      const result = await validateModel(rootDir, undefined, contentWithRelativeParent)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('delegates level-2 content to validateTemplate (D1 auto-detection)', async () => {
      // Level 2 with no parent_spec.url triggers the PARENT_RESOLUTION_FAILED diagnostic
      // that is specific to validateTemplate — this only fires if validateModel truly
      // delegated, since plain model validation reports "Missing parent_spec" instead.
      const level2Content = [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 2',
        'title: "A Template"',
        '---',
      ].join('\n')
      const result = await validateModel(rootDir, undefined, level2Content)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toMatch(/PARENT_RESOLUTION_FAILED/)
    })
  })

  describe('validateModelUrl', () => {
    it('fetches model content from the URL and validates it', async () => {
      // Only the model URL resolves; the subsequent parent_spec.url lookup for
      // the template (a second, distinct fetch) is left rejected by the
      // default mock so the declared parent template cannot be resolved — this
      // is now a clear PARENT_RESOLUTION_FAILED error, not a warning.
      vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = String(input)
        if (url.includes('Mutable_NN.md')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(MUTABLE_MODEL_CONTENT),
          } as Response)
        }
        return Promise.reject(new Error('not stubbed'))
      })

      const result = await validateModelUrl(rootDir, 'https://example.com/Mutable_NN.md')
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => /PARENT_RESOLUTION_FAILED/.test(e.message))).toBe(true)
      expect(result.warnings.some((w) => /no template resolved/i.test(w.message))).toBe(false)
    })

    it('reports an error when the fetch response is not ok', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response)

      const result = await validateModelUrl(rootDir, 'https://example.com/missing_NN.md')
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toMatch(/Failed to fetch model URL: 404 Not Found/)
    })

    it('reports an error when the fetch itself throws', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('DNS failure'))

      const result = await validateModelUrl(rootDir, 'https://example.com/unreachable_NN.md')
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toMatch(/Model URL unreachable/)
    })
  })

  describe('applyChange', () => {
    it('reports a model-not-found error', async () => {
      const result = await applyChange(rootDir, 'Nope', 'add_element', {
        conceptName: 'Work',
        elementName: 'Review',
      })
      expect(result.success).toBe(false)
      expect(result.errors?.[0].message).toBe('Model not found: Nope')
    })

    it('applies a valid mutation, validates against the resolved template, and writes back to disk', async () => {
      await stubBusinessTemplate()
      const filePath = join(rootDir, 'Mutable_NN.md')
      await writeFile(filePath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Mutable', 'add_element', {
        conceptName: 'Work',
        elementName: 'Review',
        description: 'Code review step.',
      })

      expect(result.success).toBe(true)
      expect(result.model?.elements.get('Work')?.some((e) => e.name === 'Review')).toBe(true)

      const onDisk = await readFile(filePath, 'utf-8')
      expect(onDisk).toContain('Work: Review')
    })

    it('rejects an invalid op without writing the file', async () => {
      const filePath = join(rootDir, 'Mutable_NN.md')
      await writeFile(filePath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Mutable', 'not_a_real_op', {})

      expect(result.success).toBe(false)
      expect(result.errors?.[0].message).toBe('Unknown operation: not_a_real_op')
      const onDisk = await readFile(filePath, 'utf-8')
      expect(onDisk).toBe(MUTABLE_MODEL_CONTENT)
    })

    it('rejects a duplicate element without writing the file (mutation-level reject-without-writing)', async () => {
      const filePath = join(rootDir, 'Mutable_NN.md')
      await writeFile(filePath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Mutable', 'add_element', {
        conceptName: 'Work',
        elementName: 'Triage',
      })

      expect(result.success).toBe(false)
      expect(result.errors?.length ?? 0).toBeGreaterThan(0)
      const onDisk = await readFile(filePath, 'utf-8')
      expect(onDisk).toBe(MUTABLE_MODEL_CONTENT)
    })

    it('rejects add_concept on a level-3 model with an explicit level-gate error (H5), not a downstream schema error (reject-without-writing)', async () => {
      // add_concept authors a level-2 template primitive ("Concept
      // Definition"). "Mutable" is a level-3 model, so the core enforcement
      // engine (runMutation's LEVEL2_ONLY_OPS gate) must reject this BEFORE
      // ever attempting the mutation or the post-mutation template-schema
      // validation — surfaced here verbatim through applyChange's pass-through.
      await stubBusinessTemplate()
      const filePath = join(rootDir, 'Mutable_NN.md')
      await writeFile(filePath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Mutable', 'add_concept', {
        conceptName: 'Steps',
        type: 'list',
      })

      expect(result.success).toBe(false)
      expect(result.errors?.some((e) => /level-2/.test(e.message))).toBe(true)
      expect(result.errors?.some((e) => /not defined in template/.test(e.message))).toBe(false)
      const onDisk = await readFile(filePath, 'utf-8')
      expect(onDisk).toBe(MUTABLE_MODEL_CONTENT)
    })

    describe('modification block (agent provenance)', () => {
      it('carries a modification block on a successful general mutation, matching the builder output', async () => {
        await stubBusinessTemplate()
        const filePath = join(rootDir, 'Mutable_NN.md')
        await writeFile(filePath, MUTABLE_MODEL_CONTENT, 'utf-8')

        const result = await applyChange(rootDir, 'Mutable', 'add_element', {
          conceptName: 'Work',
          elementName: 'Review',
          description: 'Code review step.',
        })

        expect(result.success).toBe(true)
        expect(typeof result.modification).toBe('string')
        expect(result.modification).toContain('scope:: add_element concept "Work" element "Review"')
        expect(result.modification).toContain('knowledge:: Mutable')
        expect(result.modification).toContain('rationale:: _')

        const expected = buildAgentModificationBlock(
          'add_element',
          { conceptName: 'Work', elementName: 'Review', description: 'Code review step.' },
          {
            model: 'Mutable',
            knowledge: 'Mutable',
            knowledgeVersion: (result.model!.frontmatter.knowledge_version ?? result.model!.frontmatter.knowledge_version) as string,
            modelVersion: (result.model!.frontmatter.knowledge_version ?? result.model!.frontmatter.knowledge_version) as string,
            timestamp: result.modification!.match(/timestamp:: (.*)/)![1],
          },
        )
        expect(result.modification).toBe(expected)
      })

      it('flows args.rationale and args.approved_by into the block', async () => {
        await stubBusinessTemplate()
        await writeFile(join(rootDir, 'Mutable_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')

        const result = await applyChange(rootDir, 'Mutable', 'add_element', {
          conceptName: 'Work',
          elementName: 'Review',
          rationale: 'the reviewer role was missing',
          approved_by: 'user',
        })

        expect(result.success).toBe(true)
        expect(result.modification).toContain('rationale:: the reviewer role was missing')
        expect(result.modification).toContain('approved_by:: user')
      })

      it('threads args.author into the block on a general success', async () => {
        await stubBusinessTemplate()
        await writeFile(join(rootDir, 'Mutable_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')

        const result = await applyChange(rootDir, 'Mutable', 'add_element', {
          conceptName: 'Work',
          elementName: 'Review',
          description: 'Code review step.',
          author: 'OpenCode',
        })

        expect(result.success).toBe(true)
        expect(result.modification).toContain('author:: OpenCode')
        expect(result.modification).not.toContain('author:: _')
      })

      it('threads args.author into the block on a bump_version success', async () => {
        await stubBusinessTemplate()
        await writeFile(join(rootDir, 'Versioned_V_0-0-1_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')

        const result = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {
          version: 'V_0-5-0',
          author: 'OpenCode',
        })

        expect(result.success).toBe(true)
        expect(result.modification).toContain('author:: OpenCode')
        expect(result.modification).not.toContain('author:: _')
      })

      it('emits author:: _ when the caller passes no author', async () => {
        await stubBusinessTemplate()
        await writeFile(join(rootDir, 'Mutable_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')

        const result = await applyChange(rootDir, 'Mutable', 'add_element', {
          conceptName: 'Work',
          elementName: 'Review',
          description: 'Code review step.',
        })

        expect(result.success).toBe(true)
        expect(result.modification).toContain('author:: _')
      })

      it('never leaks an author marker into a failed mutation (modification absent)', async () => {
        await stubBusinessTemplate()
        await writeFile(join(rootDir, 'Mutable_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')

        const dup = await applyChange(rootDir, 'Mutable', 'add_element', {
          conceptName: 'Work',
          elementName: 'Triage',
          author: 'OpenCode',
        })

        expect(dup.success).toBe(false)
        expect(dup.modification).toBeUndefined()
        expect(dup).not.toHaveProperty('modification')
      })

      it('carries a bump_version block that states the version transition', async () => {
        await stubBusinessTemplate()
        await writeFile(join(rootDir, 'Versioned_V_0-0-1_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')

        const result = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {
          version: 'V_0-5-0',
        })

        expect(result.success).toBe(true)
        expect(result.modification).toContain('scope:: bump_version "V_0-0-1" → "V_0-5-0"')
        expect(result.modification).toContain('version_transition:: V_0-0-1 → V_0-5-0')
        expect(result.modification).toContain('knowledge_version:: V_0-5-0')
      })

      it('omits the modification block on every failure path', async () => {
        await stubBusinessTemplate()
        await writeFile(join(rootDir, 'Mutable_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')
        await writeFile(join(rootDir, 'Versioned_V_0-0-1_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')

        const dup = await applyChange(rootDir, 'Mutable', 'add_element', {
          conceptName: 'Work',
          elementName: 'Triage',
        })
        expect(dup.success).toBe(false)
        expect(dup.modification).toBeUndefined()

        const badOp = await applyChange(rootDir, 'Mutable', 'not_a_real_op', {})
        expect(badOp.success).toBe(false)
        expect(badOp.modification).toBeUndefined()

        const badVersion = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {
          version: 'banana',
        })
        expect(badVersion.success).toBe(false)
        expect(badVersion.modification).toBeUndefined()
      })
    })

    it('bump_version with an explicit version renames the file and updates frontmatter', async () => {
      await stubBusinessTemplate()
      const oldPath = join(rootDir, 'Versioned_V_0-0-1_NN.md')
      await writeFile(oldPath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {
        version: 'V_0-5-0',
      })

      expect(result.success).toBe(true)
      expect(result.model?.frontmatter.knowledge_version ?? result.model?.frontmatter.knowledge_version).toBe('V_0-5-0')
      expect(result.newPath).toBe(join(rootDir, 'Versioned_V_0-5-0_NN.md'))

      // Old file removed, new file carries the bumped frontmatter.
      await expect(readFile(oldPath, 'utf-8')).rejects.toThrow()
      const newContent = await readFile(result.newPath!, 'utf-8')
      expect(newContent).toContain('knowledge_version: "V_0-5-0"')
    })

    it('bump_version increments patch by default when no bump level is given', async () => {
      await stubBusinessTemplate()
      const oldPath = join(rootDir, 'Versioned_V_0-0-1_NN.md')
      await writeFile(oldPath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {})

      expect(result.success).toBe(true)
      expect(result.model?.frontmatter.knowledge_version ?? result.model?.frontmatter.knowledge_version).toBe('V_0-0-2')
      expect(result.newPath).toBe(join(rootDir, 'Versioned_V_0-0-2_NN.md'))
    })

    it('bump_version with bump minor increments the minor part', async () => {
      await stubBusinessTemplate()
      const oldPath = join(rootDir, 'Versioned_V_0-0-1_NN.md')
      await writeFile(oldPath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {
        bump: 'minor',
      })

      expect(result.success).toBe(true)
      expect(result.model?.frontmatter.knowledge_version ?? result.model?.frontmatter.knowledge_version).toBe('V_0-1-1')
      expect(result.newPath).toBe(join(rootDir, 'Versioned_V_0-1-1_NN.md'))
    })

    it('bump_version rewrites in place when the filename has no version segment', async () => {
      await stubBusinessTemplate()
      const filePath = join(rootDir, 'Mutable_NN.md')
      await writeFile(filePath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Mutable', 'bump_version', { bump: 'minor' })

      expect(result.success).toBe(true)
      expect(result.model?.frontmatter.knowledge_version ?? result.model?.frontmatter.knowledge_version).toBe('V_0-1-1')
      expect(result.newPath).toBe(filePath)
      const onDisk = await readFile(filePath, 'utf-8')
      expect(onDisk).toContain('knowledge_version: "V_0-1-1"')
    })

    it('bump_version rejects an invalid version without touching the file', async () => {
      await stubBusinessTemplate()
      const filePath = join(rootDir, 'Versioned_V_0-0-1_NN.md')
      await writeFile(filePath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {
        version: 'banana',
      })

      expect(result.success).toBe(false)
      expect(result.errors?.[0].message).toMatch(/Invalid version args/)
      const onDisk = await readFile(filePath, 'utf-8')
      expect(onDisk).toBe(MUTABLE_MODEL_CONTENT)
    })

    it('bump_version updates index.md references (bare filename and kNNowledge/<filename> forms) to the new filename (Fix 5b)', async () => {
      await stubBusinessTemplate()
      const oldPath = join(rootDir, 'Versioned_V_0-0-1_NN.md')
      await writeFile(oldPath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const oldFilename = 'Versioned_V_0-0-1_NN.md'
      const newFilename = 'Versioned_V_0-5-0_NN.md'
      await writeFile(
        join(rootDir, 'index.md'),
        [
          '---',
          'spec_version: "V_0-1-2"',
          'level: 0',
          'title: "Workspace Index"',
          '---',
          '',
          '# NN index',
          `* [${oldFilename}](./${oldFilename})`,
          `* [models version](kNNowledge/${oldFilename})`,
          '',
        ].join('\n'),
        'utf-8',
      )

      const result = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {
        version: 'V_0-5-0',
      })

      expect(result.success).toBe(true)
      expect(result.newPath).toBe(join(rootDir, newFilename))

      const indexContent = await readFile(join(rootDir, 'index.md'), 'utf-8')
      expect(indexContent).toContain(newFilename)
      expect(indexContent).toContain(`kNNowledge/${newFilename}`)
      expect(indexContent).not.toContain(oldFilename)
    })

    it('bump_version rejects an unknown bump level without touching the file', async () => {
      await stubBusinessTemplate()
      const filePath = join(rootDir, 'Versioned_V_0-0-1_NN.md')
      await writeFile(filePath, MUTABLE_MODEL_CONTENT, 'utf-8')

      const result = await applyChange(rootDir, 'Versioned_V_0-0-1', 'bump_version', {
        bump: 'hotfix',
      })

      expect(result.success).toBe(false)
      expect(result.errors?.[0].message).toMatch(/Invalid version args/)
      const onDisk = await readFile(filePath, 'utf-8')
      expect(onDisk).toBe(MUTABLE_MODEL_CONTENT)
    })
  })

  describe('validateTemplate', () => {
    it('rejects when neither id nor content is provided', async () => {
      const result = await validateTemplate(rootDir)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toBe('Provide either id or content')
    })

    it('reports a template-file-not-found error in id mode', async () => {
      const result = await validateTemplate(rootDir, 'DoesNotExist')
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toBe('Template file not found: DoesNotExist')
    })

    it('reports PARENT_RESOLUTION_FAILED when parent_spec.url is missing', async () => {
      const content = [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 2',
        'title: "No Parent"',
        '---',
      ].join('\n')
      const result = await validateTemplate(rootDir, undefined, content)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toMatch(/PARENT_RESOLUTION_FAILED/)
      expect(result.errors[0].message).toMatch(/Parent spec URL missing/)
    })

    it('reports PARENT_RESOLUTION_FAILED when the parent spec url cannot be resolved', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network unreachable'))
      const content = [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 2',
        'title: "Unresolvable Parent"',
        'parent_spec:',
        '  name: "iNNfo_V_9-9-9"',
        '  url: "https://example.com/iNNfo_V_9-9-9_NN.md"',
        '---',
      ].join('\n')
      const result = await validateTemplate(rootDir, undefined, content)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toMatch(/PARENT_RESOLUTION_FAILED/)
      expect(result.errors[0].message).toMatch(/could not be resolved/)
    })

    it('reports a level mismatch error for a resolvable template that is not level 2', async () => {
      await stubSpecChain()
      const content = [
        '---',
        'blueprint_version: "V_0-2-0"',
        'level: 3',
        'title: "Wrong Level"',
        'parent_spec:',
        '  name: "iNNfo_V_0-3-0"',
        '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
        '---',
      ].join('\n')
      const result = await validateTemplate(rootDir, undefined, content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => /Expected level 2/.test(e.message))).toBe(true)
    })

    it('reports a missing-title error', async () => {
      await stubSpecChain()
      const content = [
        '---',
        'blueprint_version: "V_0-2-0"',
        'level: 2',
        'parent_spec:',
        '  name: "iNNfo_V_0-3-0"',
        '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
        '---',
      ].join('\n')
      const result = await validateTemplate(rootDir, undefined, content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => /Missing title/.test(e.message))).toBe(true)
    })

    it('validates a well-formed level-2 template against its resolved level-1 parent', async () => {
      await stubSpecChain()
      const content = [
        '---',
        'blueprint_version: "V_0-2-0"',
        'level: 2',
        'title: "Business Template"',
        'parent_spec:',
        '  name: "iNNfo_V_0-3-0"',
        '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
        '---',
      ].join('\n')
      const result = await validateTemplate(rootDir, undefined, content)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('validates a template loaded from disk by id', async () => {
      await stubSpecChain()
      const content = [
        '---',
        'blueprint_version: "V_0-2-0"',
        'level: 2',
        'title: "Business Template"',
        'parent_spec:',
        '  name: "iNNfo_V_0-3-0"',
        '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
        '---',
      ].join('\n')
      await writeFile(join(rootDir, 'Template_NN.md'), content, 'utf-8')
      const result = await validateTemplate(rootDir, 'Template')
      expect(result.valid).toBe(true)
    })
  })

  describe('type:: knowledge mutations', () => {
    it('supports adding and mutating type:: knowledge concepts and fields', async () => {
      await stubBusinessTemplate()
      const workspaceContent = [
        '---',
        'level: 3',
        'knowledge_version: "V_0-0-1"',
        'title: "Workspace Model"',
        'parent_spec:',
        '  name: "business_V_0-2-0"',
        '  url: "https://example.com/business_V_0-2-0_NN.md"',
        '---',
        '',
        '# NN Models',
        '## NN Models: AuthSubsystem',
        'path:: kNNowledge/auth_01.md',
        '',
      ].join('\n')
      await writeFile(join(rootDir, 'workspace_01_NN.md'), workspaceContent, 'utf-8')

      const templateContent = [
        '---',
        'blueprint_version: "V_0-2-0"',
        'level: 2',
        'title: "Workspace Spec"',
        'parent_spec:',
        '  name: "iNNfo_V_0-3-0"',
        '  url: "https://example.com/iNNfo_V_0-3-0_NN.md"',
        '---',
        '# NN Concept Definition',
        '## NN Concept Definition: Models',
        'type:: list',
      ].join('\n')
      await writeFile(join(specsDir, 'business_V_0-2-0_NN.md'), templateContent, 'utf-8')

      const updateRes = await applyChange(rootDir, 'workspace_01', 'update_field', {
        conceptName: 'Models',
        elementName: 'AuthSubsystem',
        fieldName: 'path',
        value: 'kNNowledge/auth_v2.md',
      })
      expect(updateRes.success).toBe(true)
      expect(updateRes.model?.elements.get('Models')?.[0].fields['path']).toBe('kNNowledge/auth_v2.md')
    })
  })

  describe('Version Migration, Backup & Pruning Tooling (Batch 4)', () => {
    it('calculates spec reachability graph identifying active vs orphaned spec candidates', async () => {
      const { calculateSpecReachability } = await import('./mutate')

      // Create active model referencing business_V_0-2-0
      const modelsDir = join(rootDir, 'models')
      await mkdir(modelsDir, { recursive: true })
      await writeFile(
        join(modelsDir, 'Alpha_V_0-1-0_NN.md'),
        [
          '---',
          'parent_spec:',
          '  name: "business_V_0-2-0"',
          '  url: "https://example.com/business_V_0-2-0_NN.md"',
          '---',
        ].join('\n'),
      )

      // Create spec package for active business_V_0-2-0 and orphaned legacy_V_0-1-0
      const activePkgDir = join(specsDir, 'bluepriNNts', 'business', 'V_0-2-0')
      const orphanPkgDir = join(specsDir, 'bluepriNNts', 'legacy', 'V_0-1-0')
      await mkdir(activePkgDir, { recursive: true })
      await mkdir(orphanPkgDir, { recursive: true })
      await writeFile(join(activePkgDir, 'spec_NN.md'), '---\nspec_version: "V_0-2-0"\n---')
      await writeFile(join(orphanPkgDir, 'spec_NN.md'), '---\nspec_version: "V_0-1-0"\n---')

      const graph = await calculateSpecReachability(rootDir)

      expect(graph.activeSpecs.has('business_v_0-2-0') || graph.activeSpecs.has('business')).toBe(
        true,
      )
      expect(graph.orphanedCandidates).toContain(orphanPkgDir)
      expect(graph.orphanedCandidates).not.toContain(activePkgDir)
    })

    it('creates timestamped backup zip snapshot packaging candidate specs', async () => {
      const { createSpecsBackupZip } = await import('./mutate')
      const orphanPkgDir = join(specsDir, 'bluepriNNts', 'legacy', 'V_0-1-0')
      await mkdir(orphanPkgDir, { recursive: true })
      await writeFile(join(orphanPkgDir, 'spec_NN.md'), 'Orphan spec content')

      const zipPath = await createSpecsBackupZip(rootDir, [orphanPkgDir])

      expect(zipPath).toContain(join('.backup', 'specs_'))
      expect(zipPath.endsWith('.zip')).toBe(true)

      const { stat } = await import('node:fs/promises')
      const st = await stat(zipPath)
      expect(st.isFile()).toBe(true)
      expect(st.size).toBeGreaterThan(0)
    })

    // Moved from the former test/coverage-expansion.spec.ts, a grab-bag named
    // after a coverage metric rather than a behaviour. Only the empty-corpus
    // branch came across; its dry_run and live-prune assertions duplicated the
    // two tests below.
    it('pruneOrphanedSpecs reports a clean result when there is nothing to prune', async () => {
      const { pruneOrphanedSpecs } = await import('./mutate')

      const result = await pruneOrphanedSpecs(rootDir)

      expect(result.success).toBe(true)
      expect(result.orphanedCount).toBe(0)
      expect(result.message).toBe('No orphaned specs found.')
    })

    it('pruneOrphanedSpecs in dry_run mode reports deletion candidates without deleting', async () => {
      const { pruneOrphanedSpecs } = await import('./mutate')
      const orphanPkgDir = join(specsDir, 'bluepriNNts', 'orphan_package', 'V_0-1-0')
      await mkdir(orphanPkgDir, { recursive: true })
      await writeFile(join(orphanPkgDir, 'spec_NN.md'), 'Orphan content')

      const result = await pruneOrphanedSpecs(rootDir, { dry_run: true, backup: true })

      expect(result.success).toBe(true)
      expect(result.dryRun).toBe(true)
      expect(result.orphanedCount).toBeGreaterThan(0)
      expect(result.removedFiles).toContain(orphanPkgDir)

      // Verify directory was NOT deleted
      const { stat } = await import('node:fs/promises')
      const st = await stat(orphanPkgDir)
      expect(st.isDirectory()).toBe(true)
    })

    it('pruneOrphanedSpecs with dry_run false creates backup zip and deletes orphaned specs', async () => {
      const { pruneOrphanedSpecs } = await import('./mutate')
      const orphanPkgDir = join(specsDir, 'bluepriNNts', 'to_delete', 'V_0-1-0')
      await mkdir(orphanPkgDir, { recursive: true })
      await writeFile(join(orphanPkgDir, 'spec_NN.md'), 'To delete')

      const result = await pruneOrphanedSpecs(rootDir, { dry_run: false, backup: true })

      expect(result.success).toBe(true)
      expect(result.dryRun).toBe(false)
      expect(result.backupZip).not.toBeNull()

      // Verify directory was deleted
      const { stat } = await import('node:fs/promises')
      await expect(stat(orphanPkgDir)).rejects.toThrow()
    })

    it('C-01 & W-02: calculates reachability correctly on canonical package layout (spec_NN.md) and populates normalized <name>@<version> keys', async () => {
      const { calculateSpecReachability } = await import('./mutate')

      // Create model pointing to parent package template via URL and name
      const modelsDir = join(rootDir, 'models')
      await mkdir(modelsDir, { recursive: true })
      await writeFile(
        join(modelsDir, 'App_Model_V_1-0-0_NN.md'),
        [
          '---',
          'parent_spec:',
          '  name: "canonical_pkg"',
          '  url: "https://example.com/specs/bluepriNNts/canonical_pkg/V_1-0-0/spec_NN.md"',
          '---',
        ].join('\n'),
      )

      // Create canonical package directory for canonical_pkg V_1-0-0
      const activePkgDir = join(specsDir, 'bluepriNNts', 'canonical_pkg', 'V_1-0-0')
      const subPkgDir = join(specsDir, 'bluepriNNts', 'sub_pkg', 'V_0-5-0')
      await mkdir(activePkgDir, { recursive: true })
      await mkdir(subPkgDir, { recursive: true })

      // activePkg includes sub_pkg via canonical package layout
      await writeFile(
        join(activePkgDir, 'spec_NN.md'),
        [
          '---',
          'spec_version: "V_1-0-0"',
          'includes:',
          '  - name: "sub_pkg"',
          '    url: "https://example.com/specs/bluepriNNts/sub_pkg/V_0-5-0/spec_NN.md"',
          '---',
        ].join('\n'),
      )

      await writeFile(join(subPkgDir, 'spec_NN.md'), '---\nspec_version: "V_0-5-0"\n---')

      const graph = await calculateSpecReachability(rootDir)

      // Verify activeSpecs contains normalized <name>@<version> keys (Fix W-02)
      expect(graph.activeSpecs.has('canonical_pkg@1.0.0')).toBe(true)
      expect(graph.activeSpecs.has('sub_pkg@0.5.0')).toBe(true)

      // Verify canonical package directories are NOT identified as orphaned (Fix C-01)
      expect(graph.orphanedCandidates).not.toContain(activePkgDir)
      expect(graph.orphanedCandidates).not.toContain(subPkgDir)
    })
  })

  // Moved from the former test/coverage-expansion.spec.ts, a grab-bag named
  // after a coverage metric rather than a behaviour.
  it('applyChange: bump_version with parent_version renames local parent template', async () => {
    // 1. Setup local parent template
    const templatePath = join(specsDir, 'my_template_V_0-1-0_NN.md')
    await writeFile(
      templatePath,
      [
        '---',
        'spec_version: "V_0-1-0"',
        'level: 2',
        'title: "My Template"',
        'parent_spec:',
        '  name: "iNNfo_V_0-1-0"',
        '  url: "specs/iNNfo_V_0-1-0_NN.md"',
        '---',
        '',
        '# NN Concept Definition',
        '## NN Concept Definition: Task',
        'type:: list',
        '',
      ].join('\n'),
      'utf-8',
    )

    // Stub level 1 + 0 chain
    await writeFile(
      join(specsDir, 'iNNfo_V_0-1-0_NN.md'),
      '---\nspec_version: "V_0-1-0"\nlevel: 1\ntitle: "iNNfo"\nparent_spec:\n  name: "defiNNe_V_0-1-0"\n  url: "specs/defiNNe_V_0-1-0_NN.md"\n---\n',
      'utf-8',
    )
    await writeFile(
      join(specsDir, 'defiNNe_V_0-1-0_NN.md'),
      '---\nspec_version: "V_0-1-0"\nlevel: 0\ntitle: "defiNNe"\n---\n',
      'utf-8',
    )

    // 2. Setup model pointing to local template
    const modelPath = join(modelsDir, 'my_model_V_0-1-0_my_template_NN.md')
    await writeFile(
      modelPath,
      [
        '---',
        'spec_version: "V_0-1-0"',
        'level: 3',
        'knowledge_version: "V_0-1-0"',
        'title: "My Model"',
        'parent_spec:',
        '  name: "my_template_V_0-1-0"',
        '  url: "specs/my_template_V_0-1-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Task]]',
        '',
        '# NN Task',
        '## NN Task: Alpha',
        '  Task Alpha',
        '',
      ].join('\n'),
      'utf-8',
    )

    // Bump model to 0.2.0 and parent to 0.2.0
    const res = await applyChange(rootDir, 'my_model_V_0-1-0_my_template', 'bump_version', {
      version: '0.2.0',
      parent_version: '0.2.0',
    })

    expect(res.success).toBe(true)
    const newTemplatePath = join(specsDir, 'my_template_V_0-2-0_NN.md')
    const tStat = await stat(newTemplatePath)
    expect(tStat.isFile()).toBe(true)

    const updatedParentContent = await readFile(newTemplatePath, 'utf-8')
    expect(updatedParentContent).toContain('spec_version: "V_0-2-0"')
  })

  it('applyChange: rename_element renames associated asset directory if present', async () => {
    // Stub spec chain and template
    await writeFile(
      join(specsDir, 'iNNfo_V_0-1-0_NN.md'),
      '---\nspec_version: "V_0-1-0"\nlevel: 1\ntitle: "iNNfo"\nparent_spec:\n  name: "defiNNe_V_0-1-0"\n  url: "specs/defiNNe_V_0-1-0_NN.md"\n---\n',
      'utf-8',
    )
    await writeFile(
      join(specsDir, 'defiNNe_V_0-1-0_NN.md'),
      '---\nspec_version: "V_0-1-0"\nlevel: 0\ntitle: "defiNNe"\n---\n',
      'utf-8',
    )
    await writeFile(
      join(specsDir, 't_V_0-1-0_NN.md'),
      [
        '---',
        'spec_version: "V_0-1-0"',
        'level: 2',
        'title: "T"',
        'parent_spec:',
        '  name: "iNNfo_V_0-1-0"',
        '  url: "specs/iNNfo_V_0-1-0_NN.md"',
        '---',
        '',
        '# NN Concept Definition',
        '## NN Concept Definition: Item',
        'type:: list',
        '',
      ].join('\n'),
      'utf-8',
    )

    const modelPath = join(modelsDir, 'm_V_0-1-0_t_NN.md')
    await writeFile(
      modelPath,
      [
        '---',
        'spec_version: "V_0-1-0"',
        'level: 3',
        'knowledge_version: "V_0-1-0"',
        'title: "M"',
        'parent_spec:',
        '  name: "t_V_0-1-0"',
        '  url: "specs/t_V_0-1-0_NN.md"',
        '---',
        '',
        '# NN index',
        '* [[Item]]',
        '',
        '# NN Item',
        '## NN Item: Original',
        '  Content',
        '',
      ].join('\n'),
      'utf-8',
    )

    // Create assets/original directory
    const oldAssetDir = join(modelsDir, 'assets', 'original')
    await mkdir(oldAssetDir, { recursive: true })
    await writeFile(join(oldAssetDir, 'data.txt'), 'hello', 'utf-8')

    const res = await applyChange(rootDir, 'm_V_0-1-0_t', 'rename_element', {
      conceptName: 'Item',
      elementName: 'Original',
      newName: 'Renamed',
    })

    expect(res.success).toBe(true)
    const newAssetDir = join(modelsDir, 'assets', 'renamed')
    const st = await stat(newAssetDir)
    expect(st.isDirectory()).toBe(true)
  })
})
