import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

const rootDir = join(import.meta.dirname!, '..', 'temp-test-server')
const specsDir = join(rootDir, 'specs')
process.env.INNFO_DOMAIN_DIR = rootDir

const { server, toolDefinitions, TOOL_COUNT, ROOT_DIR } = await import('./server')

const pkgVersion = JSON.parse(
  await readFile(join(import.meta.dirname!, '..', 'package.json'), 'utf-8'),
).version

function textOf(result: CallToolResult): string {
  const first = result.content[0]
  if (!first || first.type !== 'text') throw new Error('Expected text content')
  return first.text
}

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

/** Write a level-2 business blueprint (declaring a "Work" list concept)
 * resolving up to the stubbed level-1 chain — fully resolvable locally. */
async function stubBlueprintChain() {
  await writeFile(
    join(specsDir, 'business_V_0-2-0_NN.md'),
    [
      '---',
      'spec_version: "V_0-2-0"',
      'level: 2',
      'title: "Local Business Blueprint"',
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

/** A minimal, valid iNNfo knowledge document instantiating the "Work" concept. */
const MUTABLE_KNOWLEDGE_CONTENT = [
  '---',
  'spec_version: "V_0-3-0"',
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

describe('innfo-mcp server (dispatch/handler layer, real MCP client/server round-trip)', () => {
  let client: Client
  const origCache = process.env.INNFO_CACHE_DIR

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} })
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
  })

  afterAll(async () => {
    await client.close()
  })

  beforeEach(async () => {
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

  it('reports the package.json version in the initialize handshake', async () => {
    const info = client.getServerVersion()
    expect(info).toBeDefined()
    expect(info?.version).toBe(pkgVersion)
  })

  it('lists exactly the 17 canonical tools and no retired names', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(toolDefinitions.map((t) => t.name).sort())
    expect(tools).toHaveLength(17)

    const canonicalNames = [
      'list_knowledge',
      'read_knowledge',
      'get_spec',
      'get_blueprint',
      'validate_knowledge',
      'apply_change',
      'validate_knowledge_url',
      'validate_blueprint',
      'init_knowledge',
      'list_blueprints',
      'hydrate_blueprint',
      'sync_domain_manifest',
      'check_domain',
      'query_units',
      'resolve_sources',
      'list_blueprint_procedures',
      'list_blueprint_skills',
    ].sort()
    expect(names).toEqual(canonicalNames)

    // Verify retired names are not present
    const retired = [
      'list_models',
      'read_model',
      'init_model',
      'validate_model',
      'validate_model_url',
      'get_template',
      'validate_template',
      'list_templates',
      'hydrate_template',
      'list_template_procedures',
      'list_template_skills',
      'sync_workspace_manifest',
      'check_workspace',
      'migrate_domain',
    ]
    for (const r of retired) {
      expect(names).not.toContain(r)
    }
  })

  it('returns an isError result for a retired or unknown tool name', async () => {
    const result1 = await client.callTool({ name: 'get_template', arguments: {} })
    expect(result1.isError).toBe(true)
    expect(textOf(result1 as CallToolResult)).toBe('Unknown tool: get_template')

    const result2 = await client.callTool({ name: 'list_models', arguments: {} })
    expect(result2.isError).toBe(true)
    expect(textOf(result2 as CallToolResult)).toBe('Unknown tool: list_models')
  })

  describe('list_knowledge', () => {
    const docFrontmatter = [
      '---',
      'spec_version: "V_0-3-0"',
      'level: 3',
      'parent_spec:',
      '  name: business_V_0-2-0',
      '  url: https://example.com/business_V_0-2-0_NN.md',
      '---',
      '',
    ].join('\n')

    it('scans the configured domain and returns knowledge info enveloped under "knowledge"', async () => {
      const kDir = join(rootDir, 'kNNowledge')
      await mkdir(kDir, { recursive: true })
      await writeFile(join(kDir, 'Alpha_V_1-0-0_business_NN.md'), docFrontmatter, 'utf-8')
      await writeFile(join(kDir, 'Beta_V_1-0-0_business_NN.md'), docFrontmatter, 'utf-8')

      const result = await client.callTool({ name: 'list_knowledge', arguments: {} })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-list-knowledge@1')
      expect(parsed.knowledge.map((m: { id: string }) => m.id)).toEqual([
        'Alpha_V_1-0-0_business_NN',
        'Beta_V_1-0-0_business_NN',
      ])
    })

    it('honors an explicit domain root override', async () => {
      const otherRoot = join(rootDir, 'other-domain')
      await mkdir(otherRoot, { recursive: true })
      await writeFile(join(otherRoot, 'Only_V_1-0-0_NN.md'), docFrontmatter, 'utf-8')

      const result = await client.callTool({ name: 'list_knowledge', arguments: { domain: otherRoot } })
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-list-knowledge@1')
      expect(parsed.knowledge.map((m: { id: string }) => m.id)).toEqual(['Only_V_1-0-0_NN'])
    })
  })

  describe('read_knowledge', () => {
    it('returns an isError result when id is missing', async () => {
      const result = await client.callTool({ name: 'read_knowledge', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Missing required argument: id')
    })

    it('returns an isError result when the knowledge document does not exist', async () => {
      const result = await client.callTool({ name: 'read_knowledge', arguments: { id: 'Nope' } })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Knowledge document not found: Nope')
    })

    it('parses and returns a knowledge document by id with innfo-read-knowledge@1 envelope', async () => {
      await writeFile(join(rootDir, 'Sample_NN.md'), MUTABLE_KNOWLEDGE_CONTENT, 'utf-8')
      const result = await client.callTool({ name: 'read_knowledge', arguments: { id: 'Sample' } })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-read-knowledge@1')
      expect(parsed.frontmatter.title).toBe('Test')
    })
  })

  describe('get_spec', () => {
    it('returns an isError result when neither url nor knowledge_id is provided', async () => {
      const result = await client.callTool({ name: 'get_spec', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Provide either url or knowledge_id')
    })

    it('resolves the level-1 spec from an explicit url with innfo-get-spec@1 envelope', async () => {
      await stubSpecChain()
      const result = await client.callTool({
        name: 'get_spec',
        arguments: { url: 'https://example.com/iNNfo_V_0-3-0_NN.md' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-get-spec@1')
      expect(parsed.spec.frontmatter.title).toBe('Local iNNfo Spec')
    })
  })

  describe('get_blueprint', () => {
    it('returns an isError result when neither url nor knowledge_id is provided', async () => {
      const result = await client.callTool({ name: 'get_blueprint', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Provide either url or knowledge_id')
    })

    it('resolves a blueprint from an explicit url with innfo-get-blueprint@1 envelope', async () => {
      await stubBlueprintChain()
      const result = await client.callTool({
        name: 'get_blueprint',
        arguments: { url: 'https://example.com/business_V_0-2-0_NN.md' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-get-blueprint@1')
      expect(parsed.frontmatter.title).toBe('Local Business Blueprint')
    })
  })

  describe('validate_knowledge', () => {
    it('returns an isError result when neither id nor content is provided', async () => {
      const result = await client.callTool({ name: 'validate_knowledge', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Provide either id or content')
    })

    it('reports a clear PARENT_RESOLUTION_FAILED error when no blueprint resolves for a declared parent_spec.url', async () => {
      const result = await client.callTool({
        name: 'validate_knowledge',
        arguments: { content: MUTABLE_KNOWLEDGE_CONTENT },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-validate-knowledge@1')
      expect(parsed.valid).toBe(false)
      expect(
        parsed.errors.some((e: { message: string }) => /PARENT_RESOLUTION_FAILED/.test(e.message)),
      ).toBe(true)
    })
  })

  describe('apply_change', () => {
    it('returns an isError result when required arguments are missing', async () => {
      const result = await client.callTool({ name: 'apply_change', arguments: { id: 'X' } })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Missing required arguments: id, op, args')
    })

    it('applies a mutation, validates against the resolved blueprint, and writes back to disk', async () => {
      await stubBlueprintChain()
      await writeFile(join(rootDir, 'Mutable_NN.md'), MUTABLE_KNOWLEDGE_CONTENT, 'utf-8')

      const result = await client.callTool({
        name: 'apply_change',
        arguments: {
          id: 'Mutable',
          op: 'add_element',
          args: { conceptName: 'Work', elementName: 'Review', description: 'Code review step.' },
        },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-apply-change@1')
      expect(parsed.success).toBe(true)

      const onDisk = await readFile(join(rootDir, 'Mutable_NN.md'), 'utf-8')
      expect(onDisk).toContain('Work: Review')
    })
  })

  describe('init_knowledge', () => {
    it('returns an isError result when required arguments are missing', async () => {
      const result = await client.callTool({ name: 'init_knowledge', arguments: { id: 'test' } })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toContain('Missing required arguments')
    })

    it('initializes a knowledge document file successfully with innfo-init-knowledge@1 envelope', async () => {
      const result = await client.callTool({
        name: 'init_knowledge',
        arguments: {
          id: 'test_doc',
          blueprint_name: 'test_blueprint',
          blueprint_url: 'https://example.com/spec_NN.md',
          domain: rootDir,
        },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-init-knowledge@1')
      expect(parsed.success).toBe(true)
      expect(parsed.filePath).toContain('test_doc_NN.md')
    })
  })

  describe('list_blueprints and hydrate_blueprint', () => {
    it('list_blueprints returns enveloped array under "blueprints"', async () => {
      const result = await client.callTool({ name: 'list_blueprints', arguments: { domain: rootDir } })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-list-blueprints@1')
      expect(Array.isArray(parsed.blueprints)).toBe(true)
    })

    it('hydrate_blueprint returns error when blueprint is missing', async () => {
      const result = await client.callTool({
        name: 'hydrate_blueprint',
        arguments: { blueprint_name: 'non_existent_spec_xyz', domain: rootDir },
      })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toContain('Unresolved template')
    })
  })

  describe('legacy domain interception across MCP tools', () => {
    it('returns legacy notice with nn-upgrade pointer when called on a legacy domain', async () => {
      // Create legacy entrypoint
      await writeFile(
        join(rootDir, 'domaiNN_NN.md'),
        ['---', 'level: 2', 'workspace_version: "V_0-1-0"', '---'].join('\n'),
        'utf-8',
      )

      const result = await client.callTool({ name: 'list_knowledge', arguments: {} })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.isLegacy).toBe(true)
      expect(parsed.message).toContain('legacy layout')
      expect(parsed.hint).toContain('nn-upgrade')
    })
  })
})
