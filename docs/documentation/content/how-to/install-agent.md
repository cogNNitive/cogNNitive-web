# Install and connect an AI agent

cogNNitive is driven by a local AI coding agent. The agent talks to the `nn-mcp` server over the Model Context Protocol (MCP) to validate documents, resolve bluepriNNts, and mutate a domaiNN through changesets. This guide registers the server and installs the agent skills.

## 1. Bootstrap with a single instruction

Open your agent in the folder where you want to work and paste this instruction:

```text
I want to use https://cognnitive.com/use
```

That URL serves the **bootstrap manifest**, which declares the skills, bluepriNNts, the MCP server, and the console assets to install. The agent follows it: it downloads the skills, registers the `nn-mcp` server, and records what it installed.

## 2. What the bootstrap installs

| Artifact | Location | Notes |
|---|---|---|
| Agent skills | `~/.agents/skills/<name>/` | One canonical copy per skill, projected into each agent's skill directory. |
| Install record | `~/.agents/bootstrap-state.json` | One entry per installed skill, with its pinned commit and a per-file content hash. |
| MCP server bundle | `~/.agents/mcp/nn-mcp.bundle.js` | The stdio server the agent launches. |
| Console assets | `~/.agents/console/` | Used when regenerating the domain console outside a checkout. |

The bundle also ships inside the cogNNitive repository at `iNNfo/packages/nn-mcp/bin/nn-mcp.bundle.js`; the installed copy under `~/.agents/mcp/` is what the agent runs day to day.

> [!NOTE]
> The canonical skill under `~/.agents/skills/<name>/` is a real directory copied from the manifest pin. Each agent's skill directory (for example `~/.claude/skills/<name>`) is a **junction/symlink** to that canonical copy so an update is visible everywhere at once. When the OS or filesystem refuses a link — Windows without developer mode, a non-privileged user, or a filesystem that does not support links — the projection falls back to a **mirror copy**, and the install record notes the method so the next update can detect drift. Either way, every install, update, and sync is reproducible from the manifest.

## 3. Register the MCP server

The bootstrap registers `nn-mcp` automatically. The registration writes a `nn-mcp` entry that launches the installed bundle over stdio:

```json
{
  "mcp": {
    "nn-mcp": {
      "type": "local",
      "command": ["node", "/home/<user>/.agents/mcp/nn-mcp.bundle.js"]
    }
  }
}
```

The exact config file depends on the agent:

| Agent | Config file | Shape |
|---|---|---|
| OpenCode | `~/.config/opencode/opencode.json` (or `opencode.jsonc`) | `mcp` block |
| Claude Code | `~/.claude.json` | `mcpServers` block |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | `mcpServers` block |
| Cursor | Cursor's MCP settings file | `mcpServers` block |

The server binary path is always the installed `~/.agents/mcp/nn-mcp.bundle.js` (or the repo copy at `iNNfo/packages/nn-mcp/bin/nn-mcp.bundle.js` when running from a checkout).

## 4. Verify the connection

Ask the agent to list its tools. You should see the `nn-mcp` tool set — `list_knowledge`, `init_domain`, `validate_knowledge`, `cognitivize`, `propose_changeset`, `apply_change`, and the rest. If the tools are missing:

1. Confirm the bundle exists at `~/.agents/mcp/nn-mcp.bundle.js`.
2. Confirm the config file has an `nn-mcp` entry pointing at that path.
3. Restart the agent so it reloads the MCP configuration.

## See also

- [Agent skills overview](../skills/README.md) — what the bootstrap installs.
- [MCP tools](../reference/mcp-tools.md) — the full tool reference.
- [Create your first domaiNN](../tutorials/first-domain.md) — use the tools end to end.
