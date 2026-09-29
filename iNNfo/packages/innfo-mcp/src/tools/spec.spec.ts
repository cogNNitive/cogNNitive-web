import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import {
  getSpec,
  getTemplateFromUrl,
  getTemplateFromModel,
  listTemplates,
  hydrateTemplate,
  listTemplateProcedures,
  listTemplateSkills,
  findModelFile,
} from './spec'
import { validateModel, validateTemplate } from './mutate'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-spec')
const specsDir = join(rootDir, 'specs')

/** Write the level-1 + level-0 spec chain locally so resolution never hits the network. */
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

/** Write a level-2 template resolving up to the stubbed level-1 chain. */
async function stubTemplateChain() {
  await writeFile(
    join(specsDir, 'business_V_0-2-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Local Business Template"',
      'parent_spec:',
      '  name: "iNNfo_V_0-1-0"',
      '  url: "https://example.com/iNNfo_V_0-1-0_NN.md"',
      '---',
    ].join('\n'),
    'utf-8',
  )
  await stubSpecChain()
}

describe('Spec Tools Integration (URL- and model-derived, no hardcoding)', () => {
  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(specsDir, { recursive: true })
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('getSpec resolves from an explicit url (level-1), no fetch when local', async () => {
    await stubSpecChain()
    const fetchSpy = vi.spyOn(global, 'fetch')

    const { spec } = await getSpec(rootDir, {
      url: 'https://example.com/iNNfo_V_0-1-0_NN.md',
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(spec).not.toBeNull()
    expect(spec?.level).toBe(1)
    expect(spec?.frontmatter.title).toBe('Local iNNfo Spec')
  })

  it('getSpec derives the url from a loaded model_id via parent_spec.url', async () => {
    await stubTemplateChain()
    await writeFile(
      join(rootDir, 'MyModel_V_1-0-0_business_NN.md'),
      [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 3',
        'model_version: "V_1-0-0"',
        'parent_spec:',
        '  name: "business_V_0-2-0"',
        '  url: "https://example.com/business_V_0-2-0_NN.md"',
        '---',
      ].join('\n'),
      'utf-8',
    )
    const fetchSpy = vi.spyOn(global, 'fetch')

    const { spec } = await getSpec(rootDir, { modelId: 'MyModel_V_1-0-0_business' })

    expect(fetchSpy).not.toHaveBeenCalled()
    // get_spec always returns the level-1 iNNfo spec from the resolved chain
    expect(spec?.level).toBe(1)
    expect(spec?.frontmatter.title).toBe('Local iNNfo Spec')
  })

  it('getSpec with neither url nor model_id returns null without fetching', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')

    const { spec, specCache } = await getSpec(rootDir, {})

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(spec).toBeNull()
    expect(specCache).toBeNull()
  })

  it('getTemplateFromUrl resolves a template from an explicit url', async () => {
    await stubTemplateChain()
    const fetchSpy = vi.spyOn(global, 'fetch')

    const template = await getTemplateFromUrl(
      rootDir,
      'https://example.com/business_V_0-2-0_NN.md',
      'business_V_0-2-0',
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(template).not.toBeNull()
    expect(template?.frontmatter.title).toBe('Local Business Template')
  })

  it('getTemplateFromModel derives the template from a model parent_spec.url', async () => {
    await stubTemplateChain()
    await writeFile(
      join(rootDir, 'MyModel_V_1-0-0_business_NN.md'),
      [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 3',
        'parent_spec:',
        '  name: "business_V_0-2-0"',
        '  url: "https://example.com/business_V_0-2-0_NN.md"',
        '---',
      ].join('\n'),
      'utf-8',
    )
    const fetchSpy = vi.spyOn(global, 'fetch')

    const template = await getTemplateFromModel(rootDir, 'MyModel_V_1-0-0_business')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(template?.frontmatter.title).toBe('Local Business Template')
  })

  it('getTemplateFromModel returns null when the model has no parent_spec.url', async () => {
    await writeFile(
      join(rootDir, 'Orphan_NN.md'),
      ['---', 'spec_version: "V_0-2-0"', 'level: 3', 'title: "Orphan"', '---'].join('\n'),
      'utf-8',
    )
    const template = await getTemplateFromModel(rootDir, 'Orphan')
    expect(template).toBeNull()
  })

  it('validateModel without a resolvable parent_spec.url validates structurally with a warning', async () => {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 3',
      'title: "No Parent Model"',
      '---',
      '',
      '> [!NOTE]',
      '> iNNfo document.',
      '',
      '# _NN index',
    ].join('\n')

    const result = await validateModel(rootDir, undefined, content)

    expect(result.warnings.some((w) => /no template resolved/i.test(w.message))).toBe(true)
  })

  it('listTemplates discovers templates across workspace, global, and skill stores', async () => {
    const globalDir = join(rootDir, 'global_templates')
    const skillsDir = join(rootDir, 'skills')
    await mkdir(join(rootDir, 'specs', 'bluepriNNts'), { recursive: true })
    await mkdir(globalDir, { recursive: true })
    await mkdir(join(skillsDir, 'nn-innfo', 'bluepriNNts'), { recursive: true })

    await writeFile(join(rootDir, 'specs', 'bluepriNNts', 'ws_tmpl.md'), '---\nversion: V_1-0-0\n---')
    await writeFile(join(globalDir, 'global_tmpl.md'), '---\nversion: V_1-0-0\n---')
    await writeFile(
      join(skillsDir, 'nn-innfo', 'bluepriNNts', 'skill_tmpl.md'),
      '---\nversion: V_1-0-0\n---',
    )

    const discovered = await listTemplates(rootDir, { globalDir, skillsDir })

    expect(discovered.some((t) => t.name === 'ws_tmpl' && t.source === 'workspace')).toBe(true)
    expect(discovered.some((t) => t.name === 'global_tmpl' && t.source === 'global')).toBe(true)
    expect(discovered.some((t) => t.name === 'skill_tmpl' && t.source === 'skill:nn-innfo')).toBe(
      true,
    )
  })

  it('hydrateTemplate copies template from global or skill store into workspace ./specs/bluepriNNts/', async () => {
    const globalDir = join(rootDir, 'global_templates')
    const skillsDir = join(rootDir, 'skills')
    await mkdir(globalDir, { recursive: true })

    await writeFile(
      join(globalDir, 'workspace_V_0-3-0_spec_NN.md'),
      '# NN concept: Workspace\n* type:: text',
    )

    const res = await hydrateTemplate(rootDir, 'workspace_V_0-3-0_spec_NN', { globalDir, skillsDir })

    expect(res.success).toBe(true)
    expect(res.templateName).toBe('workspace_V_0-3-0_spec_NN')
    expect(res.source).toBe('global')

    const targetFile = join(rootDir, 'specs', 'bluepriNNts', 'workspace_V_0-3-0_spec_NN.md')
    const { stat: statFs } = await import('node:fs/promises')
    const st = await statFs(targetFile)
    expect(st.isFile()).toBe(true)
  })

  it('listTemplateProcedures and listTemplateSkills dynamically discover transitive procedures and skills across includes trees', async () => {
    const templatesDir = join(rootDir, 'specs', 'bluepriNNts')
    await mkdir(templatesDir, { recursive: true })

    await writeFile(
      join(templatesDir, 'base_spec_NN.md'),
      [
        '---',
        'level: 2',
        'title: "Base Template"',
        'procedures:',
        '  - id: "proc-base"',
        '    name: "Base Procedure"',
        '    path: "procedures/base.md"',
        'skills:',
        '  - name: "nn-base"',
        '    repo: "cogNNitive/actioNN"',
        '    path: "skills/nn-base"',
        'includes:',
        '  - name: "included_spec_NN"',
        '---',
      ].join('\n'),
      'utf-8',
    )

    await writeFile(
      join(templatesDir, 'included_spec_NN.md'),
      [
        '---',
        'level: 2',
        'title: "Included Template"',
        'procedures:',
        '  - id: "proc-included"',
        '    name: "Included Procedure"',
        '    path: "procedures/included.md"',
        '  - id: "proc-base"',
        '    name: "Duplicate Base Procedure"',
        '    path: "procedures/dup.md"',
        'skills:',
        '  - name: "nn-included"',
        '    repo: "cogNNitive/actioNN"',
        '    path: "skills/nn-included"',
        '  - name: "nn-base"',
        '    repo: "cogNNitive/actioNN"',
        '    path: "skills/dup"',
        '---',
      ].join('\n'),
      'utf-8',
    )

    const procsRes = await listTemplateProcedures(rootDir, { template_name: 'base_spec_NN' })
    expect(procsRes.procedures).toHaveLength(2)
    expect(procsRes.procedures.map((p) => p.id)).toEqual(['proc-base', 'proc-included'])
    expect(procsRes.procedures[0].source_template).toBe('base_spec_NN')

    const skillsRes = await listTemplateSkills(rootDir, { template_name: 'base_spec_NN' })
    expect(skillsRes.skills).toHaveLength(2)
    expect(skillsRes.skills.map((s) => s.name)).toEqual(['nn-base', 'nn-included'])
    expect(skillsRes.skills[0].source_template).toBe('base_spec_NN')
  })

  it('S-01: discoverTransitiveAssets parses version strings from inc.url to resolve package templates', async () => {
    const pkgDir = join(specsDir, 'bluepriNNts', 'sec_pkg', 'V_2-0-0')
    await mkdir(pkgDir, { recursive: true })

    await writeFile(
      join(pkgDir, 'spec_NN.md'),
      [
        '---',
        'level: 2',
        'spec_version: "V_2-0-0"',
        'title: "Security Package"',
        'procedures:',
        '  - id: "proc-sec-v2"',
        '    name: "Security Audit V2"',
        '    path: "procedures/audit_v2.md"',
        '---',
      ].join('\n'),
      'utf-8',
    )

    const templatesDir = join(rootDir, 'specs', 'bluepriNNts')
    await mkdir(templatesDir, { recursive: true })

    await writeFile(
      join(templatesDir, 'main_tmpl_NN.md'),
      [
        '---',
        'level: 2',
        'title: "Main Template"',
        'includes:',
        '  - name: "sec_pkg"',
        '    url: "https://example.com/specs/bluepriNNts/sec_pkg/V_2-0-0/spec_NN.md"',
        '---',
      ].join('\n'),
      'utf-8',
    )

    const procsRes = await listTemplateProcedures(rootDir, { template_name: 'main_tmpl_NN' })
    expect(procsRes.procedures.some((p) => p.id === 'proc-sec-v2')).toBe(true)
  })

  it('discoverTransitiveAssets discovers procedures from on-disk procedures/ folder even without explicit frontmatter procedures array', async () => {
    const pkgDir = join(rootDir, 'specs', 'bluepriNNts', 'video_pkg', 'V_1-0-0')
    const procsDir = join(pkgDir, 'procedures')
    await mkdir(procsDir, { recursive: true })

    await writeFile(
      join(pkgDir, 'spec_NN.md'),
      [
        '---',
        'level: 2',
        'spec_version: "V_1-0-0"',
        'title: "Video Package Without Frontmatter Procedures"',
        '---',
      ].join('\n'),
      'utf-8',
    )

    await writeFile(
      join(procsDir, 'generate_script_NN.md'),
      [
        '---',
        'title: "Generate Script SOP"',
        '---',
        '# NN Procedure',
      ].join('\n'),
      'utf-8',
    )

    const procsRes = await listTemplateProcedures(rootDir, { template_name: 'video_pkg' })
    expect(procsRes.procedures.length).toBeGreaterThanOrEqual(1)
    const scriptProc = procsRes.procedures.find((p) => p.id === 'generate-script')
    expect(scriptProc).toBeDefined()
    expect(scriptProc?.name).toBe('Generate Script SOP')
    expect(scriptProc?.path).toBe('procedures/generate_script_NN.md')
  })

  it('M1: findModelFile skips specs/ by default but descends with includeSpecs', async () => {
    await writeFile(
      join(specsDir, 'business_V_0-2-0_NN.md'),
      [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 2',
        'title: "Stored Business Template"',
        'parent_spec:',
        '  name: "iNNfo_V_0-1-0"',
        '  url: "https://example.com/iNNfo_V_0-1-0_NN.md"',
        '---',
      ].join('\n'),
      'utf-8',
    )

    const defaultMatch = await findModelFile(rootDir, 'business_V_0-2-0')
    expect(defaultMatch).toBeNull()

    const withSpecs = await findModelFile(rootDir, 'business_V_0-2-0', {
      includeSpecs: true,
    })
    expect(withSpecs).toBe(join(specsDir, 'business_V_0-2-0_NN.md'))
  })

  it('M1: validateTemplate by id resolves a template stored under specs/', async () => {
    await writeFile(
      join(specsDir, 'business_V_0-2-0_NN.md'),
      [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 2',
        'title: "Stored Business Template"',
        'parent_spec:',
        '  name: "iNNfo_V_0-1-0"',
        '  url: "https://example.com/iNNfo_V_0-1-0_NN.md"',
        '---',
      ].join('\n'),
      'utf-8',
    )
    await stubSpecChain()

    const result = await validateTemplate(rootDir, 'business_V_0-2-0')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // Moved from the former test/coverage-expansion.spec.ts, a grab-bag named
  // after a coverage metric rather than a behaviour.
  it('spec.ts: discoverTransitiveAssets traverses parent_spec and includes', async () => {
    // Create template with procedures and parent_spec
    const basePkgDir = join(specsDir, 'bluepriNNts', 'base', '0.1.0')
    await mkdir(join(basePkgDir, 'procedures'), { recursive: true })
    await writeFile(
      join(basePkgDir, 'spec_NN.md'),
      [
        '---',
        'spec_version: "V_0-1-0"',
        'level: 2',
        'title: "Base"',
        'procedures:',
        '  - id: "p1"',
        '    name: "Proc 1"',
        '    path: "procedures/p1_V_0-1-0_NN.md"',
        '---',
      ].join('\n'),
      'utf-8',
    )
    await writeFile(
      join(basePkgDir, 'procedures', 'p1_V_0-1-0_NN.md'),
      '---\nspec_version: "V_0-1-0"\nlevel: 2\ntitle: "Proc 1"\n---\n',
      'utf-8',
    )

    const childPkgDir = join(specsDir, 'bluepriNNts', 'child', '0.1.0')
    await mkdir(childPkgDir, { recursive: true })
    await writeFile(
      join(childPkgDir, 'spec_NN.md'),
      [
        '---',
        'spec_version: "V_0-1-0"',
        'level: 2',
        'title: "Child"',
        'parent_spec:',
        '  name: "base"',
        '  url: "specs/bluepriNNts/base/0.1.0/spec_NN.md"',
        '---',
      ].join('\n'),
      'utf-8',
    )

    const procs = await listTemplateProcedures(rootDir, { template_name: 'child' })
    expect(procs.procedures.length).toBeGreaterThan(0)
    expect(procs.procedures.some((p) => p.name.includes('Proc 1'))).toBe(true)

    const skills = await listTemplateSkills(rootDir, { template_name: 'child' })
    expect(Array.isArray(skills.skills)).toBe(true)
  })
})
