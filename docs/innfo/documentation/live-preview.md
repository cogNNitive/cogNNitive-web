# Live Model Preview

Authoring a kNNowledge through an AI agent normally forces a context switch:
the agent mutates the model, and to see the result you leave the chat, open the
iNNfo Modeler, and navigate back to the affected element. Deep links soften the
jump but they are a one-shot navigation — they do not reflect later mutations,
and a local-workspace link is not portable because `?ws=` only reopens a folder
whose File System Access permission this browser already holds.

The **live model preview** turns the editor tab into a live surface: the MCP
serves the models the session touches over loopback HTTP and pushes an event on
every mutation, so a single tab opened once keeps reflecting the agent's edits.

---

## 1. What starts it

The preview server is **opt-in and off by default**. It only starts when the
MCP process runs with:

```
INNFO_PREVIEW=1
```

When the flag is off — every headless and CI invocation — no listener is
created and no preview field is added to any tool result.

When the flag is on, the server starts **lazily on the first mutating tool
call** (`apply_change`, `sync_domain_manifest`), binds `127.0.0.1` on an
ephemeral port, and dies with the MCP process. There is no separate daemon and
no fixed port.

## 2. Getting the link

Every successful mutation returns two extra fields in its envelope:

| Field | Shape |
| :--- | :--- |
| `preview_url` | `http://127.0.0.1:<port>/model/<id>?token=<token>` — the canonical Markdown of the affected model |
| `preview_app_url` | `https://cognnitive.com/innfo/app/?view=editor&models=<url>&live=<origin>&token=<token>` |

The agent prints `preview_app_url` verbatim. Opening it once is enough: the tab
subscribes to the change stream and re-renders the affected model on every
later mutation, preserving the current view and selected node.

## 3. The change stream

The server exposes `GET /events?token=<token>` as a Server-Sent Events stream.
Each mutation emits exactly one event:

```
event: model-changed
id: 7
data: {"model":"crm_V_0-1-0_business","op":"apply_change","concept":"RevenueStream","element":"enterprise-tier","at":"2026-09-30T12:00:00Z"}
```

The editor re-fetches `/model/<id>` on each event, splices the refreshed model
into the graph, and leaves the other models in the tab untouched.

## 4. Read-only by contract

The preview tab is a **read-only mirror of the agent's work**, not a second
editor. Editing controls are disabled and save and version bump are blocked, so
no unsaved human edit can be lost when a mutation event replaces the graph.

To change a model you prompt the agent (or open the local workspace normally in
a different tab). The preview never writes.

## 5. Session bound

The link lives only as long as the agent session: the server is in-process and
terminates with the MCP, and the per-session token stops working at the same
time. This is deliberate — a durable, portable link that survives the session
is a separate, future change. The same applies to the `innfo://` OS protocol
handler.

## 6. Access control

- **Loopback only** — the listener binds `127.0.0.1`, never a public interface.
- **Per-session token** — 24 random bytes as hex, generated once per process;
  every request without a matching token is rejected with `401`.
- **Restricted CORS** — `Access-Control-Allow-Origin` echoes the request origin
  only for `https://cognnitive.com`, `http://localhost:5173`, and
  `http://localhost:5174`. It is never `*`.

## 7. Endpoints

| Request | Response |
| :--- | :--- |
| `GET /model/:id?token=<t>` | `text/markdown` — the canonical model file |
| `GET /events?token=<t>` | `text/event-stream` — the change stream |
| `GET /health?token=<t>` | `application/json` — `{ ok, models }` |

`:id` must resolve within the session's touched-model set; anything else is
`404`.
