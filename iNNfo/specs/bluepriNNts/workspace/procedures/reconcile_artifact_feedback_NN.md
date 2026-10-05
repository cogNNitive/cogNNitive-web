---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-1-0"
title: "Artifact Dual-Emission, Review & Feedback Reconciliation Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Procedure

## NN Procedure: Reconcile Artifact Feedback
category:: transformation
summary:: Governs dual-emission of deliverables (published vs. reviewer_review), embeds language-aware reviewer instructions and filename conventions, extracts reviewer attribution and annotations forensically from DOCX/Markdown, triages discrepancies in 4 layers, resolves human intent, and updates upstream iNNfo domain models.
inputs_required:: [[Reviewed Deliverable Document]]
outputs_expected:: [[Published Final Deliverable]]
executed_by:: Senior AI Architect
procedure_model:: procedures/reconcile_artifact_feedback_NN.md

# NN Work

## NN Work: Artifact Feedback Reconciliation Workflow
step_type:: task
condition:: Reviewed deliverable dropped in artifacts/ directory
input:: [[Reviewed Deliverable Document]]
output:: [[Published Final Deliverable]]
output_status:: verified
tool:: [[iNNfo MCP Server]]
scope:: internal
tags:: [procedure, dual-emission, review, feedback, reconciliation, docx, lineage]
End-to-end standard operating procedure governing the lifecycle from dual-emission generation, reviewer guidance, annotation harvesting, 4-layer discrepancy triaging, human intent resolution, upstream model mutation, and final publication registration.

## NN Work: Step 0 - Dual-Emission Deliverable Generation
parent:: [[Artifact Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 1 - Forensic Ingestion and Attribution Extraction]]
condition:: Generator procedure triggered (e.g. Lean Business Plan compilation)
input:: [[Updated Domain Model]]
output:: [[Review Scaffold Deliverable]]
output_status:: verified
tool:: [[Pandoc Converter]]
scope:: internal
tags:: [dual-emission, generation, templates, reviewer-banner]
Compiles two paired artifacts: (1) Clean published deliverable `{Stem}_V_{Version}.docx` without editorial meta-instructions, and (2) Review scaffold `{Stem}_V_{Version}_reviewer_review.docx` embedding the localized Reviewer Instruction Cover Sheet.

## NN Work: Step 1 - Forensic Ingestion and Attribution Extraction
parent:: [[Artifact Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 2 - Lineage and Upstream Dependency Mapping]]
condition:: Reviewed file matching *_review.docx dropped in artifacts/
input:: [[Reviewed Deliverable Document]]
output:: [[Normalized Extraction and Annotation Bundle]]
output_status:: verified
tool:: [[Pandoc Converter]]
scope:: internal
tags:: [forensics, attribution, pandoc, xml, comments, track-changes]
Parses filename grammar `^{Stem}_V_{Version}_{reviewer_slug}_review\.docx$` to extract `reviewer_slug`. Converts document to Markdown/Plain text via Pandoc and unzips XML to harvest `<w:comments w:author="...">`, `<w:ins>`, `<w:del>`, highlights, and embedded media.

## NN Work: Step 2 - Lineage and Upstream Dependency Mapping
parent:: [[Artifact Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 3 - Four-Layer Discrepancy Triaging]]
condition:: Extraction bundle completed
input:: [[Workspace Manifest and Lineage Record]]
output:: [[Upstream Dependency Map]]
output_status:: verified
tool:: [[iNNfo MCP Server]]
scope:: internal
tags:: [lineage, provenance, derived-from, dependencies]
Reads baseline artifact registration in `workspace_NN.md` to map `sources::`, determining whether changed data originates in domain models, satellite financial models, or raw transcripts.

