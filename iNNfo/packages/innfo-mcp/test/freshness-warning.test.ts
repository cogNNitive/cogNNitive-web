import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { validateModel } from '../src/tools/validate.js'

const TEMPLATE_URL = 'https://example.com/business_V_0-2-0_NN.md'

const TEMPLATE_CONTENT = [
  '---',
  'spec_version: "V_0-2-0"',
  'level: 2',
  'title: "Business Template"',
  '---',
  '',
  '# NN Concept Definition',
  '## NN Concept Definition: Startup',
  'type:: text',
  '',
].join('\n')

const MODEL_CONTENT = [
  '---',
  'spec_version: "V_0-2-0"',
  'level: 3',
  'knowledge_version: "V_0-0-1"',
  'title: "Startup Co"',
  'parent_spec:',
  '  name: business_V_0-2-0',
  '  url: https://example.com/business_V_0-2-0_NN.md',
  '---',
  '',
  '# NN index',
  '* [[Startup]]',
  '',
  '# NN Startup',
  '## NN Startup: Acme',
  '',
].join('\n')

describe('validateModel TEMPLATE_CACHE_STALE warning (D3)', () => {
  let rootDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'innfo-mcp-freshness-'))
    await mkdir(join(rootDir, 'specs'), { recursive: true })
    await writeFile(join(rootDir, 'specs', 'business_V_0-2-0_NN.md'), TEMPLATE_CONTENT, 'utf-8')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(rootDir, { recursive: true, force: true })
  })

  it('emits a TEMPLATE_CACHE_STALE warning when the local cache differs from the canonical remote, without downgrading valid', async () => {
    const remoteContent = TEMPLATE_CONTENT.replace('Business Template', 'Remote Business Template')
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(remoteContent) } as Response),
    )

    // No options passed — checkFreshness must default to ON at validateModel level.
    const result = await validateModel(rootDir, undefined, MODEL_CONTENT)

    expect(result.valid).toBe(true)
    const warning = result.warnings.find((w) => w.message.includes('[TEMPLATE_CACHE_STALE]'))
    expect(warning).toBeDefined()
    expect(warning!.severity).toBe('warning')
    expect(warning!.path).toBe('parent_spec')
    expect(warning!.promptHint).toContain('check_workspace')
    expect(warning!.promptHint).toContain(TEMPLATE_URL)
    expect(warning!.meta).toEqual({
      canonicalUrl: TEMPLATE_URL,
      templateName: 'business_V_0-2-0',
    })
    expect(warning!.message).toContain('business_V_0-2-0')
    expect(warning!.message).toContain(TEMPLATE_URL)
    expect(warning!.message).toContain('check_workspace')
    expect(warning!.message).not.toMatch(/Delete\/replace/)
    // D8 decoration: parent-scoped diagnostics are attributed to the template file.
    expect(warning!.filePath).toBe('business_V_0-2-0_NN.md')
  })

  it('emits no stale warning when the local cache matches the canonical remote', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(TEMPLATE_CONTENT) } as Response),
    )

    const result = await validateModel(rootDir, undefined, MODEL_CONTENT)

    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.message.includes('[TEMPLATE_CACHE_STALE]'))).toBe(false)
  })

  it('emits no stale warning when the freshness fetch fails (offline → unknown)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network disabled'))

    const result = await validateModel(rootDir, undefined, MODEL_CONTENT)

    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.message.includes('[TEMPLATE_CACHE_STALE]'))).toBe(false)
  })

  it('performs no freshness fetch when checkFreshness is explicitly disabled', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')

    const result = await validateModel(rootDir, undefined, MODEL_CONTENT, undefined, undefined, {
      checkFreshness: false,
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.valid).toBe(true)
  })
})
