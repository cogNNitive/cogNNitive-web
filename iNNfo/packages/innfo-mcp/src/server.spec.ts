import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

// `server.ts` reads `INNFO_MODELS_DIR` once, at module-evaluation time, to seed
// its module-level `ROOT_DIR` constant. It must be set before the module is
// first imported, so we use a dynamic import after setting the env var rather
// than a static import (which Vitest would hoist above this assignment).
const rootDir = join(import.meta.dirname!, '..', 'temp-test-server')
const specsDir = join(rootDir, 'specs')
process.env.INNFO_MODELS_DIR = rootDir

const { server, toolDefinitions, TOOL_COUNT } = await import('./server')

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

/** Write a level-2 business template (declaring a "Work" list concept)
 * resolving up to the stubbed level-1 chain — fully resolvable locally. */
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
 * `stubTemplateChain()`. `parent_spec` points at `business_V_0-2-0`: when
 * `stubTemplateChain()` has been called first, resolution succeeds locally;
 * otherwise (default fetch-reject mock, no local stub) it resolves to null. */
const MUTABLE_MODEL_CONTENT = [
  '---',
  'spec_version: "V_0-2-0"',
  'level: 3',
  'model_version: "V_0-0-1"',
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
    // Hermetic temp cache: the OS temp dir is shared across test files/runs,
    // so resolution here must never see entries fetched by other suites.
    process.env.INNFO_CACHE_DIR = join(rootDir, 'isolated-cache')
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(specsDir, { recursive: true })
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

  it('reports the package.json version in the initialize handshake', async () => {
    const info = client.getServerVersion()
    expect(info).toBeDefined()
    expect(info?.version).toBe(pkgVersion)
  })

  it('lists every registered tool (the registry is the single source)', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(toolDefinitions.map((t) => t.name).sort())
    expect(tools).toHaveLength(TOOL_COUNT)
  })

  it('lists resolve_sources among the registered tools', async () => {
    const { tools } = await client.listTools()
    expect(tools.some((t) => t.name === 'resolve_sources')).toBe(true)
  })

  it('returns an isError result for an unknown tool name', async () => {
    const result = await client.callTool({ name: 'not_a_real_tool', arguments: {} })
    expect(result.isError).toBe(true)
    expect(textOf(result as CallToolResult)).toBe('Unknown tool: not_a_real_tool')
  })

  describe('list_models', () => {
    // H6: `list_models` requires `level: 3` + a resolvable `parent_spec`,
    // not just an `_NN.md` filename match.
    const modelFrontmatter = [
      '---',
      'level: 3',
      'parent_spec:',
      '  name: business_V_0-2-0',
      '  url: https://example.com/business_V_0-2-0_NN.md',
      '---',
      '',
    ].join('\n')

    it('scans the configured root and returns model info', async () => {
      await writeFile(join(rootDir, 'Alpha_V_1-0-0_business_NN.md'), modelFrontmatter, 'utf-8')
      await writeFile(join(rootDir, 'Beta_V_1-0-0_business_NN.md'), modelFrontmatter, 'utf-8')
      await writeFile(join(rootDir, 'index.md'), '', 'utf-8')

      const result = await client.callTool({ name: 'list_models', arguments: {} })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-list-models@1')
      expect(parsed.models.map((m: { id: string }) => m.id)).toEqual([
        'Alpha_V_1-0-0_business_NN',
        'Beta_V_1-0-0_business_NN',
      ])
    })

    it('honors an explicit root override', async () => {
      const otherRoot = join(rootDir, 'other-root')
      await mkdir(otherRoot, { recursive: true })
      await writeFile(join(otherRoot, 'Only_V_1-0-0_NN.md'), modelFrontmatter, 'utf-8')

      const result = await client.callTool({ name: 'list_models', arguments: { root: otherRoot } })
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-list-models@1')
      expect(parsed.models.map((m: { id: string }) => m.id)).toEqual(['Only_V_1-0-0_NN'])
    })
  })

  describe('read_model', () => {
    it('returns an isError result when id is missing', async () => {
      const result = await client.callTool({ name: 'read_model', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Missing required argument: id')
    })

    it('returns an isError result when the model does not exist', async () => {
      const result = await client.callTool({ name: 'read_model', arguments: { id: 'Nope' } })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Model not found: Nope')
    })

    it('parses and returns a model by id', async () => {
      await writeFile(join(rootDir, 'Sample_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')
      const result = await client.callTool({ name: 'read_model', arguments: { id: 'Sample' } })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-read-model@1')
      expect(parsed.frontmatter.title).toBe('Test')
    })
  })

  describe('get_spec', () => {
    it('returns an isError result when neither url nor model_id is provided', async () => {
      const result = await client.callTool({ name: 'get_spec', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Provide either url or model_id')
    })

    it('resolves the level-1 spec from an explicit url', async () => {
      await stubSpecChain()
      const result = await client.callTool({
        name: 'get_spec',
        arguments: { url: 'https://example.com/iNNfo_V_0-1-0_NN.md' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.spec.frontmatter.title).toBe('Local iNNfo Spec')
    })

    it('returns an isError result when the spec cannot be resolved', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network unreachable'))
      const result = await client.callTool({
        name: 'get_spec',
        arguments: { url: 'https://example.com/does-not-exist_NN.md' },
      })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toContain(
        'SpecResolutionError: Failed to resolve parent',
      )
    })
  })

  describe('get_template', () => {
    it('returns an isError result when neither url nor model_id is provided', async () => {
      const result = await client.callTool({ name: 'get_template', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Provide either url or model_id')
    })

    it('resolves a template from an explicit url', async () => {
      await stubTemplateChain()
      const result = await client.callTool({
        name: 'get_template',
        arguments: { url: 'https://example.com/business_V_0-2-0_NN.md' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.frontmatter.title).toBe('Local Business Template')
    })

    it('returns an isError result with the resolution detail when the template cannot be resolved', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network unreachable'))
      const result = await client.callTool({
        name: 'get_template',
        arguments: { url: 'https://example.com/missing_NN.md' },
      })
      expect(result.isError).toBe(true)
      const text = textOf(result as CallToolResult)
      expect(text).toContain('Failed to resolve parent')
      expect(text).toContain('Attempted')
    })
  })

  describe('validate_model', () => {
    it('returns an isError result when neither id nor content is provided', async () => {
      const result = await client.callTool({ name: 'validate_model', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Provide either id or content')
    })

    it('reports a clear PARENT_RESOLUTION_FAILED error when no template resolves for a declared parent_spec.url', async () => {
      const result = await client.callTool({
        name: 'validate_model',
        arguments: { content: MUTABLE_MODEL_CONTENT },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-validate-model@1')
      expect(parsed.valid).toBe(false)
      expect(
        parsed.errors.some((e: { message: string }) => /PARENT_RESOLUTION_FAILED/.test(e.message)),
      ).toBe(true)
      expect(
        parsed.warnings.some((w: { message: string }) => /no template resolved/i.test(w.message)),
      ).toBe(false)
    })

    it('reports a not-found result (not an MCP error) for a missing model id', async () => {
      const result = await client.callTool({ name: 'validate_model', arguments: { id: 'Missing' } })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.valid).toBe(false)
      expect(parsed.errors[0].message).toBe('Model not found: Missing')
    })
  })

  describe('apply_change', () => {
    it('returns an isError result when required arguments are missing', async () => {
      const result = await client.callTool({ name: 'apply_change', arguments: { id: 'X' } })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Missing required arguments: id, op, args')
    })

    it('applies a mutation, validates against the resolved template, and writes back to disk', async () => {
      await stubTemplateChain()
      await writeFile(join(rootDir, 'Mutable_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')

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
      expect(parsed.success).toBe(true)

      const onDisk = await import('node:fs/promises').then((fs) =>
        fs.readFile(join(rootDir, 'Mutable_NN.md'), 'utf-8'),
      )
      expect(onDisk).toContain('Work: Review')
    })

    it('reports a not-found result (not an MCP error) for a missing model id', async () => {
      const result = await client.callTool({
        name: 'apply_change',
        arguments: {
          id: 'Nope',
          op: 'add_element',
          args: { conceptName: 'Work', elementName: 'Review' },
        },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.success).toBe(false)
      expect(parsed.errors[0].message).toBe('Model not found: Nope')
    })
  })

  describe('validate_model_url', () => {
    it('returns an isError result when model_url is missing', async () => {
      const result = await client.callTool({ name: 'validate_model_url', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Missing required argument: model_url')
    })

    it('fetches and validates a model from a URL', async () => {
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

      const result = await client.callTool({
        name: 'validate_model_url',
        arguments: { model_url: 'https://example.com/Mutable_NN.md' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.valid).toBe(false)
      expect(
        parsed.errors.some((e: { message: string }) => /PARENT_RESOLUTION_FAILED/.test(e.message)),
      ).toBe(true)
      expect(
        parsed.warnings.some((w: { message: string }) => /no template resolved/i.test(w.message)),
      ).toBe(false)
    })

    it('reports a not-found result (not an MCP error) when the URL fetch fails', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response)

      const result = await client.callTool({
        name: 'validate_model_url',
        arguments: { model_url: 'https://example.com/missing_NN.md' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.valid).toBe(false)
      expect(parsed.errors[0].message).toMatch(/Failed to fetch model URL/)
    })
  })

  describe('validate_template', () => {
    it('returns an isError result when neither id nor content is provided', async () => {
      const result = await client.callTool({ name: 'validate_template', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toBe('Provide either id or content')
    })

    it('reports a PARENT_RESOLUTION_FAILED diagnostic (not an MCP error) when parent_spec.url is missing', async () => {
      const content = [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 2',
        'title: "No Parent"',
        '---',
      ].join('\n')
      const result = await client.callTool({ name: 'validate_template', arguments: { content } })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.valid).toBe(false)
      expect(parsed.errors[0].message).toMatch(/PARENT_RESOLUTION_FAILED/)
    })

    it('validates a level-2 template against its resolved level-1 parent', async () => {
      await stubSpecChain()
      const content = [
        '---',
        'spec_version: "V_0-2-0"',
        'level: 2',
        'title: "Business Template"',
        'parent_spec:',
        '  name: "iNNfo_V_0-1-0"',
        '  url: "https://example.com/iNNfo_V_0-1-0_NN.md"',
        '---',
      ].join('\n')
      const result = await client.callTool({ name: 'validate_template', arguments: { content } })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.valid).toBe(true)
    })
  })

  describe('init_model', () => {
    it('returns an isError result when required arguments are missing', async () => {
      const result = await client.callTool({ name: 'init_model', arguments: { id: 'test' } })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toContain('Missing required arguments')
    })

    it('initializes a model file successfully', async () => {
      const result = await client.callTool({
        name: 'init_model',
        arguments: {
          id: 'test_model',
          template_name: 'test_template',
          template_url: 'https://example.com/spec_NN.md',
          root: rootDir,
        },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.success).toBe(true)
      expect(parsed.filePath).toContain('test_model_NN.md')
    })
  })

  describe('intent passthrough (llm-context-efficiency Phase 2)', () => {
    it('declared intent governs without changing behavior: read_model with intent matches bare call', async () => {
      await writeFile(join(rootDir, 'Sample_NN.md'), MUTABLE_MODEL_CONTENT, 'utf-8')
      const bare = await client.callTool({ name: 'read_model', arguments: { id: 'Sample' } })
      const declared = await client.callTool({
        name: 'read_model',
        arguments: { id: 'Sample', intent: 'surgical' },
      })
      expect(declared.isError).toBeFalsy()
      expect(textOf(declared as CallToolResult)).toBe(textOf(bare as CallToolResult))
    })

    it('validate_model with a verify intent still returns the validation envelope', async () => {
      const result = await client.callTool({
        name: 'validate_model',
        arguments: { content: MUTABLE_MODEL_CONTENT, intent: 'verify' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-validate-model@1')
      expect(parsed.valid).toBe(false)
    })
  })

  describe('list_templates and hydrate_template', () => {
    it('list_templates returns enveloped array of available templates', async () => {
      const result = await client.callTool({ name: 'list_templates', arguments: { root: rootDir } })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result as CallToolResult))
      expect(parsed.version).toBe('innfo-list-templates@1')
      expect(Array.isArray(parsed.templates)).toBe(true)
    })

    it('hydrate_template returns error when template is missing', async () => {
      const result = await client.callTool({
        name: 'hydrate_template',
        arguments: { template_name: 'non_existent_spec_xyz', root: rootDir },
      })
      expect(result.isError).toBe(true)
      expect(textOf(result as CallToolResult)).toContain('Unresolved template')
    })
  })
})
