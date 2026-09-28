/**
 * Canonical Template Registry & Offline Fallback Table.
 *
 * Provides bundled Level 2 templates and canonical alias mappings
 * ensuring CLI tools, MCP operations, and test suites operate with
 * offline resilience and zero workspace pollution when network or local
 * lookups fail.
 */

export interface CanonicalTemplate {
  name: string
  version: string
  aliases: string[]
  specContent: string
}

const INNFO_SPEC_CONTENT = `---
spec_version: "V_0-2-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-0_NN.md"
level: 1
parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNe_V_0-1-0_NN.md"
title: "iNNfo Meta-template Specification"
description: "Level-1 meta-template defining the four root primitives (Concept Definition, Field Definition, Matrix Definition, Marker Definition) and the unified NN syntax: \`# NN\` sections, \`## NN\` elements, and \`key:: value\` properties."
author: "innV0 Team"
status: "Stable"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# iNNfo Meta-template Specification

# NN Concept Definition

## NN Concept Definition: Concept Definition
type:: list

## NN Concept Definition: Field Definition
type:: list

## NN Concept Definition: Marker Definition
type:: list

## NN Concept Definition: Matrix Definition
type:: list

# NN Field Definition

## NN Field Definition: type
concept:: Concept Definition
type:: select
options:: [text, category, weight, list, steps, sequence, model]
description:: Representation of the Concept (required).

## NN Field Definition: icon
concept:: Concept Definition
type:: string
description:: Lucide icon identifier.

## NN Field Definition: color
concept:: Concept Definition
type:: string
description:: Theme color.

## NN Field Definition: weight
concept:: Concept Definition
type:: string
description:: Display priority (higher = more prominent).

## NN Field Definition: concept
concept:: Field Definition
type:: string
description:: Name of the owning Concept Definition (required).

## NN Field Definition: type
concept:: Field Definition
type:: select
options:: [string, select, reference, markdown_inline, markdown_file, image, file, video, audio, url, model]
description:: Field type (required).

## NN Field Definition: options
concept:: Field Definition
type:: string
description:: Allowed values for select fields (inline array).

## NN Field Definition: target_concepts
concept:: Field Definition
type:: string
description:: Target concepts for reference fields (inline array).

## NN Field Definition: description
concept:: Field Definition
type:: string
description:: Human-readable explanation.

## NN Field Definition: target_template
concept:: Field Definition
type:: string
description:: Target template name or URL for model fields.

## NN Field Definition: applies_to
concept:: Marker Definition
type:: select
options:: [Element, Concept]
description:: Which entities may be scored on this Marker.

## NN Field Definition: values
concept:: Marker Definition
type:: string
description:: Allowed scores for this Marker (inline array).

## NN Field Definition: widget
concept:: Marker Definition
type:: select
options:: [boolean, cycle, scale, set, text]
description:: Cell interaction widget.

## NN Field Definition: widget_config
concept:: Marker Definition
type:: string
description:: Widget-specific configuration JSON.

## NN Field Definition: symbol
concept:: Marker Definition
type:: string
description:: Display symbol.

## NN Field Definition: icon
concept:: Marker Definition
type:: string
description:: Lucide icon identifier.

## NN Field Definition: color
concept:: Marker Definition
type:: string
description:: Theme color.

## NN Field Definition: weight
concept:: Marker Definition
type:: string
description:: Display priority.

## NN Field Definition: source
concept:: Matrix Definition
type:: string
description:: Source Concept (rows) — required.

## NN Field Definition: target
concept:: Matrix Definition
type:: string
description:: Target Concept or pseudo-Concept (columns) — required.

## NN Field Definition: values
concept:: Matrix Definition
type:: string
description:: Allowed cell values (inline array).

## NN Field Definition: widget
concept:: Matrix Definition
type:: select
options:: [boolean, cycle, scale, set, text]
description:: Cell interaction widget.

## NN Field Definition: widget_config
concept:: Matrix Definition
type:: string
description:: Widget-specific configuration JSON.

## NN Field Definition: description
concept:: Matrix Definition
type:: string
description:: Human-readable explanation.
`

const PROCEDURES_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Procedures App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
viewers:
  - id: "guided-procedure"
    view_type: "fsm-stepper"
    target_concept: "Work"
    label: "Guided Procedure Execution"
    icon: "play-circle"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Concept Definition

## NN Concept Definition: Procedure
icon:: workflow
type:: list
color:: teal
weight:: 110

## NN Concept Definition: Work
icon:: list-ordered
type:: list
color:: blue
weight:: 100

## NN Concept Definition: Artifact
icon:: package
type:: list
color:: orange
weight:: 80

## NN Concept Definition: Tools
icon:: wrench
type:: list
color:: orange
weight:: 70

## NN Concept Definition: Roles
icon:: users
type:: list
color:: green
weight:: 60

# NN Field Definition

## NN Field Definition: category
concept:: Procedure
type:: select
options:: [ingestion, transformation, audit, reporting, custom]

## NN Field Definition: summary
concept:: Procedure
type:: string

## NN Field Definition: inputs_required
concept:: Procedure
type:: string

