---
title: "cogNNitive — Bootstrap manifest"
description: "Canonical agent-bootstrap manifest served raw (Jekyll-safe) for https://cognnitive.com/use."
channel: "stable"
agent-bootstrap:
  version: "1.0.0"
  entrypoint: "domaiNN_NN.md"
  skills:
    - name: nn
      repo: cogNNitive/cogNNitive-web
      path: skills/nn
      version: "V_3-4-3"
      ref: "skills-v2.32.0"
      commit: "2812ec74b4df13e539d1f73d3a49f271de851760"
      description: Primary Front Controller, ecosystem entry point, job loop menu ([s] Sources, [k] kNNowledge, [r] Review/Artifacts, [p] Procedures, [h] Help, [x] Cancel), system governance, and preflight readiness gate. Triggers: /nn, NN, nn, cognnitive, cognitive, start, router.
    - name: nn-sources
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-sources
      version: "V_3-5-5"
      ref: "skills-v2.32.0"
      commit: "2812ec74b4df13e539d1f73d3a49f271de851760"
      requires: [nn-innfo, nn-preflight]
      description: Ingest documents (PDF, DOCX, XLSX), normalize them into citable sources with mandatory sidecar provenance, and keep source lineage in sync.
    - name: nn-innfo
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-innfo
      version: "V_0-5-13"
      ref: "skills-v2.32.0"
      commit: "2812ec74b4df13e539d1f73d3a49f271de851760"
      description: Author, edit, and validate iNNfo kNNowledge with built-in step-by-step kNNowledge Creation Wizard.
      blueprints: [domaiNN]
      mcp:
        - name: nn-mcp
          repo: cogNNitive/cogNNitive-web
          path: iNNfo/packages/nn-mcp/bin/nn-mcp.bundle.js
          version: "0.32.0"
          ref: "nn-mcp-v0.32.0"
          commit: "4c4b964a49285770cd75c3bf2f70ad2239fb6580"
          url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/4c4b964a49285770cd75c3bf2f70ad2239fb6580/iNNfo/packages/nn-mcp/bin/nn-mcp.bundle.js
    - name: nn-preflight
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-preflight
      version: "V_0-2-5"
      ref: "skills-v2.32.0"
      commit: "2812ec74b4df13e539d1f73d3a49f271de851760"
      description: Environment readiness gate (Tier 1/Tier 2/Tier 3) and canonical skill-location reference.
    - name: nn-upgrade
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-upgrade
      version: "V_0-4-2"
      ref: "skills-v2.32.0"
      commit: "2812ec74b4df13e539d1f73d3a49f271de851760"
      requires: [nn-preflight]
      description: Guided, consent-gated migration of a domaiNN to the latest adopted iNNfo Level-2 blueprints.
    - name: nn-site-generator
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-site-generator
      version: "V_0-2-0"
      ref: "skills-v2.32.0"
      commit: "2812ec74b4df13e539d1f73d3a49f271de851760"
      description: Create or edit websites, add analytics, add contact forms.
    - name: nn-design-presets
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-design-presets
      version: "V_1-4-0"
      ref: "skills-v2.32.0"
      commit: "2812ec74b4df13e539d1f73d3a49f271de851760"
      description: cogNNitive visual design presets — palettes, typography, spacing.
    - name: nn-skills-lifecycle
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-skills-lifecycle
      version: "V_1-3-1"
      ref: "skills-v2.32.0"
      commit: "2812ec74b4df13e539d1f73d3a49f271de851760"
      requires: [nn-preflight]
      description: Audit, update, and maintain cogNNitive skills.
  blueprints:
    - name: domaiNN
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md
      version: "V_0-5-0"
      ref: "blueprints-v0.47.0"
      commit: "e652c28f9427e1e246af96cd4dc9e1b6a9ab20c1"
    - name: changes
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/changes/spec_NN.md
      version: "V_0-5-0"
      ref: "blueprints-v0.47.0"
      commit: "e652c28f9427e1e246af96cd4dc9e1b6a9ab20c1"
    - name: sidecar
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/sidecar/spec_NN.md
      version: "V_0-5-0"
      ref: "blueprints-v0.47.0"
      commit: "e652c28f9427e1e246af96cd4dc9e1b6a9ab20c1"
    - name: sources
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/sources/spec_NN.md
      version: "V_0-5-0"
      ref: "blueprints-v0.47.0"
      commit: "e652c28f9427e1e246af96cd4dc9e1b6a9ab20c1"
    - name: artifacts
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/artifacts/spec_NN.md
      version: "V_0-5-0"
      ref: "blueprints-v0.47.0"
      commit: "e652c28f9427e1e246af96cd4dc9e1b6a9ab20c1"
    - name: procedures
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/procedures/spec_NN.md
      version: "V_0-5-0"
      ref: "blueprints-v0.47.0"
      commit: "e652c28f9427e1e246af96cd4dc9e1b6a9ab20c1"
    - name: blank
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/blank/spec_NN.md
      version: "V_0-5-0"
      ref: "blueprints-v0.47.0"
      commit: "e652c28f9427e1e246af96cd4dc9e1b6a9ab20c1"
  console-assets:
    - file: iNNfo/specs/bluepriNNts/console/nn-console.bundle.js
      version: "0.30.0"
      ref: "nn-console-v0.30.0"
      commit: "c8a48a7cb8cc3ea0481b4fa61f696a547bc96288"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/c8a48a7cb8cc3ea0481b4fa61f696a547bc96288/iNNfo/specs/bluepriNNts/console/nn-console.bundle.js
    - file: iNNfo/specs/bluepriNNts/console/artifact_shell.html
      version: "0.30.0"
      ref: "nn-console-v0.30.0"
      commit: "c8a48a7cb8cc3ea0481b4fa61f696a547bc96288"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/c8a48a7cb8cc3ea0481b4fa61f696a547bc96288/iNNfo/specs/bluepriNNts/console/artifact_shell.html
    - file: scripts/export-console.mjs
      version: "0.30.0"
      ref: "nn-console-v0.30.0"
      commit: "c8a48a7cb8cc3ea0481b4fa61f696a547bc96288"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/c8a48a7cb8cc3ea0481b4fa61f696a547bc96288/scripts/export-console.mjs
    - file: scripts/console-views.mjs
      version: "0.30.0"
      ref: "nn-console-v0.30.0"
      commit: "c8a48a7cb8cc3ea0481b4fa61f696a547bc96288"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/c8a48a7cb8cc3ea0481b4fa61f696a547bc96288/scripts/console-views.mjs
    - file: iNNfo/specs/bluepriNNts/console/nn-ui.css
      version: "0.30.0"
      ref: "nn-console-v0.30.0"
      commit: "c8a48a7cb8cc3ea0481b4fa61f696a547bc96288"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/c8a48a7cb8cc3ea0481b4fa61f696a547bc96288/iNNfo/specs/bluepriNNts/console/nn-ui.css
    - file: iNNfo/specs/bluepriNNts/console/console-payload.generated.cjs
      version: "0.30.0"
      ref: "nn-console-v0.30.0"
      commit: "c8a48a7cb8cc3ea0481b4fa61f696a547bc96288"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/c8a48a7cb8cc3ea0481b4fa61f696a547bc96288/iNNfo/specs/bluepriNNts/console/console-payload.generated.cjs
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
   - **Global User Profile (Default/Recommended)**: `~/.agents/skills/`, `~/.agents/templates/`, and `~/.agents/mcp/` (on Windows: `%USERPROFILE%\.agents\`, on Linux/macOS: `$HOME/.agents/`).
   - **Local Workspace**: `./.agents/skills/`, `./specs/templates/`, and `./.agents/mcp/`.
3. Run the check: `node scripts/skills-manager.js status` from a cogNNitive checkout
   (or ask the agent to run it) to compare installed commits (recorded in
   `~/.agents/bootstrap-state.json`) against the pins.
4. Install missing skills with explicit consent:
   `node scripts/skills-manager.js install`.
5. If any skill is outdated, show the diff preview and ask before updating:
   `node scripts/skills-manager.js update`. Never silently update, and never report
   "installed and up to date" without having run the check.
6. For each skill that declares `mcp[]`, download the bundle `url` into `{target}/mcp/{name}.bundle.js` (default: `~/.agents/mcp/{name}.bundle.js`) and register it in your agent MCP config (e.g. `opencode.jsonc`, `antigravity.json`, or workspace config).
7. For each template declared in `templates:`, `innfo-mcp` resolves and hydrates versioned packages using 4-tier lookup:
   - Workspace Package Directory: `./specs/templates/<name>/<version>/`
   - Workspace Flat Fallback: `./templates/<name>_V_<version>_NN.md` or `./specs/`
   - Global User Cache: `~/.agents/templates/<name>/<version>/`
   - Installed Skills Directory: `~/.agents/skills/*/templates/<name>/<version>/`
   Hydration into workspace `./specs/templates/<name>/<version>/` is atomic and write-once immutable.
8. Attached SOP procedures (`procedures/`) and agent skills (`skills/`) declared in template frontmatter are dynamically discovered up to depth 10 via `list_blueprint_procedures` and `list_blueprint_skills`.
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
