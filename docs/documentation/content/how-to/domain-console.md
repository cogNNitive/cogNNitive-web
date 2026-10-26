# Use the domain console

The **domain console** is the window into your domaiNN: a single, self-contained page where you browse your kNNowledge and review proposed changes. It opens in your browser and needs no server, no network, and no install.

## Ask your agent to open it

You do not build or export the console. Ask your agent:

> Open the console for Aurora.

> Show me my domain.

The agent generates the page (or reports that it is already up to date) and opens it in a browser tab. The console is one file — `domaiNN_console.html` at the domain root — that carries everything it needs inside it, so it keeps working even after you archive it or move it to another machine.

## What you see

- **Your kNNowledge** — every document in the domain, with its concepts and elements.
- **Concept colors and icons** — each concept gets a stable color and icon, so the shape of a document is readable at a glance.
- **A review view** — where a proposed change appears as a diff you can inspect before approving it.

## What you do there

The console is where the review half of every change happens. When your agent proposes a change, the console opens showing it as a diff. You read it, and you can add your own drafts — edit a field, leave a comment, or add a new element. When you are happy, you approve back in the chat with your agent (replying **OK**), and the agent applies the change. See [Review changesets](review-changesets.md).

The console is **static**: it cannot talk back to your agent on its own, so approvals always travel through the conversation. That is what makes it safe to archive.

## Works offline

Because the page is self-contained, you can open it directly from disk — no web server required — and it keeps working with no toolchain installed. That is also what makes it a durable deliverable you can hand to someone else.

## See also

- [Review changesets](review-changesets.md) — the workflow the review view serves.
- [Agent skills overview](../skills/README.md) — the console skill and custom views.

## Under the hood

The agent compiles and opens the console through the `nn-mcp` server (or the console export script when running from a checkout). See [MCP tools](../reference/mcp-tools.md).
