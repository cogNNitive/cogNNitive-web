import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { resetPreviewServerForTests } from './tools/preview-server.js'

const rootDir = join(import.meta.dirname!, '..', 'temp-test-server-preview')
const specsDir = join(rootDir, 'specs')
process.env.INNFO_DOMAIN_DIR = rootDir
process.env.INNFO_PREVIEW = '1'

const { server } = await import('./server')

function textOf(result: CallToolResult): string {
  const first = result.content[0]
  if (!first || first.type !== 'text') throw new Error('Expected text content')
  return first.text
}

async function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }),
      )
    })
    req.on('error', reject)
  })
}

const KNOWLEDGE = [
  '---',
  'spec_version: "V_0-3-0"',
  'level: 3',
  'knowledge_version: "V_0-0-1"',
  'title: "Preview"',
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

async function stubBlueprintChain(): Promise<void> {
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

describe('innfo-mcp preview wiring (INNFO_PREVIEW=1)', () => {
  let client: Client

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'preview-test-client', version: '1.0.0' }, { capabilities: {} })
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
  })

  afterAll(async () => {
    await client.close()
    await resetPreviewServerForTests()
    delete process.env.INNFO_PREVIEW
  })

  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(specsDir, { recursive: true })
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network disabled in tests'))
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('advertises preview_url/preview_app_url and serves the mutated model', async () => {
    await stubBlueprintChain()
    await writeFile(join(rootDir, 'Preview_NN.md'), KNOWLEDGE, 'utf-8')

    const result = await client.callTool({
      name: 'apply_change',
      arguments: {
        id: 'Preview',
        op: 'add_element',
        args: { conceptName: 'Work', elementName: 'Review', description: 'Code review step.' },
      },
    })
    expect(result.isError).toBeFalsy()
    const parsed = JSON.parse(textOf(result as CallToolResult))
    expect(parsed.success).toBe(true)
    expect(parsed.preview_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/model\/Preview\?token=[0-9a-f]{48}$/)
    expect(parsed.preview_app_url).toContain('https://cognnitive.com/innfo/app/?view=editor')
    expect(parsed.preview_app_url).toContain('models=')
    expect(parsed.preview_app_url).toContain('live=')
    expect(parsed.preview_app_url).toContain('token=')

    const served = await httpGet(parsed.preview_url)
    expect(served.status).toBe(200)
    expect(served.body).toContain('Work: Review')
  })
})
