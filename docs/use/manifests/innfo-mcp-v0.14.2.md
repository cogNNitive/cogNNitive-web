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
      version: "V_3-4-0"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      description: Primary Front Controller, ecosystem entry point, job loop menu ([s] Sources, [m] Models, [r] Review/Artifacts, [p] Procedures, [h] Help, [x] Cancel), system governance, and preflight readiness gate. Triggers: /nn, NN, nn, cognnitive, cognitive, start, router.
    - name: nn-trannsform
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-trannsform
      version: "V_3-4-2"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      requires: [nn-innfo, nn-preflight]
      description: Ingest documents (PDF, DOCX, XLSX), transform using blueprints, and execute multi-step procedures (procedures_V_0-1-0_NN.md).
    - name: nn-innfo
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-innfo
      version: "V_0-5-6"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      description: Author, edit, and validate iNNfo knowledge with built-in step-by-step Model Creation Wizard.
      blueprints: [domaiNN]
      mcp:
        - name: innfo-mcp
          repo: cogNNitive/cogNNitive-web
          path: iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js
          version: "0.14.2"
          ref: "innfo-mcp-v0.14.2"
          commit: "6f15a85e0ce4f9ecb01c8ae3d9ac57ee8c89774f"
          url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/6f15a85e0ce4f9ecb01c8ae3d9ac57ee8c89774f/iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js
    - name: nn-preflight
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-preflight
      version: "V_0-2-2"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      description: Environment readiness gate (Tier 1/Tier 2/Tier 3) and canonical skill-location reference.
    - name: nn-upgrade
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-upgrade
      version: "V_0-2-0"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      requires: [nn-preflight]
      description: Guided, consent-gated migration of a domaiNN to the latest adopted iNNfo Level-2 blueprints.
    - name: nn-site-generator
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-site-generator
      version: "V_0-2-0"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      description: Create or edit websites, add analytics, add contact forms.
    - name: nn-design-presets
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-design-presets
      version: "V_1-4-0"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      description: cogNNitive visual design presets — palettes, typography, spacing.
    - name: nn-skills-lifecycle
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-skills-lifecycle
      version: "V_1-2-1"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      requires: [nn-preflight]
      description: Audit, update, and maintain cogNNitive skills.
    - name: nn-video-script
      repo: cogNNitive/cogNNitive-web
      path: skills/nn-video-script
      version: "V_0-3-0"
      ref: "skills-v2.13.0"
      commit: "8daf94f0077ede141850d8808a678a182532cc8b"
      requires: [nn-innfo]
      description: Author, gate, and finalize cogNNitive-video (VUS) video scripts, asset pipeline, and thumbnails inside iNNfo Series.
  blueprints:
    - name: domaiNN
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: projects
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/projects/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: procedures
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/procedures/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: organization
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/organization/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: business
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/business/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: business-model
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/business-model/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: analysis
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/analysis/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: innovation
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/innovation/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: blank
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/blank/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: documentation
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/documentation/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: metrics
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/metrics/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: repository
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/repository/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: video
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/video/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: sources
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/sources/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: artifacts
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/artifacts/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: sidecar
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/sidecar/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: design-presets
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/design-presets/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
    - name: visual-catalog
      repo: cogNNitive/cogNNitive-web
      path: iNNfo/specs/bluepriNNts/visual-catalog/spec_NN.md
      version: "V_0-3-0"
      ref: "blueprints-v0.21.0"
      commit: "5f0fb68c60c2d6dacf97dfb1ba828333163ef5ff"
  console-assets:
    - file: iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js
      version: "0.9.0"
      ref: "innfo-console-v0.9.0"
      commit: "7d13b643df32393a40f3dffe42266c82c5c53d1e"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/7d13b643df32393a40f3dffe42266c82c5c53d1e/iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js
    - file: iNNfo/specs/bluepriNNts/console/artifact_shell.html
      version: "0.9.0"
      ref: "innfo-console-v0.9.0"
      commit: "7d13b643df32393a40f3dffe42266c82c5c53d1e"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/7d13b643df32393a40f3dffe42266c82c5c53d1e/iNNfo/specs/bluepriNNts/console/artifact_shell.html
    - file: scripts/export-console.mjs
      version: "0.9.0"
      ref: "innfo-console-v0.9.0"
      commit: "7d13b643df32393a40f3dffe42266c82c5c53d1e"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/7d13b643df32393a40f3dffe42266c82c5c53d1e/scripts/export-console.mjs
  workflows:
    - id: model
      label: Create an iNNfo model
      description: Turn an idea, document, or dataset into a validated structured model.
      skill: nn-innfo
      blueprint: domaiNN
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
