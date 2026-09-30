import { describe, it, expect, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import http from 'node:http'
import type { IncomingMessage } from 'node:http'
import {
  createPreviewServer,
  getPreviewServer,
  previewEnabled,
  resetPreviewServerForTests,
  type PreviewServer,
} from './preview-server'

const rootDir = join(import.meta.dirname!, '..', '..', 'temp-test-preview-server')

async function writeModel(name: string, body: string): Promise<string> {
  await mkdir(rootDir, { recursive: true })
  const filePath = join(rootDir, `${name}.md`)
  await writeFile(filePath, body, 'utf-8')
  return filePath
}

/** Minimal promise wrapper around node:http for the loopback endpoints. */
function httpGet(url: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') }),
      )
    })
    req.on('error', reject)
  })
}

/** Opens an SSE subscription and resolves once it is connected. */
function openSse(url: string): Promise<{ req: http.ClientRequest; res: IncomingMessage; text: () => string }> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = []
    const req = http.get(url, (res) => {
      res.setEncoding('utf-8')
      res.on('data', (c: string) => chunks.push(c))
      resolve({ req, res, text: () => chunks.join('') })
    })
    req.on('error', reject)
  })
}

describe('previewEnabled / getPreviewServer', () => {
  afterEach(async () => {
    await resetPreviewServerForTests()
  })

  it('is disabled unless INNFO_PREVIEW=1', () => {
    expect(previewEnabled({} as NodeJS.ProcessEnv)).toBe(false)
    expect(previewEnabled({ INNFO_PREVIEW: '0' } as NodeJS.ProcessEnv)).toBe(false)
    expect(previewEnabled({ INNFO_PREVIEW: '1' } as NodeJS.ProcessEnv)).toBe(true)
  })

  it('creates no listener when preview is disabled', async () => {
    const server = await getPreviewServer({} as NodeJS.ProcessEnv)
    expect(server).toBeNull()
  })

  it('returns the same lazy singleton while preview is enabled', async () => {
    const a = await getPreviewServer({ INNFO_PREVIEW: '1' } as NodeJS.ProcessEnv)
    const b = await getPreviewServer({ INNFO_PREVIEW: '1' } as NodeJS.ProcessEnv)
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })
})

describe('createPreviewServer', () => {
  let server: PreviewServer | null = null

  afterEach(async () => {
    await server?.close()
    server = null
    await rm(rootDir, { recursive: true, force: true })
  })

  it('binds loopback on an ephemeral port and reports health', async () => {
    server = await createPreviewServer()
    expect(server.base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)

    const health = await httpGet(`${server.base}/health?token=${server.token}`)
    expect(health.status).toBe(200)
    expect(JSON.parse(health.body)).toEqual({ ok: true, models: [] })
  })

  it('serves a registered model as canonical Markdown and 404s an unknown id', async () => {
    server = await createPreviewServer()
    const filePath = await writeModel('crm_V_0-1-0_business', '# NN index\nbody\n')
    server.registerModel('crm_V_0-1-0_business', filePath)

    const ok = await httpGet(`${server.base}/model/crm_V_0-1-0_business?token=${server.token}`)
    expect(ok.status).toBe(200)
    expect(ok.body).toContain('# NN index')

    const missing = await httpGet(`${server.base}/model/${'nope'}?token=${server.token}`)
    expect(missing.status).toBe(404)
  })

  it('rejects a missing or wrong token with 401 on /model and /events', async () => {
    server = await createPreviewServer()
    const filePath = await writeModel('m', 'x')
    server.registerModel('m', filePath)

    expect((await httpGet(`${server.base}/model/m`)).status).toBe(401)
    expect((await httpGet(`${server.base}/model/m?token=deadbeef`)).status).toBe(401)
    expect((await httpGet(`${server.base}/events`)).status).toBe(401)
    expect((await httpGet(`${server.base}/events?token=deadbeef`)).status).toBe(401)
  })

  it('emits exactly one model-changed event per mutation', async () => {
    server = await createPreviewServer()
    const sse = await openSse(`${server.base}/events?token=${server.token}`)

    server.emit({ model: 'crm_V_0-1-0_business', op: 'apply_change', concept: 'RevenueStream', element: 'enterprise-tier' })

    await vi.waitFor(() => {
      expect(sse.text()).toContain('event: model-changed')
    })
    const text = sse.text()
    expect(text.match(/event: model-changed/g)).toHaveLength(1)
    expect(text).toContain('"model":"crm_V_0-1-0_business"')
    expect(text).toContain('"concept":"RevenueStream"')
    expect(text).toContain('"element":"enterprise-tier"')
    sse.req.destroy()
  })

  it('echoes Access-Control-Allow-Origin only for allowlisted origins', async () => {
    server = await createPreviewServer()
    const allowed = await new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
      const req = http.get(
        `${server!.base}/health?token=${server!.token}`,
        { headers: { Origin: 'https://cognnitive.com' } },
        (res) => resolve(res.headers),
      )
      req.on('error', reject)
    })
    expect(allowed['access-control-allow-origin']).toBe('https://cognnitive.com')

    const denied = await new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
      const req = http.get(
        `${server!.base}/health?token=${server!.token}`,
        { headers: { Origin: 'https://evil.example' } },
        (res) => resolve(res.headers),
      )
      req.on('error', reject)
    })
    expect(denied['access-control-allow-origin']).toBeUndefined()
  })
})
