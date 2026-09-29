---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-1-0"
title: "Upgrade and Migrate Legacy Workspace Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Upgrade and Migrate Legacy Workspace
step_type:: task
parent:: -
next:: -
condition:: Legacy workspace detected with obsolete frontmatters, missing manifest, or deprecated syntax
input:: [[Legacy Workspace Directory]]
output:: [[Validated Unified Workspace]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Execute an in-place migration of a legacy iNNfo workspace to the v0.9.0 unified architecture, normalizing frontmatters, stripping obsolete index blocks in Level 3 models, rebinding canonical parent specs, and synthesizing a clean `workspace_NN.md` manifest with zero validation errors or warnings.

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
Recursively scan `models/`, `specs/`, `sources/`, `procedures/`, and `artifacts/` in the workspace. Read YAML frontmatters to identify model levels (L1, L2, L3), template references, version formats, and deprecated folder configurations.

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
1. Strip `# NN index` sections (which belong exclusively to Level 2 templates).
2. Convert text-type concept sections (e.g. `Workspace`) from heading elements (`## NN Workspace: ...`) to plain Markdown body prose.
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
next:: -
condition:: Models rebound and validated
input:: [[Rebound Validated Models]]
output:: [[Validated Unified Workspace]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Generate or update the root `workspace_NN.md` manifest:
1. Populate `# NN Workspace` with directory conventions and environment parameters.
2. Catalog all discovered models under `# NN Models`, specs under `# NN Specs`, templates under `# NN Templates`, and catalogs (`# NN Sources`, `# NN Procedures`, `# NN Artifacts`).
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
Parsed inventory of all files, frontmatters, versions, and template dependencies in the workspace.

## NN Artifact: Normalized Model Documents
type:: spec
format:: markdown
Collection of Level 3 Markdown models with standardized AST syntax and clean body sections.

## NN Artifact: Rebound Validated Models
type:: spec
format:: markdown
Models with canonical `parent_spec` references and resolved element uniqueness.

## NN Artifact: Validated Unified Workspace
type:: spec
format:: markdown
Complete v0.9.0-compliant workspace with synchronized `workspace_NN.md` manifest passing all integrity gates.
