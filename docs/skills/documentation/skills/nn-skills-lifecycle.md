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
- **MCP Servers**: each server is declared nested inside the skill that owns it (`agent-bootstrap.skills[].mcp[]`), not as a separate top-level list. `parseManifest()` hoists every nested `mcp[]` into one merged, name-deduplicated list, so `status`, `install`, and `update` treat MCP servers exactly like skills and templates. A top-level `agent-bootstrap.mcp` is still honored for backward compatibility.

---

## 2. Management Commands (`skills-manager.js`)

| Command | Action |
| :--- | :--- |
| `bootstrap [--scope <global\|workspace>]` | Zero-touch ecosystem setup: downloads pinned skills, templates, MCP bundles, and configures agent MCP settings. |
| `status` | Compares installed vs. pinned commits; prints status table and diff-file count preview. |
| `install` | Installs missing skills from GitHub tarballs into `~/.agents/skills/{name}/` (or workspace). |
| `install-external --name <n> --repo <owner/repo> --path <skills/x> --commit <40-hex> [--sha256 <64-hex>]` | **Opt-in.** Installs a *referenced* external (third-party) skill at its pinned commit, verifying the `sha256` tree digest when given. Never invoked by `install`/`update`. |
| `update [skill ...]` | Updates outdated skills to their pinned commit. |
| `sync [--direction ...]` | Recursively copies skill files between workspace `skills/` and global directory. |

**Referenced external skills.** A bluepriNNt may recommend a third-party skill by declaring it in its frontmatter `skills:` array pinned to a `commit` + `sha256` digest with an SPDX `license`. It is never vendored and its guarantee is deliberately bounded — reproducible, unmodified since the pin, and license-declared; cogNNitive does not vouch for its author. Install it only with `install-external`; the ordinary `install`/`update` never fetch a referenced skill. See the guarantee tiers in the template package spec.

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
