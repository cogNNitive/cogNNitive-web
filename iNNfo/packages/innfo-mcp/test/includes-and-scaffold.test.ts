import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { initKnowledge, validateTemplate } from '../src/tools/mutate.js'
import { readFileSync } from 'node:fs'

const L1 = readFileSync(
  join(import.meta.dirname!, '..', '..', '..', 'specs', 'iNNfo_V_0-1-0_NN.md'),
  'utf-8',
)

describe('MCP — includes composition + init_model scaffolding', () => {
  let root: string
  let specsDir: string
  const origCache = process.env.INNFO_CACHE_DIR

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'innfo-mcp-inc-'))
    specsDir = join(root, 'specs')
    await mkdir(specsDir, { recursive: true })
    await writeFile(join(specsDir, 'iNNfo_V_0-1-0_NN.md'), L1)
    // Hermetic temp cache: file:// template saves must never leak into the
    // shared OS temp cache seen by other suites.
    process.env.INNFO_CACHE_DIR = join(root, 'isolated-cache')
  })

  afterEach(async () => {
    if (origCache !== undefined) process.env.INNFO_CACHE_DIR = origCache
    else delete process.env.INNFO_CACHE_DIR
    await rm(root, { recursive: true, force: true })
  })

  const l1Url = () =>
    'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md'

  async function writeTemplate(name: string, body: string, extraFm = ''): Promise<string> {
    const file = join(specsDir, `${name}_NN.md`)
    await writeFile(
      file,
      `---\nspec_version: "V_0-1-0"\nlevel: 2\ntitle: "${name}"\nparent_spec:\n  name: "iNNfo_V_0-1-0"\n  url: "${l1Url()}"\n${extraFm}---\n\n${body}\n`,
    )
    return pathToFileURL(file).href
  }

  it('validate_template reports a *diverging* includes name collision as an error', async () => {
    // iNNfo_V_0-2-0: a same-named Definition with a DIFFERENT body across two
    // sources is still a collision ERROR (naming both sources).
    await writeTemplate(
      'base_roles_a',
      '# NN Concept Definition\n## NN Concept Definition: Roles\ntype:: list\n',
    )
    await writeTemplate(
      'base_roles_b',
      '# NN Concept Definition\n## NN Concept Definition: Roles\ntype:: weight\n',
    )
    await writeTemplate(
      'composite_roles',
      '# NN Concept Definition\n## NN Concept Definition: Extra\ntype:: list\n',
      'includes:\n  - name: "base_roles_a"\n    url: ""\n  - name: "base_roles_b"\n    url: ""\n',
    )

    const res = await validateTemplate(root, undefined, undefined, undefined) // needs id/content
    expect(res.valid).toBe(false) // no input → error, sanity

    const byContent = await validateTemplate(
      root,
      undefined,
      await readFile(join(specsDir, 'composite_roles_NN.md'), 'utf-8'),
      undefined,
    )
    expect(
      byContent.errors.some((e) => /Roles/.test(e.message) && /base_roles/i.test(e.message)),
    ).toBe(true)
  })

  it('validate_template silently merges an AST-identical duplicate across includes', async () => {
    // iNNfo_V_0-2-0: two sources declaring a byte-identical Definition merge
    // into one entry — no collision error.
    await writeTemplate(
      'twin_roles_a',
      '# NN Concept Definition\n## NN Concept Definition: Roles\ntype:: list\n',
    )
    await writeTemplate(
      'twin_roles_b',
      '# NN Concept Definition\n## NN Concept Definition: Roles\ntype:: list\n',
    )
    await writeTemplate(
      'composite_twin_roles',
      '# NN Concept Definition\n## NN Concept Definition: Extra\ntype:: list\n',
      'includes:\n  - name: "twin_roles_a"\n    url: ""\n  - name: "twin_roles_b"\n    url: ""\n',
    )

    const byContent = await validateTemplate(
      root,
      undefined,
      await readFile(join(specsDir, 'composite_twin_roles_NN.md'), 'utf-8'),
      undefined,
    )
    expect(byContent.errors.some((e) => /Roles/.test(e.message) && /includes/i.test(e.path))).toBe(
      false,
    )
  })

  it('init_model scaffolds a body (index, sections, markers) and validates its output', async () => {
    const tplUrl = await writeTemplate(
      'demo_tpl',
      [
        '# NN Concept Definition',
        '## NN Concept Definition: Overview',
        'type:: text',
        '## NN Concept Definition: Item',
        'type:: list',
        '',
        '# NN Field Definition',
        '## NN Field Definition: status',
        'concept:: Item',
        'type:: select',
        'options:: [todo, done]',
        '',
        '# NN Marker Definition',
        '## NN Marker Definition: priority',
        'applies_to:: [Element]',
      ].join('\n'),
    )

    const res = await initKnowledge(root, 'my_model_V_1-0-0_demo_tpl', {
      template_url: tplUrl,
      blueprint_name: 'demo_tpl',
      title: 'My Model',
    })

    expect(res.success).toBe(true)
    expect(res.templateResolved).toBe(true)
    expect(res.scaffolded).toBe(true)
    const content = await readFile(res.filePath, 'utf-8')
    // Version-aware scaffold (validator-robustness): frontmatter versions are
    // inferred from the resolved parent template (stamped V_0-1-0 above).
    expect(content).toContain('spec_version: "V_0-3-0"')
    expect(content).toMatch(/(knowledge_version|knowledge_version): "V_0-1-0"/)
    expect(content).toContain('# NN index')
    expect(content).toContain('* [[Overview]]')
    expect(content).toContain('* [[Item]]')
    expect(content).toContain('# NN Item')
    expect(content).toContain('## NN Item: Example Item')
    expect(content).toContain('status:: todo')
    expect(content).toContain('# NN matrices: item-markers matrix')
    // the freshly scaffolded model passes validation (hygiene + schema)
    expect(res.validation.valid).toBe(true)
  })
})