## NN Field Definition: outputs_expected
concept:: Procedure
type:: string

## NN Field Definition: executed_by
concept:: Procedure
type:: string

## NN Field Definition: procedure_model
concept:: Procedure
type:: model

## NN Field Definition: step_type
concept:: Work
type:: select
options:: [task, decision, event]

## NN Field Definition: parent
concept:: Work
type:: reference
target_concepts:: [Work]

## NN Field Definition: next
concept:: Work
type:: reference
target_concepts:: [Work]

## NN Field Definition: condition
concept:: Work
type:: string

## NN Field Definition: input
concept:: Work
type:: reference
target_concepts:: [Artifact]

## NN Field Definition: output
concept:: Work
type:: reference
target_concepts:: [Artifact]

## NN Field Definition: output_status
concept:: Work
type:: string

## NN Field Definition: tool
concept:: Work
type:: reference
target_concepts:: [Tools]

## NN Field Definition: scope
concept:: Roles
type:: select
options:: [internal, external]

# NN Marker Definition

## NN Marker Definition: complexity
applies_to:: [Element, Concept]
icon:: gauge
color:: green
weight:: 50

# NN Matrix Definition

## NN Matrix Definition: work-roles matrix
source:: Work
target:: Roles
values:: [Responsible, Accountable, Consulted, Informed]

## NN Matrix Definition: work-tools matrix
source:: Work
target:: Tools
values:: [Uses]

## NN Matrix Definition: work-artifacts matrix
source:: Work
target:: Artifact
values:: [Creates, Modifies, Validates, Reviews]
`

const SOURCES_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/sources/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-1-0"
title: "Sources Catalog App"
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

* [[Source]]

# NN Concept Definition

## NN Concept Definition: Source
icon:: file-input
type:: list
color:: teal
weight:: 100

# NN Field Definition

## NN Field Definition: type
concept:: Source
type:: select
options:: [local_file, url_snapshot, dynamic_feed, git_repo, api_export]

## NN Field Definition: origin_uri
concept:: Source
type:: string

## NN Field Definition: format
concept:: Source
type:: select
options:: [pdf, docx, html, md, json, csv, audio, xlsx, repo]

## NN Field Definition: raw_path
concept:: Source
type:: string

## NN Field Definition: summary
concept:: Source
type:: string

## NN Field Definition: tags
concept:: Source
type:: string

## NN Field Definition: status
concept:: Source
type:: select
options:: [ready, stale, processing, error]

## NN Field Definition: source_model
concept:: Source
type:: model
`

const ARTIFACTS_SPEC_CONTENT = `---
spec_version: "V_0-2-2"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/artifacts/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md"
template_version: "V_0-2-0"
title: "Artifacts Catalog App"
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

* [[Artifact]]

# NN Concept Definition

## NN Concept Definition: Artifact
icon:: file-output
type:: list
color:: teal
weight:: 100

# NN Field Definition

## NN Field Definition: format
concept:: Artifact
type:: select
options:: [model, markdown, html, json, csv, binary]

## NN Field Definition: summary
concept:: Artifact
type:: string

## NN Field Definition: status
concept:: Artifact
type:: select
options:: [draft, verified, published, deprecated]

## NN Field Definition: tags
concept:: Artifact
type:: string

## NN Field Definition: produced_by
concept:: Artifact
type:: string

## NN Field Definition: sources
concept:: Artifact
type:: citation

## NN Field Definition: artifact_model
concept:: Artifact
type:: model

## NN Field Definition: file_path
concept:: Artifact
type:: string
`

const ORGANIZATION_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-2"
title: "Organization App"
procedures:
  - id: "audit-skill-gaps"
    name: "Audit Skill Gaps"
    path: "procedures/audit_skill_gaps_NN.md"
  - id: "export-team-directory"
    name: "Export Team Directory"
    path: "procedures/export_team_directory_NN.md"
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

* [[Organization]]
  * [[Roles]]
  * [[Functions]]
  * [[Position]]
  * [[Person]]
  * [[Skills]]

# NN Concept Definition

## NN Concept Definition: Organization
icon:: building-2
type:: text
color:: blue
weight:: 100

## NN Concept Definition: Roles
icon:: user-check
type:: list
color:: green
weight:: 60

## NN Concept Definition: Functions
icon:: workflow
type:: list
color:: purple
weight:: 55

## NN Concept Definition: Position
icon:: contact
type:: list
color:: teal
weight:: 50

## NN Concept Definition: Person
icon:: user
type:: list
color:: cyan
weight:: 40

## NN Concept Definition: Skills
icon:: award
type:: list
color:: indigo
weight:: 30

# NN Field Definition

## NN Field Definition: scope
concept:: Roles
type:: select
options:: [internal, external]

## NN Field Definition: position_ref
concept:: Person
type:: reference
target_concepts:: [Position]
description:: Reference to the Position held by the team member.

## NN Field Definition: compensation
concept:: Person
type:: string
description:: Compensation structure, salary, equity, or incentives.

## NN Field Definition: contributions
concept:: Person
type:: string
description:: Primary contributions, role dedication, and key deliverables.

