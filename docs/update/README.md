# cogNNitive Update Center & Release Distribution

Canonical update portal and public CDN manifest serving hub for the **cogNNitive** ecosystem.

This center provides real-time access to the distribution manifests, blueprint version matrices, and automated upgrade workflows for AI coding agents and developers.

---

## How to Upgrade

You can upgrade your workspace skills, MCP runtime, and blueprints using your AI coding agent or via the CLI tools.

### Via AI Agent (Recommended)

Paste the following command directly into your agent's chat (**OpenCode Desktop**, **Claude Code**, **Google Antigravity**, **Cursor**, **Codex**):

```text
/nn:upgrade
```

Or trigger an explicit update from the public CDN endpoint:

```text
I want to upgrade https://cognnitive.com/update
```

### Via CLI

Run the skills lifecycle manager in your terminal:

```bash
node scripts/skills-manager.js upgrade
```

To inspect installed versions versus canonical releases without writing changes:

```bash
node scripts/skills-manager.js status
```

---

## Release Channels

The ecosystem distributes manifests across two live channels:

| Channel | URL Endpoint | Description |
|---|---|---|
| **Stable** | [`https://cognnitive.com/use/manifest.md`](https://cognnitive.com/use/manifest.md) | Tagged, fully tested release pins for production workspaces. |
| **Preview** | [`https://cognnitive.com/use/manifest-next.md`](https://cognnitive.com/use/manifest-next.md) | Branch-tip builds for early validation and development. |

---

## Distribution Manifest

The machine-readable manifest contains the full list of canonical skills, version pins, commit SHAs, and MCP runtime endpoints.

- **Primary CDN Manifest**: [`/update/manifest.md`](/update/manifest.md) (mirrored with [`/use/manifest.md`](/use/manifest.md))
- **Raw GitHub Mirror**: `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/docs/use/manifest.md`

---

## Blueprint Catalog

The Level-2 domain blueprint schemas are published at canonical same-origin URLs:

- **Catalog Endpoint**: [`https://cognnitive.com/innfo/blueprints/catalog.json`](https://cognnitive.com/innfo/blueprints/catalog.json)
- **MCP CDN Bundle**: [`https://cognnitive.com/innfo/cdn/manifest.json`](https://cognnitive.com/innfo/cdn/manifest.json)

---

## Offline Resilience

If your network is disconnected or the CDN is unreachable, preflight and lifecycle tools (`nn-preflight`, `nn-upgrade`, `nn-skills-lifecycle`) gracefully fall back to local snapshots and cached manifests without throwing unhandled exceptions.
