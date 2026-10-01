---
name: nn-preflight
description: Environment readiness and integrity gate for cogNNitive workflows. Runs Tier 1 checks (Node.js >= 18, innfo-mcp availability, workspace layout, source integrity audit across sources/import/, sources/conversations/, sources/export/) and optional Tier 2 checks (iNNfo output workspace structure, semantic link validation), plus a Tier 3 workspace template upgrade scan (catalog-backed, read-only, non-blocking). Then reports blockers/warnings/ok. Also provides the canonical skill-location reference used by nn-skills-lifecycle. Triggers: preflight, readiness, environment check, "run Tier 1".
version: "V_0-2-1"
last_updated: 2026-09-06
metadata:
  source_type: original
license: MIT
compatibility: opencode, claude-code, cursor, any agent supporting skills
bundled_blueprints: []
---

# nn-preflight

## Canonical Activation Gate Protocol (MANDATORY)

Every cogNNitive skill MUST execute this canonical activation gate before answering ANY user question or executing ANY task in the session.

### 1. Session Greeting Banner Protocol
When activated, the agent MUST print as its VERY FIRST output line:
```
🔧 You're using skill: <skill-name> (<emoji>)
```
*(Session-scoped: print once per conversation at the start of interaction).*

For `nn-preflight` itself, use:
```
🔧 You're using skill: nn-preflight (🛡️)
```

### 2. Deterministic Integrity Runner
Execute the deterministic preflight check:
```bash
node scripts/preflight-check.js
```
*(Fallback path: `node ~/.agents/skills/nn-preflight/scripts/preflight-check.js` or `node skills/nn-preflight/scripts/preflight-check.js`).*

### 3. Exit Code Handling & Consent Gate
Handle the runner process exit code deterministically:

- **Exit code `0` (Success)**: All ecosystem components are installed and up-to-date. Proceed immediately with the skill's intended workflow or menu without user interruption.
- **Exit code `1` (Warnings / Outdated Components / Unnormalized Sources)**: Updates, missing components, or unnormalized/dangling sources were detected.
  **HALT immediately.** Display the report of outdated/missing components or source integrity warnings and prompt the user for confirmation:
  ```markdown
  ⚠️ Updates or missing components were detected in the cogNNitive ecosystem:
  [a] (Recommended) Update components now
  [b] Continue with current version
  ```
  **Consent is mandatory**: Do NOT mutate files or update without explicit user consent. If the user selects `[b]`, proceed with the current version.
- **Exit code `2` (Runtime Blocker)**: Halt and abort execution immediately. Inform the user that Node.js >= 18 is required.

---

## Consumer Skill Delegation

All consumer skills (`nn`, `nn-innfo`, `nn-trannsform`, `nn-site-generator`, `nn-skills-lifecycle`, `nn-design-presets`) MUST delegate their activation gate in §0 to this canonical protocol using exactly:

```markdown
## 0. Activation Gate
Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check).
```

Consumer skills MUST NOT duplicate script execution commands, file paths, or exit code conditional branching logic.

---

## Role

Environment readiness gate for cogNNitive workflows. Runs deterministic checks and reports blockers, warnings, and confirmations. Never fabricates a pass for a check that was not run.

---

## Tier 1 Checks (always run)

1. **Preflight & Integrity Runner**: run `node scripts/preflight-check.js` (or `node ~/.agents/skills/nn-preflight/scripts/preflight-check.js`). When `--workspace-dir <dir>` is passed, audits workspace spec freshness and executes the Universal Source Integrity Audit across `sources/import/`, `sources/conversations/`, and `sources/export/` (with legacy `sources/original/` fallback) against `sources/nn/`. Verifies Node.js >= 18, manifest reachability, installed skills vs pinned commits, MCP bundle availability, skill dependencies (`node_modules`), and templates. If exit code is `1`, report outdated/missing components or unnormalized/dangling sources and prompt for confirmation per the Canonical Activation Gate protocol.
2. **Node.js**: require >= 18.
3. **innfo-mcp availability**: call `innfo-mcp_list_knowledge`; if the MCP tool is unavailable, fall back to checking that the bundle exists at `~/.agents/mcp/innfo-mcp.bundle.js` or `.cogNNitive/mcp-bundle.js`.
4. **Skill Dependencies Integrity**: verify installed skills containing `package.json` have `node_modules` present and resolvable.
5. **Workspace layout**: verify the expected directories exist — `sources/` (`sources/import/`, `sources/conversations/`, `sources/export/`, `sources/nn/`), `conversations/`, `export/`, `models/`, `procedures/`, `index.md` (legacy workspaces using `sources/original/` and `artifacts/` are supported via backward-compatible fallbacks).

