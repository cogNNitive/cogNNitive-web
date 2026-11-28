---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Tabular Data Import & Structure Procedure"
---

>
> **Experimental External Ingestion**: Structured tabular parsing and schema inference (CSV, XLSX, BI exports) are external helper processes assisted by the AI agent. cogNNitive natively manages normalized Markdown representations and semantic model population.

# NN Procedure

## NN Procedure: Import and Structure Tabular Data
slug:: import-and-structure-tabular-data
summary:: Ingest tabular files, inspect column schemas and records, normalize raw tables to Markdown under sources/nn/, map rows to semantic Level 3 domain elements (e.g., Costs, Revenue, Products, Inventory), and validate model integrity.
inputs_required:: @raw-tabular-data-directory
outputs_expected:: @verified-target-domain-model

It starts when: Tabular data files (.csv, .xlsx, .json) present in import folder.

### NN Work: Discover Raw Tabular Files
slug:: discover-raw-tabular-files
step_type:: task
next:: @verify-and-deduplicate-tabular-sources
condition:: Ingestion workflow triggered
input:: @raw-tabular-data-directory
output:: @unprocessed-tabular-list
output_status:: verified
tool:: @command-line-interface
executor:: agent
scope:: internal
Scan sources/import/ or drop folders for tabular spreadsheets (.xlsx, .csv, .tsv, .json).

### NN Work: Verify and Deduplicate Tabular Sources
slug:: verify-and-deduplicate-tabular-sources
step_type:: decision
next:: @parse-and-synthesize-tabular-schema
decision:: whether the queue holds any tabular file whose SHA-256 does not match an already processed file
condition:: Tabular list generated
input:: @unprocessed-tabular-list
output:: @verified-tabular-ingestion-queue
output_status:: verified
tool:: @command-line-interface
executor:: agent
scope:: internal
Compute SHA-256 hashes of tabular files to ensure updated or new files only are processed.

### NN Work: Parse and Synthesize Tabular Schema
slug:: parse-and-synthesize-tabular-schema
step_type:: task
next:: @map-table-rows-to-domain-model-elements
condition:: Ingestion queue validated
input:: @verified-tabular-ingestion-queue
output:: @tabular-schema-and-data-summary
output_status:: verified
tool:: @tabular-data-parser
executor:: agent
scope:: external
Parse tabular columns, data types, header rows, and aggregated statistical summaries using external data parsing tools.

### NN Work: Map Table Rows to Domain Model Elements
slug:: map-table-rows-to-domain-model-elements
step_type:: decision
next:: @normalize-tabular-source-to-markdown
decision:: which concept field each table column maps to and which model element each row becomes; the workspace maintainer confirms the mapping
condition:: Schema parsed
input:: @tabular-schema-and-data-summary
output:: @model-entity-mapping-plan
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Map table columns to concept fields and table rows to target Level 3 model elements. Confirm field mappings with the workspace maintainer.

### NN Work: Normalize Tabular Source to Markdown
slug:: normalize-tabular-source-to-markdown
step_type:: task
next:: @populate-and-bind-domain-model-elements
condition:: Mapping plan approved
input:: @model-entity-mapping-plan
output:: @normalized-markdown-sources
output_status:: verified
tool:: @nn-trannsform-scanner
executor:: agent
scope:: internal
Convert raw tabular files into structured Markdown tables under sources/nn/ with scanner provenance frontmatter.

### NN Work: Populate and Bind Domain Model Elements
slug:: populate-and-bind-domain-model-elements
step_type:: task
next:: @validate-target-model
condition:: Normalized table created
input:: @normalized-markdown-sources
output:: @updated-domain-model
output_status:: verified
tool:: @file-editor
executor:: agent
scope:: internal
Instantiate or update Level 3 model elements with properties extracted from table rows and bind provenance citations in sources::.

### NN Work: Validate Target Model
slug:: validate-target-model
step_type:: task
condition:: Domain model populated
input:: @updated-domain-model
output:: @verified-target-domain-model
output_status:: verified
tool:: @innfo-mcp
executor:: agent
scope:: internal
Validate the populated domain model using innfo-mcp to ensure reference integrity and schema compliance.

# NN index

* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]


# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
scope:: internal
LLM agent orchestrating schema mapping, record synthesis, and model instantiation.

## NN Tools: Command Line Interface
slug:: command-line-interface
scope:: internal
Terminal environment for directory inspection and hash calculations.

## NN Tools: Tabular Data Parser
slug:: tabular-data-parser
scope:: external
Parser tool (e.g. csv/xlsx parser, python script) reading tabular structures.

## NN Tools: nn-trannsform Scanner
slug:: nn-trannsform-scanner
scope:: internal
Scanner converting tabular sources into normalized Markdown with provenance.

## NN Tools: File Editor
slug:: file-editor
scope:: internal
Tool for writing models and updating semantic definitions.

## NN Tools: innfo-mcp
slug:: innfo-mcp
scope:: internal
Deterministic validation engine for iNNfo models.

# NN Artifact

## NN Artifact: Raw Tabular Data Directory
slug:: raw-tabular-data-directory
type:: spec
format:: directory
Input folder with raw tabular spreadsheets (.xlsx, .csv).

## NN Artifact: Unprocessed Tabular List
slug:: unprocessed-tabular-list
type:: data
format:: json
List of discovered tabular files pending parsing.

## NN Artifact: Verified Tabular Ingestion Queue
slug:: verified-tabular-ingestion-queue
type:: data
format:: json
Deduplicated list of spreadsheets.

## NN Artifact: Tabular Schema and Data Summary
slug:: tabular-schema-and-data-summary
type:: deliverable
format:: markdown
Parsed column definitions, record previews, and summaries.

## NN Artifact: Model Entity Mapping Plan
slug:: model-entity-mapping-plan
type:: spec
format:: markdown
Mapping between tabular columns/rows and Level 3 concepts/elements.

## NN Artifact: Normalized Markdown Sources
slug:: normalized-markdown-sources
type:: spec
format:: markdown
Traceable Markdown files in sources/nn/ containing formatted tables.

## NN Artifact: Updated Domain Model
slug:: updated-domain-model
type:: spec
format:: markdown
Domain model file populated with elements derived from tabular records.

## NN Artifact: Verified Target Domain Model
slug:: verified-target-domain-model
type:: report
format:: status
Validation report from innfo-mcp confirming model integrity.

# NN Roles

## NN Roles: iNNfo Agent
slug:: innfo-agent
scope:: internal
AI agent executing parsing, mapping, and model population tasks.

## NN Roles: Workspace Maintainer
slug:: workspace-maintainer
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
