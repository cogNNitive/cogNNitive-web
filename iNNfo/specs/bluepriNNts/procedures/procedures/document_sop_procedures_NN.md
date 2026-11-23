---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Standard Operating Procedure: Documenting Procedures in iNNfo"
---

# NN Work

## NN Work: Procedure Documentation Lifecycle
slug:: procedure-documentation-lifecycle
step_type:: task
condition:: New business process or operational workflow identified
input:: @process-intake-brief
output:: @validated-innfo-level-3-model
output_status:: verified
tool:: @cognnitive-modeler
executor:: agent
scope:: internal
tags:: [procedure, governance, dogfooding, documentation-lifecycle]

Master lifecycle procedure for transforming unstructured business workflows and operational routines into fully validated iNNfo Level 3 Procedure models.

## NN Work: Scope & Trigger Identification
slug:: scope-trigger-identification
parent:: @procedure-documentation-lifecycle
step_type:: event
next:: @workflow-step-decomposition
condition:: Process owner submits documentation request
input:: @process-intake-brief
output:: @procedure-scope-definition
output_status:: verified
tool:: @cognnitive-modeler
executor:: agent
scope:: internal
tags:: [procedure, scoping, intake, boundaries]

Capture the business rationale, operational boundaries, triggering events, and expected outcomes of the target workflow.

## NN Work: Workflow Step Decomposition
slug:: workflow-step-decomposition
parent:: @procedure-documentation-lifecycle
step_type:: task
next:: @artifact-tool-attachment
condition:: Procedure scope approved by domain lead
input:: @procedure-scope-definition
output:: @decomposed-step-hierarchy
output_status:: verified
tool:: @innfo-fsm-stepper-view
executor:: human
scope:: internal
tags:: [procedure, decomposition, fsm-modeling, step-sequencing]

Decompose the end-to-end workflow into sequential tasks, decision gates, and event handlers. Establish chronological ordering with next references and transition guards.

## NN Work: Artifact & Tool Attachment
slug:: artifact-tool-attachment
parent:: @procedure-documentation-lifecycle
step_type:: task
next:: @raci-governance-assignment
condition:: Step sequence validated in FSM preview
input:: @decomposed-step-hierarchy
output:: @toolchain-dependency-map
output_status:: verified
tool:: @cognnitive-modeler
executor:: agent
scope:: internal
tags:: [procedure, data-flow, toolchain-binding, artifact-mapping]

Identify and link tangible input and output deliverables for every step, then bind required execution tooling, software, or CLI utilities.

## NN Work: RACI Governance Assignment
slug:: raci-governance-assignment
parent:: @procedure-documentation-lifecycle
step_type:: task
next:: @integrity-syntax-verification
condition:: Inputs, outputs, and tools fully populated
input:: @toolchain-dependency-map
output:: @raci-accountability-matrix
output_status:: verified
tool:: @innfo-matrix-editor
executor:: agent
scope:: internal
tags:: [procedure, raci-governance, role-assignment, matrix-mapping]

Populate functional roles and assign formal RACI governance values (Responsible, Accountable, Consulted, Informed) across all decomposed work steps.

## NN Work: Integrity & Syntax Verification
slug:: integrity-syntax-verification
parent:: @procedure-documentation-lifecycle
step_type:: task
condition:: RACI matrix complete and reviewed
input:: @raci-accountability-matrix
output:: @validated-innfo-level-3-model
output_status:: verified
tool:: @nn-mcp-server
executor:: agent
scope:: internal
tags:: [procedure, verification, mcp-audit, syntax-gate]

Execute automated syntactic verification, WikiLink integrity checks, and field exhaustiveness gates via nn-mcp tools.

# NN Artifact

## NN Artifact: Process Intake Brief
slug:: process-intake-brief
Initial document describing business requirements, rough operational steps, and target actors.

## NN Artifact: Procedure Scope Definition
slug:: procedure-scope-definition
Structured boundary contract defining the trigger, scope, target audience, and terminal goals.

## NN Artifact: Decomposed Step Hierarchy
slug:: decomposed-step-hierarchy
Hierarchical inventory of sequenced work steps with state transitions and branching conditions.

## NN Artifact: Toolchain & Dependency Map
slug:: toolchain-dependency-map
Mapping of consumed input artifacts, produced deliverables, and software tools per work step.

## NN Artifact: RACI Accountability Matrix
slug:: raci-accountability-matrix
Formal cross-functional matrix assigning responsibility and oversight across all procedure steps.

## NN Artifact: Validated iNNfo Level 3 Model
slug:: validated-innfo-level-3-model
Canonical, verified plain-text Markdown model ready for execution in cogNNitive and distribution via MCP.

# NN Tools

## NN Tools: cogNNitive Modeler
slug:: cognnitive-modeler
Main visual modelling environment and syntax-aware workspace for iNNfo documents.

## NN Tools: iNNfo FSM Stepper View
slug:: innfo-fsm-stepper-view
Visualizer for finite state machine flows, sequential step progressions, and conditional transitions.

## NN Tools: iNNfo Matrix Editor
slug:: innfo-matrix-editor
Tabular visual interface for evaluating and assigning relational matrices and RACI governance.

## NN Tools: nn-mcp Server
slug:: nn-mcp-server
Model Context Protocol daemon providing validation, hydration, queries, and integrity checks.

# NN Roles

## NN Roles: Business Process Architect
slug:: business-process-architect
scope:: internal
Defines high-level process boundaries, business objectives, and organizational taxonomy.

## NN Roles: Technical Workflow Modeler
slug:: technical-workflow-modeler
scope:: internal
Structures FSM step sequences, binds WikiLink references, and populates Markdown prose documentation.

## NN Roles: Domain Operations Lead
slug:: domain-operations-lead
scope:: internal
Validates operational accuracy, verifies artifact deliverables, and approves step sequencing.

## NN Roles: QA & Integrity Reviewer
slug:: qa-integrity-reviewer
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
| Work \ Tools | cogNNitive Modeler | iNNfo FSM Stepper View | iNNfo Matrix Editor | nn-mcp Server |
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
