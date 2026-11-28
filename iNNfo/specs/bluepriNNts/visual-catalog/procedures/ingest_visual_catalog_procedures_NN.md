---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-5-0"
title: "Ingest Visual Catalog Procedure"
---

# NN Procedure

## NN Procedure: Ingest Visual Catalog
slug:: ingest-visual-catalog
category:: ingestion
summary:: Turn raw visual sources into a validated `visual-catalog` catalogue: stage raw images in sources/import/, establish provenance via co-located sidecars and original_ref, extract Entries/Categories/Evidence, deduplicate by stable keys, upsert idempotently, wire the Entry x Evidence cells and markers, then validate and report.
inputs_required:: Raw visual files in sources/import/, target `visual-catalog` L3 catalogue document
outputs_expected:: [[Updated Visual Catalog]], [[Ingestion Report]]
Orchestrate catalog-specific ingestion end to end. Stage raw visual sources in sources/import/, establish provenance via co-located sidecars and original_ref, extract candidate Entries, Categories, and Evidence, deduplicate by stable key, upsert without duplicating, wire matrix cells and markers, validate, and report. This procedure **references and does not duplicate** `iNNfo/specs/bluepriNNts/workspace/procedures/import_and_analyze_visual_source_procedures_NN.md`, which owns the generic image staging, sidecar provenance, and vision-extraction mechanics; only the catalog-specific identity, dedupe, upsert, and provenance verification steps are added here.

It starts when: Visual files are present in sources/import/ and a target catalogue document exists.

### NN Work: Normalize Source
slug:: normalize-source
step_type:: task
next:: @derive-and-optimize-derivative
condition:: A raw visual file is staged in sources/import/
input:: @raw-visual-sources
output:: @normalized-source
output_status:: verified
tool:: @nn-sources-ingestion-engine
executor:: agent
scope:: internal
Stage raw visual sources in sources/import/ and cognitivize them in place via `process-images` or `nn-sources` to generate co-located sidecars recording original sha256, dimensions, and origin metadata. Images remain raw assets without text conversion.

### NN Work: Derive and Optimize Derivative
slug:: derive-and-optimize-derivative
step_type:: task
next:: @extract-entities
condition:: A normalized source exists
input:: @normalized-source
output:: @normalized-source
output_status:: verified
tool:: @file-editor
executor:: agent
scope:: internal
Create optimized/derived images under artifacts/photos/ or the owning model's assets/ folder, keeping traceability back to original_ref and its co-located sidecar.

### NN Work: Extract Entities
slug:: extract-entities
step_type:: task
next:: @resolve-and-deduplicate
condition:: Normalized source with its media companion is available
input:: @normalized-source
output:: @candidate-entities
output_status:: verified
tool:: @vision-analysis-engine
executor:: agent
scope:: external
Via an external Vision LLM / OCR, extract candidate Entries (the things), Categories (their taxonomy), and Evidence (the witness images). `Entry.name` MUST be a domain identity proposed from the image CONTENT — never derived from the image filename or path.

### NN Work: Resolve and Deduplicate
slug:: resolve-and-deduplicate
step_type:: decision
next:: @upsert-idempotently
decision:: which Entry each candidate resolves to once names are canonicalized, and which duplicates collapse by image path or normalized-source sha256
condition:: Candidate entities are extracted
input:: @candidate-entities
output:: @resolved-entities
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Canonicalize `Entry.name` (normalize case and whitespace) and merge synonyms into one Entry. Collapse duplicate Evidence by image path (preferred) or normalized-source `sha256`. Resolve `Category` parents against the existing taxonomy. Unresolvable or conflicting candidates are reported rather than silently dropped.

### NN Work: Upsert Idempotently
slug:: upsert-idempotently
step_type:: task
next:: @wire-matrix-cells
condition:: Entities are resolved and deduplicated
input:: @resolved-entities
output:: @updated-visual-catalog
output_status:: verified
tool:: @file-editor
executor:: agent
scope:: internal
Find-or-create every record by its deterministic key (see the Idempotency Keys table). Never append a new element when the key already exists — update the existing element in place. Re-ingesting the same source must be a no-op on element count.

### NN Work: Wire Matrix Cells
slug:: wire-matrix-cells
step_type:: task
next:: @record-confidence-and-review
condition:: Entries and Evidence are upserted
input:: @updated-visual-catalog
output:: @updated-visual-catalog
output_status:: verified
tool:: @file-editor
executor:: agent
scope:: internal
Upsert the N:M `Entry x Evidence matrix` cell keyed by the `(entry, evidence)` tuple with one of `primary`, `visible`, or `partial`. Many Entries may share one Evidence; each cell is independent.

### NN Work: Record Confidence and Review
slug:: record-confidence-and-review
step_type:: task
next:: @validate-catalog
condition:: Matrix cells are wired
input:: @updated-visual-catalog
output:: @updated-visual-catalog
output_status:: verified
tool:: @file-editor
executor:: agent
scope:: internal
Write `confidence` (0–10 score, extraction certainty) as an Entry field value and `tags:: [reviewed]` for each verified Entry.

### NN Work: Validate Catalog
slug:: validate-catalog
step_type:: task
next:: @report-ingestion
condition:: The catalogue document is written
input:: @updated-visual-catalog
output:: @validated-visual-catalog
output_status:: verified
tool:: @nn-mcp
executor:: agent
scope:: internal
Run nn-mcp `validate_knowledge` on the catalogue to confirm zero schema or reference errors, then run `resolve_sources` on every Evidence `source` to confirm the citation resolves and to read back the `sha256` / `media_sha256` provenance. Verify the hash-pair discipline: when both hashes are present on the cited normalized source, the on-disk original must match `sha256`. Any failure stops the procedure before the report.

