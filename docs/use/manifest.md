---
title: "cogNNitive — Bootstrap manifest"
description: "Canonical agent-bootstrap manifest served raw (Jekyll-safe) for https://cognnitive.com/use."
channel: "stable"
agent-bootstrap:
  version: "2.0"
  entrypoint: "workspace_NN.md"
  skills:
    - name: nn-start
      repo: cogNNitive/cogNNitive
      path: skills/nn-start
      version: "V_3-4-0"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      description: Central system governance, setup, environment readiness gate (Preflight), and start router.
    - name: nn-trannsform
      repo: cogNNitive/cogNNitive
      path: skills/nn-trannsform
      version: "V_3-3-0"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      requires: [nn-innfo, nn-preflight]
      description: Ingest documents (PDF, DOCX, XLSX), transform using templates, and execute multi-step procedures (procedures_V_0-1-0_NN.md).
    - name: nn-innfo
      repo: cogNNitive/cogNNitive
      path: skills/nn-innfo
      version: "V_0-5-2"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      description: Author, edit, and validate iNNfo models with built-in step-by-step Model Creation Wizard.
      templates: [workspace]
      mcp:
        - name: innfo-mcp
          repo: cogNNitive/cogNNitive
          path: iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js
          version: "0.10.0"
          ref: "innfo-mcp-v0.10.0"
          commit: "ae1d8f03703ee00b1c5649b625813106eebba295"
          url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/ae1d8f03703ee00b1c5649b625813106eebba295/iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js
    - name: nn-preflight
      repo: cogNNitive/cogNNitive
      path: skills/nn-preflight
      version: "V_0-2-0"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      description: Environment readiness gate (Tier 1/Tier 2/Tier 3) and canonical skill-location reference.
    - name: nn-upgrade
      repo: cogNNitive/cogNNitive
      path: skills/nn-upgrade
      version: "V_0-1-0"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      requires: [nn-preflight]
      description: Guided, consent-gated migration of a workspace to the latest adopted iNNfo Level-2 templates.
    - name: nn-site-generator
      repo: cogNNitive/cogNNitive
      path: skills/nn-site-generator
      version: "V_0-2-0"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      description: Create or edit websites, add analytics, add contact forms.
    - name: nn-design-presets
      repo: cogNNitive/cogNNitive
      path: skills/nn-design-presets
      version: "V_1-3-0"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      description: cogNNitive visual design presets — palettes, typography, spacing.
    - name: nn-skills-lifecycle
      repo: cogNNitive/cogNNitive
      path: skills/nn-skills-lifecycle
      version: "V_1-2-0"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      requires: [nn-preflight]
      description: Audit, update, and maintain cogNNitive skills.
    - name: nn-video-script
      repo: cogNNitive/cogNNitive
      path: skills/nn-video-script
      version: "V_0-1-0"
      ref: "skills-v2.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      requires: [nn-innfo]
      description: Author, gate, and finalize VidGeNN (VUS) video scripts, asset pipeline, and thumbnails inside iNNfo Series.
  templates:
    - name: workspace
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/workspace_spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: projects
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/projects/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: procedures
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/procedures/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: organization
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/organization/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: business
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/business/spec_NN.md
      version: "V_0-2-5"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: business-model
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/business-model/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: analysis
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/analysis/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: innovation
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/innovation/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: blank
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/blank/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: documentation
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/documentation/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: metrics
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/metrics/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: repository
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/repository/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: video
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/video/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: sources
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/sources/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: artifacts
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/artifacts/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
    - name: design-presets
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/design-presets/spec_NN.md
      version: "V_0-2-1"
      ref: "templates-v0.15.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
  console-assets:
    - file: iNNfo/specs/templates/console/innfo-console.bundle.js
      version: "0.3.0"
      ref: "innfo-console-v0.3.0"
      commit: "7ce77dfc28b27b1d9465268044a75e70b8fcb774"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/7ce77dfc28b27b1d9465268044a75e70b8fcb774/iNNfo/specs/templates/console/innfo-console.bundle.js
  workflows:
    - id: model
      label: Create an iNNfo model
      description: Turn an idea, document, or dataset into a validated structured model.
      skill: nn-innfo
      template: workspace
    - id: transform
      label: Transform a document
      description: Normalize a PDF/DOCX/XLSX into clean Markdown, or export to HTML.
      skill: nn-trannsform
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
8. Attached SOP procedures (`procedures/`) and agent skills (`skills/`) declared in template frontmatter are dynamically discovered up to depth 10 via `list_template_procedures` and `list_template_skills`.
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