## NN Field Definition: image
concept:: Person
type:: image
description:: Visual portrait or avatar representing the person.

# NN Marker Definition

## NN Marker Definition: complexity
applies_to:: [Element, Concept]
icon:: gauge
color:: green
weight:: 50

# NN Matrix Definition

## NN Matrix Definition: positions-roles matrix
source:: Position
target:: Roles
values:: [Assumes]
widget:: boolean

## NN Matrix Definition: persons-positions matrix
source:: Person
target:: Position
values:: [Occupies]
widget:: boolean

## NN Matrix Definition: Functions-Positions Matrix
source:: Functions
target:: Position
values:: [Assumes]
widget:: boolean
description:: Boolean assignment of which Position assumes responsibility for each Function.
`

const METRICS_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Metrics App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
procedures:
  - id: "create-timeline"
    name: "Create Timeline"
    path: "procedures/create_timeline_NN.md"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Metrics]]
* [[Variables]]
* [[Evolution]]
* [[Scenario]]

# NN Concept Definition

## NN Concept Definition: Metrics
icon:: bar-chart-3
type:: list
color:: blue
weight:: 100

## NN Concept Definition: Variables
icon:: settings-2
type:: list
color:: green
weight:: 80

## NN Concept Definition: Evolution
icon:: trending-up
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Scenario
icon:: layers
type:: list
color:: purple
weight:: 70

# NN Field Definition

## NN Field Definition: metricValue
concept:: Metrics
type:: string

## NN Field Definition: metricFormula
concept:: Metrics
type:: string

## NN Field Definition: dependsOn
concept:: Metrics
type:: reference
target_concepts:: [Metrics, Variables]

## NN Field Definition: metricType
concept:: Metrics
type:: select
options:: [result, revenue, expense, tax, investment]

## NN Field Definition: metricUnit
concept:: Metrics
type:: string

## NN Field Definition: varValue
concept:: Variables
type:: string

## NN Field Definition: varUnit
concept:: Variables
type:: string

## NN Field Definition: changePercent
concept:: Evolution
type:: string

## NN Field Definition: probability
concept:: Scenario
type:: string

# NN Marker Definition

## NN Marker Definition: is_variable
applies_to:: [Element]
icon:: variable
color:: green

## NN Marker Definition: is_formula
applies_to:: [Element]
icon:: calculator
color:: blue

## NN Marker Definition: is_derived
applies_to:: [Element]
icon:: git-branch
color:: orange

# NN Matrix Definition

## NN Matrix Definition: metrics-dependencies
source:: Metrics
target:: Metrics
values:: [Feeds]

## NN Matrix Definition: metric-variables
source:: Metrics
target:: Variables
values:: [Uses]

## NN Matrix Definition: scenario-metrics
source:: Scenario
target:: Metrics
values:: [Modifies]
`

const WORKSPACE_SPEC_CONTENT = `---
spec_version: "V_0-2-2"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/workspace_spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md"
title: "Workspace Specification App"
template_version: "V_0-6-0"
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

<!-- Models fields: inventory + lineage -->

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
`

const COGNNITIVE_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/cogNNitive/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-0"
title: "cogNNitive Template"
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

* [[Sources]]
* [[ModelRecords]]
* [[Artifacts]]
* [[Procedures]]

# NN Concept Definition

## NN Concept Definition: Sources
icon:: file-input
type:: list
color:: teal
weight:: 90

## NN Concept Definition: ModelRecords
icon:: boxes
type:: list
color:: teal
weight:: 80

## NN Concept Definition: Artifacts
icon:: file-output
type:: list
color:: teal
weight:: 80

## NN Concept Definition: Procedures
icon:: workflow
type:: list
color:: teal
weight:: 60

# NN Field Definition

## NN Field Definition: raw_filename
concept:: Sources
type:: string

## NN Field Definition: raw_hash
concept:: Sources
type:: string

## NN Field Definition: size
concept:: Sources
type:: string

## NN Field Definition: source_format
concept:: Sources
type:: select
options:: [txt, md, csv, json, docx, pdf, xlsx]

## NN Field Definition: normalized_at
concept:: Sources
type:: string

## NN Field Definition: normalized_by
concept:: Sources
type:: string

## NN Field Definition: normalized_content
concept:: Sources
type:: markdown_file

## NN Field Definition: raw_file
concept:: Sources
type:: file

## NN Field Definition: model_ref
concept:: ModelRecords
type:: string

## NN Field Definition: model_template
concept:: ModelRecords
type:: string

## NN Field Definition: model_version
concept:: ModelRecords
type:: string

## NN Field Definition: derived_from
concept:: ModelRecords
type:: reference
target_concepts:: [Sources]

## NN Field Definition: generated_by
concept:: ModelRecords
type:: reference
target_concepts:: [Procedures]

## NN Field Definition: artifact_format
concept:: Artifacts
type:: select
options:: [document, report, board, dataset]

## NN Field Definition: artifact_version
concept:: Artifacts
type:: string

## NN Field Definition: location
concept:: Artifacts
type:: string

## NN Field Definition: artifact_hash
concept:: Artifacts
type:: string

