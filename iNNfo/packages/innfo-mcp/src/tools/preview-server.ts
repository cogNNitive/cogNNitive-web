/**
 * preview-server — in-process loopback HTTP + SSE server for the live model
 * preview (OpenSpec `2026-09-30-mcp-live-model-preview`).
 *
 * The MCP serves the canonical Markdown of every model the session mutates and
 * pushes one `model-changed` event per mutation over an SSE stream, so a single
 * editor tab opened against this endpoint keeps reflecting the agent's edits.
 *
 * Lifecycle: lazily created on the first mutating tool call (see `server.ts`),
 * bound to `127.0.0.1` on an ephemeral port, and closed with the MCP process.
 * Disabled by default (`INNFO_PREVIEW=1` opts in) so headless/CI invocations
 * spawn nothing.
 */
import { createServer, type Server, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

/** Public web app the live link opens. */
export const PREVIEW_APP_URL = 'https://cognnitive.com/innfo/app/'

/** Origins allowed to read the endpoints (CORS); never `*`. */
const ALLOWED_ORIGINS = new Set([
  'https://cognnitive.com',
  'http://localhost:5173',
  'http://localhost:5174',
])

export interface ModelChangedEvent {
  model: string
  op: string
  concept?: string
  element?: string
}

export interface PreviewServer {
  /** Loopback base, e.g. `http://127.0.0.1:54321`. */
  readonly base: string
  /** Per-process access token; required by every request. */
  readonly token: string
  /** Map a model id to the file served at `GET /model/:id`. */
  registerModel(rootId: string, filePath: string): void
  /** Push one `model-changed` event to every open subscription. */
  emit(event: ModelChangedEvent): void
  close(): Promise<void>
}

/** Whether the preview server is opted in. Default off. */
export function previewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.INNFO_PREVIEW === '1'
}

/** Canonical model id (filename stem, canonical `_NN` suffix stripped) for a model file. */
export function modelIdForFile(filePath: string): string {
  return basename(filePath).replace(/_NN\.md$/i, '').replace(/\.md$/i, '')
}

/** `GET /model/:id` URL carrying the session token. */
export function modelUrl(base: string, rootId: string, token: string): string {
  return `${base}/model/${encodeURIComponent(rootId)}?token=${encodeURIComponent(token)}`
}

/** Editor deep link that opens the model in read-only live mode. */
export function appUrl(base: string, rootId: string, token: string): string {
  const purl = modelUrl(base, rootId, token)
  return `${PREVIEW_APP_URL}?view=editor&models=${encodeURIComponent(purl)}&live=${encodeURIComponent(base)}&token=${encodeURIComponent(token)}`
}

export async function createPreviewServer(): Promise<PreviewServer> {
  const token = randomBytes(24).toString('hex')
  const models = new Map<string, string>()
  const subscribers = new Set<ServerResponse>()
  let sequence = 0

  const server: Server = createServer((req, res) => {
    try {
      const origin = req.headers.origin
      if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
      }

      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.searchParams.get('token') !== token) {
        res.statusCode = 401
        res.end()
        return
      }

      if (url.pathname === '/health') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, models: [...models.keys()] }))
        return
      }

      if (url.pathname === '/events') {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders()
        subscribers.add(res)
        req.on('close', () => {
          subscribers.delete(res)
        })
        return
      }

      const match = url.pathname.match(/^\/model\/(.+)$/)
      if (match) {
        const filePath = models.get(decodeURIComponent(match[1]))
        if (!filePath) {
          res.statusCode = 404
          res.end()
          return
        }
        void readFile(filePath, 'utf-8')
          .then((text) => {
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
            res.end(text)
          })
          .catch(() => {
            res.statusCode = 404
            res.end()
          })
        return
      }

      res.statusCode = 404
      res.end()
    } catch {
      res.statusCode = 500
      res.end()
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    base: `http://127.0.0.1:${port}`,
    token,
    registerModel(rootId, filePath) {
      models.set(rootId, filePath)
    },
    emit(event) {
      sequence += 1
      const frame = `event: model-changed\nid: ${sequence}\ndata: ${JSON.stringify({
        ...event,
        at: new Date().toISOString(),
      })}\n\n`
      for (const res of subscribers) {
        try {
          res.write(frame)
        } catch {
          subscribers.delete(res)
        }
      }
    },
    async close() {
      for (const res of subscribers) {
        try {
          res.end()
        } catch {
          // best effort — the socket may already be gone
        }
      }
      subscribers.clear()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

let singleton: Promise<PreviewServer> | null = null

/** Lazily create (once) the in-process preview server, or null when disabled. */
export async function getPreviewServer(
  env: NodeJS.ProcessEnv = process.env,
): Promise<PreviewServer | null> {
  if (!previewEnabled(env)) return null
  if (!singleton) singleton = createPreviewServer()
  return singleton
}

/** Test-only: close and forget the singleton so tests do not leak listeners. */
export async function resetPreviewServerForTests(): Promise<void> {
  if (singleton) {
    const server = await singleton.catch(() => null)
    await server?.close()
  }
  singleton = null
}
