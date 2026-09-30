---
level: 3
parent_spec:
  name: "procedures_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Standard Operating Procedure: Documenting Procedures in iNNfo"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Procedure Documentation Lifecycle
step_type:: task
parent:: -
next:: -
condition:: New business process or operational workflow identified
input:: [[Process Intake Brief]]
output:: [[Validated iNNfo Level 3 Model]]
output_status:: verified
tool:: [[cogNNitive Modeler]]
scope:: internal
tags:: [procedure, governance, dogfooding, documentation-lifecycle]

Master lifecycle procedure for transforming unstructured business workflows and operational routines into fully validated iNNfo Level 3 Procedure models.

## NN Work: Scope & Trigger Identification
parent:: [[Procedure Documentation Lifecycle]]
step_type:: event
next:: [[Workflow Step Decomposition]]
condition:: Process owner submits documentation request
input:: [[Process Intake Brief]]
output:: [[Procedure Scope Definition]]
output_status:: verified
tool:: [[cogNNitive Modeler]]
scope:: internal
tags:: [procedure, scoping, intake, boundaries]

Capture the business rationale, operational boundaries, triggering events, and expected outcomes of the target workflow.

## NN Work: Workflow Step Decomposition
parent:: [[Procedure Documentation Lifecycle]]
step_type:: task
next:: [[Artifact & Tool Attachment]]
condition:: Procedure scope approved by domain lead
input:: [[Procedure Scope Definition]]
output:: [[Decomposed Step Hierarchy]]
output_status:: verified
tool:: [[iNNfo FSM Stepper View]]
scope:: internal
tags:: [procedure, decomposition, fsm-modeling, step-sequencing]

Decompose the end-to-end workflow into sequential tasks, decision gates, and event handlers. Establish chronological ordering with next references and transition guards.

## NN Work: Artifact & Tool Attachment
parent:: [[Procedure Documentation Lifecycle]]
step_type:: task
next:: [[RACI Governance Assignment]]
condition:: Step sequence validated in FSM preview
input:: [[Decomposed Step Hierarchy]]
output:: [[Toolchain & Dependency Map]]
output_status:: verified
tool:: [[cogNNitive Modeler]]
scope:: internal
tags:: [procedure, data-flow, toolchain-binding, artifact-mapping]

Identify and link tangible input and output deliverables for every step, then bind required execution tooling, software, or CLI utilities.

## NN Work: RACI Governance Assignment
parent:: [[Procedure Documentation Lifecycle]]
step_type:: task
next:: [[Integrity & Syntax Verification]]
condition:: Inputs, outputs, and tools fully populated
input:: [[Toolchain & Dependency Map]]
output:: [[RACI Accountability Matrix]]
output_status:: verified
tool:: [[iNNfo Matrix Editor]]
scope:: internal
tags:: [procedure, raci-governance, role-assignment, matrix-mapping]

Populate functional roles and assign formal RACI governance values (Responsible, Accountable, Consulted, Informed) across all decomposed work steps.

## NN Work: Integrity & Syntax Verification
parent:: [[Procedure Documentation Lifecycle]]
step_type:: task
next:: -
condition:: RACI matrix complete and reviewed
input:: [[RACI Accountability Matrix]]
output:: [[Validated iNNfo Level 3 Model]]
output_status:: verified
tool:: [[innfo-mcp Server]]
scope:: internal
tags:: [procedure, verification, mcp-audit, syntax-gate]

Execute automated syntactic verification, WikiLink integrity checks, and field exhaustiveness gates via innfo-mcp tools.

# NN Artifact

## NN Artifact: Process Intake Brief
Initial document describing business requirements, rough operational steps, and target actors.

## NN Artifact: Procedure Scope Definition
Structured boundary contract defining the trigger, scope, target audience, and terminal goals.

## NN Artifact: Decomposed Step Hierarchy
Hierarchical inventory of sequenced work steps with state transitions and branching conditions.

## NN Artifact: Toolchain & Dependency Map
Mapping of consumed input artifacts, produced deliverables, and software tools per work step.

## NN Artifact: RACI Accountability Matrix
Formal cross-functional matrix assigning responsibility and oversight across all procedure steps.

## NN Artifact: Validated iNNfo Level 3 Model
Canonical, verified plain-text Markdown model ready for execution in cogNNitive and distribution via MCP.

# NN Tools

## NN Tools: cogNNitive Modeler
Main visual modelling environment and syntax-aware workspace for iNNfo documents.

## NN Tools: iNNfo FSM Stepper View
Visualizer for finite state machine flows, sequential step progressions, and conditional transitions.

## NN Tools: iNNfo Matrix Editor
Tabular visual interface for evaluating and assigning relational matrices and RACI governance.

## NN Tools: innfo-mcp Server
Model Context Protocol daemon providing validation, hydration, queries, and integrity checks.

# NN Roles

## NN Roles: Business Process Architect
scope:: internal
Defines high-level process boundaries, business objectives, and organizational taxonomy.

## NN Roles: Technical Workflow Modeler
scope:: internal
Structures FSM step sequences, binds WikiLink references, and populates Markdown prose documentation.

## NN Roles: Domain Operations Lead
scope:: internal
Validates operational accuracy, verifies artifact deliverables, and approves step sequencing.

## NN Roles: QA & Integrity Reviewer
scope:: internal
Runs automated verification gates, validates MCP compliance, and approves model publication.

# NN matrices: work-roles matrix
| Work \ Roles | Business Process Architect | Technical Workflow Modeler | Domain Operations Lead | QA & Integrity Reviewer |
| :--- | :---: | :---: | :---: | :---: |
| Scope & Trigger Identification | Responsible | Consulted | Accountable | Informed |
| Workflow Step Decomposition | Consulted | Responsible | Accountable | Informed |
| Artifact & Tool Attachment | Informed | Responsible | Accountable | Consulted |
| RACI Governance Assignment | Accountable | Responsible | Consulted | Informed |
| Integrity & Syntax Verification | Informed | Consulted | Informed | Responsible |

# NN matrices: work-tools matrix
| Work \ Tools | cogNNitive Modeler | iNNfo FSM Stepper View | iNNfo Matrix Editor | innfo-mcp Server |
| :--- | :---: | :---: | :---: | :---: |
| Scope & Trigger Identification | Uses | - | - | - |
| Workflow Step Decomposition | - | Uses | - | - |
| Artifact & Tool Attachment | Uses | - | - | - |
| RACI Governance Assignment | - | - | Uses | - |
| Integrity & Syntax Verification | - | - | - | Uses |

# NN matrices: work-artifacts matrix
| Work \ Artifact | Process Intake Brief | Procedure Scope Definition | Decomposed Step Hierarchy | Toolchain & Dependency Map | RACI Accountability Matrix | Validated iNNfo Level 3 Model |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Scope & Trigger Identification | Validates | Creates | - | - | - | - |
| Workflow Step Decomposition | - | Reviews | Creates | - | - | - |
| Artifact & Tool Attachment | - | - | Reviews | Creates | - | - |
| RACI Governance Assignment | - | - | - | Reviews | Creates | - |
| Integrity & Syntax Verification | - | - | - | - | Reviews | Creates |