### NN Work: Report Ingestion
slug:: report-ingestion
step_type:: task
condition:: The catalogue validated clean
input:: @validated-visual-catalog
output:: @ingestion-report
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Emit an ingestion report: sources processed, Entries/Categories/Evidence created vs updated, cells wired, markers recorded, and any dedupe or hash warnings surfaced during the run.

# NN index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]



# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Coordinates catalog-specific extraction, resolution, upsert, and reporting.

## NN Tools: nn-sources Ingestion Engine
slug:: nn-sources-ingestion-engine
type:: automated
description:: Ingestion engine providing in-place cognitivize and process-images for raw media sidecar provenance.

## NN Tools: Vision Analysis Engine
slug:: vision-analysis-engine
type:: external
description:: External multimodal Vision LLM / OCR engine extracting candidate Entries, Categories, and Evidence from images.

## NN Tools: File Editor
slug:: file-editor
type:: automated
description:: Writes derived media, catalogue elements, matrix cells, and markers, and updates the catalogue document (nn-mcp).

## NN Tools: nn-mcp
slug:: nn-mcp
type:: automated
description:: Deterministic validation of the catalogue (`validate_knowledge`) and citation/hash resolution (`resolve_sources`).

# NN Artifact

## NN Artifact: Raw Visual Sources
slug:: raw-visual-sources
type:: input
description:: The raw image files staged in sources/import/ .

## NN Artifact: Normalized Source
slug:: normalized-source
type:: intermediate
description:: The raw image in sources/import/ alongside its co-located sidecar recording sha256, size_bytes, and metadata.

## NN Artifact: Candidate Entities
slug:: candidate-entities
type:: intermediate
description:: Candidate Entries, Categories, and Evidence extracted by the Vision engine before dedupe.

## NN Artifact: Resolved Entities
slug:: resolved-entities
type:: intermediate
description:: Deduplicated, canonicalized Entries/Categories/Evidence keyed for upsert.

## NN Artifact: Updated Visual Catalog
slug:: updated-visual-catalog
type:: output
description:: The Level-3 `visual-catalog` document with upserted elements, matrix cells, and markers.

## NN Artifact: Validated Visual Catalog
slug:: validated-visual-catalog
type:: intermediate
description:: The catalogue after `validate_knowledge` and `resolve_sources` passed, including hash-pair verification.

## NN Artifact: Ingestion Report
slug:: ingestion-report
type:: output
description:: A summary of the run: created vs updated counts, cells wired, markers recorded, and warnings.

# NN Roles

## NN Roles: Catalog Maintainer
slug:: catalog-maintainer
type:: owner
description:: Owns the target catalogue scope, approves extracted entities and hash verification.

## NN Roles: iNNfo Agent
slug:: innfo-agent
type:: internal
description:: Executes the procedure steps and updates the catalogue.

# NN matrices: work-roles matrix

| Work \ Roles | Catalog Maintainer | iNNfo Agent |
| :--- | :---: | :---: |
| Ingest Visual Catalog | Accountable | Responsible |
| Normalize Source | Informed | Responsible |
| Derive and Optimize Derivative | Informed | Responsible |
| Extract Entities | Informed | Responsible |
| Resolve and Deduplicate | Accountable | Responsible |
| Upsert Idempotently | Informed | Responsible |
| Wire Matrix Cells | Informed | Responsible |
| Record Confidence and Review | Informed | Responsible |
| Validate Catalog | Accountable | Responsible |
| Report Ingestion | Informed | Responsible |

# NN matrices: work-tools matrix

| Work \ Tools | AI Agent | nn-sources Ingestion Engine | Vision Analysis Engine | File Editor | nn-mcp |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Ingest Visual Catalog | Uses | - | - | - | - |
| Normalize Source | - | Uses | - | - | - |
| Derive and Optimize Derivative | - | - | - | Uses | - |
| Extract Entities | - | - | Uses | - | - |
| Resolve and Deduplicate | Uses | - | - | - | - |
| Upsert Idempotently | - | - | - | Uses | - |
| Wire Matrix Cells | - | - | - | Uses | - |
| Record Confidence and Review | - | - | - | Uses | - |
| Validate Catalog | - | - | - | - | Uses |
| Report Ingestion | Uses | - | - | - | - |

# NN matrices: work-artifacts matrix

| Work \ Artifact | Raw Visual Sources | Normalized Source | Candidate Entities | Resolved Entities | Updated Visual Catalog | Validated Visual Catalog | Ingestion Report |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Ingest Visual Catalog | Reviews | - | - | - | - | - | Creates |
| Normalize Source | Reviews | Creates | - | - | - | - | - |
| Derive and Optimize Derivative | - | Modifies | - | - | - | - | - |
| Extract Entities | - | Reviews | Creates | - | - | - | - |
| Resolve and Deduplicate | - | - | Reviews | Creates | - | - | - |
| Upsert Idempotently | - | - | - | Reviews | Modifies | - | - |
| Wire Matrix Cells | - | - | - | - | Modifies | - | - |
| Record Confidence and Review | - | - | - | - | Modifies | - | - |
| Validate Catalog | - | - | - | - | Reviews | Creates | - |
| Report Ingestion | - | - | - | - | - | Reviews | Creates |
