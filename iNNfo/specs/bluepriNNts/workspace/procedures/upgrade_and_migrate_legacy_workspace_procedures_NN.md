---
level: 3
parent_spec:
  name: "procedures_V_0-7-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-5-0"
title: "Upgrade a Workspace or Import a Legacy Domain Procedure"
---

> There is no in-place migration of an old domain. A current domaiNN is upgraded (bluepriNNt versions); an old or broken domain is replaced by a new domain that imports the old one as a Source. The skill `nn-upgrade` owns consent, backup and recovery; THIS procedure owns the step tables and the legacy detector.

# NN Work

## NN Work: Upgrade a Workspace or Import a Legacy Domain
slug:: upgrade-a-workspace-or-import-a-legacy-domain
step_type:: task
condition:: Adopted bluepriNNt versions available (`upgrade-available`) or a legacy domain detected (preflight verdict `legacy-layout`)
input:: @workspace-directory
output:: @validated-canonical-workspace
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Route by the preflight verdict. `upgrade-available` on a current domaiNN runs the bluepriNNt version upgrade (Back Up, Analyze Impact, Rehydrate and Validate). `legacy-layout`, or a domain that cannot be upgraded, runs Import Legacy Domain as Source. Nothing here rewrites or deletes a user domain's content.

## NN Work: Route by the Preflight Verdict
slug:: route-by-the-preflight-verdict
parent:: @upgrade-a-workspace-or-import-a-legacy-domain
step_type:: decision
next:: [@back-up-before-upgrade, @detect-legacy-layout]
condition:: Preflight has reported a verdict for the domain
input:: @workspace-directory
tool:: @ai-agent
executor:: agent
decision:: Which verdict did preflight report? Answer upgrade-available for a current domaiNN whose adopted bluepriNNt versions are newer, or legacy-layout for a legacy domain or one that cannot be upgraded.
scope:: internal
`upgrade-available` runs the bluepriNNt version upgrade (Back Up, Analyze Impact, Rehydrate and Validate); `legacy-layout` runs Detect Legacy Layout and Import Legacy Domain as Source.

## NN Work: Detect Legacy Layout
slug:: detect-legacy-layout
parent:: @upgrade-a-workspace-or-import-a-legacy-domain
step_type:: task
next:: @import-legacy-domain-as-source
condition:: outcome == legacy-layout
input:: @workspace-directory
output:: @legacy-detection-report
output_status:: verified
tool:: @innfo-mcp
executor:: agent
scope:: internal
Entered when preflight reports `legacy-layout`. Read-only detection. A domain is reported as legacy when any of these signals is present; the report lists the signals and writes nothing.

| Signal | Meaning |
|---|---|
| `workspace_NN.md` entrypoint | pre-domaiNN entrypoint |
| `models/` or `specs/templates/` folders | pre-kNNowledge / pre-bluepriNNts folders |
| `export/`, `sources/original/`, `sources/nn/`, `sources/export/` | retired layout folders (`sources/archive/` is never a signal) |
| legacy frontmatter keys (`template_version`, `template_name`, `models_dir`, `templates_dir`, `target_template`, `model_version`) | pre-rename keys |
| legacy L1/L0 `parent_spec` | specification parent below the current level |

## NN Work: Import Legacy Domain as Source
slug:: import-legacy-domain-as-source
parent:: @upgrade-a-workspace-or-import-a-legacy-domain
step_type:: task
condition:: Legacy domain detected, or a domain that cannot be upgraded
input:: @legacy-detection-report
output:: @validated-canonical-workspace
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Create a new domain and import the old one as a Source:
1. Run `node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <old-dir> --import-as-source --new-domain-dir <new-dir>`. The old tree is copied byte-identically under the new domain's `sources/`; the old directory is never modified.
2. Derive the new domain's content from that Source with agent changesets that cite it, then validate the new domain with `innfo-mcp`.