## NN Field Definition: derived_from_inputs
concept:: Artifacts
type:: reference
target_concepts:: [Sources, ModelRecords]

## NN Field Definition: produced_by
concept:: Artifacts
type:: reference
target_concepts:: [Procedures]

## NN Field Definition: procedure_ref
concept:: Procedures
type:: string

## NN Field Definition: agent
concept:: Procedures
type:: string

## NN Field Definition: run_at
concept:: Procedures
type:: string

# NN Marker Definition

## NN Marker Definition: verified
applies_to:: [Element]
symbol:: >
icon:: shield-check
color:: green

# NN Matrix Definition

## NN Matrix Definition: Artifact-Source Lineage
source:: Artifacts
target:: Sources
values:: [X]
widget:: boolean
`

const ANALYSIS_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/analysis/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Analysis App"
procedures:
  - id: "run-coherence-audit"
    name: "Run Coherence Audit"
    path: "procedures/run_coherence_audit_NN.md"
  - id: "prioritize-experiments"
    name: "Prioritize Experiments"
    path: "procedures/prioritize_experiments_NN.md"
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

* [[Analysis]]
  * [[Assumptions]]
  * [[Risks]]
  * [[Keys]]
  * [[Suggestions]]
* [[Validation]]
  * [[Coherence]]
  * [[Experiments]]

# NN Concept Definition

## NN Concept Definition: Analysis
icon:: microscope
type:: category
color:: red
weight:: 80

## NN Concept Definition: Assumptions
icon:: circle-help
type:: weight
color:: red
weight:: 50

## NN Concept Definition: Risks
icon:: shield-alert
type:: weight
color:: red
weight:: 90

## NN Concept Definition: Suggestions
icon:: messages-square
type:: weight
color:: red
weight:: 30

## NN Concept Definition: Keys
icon:: key-round
type:: weight
color:: red
weight:: 50

## NN Concept Definition: Validation
icon:: clipboard-check
type:: category
color:: green
weight:: 90

## NN Concept Definition: Coherence
icon:: link
type:: weight
color:: green
weight:: 25

## NN Concept Definition: Experiments
icon:: flask-conical
type:: weight
color:: green
weight:: 40

# NN Marker Definition

## NN Marker Definition: importance
applies_to:: [Element]
icon:: alert-circle
color:: red
weight:: 80

## NN Marker Definition: completion
applies_to:: [Element]
icon:: check-circle-2
color:: green
weight:: 60

## NN Marker Definition: certainty
applies_to:: [Element]
icon:: help-circle
color:: blue
weight:: 50

## NN Marker Definition: priority
applies_to:: [Element]
icon:: flame
color:: orange
weight:: 90

## NN Marker Definition: rating
applies_to:: [Element]
icon:: star
color:: yellow
weight:: 70

# NN Matrix Definition

## NN Matrix Definition: Assumptions-Risks
source:: Assumptions
target:: Risks
values:: [Mitigates, Exacerbates, Independent]

## NN Matrix Definition: Experiments-Assumptions
source:: Experiments
target:: Assumptions
values:: [Tests, Validates, Invalidates]
`

const PROJECTS_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-0"
title: "Projects App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Project]]
  * [[Phases]]
  * [[Milestone]]
  * [[Deliverable]]
  * [[Task]]
  * [[Risk]]
  * [[Project roles]]

# NN Concept Definition

## NN Concept Definition: Project
icon:: folder-kanban
type:: text
color:: blue
weight:: 100

## NN Concept Definition: Phases
icon:: calendar
type:: list
color:: blue
weight:: 80

## NN Concept Definition: Milestone
icon:: flag
type:: list
color:: green
weight:: 70

## NN Concept Definition: Deliverable
icon:: package
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Task
icon:: check-square
type:: list
color:: purple
weight:: 50

## NN Concept Definition: Risk
icon:: alert-triangle
type:: list
color:: red
weight:: 40

## NN Concept Definition: Project roles
icon:: user
type:: list
color:: green
weight:: 30

# NN Field Definition

## NN Field Definition: start_date
concept:: Phases
type:: string

## NN Field Definition: end_date
concept:: Phases
type:: string

## NN Field Definition: due_date
concept:: Milestone
type:: string

## NN Field Definition: status
concept:: Task
type:: select
options:: [todo, in_progress, blocked, done]

## NN Field Definition: assignee
concept:: Task
type:: reference
target_concepts:: [Project roles]

## NN Field Definition: severity
concept:: Risk
type:: select
options:: [low, medium, high, critical]

# NN Marker Definition

## NN Marker Definition: health
applies_to:: [Element]
icon:: activity
color:: green

# NN Matrix Definition

## NN Matrix Definition: task-roles
source:: Task
target:: Project roles
values:: [Assigned]

## NN Matrix Definition: task-deliverables
source:: Task
target:: Deliverable
values:: [Produces]

