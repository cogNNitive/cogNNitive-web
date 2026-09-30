# Tasks: MCP-Served Live Model Preview

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450-550 total |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes (2: backend → editor) |
| Delivery strategy | chained |
| Chain strategy | server slice first, editor slice second |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: server slice first, editor slice second
400-line budget risk: Medium

---

## Phase 1: Backend — Preview Server (TDD first)

- [x] 1.1 **RED — preview server tests**: Write `iNNfo/packages/innfo-mcp/src/tools/preview-server.test.ts` covering: flag off creates no listener; `/model/:id` serves a touched model and 404s an unknown id; `/model` and `/events` reject a missing/wrong token with 401; one mutation emits exactly one `model-changed` event. `[mcp-live-preview:Requirement:Loopback Preview Server]`
- [x] 1.2 **GREEN — HTTP server**: Implement `preview-server.ts` with `node:http` bound to `127.0.0.1`, ephemeral port, `/health` and `/model/:id` resolving within the session's touched-model set. `[mcp-live-preview:Requirement:Loopback Preview Server]`
- [x] 1.3 **GREEN — change stream**: Add the in-process emitter and the `/events` SSE endpoint emitting one `model-changed` event per mutation with model/concept/element. `[mcp-live-preview:Requirement:Change Event Stream]`
- [x] 1.4 **GREEN — wiring and lifecycle**: Read `INNFO_PREVIEW`, initialize lazily on the first mutating tool call, and close the server on process exit in `server.ts`. `[mcp-live-preview:Requirement:Loopback Preview Server]`
- [x] 1.5 **GREEN — envelope advertisement**: Append `preview_url` and `preview_app_url` to the mutating tools' envelopes when preview is enabled. `[mcp-live-preview:Requirement:Preview URL Advertisement]`
- [x] 1.6 **Verify Phase 1**: `npm run lint`, `npm run typecheck`, and the `innfo-mcp` test suite are green.

## Phase 2: Backend — Access Control

- [x] 2.1 **RED — token and CORS tests**: Extend `preview-server.test.ts` with token generation/rejection and origin allow/deny cases. `[mcp-live-preview:Requirement:Endpoint Access Control]`
- [x] 2.2 **GREEN — enforce token and CORS**: 24-byte hex token per process; reject requests without it; echo `Access-Control-Allow-Origin` only for `https://cognnitive.com`, `http://localhost:5173`, `http://localhost:5174`. `[mcp-live-preview:Requirement:Endpoint Access Control]`
- [x] 2.3 **Verify Phase 2**: `npm run lint`, `npm run typecheck`, `innfo-mcp` tests green.

## Phase 3: Editor — Read-Only Live Consumer (TDD first)

- [ ] 3.1 **RED — live consumer tests**: Write `useLivePreview.test.ts` with an `EventSource` mock: an event re-fetches the named model and calls `setGraph`; the previously selected node is preserved after re-render; the read-only flag is set on entry. `[mcp-live-preview:Requirement:Read-Only Editor Live Mode]`
- [ ] 3.2 **GREEN — `useLivePreview` composable**: Implement the `EventSource` consumer reusing `useUrlDocLoader`, preserving `uiStore.selectedNodeId`, and marking `workspaceStore.previewReadOnly`. `[mcp-live-preview:Requirement:Read-Only Editor Live Mode]`
- [ ] 3.3 **GREEN — read-only enforcement**: Disable editing controls and block save and version bump when `previewReadOnly` is set (`Header.vue`, edit entry points). `[mcp-live-preview:Requirement:Read-Only Editor Live Mode]`
- [ ] 3.4 **GREEN — entry from URL**: Parse `models`, `live` and `token` in `HomeView.vue` and enter read-only live mode. `[mcp-live-preview:Requirement:Read-Only Editor Live Mode]`
- [ ] 3.5 **Verify Phase 3**: `npm run lint`, `npm run typecheck`, `innfo-editor` unit tests green.

## Phase 4: Skill & Documentation

- [ ] 4.1 **Skill copy**: Update `skills/nn-innfo/SKILL.md` §12 to print the live `preview_app_url` next to the static deep links. `[mcp-live-preview:Requirement:Preview URL Advertisement]`
- [ ] 4.2 **Docs**: Add a page under `docs/innfo/documentation/**` describing the live tab, the read-only contract, and the session bound. `[mcp-live-preview:Requirement:Read-Only Editor Live Mode]`

## Phase 5: End-to-End & Gates

- [ ] 5.1 **E2E (Playwright)**: `apply_change` → event delivered → the affected element re-renders in read-only live mode with selection preserved. `[mcp-live-preview:Requirement:Read-Only Editor Live Mode]`
- [ ] 5.2 **Full gates at the tip**: `npm run lint`, `npm run typecheck`, the full test suite, and `node scripts/check-integrity.js`.