## NN Work: Back Up Before Upgrade
slug:: back-up-before-upgrade
parent:: @upgrade-a-workspace-or-import-a-legacy-domain
step_type:: task
next:: @analyze-upgrade-impact
condition:: outcome == upgrade-available
input:: @workspace-directory
output:: @verified-backup
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Entered when adopted bluepriNNt versions are available; the user must have consented before anything is written. Run `node skills/nn-upgrade/scripts/backup-workspace.js --workspace-dir <dir>`: a timestamped copy outside the workspace with a SHA-256 manifest. No write happens before this backup exists.

## NN Work: Analyze Upgrade Impact
slug:: analyze-upgrade-impact
parent:: @upgrade-a-workspace-or-import-a-legacy-domain
step_type:: task
next:: @rehydrate-and-validate
condition:: Backup verified
input:: @verified-backup
output:: @impact-report
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Diff the pinned and adopted schemas. Ask mapping questions only when the diff removes, renames, or re-types a definition in active use.

## NN Work: Rehydrate and Validate
slug:: rehydrate-and-validate
parent:: @upgrade-a-workspace-or-import-a-legacy-domain
step_type:: decision
next:: [@confirm-validated-workspace, @restore-from-backup]
condition:: Impact analysis done
input:: @impact-report
tool:: @innfo-mcp
executor:: agent
decision:: Did the rehydrated domaiNN pass validation with 0 errors and 0 warnings? Answer valid, or invalid when the failure cannot be corrected in this step.
scope:: internal
Materialize the adopted bluepriNNts locally, repoint `parent_spec`, update `blueprint_name`, bump the version and re-validate with `innfo-mcp` (0 errors, 0 warnings). Record the outcome `valid` or `invalid`. On `invalid`, the run takes the restore path and the workspace is never recorded as validated.

## NN Work: Confirm Validated Workspace
slug:: confirm-validated-workspace
parent:: @upgrade-a-workspace-or-import-a-legacy-domain
step_type:: task
condition:: outcome == valid
input:: @verified-backup
output:: @validated-canonical-workspace
output_status:: verified
tool:: @innfo-mcp
executor:: agent
scope:: internal
Record the validated domaiNN as the run's output, with its path and revision, only after the validation of the previous step passed. Finish the run with outcome `completed`.

## NN Work: Restore From Backup
slug:: restore-from-backup
parent:: @upgrade-a-workspace-or-import-a-legacy-domain
step_type:: task
condition:: outcome == invalid
input:: @verified-backup
tool:: @ai-agent
executor:: agent
scope:: internal
Restore the domaiNN from the verified backup, confirm that the restored tree matches the backup's SHA-256 manifest, record the validation findings and finish with outcome `failed`. Do not mark the workspace validated.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
scope:: external
LLM coding agent or automation runner that runs the upgrade, reads the Source and proposes changesets.

## NN Tools: innfo-mcp
slug:: innfo-mcp
scope:: internal
Deterministic validation and AST engine wrapping `@cognnitive/innfo-core` to verify model conformance and detect legacy layouts.

# NN Artifact

## NN Artifact: Workspace Directory
slug:: workspace-directory
type:: spec
format:: directory
Root directory of the domaiNN to upgrade or to detect as legacy.

## NN Artifact: Legacy Detection Report
slug:: legacy-detection-report
required:: false
type:: data
format:: json
Read-only list of legacy signals found in the domain.

## NN Artifact: Verified Backup
slug:: verified-backup
type:: data
format:: directory
Timestamped out-of-tree copy of the domain with a SHA-256 manifest.

## NN Artifact: Impact Report
slug:: impact-report
required:: false
type:: data
format:: markdown
Diff of the pinned and adopted bluepriNNt schemas and the mapping questions it raises.

## NN Artifact: Validated Canonical Workspace
slug:: validated-canonical-workspace
type:: spec
format:: markdown
Domain whose manifest passes all integrity gates.