## NN Matrix Definition: risks-milestones
source:: Risk
target:: Milestone
values:: [Threatens]
`

const BUSINESS_MODEL_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business-model/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-2"
title: "Business Model App"
includes:
  - name: "organization"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
  - name: "projects"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Business summary]]
* [[Market]]
  * [[Stakeholders]]
    * [[Stakeholder roles]]
  * [[Segments]]
    * [[Profiles]]
      * [[Persona]]
    * [[Segmentation]]
  * [[Market trends]]
  * [[Market size]]
  * [[Competition]]
* [[Value propositions]]
  * [[Problems]]
  * [[Messages]]
  * [[Channels]]
  * [[Perceptions]]
  * [[Emotions]]
  * [[Behaviors]]
  * [[Journey]]
* [[Solutions]]
  * [[Products and services]]
    * [[Components]]
    * [[Features]]
    * [[Roadmap]]
  * [[Offerings]]
* [[Marketing]]
  * [[Branding]]
  * [[Media plan]]
  * [[Communication]]
  * [[Pitch]]
  * [[Web]]
  * [[Storytelling]]
  * [[Presentations]]
* [[Team]]
  * [[Contributions]]
  * [[Compensations]]
* [[Business idea]]
  * [[Inspiration]]
  * [[Opportunity]]
* [[Business status]]
* [[Challenges]]
* [[Business objectives]]
  * [[Mission]]
  * [[Vision]]
  * [[Organizational values]]
  * [[Organizational goals]]
* [[Goals]]
* [[Operations]]
  * [[Activities]]
  * [[Resources]]
* [[Finance]]
  * [[Revenue]]
  * [[Costs]]
  * [[Unit economics]]
  * [[Funding sources]]
    * [[Shareholders]]
  * [[Projections]]
* [[Legal]]
  * [[Legal issues]]
  * [[Contracts]]
* [[Unfair advantage]]
* [[Procedure]]
* [[Misc]]

# NN Concept Definition

## NN Concept Definition: Business summary
icon:: file-text
type:: text
color:: blue
weight:: 90

## NN Concept Definition: Market
icon:: store
type:: category
color:: orange
weight:: 80

## NN Concept Definition: Stakeholders
icon:: users
type:: list
color:: orange
weight:: 70

## NN Concept Definition: Stakeholder roles
icon:: user-cog
type:: list
color:: orange
weight:: 50

## NN Concept Definition: Segments
icon:: pie-chart
type:: list
color:: orange
weight:: 75

## NN Concept Definition: Profiles
icon:: contact
type:: list
color:: orange
weight:: 65

## NN Concept Definition: Persona
icon:: user-check
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Segmentation
icon:: split
type:: list
color:: orange
weight:: 55

## NN Concept Definition: Market trends
icon:: trending-up
type:: list
color:: orange
weight:: 50

## NN Concept Definition: Market size
icon:: maximize-2
type:: list
color:: orange
weight:: 50

## NN Concept Definition: Competition
icon:: swords
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Value propositions
icon:: gem
type:: list
color:: yellow
weight:: 85

## NN Concept Definition: Problems
icon:: alert-circle
type:: list
color:: yellow
weight:: 80

## NN Concept Definition: Messages
icon:: message-square
type:: list
color:: yellow
weight:: 60

## NN Concept Definition: Channels
icon:: radio
type:: list
color:: yellow
weight:: 65

## NN Concept Definition: Perceptions
icon:: eye
type:: list
color:: yellow
weight:: 50

## NN Concept Definition: Emotions
icon:: heart
type:: list
color:: yellow
weight:: 45

## NN Concept Definition: Behaviors
icon:: activity
type:: list
color:: yellow
weight:: 55

## NN Concept Definition: Journey
icon:: navigation
type:: list
color:: yellow
weight:: 70

## NN Concept Definition: Solutions
icon:: lightbulb
type:: category
color:: green
weight:: 80

## NN Concept Definition: Products and services
icon:: package
type:: list
color:: green
weight:: 75

## NN Concept Definition: Components
icon:: cpu
type:: list
color:: green
weight:: 60

## NN Concept Definition: Features
icon:: star
type:: list
color:: green
weight:: 65

## NN Concept Definition: Roadmap
icon:: map
type:: list
color:: green
weight:: 70

## NN Concept Definition: Offerings
icon:: shopping-bag
type:: list
color:: green
weight:: 80

## NN Concept Definition: Marketing
icon:: megaphone
type:: category
color:: purple
weight:: 70

## NN Concept Definition: Branding
icon:: palette
type:: list
color:: purple
weight:: 60

## NN Concept Definition: Media plan
icon:: tv
type:: list
color:: purple
weight:: 50

## NN Concept Definition: Communication
icon:: share-2
type:: list
color:: purple
weight:: 55

## NN Concept Definition: Pitch
icon:: presentation
type:: list
color:: purple
weight:: 65

## NN Concept Definition: Web
icon:: globe
type:: list
color:: purple
weight:: 50

## NN Concept Definition: Storytelling
icon:: book-open
type:: list
color:: purple
weight:: 45

## NN Concept Definition: Presentations
icon:: file-slides
type:: list
color:: purple
weight:: 50

## NN Concept Definition: Team
icon:: users-2
type:: category
color:: blue
weight:: 70

## NN Concept Definition: Contributions
icon:: gift
type:: list
color:: blue
weight:: 50

## NN Concept Definition: Compensations
icon:: dollar-sign
type:: list
color:: blue
weight:: 50

## NN Concept Definition: Business idea
icon:: sparkler
type:: category
color:: cyan
weight:: 60

## NN Concept Definition: Inspiration
icon:: sun
type:: list
color:: cyan
weight:: 40

## NN Concept Definition: Opportunity
icon:: compass
type:: list
color:: cyan
weight:: 50

## NN Concept Definition: Business status
icon:: flag
type:: list
color:: cyan
weight:: 45

## NN Concept Definition: Challenges
icon:: mountain
type:: list
color:: cyan
weight:: 50

## NN Concept Definition: Business objectives
icon:: target
type:: category
color:: emerald
weight:: 75

## NN Concept Definition: Mission
icon:: rocket
type:: text
color:: emerald
weight:: 70

## NN Concept Definition: Vision
icon:: telescope
type:: text
color:: emerald
weight:: 70

## NN Concept Definition: Organizational values
icon:: shield
type:: list
color:: emerald
weight:: 60

## NN Concept Definition: Organizational goals
icon:: check-circle
type:: list
color:: emerald
weight:: 65

## NN Concept Definition: Goals
icon:: crosshair
type:: list
color:: emerald
weight:: 60

## NN Concept Definition: Operations
icon:: cog
type:: category
color:: slate
weight:: 70

## NN Concept Definition: Activities
icon:: zap
type:: list
color:: slate
weight:: 65

## NN Concept Definition: Resources
icon:: box
type:: list
color:: slate
weight:: 60

## NN Concept Definition: Finance
icon:: wallet
type:: category
color:: lime
weight:: 80

## NN Concept Definition: Revenue
icon:: arrow-up-right
type:: list
color:: lime
weight:: 75

## NN Concept Definition: Costs
icon:: arrow-down-right
type:: list
color:: lime
weight:: 70

## NN Concept Definition: Unit economics
icon:: scale
type:: list
color:: lime
weight:: 60

## NN Concept Definition: Funding sources
icon:: landmark
type:: list
color:: lime
weight:: 65

## NN Concept Definition: Shareholders
icon:: user-check
type:: list
color:: lime
weight:: 50

## NN Concept Definition: Projections
icon:: line-chart
type:: list
color:: lime
weight:: 70

## NN Concept Definition: Legal
icon:: scale
type:: category
color:: amber
weight:: 50

## NN Concept Definition: Legal issues
icon:: alert-octagon
type:: list
color:: amber
weight:: 45

## NN Concept Definition: Contracts
icon:: file-signature
type:: list
color:: amber
weight:: 50

## NN Concept Definition: Unfair advantage
icon:: trophy
type:: list
color:: violet
weight:: 65

## NN Concept Definition: Procedure
icon:: workflow
type:: list
color:: teal
weight:: 60

## NN Concept Definition: Misc
icon:: more-horizontal
type:: list
color:: gray
weight:: 20

# NN Field Definition

## NN Field Definition: relationship_model
concept:: Stakeholders
type:: string

## NN Field Definition: problem_severity
concept:: Problems
type:: select
options:: [critical, major, moderate, minor]

## NN Field Definition: price_model
concept:: Offerings
type:: string

# NN Marker Definition

## NN Marker Definition: importance
applies_to:: [Element]
icon:: alert-circle
color:: red
weight:: 80

## NN Marker Definition: completion
applies_to:: [Element]
icon:: check-circle-2
color:: green
weight:: 60

## NN Marker Definition: certainty
applies_to:: [Element]
icon:: help-circle
color:: blue
weight:: 50

## NN Marker Definition: priority
applies_to:: [Element]
icon:: flame
color:: orange
weight:: 90

## NN Marker Definition: rating
applies_to:: [Element]
icon:: star
color:: yellow
weight:: 70

# NN Matrix Definition

## NN Matrix Definition: Journey map
source:: Journey
target:: Touchpoints
values:: [High, Med, Low, None]

## NN Matrix Definition: Segmentation-Profiles
source:: Segmentation
target:: Profiles
values:: [Primary, Secondary, Target]

## NN Matrix Definition: Problems-Value propositions
source:: Problems
target:: Value propositions
values:: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]
widget:: set

## NN Matrix Definition: Value propositions-Messages
source:: Value propositions
target:: Messages
values:: [Addresses]

## NN Matrix Definition: Messages-Channels
source:: Messages
target:: Channels
values:: [Broadcasts]

## NN Matrix Definition: Features-Milestone
source:: Features
target:: Milestone
values:: [Targeted]

## NN Matrix Definition: Organizational values-Organizational goals
source:: Organizational values
target:: Organizational goals
values:: [Reinforces]

## NN Matrix Definition: Activities-Resources
source:: Activities
target:: Resources
values:: [Requires]

## NN Matrix Definition: Problems-Competition
source:: Problems
target:: Competition
values:: [Better, Parity, Worse]
`

