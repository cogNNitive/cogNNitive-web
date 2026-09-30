# Proposal: MCP-Served Live Model Preview

## Why

Authoring a kNNowledge through an AI agent (OpenCode, Claude Code) forces a context
switch for visualization: the agent mutates the model, and the user must leave the
chat, open or focus the Cognnitive Web App, and re-navigate to the affected element.
The app already resolves deep links (`?view=editor&model=<id>&ws=<folder>#<Concept>.<Element>`),
but a link is a one-shot navigation: it does not reflect later mutations, and a
local-workspace link is not portable because `?ws=` only reopens when that browser
already holds a permission-granted File System Access handle. The bottleneck is the
context switch, not a missing UI.

This change makes the editor tab a **live surface**: the MCP serves the models the
session touches over loopback HTTP and pushes a change event on every mutation, so a
single tab opened once keeps reflecting the agent's edits. It is the local-server +
persistent-browser pattern, applied to the iNNfo model instead of a chat app.

The preview tab is deliberately a **read-only mirror of the agent's work**, not a
second editor. This removes the human↔agent write conflict by construction: the human
never edits in the preview tab, so there are no unsaved edits to clobber when a
mutation event arrives. To change a model the user prompts the agent (Pathway 1) or
opens the local workspace normally (Pathway 2).

## What Changes

- **Loopback preview server in `innfo-mcp`.** On opt-in, the MCP process starts a
  lightweight HTTP server bound to `127.0.0.1` on an ephemeral port, serving the
  models the session touched — as canonical Markdown the editor loads through its
  existing `?model=<url>` / `?models=<urls>` paths. **In-process**: it starts lazy on
  the first mutation and dies with the MCP process. Off by default (env flag), so
  headless and CI invocations spawn nothing.
- **Change stream.** The server exposes an SSE stream that emits an event on every
  model mutation performed through the MCP (`apply_change`, `sync_workspace_manifest`,
  and any future mutator), carrying the event id and the affected model / concept /
  element pointer. The editor re-fetches the named model on each event.
- **Editor live mode (read-only).** When the app is opened against the preview
  endpoint it subscribes to the stream and re-renders the affected model, preserving
  the current view and selected node via the existing view/hash sync. The workspace is
  flagged read-only: no edits, no save (consistent with today's URL-loaded semantics).
- **Discovery via tool result.** The mutating tool returns `preview_url` (with the
  session token) in its envelope; the agent prints it. No port file, no fixed port.
- **Security posture.** Loopback only; a per-session random token in the URL query is
  required, and `Access-Control-Allow-Origin` is restricted to the app origin
  (`cognnitive.com`, `localhost:5173` in dev) — never `*`.

## Capabilities

### New Capabilities
- `mcp-live-preview`: the in-process loopback preview server, the SSE change stream,
  the read-only editor live-refresh consumer, the `preview_url` advertisement, and the
  token/CORS access control.

### Modified Capabilities
- None. The editor's live-preview consumer is owned by the new `mcp-live-preview`
  capability, because `editor-routing` scopes legacy-route redirection only and does
  not own URL-based model loading.

## Impact

### Affected areas
- `iNNfo/packages/innfo-mcp/src/server.ts` and new `src/tools/preview-server.ts`
  (HTTP + SSE; reuses `innfo-core` read/parse to serve canonical model text).
- `iNNfo/apps/innfo-editor/src/composables/useUrlDocLoader.ts` and new
  `useLivePreview.ts` (EventSource consumer); `HomeView.vue` to accept the preview URL
  and enter read-only mode.
- `skills/nn-innfo/SKILL.md` §12 (print the live URL alongside the static deep links).
- `docs/innfo/documentation/**` (how the live tab works).

### Verification
- Unit: the server serves a model file; the SSE stream emits once per mutation; a
  request without the session token is rejected; the server is absent when the flag is
  off.
- Integration (Playwright): `apply_change` → event delivered → editor re-renders the
  affected element with selection preserved, in read-only mode.
- Portability: a fresh browser can open `?model=<preview_url>` with no FS handle.

### Rollback
Feature-flagged and additive. Revert the commit to remove the server and the editor
consumer; no persisted state, so nothing to migrate.

### Dependencies
- Builds on the existing `?model=<url>` loader and the deep-link contract
  (`skills/nn-innfo/SKILL.md` §12). No blocking dependency.
- Related backlog items: `feature/opencode-web-onboarding-hint` (side-by-side tab); the
  deferred `feature/innfo-uri-protocol` is explicitly kept separate.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| The preview tab dies with the agent session, so it is not a durable link | Certain (by decision) | Document the bound; a durable link is a separate future change |
| Two concurrent sessions collide on ports | Low | Ephemeral port + per-session token |
| Scope creep into a second editor / human↔agent conflict | Low | Read-only mirror by decision; editing is out of scope |
| Scope creep into the embedded-app rabbit hole | Med | Out of scope: only data + events are served, not the app bundle |

### Success criteria
- [ ] With the flag on, one tab opened once reflects every subsequent MCP mutation
      without manual navigation, within the session.
- [ ] The preview URL is portable (no File System Access handle required).
- [ ] The preview tab is read-only; the server is absent when the flag is off.
- [ ] Editor view and selection survive a live refresh.

### Out of scope
- Editing in the preview tab (human↔agent write conflict is avoided by read-only).
- Embedding the editor inside the agent chat (MCP Apps / `ui://`). Deferred until hosts
  support it; the sandbox has no File System Access API.
- Serving the built editor bundle from the preview server (one URL opens the app).
- A durable/portable link surviving the session, and the `innfo://` OS protocol handler.

### Resolved decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Server lifecycle | In-process; starts lazy on first mutation, dies with the MCP session |
| 2 | Update transport | SSE (one-way, native `EventSource`) |
| 3 | Write model | Read-only mirror; the human does not edit in the preview tab |
| 4 | Endpoint scope | Only the model(s) the session touched (`?model=` / `?models=`) |
| 5 | Discovery | Tool-result only (`preview_url` in the mutating tool envelope); no port file |
| 6 | Security | Per-session token in query + CORS restricted to the app origin |
| 7 | `innfo://` | Kept separate (deferred backlog item) |
