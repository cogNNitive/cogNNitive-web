---
level: 3
parent_spec:
  name: "procedures_V_0-3-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Upgrade a Workspace or Import a Legacy Domain Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

> There is no in-place migration of an old domain. A current domaiNN is upgraded (bluepriNNt versions); an old or broken domain is replaced by a new domain that imports the old one as a Source. The skill `nn-upgrade` owns consent, backup and recovery; THIS procedure owns the step tables and the legacy detector.

# NN Work

## NN Work: Upgrade a Workspace or Import a Legacy Domain
step_type:: task
condition:: Adopted bluepriNNt versions available (`upgrade-available`) or a legacy domain detected (preflight verdict `legacy-layout`)
input:: [[Workspace Directory]]
output:: [[Validated Canonical Workspace]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Route by the preflight verdict. `upgrade-available` on a current domaiNN runs the bluepriNNt version upgrade (Back Up, Analyze Impact, Rehydrate and Validate). `legacy-layout`, or a domain that cannot be upgraded, runs Import Legacy Domain as Source. Nothing here rewrites or deletes a user domain's content.

## NN Work: Detect Legacy Layout
parent:: [[Upgrade a Workspace or Import a Legacy Domain]]
step_type:: task
next:: [[Import Legacy Domain as Source]]
condition:: Preflight reports `legacy-layout`
input:: [[Workspace Directory]]
output:: [[Legacy Detection Report]]
output_status:: verified
tool:: [[innfo-mcp]]
scope:: internal
Read-only detection. A domain is reported as legacy when any of these signals is present; the report lists the signals and writes nothing.

| Signal | Meaning |
|---|---|
| `workspace_NN.md` entrypoint | pre-domaiNN entrypoint |
| `models/` or `specs/templates/` folders | pre-kNNowledge / pre-bluepriNNts folders |
| `export/`, `sources/original/`, `sources/nn/`, `sources/export/` | retired layout folders (`sources/archive/` is never a signal) |
| legacy frontmatter keys (`template_version`, `template_name`, `models_dir`, `templates_dir`, `target_template`, `model_version`) | pre-rename keys |
| legacy L1/L0 `parent_spec` | specification parent below the current level |

## NN Work: Import Legacy Domain as Source
parent:: [[Upgrade a Workspace or Import a Legacy Domain]]
step_type:: task
condition:: Legacy domain detected, or a domain that cannot be upgraded
input:: [[Legacy Detection Report]]
output:: [[Validated Canonical Workspace]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Create a new domain and import the old one as a Source:
1. Run `node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <old-dir> --import-as-source --new-domain-dir <new-dir>`. The old tree is copied byte-identically under the new domain's `sources/`; the old directory is never modified.
2. Derive the new domain's content from that Source with agent changesets that cite it, then validate the new domain with `innfo-mcp`.

## NN Work: Back Up Before Upgrade
parent:: [[Upgrade a Workspace or Import a Legacy Domain]]
step_type:: task
next:: [[Analyze Upgrade Impact]]
condition:: Adopted bluepriNNt versions available and the user consented
input:: [[Workspace Directory]]
output:: [[Verified Backup]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Run `node skills/nn-upgrade/scripts/backup-workspace.js --workspace-dir <dir>`: a timestamped copy outside the workspace with a SHA-256 manifest. No write happens before this backup exists.

## NN Work: Analyze Upgrade Impact
parent:: [[Upgrade a Workspace or Import a Legacy Domain]]
step_type:: task
next:: [[Rehydrate and Validate]]
condition:: Backup verified
input:: [[Verified Backup]]
output:: [[Impact Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Diff the pinned and adopted schemas. Ask mapping questions only when the diff removes, renames, or re-types a definition in active use.

## NN Work: Rehydrate and Validate
parent:: [[Upgrade a Workspace or Import a Legacy Domain]]
step_type:: task
condition:: Impact analysis done
input:: [[Impact Report]]
output:: [[Validated Canonical Workspace]]
output_status:: verified
tool:: [[innfo-mcp]]
scope:: internal
Materialize the adopted bluepriNNts locally, repoint `parent_spec`, update `blueprint_name`, bump the version and re-validate with `innfo-mcp` (0 errors, 0 warnings). On validation failure, restore from the backup.

# NN Tools

## NN Tools: AI Agent
scope:: external
LLM coding agent or automation runner that runs the upgrade, reads the Source and proposes changesets.

## NN Tools: innfo-mcp
scope:: internal
Deterministic validation and AST engine wrapping `@cognnitive/innfo-core` to verify model conformance and detect legacy layouts.

# NN Artifact

## NN Artifact: Workspace Directory
type:: spec
format:: directory
Root directory of the domaiNN to upgrade or to detect as legacy.

## NN Artifact: Legacy Detection Report
type:: data
format:: json
Read-only list of legacy signals found in the domain.

## NN Artifact: Verified Backup
type:: data
format:: directory
Timestamped out-of-tree copy of the domain with a SHA-256 manifest.

## NN Artifact: Impact Report
type:: data
format:: markdown
Diff of the pinned and adopted bluepriNNt schemas and the mapping questions it raises.

## NN Artifact: Validated Canonical Workspace
type:: spec
format:: markdown
Domain whose manifest passes all integrity gates.
