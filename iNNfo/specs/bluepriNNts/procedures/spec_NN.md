---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-2"
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
description:: Functional classification of the procedure workflow.

## NN Field Definition: summary
concept:: Procedure
type:: string
description:: Mandatory concise summary of the workflow intent and transformation steps.

## NN Field Definition: inputs_required
concept:: Procedure
type:: string
description:: References to required Source or Model concepts consumed as inputs.

## NN Field Definition: outputs_expected
concept:: Procedure
type:: string
description:: References to expected Artifact concepts produced by the procedure.

## NN Field Definition: executed_by
concept:: Procedure
type:: string
description:: Reference to responsible agent or functional role executing the procedure.

## NN Field Definition: procedure_model
concept:: Procedure
type:: model
description:: Link to concrete procedure definition or executable stepper model _NN.md.

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

# Procedures Template

## A template for modeling procedure catalogs and structured workflows with sequenced steps, roles, artifacts, tools, and RACI matrices

## Philosophy

The Procedures Template operates on two complementary tiers:
1. **Catalog Tier (Procedure)**: Enables progressive disclosure of all workspace procedures, capturing concise summaries, categorization, expected I/O, and links to detailed execution models (`procedure_model`).
2. **Execution Tier (Work, Artifact, Tools, Roles)**: Defines granular FSM step sequences, accountability matrices (RACI), and tool bindings for step-by-step procedure execution.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Procedure** | `list` | Catalog entry declaring procedure metadata, summary, required inputs, expected outputs, and model links |
| **Work** | `list` | Hierarchical tree of procedures and steps. Root elements (no `parent`) = procedure; child elements (`parent` set) = step |
| **Artifact** | `list` | Documents, deliverables, or data produced or consumed by work steps |
| **Tools** | `list` | Software or hardware used to execute work steps |
| **Roles** | `list` | Functional roles with accountability scope (internal/external) |

## Template

### Level 3 Catalog Template

```yaml
---
level: 3
parent_spec:
  name: "procedures"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "<Procedures Catalog Name>"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Procedure]]

# NN Procedure

## NN Procedure: Workflow Name
category:: transformation
summary:: Concise summary of workflow intent and steps.
inputs_required:: [[Source or Model Name]]
outputs_expected:: [[Artifact Name]]
executed_by:: Lead Engineer
procedure_model:: procedures/workflow_NN.md
```

# Concept Guidance Documentation

## Procedure

### Summary
Catalog entry declaring procedure metadata, functional categorization, input requirements, expected outputs, execution owner, and linked submodels.

### Description
A Procedure is a high-level operational workflow catalog item. It encapsulates standard operating procedures (SOPs), repeatable transformation routines, verification pipelines, or governance checklists. Each procedure captures its functional domain through `category` (ingestion, transformation, audit, reporting, custom), defines operational prerequisites via `inputs_required`, specifies tangible outcomes in `outputs_expected`, assigns responsibility with `executed_by`, and optionally links to a granular execution model through `procedure_model`.

### Methodologies
**Standard Operating Procedure (SOP) Framework**
Defines standard procedural sequences to ensure consistency, regulatory compliance, and operational repeatability across technical and business workflows.

**ITIL Service Transition & Operational Procedures**
Aligns operational routines with lifecycle management, change governance, and quality verification gates.

**BPMN Workflow Modeling**
Structures procedure categorization and I/O contracts into clean business process models for human and automated agents.

### Prompts
`Define a structured procedure catalog entry for our verification gate.`
`Specify the required inputs and expected deliverables for the release workflow.`
`Categorize all workspace procedures and map their execution owners.`
`Link high-level catalog procedures to executable FSM submodels.`

---

## Work

### Summary
Hierarchical execution tree defining end-to-end workflows, stages, decision nodes, and granular action steps.

### Description
Work represents the structural execution elements of a procedure. Root elements (where `parent` is omitted) represent top-level procedures or workflows, while child elements (where `parent` references a parent Work item) represent sequential steps, decision gates, or sub-tasks. Each work element defines its operational character through `step_type` (task, decision, event), establishes execution ordering via `next` and `condition`, links consumed inputs and produced outputs via `input` and `output`, and associates execution tooling via `tool`.

### Methodologies
**Hierarchical Task Analysis (HTA)**
Decomposes complex operational processes into a hierarchy of sub-goals, tasks, and sequential steps.

**Finite State Machine (FSM) Execution**
Models procedure progression as discrete states transitioning based on evaluated conditions, events, and task completion.

**Value Stream Mapping (VSM)**
Visualizes sequential work steps to identify bottlenecks, redundant handoffs, and optimization opportunities.

### Prompts
`Decompose this multi-step procedure into structured Work steps.`
`Define conditional branches and decision gates for the workflow.`
`Link input and output artifacts to each granular work step.`
`Construct an end-to-end step sequence using next and parent references.`

---

## Artifact

### Summary
Tangible deliverables, structured models, reports, or data assets consumed and produced by procedural work steps.

### Description
Artifact represents any physical or digital deliverable produced or required during procedure execution. Artifacts serve as inputs to subsequent work steps or represent the final terminal deliverables of a workflow. In execution models, artifacts are linked to Work steps via `input` and `output` fields and mapped against tasks through the `work-artifacts matrix` (Creates, Modifies, Validates, Reviews).

### Methodologies
**Deliverable-Oriented Planning**
Focuses workflow design on concrete, verifiable outputs rather than open-ended activities.

**Artifact Lifecycle Management**
Tracks the state transitions of artifacts (draft, in-review, approved, published, archived) across procedural milestones.

**Configuration Management (CM)**
Ensures all procedural inputs and outputs maintain traceable versions and baseline integrity.

### Prompts
`Identify all artifacts produced and consumed by this operational workflow.`
`Map procedural deliverables against RACI roles and validation steps.`
`Define artifact quality criteria and expected output formats.`

---

## Tools

### Summary
Software platforms, CLI utilities, AI agents, or physical instruments used by roles to execute work steps.

### Description
Tools defines the operational instruments, automation scripts, compilers, editors, or external platforms employed during the execution of procedural steps. Tools are referenced directly in Work steps via `tool` and mapped across tasks in the `work-tools matrix` to ensure capability readiness and toolchain compatibility.

### Methodologies
**Toolchain Integration Matrix**
Maps operational requirements to software tooling and execution automation capabilities.

**Capability-Based Tooling Assessment**
Evaluates tool suitability, integration contracts, and automation maturity for workflow execution.

### Prompts
`Catalog the tools and scripts required for each step in this procedure.`
`Map tool dependencies across our automated and manual workflows.`
`Identify opportunities to automate manual steps with dedicated CLI tools.`

---

## Roles

### Summary
Functional roles, actors, or automated agents responsible for executing, reviewing, or overseeing procedural tasks.

### Description
Roles defines the organizational positions, actor profiles, or automated agent types participating in procedure execution. Each role specifies its organizational boundary through `scope` (internal, external) and is mapped against work steps in the `work-roles matrix` using standard RACI values (Responsible, Accountable, Consulted, Informed).

### Methodologies
**RACI Governance Framework**
Clarifies organizational responsibility and decision rights across procedural steps.

**Role-Based Access & Execution (RBAC)**
Aligns procedural execution permissions and accountability with functional roles.

### Prompts
`Define the RACI assignments for each step in this workflow.`
`Identify internal and external roles required for procedure governance.`
`Clarify accountability and approval gates for critical workflow decisions.`

