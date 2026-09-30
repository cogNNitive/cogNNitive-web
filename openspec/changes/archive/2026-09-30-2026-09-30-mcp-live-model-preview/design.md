# Technical Design: MCP-Served Live Model Preview

## 1. Technical Approach & Architecture Decisions

| Area | Decision | Rationale |
| :--- | :--- | :--- |
| **Server host** | In-process inside `innfo-mcp`, using `node:http`, bound to `127.0.0.1` | Decision 1: no new process, no orphan/cleanup lifecycle. |
| **Server lifecycle** | Lazy init on the first mutating tool call; `server.close()` on process exit | Avoids spawning a listener for read-only or CI invocations. |
| **Update transport** | SSE over the native `EventSource` | Decision 2: one-way, no library, auto-reconnect. |
| **Write model** | Read-only mirror; the human never edits in the preview tab | Decision 3: removes the human↔agent conflict by construction. |
| **Endpoint scope** | Only the model(s) the session touched | Decision 4: reuses the existing `?model=` / `?models=` loaders. |
| **Discovery** | `preview_url` in the mutating tool envelope | Decision 5: ephemeral port, no port file, no fixed port. |
| **Access control** | Per-session token in the query + origin-restricted CORS | Decision 6. |
| **`innfo://`** | Untouched | Decision 7: separate, deferred backlog item. |

## 2. Data Flow

```
 Agent tool call (apply_change / sync_workspace_manifest / ...)
        │
        ▼
 innfo-mcp ── mutates the model on disk
        │
        ├──(a) returns envelope {..., preview_url, preview_app_url}
        │            │
        │            ▼  agent prints the app URL; user opens the tab ONCE
        │
        └──(b) emits an in-process event ──► SSE /events?token=…
                                                     │
                                                     ▼
                                   innfo-editor (read-only live mode)
                                   EventSource → on model-changed:
                                   re-fetch /model/:id?token=… → setGraph
                                   preserve view + selected node
```

The tab is opened once; every later mutation pushes an event through the same
subscription, so no navigation is needed.

## 3. Interfaces & Contracts

### 3.1 Enablement
- Environment flag `INNFO_PREVIEW=1`. Default: off. When off, no listener is created
  and no mutating tool adds preview fields.

### 3.2 HTTP surface (loopback only, token required)

| Request | Response |
| :--- | :--- |
| `GET /model/:rootId?token=<t>` | `text/markdown` — the canonical model file |
| `GET /events?token=<t>` | `text/event-stream` — the change stream |
| `GET /health?token=<t>` | `application/json` — `{ ok, models }` |

`:rootId` must resolve within the session's touched-model set; anything else is `404`.

### 3.3 SSE event

```
event: model-changed
id: 7
data: {"model":"crm_V_0-1-0_business","op":"apply_change","concept":"RevenueStream","element":"enterprise-tier","at":"2026-09-30T12:00:00Z"}
```

### 3.4 Mutating-tool envelope addition

Mutating tools append two fields when preview is enabled:

```json
{
  "success": true,
  "model": "crm_V_0-1-0_business",
  "preview_url": "http://127.0.0.1:54321/model/crm_V_0-1-0_business?token=<hex>",
  "preview_app_url": "https://cognnitive.com/innfo/app/?view=editor&models=<enc(preview_url)>&live=http://127.0.0.1:54321&token=<hex>"
}
```

- `models` carries the percent-encoded model URL(s), joined by commas — the existing
  `?models=` list parameter.
- `live` is the SSE base origin; `token` authenticates the `/events` subscription.
- The agent prints `preview_app_url` verbatim.

### 3.5 Access control
- Token: 24 cryptographically random bytes as hex, generated once per process.
- Every request without a matching token is rejected with `401` and no body.
- CORS: `Access-Control-Allow-Origin` echoes the request `Origin` only when it is
  `https://cognnitive.com`, `http://localhost:5173` or `http://localhost:5174`.
  Otherwise no CORS headers are emitted. Never `*`.
- The listener binds `127.0.0.1` explicitly.

## 4. File Changes

| File Path | Description of Changes |
| :--- | :--- |
| `iNNfo/packages/innfo-mcp/src/tools/preview-server.ts` | New: HTTP server, token/CORS, `/model`, `/events`, `/health`, in-process emitter. |
| `iNNfo/packages/innfo-mcp/src/server.ts` | Flag read, lazy init on mutating tools, `preview_url`/`preview_app_url` in envelopes, shutdown on exit. |
| `iNNfo/packages/innfo-mcp/src/tools/preview-server.test.ts` | New: unit tests (flag off, serve model, token rejection, one event per mutation). |
| `iNNfo/apps/innfo-editor/src/composables/useLivePreview.ts` | New: `EventSource` consumer that re-fetches the named model and preserves selection. |
| `iNNfo/apps/innfo-editor/src/composables/useLivePreview.test.ts` | New: unit tests with an `EventSource` mock. |
| `iNNfo/apps/innfo-editor/src/stores/workspaceStore.ts` | Add `previewReadOnly` flag. |
| `iNNfo/apps/innfo-editor/src/views/HomeView.vue` | Parse `live`/`token`/`models`, enter read-only live mode. |
| `iNNfo/apps/innfo-editor/src/components/layout/Header.vue` | Disable save and version bump in read-only preview. |
| `skills/nn-innfo/SKILL.md` | §12: print the live `preview_app_url` alongside the static deep links. |
| `docs/innfo/documentation/**` | Document the live tab and the read-only contract. |

## 5. Testing Strategy

1. **Unit — `preview-server.test.ts`** (TDD first):
   - With the flag off, no listener is created.
   - `/model/:id` returns the canonical Markdown for a touched model; unknown id → 404.
   - `/model` and `/events` without/with a wrong token → 401.
   - A mutation emits exactly one `model-changed` event carrying the model id.
   - CORS headers appear only for allowlisted origins.
2. **Unit — `useLivePreview.test.ts`** (TDD first):
   - An event triggers a re-fetch of the named model and a `setGraph`.
   - The previously selected node id is preserved after the re-render when it survives.
   - The read-only flag is set on entry.
3. **E2E — Playwright**: `apply_change` → event delivered → the editor re-renders the
   affected element in read-only mode.
4. **Gates per phase**: `npm run lint`, `npm run typecheck`, the package test suites;
   full gates at the tip.

## 6. Migration

None. The change is additive and flag-gated; the editor's URL-loaded read-only path
already exists, and no persisted format changes.

## 7. Deferred / Follow-ups

- A durable link that survives the session (separate change).
- The `innfo://` OS protocol handler (already deferred in the backlog).
- Serving the built editor bundle from the endpoint (one URL opens the app).
