---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Visual Source Import & Semantic Analysis Procedure"
---

>
> **Experimental External Ingestion**: OCR and visual diagram analysis (Vision LLM / OCR tools) are external helper processes assisted by the AI agent or user environment. cogNNitive natively manages the resulting normalized Markdown and provenance tracing.

# NN index

* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Work

## NN Work: Import and Analyze Visual Sources
slug:: import-and-analyze-visual-sources
step_type:: task
condition:: Visual files, diagrams, or mockups present in import folder
input:: @raw-visual-sources-directory
output:: @verified-target-domain-model
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Ingest visual assets (diagrams, architecture charts, UI mockups, whiteboards), extract structured semantic descriptions via external Vision LLM / OCR staged in sources/import/, cognitivize sidecar provenance in place, bind to target domain model elements, and validate integrity.

## NN Work: Discover Raw Visual Files
slug:: discover-raw-visual-files
parent:: @import-and-analyze-visual-sources
step_type:: task
next:: @verify-and-deduplicate-visual-sources
condition:: Ingestion workflow triggered
input:: @raw-visual-sources-directory
output:: @unprocessed-visual-list
output_status:: verified
tool:: @command-line-interface
executor:: agent
scope:: internal
Scan sources/import/ or drop directories for visual files (.png, .jpg, .svg, .webp) that require semantic extraction.

## NN Work: Verify and Deduplicate Visual Sources
slug:: verify-and-deduplicate-visual-sources
parent:: @import-and-analyze-visual-sources
step_type:: decision
next:: @extract-visual-semantics-via-vision-llm
decision:: whether the queue holds any file that is not already registered by SHA-256 in a sidecar under sources/import/ or in assets/
condition:: Visual list generated
input:: @unprocessed-visual-list
output:: @verified-visual-ingestion-queue
output_status:: verified
tool:: @command-line-interface
executor:: agent
scope:: internal
Compute SHA-256 hashes of visual assets to avoid re-analyzing images already registered in sources/import/ sidecars or assets/.

## NN Work: Extract Visual Semantics via Vision LLM
slug:: extract-visual-semantics-via-vision-llm
parent:: @import-and-analyze-visual-sources
step_type:: task
next:: @stage-visual-markdown-description
condition:: Ingestion queue verified
input:: @verified-visual-ingestion-queue
output:: @structured-visual-description
output_status:: verified
tool:: @vision-analysis-engine
executor:: agent
scope:: external
Analyze images via Vision LLM or OCR to extract architecture components, relationships, UI elements, text annotations, and layout hierarchy in structured Markdown format.

## NN Work: Stage Visual Markdown Description
slug:: stage-visual-markdown-description
parent:: @import-and-analyze-visual-sources
step_type:: task
next:: @cognitivize-visual-source-with-sidecar-provenance
condition:: Visual semantics extracted
input:: @structured-visual-description
output:: @staged-visual-import-files
output_status:: verified
tool:: @file-editor
executor:: agent
scope:: internal
Stage generated Markdown description in sources/import/ and ensure the companion image is preserved or copied into assets/.

## NN Work: Cognitivize Visual Source with Sidecar Provenance
slug:: cognitivize-visual-source-with-sidecar-provenance
parent:: @import-and-analyze-visual-sources
step_type:: task
next:: @bind-visual-source-to-target-entity
condition:: Visual description staged
input:: @staged-visual-import-files
output:: @cognitivized-sources-and-sidecars
output_status:: verified
tool:: @nn-sources-ingestion-engine
executor:: agent
scope:: internal
Run nn-sources to cognitivize staged visual descriptions and raw images in place, generating co-located sidecars with SHA-256, dimensions, and origin metadata.

## NN Work: Bind Visual Source to Target Entity
slug:: bind-visual-source-to-target-entity
parent:: @import-and-analyze-visual-sources
step_type:: task
next:: @validate-target-model
condition:: Normalized source created
input:: @cognitivized-sources-and-sidecars
output:: @updated-domain-model
output_status:: verified
tool:: @file-editor
executor:: agent
scope:: internal
Add normalized visual source citations to the sources:: field of the corresponding concept element (e.g. Solutions, Features, Infrastructure) in the domain model.

## NN Work: Validate Target Model
slug:: validate-target-model
parent:: @import-and-analyze-visual-sources
step_type:: task
condition:: Domain model updated
input:: @updated-domain-model
output:: @verified-target-domain-model
output_status:: verified
tool:: @innfo-mcp
executor:: agent
scope:: internal
Validate the updated domain model using innfo-mcp to ensure zero broken references or schema errors.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
scope:: internal
LLM agent coordinating the visual import and domain enrichment workflow.

## NN Tools: Command Line Interface
slug:: command-line-interface
scope:: internal
Terminal environment for directory inspection and hash verification.

