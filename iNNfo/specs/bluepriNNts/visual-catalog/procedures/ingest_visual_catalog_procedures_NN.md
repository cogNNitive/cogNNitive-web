---
level: 3
parent_spec:
  name: "procedures"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Ingest Visual Catalog Procedure"
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

## NN Procedure: Ingest Visual Catalog
category:: ingestion
summary:: Turn raw visual sources into a validated `visual-catalog` catalogue: normalize the source, derive and hash an optimized companion (double-hash discipline), extract Entries/Categories/Evidence, deduplicate by stable keys, upsert idempotently, wire the Entry x Evidence cells and markers, then validate and report.
inputs_required:: Raw visual files in sources/import/, target `visual-catalog` L3 catalogue document
outputs_expected:: [[Updated Visual Catalog]], [[Ingestion Report]]
executed_by:: Catalog Maintainer
procedure_model:: procedures/ingest_visual_catalog_procedures_NN.md

# NN Work

## NN Work: Ingest Visual Catalog Workflow
step_type:: task
next:: [[Normalize Source]]
condition:: Visual files are present in sources/import/ and a target catalogue document exists
input:: [[Raw Visual Sources]]
output:: [[Updated Visual Catalog]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Orchestrate catalog-specific ingestion end to end. Normalize each raw source, derive and record the original/derivative hash pair, extract candidate Entries, Categories, and Evidence, deduplicate by stable key, upsert without duplicating, wire matrix cells and markers, validate, and report. This procedure **references and does not duplicate** `iNNfo/specs/bluepriNNts/workspace/procedures/import_and_analyze_visual_source_NN.md`, which owns the generic normalize / hash / vision-extraction / companion-media mechanics; only the catalog-specific identity, dedupe, upsert, and double-hash verification steps are added here.

## NN Work: Normalize Source
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: task
next:: [[Derive and Optimize Derivative]]
condition:: A raw visual file is staged in sources/import/
input:: [[Raw Visual Sources]]
output:: [[Normalized Source]]
output_status:: verified
tool:: [[nn-trannsform Scanner]]
scope:: internal
Run the `nn-trannsform` scanner (as specified by the `workspace` visual-import SOP) to produce `sources/nn/<stem>.md` with mandatory frontmatter `source_file` (path to the ORIGINAL), `sha256` (hash of the ORIGINAL), `size_bytes`, `normalized_at`, and `normalized_by`. Do not restate the scanner mechanics here — invoke the workspace procedure.

## NN Work: Derive and Optimize Derivative
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: task
next:: [[Extract Entities]]
condition:: A normalized source exists
input:: [[Normalized Source]]
output:: [[Normalized Source]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Create the optimized/derived image and record `media_file` (the companion derivative path) and `media_sha256` (the DERIVATIVE hash) on the SAME normalized-source frontmatter. The pair `sha256` (original) + `media_sha256` (derivative) is the double-hash discipline: keep it complete or explicitly absent — never a placeholder.

## NN Work: Extract Entities
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: task
next:: [[Resolve and Deduplicate]]
condition:: Normalized source with its media companion is available
input:: [[Normalized Source]]
output:: [[Candidate Entities]]
output_status:: verified
tool:: [[Vision Analysis Engine]]
scope:: external
Via an external Vision LLM / OCR, extract candidate Entries (the things), Categories (their taxonomy), and Evidence (the witness images). `Entry.name` MUST be a domain identity proposed from the image CONTENT — never derived from the image filename or path.

## NN Work: Resolve and Deduplicate
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: decision
next:: [[Upsert Idempotently]]
condition:: Candidate entities are extracted
input:: [[Candidate Entities]]
output:: [[Resolved Entities]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Canonicalize `Entry.name` (normalize case and whitespace) and merge synonyms into one Entry. Collapse duplicate Evidence by image path (preferred) or normalized-source `sha256`. Resolve `Category` parents against the existing taxonomy. Unresolvable or conflicting candidates are reported rather than silently dropped.

## NN Work: Upsert Idempotently
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: task
next:: [[Wire Matrix Cells]]
condition:: Entities are resolved and deduplicated
input:: [[Resolved Entities]]
output:: [[Updated Visual Catalog]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Find-or-create every record by its deterministic key (see the Idempotency Keys table). Never append a new element when the key already exists — update the existing element in place. Re-ingesting the same source must be a no-op on element count.

## NN Work: Wire Matrix Cells
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: task
next:: [[Record Markers]]
condition:: Entries and Evidence are upserted
input:: [[Updated Visual Catalog]]
output:: [[Updated Visual Catalog]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Upsert the N:M `Entry x Evidence matrix` cell keyed by the `(entry, evidence)` tuple with one of `primary`, `visible`, or `partial`. Many Entries may share one Evidence; each cell is independent.

## NN Work: Record Markers
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: task
next:: [[Validate Catalog]]
condition:: Matrix cells are wired
input:: [[Updated Visual Catalog]]
output:: [[Updated Visual Catalog]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Write `confidence` (0–10, extraction certainty) and `review` (Reviewed / Pending) for each Entry via the `item-markers matrix`.

## NN Work: Validate Catalog
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: task
next:: [[Report Ingestion]]
condition:: The catalogue document is written
input:: [[Updated Visual Catalog]]
output:: [[Validated Visual Catalog]]
output_status:: verified
tool:: [[innfo-mcp]]
scope:: internal
Run innfo-mcp `validate_knowledge` on the catalogue to confirm zero schema or reference errors, then run `resolve_sources` on every Evidence `source` to confirm the citation resolves and to read back the `sha256` / `media_sha256` provenance. Verify the hash-pair discipline: when both hashes are present on the cited normalized source, the on-disk original must match `sha256`. Any failure stops the procedure before the report.

## NN Work: Report Ingestion
parent:: [[Ingest Visual Catalog Workflow]]
step_type:: task
condition:: The catalogue validated clean
input:: [[Validated Visual Catalog]]
output:: [[Ingestion Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Emit an ingestion report: sources processed, Entries/Categories/Evidence created vs updated, cells wired, markers recorded, and any dedupe or hash warnings surfaced during the run.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Coordinates catalog-specific extraction, resolution, upsert, and reporting.

## NN Tools: nn-trannsform Scanner
type:: automated
description:: Deterministic scanner producing normalized `sources/nn/` Markdown with origin + original-hash frontmatter (referenced from the workspace visual-import SOP).

## NN Tools: Vision Analysis Engine
type:: external
description:: External multimodal Vision LLM / OCR engine extracting candidate Entries, Categories, and Evidence from images.

## NN Tools: File Editor
type:: automated
description:: Writes derived media, catalogue elements, matrix cells, and markers, and updates the catalogue document (innfo-mcp).

## NN Tools: innfo-mcp
type:: automated
description:: Deterministic validation of the catalogue (`validate_knowledge`) and citation/hash resolution (`resolve_sources`).

# NN Artifact

## NN Artifact: Raw Visual Sources
type:: input
description:: The raw image files staged in sources/import/ (or sources/original/).

## NN Artifact: Normalized Source
type:: intermediate
description:: The `sources/nn/<stem>.md` file with original `sha256`, `size_bytes`, `normalized_at`, `normalized_by`, and the derived `media_file` + `media_sha256` companion.

## NN Artifact: Candidate Entities
type:: intermediate
description:: Candidate Entries, Categories, and Evidence extracted by the Vision engine before dedupe.

## NN Artifact: Resolved Entities
type:: intermediate
description:: Deduplicated, canonicalized Entries/Categories/Evidence keyed for upsert.

## NN Artifact: Updated Visual Catalog
type:: output
description:: The Level-3 `visual-catalog` document with upserted elements, matrix cells, and markers.

## NN Artifact: Validated Visual Catalog
type:: intermediate
description:: The catalogue after `validate_knowledge` and `resolve_sources` passed, including hash-pair verification.

## NN Artifact: Ingestion Report
type:: output
description:: A summary of the run: created vs updated counts, cells wired, markers recorded, and warnings.

# NN Roles

## NN Roles: Catalog Maintainer
type:: owner
description:: Owns the target catalogue scope, approves extracted entities and hash verification.

## NN Roles: iNNfo Agent
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
| Record Markers | Informed | Responsible |
| Validate Catalog | Accountable | Responsible |
| Report Ingestion | Informed | Responsible |

# NN matrices: work-tools matrix

| Work \ Tools | AI Agent | nn-trannsform Scanner | Vision Analysis Engine | File Editor | innfo-mcp |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Ingest Visual Catalog | Uses | - | - | - | - |
| Normalize Source | - | Uses | - | - | - |
| Derive and Optimize Derivative | - | - | - | Uses | - |
| Extract Entities | - | - | Uses | - | - |
| Resolve and Deduplicate | Uses | - | - | - | - |
| Upsert Idempotently | - | - | - | Uses | - |
| Wire Matrix Cells | - | - | - | Uses | - |
| Record Markers | - | - | - | Uses | - |
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
| Record Markers | - | - | - | - | Modifies | - | - |
| Validate Catalog | - | - | - | - | Reviews | Creates | - |
| Report Ingestion | - | - | - | - | - | Reviews | Creates |