const BUSINESS_SPEC_CONTENT = `---
spec_version: "V_0-2-5"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-6"
title: "Business App"
includes:
  - name: "business-model"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business-model/spec_NN.md"
  - name: "analysis"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/analysis/spec_NN.md"
  - name: "organization"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
  - name: "projects"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
  - name: "metrics"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
assets:
  - id: "model-viewer-shell"
    name: "Model Viewer HTML Layout"
    path: "assets/model_viewer.html"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Matrix Definition

## NN Matrix Definition: Metrics-Organizational goals Matrix
source:: Metrics
target:: Organizational goals
values:: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]
widget:: set
description:: Scores how directly each Metric tracks each Organizational goal.
`

export const CANONICAL_TEMPLATES: Record<string, CanonicalTemplate> = {
  business: {
    name: 'business',
    version: 'V_0-2-6',
    aliases: [
      'business',
      'business_spec_nn',
      'business_spec',
      'business_v_0-2-0_nn',
      'business_v_0-2-0',
      'business_v_0-2-1',
      'business_v_0-2-2',
      'business_v_0-2-3',
      'business_v_0-2-4',
      'business_v_0-2-5',
      'business_v_0-1-0',
      'business_v_0-1-1',
      'specs/templates/business/spec_nn.md',
      'specs/templates/business/business_v_0-2-0_nn.md',
      'specs/templates/business/business_v_0-2-1_nn.md',
      'specs/templates/business/business_v_0-2-3_nn.md',
      'specs/templates/business/business_v_0-2-4_nn.md',
      'specs/templates/business/business_v_0-2-5_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-1_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-3_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-4_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-5_nn.md',
    ],
    specContent: BUSINESS_SPEC_CONTENT,
  },
  procedures: {
    name: 'procedures',
    version: 'V_0-2-1',
    aliases: [
      'procedures',
      'procedures_spec_nn',
      'procedures_spec',
      'procedures_v_0-2-0_nn',
      'procedures_v_0-2-0',
      'procedures_v_0-2-1',
      'procedures_v_0-1-0',
      'specs/templates/procedures/spec_nn.md',
      'specs/templates/procedures/procedures_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/procedures/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/procedures/procedures_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/procedures/procedures_v_0-2-1_nn.md',
    ],
    specContent: PROCEDURES_SPEC_CONTENT,
  },
  sources: {
    name: 'sources',
    version: 'V_0-1-0',
    aliases: [
      'sources',
      'sources_spec_nn',
      'sources_spec',
      'sources_v_0-1-0_nn',
      'sources_v_0-1-0',
      'specs/templates/sources/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/sources/spec_nn.md',
    ],
    specContent: SOURCES_SPEC_CONTENT,
  },
  artifacts: {
    name: 'artifacts',
    version: 'V_0-2-0',
    aliases: [
      'artifacts',
      'artifacts_spec_nn',
      'artifacts_spec',
      'artifacts_v_0-1-0_nn',
      'artifacts_v_0-1-0',
      'artifacts_v_0-2-0',
      'specs/templates/artifacts/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/artifacts/spec_nn.md',
    ],
    specContent: ARTIFACTS_SPEC_CONTENT,
  },
  organization: {
    name: 'organization',
    version: 'V_0-2-1',
    aliases: [
      'organization',
      'organization_spec_nn',
      'organization_spec',
      'organization_v_0-2-0_nn',
      'organization_v_0-2-0',
      'organization_v_0-2-1',
      'organization_v_0-2-2',
      'specs/templates/organization/spec_nn.md',
      'specs/templates/organization/organization_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/organization/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/organization/organization_v_0-2-0_nn.md',
    ],
    specContent: ORGANIZATION_SPEC_CONTENT,
  },
  metrics: {
    name: 'metrics',
    version: 'V_0-2-1',
    aliases: [
      'metrics',
      'metrics_spec_nn',
      'metrics_spec',
      'metrics_v_0-2-0_nn',
      'metrics_v_0-2-0',
      'metrics_v_0-2-1',
      'specs/templates/metrics/spec_nn.md',
      'specs/templates/metrics/metrics_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/metrics/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/metrics/metrics_v_0-2-0_nn.md',
    ],
    specContent: METRICS_SPEC_CONTENT,
  },
  workspace: {
    name: 'workspace',
    version: 'V_0-6-0',
    aliases: [
      'workspace',
      'workspace_spec_nn',
      'workspace_spec',
      'workspace_v_0-1-0',
      'workspace_v_0-2-0_nn',
      'workspace_v_0-2-0',
      'workspace_v_0-2-1',
      'workspace_v_0-3-0',
      'workspace_v_0-3-0_spec',
      'workspace_v_0-3-0_spec_nn',
      'workspace_v_0-4-0',
      'workspace_v_0-5-1',
      'workspace_v_0-6-0',
      'specs/templates/workspace_spec_nn.md',
      'specs/templates/workspace/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/workspace_spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/workspace_v_0-3-0_spec_nn.md',
    ],
    specContent: WORKSPACE_SPEC_CONTENT,
  },
  cognnitive: {
    name: 'cogNNitive',
    version: 'V_0-2-1',
    aliases: [
      'cognnitive',
      'cognnitive_spec_nn',
      'cognnitive_spec',
      'cognnitive_v_0-2-0_nn',
      'cognnitive_v_0-2-0',
      'specs/templates/cognnitive/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/cognnitive/spec_nn.md',
    ],
    specContent: COGNNITIVE_SPEC_CONTENT,
  },
  analysis: {
    name: 'analysis',
    version: 'V_0-2-1',
    aliases: [
      'analysis',
      'analysis_spec_nn',
      'analysis_spec',
      'analysis_v_0-2-0',
      'analysis_v_0-2-1',
      'specs/templates/analysis/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/analysis/spec_nn.md',
    ],
    specContent: ANALYSIS_SPEC_CONTENT,
  },
  projects: {
    name: 'projects',
    version: 'V_0-2-1',
    aliases: [
      'projects',
      'projects_spec_nn',
      'projects_spec',
      'projects_v_0-2-0',
      'projects_v_0-2-1',
      'specs/templates/projects/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/projects/spec_nn.md',
    ],
    specContent: PROJECTS_SPEC_CONTENT,
  },
  'business-model': {
    name: 'business-model',
    version: 'V_0-2-1',
    aliases: [
      'business-model',
      'business_model',
      'business-model_spec_nn',
      'business-model_spec',
      'business-model_v_0-2-0',
      'business-model_v_0-2-1',
      'business-model_v_0-2-2',
      'specs/templates/business-model/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business-model/spec_nn.md',
    ],
    specContent: BUSINESS_MODEL_SPEC_CONTENT,
  },
  innfo: {
    name: 'innfo',
    version: 'V_0-2-0',
    aliases: [
      'innfo',
      'iNNfo',
      'innfo_spec_NN',
      'iNNfo_spec_NN',
      'innfo_V_0-2-0',
      'iNNfo_V_0-2-0',
      'innfo_V_0-2-0_NN',
      'iNNfo_V_0-2-0_NN',
      'innfo_V_0-2-1',
      'iNNfo_V_0-2-1',
      'innfo_V_0-2-1_NN',
      'iNNfo_V_0-2-1_NN',
      'innfo_V_0-2-2',
      'iNNfo_V_0-2-2',
      'innfo_V_0-2-2_NN',
      'iNNfo_V_0-2-2_NN',
      'specs/iNNfo_V_0-2-0_NN.md',
      'specs/iNNfo_V_0-2-1_NN.md',
      'specs/iNNfo_V_0-2-2_NN.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/innfo_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/innfo_v_0-2-1_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/innfo_v_0-2-2_nn.md',
    ],
    specContent: INNFO_SPEC_CONTENT,
  },
}

function normalizeKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\.(md|markdown)$/i, '')
    .replace(/_(nn|format|f)$/i, '')
}

/**
 * Find a canonical Level 2 template by name, alias, shorthand, or URL.
 */
export function findCanonicalTemplate(identifier: string): CanonicalTemplate | null {
  if (!identifier) return null
  const rawClean = identifier.trim()
  const lower = rawClean.toLowerCase()

  // 1. Direct match on key
  if (CANONICAL_TEMPLATES[lower]) {
    return CANONICAL_TEMPLATES[lower]
  }

  // 2. Normalized key match
  const normalized = normalizeKey(rawClean)
  if (CANONICAL_TEMPLATES[normalized]) {
    return CANONICAL_TEMPLATES[normalized]
  }

  // 3. Check all templates and their aliases
  for (const tmpl of Object.values(CANONICAL_TEMPLATES)) {
    if (tmpl.name.toLowerCase() === lower || normalizeKey(tmpl.name) === normalized) {
      return tmpl
    }
    for (const alias of tmpl.aliases) {
      const aliasLower = alias.toLowerCase()
      if (aliasLower === lower || normalizeKey(alias) === normalized) {
        return tmpl
      }
    }
  }

  // 4. Match by URL/path stem (e.g. ".../templates/business/spec_NN.md" or ".../business_V_0-2-0_NN.md")
  const urlParts = rawClean.split(/[/\\]/)
  const lastPart = urlParts[urlParts.length - 1]
  const parentPart = urlParts.length > 1 ? urlParts[urlParts.length - 2] : ''

  if (lastPart) {
    const lastNorm = normalizeKey(lastPart)
    if (CANONICAL_TEMPLATES[lastNorm]) {
      return CANONICAL_TEMPLATES[lastNorm]
    }
    // Check if parent part is template name (e.g. templates/business/spec_NN.md)
    if (parentPart) {
      const parentNorm = normalizeKey(parentPart)
      if (CANONICAL_TEMPLATES[parentNorm]) {
        return CANONICAL_TEMPLATES[parentNorm]
      }
    }
  }

  return null
}

/**
 * Get canonical spec content for a template identifier.
 */
export function getCanonicalSpecContent(identifier: string): string | null {
  return findCanonicalTemplate(identifier)?.specContent ?? null
}

/**
 * List all available canonical templates in the registry.
 */
export function listCanonicalTemplates(): CanonicalTemplate[] {
  return Object.values(CANONICAL_TEMPLATES)
}
