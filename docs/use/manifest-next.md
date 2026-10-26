---
title: "cogNNitive — Bootstrap manifest (preview)"
description: "Canonical agent-bootstrap manifest served raw (Jekyll-safe) for https://cognnitive.com/use."
channel: "preview"
agent-bootstrap:
  version: "2.0"
  entrypoint: "domaiNN_NN.md"
  skills:
    - name: nn
      repo: cogNNitive/cogNNitive-web
      path: skills/nn
      version: "V_3-4-3"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      description: Primary Front Controller, ecosystem entry point, job loop menu ([s] Sources, [k] kNNowledge, [r] Review/Artifacts, [p] Procedures, [h] Help, [x] Cancel), system governance, and preflight readiness gate. Triggers: /nn, NN, nn, cognnitive, cognitive, start, router.
    - name: nn-sources
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-sources
      version: "V_3-5-4"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      requires: [nn-innfo, nn-preflight]
      description: Ingest documents (PDF, DOCX, XLSX), normalize them into citable sources with mandatory sidecar provenance, and keep source lineage in sync.
    - name: nn-innfo
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-innfo
      version: "V_0-5-13"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      description: Author, edit, and validate iNNfo kNNowledge with built-in step-by-step kNNowledge Creation Wizard.
      blueprints: [domaiNN]
      mcp:
        - name: nn-mcp
          repo: cogNNitive/cogNNitive-web
          path: iNNfo/packages/nn-mcp/bin/nn-mcp.bundle.js
          version: "0.30.0"
          ref: "main"
          commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
          url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/4f06d2e046c36b3c23b37099151ac681f9cc3f8f/iNNfo/packages/nn-mcp/bin/nn-mcp.bundle.js
    - name: nn-preflight
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-preflight
      version: "V_0-2-5"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      description: Environment readiness gate (Tier 1/Tier 2/Tier 3) and canonical skill-location reference.
    - name: nn-upgrade
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-upgrade
      version: "V_0-4-2"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      requires: [nn-preflight]
      description: Guided, consent-gated migration of a domaiNN to the latest adopted iNNfo Level-2 blueprints.
    - name: nn-site-generator
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-site-generator
      version: "V_0-2-0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      description: Create or edit websites, add analytics, add contact forms.
    - name: nn-design-presets
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-design-presets
      version: "V_1-4-0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      description: cogNNitive visual design presets — palettes, typography, spacing.
    - name: nn-skills-lifecycle
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-skills-lifecycle
      version: "V_1-3-1"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      requires: [nn-preflight]
      description: Audit, update, and maintain cogNNitive skills.
  blueprints:
    - name: domaiNN
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md
      version: "V_0-5-0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
    - name: changes
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/changes/spec_NN.md
      version: "V_0-5-0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
    - name: sidecar
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/sidecar/spec_NN.md
      version: "V_0-3-0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
    - name: sources
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/sources/spec_NN.md
      version: "V_0-5-0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
    - name: artifacts
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/artifacts/spec_NN.md
      version: "V_0-5-0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
    - name: procedures
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/procedures/spec_NN.md
      version: "V_0-3-2"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
    - name: blank
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/blank/spec_NN.md
      version: "V_0-5-0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
  console-assets:
    - file: iNNfo/specs/bluepriNNts/console/nn-console.bundle.js
      version: "0.26.0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/4f06d2e046c36b3c23b37099151ac681f9cc3f8f/iNNfo/specs/bluepriNNts/console/nn-console.bundle.js
    - file: iNNfo/specs/bluepriNNts/console/artifact_shell.html
      version: "0.26.0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/4f06d2e046c36b3c23b37099151ac681f9cc3f8f/iNNfo/specs/bluepriNNts/console/artifact_shell.html
    - file: scripts/export-console.mjs
      version: "0.26.0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/4f06d2e046c36b3c23b37099151ac681f9cc3f8f/scripts/export-console.mjs
    - file: scripts/console-views.mjs
      version: "0.26.0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/4f06d2e046c36b3c23b37099151ac681f9cc3f8f/scripts/console-views.mjs
    - file: iNNfo/specs/bluepriNNts/console/nn-ui.css
      version: "0.26.0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/4f06d2e046c36b3c23b37099151ac681f9cc3f8f/iNNfo/specs/bluepriNNts/console/nn-ui.css
    - file: iNNfo/specs/bluepriNNts/console/console-payload.generated.cjs
      version: "0.26.0"
      ref: "main"
      commit: "4f06d2e046c36b3c23b37099151ac681f9cc3f8f"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/4f06d2e046c36b3c23b37099151ac681f9cc3f8f/iNNfo/specs/bluepriNNts/console/console-payload.generated.cjs
  workflows:
    - id: knowledge
      label: Create iNNfo kNNowledge
      description: Turn an idea, document, or dataset into validated structured kNNowledge against a bluepriNNt.
      skill: nn-innfo
      blueprint: domaiNN
    - id: transform
      label: Transform a document
      description: Normalize a PDF/DOCX/XLSX into clean Markdown, or export to HTML.
      skill: nn-sources
