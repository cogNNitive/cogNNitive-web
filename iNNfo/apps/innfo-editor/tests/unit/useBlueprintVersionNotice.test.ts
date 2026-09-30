import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import {
  parseTemplateName,
  parseVersionedFilename,
  compareVersions,
  pickLatestVersion,
  scanWorkspaceForTemplateVersions,
  buildMigrationPrompt,
  useBlueprintVersionNotice,
} from '../../src/composables/useBlueprintVersionNotice'
import { buildFakeTree } from '../helpers/fakeFs'
import { SHIPPED_BLUEPRINT_VERSIONS } from '../../src/config/samples'

describe('parseTemplateName', () => {
  it('splits a versioned parent_spec.name into slug + version', () => {
    expect(parseTemplateName('business_V_0-1-0')).toEqual({ slug: 'business', version: 'V_0-1-0' })
  })

  it('returns null for a name with no version suffix, and for an empty string', () => {
    expect(parseTemplateName('business')).toBeNull()
    expect(parseTemplateName('')).toBeNull()
  })
})

describe('parseVersionedFilename', () => {
  it('parses a versioned template filename', () => {
    expect(parseVersionedFilename('business_V_0-1-2_NN.md')).toEqual({
      slug: 'business',
      version: 'V_0-1-2',
    })
  })

  it('returns null for a filename missing the _NN.md suffix, and for an unversioned filename', () => {
    expect(parseVersionedFilename('business_V_0-1-2.md')).toBeNull()
    expect(parseVersionedFilename('business_NN.md')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('returns a positive number when a > b (minor)', () => {
    expect(compareVersions('V_0-2-0', 'V_0-1-0')).toBeGreaterThan(0)
  })

  it('returns a negative number when a < b (patch)', () => {
    expect(compareVersions('V_0-1-0', 'V_0-1-2')).toBeLessThan(0)
  })

  it('returns 0 for equal versions', () => {
    expect(compareVersions('V_1-2-3', 'V_1-2-3')).toBe(0)
  })
})

describe('pickLatestVersion', () => {
  it('returns the highest version among several candidates', () => {
    expect(pickLatestVersion(['V_0-1-0', 'V_0-1-2', 'V_0-1-1'])).toBe('V_0-1-2')
  })

  it('returns null for an empty list', () => {
    expect(pickLatestVersion([])).toBeNull()
  })
})

describe('scanWorkspaceForTemplateVersions', () => {
  it('finds versioned template files under specs/bluepriNNts/{slug}/, recursively', async () => {
    const handle = buildFakeTree('workspace', {
      specs: {
        templates: {
          business: {
            'business_V_0-1-2_NN.md': '---\nlevel: 2\n---\n',
          },
        },
      },
    })
    const versions = await scanWorkspaceForTemplateVersions(handle, 'business')
    expect(versions).toEqual(['V_0-1-2'])
  })

  it('unions hits across specs/, .specs/, and .spec-cache/', async () => {
    const handle = buildFakeTree('workspace', {
      specs: { 'business_V_0-1-0_NN.md': '---\nlevel: 2\n---\n' },
      '.specs': { 'business_V_0-1-1_NN.md': '---\nlevel: 2\n---\n' },
      '.spec-cache': { 'business_V_0-1-3_NN.md': '---\nlevel: 2\n---\n' },
    })
    const versions = await scanWorkspaceForTemplateVersions(handle, 'business')
    expect(versions.sort()).toEqual(['V_0-1-0', 'V_0-1-1', 'V_0-1-3'])
  })

  it('ignores files for a different template slug', async () => {
    const handle = buildFakeTree('workspace', {
      specs: {
        'business_V_0-1-2_NN.md': '---\nlevel: 2\n---\n',
        'procedures_V_0-5-0_NN.md': '---\nlevel: 2\n---\n',
      },
    })
    const versions = await scanWorkspaceForTemplateVersions(handle, 'business')
    expect(versions).toEqual(['V_0-1-2'])
  })

  it('returns an empty array when none of the search dirs exist', async () => {
    const handle = buildFakeTree('workspace', { 'index.md': '# empty workspace' })
    const versions = await scanWorkspaceForTemplateVersions(handle, 'business')
    expect(versions).toEqual([])
  })
})

describe('buildMigrationPrompt', () => {
  it('starts with the innfo: prefix and names the model + both versions', () => {
    const prompt = buildMigrationPrompt({
      modelFileName: 'Ghostbusters_V_0-1-2_business_NN.md',
      templateSlug: 'business',
      currentVersion: 'V_0-1-0',
      latestVersion: 'V_0-1-2',
    })
    expect(prompt).toMatch(/^innfo: /)
    expect(prompt).toContain('Ghostbusters_V_0-1-2_business_NN.md')
    expect(prompt).toContain('V_0-1-0')
    expect(prompt).toContain('V_0-1-2')
  })

  it('instructs a new-file migration and forbids editing/deleting the original', () => {
    const prompt = buildMigrationPrompt({
      modelFileName: 'MyModel_NN.md',
      templateSlug: 'procedures',
      currentVersion: 'V_0-1-0',
      latestVersion: 'V_0-2-0',
    })
    expect(prompt).toContain('NEW model file')
    expect(prompt).toMatch(/do NOT edit or delete "MyModel_NN\.md"/)
    expect(prompt).toContain('validate_model')
  })
})

describe('useBlueprintVersionNotice', () => {
  it('sets notice when the workspace scan finds a newer template version', async () => {
    // Use `analysis`: it ships V_0-2-1 in SHIPPED_BLUEPRINT_VERSIONS, so this
    // case isolates the workspace-scan path.
    const handle = buildFakeTree('workspace', {
      specs: { 'analysis_V_0-3-0_NN.md': '---\nlevel: 2\n---\n' },
    })
    const { notice, refresh } = useBlueprintVersionNotice({
      templateName: ref('analysis_V_0-2-1'),
      modelFileName: ref('StartupValidation_V_0-2-2_analysis_NN.md'),
      handle: ref(handle),
    })

    expect(notice.value).toBeNull()
    await refresh()

    expect(notice.value).not.toBeNull()
    expect(notice.value?.current).toBe('V_0-2-1')
    expect(notice.value?.latest).toBe('V_0-3-0')
    expect(notice.value?.prompt).toMatch(/^innfo: /)
  })

  it('leaves notice null when the model already pins the newest known version', async () => {
    // `analysis` ships V_0-3-0 in the bundled map, matching the pin here.
    const handle = buildFakeTree('workspace', {
      specs: { 'analysis_V_0-3-0_NN.md': '---\nlevel: 2\n---\n' },
    })
    const { notice, refresh } = useBlueprintVersionNotice({
      templateName: ref('analysis_V_0-3-0'),
      modelFileName: ref('StartupValidation_NN.md'),
      handle: ref(handle),
    })

    await refresh()
    expect(notice.value).toBeNull()
  })

  it('leaves notice null when the template name carries no version (self-contained model)', async () => {
    const { notice, refresh } = useBlueprintVersionNotice({
      templateName: ref(''),
      modelFileName: ref('Standalone_NN.md'),
    })

    await refresh()
    expect(notice.value).toBeNull()
  })

  it('fires from the bundled SHIPPED_BLUEPRINT_VERSIONS map alone (no workspace handle) for a stale procedures pin', async () => {
    const { notice, refresh } = useBlueprintVersionNotice({
      templateName: ref('procedures_V_0-1-0'),
      modelFileName: ref('CodeReviewProcess_V_0-1-0_procedures_NN.md'),
    })

    await refresh()
    expect(notice.value).not.toBeNull()
    expect(notice.value?.current).toBe('V_0-1-0')
    expect(notice.value?.latest).toBe(SHIPPED_BLUEPRINT_VERSIONS.procedures)
  })
})
