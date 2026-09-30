import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import {
  resolveParentChainNode,
  saveSpecOnce,
  fetchBlueprintPackageFromRemote,
  defaultCacheDir,
} from './resolver-node'
import { rmWithRetry } from '../../test/helpers/fs-retry'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-resolver')
const specsDir = join(rootDir, 'specs')

describe('NodeSpecResolver', () => {
  const origGlobal = process.env.INNFO_GLOBAL_DIR
  const origSkills = process.env.INNFO_SKILLS_DIR
  const origCache = process.env.INNFO_CACHE_DIR

  beforeEach(async () => {
    process.env.INNFO_GLOBAL_DIR = join(rootDir, 'isolated-global')
    process.env.INNFO_SKILLS_DIR = join(rootDir, 'isolated-skills')
    // Hermetic temp cache: the OS temp dir is shared across test files, so
    // every fetch-and-save in this file lands in an isolated dir instead.
    process.env.INNFO_CACHE_DIR = join(rootDir, 'isolated-cache')
    // Reset/clean temp directory
    await rmWithRetry(rootDir)
    await mkdir(specsDir, { recursive: true })
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    if (origGlobal !== undefined) process.env.INNFO_GLOBAL_DIR = origGlobal
    else delete process.env.INNFO_GLOBAL_DIR
    if (origSkills !== undefined) process.env.INNFO_SKILLS_DIR = origSkills
    else delete process.env.INNFO_SKILLS_DIR
    if (origCache !== undefined) process.env.INNFO_CACHE_DIR = origCache
    else delete process.env.INNFO_CACHE_DIR
    await rmWithRetry(rootDir)
  })

  it('R-LSR-01: resolves spec from local specs/ directory recursively', async () => {
    // Setup nested spec file: specs/domain-a/business_V_0-1-1_NN.md
    const subDir = join(specsDir, 'domain-a')
    await mkdir(subDir, { recursive: true })
    const localSpecPath = join(subDir, 'business_V_0-1-1_NN.md')
    const specContent = [
      '---',
      'spec_version: "V_0-1-1"',
      'level: 2',
      'title: "Local Business Spec"',
      '---',
      'Local Content',
    ].join('\n')
    await writeFile(localSpecPath, specContent, 'utf-8')

    const fetchSpy = vi.spyOn(global, 'fetch')

    const result = await resolveParentChainNode(
      rootDir,
      'https://example.com/business_V_0-1-1_NN.md',
      'business_V_0-1-1',
    )

    // Verify it read from the local file and didn't fetch
    expect(fetchSpy).not.toHaveBeenCalled()
    const doc = result.specs.get('business_V_0-1-1')
    expect(doc).toBeDefined()
    expect(doc?.rawContent).toBe(specContent)
    expect(doc?.frontmatter.title).toBe('Local Business Spec')
  })

  it('R-LSR-01: matches unversioned local spec filename via frontmatter spec_version', async () => {
    // Setup unversioned spec file: specs/latest/level2/business_NN.md
    const subDir = join(specsDir, 'latest', 'level2')
    await mkdir(subDir, { recursive: true })
    const localSpecPath = join(subDir, 'business_NN.md')
    const specContent = [
      '---',
      'spec_version: "V_0-1-1"',
      'level: 2',
      'title: "Unversioned File But Correct Version"',
      '---',
      'Unversioned Content',
    ].join('\n')
    await writeFile(localSpecPath, specContent, 'utf-8')

    const fetchSpy = vi.spyOn(global, 'fetch')

    const result = await resolveParentChainNode(
      rootDir,
      'https://example.com/business_V_0-1-1_NN.md',
      'business_V_0-1-1',
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    const doc = result.specs.get('business_V_0-1-1')
    expect(doc).toBeDefined()
    expect(doc?.rawContent).toBe(specContent)
  })

  it('R-LSR-01: bypasses local file if version mismatches and falls back to network', async () => {
    // Setup local spec file with mismatched version: specs/business_V_0-1-0_NN.md
    const localSpecPath = join(specsDir, 'business_V_0-1-0_NN.md')
    await writeFile(
      localSpecPath,
      ['---', 'spec_version: "V_0-1-0"', 'level: 2', '---'].join('\n'),
      'utf-8',
    )

    // Mock fetch for the correct version
    const remoteContent = [
      '---',
      'spec_version: "V_0-1-1"',
      'level: 2',
      'title: "Remote Business Spec"',
      '---',
      'Remote Content',
    ].join('\n')

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(remoteContent),
      } as Response),
    )

    const result = await resolveParentChainNode(
      rootDir,
      'https://example.com/business_V_0-1-1_NN.md',
      'business_V_0-1-1',
      { inPlace: true },
    )

    // Should fetch from network since local version was 0-1-0 and requested was 0-1-1
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const doc = result.specs.get('business_V_0-1-1')
    expect(doc?.frontmatter.title).toBe('Remote Business Spec')

    // Verify it was saved into specs/ under its own canonical name
    const savedFile = await readFile(join(specsDir, 'business_V_0-1-1_NN.md'), 'utf-8')
    expect(savedFile).toBe(remoteContent)
  })

  it('R-LSR-02: fetches from network and saves into specs/ when not found locally', async () => {
    const remoteContent = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 1',
      'title: "Remote Spec"',
      '---',
    ].join('\n')

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(remoteContent),
      } as Response),
    )

    const result = await resolveParentChainNode(
      rootDir,
      'https://example.com/iNNfo_V_0-2-0_NN.md',
      'iNNfo_V_0-2-0',
      { inPlace: true },
    )

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.specs.has('iNNfo_V_0-2-0')).toBe(true)

    // Verify saved on disk
    const savedContent = await readFile(join(specsDir, 'iNNfo_V_0-2-0_NN.md'), 'utf-8')
    expect(savedContent).toBe(remoteContent)
  })

  it('R-LSR-02: loads from specs/ on subsequent requests without network fetch', async () => {
    const localContent = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 1',
      'title: "Local Spec"',
      '---',
    ].join('\n')
    await writeFile(join(specsDir, 'iNNfo_V_0-2-0_NN.md'), localContent, 'utf-8')

    const fetchSpy = vi.spyOn(global, 'fetch')

    const result = await resolveParentChainNode(
      rootDir,
      'https://example.com/iNNfo_V_0-2-0_NN.md',
      'iNNfo_V_0-2-0',
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    const doc = result.specs.get('iNNfo_V_0-2-0')
    expect(doc?.frontmatter.title).toBe('Local Spec')
  })

  it('R-LSR-03: saves a downloaded spec under its canonical versioned name', async () => {
    // Request comes from a `latest/` URL (unversioned basename), content declares V_0-3-0.
    const remoteContent = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 2',
      'title: "Business Latest"',
      '---',
      'Canonical Content',
    ].join('\n')
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve({ ok: true, text: () => Promise.resolve(remoteContent) } as Response),
      )

    const result = await resolveParentChainNode(
      rootDir,
      'https://example.com/specs/latest/level2/business/business_NN.md',
      'business',
      { inPlace: true },
    )

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.specs.get('business')).toBeDefined()

    // specs/ is written with the document's own version, not the request name.
    const saved = await readFile(join(specsDir, 'business_V_0-3-0_NN.md'), 'utf-8')
    expect(saved).toBe(remoteContent)
    // No versionless duplicate is produced.
    await expect(readFile(join(specsDir, 'business_NN.md'), 'utf-8')).rejects.toThrow()
  })

  it('R-LSR-03: versioned request reuses the canonical local file without fetching', async () => {
    const localContent = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 2',
      'title: "Business Latest"',
      '---',
      'Canonical Content',
    ].join('\n')
    await writeFile(join(specsDir, 'business_V_0-3-0_NN.md'), localContent, 'utf-8')

    const fetchSpy = vi.spyOn(global, 'fetch')

    const result = await resolveParentChainNode(
      rootDir,
      'https://example.com/business_V_0-3-0_NN.md',
      'business_V_0-3-0',
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.specs.get('business_V_0-3-0')?.frontmatter.title).toBe('Business Latest')
  })

  it('R-LSR-03: legacy unversioned local file resolves for versioned and unversioned requests', async () => {
    const legacyContent = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 2',
      'title: "Legacy File"',
      '---',
      'Legacy Content',
    ].join('\n')
    await writeFile(join(specsDir, 'business_NN.md'), legacyContent, 'utf-8')

    const fetchSpy = vi.spyOn(global, 'fetch')

    const versioned = await resolveParentChainNode(
      rootDir,
      'https://example.com/business_V_0-3-0_NN.md',
      'business_V_0-3-0',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(versioned.specs.get('business_V_0-3-0')?.frontmatter.title).toBe('Legacy File')

    fetchSpy.mockClear()
    const unversioned = await resolveParentChainNode(
      rootDir,
      'https://example.com/specs/latest/level2/business/business_NN.md',
      'business',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(unversioned.specs.get('business')?.frontmatter.title).toBe('Legacy File')
  })

  it('R-LSR-03: unversioned local request prefers the highest matching version', async () => {
    await writeFile(
      join(specsDir, 'business_V_0-2-1_NN.md'),
      ['---', 'spec_version: "V_0-2-1"', 'level: 2', 'title: "Old"', '---'].join('\n'),
      'utf-8',
    )
    await writeFile(
      join(specsDir, 'business_V_0-3-0_NN.md'),
      ['---', 'spec_version: "V_0-3-0"', 'level: 2', 'title: "New"', '---'].join('\n'),
      'utf-8',
    )

    const fetchSpy = vi.spyOn(global, 'fetch')

    const result = await resolveParentChainNode(
      rootDir,
      'https://example.com/specs/latest/level2/business/business_NN.md',
      'business',
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.specs.get('business')?.frontmatter.title).toBe('New')
  })

  it('R-LSR-04: throws SpecResolutionError listing the searched locations when all resolution steps fail', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network disabled'))

    const error = await resolveParentChainNode(
      rootDir,
      'https://example.com/business_V_9-9-9_NN.md',
      'business_V_9-9-9',
    ).then(
      () => null,
      (e) => e,
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('business_V_9-9-9')
    expect(error.message).toContain('Attempted')
    expect(error.message).toContain(specsDir)
    expect(error.message).toContain('network url')
  })

  it('fails loud (throws) on unparseable frontmatter, regardless of where the content came from', async () => {
    const corruptContent = 'this file has no YAML frontmatter block at all, just prose.'
    await writeFile(join(specsDir, 'business_V_0-7-0_NN.md'), corruptContent, 'utf-8')

    const fetchSpy = vi.spyOn(global, 'fetch')

    const error = await resolveParentChainNode(
      rootDir,
      'https://example.com/business_V_0-7-0_NN.md',
      'business_V_0-7-0',
    ).then(
      () => null,
      (e) => e,
    )

    // specs/ is trusted content, not a fungible cache — a corrupt local file
    // is a hard error, not a silent empty-parent leaf and not a fallthrough
    // to network.
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Unparseable frontmatter')
    expect(error.message).toContain('business_V_0-7-0')
  })

  it('leaves no leftover .tmp-* files in specs/ after a network fetch writes to it', async () => {
    const remoteContent = [
      '---',
      'spec_version: "V_0-8-0"',
      'level: 2',
      'title: "Atomic Write Check"',
      '---',
    ].join('\n')
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(remoteContent) } as Response),
    )

    await resolveParentChainNode(
      rootDir,
      'https://example.com/business_V_0-8-0_NN.md',
      'business_V_0-8-0',
      { inPlace: true },
    )

    const entries = await readdir(specsDir)
    expect(entries.some((name) => name.includes('.tmp-'))).toBe(false)
    expect(entries).toContain('business_V_0-8-0_NN.md')
  })

  describe('saveSpecOnce', () => {
    it('writes a new file', async () => {
      await saveSpecOnce(specsDir, 'fresh_NN.md', 'fresh content')
      expect(await readFile(join(specsDir, 'fresh_NN.md'), 'utf-8')).toBe('fresh content')
    })

    it('never overwrites an existing file (write-once — specs/ is immutable by convention)', async () => {
      await saveSpecOnce(specsDir, 'pinned_NN.md', 'original content')
      await saveSpecOnce(specsDir, 'pinned_NN.md', 'different content')
      expect(await readFile(join(specsDir, 'pinned_NN.md'), 'utf-8')).toBe('original content')
    })
  })

  describe('4-Tier Package Resolver & Immutability (Batch 3)', () => {
    it('resolves Tier 1 workspace package directory first', async () => {
      const { resolveBlueprintPackage } = await import('./resolver-node')
      const pkgDir = join(specsDir, 'bluepriNNts', 'business', 'V_0-2-0')
      await mkdir(pkgDir, { recursive: true })
      await writeFile(join(pkgDir, 'spec_NN.md'), '---\nspec_version: "V_0-2-0"\nlevel: 2\n---')

      const res = await resolveBlueprintPackage(rootDir, 'business_V_0-2-0')
      expect(res).not.toBeNull()
      expect(res?.tier).toBe('workspace-package')
      expect(res?.isPackageDir).toBe(true)
      expect(res?.specFilePath).toBe(join(pkgDir, 'spec_NN.md'))
    })

    it('falls back to Tier 2 workspace flat spec when workspace package dir is missing', async () => {
      const { resolveBlueprintPackage } = await import('./resolver-node')
      await writeFile(
        join(specsDir, 'business_V_0-2-0_NN.md'),
        '---\nspec_version: "V_0-2-0"\nlevel: 2\n---',
      )

      const res = await resolveBlueprintPackage(rootDir, 'business_V_0-2-0')
      expect(res).not.toBeNull()
      expect(res?.tier).toBe('workspace-flat')
      expect(res?.isPackageDir).toBe(false)
    })

    it('falls back to Tier 3 global user cache when absent in workspace', async () => {
      const { resolveBlueprintPackage } = await import('./resolver-node')
      const globalDir = join(rootDir, 'global_agents')
      const globalPkgDir = join(globalDir, 'projects', 'V_0-2-0')
      await mkdir(globalPkgDir, { recursive: true })
      await writeFile(join(globalPkgDir, 'spec_NN.md'), '---\nspec_version: "V_0-2-0"\n---')

      const res = await resolveBlueprintPackage(rootDir, 'projects_V_0-2-0', undefined, {
        globalDir,
      })
      expect(res).not.toBeNull()
      expect(res?.tier).toBe('global-cache')
      expect(res?.isPackageDir).toBe(true)
    })

    it('falls back to Tier 4 installed skill directory', async () => {
      const { resolveBlueprintPackage } = await import('./resolver-node')
      const skillsDir = join(rootDir, 'skills')
      const skillPkgDir = join(skillsDir, 'nn-innfo', 'bluepriNNts', 'custom', 'V_0-1-0')
      await mkdir(skillPkgDir, { recursive: true })
      await writeFile(join(skillPkgDir, 'spec_NN.md'), '---\nspec_version: "V_0-1-0"\n---')

      const res = await resolveBlueprintPackage(rootDir, 'custom_V_0-1-0', undefined, { skillsDir })
      expect(res).not.toBeNull()
      expect(res?.tier).toBe('installed-skill')
    })

    it('hydrateBlueprintPackageAtomically creates package directory via staging rename and enforces write-once immutability', async () => {
      const { hydrateBlueprintPackageAtomically } = await import('./resolver-node')
      const pkgPath = await hydrateBlueprintPackageAtomically(
        rootDir,
        'business',
        'V_0-2-0',
        'Content V1',
      )
      expect(await readFile(join(pkgPath, 'spec_NN.md'), 'utf-8')).toBe('Content V1')

      // Write-once immutability: second call does not overwrite existing package contents
      await hydrateBlueprintPackageAtomically(rootDir, 'business', 'V_0-2-0', 'Content V2')
      expect(await readFile(join(pkgPath, 'spec_NN.md'), 'utf-8')).toBe('Content V1')
    })

    it('hydrateBlueprintPackageAtomically writes a full package payload (spec + alias + procedures + samples + assets)', async () => {
      const { hydrateBlueprintPackageAtomically } = await import('./resolver-node')
      const pkgPath = await hydrateBlueprintPackageAtomically(rootDir, 'documentation', 'V_0-2-0', {
        spec: '---\nblueprint_version: "V_0-2-0"\n---\n# Doc\n',
        procedures: { 'generate_docsify_suite_NN.md': '# Procedure\n' },
        samples: { 'Ghostbusters_V_0-2-0_documentation_NN.md': '# Sample\n' },
        assets: { 'master.html': '<!doctype html>' },
      })

      expect(await readFile(join(pkgPath, 'spec_NN.md'), 'utf-8')).toContain('# Doc')
      // backward-compatible alias
      expect(await readFile(join(pkgPath, 'documentation_V_0-2-0_NN.md'), 'utf-8')).toContain(
        '# Doc',
      )
      expect(
        await readFile(join(pkgPath, 'procedures', 'generate_docsify_suite_NN.md'), 'utf-8'),
      ).toContain('# Procedure')
      expect(
        await readFile(
          join(pkgPath, 'samples', 'Ghostbusters_V_0-2-0_documentation_NN.md'),
          'utf-8',
        ),
      ).toContain('# Sample')
      expect(await readFile(join(pkgPath, 'assets', 'master.html'), 'utf-8')).toContain('doctype')
    })

    it('W-01: buildIncludeContentMap normalizes case lookup for frontmatter includes', async () => {
      const { buildIncludeContentMap } = await import('./resolver-node')

      await writeFile(
        join(specsDir, 'security_V_1-0-0_NN.md'),
        '---\nspec_version: "V_1-0-0"\nlevel: 2\ntitle: "Security"\n---\n',
        'utf-8',
      )

      const map = await buildIncludeContentMap(rootDir, [{ name: 'Security_V_1-0-0', url: '' }])

      // Must be retrievable by original name AND lowercase normalized key (Fix W-01)
      expect(map.get('Security_V_1-0-0')).toBeDefined()
      expect(map.get('security_v_1-0-0')).toBeDefined()
    })
  })

  describe('Freshness check (D2, opt-in)', () => {
    const remoteUrl = 'https://example.com/business_V_0-1-1_NN.md'
    const localContent = [
      '---',
      'spec_version: "V_0-1-1"',
      'level: 2',
      'title: "Local Business Spec"',
      '---',
      'Local Content',
    ].join('\n')

    it('marks a local-tier doc stale when the remote content differs (fetch called once)', async () => {
      await writeFile(join(specsDir, 'business_V_0-1-1_NN.md'), localContent, 'utf-8')
      const remoteContent = localContent.replace('Local Content', 'Remote Content')
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockImplementation(() =>
          Promise.resolve({ ok: true, text: () => Promise.resolve(remoteContent) } as Response),
        )

      const result = await resolveParentChainNode(rootDir, remoteUrl, 'business_V_0-1-1', {
        checkFreshness: true,
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const verdict = result.freshness?.get('business_V_0-1-1')
      expect(verdict).toEqual({ name: 'business_V_0-1-1', url: remoteUrl, verdict: 'stale' })
      expect(result.specs.get('business_V_0-1-1')?.frontmatter.title).toBe('Local Business Spec')
    })

    it('marks a local-tier doc fresh when the remote content matches', async () => {
      await writeFile(join(specsDir, 'business_V_0-1-1_NN.md'), localContent, 'utf-8')
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockImplementation(() =>
          Promise.resolve({ ok: true, text: () => Promise.resolve(localContent) } as Response),
        )

      const result = await resolveParentChainNode(rootDir, remoteUrl, 'business_V_0-1-1', {
        checkFreshness: true,
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result.freshness?.get('business_V_0-1-1')?.verdict).toBe('fresh')
    })

    it('records unknown and still resolves when the freshness fetch rejects', async () => {
      await writeFile(join(specsDir, 'business_V_0-1-1_NN.md'), localContent, 'utf-8')
      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network disabled'))

      const result = await resolveParentChainNode(rootDir, remoteUrl, 'business_V_0-1-1', {
        checkFreshness: true,
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result.freshness?.get('business_V_0-1-1')?.verdict).toBe('unknown')
      expect(result.specs.get('business_V_0-1-1')).toBeDefined()
    })

    it('does not run a freshness check when content resolved from the network tier', async () => {
      const remoteContent = [
        '---',
        'spec_version: "V_0-1-1"',
        'level: 2',
        'title: "Remote Business Spec"',
        '---',
        'Remote Content',
      ].join('\n')
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockImplementation(() =>
          Promise.resolve({ ok: true, text: () => Promise.resolve(remoteContent) } as Response),
        )

      const result = await resolveParentChainNode(rootDir, remoteUrl, 'business_V_0-1-1', {
        checkFreshness: true,
      })

      // The single fetch is the network resolution itself — no second fetch.
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result.freshness?.size ?? 0).toBe(0)
    })

    it('does not run a freshness check for a step-0 local path URL', async () => {
      const localPath = join(specsDir, 'business_V_0-1-1_NN.md')
      await writeFile(localPath, localContent, 'utf-8')
      const fetchSpy = vi.spyOn(global, 'fetch')

      const result = await resolveParentChainNode(rootDir, localPath, 'business_V_0-1-1', {
        checkFreshness: true,
      })

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(result.freshness?.size ?? 0).toBe(0)
    })

    it('records freshness only for the top document (depth 0), not chain parents', async () => {
      await writeFile(
        join(specsDir, 'iNNfo_V_0-2-0_NN.md'),
        [
          '---',
          'spec_version: "V_0-2-0"',
          'level: 1',
          'title: "iNNfo Spec"',
          '---',
          'Spec Content',
        ].join('\n'),
        'utf-8',
      )
      const templateWithParent = [
        '---',
        'spec_version: "V_0-1-1"',
        'level: 2',
        'title: "Business Template"',
        'parent_spec:',
        '  name: iNNfo_V_0-2-0',
        '  url: https://example.com/iNNfo_V_0-2-0_NN.md',
        '---',
        'Template Content',
      ].join('\n')
      await writeFile(join(specsDir, 'business_V_0-1-1_NN.md'), templateWithParent, 'utf-8')

      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockImplementation(() =>
          Promise.resolve({ ok: true, text: () => Promise.resolve('changed') } as Response),
        )

      const result = await resolveParentChainNode(rootDir, remoteUrl, 'business_V_0-1-1', {
        checkFreshness: true,
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result.freshness?.size).toBe(1)
      expect(result.freshness?.get('business_V_0-1-1')?.verdict).toBe('stale')
      expect(result.freshness?.has('iNNfo_V_0-2-0')).toBe(false)
    })
  })
})

describe('fetchBlueprintPackageFromRemote', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Route a mocked `fetch` by URL. `raw` maps a raw.githubusercontent.com URL
   * (or suffix) to body-or-404; `api` maps a GitHub contents-API dir path to a
   * listing array (or 404). Anything unmatched is a 404.
   */
  function mockFetch(raw: Record<string, string | null>, api: Record<string, unknown[] | null>) {
    return vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('https://api.github.com/')) {
        for (const [key, listing] of Object.entries(api)) {
          if (url.includes(key)) {
            return Promise.resolve(
              listing === null
                ? ({ ok: false, status: 404, statusText: 'Not Found' } as Response)
                : ({ ok: true, text: () => Promise.resolve(JSON.stringify(listing)) } as Response),
            )
          }
        }
        return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' } as Response)
      }
      for (const [key, body] of Object.entries(raw)) {
        if (url.endsWith(key)) {
          return Promise.resolve(
            body === null
              ? ({ ok: false, status: 404, statusText: 'Not Found' } as Response)
              : ({ ok: true, text: () => Promise.resolve(body) } as Response),
          )
        }
      }
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' } as Response)
    })
  }

  const file = (name: string) => ({ name, type: 'file', path: name })

  it('assembles a full package: spec + procedures + samples + assets from the blueprint tag ref', async () => {
    mockFetch(
      {
        '/business/spec_NN.md': '# Business spec',
        '/business/procedures/compile_NN.md': '# Compile procedure',
        '/business/samples/Ghostbusters_business_NN.md': '# Sample',
        '/business/assets/master.html': '<!doctype html>',
      },
      {
        'iNNfo/specs/bluepriNNts/business/procedures': [
          file('compile_NN.md'),
          { name: 'sub', type: 'dir', path: 'sub' },
        ],
        'iNNfo/specs/bluepriNNts/business/samples': [file('Ghostbusters_business_NN.md')],
        'iNNfo/specs/bluepriNNts/business/assets': [file('master.html')],
      },
    )

    const pkg = await fetchBlueprintPackageFromRemote('business', 'V_0-2-1', {
      ref: 'blueprints-v0.18.0',
    })

    expect(pkg.spec).toBe('# Business spec')
    expect(pkg.procedures).toEqual({ 'compile_NN.md': '# Compile procedure' }) // the sub-dir entry is skipped
    expect(pkg.samples).toEqual({ 'Ghostbusters_business_NN.md': '# Sample' })
    expect(pkg.assets).toEqual({ 'master.html': '<!doctype html>' })
  })

  it('requires ref and rejects invalid refs like templates-v0.17.0', async () => {
    await expect(fetchBlueprintPackageFromRemote('analysis', '0.2.0')).rejects.toThrow('ref is required')
    await expect(
      fetchBlueprintPackageFromRemote('analysis', '0.2.0', { ref: 'templates-v0.17.0' }),
    ).rejects.toThrow(/Invalid blueprint ref/)
  })

  it('uses iNNfo/specs/bluepriNNts/<base> with no workspace special case', async () => {
    const spy = mockFetch({ '/domainn/spec_NN.md': '# DomaiNN' }, {})
    const pkg = await fetchBlueprintPackageFromRemote('domainn', 'V_0-1-0', {
      repo: 'org/repo',
      ref: 'blueprints-v0.18.0',
    })

    expect(pkg.spec).toBe('# DomaiNN')
    expect(spy.mock.calls.map((c) => String(c[0]))).toContain(
      'https://raw.githubusercontent.com/org/repo/blueprints-v0.18.0/iNNfo/specs/bluepriNNts/domainn/spec_NN.md',
    )
  })

  it('leaves a subdirectory undefined when its contents-API listing 404s', async () => {
    mockFetch(
      { '/business/spec_NN.md': '# spec' },
      {
        'business/procedures': null,
        'business/samples': null,
        'business/assets': null,
      },
    )

    const pkg = await fetchBlueprintPackageFromRemote('business', 'V_0-2-1', {
      ref: 'blueprints-v0.18.0',
    })
    expect(pkg.spec).toBe('# spec')
    expect(pkg.procedures).toBeUndefined()
    expect(pkg.samples).toBeUndefined()
    expect(pkg.assets).toBeUndefined()
  })

  it('skips an individual asset that 404s but keeps the rest of the subdirectory', async () => {
    mockFetch(
      {
        '/business/spec_NN.md': '# spec',
        '/business/procedures/ok_NN.md': '# ok',
        '/business/procedures/broken_NN.md': null,
      },
      { 'business/procedures': [file('ok_NN.md'), file('broken_NN.md')] },
    )

    const pkg = await fetchBlueprintPackageFromRemote('business', 'V_0-2-1', {
      ref: 'blueprints-v0.18.0',
    })
    expect(pkg.procedures).toEqual({ 'ok_NN.md': '# ok' })
  })

  it('throws when the primary spec cannot be fetched', async () => {
    mockFetch({ '/business/spec_NN.md': null }, {})
    await expect(
      fetchBlueprintPackageFromRemote('business', 'V_0-2-1', { ref: 'blueprints-v0.18.0' }),
    ).rejects.toThrow()
  })
})

