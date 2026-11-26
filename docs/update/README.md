# cogNNitive Update Center & Release Distribution

Canonical update portal and public CDN manifest serving hub for the **cogNNitive** ecosystem.

This center provides real-time access to the distribution manifests, blueprint version matrices, and automated upgrade workflows for AI coding agents and developers.

---

## How to Upgrade

You can upgrade your domaiNN skills, MCP runtime, and bluepriNNts using your AI coding agent or via the CLI tools.

### Via AI Agent (Recommended)

Paste the following command directly into your agent's chat (**OpenCode Desktop**, **Claude Code**, **Google Antigravity**, **Cursor**, **Codex**):

```text
/nn-update
```

Or trigger an explicit update from the public CDN endpoint:

```text
I want to upgrade https://cognnitive.com/update
```

### Via CLI

Run the skills lifecycle manager in your terminal:

```bash
node scripts/skills-manager.js update
```

To inspect installed versions versus canonical releases without writing changes:

```bash
node scripts/skills-manager.js status
```

### Blueprint provenance

A bluepriNNt does not carry its version in a catalog. The installed copy declares
what it is — `blueprint.json` beside its `spec_NN.md`, holding `name`, `version`,
`format_version` and `distribution_url` — and the installer records the resolved
tag and commit, plus a digest of every installed file, in
`<blueprints_dir>/.blueprint-lock.json`. That lock file lives inside the domain,
so it is committed with it and a clone with no network still reads.

`status` and `update` resolve a bluepriNNt's published version from
`<distribution_url>/versions.json`, a list the publisher maintains in its own
release pipeline. The list is only a hint: the commit it names is verified by
fetching that commit's tree and comparing the `blueprint.json` shipped there. A
channel entry carries `{ name, distribution_url }` and never a version.

Every outcome is named — `current`, `update-available`, `unknown` (no provenance
recorded), `unreachable` (the URL and the error are printed), `no-versions`,
`unverifiable`, `ahead`. "Up to date" is never reported for a check that could
not be performed.

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

- **Primary CDN Manifest**: [`https://cognnitive.com/update/manifest.md`](https://cognnitive.com/update/manifest.md) (mirrored with [`https://cognnitive.com/use/manifest.md`](https://cognnitive.com/use/manifest.md))
- **Raw GitHub Mirror**: `https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/use/manifest.md`

---

## Blueprint Catalog

The Level-2 domain bluepriNNt schemas are published at canonical same-origin URLs:

- **Catalog Endpoint**: [`https://cognnitive.com/innfo/blueprints/catalog.json`](https://cognnitive.com/innfo/blueprints/catalog.json)
- **MCP CDN Bundle**: [`https://cognnitive.com/innfo/cdn/manifest.json`](https://cognnitive.com/innfo/cdn/manifest.json)

---

## Offline Resilience

If your network is disconnected or the CDN is unreachable, preflight and lifecycle tools (`nn-preflight`, `nn-update`, `nn-skills-lifecycle`) gracefully fall back to local snapshots and cached manifests without throwing unhandled exceptions.
