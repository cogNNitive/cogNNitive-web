---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/workspace_spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
title: "Workspace Specification App"
template_version: "V_0-5-1"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Workspace]]
* [[Models]]
* [[Templates]]
* [[Specs]]
* [[Sources]]
* [[Procedures]]
* [[Executions]]
* [[Artifacts]]
* [[Skills]]
* [[Tools]]
* [[Tags]]

# NN Concept Definition

## NN Concept Definition: Workspace
icon:: layout-dashboard
type:: text
color:: grey
weight:: 100

## NN Concept Definition: Models
icon:: file-symlink
type:: model
color:: purple
weight:: 95

## NN Concept Definition: Templates
icon:: copy
type:: model
color:: grey
weight:: 90

## NN Concept Definition: Specs
icon:: book-open
type:: model
color:: grey
weight:: 85

## NN Concept Definition: Sources
icon:: file-input
type:: model
color:: grey
weight:: 80

## NN Concept Definition: Procedures
icon:: workflow
type:: model
color:: grey
weight:: 75

## NN Concept Definition: Executions
icon:: terminal
type:: list
color:: grey
weight:: 72

## NN Concept Definition: Artifacts
icon:: file-output
type:: model
color:: grey
weight:: 70

## NN Concept Definition: Skills
icon:: bot
type:: list
color:: grey
weight:: 65

## NN Concept Definition: Tools
icon:: wrench
type:: list
color:: grey
weight:: 60

## NN Concept Definition: Tags
icon:: tag
type:: category
color:: grey
weight:: 50

# NN Field Definition

<!-- Workspace fields: conventions & global config -->

## NN Field Definition: name
concept:: Workspace
type:: string
description:: Display name or title of the workspace.

## NN Field Definition: environment
concept:: Workspace
type:: select
options:: [development, staging, production]
description:: Execution context of the workspace.

## NN Field Definition: models_dir
concept:: Workspace
type:: string
description:: Base relative path for domain models in the workspace (default: models/).

## NN Field Definition: sources_dir
concept:: Workspace
type:: string
description:: Base relative path for normalized sources in the workspace (default: sources/nn/).

## NN Field Definition: templates_dir
concept:: Workspace
type:: string
description:: Base relative path for template packages in the workspace (default: templates/).

## NN Field Definition: skills_dir
concept:: Workspace
type:: string
description:: Base relative path for agent skills in the workspace (default: skills/).

<!-- Specs fields -->

## NN Field Definition: path
concept:: Specs
type:: model
description:: Workspace-relative path to the formal specification document (e.g. specs/iNNfo_V_0-2-1_NN.md).

## NN Field Definition: level
concept:: Specs
type:: select
options:: [0, 1, 2]
description:: Abstraction level of the spec (0=primitive meta-meta, 1=meta-template, 2=template spec).

<!-- Templates fields -->

## NN Field Definition: path
concept:: Templates
type:: model
description:: Workspace-relative path to the template spec_NN.md file (e.g. templates/business/spec_NN.md).

## NN Field Definition: category
concept:: Templates
type:: string
description:: Domain classification or strategic focus of the template.

<!-- Models fields: inventory + provenance -->

## NN Field Definition: path
concept:: Models
type:: model
description:: Workspace-relative path to the referenced model file.

## NN Field Definition: template
concept:: Models
type:: string
description:: The level-2 template the referenced model conforms to.

## NN Field Definition: status
concept:: Models
type:: select
options:: [draft, active, archived]
description:: Lifecycle status of the model within this workspace.

## NN Field Definition: author
concept:: Models
type:: string
description:: Author or owner of the model within this workspace (workspace-scoped; not stored in the model file).

## NN Field Definition: derived_from
concept:: Models
type:: reference
target_concepts:: [Sources]
description:: The Sources this model was derived from (PROV wasDerivedFrom).

## NN Field Definition: generated_by
concept:: Models
type:: reference
target_concepts:: [Procedures]
description:: The Procedure run that produced this model (PROV wasGeneratedBy).

<!-- Sources fields: link to sources catalog model -->

## NN Field Definition: path
concept:: Sources
type:: model
description:: Workspace-relative path to the sources catalog model document (e.g. sources_NN.md).

<!-- Procedures fields: link to procedures catalog model -->

## NN Field Definition: path
concept:: Procedures
type:: model
description:: Workspace-relative path to the procedures catalog model document (e.g. procedures_NN.md).

<!-- Executions fields: pipeline execution traces and provenance runs -->

## NN Field Definition: command
concept:: Executions
type:: string
description:: CLI command or transformation executed.

## NN Field Definition: flags
concept:: Executions
type:: string
description:: Command-line flags and parameters passed to the execution.

## NN Field Definition: run_at
concept:: Executions
type:: string
description:: ISO 8601 timestamp when the execution was completed.

## NN Field Definition: inputs
concept:: Executions
type:: string
description:: Input files or sources consumed during the execution.

## NN Field Definition: outputs
concept:: Executions
type:: string
description:: Output models or deliverables produced during the execution.

