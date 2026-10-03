---
title: "nn-skills-lifecycle — Skill Ecosystem Lifecycle & Governance"
description: "Install, create, audit, and maintain cogNNitive skills. Single entry point for managing manifest-pinned skills."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-skills-lifecycle
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn-skills-lifecycle

**Skill**: `nn-skills-lifecycle` · **Role**: Skill Lifecycle & Manifest Governance

Single entry point for managing skills tracked in the bootstrap manifest. Manages installation, updates, synchronization, quality audits, and registry generation.

---

## 0. Activation Gate

Executes the canonical activation gate defined in [`nn-preflight`](skills/nn-preflight.md).

---

## 1. Desired State & Installed State Architecture

- **Desired State (Source of Truth)**: The bootstrap manifest at `docs/use/manifest.md` (or fetched from GitHub). Frontmatter declares the canonical list of skills with pinned 40-character commit SHAs.
- **Installed State (Local Record)**: `~/.agents/skills-state.json`, recording `{ commit, version, updated_at }` for each locally installed skill.

---

## 2. Management Commands (`skills-manager.js`)

| Command | Action |
| :--- | :--- |
| `bootstrap [--scope <global\|workspace>]` | Zero-touch ecosystem setup: downloads pinned skills, templates, MCP bundles, and configures agent MCP settings. |
| `status` | Compares installed vs. pinned commits; prints status table and diff-file count preview. |
| `install` | Installs missing skills from GitHub tarballs into `~/.agents/skills/{name}/` (or workspace). |
| `update [skill ...]` | Updates outdated skills to their pinned commit. |
| `sync [--direction ...]` | Recursively copies skill files between workspace `skills/` and global directory. |

**Consent is mandatory**: Any mutating command requires user confirmation before altering files.

---

## 3. Bootstrap & Installation Scopes

When a fresh AI agent receives the bootstrap trigger (`"I want to use https://cognnitive.com/use"`), it executes `node scripts/skills-manager.js bootstrap`:

1. **Manifest Retrieval**: Fetches the canonical manifest (`manifest.md`) containing 40-character SHA commits for all skills, templates, and MCP bundles.
2. **Scope Selection**:
   - **Global User Profile (Default / Recommended)**: Installs tools to `~/.agents/skills/`, `~/.agents/templates/`, and `~/.agents/mcp/` (`%USERPROFILE%\.agents\` on Windows).
   - **Local Workspace**: Installs directly into the repository (`./.agents/skills/`, `./specs/templates/`, `./.agents/mcp/`).
3. **Multi-Agent MCP Auto-Registration**: Registers the `innfo-mcp` server bundle into detected AI agent configuration files (`~/.config/opencode/opencode.json`, `~/.claude.json`, `~/.gemini/antigravity.json`).
4. **Hybrid Resolution Runtime**:
   - **Global Layer**: Executables, skills, and MCP servers run centrally across all agent sessions.
   - **Workspace Layer**: Project-specific kNNowledge (`*_NN.md`) and customized bluepriNNts reside in `./specs/` and `./kNNowledge/`, prioritized first by the 4-tier lookup engine.

---

## 4. Release Channels

| Channel | Manifest URL | Pins Resolve To |
| :--- | :--- | :--- |
| **Stable** (default) | `.../main/docs/use/manifest.md` | Release tags on `main` |
| **Preview** | `.../main/docs/use/manifest-next.md` | Feature branch tips |