## Tier 2 Checks (optional — only for iNNfo output workflows)

6. **iNNfo output workspace structure**: for Level 3 model workflows, verify `models/` holds `*_NN.md` files (note that `list_knowledge` recursively scans both the workspace root and the `models/` subdirectory to find all models) and that `index.md` exists with `# NN index` as the entry point.
7. **Semantic link validation (sources)**: parse all Level 3 model files and verify that every file path listed in the `sources:: [...]` metadata array exists physically in the workspace. Report any missing or dangling sources as warnings.
8. **Workspace Source Integrity Audit (`scanWorkspaceSources`)**: when `--workspace-dir` is provided:
   - Discovers files across `sources/import/`, `sources/conversations/`, and `sources/export/` (or legacy `sources/original/`).
   - Pairs raw media binaries (`.mp3`, `.wav`, etc.) sharing the same stem with text companions via `media_file` without flagging them as unnormalized. Standalone media is classified as informational `raw-media` (pending transcription) and does not flip the exit code to warning.
   - Recognizes in-line user sources (`inline:` or `chat:`) and does not flag them as dangling.
   - Verifies that every text source has an up-to-date normalized counterpart in `sources/nn/` matching its content SHA-256 hash. Any unnormalized or stale source is reported as an actionable warning recommending `node skills/nn-trannsform/scripts/index.js --scan`. Emits structured `sources_integrity` payload in `--json` mode.

## Tier 3 Checks (workspace template upgrades — informational)

8. **Workspace template upgrade detection (`scanWorkspaceUpgrades` via `scripts/upgrade-check.js`)**: when `--workspace-dir` is provided and the workspace contains Level-3 models, fetches the committed Level-2 template catalog (`iNNfo/specs/templates/catalog.json`, override with `--template-catalog-url`) and classifies each model's pinned `parent_spec` template against the catalog's `adopted` version — `current`, `upgrade-available` (with `major`/`minor`/`patch` gap), `ahead`, or `unlisted`. Available upgrades are **informational**: they are reported as `template-upgrade` items with `summary.templateUpgrades*` counts and NEVER flip the exit code to a blocker. If the catalog is unreachable, the scan degrades to a non-blocking `offline` notice (`summary.templateCatalogOffline`). Emits `template-upgrade` items in `--json` mode. Migration is handled by the `nn-upgrade` skill, never by preflight.

---

## Report Format

Present exactly three sections, each a bullet list, followed by the language preference footer:

```markdown
## Blockers
- <blocker, if any>

## Warnings
- <warning, if any>

## OK
- <check that passed>

> 💬 **Idioma actual / Current Language**: English. Si preferís interactuar en otro idioma o cambiarlo, escribí *"habla en español"* (o tu idioma preferido) en cualquier momento. / If you prefer another language, type *"habla en español"* or your language of choice.
```

- A check that was not run MUST NOT be listed as OK.
- If a blocker exists, the invoking skill asks the user before continuing.

---

## Reference

`reference/skill-locations.md` — canonical locations of installed skills and MCP bundles, plus a manual-only PowerShell reference for Junction/Symlink detection and creation (not used by any automated flow). `nn-skills-lifecycle`'s automated install/update/sync comes from the bootstrap manifest instead — see its own SKILL.md. Consuming skills MUST NOT hardcode paths.

---

## Core Rules

1. **Never fabricate a pass**: a check that was not executed is reported as a warning, never as OK.
2. **Consent first**: never mutate the environment during a preflight; it only inspects and reports.
3. **Canonical reference**: path and link conventions live in `reference/skill-locations.md` — update them there, not in consuming skills.
4. **Windows Network Resilience**: Do NOT execute bare `curl` in PowerShell (which aliases to `Invoke-WebRequest` and fails SSL handshakes). Use `curl.exe` explicitly, Node.js native fetch (`node -e "fetch(...)"`), or git.
5. **Zero Workspace Pollution**: Temporary checkouts or network cache files MUST be written to system temp (`$env:TEMP` / `~/.agents/tmp/`) and deleted immediately after use. Never clone git repositories into the user's workspace root.