## NN Work: Step 3 - Four-Layer Discrepancy Triaging
parent:: [[Artifact Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 4 - User Intent Decision Gate]]
condition:: Upstream map resolved
input:: [[Normalized Extraction and Annotation Bundle]]
output:: [[Four-Layer Triage Report]]
output_status:: verified
tool:: [[Semantic Diff Engine]]
scope:: internal
tags:: [triage, classification, layers, domain-vs-presentation]
Classifies harvested changes into 4 orthogonal buckets: (1) Scope & Deliverable Format [SCOPE/FORMAT], (2) Satellite Data/Financial Sources [DATA], (3) Domain Knowledge & Business Truth [DECISION], and (4) Reviewer Anomalies/Defects.

## NN Work: Step 4 - User Intent Decision Gate
parent:: [[Artifact Feedback Reconciliation Workflow]]
step_type:: decision
next:: [[Step 5 - Upstream Model and Template Mutation]]
condition:: Layer 3 domain discrepancies without explicit [DECISION] tag identified
input:: [[Four-Layer Triage Report]]
output:: [[User Reconciliation Decisions]]
output_status:: verified
tool:: [[Engram Persistent Memory]]
scope:: external
tags:: [decision-gate, human-in-the-loop, intent-verification]
If reviewer comments contain explicit tags (`[DECISION]`, `[SCOPE]`), intent is resolved automatically. If untagged direct deletions exist, prompts user with a single focused question: *"Is this an editorial cut for this document only, or has the domain reality changed?"*.

## NN Work: Step 5 - Upstream Model and Template Mutation
parent:: [[Artifact Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 6 - Artifact Sanitization and Lineage Registration]]
condition:: Decisions confirmed
input:: [[User Reconciliation Decisions]]
output:: [[Updated Domain Model]]
output_status:: verified
tool:: [[iNNfo MCP Server]]
scope:: internal
tags:: [mcp, mutation, refactoring, validation]
Executes deterministic mutations on Level 3 domain models via `innfo-mcp_apply_change` or file tools, re-validates schemas with `innfo-mcp_validate_model`, and updates generator templates if deliverable scope changed.

## NN Work: Step 6 - Artifact Sanitization and Lineage Registration
parent:: [[Artifact Feedback Reconciliation Workflow]]
step_type:: task
condition:: Upstream models validated
input:: [[Updated Domain Model]]
output:: [[Published Final Deliverable]]
output_status:: verified
tool:: [[iNNfo MCP Server]]
scope:: internal
tags:: [lineage-registration, manifest, version-bump, closing]
Sanitizes artifact defects (truncated text, unresolved placeholders), regenerates the clean final deliverable (`_final.docx` or canonical stem), registers both the review file and final deliverable in `## NN Artifacts` with attribution `reviewer:: [[Human Reviewer]]`, and bumps version.

# NN Artifact

## NN Artifact: Review Scaffold Deliverable
format:: docx
storage:: artifacts/
description:: Deliverable generated specifically for human review, containing embedded localized instructions and named with `_reviewer_review.docx`.

## NN Artifact: Reviewed Deliverable Document
format:: docx
storage:: artifacts/
description:: The document returned by the reviewer, named following `{Stem}_V_{Version}_{reviewer_slug}_review.docx`.

## NN Artifact: Published Final Deliverable
format:: docx
storage:: artifacts/
description:: The final, clean, reconciled publication artifact without reviewer cover sheets, registered in workspace lineage.

## NN Artifact: Normalized Extraction and Annotation Bundle
format:: markdown
storage:: system_temp
description:: Plain text extraction, XML comments, Track Changes, and reviewer metadata extracted via Pandoc.

## NN Artifact: Workspace Manifest and Lineage Record
format:: iNNfo
storage:: workspace_NN.md
description:: Central workspace lineage index recording models, sources, artifacts, and procedures.

## NN Artifact: Upstream Dependency Map
format:: structured_json
storage:: system_temp
description:: Resolved mapping linking deliverable sections and numbers to upstream models or data sheets.

## NN Artifact: Four-Layer Triage Report
format:: markdown
storage:: session_context
description:: Structured classification of changes into Scope, Satellite Data, Domain Truth, and Reviewer Anomalies.