---

> **PREVIEW — not for production.** This channel renders from the current branch tips
> in each source repo (not tags) and can change or break without notice. For the
> canonical, tag-pinned manifest for `bluepriNNts`, `kNNowledge`, and skills, use
> [`docs/use/manifest.md`](https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/use/manifest.md)
> instead.

# cogNNitive — bootstrap manifest

This file is the machine-readable entry point for the cogNNitive ecosystem. It is served
**raw** (via GitHub) so the `agent-bootstrap:` frontmatter above stays fetchable even though
the site is built with Jekyll. The human page at `https://cognnitive.com/use` links here.

## For a fresh agent with no cogNNitive skills yet (self-bootstrap)

The manifest frontmatter above is the source of truth for **desired pins**: every skill
carries a pinned `commit` (full 40-char sha — the integrity anchor) and a `version`
(display string that must match the SKILL.md frontmatter). What is actually installed
on a machine is recorded per-machine in `~/.agents/bootstrap-state.json` (like lazy.nvim's
`lazy-lock.json`).

1. Fetch the manifest — each skill carries a pinned `commit` and `version`.
2. Ask the user for the target installation scope, recommending their User Profile by default:
   - **Global User Profile (Default/Recommended)**: `~/.agents/skills/`, `~/.agents/bluepriNNts/`, and `~/.agents/mcp/` (on Windows: `%USERPROFILE%\.agents\`, on Linux/macOS: `$HOME/.agents/`).
   - **Local DomaiNN**: `./.agents/skills/`, `./specs/bluepriNNts/`, and `./.agents/mcp/`.
3. Run the check: `node scripts/skills-manager.js status` from a cogNNitive checkout
   (or ask the agent to run it) to compare installed commits (recorded in
   `~/.agents/bootstrap-state.json`) against the pins.
4. Install missing skills with explicit consent:
   `node scripts/skills-manager.js install`.
5. If any skill is outdated, show the diff preview and ask before updating:
   `node scripts/skills-manager.js update`. Never silently update, and never report
   "installed and up to date" without having run the check.
6. For each skill that declares `mcp[]`, download the bundle `url` into `{target}/mcp/{name}.bundle.js` (default: `~/.agents/mcp/{name}.bundle.js`) and register it in your agent MCP config (e.g. `opencode.jsonc`, `antigravity.json`, or domaiNN config).
7. For each iNNfo bluepriNNt declared in `blueprints:`, `nn-mcp` resolves and hydrates versioned packages using 4-tier lookup:
   - DomaiNN Package Directory: `./specs/bluepriNNts/<name>/<version>/`
   - DomaiNN Flat Fallback: `./specs/bluepriNNts/<name>/spec_NN.md` or `./specs/`
   - Global User Cache: `~/.agents/bluepriNNts/<name>/<version>/`
   - Installed Skills Directory: `~/.agents/skills/*/specs/bluepriNNts/<name>/<version>/`
   Hydration into the domaiNN `./specs/bluepriNNts/<name>/<version>/` is atomic and write-once immutable.
8. Attached SOP procedures (`procedures/`) and agent skills (`skills/`) declared in bluepriNNt frontmatter are dynamically discovered up to depth 10 via `list_blueprint_procedures` and `list_blueprint_skills`. Skills embedded in a package (`skills/<name>/SKILL.md`) are listed with `embedded: true` and a resolved `path`.
9. Present the `workflows[]` as a menu and hand over to the chosen skill.

## For an agent that already has `agent-web-bootstrap`

Invoke it with the canonical URL — it performs all of the above and hands over to a workflow:

```
I want to use https://cognnitive.com/use
```

## For opencode CLI / agents without `agent-web-bootstrap`

If your agent does not have `agent-web-bootstrap` built in (e.g. opencode CLI, opencode TUI):

1. Your `AGENTS.md` or `opencode.json` `instructions` field should include a rule like this:

   ```
   ## Bootstrap Rule
   When user says "I want to use https://cognnitive.com/use":
   1. Fetch this manifest (In Windows, use `curl.exe`, Node.js native `fetch`, or git into `$env:TEMP` / `~/.agents/tmp/` to avoid PowerShell `curl` SSL alias issues and workspace pollution).
   2. Parse agent-bootstrap block for skills to install
   3. Ask the user where to install (suggest by default their Windows/Linux user profile `~/.agents/`; alternative: current workspace `./.agents/`).
   4. Download/extract each skill tarball to target skills directory (default: `~/.agents/skills/{name}/`).
   5. For skills with mcp[]: download bundle to target mcp directory (default: `~/.agents/mcp/`) and register in agent MCP config.
   6. Show workflow menu
   ```

2. The canonical reference implementation lives in this repository's `AGENTS.md`.

3. Without the rule above, the agent will not recognize the phrase — paste it into your `AGENTS.md` or global `~/.config/opencode/AGENTS.md`.
