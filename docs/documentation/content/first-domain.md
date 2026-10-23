# Create your first domaiNN

> [!NOTE]
> This tutorial takes about 5 minutes. You will learn the happy path from installing the tools to creating a validated domaiNN.

## 1. Prerequisites

Before starting, ensure you have an AI coding agent with MCP support (such as Antigravity, Claude Code, or Cursor).

## 2. Install the Ecosystem

Paste this single instruction to your agent:

```text
I want to use https://cognnitive.com/use
```

The agent registers the `nn-mcp` tools and downloads the essential skills.

## 3. Initialize your Workspace

Run the `init_domain` tool through your agent:

```bash
# The agent executes:
nn-mcp init_domain --name my-project
```

This creates the standard folder hierarchy:

- `domaiNN_NN.md` (the domain manifest)
- `kNNowledge/` (where your domain documents will live)
- `sources/` (where raw inputs and normalized sources are tracked)
- `specs/` (bluepriNNts and validation rules)

## 4. Add your First Source

Drop any meeting notes or spec document into `sources/import/meeting.md`, then ask your agent:

> "Cognitivize `sources/import/meeting.md`"

The agent generates a sidecar file (`meeting.md_sidecar_NN.md`) with SHA-256 hashes, making every heading a citable unit with zero modification to your original document.
