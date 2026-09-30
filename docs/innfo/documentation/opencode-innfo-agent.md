# OpenCode Desktop iNNfo Agent (Legacy)

> **This agent definition has been superseded by the [agent skills bundle](/use).**
>
> Instead of maintaining agent rules in this repo, install the full skills suite — it includes the `nn-innfo` skill plus router, trannsform, workflow orchestrator, and more.

The agent definition files (`.opencode/agents/innfo.md`, `.opencode/rules/innfo.md`) have been removed from this repo. The MCP server registration remains for local development of `innfo-core` and `innfo-mcp`.

## For AI interaction with iNNfo models

See [bootstrap](/use) — install the agent skills bundle and the skills auto-load when you edit `_NN.md` files in OpenCode Desktop.

## For local development of iNNfo

The MCP server is still available locally for testing:

```bash
npm run build --workspace=packages/innfo-mcp
```

This registers `innfo-mcp` in OpenCode Desktop via `opencode.json`. No agent-level rules are needed — the installed skills provide those.
