---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-1-0"
title: "Visual Source Import & Semantic Analysis Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).
>
> **Experimental External Ingestion**: OCR and visual diagram analysis (Vision LLM / OCR tools) are external helper processes assisted by the AI agent or user environment. cogNNitive natively manages the resulting normalized Markdown and provenance tracing.

# NN index

* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Work

## NN Work: Import and Analyze Visual Sources
step_type:: task
parent:: -
next:: -
condition:: Visual files, diagrams, or mockups present in import folder
input:: [[Raw Visual Sources Directory]]
output:: [[Verified Target Domain Model]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Ingest visual assets (diagrams, architecture charts, UI mockups, whiteboards), extract structured semantic descriptions via external Vision LLM / OCR, normalize into sources/nn/ with companion image linking in assets/, bind to target domain model elements, and validate integrity.

## NN Work: Discover Raw Visual Files
parent:: [[Import and Analyze Visual Sources]]
step_type:: task
next:: [[Verify and Deduplicate Visual Sources]]
condition:: Ingestion workflow triggered
input:: [[Raw Visual Sources Directory]]
output:: [[Unprocessed Visual List]]
output_status:: verified
tool:: [[Command Line Interface]]
scope:: internal
Scan sources/import/ or drop directories for visual files (.png, .jpg, .svg, .webp) that require semantic extraction.

## NN Work: Verify and Deduplicate Visual Sources
parent:: [[Import and Analyze Visual Sources]]
step_type:: decision
next:: [[Extract Visual Semantics via Vision LLM]]
condition:: Visual list generated
input:: [[Unprocessed Visual List]]
output:: [[Verified Visual Ingestion Queue]]
output_status:: verified
tool:: [[Command Line Interface]]
scope:: internal
Compute SHA-256 hashes of visual assets to avoid re-analyzing images already registered in sources/nn/ or assets/.

## NN Work: Extract Visual Semantics via Vision LLM
parent:: [[Import and Analyze Visual Sources]]
step_type:: task
next:: [[Stage Visual Markdown Description]]
condition:: Ingestion queue verified
input:: [[Verified Visual Ingestion Queue]]
output:: [[Structured Visual Description]]
output_status:: verified
tool:: [[Vision Analysis Engine]]
scope:: external
Analyze images via Vision LLM or OCR to extract architecture components, relationships, UI elements, text annotations, and layout hierarchy in structured Markdown format.

## NN Work: Stage Visual Markdown Description
parent:: [[Import and Analyze Visual Sources]]
step_type:: task
next:: [[Normalize Visual Source with Media Link]]
condition:: Visual semantics extracted
input:: [[Structured Visual Description]]
output:: [[Staged Visual Import Files]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Stage generated Markdown description in sources/import/ and ensure the companion image is preserved or copied into assets/.

## NN Work: Normalize Visual Source with Media Link
parent:: [[Import and Analyze Visual Sources]]
step_type:: task
next:: [[Bind Visual Source to Target Entity]]
condition:: Visual description staged
input:: [[Staged Visual Import Files]]
output:: [[Normalized Markdown Sources]]
output_status:: verified
tool:: [[nn-trannsform Scanner]]
scope:: internal
Run nn-trannsform scanner to produce sources/nn/ Markdown with media_file companion frontmatter pointing to the image asset.

## NN Work: Bind Visual Source to Target Entity
parent:: [[Import and Analyze Visual Sources]]
step_type:: task
next:: [[Validate Target Model]]
condition:: Normalized source created
input:: [[Normalized Markdown Sources]]
output:: [[Updated Domain Model]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Add normalized visual source citations to the sources:: field of the corresponding concept element (e.g. Solutions, Features, Infrastructure) in the domain model.

## NN Work: Validate Target Model
parent:: [[Import and Analyze Visual Sources]]
step_type:: task
next:: -
condition:: Domain model updated
input:: [[Updated Domain Model]]
output:: [[Verified Target Domain Model]]
output_status:: verified
tool:: [[innfo-mcp]]
scope:: internal
Validate the updated domain model using innfo-mcp to ensure zero broken references or schema errors.

# NN Tools

## NN Tools: AI Agent
scope:: internal
LLM agent coordinating the visual import and domain enrichment workflow.

## NN Tools: Command Line Interface
scope:: internal
Terminal environment for directory inspection and hash verification.

## NN Tools: Vision Analysis Engine
scope:: external
External multimodal Vision LLM or OCR engine generating textual descriptions from images.

## NN Tools: nn-trannsform Scanner
scope:: internal
Deterministic scanner creating normalized Markdown files with origin metadata.

## NN Tools: File Editor
scope:: internal
Tool for writing staged files and modifying domain models.

## NN Tools: innfo-mcp
scope:: internal
Deterministic validation tool for iNNfo models.

# NN Artifact

## NN Artifact: Raw Visual Sources Directory
type:: spec
format:: directory
Input folder with raw images (.png, .jpg, .svg).

## NN Artifact: Unprocessed Visual List
type:: data
format:: json
List of image assets pending semantic extraction.

## NN Artifact: Verified Visual Ingestion Queue
type:: data
format:: json
Deduplicated list of images ready for analysis.

## NN Artifact: Structured Visual Description
type:: deliverable
format:: markdown
Textual representation of the diagram or UI extracted by the vision engine.

## NN Artifact: Staged Visual Import Files
type:: data
format:: directory
Markdown files staged in sources/import/ alongside asset references.

## NN Artifact: Normalized Markdown Sources
type:: spec
format:: markdown
Traceable Markdown files in sources/nn/ referencing media_file companions.

## NN Artifact: Updated Domain Model
type:: spec
format:: markdown
Domain model file enriched with visual source citations.

## NN Artifact: Verified Target Domain Model
type:: report
format:: status
Validation confirmation confirming model integrity.

# NN Roles

## NN Roles: iNNfo Agent
scope:: internal
AI agent executing procedural tasks and model updates.

## NN Roles: Workspace Maintainer
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
| Normalize Visual Source with Media Link | Responsible | Informed |
| Bind Visual Source to Target Entity | Responsible | Accountable |
| Validate Target Model | Responsible | Informed |

# NN matrices: work-tools matrix

| Work \ Tools | AI Agent | Command Line Interface | Vision Analysis Engine | nn-trannsform Scanner | File Editor | innfo-mcp |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Analyze Visual Sources | Uses | - | - | - | - | - |
| Discover Raw Visual Files | - | Uses | - | - | - | - |
| Verify and Deduplicate Visual Sources | - | Uses | - | - | - | - |
| Extract Visual Semantics via Vision LLM | - | - | Uses | - | - | - |
| Stage Visual Markdown Description | - | - | - | - | Uses | - |
| Normalize Visual Source with Media Link | - | - | - | Uses | - | - |
| Bind Visual Source to Target Entity | - | - | - | - | Uses | - |
| Validate Target Model | - | - | - | - | - | Uses |

# NN matrices: work-artifacts matrix

| Work \ Artifact | Raw Visual Sources Directory | Unprocessed Visual List | Verified Visual Ingestion Queue | Structured Visual Description | Staged Visual Import Files | Normalized Markdown Sources | Updated Domain Model | Verified Target Domain Model |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Analyze Visual Sources | Reviews | - | - | - | - | - | - | Creates |
| Discover Raw Visual Files | Reviews | Creates | - | - | - | - | - | - |
| Verify and Deduplicate Visual Sources | - | Reviews | Creates | - | - | - | - | - |
| Extract Visual Semantics via Vision LLM | - | - | Reviews | Creates | - | - | - | - |
| Stage Visual Markdown Description | - | - | - | Reviews | Creates | - | - | - |
| Normalize Visual Source with Media Link | - | - | - | - | Reviews | Creates | - | - |
| Bind Visual Source to Target Entity | - | - | - | - | - | Reviews | Modifies | - |
| Validate Target Model | - | - | - | - | - | - | Validates | Creates |