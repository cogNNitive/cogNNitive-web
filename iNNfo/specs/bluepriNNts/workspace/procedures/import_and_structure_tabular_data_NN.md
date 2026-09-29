---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-1-0"
title: "Tabular Data Import & Structure Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).
>
> **Experimental External Ingestion**: Structured tabular parsing and schema inference (CSV, XLSX, BI exports) are external helper processes assisted by the AI agent. cogNNitive natively manages normalized Markdown representations and semantic model population.

# NN index

* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Work

## NN Work: Import and Structure Tabular Data
step_type:: task
parent:: -
next:: -
condition:: Tabular data files (.csv, .xlsx, .json) present in import folder
input:: [[Raw Tabular Data Directory]]
output:: [[Verified Target Domain Model]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Ingest tabular files, inspect column schemas and records, normalize raw tables to Markdown under sources/nn/, map rows to semantic Level 3 domain elements (e.g., Costs, Revenue, Products, Inventory), and validate model integrity.

## NN Work: Discover Raw Tabular Files
parent:: [[Import and Structure Tabular Data]]
step_type:: task
next:: [[Verify and Deduplicate Tabular Sources]]
condition:: Ingestion workflow triggered
input:: [[Raw Tabular Data Directory]]
output:: [[Unprocessed Tabular List]]
output_status:: verified
tool:: [[Command Line Interface]]
scope:: internal
Scan sources/import/ or drop folders for tabular spreadsheets (.xlsx, .csv, .tsv, .json).

## NN Work: Verify and Deduplicate Tabular Sources
parent:: [[Import and Structure Tabular Data]]
step_type:: decision
next:: [[Parse and Synthesize Tabular Schema]]
condition:: Tabular list generated
input:: [[Unprocessed Tabular List]]
output:: [[Verified Tabular Ingestion Queue]]
output_status:: verified
tool:: [[Command Line Interface]]
scope:: internal
Compute SHA-256 hashes of tabular files to ensure updated or new files only are processed.

## NN Work: Parse and Synthesize Tabular Schema
parent:: [[Import and Structure Tabular Data]]
step_type:: task
next:: [[Map Table Rows to Domain Model Elements]]
condition:: Ingestion queue validated
input:: [[Verified Tabular Ingestion Queue]]
output:: [[Tabular Schema and Data Summary]]
output_status:: verified
tool:: [[Tabular Data Parser]]
scope:: external
Parse tabular columns, data types, header rows, and aggregated statistical summaries using external data parsing tools.

## NN Work: Map Table Rows to Domain Model Elements
parent:: [[Import and Structure Tabular Data]]
step_type:: decision
next:: [[Normalize Tabular Source to Markdown]]
condition:: Schema parsed
input:: [[Tabular Schema and Data Summary]]
output:: [[Model Entity Mapping Plan]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Map table columns to concept fields and table rows to target Level 3 model elements. Confirm field mappings with the workspace maintainer.

## NN Work: Normalize Tabular Source to Markdown
parent:: [[Import and Structure Tabular Data]]
step_type:: task
next:: [[Populate and Bind Domain Model Elements]]
condition:: Mapping plan approved
input:: [[Model Entity Mapping Plan]]
output:: [[Normalized Markdown Sources]]
output_status:: verified
tool:: [[nn-trannsform Scanner]]
scope:: internal
Convert raw tabular files into structured Markdown tables under sources/nn/ with scanner provenance frontmatter.

## NN Work: Populate and Bind Domain Model Elements
parent:: [[Import and Structure Tabular Data]]
step_type:: task
next:: [[Validate Target Model]]
condition:: Normalized table created
input:: [[Normalized Markdown Sources]]
output:: [[Updated Domain Model]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Instantiate or update Level 3 model elements with properties extracted from table rows and bind provenance citations in sources::.

## NN Work: Validate Target Model
parent:: [[Import and Structure Tabular Data]]
step_type:: task
next:: -
condition:: Domain model populated
input:: [[Updated Domain Model]]
output:: [[Verified Target Domain Model]]
output_status:: verified
tool:: [[innfo-mcp]]
scope:: internal
Validate the populated domain model using innfo-mcp to ensure reference integrity and schema compliance.

# NN Tools

## NN Tools: AI Agent
scope:: internal
LLM agent orchestrating schema mapping, record synthesis, and model instantiation.

## NN Tools: Command Line Interface
scope:: internal
Terminal environment for directory inspection and hash calculations.

## NN Tools: Tabular Data Parser
scope:: external
Parser tool (e.g. csv/xlsx parser, python script) reading tabular structures.

## NN Tools: nn-trannsform Scanner
scope:: internal
Scanner converting tabular sources into normalized Markdown with provenance.

## NN Tools: File Editor
scope:: internal
Tool for writing models and updating semantic definitions.

## NN Tools: innfo-mcp
scope:: internal
Deterministic validation engine for iNNfo models.

# NN Artifact

## NN Artifact: Raw Tabular Data Directory
type:: spec
format:: directory
Input folder with raw tabular spreadsheets (.xlsx, .csv).

## NN Artifact: Unprocessed Tabular List
type:: data
format:: json
List of discovered tabular files pending parsing.

## NN Artifact: Verified Tabular Ingestion Queue
type:: data
format:: json
Deduplicated list of spreadsheets.

## NN Artifact: Tabular Schema and Data Summary
type:: deliverable
format:: markdown
Parsed column definitions, record previews, and summaries.

## NN Artifact: Model Entity Mapping Plan
type:: spec
format:: markdown
Mapping between tabular columns/rows and Level 3 concepts/elements.

## NN Artifact: Normalized Markdown Sources
type:: spec
format:: markdown
Traceable Markdown files in sources/nn/ containing formatted tables.

## NN Artifact: Updated Domain Model
type:: spec
format:: markdown
Domain model file populated with elements derived from tabular records.

## NN Artifact: Verified Target Domain Model
type:: report
format:: status
Validation report from innfo-mcp confirming model integrity.

# NN Roles

## NN Roles: iNNfo Agent
scope:: internal
AI agent executing parsing, mapping, and model population tasks.

## NN Roles: Workspace Maintainer
scope:: external
Human maintainer confirming column mappings and approving model changes.

# NN matrices: work-roles matrix

| Work \ Roles | iNNfo Agent | Workspace Maintainer |
| :--- | :---: | :---: |
| Import and Structure Tabular Data | Responsible | Accountable |
| Discover Raw Tabular Files | Responsible | Informed |
| Verify and Deduplicate Tabular Sources | Responsible | Informed |
| Parse and Synthesize Tabular Schema | Responsible | Informed |
| Map Table Rows to Domain Model Elements | Responsible | Accountable |
| Normalize Tabular Source to Markdown | Responsible | Informed |
| Populate and Bind Domain Model Elements | Responsible | Accountable |
| Validate Target Model | Responsible | Informed |

# NN matrices: work-tools matrix

| Work \ Tools | AI Agent | Command Line Interface | Tabular Data Parser | nn-trannsform Scanner | File Editor | innfo-mcp |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Structure Tabular Data | Uses | - | - | - | - | - |
| Discover Raw Tabular Files | - | Uses | - | - | - | - |
| Verify and Deduplicate Tabular Sources | - | Uses | - | - | - | - |
| Parse and Synthesize Tabular Schema | - | - | Uses | - | - | - |
| Map Table Rows to Domain Model Elements | Uses | - | - | - | - | - |
| Normalize Tabular Source to Markdown | - | - | - | Uses | - | - |
| Populate and Bind Domain Model Elements | - | - | - | - | Uses | - |
| Validate Target Model | - | - | - | - | - | Uses |

# NN matrices: work-artifacts matrix

| Work \ Artifact | Raw Tabular Data Directory | Unprocessed Tabular List | Verified Tabular Ingestion Queue | Tabular Schema and Data Summary | Model Entity Mapping Plan | Normalized Markdown Sources | Updated Domain Model | Verified Target Domain Model |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Import and Structure Tabular Data | Reviews | - | - | - | - | - | - | Creates |
| Discover Raw Tabular Files | Reviews | Creates | - | - | - | - | - | - |
| Verify and Deduplicate Tabular Sources | - | Reviews | Creates | - | - | - | - | - |
| Parse and Synthesize Tabular Schema | - | - | Reviews | Creates | - | - | - | - |
| Map Table Rows to Domain Model Elements | - | - | - | Reviews | Creates | - | - | - |
| Normalize Tabular Source to Markdown | - | - | - | - | Reviews | Creates | - | - |
| Populate and Bind Domain Model Elements | - | - | - | - | - | Reviews | Modifies | - |
| Validate Target Model | - | - | - | - | - | - | Validates | Creates |