describe('Temp-dir cache default (validator-robustness 4.3)', () => {
  const cacheRootDir = join(rootDir, 'temp-cache-rooms')
  // Hermetic temp cache (the OS temp dir is shared across test files/runs):
  // every fetch-and-save in this block lands here, never in the real temp.
  const cacheIsolatedDir = join(cacheRootDir, 'isolated-cache')
  const origGlobal = process.env.INNFO_GLOBAL_DIR
  const origSkills = process.env.INNFO_SKILLS_DIR
  const origCache = process.env.INNFO_CACHE_DIR

  const remoteContentFor = (title: string) =>
    ['---', 'spec_version: "V_0-1-0"', 'level: 1', `title: "${title}"`, '---', 'Body'].join('\n')

  function mockRemote(content: string) {
    return vi
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve({ ok: true, text: () => Promise.resolve(content) } as Response),
      )
  }

  beforeEach(async () => {
    process.env.INNFO_GLOBAL_DIR = join(cacheRootDir, 'isolated-global')
    process.env.INNFO_SKILLS_DIR = join(cacheRootDir, 'isolated-skills')
    process.env.INNFO_CACHE_DIR = cacheIsolatedDir
    await rmWithRetry(cacheRootDir)
    await mkdir(join(cacheRootDir, 'specs'), { recursive: true })
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    await rmWithRetry(cacheRootDir)
    if (origGlobal !== undefined) process.env.INNFO_GLOBAL_DIR = origGlobal
    else delete process.env.INNFO_GLOBAL_DIR
    if (origSkills !== undefined) process.env.INNFO_SKILLS_DIR = origSkills
    else delete process.env.INNFO_SKILLS_DIR
    if (origCache !== undefined) process.env.INNFO_CACHE_DIR = origCache
    else delete process.env.INNFO_CACHE_DIR
  })

  it('defaultCacheDir points at the OS temp directory', () => {
    const saved = process.env.INNFO_CACHE_DIR
    delete process.env.INNFO_CACHE_DIR
    try {
      expect(defaultCacheDir()).toBe(join(tmpdir(), 'innfo-specs'))
    } finally {
      if (saved !== undefined) process.env.INNFO_CACHE_DIR = saved
    }
  })

  it('Tree clean: a default run caches in the cache dir and writes nothing in-tree', async () => {
    const content = remoteContentFor('Temp Cache Spec')
    const fetchSpy = mockRemote(content)

    const result = await resolveParentChainNode(
      cacheRootDir,
      'https://example.com/tempcache_V_0-1-0_NN.md',
      'tempcache_V_0-1-0',
    )

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.specs.get('tempcache_V_0-1-0')?.rawContent).toBe(content)
    // Nothing inside the workspace tree …
    expect(await readdir(join(cacheRootDir, 'specs'))).toEqual([])
    // … the fetched content lives in the cache dir instead.
    const cached = join(cacheIsolatedDir, 'tempcache_V_0-1-0_NN.md')
    expect(await readFile(cached, 'utf-8')).toBe(content)
  })

  it('Temp entry reused: resolving the same URL again refetches nothing', async () => {
    const content = remoteContentFor('Reusable Spec')
    const fetchSpy = mockRemote(content)

    const first = await resolveParentChainNode(
      cacheRootDir,
      'https://example.com/reused_V_0-1-0_NN.md',
      'reused_V_0-1-0',
    )
    const second = await resolveParentChainNode(
      cacheRootDir,
      'https://example.com/reused_V_0-1-0_NN.md',
      'reused_V_0-1-0',
    )

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(second.specs.get('reused_V_0-1-0')?.rawContent).toBe(
      first.specs.get('reused_V_0-1-0')?.rawContent,
    )
  })

  it('Concurrent isolated: two workspaces resolving the same URL keep both trees clean', async () => {
    const content = remoteContentFor('Shared Spec')
    const fetchSpy = mockRemote(content)
    const wsA = join(cacheRootDir, 'ws-a')
    const wsB = join(cacheRootDir, 'ws-b')
    await mkdir(join(wsA, 'specs'), { recursive: true })
    await mkdir(join(wsB, 'specs'), { recursive: true })

    const [resA, resB] = await Promise.all([
      resolveParentChainNode(wsA, 'https://example.com/shared_V_0-3-0_NN.md', 'shared_V_0-3-0'),
      resolveParentChainNode(wsB, 'https://example.com/shared_V_0-3-0_NN.md', 'shared_V_0-3-0'),
    ])

    expect(resA.specs.get('shared_V_0-3-0')?.rawContent).toBe(content)
    expect(resB.specs.get('shared_V_0-3-0')?.rawContent).toBe(content)
    expect(await readdir(join(wsA, 'specs'))).toEqual([])
    expect(await readdir(join(wsB, 'specs'))).toEqual([])
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('Explicit flag: inPlace restores in-tree caching and skips the temp cache', async () => {
    const content = remoteContentFor('In-Place Spec')
    const fetchSpy = mockRemote(content)

    const result = await resolveParentChainNode(
      cacheRootDir,
      'https://example.com/inplace_V_0-1-0_NN.md',
      'inplace_V_0-1-0',
      { inPlace: true },
    )

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.specs.get('inplace_V_0-1-0')?.rawContent).toBe(content)
    expect(await readFile(join(cacheRootDir, 'specs', 'inplace_V_0-1-0_NN.md'), 'utf-8')).toBe(
      content,
    )
    expect(existsSync(join(cacheIsolatedDir, 'inplace_V_0-1-0_NN.md'))).toBe(false)
  })
})