<!-- Artifacts fields: link to artifacts catalog model -->

## NN Field Definition: path
concept:: Artifacts
type:: model
description:: Workspace-relative path to the artifacts catalog model document (e.g. artifacts_NN.md).

<!-- Skills fields: link to AI agent skills -->

## NN Field Definition: path
concept:: Skills
type:: file
description:: Relative path to the agent SKILL.md file.

## NN Field Definition: role
concept:: Skills
type:: string
description:: Operational role and specialization of the skill agent.

## NN Field Definition: target_agents
concept:: Skills
type:: string
description:: Compatible agent platforms (e.g. Antigravity, Claude Code, OpenCode).

<!-- Tools fields: link to executable tools and scripts -->

## NN Field Definition: path
concept:: Tools
type:: file
description:: Relative path to the executable tool script or CLI runner.

## NN Field Definition: runtime
concept:: Tools
type:: select
options:: [node, python, bash, powershell]
description:: Execution runtime required for this tool.

<!-- Tags fields -->

## NN Field Definition: color
concept:: Tags
type:: string
description:: Hex color code (e.g. #10b981) or CSS token for tag badges and highlights.

## NN Field Definition: icon
concept:: Tags
type:: string
description:: Icon identifier (e.g. Lucide icon name) displayed with the tag badge.

## NN Field Definition: description
concept:: Tags
type:: string
description:: Semantic description, strategic intent, or scope of the tag.

# NN Marker Definition

## NN Marker Definition: verified
applies_to:: [Element]
symbol:: >
icon:: shield-check
color:: green

# Workspace Specification Template

## A level-2 unified template for the workspace root manifest — linking domain models, specs, templates, sources, procedures, artifacts, skills, tools, and taxonomy tags

## Philosophy

A workspace manifest is the single source of truth for workspace topology, execution context, and data lineage:
* **Workspace** sets directory conventions and environment parameters (`models_dir`, `sources_dir`, `templates_dir`, `skills_dir`).
* **Models** links to domain model files with metadata and derivation edges.
* **Templates** links to available template packages via `type:: model`.
* **Specs** links to formal grammar specifications via `type:: model`.
* **Sources** links to `sources_NN.md` catalog via `type:: model`.
* **Procedures** links to `procedures_NN.md` catalog via `type:: model`.
* **Executions** logs append-only execution history and provenance traces via `type:: list`.
* **Artifacts** links to `artifacts_NN.md` catalog via `type:: model`.
* **Skills** links to agent capability definitions (`SKILL.md`) via `type:: file`.
* **Tools** links to executable maintenance scripts via `type:: file`.
* **Tags** provides a centralized taxonomy catalog (`color`, `icon`, `description`) used across the workspace.

## Specification

### Concepts

| Concept | Type | PROV Role | Purpose |
|---|---|---|---|
| **Workspace** | text | — | Prose description and configuration parameters of the workspace |
| **Models** | model | Entity | Domain model files in the workspace with metadata and derivation |
| **Templates** | model | Plan | Level 2 domain templates available for instantiation |
| **Specs** | model | Plan | Formal language specifications (Level 0 / Level 1) |
| **Sources** | model | Entity | Link to the Sources catalog model |
| **Procedures** | model | Plan | Link to the Procedures catalog model |
| **Executions** | list | Activity | Append-only pipeline execution runs, traces, and provenance history |
| **Artifacts** | model | Entity | Link to the Artifacts catalog model |
| **Skills** | file | Agent | Link to standard agent SKILL.md files |
| **Tools** | file | Agent | Link to executable tool scripts and runners |
| **Tags** | category | — | Centralized taxonomy tags with color, icon, and description |

## Workspace

### Summary
Root configuration and narrative overview of the workspace container.

### Description
The Workspace concept holds environment settings, directory layout paths, and executive summary notes. It acts as the anchor root for tree navigation and tool resolution across the entire repository.

### Methodologies
- Single source of truth (SSOT) directory anchoring.
- Convention over configuration for folder structures.

### Prompts
- "Configure workspace directory conventions and environment targets."
- "Describe the operational scope and purpose of this workspace."

## Models

### Summary
Inventory of domain models (Level 3) belonging to the workspace.

### Description
Lists all active, draft, or archived domain model documents in `models/`, tracking author attribution, template conformance, and PROV derivation lineage.

### Methodologies
- Entity lifecycle tracking (`draft`, `active`, `archived`).
- W3C PROV-DM derivation linking to primary Sources and generating Procedures.

### Prompts
- "Scan and catalog all domain models under models/ with their template bindings."

## Templates

### Summary
Catalog of domain templates (Level 2) available for model authoring.

### Description
Links to Level 2 domain templates (such as Business Model, Procedures, Organization, or custom specializations) installed or referenced in the workspace.

### Methodologies
- Template composition and inheritance.
- Local override and specialization hierarchy.

### Prompts
- "List available Level 2 domain templates and their category bindings."

## Specs

### Summary
Inventory of formal language grammar specifications (Level 0 / Level 1).

### Description
Declares the foundational formal grammars and metaplantillas referenced by templates and models within this workspace (e.g. `iNNfo_V_0-2-1_NN.md`).

### Methodologies
- Strict semantic versioning for grammar evolution.
- Backward compatibility verification.

### Prompts
- "Register formal language specifications in the workspace manifest."

## Sources

### Summary
Primary input catalog linking raw evidence and normalized sources.

### Description
Points to the workspace Sources Catalog model (`sources_NN.md`), establishing immutable provenance links to business documents, contracts, CSVs, and scans.

### Methodologies
- Immutable primary sources with SHA-256 provenance hashes.
- Two-tier storage (`sources/original/` and `sources/nn/`).

### Prompts
- "Bind sources catalog to workspace and verify document lineage."

## Procedures

### Summary
Executable procedures catalog for workflows, transformations, and migrations.

### Description
Points to `procedures_NN.md` containing executable transformation workflows, automated pipeline steps, and the **Workspace In-Place Migration & Upgrade Procedure**.

### Methodologies
- **Workspace In-Place Migration & Upgrade Procedure**:
  1. *Discovery*: Scan `models/`, `specs/`, `sources/`, `procedures/` for legacy frontmatters.
  2. *Normalization*: Strip invalid `# NN index` from Level 3 models, format text concepts without headings, deduplicate slugs.
  3. *Re-binding*: Point `parent_spec` to canonical unified URLs and bind local templates.
  4. *Synthesis & Validation*: Regenerate `workspace_NN.md` manifest and validate with 0 errors/warnings.

### Prompts
- "Execute Workspace In-Place Migration & Upgrade procedure on legacy workspace."
- "Inspect executable procedures in procedures_NN.md."

## Executions

### Summary
Append-only journal of automated pipeline and CLI execution traces.

### Description
Records immutable execution history entries produced by pipeline runs and maintenance commands (`scan`, `import-url`, `apply`), documenting commands, timestamps, inputs, and outputs for complete auditability.

### Methodologies
- Append-only provenance logging.
- W3C PROV-DM execution event attribution.

### Prompts
- "Review workspace pipeline execution history."

## Artifacts

### Summary
Catalog of synthesized outputs, projections, and reports.

### Description
Points to `artifacts_NN.md`, tracking generated reports, calculations, visual charts, and exports derived from domain models.

### Methodologies
- Derived artifact tracking with input lineage.
- Multi-format publishing (HTML, Markdown, PDF).

### Prompts
- "Register synthesized outputs and deliverables in artifacts catalog."

## Skills

### Summary
AI agent capabilities and persona definitions available in the workspace.

### Description
Links to agent `SKILL.md` definitions that provide specialized conversational wizards, linters, and transformation agents.

### Methodologies
- Agent skill discovery and progressive prompt loading.

### Prompts
- "List agent skills installed in the workspace."

## Tools

### Summary
Executable CLI tools, scripts, and runtime utilities.

### Description
Links to Node.js, Python, or shell automation scripts used for workspace hygiene, builds, and integrity checks.

### Methodologies
- Automated test and integrity gating.

### Prompts
- "Register maintenance scripts and runtime utilities in workspace."

## Tags

### Summary
Taxonomy category definitions with visual branding and color tokens.

### Description
Declares workspace-wide taxonomy tags, hex colors, and icon identifiers used to classify and filter concepts and elements.

### Methodologies
- Semantic color assignment and icon consistency.

### Prompts
- "Define domain tags with semantic colors and icons."

## Template

### Level 3 Model Template (Lightweight)

```yaml
---
level: 3
parent_spec:
  name: "workspace"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/workspace_spec_NN.md"
model_version: "V_0-1-0"
title: "<Workspace Name>"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Workspace

Description of the workspace: its purpose, scope, and conventions.

# NN Models

## NN Models: Core Business Model
path:: models/business_NN.md
template:: business
status:: active
author:: Lead Architect

# NN Templates

## NN Templates: Business Model Template
path:: templates/business/spec_NN.md
category:: Strategy

# NN Specs

## NN Specs: iNNfo Metaplantilla N1
path:: specs/iNNfo_V_0-2-1_NN.md
level:: 1

# NN Sources

## NN Sources: Sources Catalog
path:: sources_NN.md

# NN Procedures

## NN Procedures: Procedures Catalog
path:: procedures_NN.md

# NN Executions

## NN Executions: scan @ 2026-09-24T12:00:00.000Z
command:: scan
run_at:: 2026-09-24T12:00:00.000Z

# NN Artifacts

## NN Artifacts: Artifacts Catalog
path:: artifacts_NN.md

# NN Skills

## NN Skills: Model Creation Wizard
path:: skills/nn-innfo/SKILL.md
role:: Conversational Architecture Coach

# NN Tools

## NN Tools: Integrity Checker
path:: tools/check_integrity.mjs
runtime:: node

# NN Tags

## NN Tags: Strategic
color:: #3b82f6
icon:: target
description:: High-level strategic models.
```
