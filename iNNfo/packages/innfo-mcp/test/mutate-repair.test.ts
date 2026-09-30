import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { initKnowledge } from '../src/tools/mutate'

describe('MCP model repair tools', () => {
  let tempDir: string
  const origCache = process.env.INNFO_CACHE_DIR

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'innfo-mcp-test-'))
    // Hermetic temp cache: this suite performs real network fetches, which
    // must never leak into the shared OS temp cache seen by other suites.
    process.env.INNFO_CACHE_DIR = join(tempDir, 'isolated-cache')
  })

  afterEach(async () => {
    if (origCache !== undefined) process.env.INNFO_CACHE_DIR = origCache
    else delete process.env.INNFO_CACHE_DIR
    await rm(tempDir, { recursive: true, force: true })
  })

  it('initKnowledge creates a file with valid YAML frontmatter', async () => {
    const res = await initKnowledge(tempDir, 'arenzano_residential_V_0-5-1_residential', {
      blueprint_name: 'residential_V_0-2-0',
      template_url:
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/latest/level2/residential/residential_NN.md',
      title: 'Arenzano Residential',
      knowledge_version: 'V_0-5-1',
    })

    expect(res.success).toBe(true)
    const content = await readFile(res.filePath, 'utf-8')
    expect(content).toContain('spec_version: "V_0-3-0"')
    expect(content).toMatch(/(knowledge_version|knowledge_version): "V_0-5-1"/)
    expect(content).toContain('title: "Arenzano Residential"')
    expect(content).toContain('> [!NOTE]')
  })

  it('initKnowledge preserves existing body content when frontmatter is missing', async () => {
    const filePath = join(tempDir, 'broken_model_NN.md')
    await writeFile(filePath, '# NN Team\n## NN Team: Alice\n')

    const res = await initKnowledge(tempDir, 'broken_model', {
      blueprint_name: 'business_V_0-2-0',
      template_url:
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/latest/level2/business/business_NN.md',
    })

    expect(res.success).toBe(true)
    const content = await readFile(res.filePath, 'utf-8')
    // The point of this case: a pre-existing body is preserved verbatim when
    // the scaffold rewrites the missing frontmatter.
    expect(content).toContain('# NN Team')
    expect(content).toContain('## NN Team: Alice')
    // Version-aware frontmatter is always emitted, whether the parent template
    // resolved (inherited spec_version) or not (scaffold fallback). Asserting a
    // fixed version here couples the test to volatile external template hosting
    // (the legacy `latest/level2/**` URL no longer resolves); assert the shape.
    expect(content).toMatch(/^spec_version: "V_\d+-\d+-\d+"$/m)
    expect(content).toMatch(/^(knowledge_version|knowledge_version): "V_\d+-\d+-\d+"$/m)
  })
})
