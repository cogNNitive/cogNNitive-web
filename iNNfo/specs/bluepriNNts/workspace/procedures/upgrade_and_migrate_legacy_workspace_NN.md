---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-2-0"
title: "Upgrade and Migrate Legacy Workspace Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

> Layout maps version: `maps-V_0-1-0` (2026-10-07). When a new retired layout appears, version the maps below — `nn-upgrade` (the skill) does not change.

# NN Work

## NN Work: Upgrade and Migrate Legacy Workspace
step_type:: task
condition:: Legacy workspace detected (preflight verdict `legacy-layout`) or adopted bluepriNNt versions available (`upgrade-available`)
input:: [[Legacy Workspace Directory]]
output:: [[Validated Canonical Workspace]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Execute a consent-gated migration of a legacy iNNfo domaiNN to the canonical `domaiNN` / `kNNowledge` / `bluepriNNts` / `artifacts` layout, or a bluepriNNt version upgrade inside a canonical domaiNN. The skill `nn-upgrade` owns consent, backup, plan validation and recovery; THIS procedure owns the per-layout maps below.

## NN Work: Apply Layout Maps (maps-V_0-1-0)
parent:: [[Upgrade and Migrate Legacy Workspace]]
step_type:: task
next:: [[Rebind Parent Specs and Deduplicate Slugs]]
condition:: Migration initiated with a confirmed planHash
input:: [[Legacy Workspace Directory]]
output:: [[Mapped Workspace Tree]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Apply these retired-to-canonical mappings (the migrator `migrate-domain.js` implements them; this table is the source of truth when they diverge):

| Retired | Canonical | Notes |
|---|---|---|
| `models/` | `kNNowledge/` | model files move, citations rewritten |
| `specs/templates/` | `specs/bluepriNNts/` | local bluepriNNt specs move |
| `workspace_NN.md` | `domaiNN_NN.md` | entrypoint rename, `parent_spec.name` → `domaiNN` |
| `sources/nn/` mirror tree | co-located sidecars | mirror retired, sources cognitivized in place |
| `sources/original/` | `sources/import/` | single raw-import location |
| `sources/export/` | `artifacts/` | generated outputs live in `artifacts/` |
| `sources/archive/` citations | kept, flagged | archive prefixes are reported, never silently rewritten |
| `export/` | `artifacts/` | retired output root |
| legacy frontmatter keys (`template_version`, `template_name`, `models_dir`, `templates_dir`, `target_template`, `model_version`) | `blueprint_version`, `blueprint_name`, `knowledge_dir`, `blueprints_dir`, `target_blueprint`, `knowledge_version` | language migration, journaled |
| `parent_spec.name: "workspace"` | `parent_spec.name: "domaiNN"` | entrypoint identity (Issue #103 Bug 2) |

## NN Work: Scan Workspace and Discover Legacy Models
parent:: [[Upgrade and Migrate Legacy Workspace]]
step_type:: task
next:: [[Normalize AST and Clean Deprecated Syntax]]
condition:: Migration initiated
input:: [[Legacy Workspace Directory]]
output:: [[Workspace Discovery Inventory]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Recursively scan `kNNowledge/`, `sources/`, `procedures/`, and `artifacts/` in the workspace (plus any retired roots the Layout Maps name). Read YAML frontmatters to identify model levels, bluepriNNt references, version formats, and deprecated folder configurations.

## NN Work: Normalize AST and Clean Deprecated Syntax
parent:: [[Upgrade and Migrate Legacy Workspace]]
step_type:: task
next:: [[Rebind Parent Specs and Deduplicate Slugs]]
condition:: Discovery inventory completed
input:: [[Workspace Discovery Inventory]]
output:: [[Normalized Model Documents]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Iterate through discovered Level 3 models to:
1. Strip `# NN index` sections (which belong exclusively to Level 2 bluepriNNts).
2. Convert text-type concept sections from heading elements to plain Markdown body prose.
3. Normalize key-value syntax (`key:: value`).

## NN Work: Rebind Parent Specs and Deduplicate Slugs
parent:: [[Upgrade and Migrate Legacy Workspace]]
step_type:: task
next:: [[Synthesize Workspace Manifest and Validate]]
condition:: AST normalized
input:: [[Normalized Model Documents]]
output:: [[Rebound Validated Models]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Update `parent_spec.url` in each model to the canonical remote/monorepo URLs. Resolve duplicate element names and slug collisions across the model graph. Verify that all internal reference links point to valid existing models or sources.

## NN Work: Synthesize Workspace Manifest and Validate
parent:: [[Upgrade and Migrate Legacy Workspace]]
step_type:: task
condition:: Models rebound and validated
input:: [[Rebound Validated Models]]
output:: [[Validated Canonical Workspace]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Generate or update the root `domaiNN_NN.md` manifest:
1. Populate the domaiNN concept with directory conventions and environment parameters.
2. Catalog all discovered models, specs, bluepriNNts, and catalogs (`# NN Sources`, `# NN Procedures`, `# NN Artifacts`).
3. Run the strict validator (`validateFormatContent` / `innfo-mcp`) to ensure 0 errors and 0 warnings.

# NN Tools

## NN Tools: AI Agent
scope:: external
LLM coding agent or automation runner that parses Markdown AST, rewrites frontmatters, and synthesizes manifests.

## NN Tools: innfo-mcp
scope:: internal
Deterministic validation and AST engine wrapping `@cognnitive/innfo-core` to verify model conformance.

# NN Artifact

## NN Artifact: Legacy Workspace Directory
type:: spec
format:: directory
Root directory of the legacy workspace containing unmigrated models or outdated specifications.

## NN Artifact: Workspace Discovery Inventory
type:: data
format:: json
Parsed inventory of all files, frontmatters, versions, and bluepriNNt dependencies in the workspace.

## NN Artifact: Normalized Model Documents
type:: spec
format:: markdown
Collection of Level 3 Markdown models with standardized AST syntax and clean body sections.

## NN Artifact: Rebound Validated Models
type:: spec
format:: markdown
Models with canonical `parent_spec` references and resolved element uniqueness.

## NN Artifact: Validated Canonical Workspace
type:: spec
format:: markdown
Complete canonical-layout workspace with synchronized `domaiNN_NN.md` manifest passing all integrity gates.

## NN Artifact: Mapped Workspace Tree
type:: spec
format:: directory
Workspace tree after the Layout Maps were applied, before rebind and validation.
