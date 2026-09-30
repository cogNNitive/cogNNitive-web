# mcp-live-preview Specification

## Purpose
TBD - created by archiving change 2026-09-30-mcp-live-model-preview. Update Purpose after archive.
## Requirements
### Requirement: Loopback Preview Server

`innfo-mcp` MUST be able to start an HTTP server bound to `127.0.0.1` on an ephemeral
port, serving the models the current session has touched as canonical Markdown. The
server MUST start lazily on the first mutating tool call, MUST NOT start when preview
is disabled, and MUST terminate with the MCP process.

#### Scenario: No listener before the first mutation
- GIVEN preview is enabled and a fresh session
- WHEN no mutating tool has run
- THEN no listening socket exists

#### Scenario: Serving a touched model
- GIVEN preview is enabled
- WHEN the agent mutates model `X`
- THEN `GET /model/X?token=<t>` returns the canonical Markdown of `X`

#### Scenario: Disabled preview spawns nothing
- GIVEN preview is disabled
- WHEN any tool runs
- THEN no listener is created and no preview field appears in the envelope

### Requirement: Preview URL Advertisement

When preview is enabled, every mutating tool result MUST include a `preview_url` for
the affected model and a `preview_app_url` that opens `innfo-editor` against that model
in live mode. The agent MUST be able to print `preview_app_url` verbatim.

#### Scenario: Mutation returns the live link
- GIVEN preview is enabled
- WHEN `apply_change` succeeds
- THEN the envelope contains `preview_url` carrying a session token
- AND `preview_app_url` pointing at `innfo-editor` with the `models`, `live` and `token` parameters

### Requirement: Change Event Stream

The server MUST expose an SSE endpoint that emits one `model-changed` event per model
mutation performed through the MCP. Each event MUST carry the affected model identifier
and, when known, the concept and element pointer.

#### Scenario: One event per mutation
- GIVEN an open subscription to `/events`
- WHEN one model mutation is performed
- THEN exactly one `model-changed` event naming the model is delivered

### Requirement: Read-Only Editor Live Mode

When opened with the live parameters, `innfo-editor` MUST subscribe to the change
stream and re-render the affected model on each event, preserving the current view and
selected node. The tab MUST be read-only: editing and saving MUST NOT be possible, so
no unsaved human edit can be lost when a mutation event arrives.

#### Scenario: Live refresh preserves context
- GIVEN the editor open in live mode with a node selected
- WHEN a `model-changed` event for the displayed model arrives
- THEN the model is re-fetched and re-rendered
- AND the selected node is preserved when it still exists

#### Scenario: Read-only enforcement
- GIVEN the editor in live mode
- WHEN the user attempts to edit or save
- THEN editing controls are disabled and save is blocked

#### Scenario: Portable open without a File System handle
- GIVEN a fresh browser with no stored workspace handle
- WHEN the `preview_app_url` is opened
- THEN the model renders read-only from the preview endpoint

### Requirement: Endpoint Access Control

The server MUST require a per-session token on every request, MUST restrict CORS to the
application origin, and MUST bind to loopback only.

#### Scenario: Missing or wrong token is rejected
- GIVEN the running preview server
- WHEN `/model/:id` or `/events` is requested without a valid token
- THEN the request is rejected with `401`

#### Scenario: Cross-origin access restricted
- GIVEN a request whose `Origin` is not the application origin
- WHEN it reaches the server
- THEN no CORS grant is emitted

