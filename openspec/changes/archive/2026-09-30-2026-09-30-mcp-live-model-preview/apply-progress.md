# Apply Progress: MCP-Served Live Model Preview

Status: **implemented** (all phases), on `dev`.

## Commits

| Commit | Scope |
| :--- | :--- |
| `439b0966` | `feat(innfo-mcp)`: preview server + SSE + access control + envelope advertisement |
| `c00f347e` | `feat(innfo-editor)`: read-only `useLivePreview` consumer + URL entry + save guard |
| `986b8f42` | `docs(nn-innfo)`: live-preview page + skill §12 copy |

## What landed

- `innfo-mcp/src/tools/preview-server.ts` — in-process `node:http` server on
  `127.0.0.1`, ephemeral port, per-process 24-byte hex token, origin-restricted
  CORS, `/health` + `/model/:id` + `/events` (SSE). Lazy singleton, off unless
  `INNFO_PREVIEW=1`.
- `innfo-mcp/src/server.ts` — `withPreview()` attaches `preview_url` and
  `preview_app_url` to `apply_change` and `sync_domain_manifest` envelopes only.
- `innfo-editor/src/composables/useLivePreview.ts` — EventSource consumer that
  re-fetches the named model, splices it into the graph, preserves the selected
  node, and flags the workspace read-only.
- `workspaceStore.previewReadOnly` blocks `saveActiveFile` /
  `saveActiveFileWithVersionBump`; `Header.vue` hides save + version bump and
  shows a read-only badge. Entry via `?models=&live=&token=` in HomeView /
  WorkspaceView.
- `useUrlDocLoader` now derives the root id from the URL pathname, so preview
  URLs carrying `?token=…` still yield a clean model id.
- Docs: `docs/innfo/documentation/live-preview.md` (+ regenerated
  sidebar/llms/ai-index from `documentation_NN.md`); `skills/nn-innfo` §12
  prints the live `preview_app_url` alongside static deep links.

## Gates (all green)

- `innfo-mcp` suite (312 tests), `innfo-editor` suite (716 tests), `innfo-core`
  suite (965 tests, 1 skipped) — green.
- `npm run lint` (0 errors), `npm run typecheck`, `node scripts/verify.js`,
  `node scripts/check-integrity.js` — all pass.

## Deviations / follow-ups

- **Task 5.1 (Playwright E2E)**: this repo has no Playwright harness. The
  scenario is covered by a real `apply_change` → SSE `model-changed`
  integration test in `src/server-preview.test.ts` plus the consumer/selection
  unit test. A browser-level run remains a follow-up if a Playwright harness
  lands.
- **Task 4.1 touched `skills/**`** without cutting a new `skills-v*` tag or
  re-pinning `manifest/source.yaml`. `checkTagPinFreshness` passed locally
  (the batch already carries manifest changes vs `origin/main`), but a release
  tag is still the maintainer's call (`nn-dev-release`).
- **Known flake**: `innfo-core` `tests/metrics-console-harness.test.ts` failed
  once under the parallel full-monorepo run (browser harness contention); it
  passes in isolation and is unrelated to this change.