## NN Artifact: User Reconciliation Decisions
format:: user_input
storage:: conversations/
description:: Provenance of human decisions regarding intent and scope.

## NN Artifact: Updated Domain Model
format:: iNNfo
storage:: models/
description:: Validated Level 3 domain model reflecting updated business truths.

# NN Tools

## NN Tools: Pandoc Converter
vendor:: John MacFarlane
category:: document_conversion
description:: Universal document converter used to produce Word deliverables and extract plain text/Markdown.

## NN Tools: iNNfo MCP Server
vendor:: cogNNitive
category:: deterministic_engine
description:: Model-context protocol engine for syntax validation, AST parsing, and atomic model mutations.

## NN Tools: Semantic Diff Engine
vendor:: git / node
category:: diff_analysis
description:: Word-level and AST-aware structural diffing engine.

## NN Tools: Engram Persistent Memory
vendor:: gentle-ai
category:: memory_system
description:: Cross-session persistent memory for tracking discovery notes, decisions, and session lineage.

# NN Roles

## NN Roles: Human Reviewer
scope:: external
description:: Subject matter expert or stakeholder reviewing deliverables and providing editorial or domain feedback.

## NN Roles: Senior AI Architect
scope:: internal
description:: Orchestrator agent performing forensic extraction, triaging, decision-gating, and model mutation.

## NN Roles: Workspace Owner
scope:: internal
description:: Project lead making definitive decisions on business truth and approving model mutations.

# NN matrices: work-roles matrix
| Work \ Roles | Human Reviewer | Senior AI Architect | Workspace Owner |
| :--- | :---: | :---: | :---: |
| Step 0 - Dual-Emission Deliverable Generation | Informed | Responsible | Accountable |
| Step 1 - Forensic Ingestion and Attribution Extraction | Informed | Responsible | Accountable |
| Step 2 - Lineage and Upstream Dependency Mapping | Informed | Responsible | Accountable |
| Step 3 - Four-Layer Discrepancy Triaging | Informed | Responsible | Accountable |
| Step 4 - User Intent Decision Gate | Consulted | Responsible | Accountable |
| Step 5 - Upstream Model and Template Mutation | Informed | Responsible | Accountable |
| Step 6 - Artifact Sanitization and Lineage Registration | Informed | Responsible | Accountable |

# NN matrices: work-tools matrix
| Work \ Tools | Pandoc Converter | iNNfo MCP Server | Semantic Diff Engine | Engram Persistent Memory |
| :--- | :---: | :---: | :---: | :---: |
| Step 0 - Dual-Emission Deliverable Generation | Uses | Uses | - | - |
| Step 1 - Forensic Ingestion and Attribution Extraction | Uses | - | Uses | - |
| Step 2 - Lineage and Upstream Dependency Mapping | - | Uses | - | Uses |
| Step 3 - Four-Layer Discrepancy Triaging | - | Uses | Uses | - |
| Step 4 - User Intent Decision Gate | - | - | - | Uses |
| Step 5 - Upstream Model and Template Mutation | - | Uses | - | Uses |
| Step 6 - Artifact Sanitization and Lineage Registration | Uses | Uses | - | Uses |

# NN matrices: work-artifacts matrix
| Work \ Artifact | Review Scaffold Deliverable | Reviewed Deliverable Document | Four-Layer Triage Report | Updated Domain Model | Published Final Deliverable |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Step 0 - Dual-Emission Deliverable Generation | Creates | - | - | Reviews | Creates |
| Step 1 - Forensic Ingestion and Attribution Extraction | - | Reviews | - | - | - |
| Step 2 - Lineage and Upstream Dependency Mapping | - | Reviews | - | - | - |
| Step 3 - Four-Layer Discrepancy Triaging | - | Reviews | Creates | - | - |
| Step 4 - User Intent Decision Gate | - | - | Reviews | - | - |
| Step 5 - Upstream Model and Template Mutation | - | - | Reviews | Modifies | - |
| Step 6 - Artifact Sanitization and Lineage Registration | - | - | - | Validates | Creates |