## NN Tools: Vision Analysis Engine
slug:: vision-analysis-engine
scope:: external
External multimodal Vision LLM or OCR engine generating textual descriptions from images.

## NN Tools: nn-sources Ingestion Engine
slug:: nn-sources-ingestion-engine
scope:: internal
Deterministic ingestion tool creating in-place sidecars with origin metadata.

## NN Tools: File Editor
slug:: file-editor
scope:: internal
Tool for writing staged files and modifying domain models.

## NN Tools: innfo-mcp
slug:: innfo-mcp
scope:: internal
Deterministic validation tool for iNNfo models.

# NN Artifact

## NN Artifact: Raw Visual Sources Directory
slug:: raw-visual-sources-directory
type:: spec
format:: directory
Input folder with raw images (.png, .jpg, .svg).

## NN Artifact: Unprocessed Visual List
slug:: unprocessed-visual-list
type:: data
format:: json
List of image assets pending semantic extraction.

## NN Artifact: Verified Visual Ingestion Queue
slug:: verified-visual-ingestion-queue
type:: data
format:: json
Deduplicated list of images ready for analysis.

## NN Artifact: Structured Visual Description
slug:: structured-visual-description
type:: deliverable
format:: markdown
Textual representation of the diagram or UI extracted by the vision engine.

## NN Artifact: Staged Visual Import Files
slug:: staged-visual-import-files
type:: data
format:: directory
Markdown files staged in sources/import/ alongside asset references.

## NN Artifact: Cognitivized Sources and Sidecars
slug:: cognitivized-sources-and-sidecars
type:: spec
format:: markdown
Traceable Markdown sources and sidecars in sources/import/ establishing visual provenance.

## NN Artifact: Updated Domain Model
slug:: updated-domain-model
type:: spec
format:: markdown
Domain model file enriched with visual source citations.

## NN Artifact: Verified Target Domain Model
slug:: verified-target-domain-model
type:: report
format:: status
Validation confirmation confirming model integrity.

# NN Roles

## NN Roles: iNNfo Agent
slug:: innfo-agent
scope:: internal
AI agent executing procedural tasks and model updates.

## NN Roles: Workspace Maintainer
slug:: workspace-maintainer
scope:: external
Human maintainer reviewing extracted descriptions and approving domain model changes.

# NN matrices: work-roles matrix

| Work \ Roles | iNNfo Agent | Workspace Maintainer |
| :--- | :---: | :---: |
| Import and Analyze Visual Sources | Responsible | Accountable |
| Discover Raw Visual Files | Responsible | Informed |
| Verify and Deduplicate Visual Sources | Responsible | Informed |
| Extract Visual Semantics via Vision LLM | Responsible | Informed |
| Stage Visual Markdown Description | Responsible | Informed |
| Cognitivize Visual Source with Sidecar Provenance | Responsible | Informed |
| Bind Visual Source to Target Entity | Responsible | Accountable |
| Validate Target Model | Responsible | Informed |

# NN matrices: work-tools matrix

| Work \ Tools | AI Agent | Command Line Interface | Vision Analysis Engine | nn-sources Ingestion Engine | File Editor | innfo-mcp |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Analyze Visual Sources | Uses | - | - | - | - | - |
| Discover Raw Visual Files | - | Uses | - | - | - | - |
| Verify and Deduplicate Visual Sources | - | Uses | - | - | - | - |
| Extract Visual Semantics via Vision LLM | - | - | Uses | - | - | - |
| Stage Visual Markdown Description | - | - | - | - | Uses | - |
| Cognitivize Visual Source with Sidecar Provenance | - | - | - | Uses | - | - |
| Bind Visual Source to Target Entity | - | - | - | - | Uses | - |
| Validate Target Model | - | - | - | - | - | Uses |

# NN matrices: work-artifacts matrix

| Work \ Artifact | Raw Visual Sources Directory | Unprocessed Visual List | Verified Visual Ingestion Queue | Structured Visual Description | Staged Visual Import Files | Cognitivized Sources and Sidecars | Updated Domain Model | Verified Target Domain Model |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Analyze Visual Sources | Reviews | - | - | - | - | - | - | Creates |
| Discover Raw Visual Files | Reviews | Creates | - | - | - | - | - | - |
| Verify and Deduplicate Visual Sources | - | Reviews | Creates | - | - | - | - | - |
| Extract Visual Semantics via Vision LLM | - | - | Reviews | Creates | - | - | - | - |
| Stage Visual Markdown Description | - | - | - | Reviews | Creates | - | - | - |
| Cognitivize Visual Source with Sidecar Provenance | - | - | - | - | Reviews | Creates | - | - |
| Bind Visual Source to Target Entity | - | - | - | - | - | Reviews | Modifies | - |
| Validate Target Model | - | - | - | - | - | - | Validates | Creates |
