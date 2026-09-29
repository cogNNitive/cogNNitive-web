---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/cogNNitive/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-0"
title: "cogNNitive Template"
relationship_types:
  hierarchy:
    enabled: true
    via: index block
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Sources]]
* [[ModelRecords]]
* [[Artifacts]]
* [[Procedures]]

# NN Concept Definition

## NN Concept Definition: Sources
icon:: file-input
type:: list
color:: teal
weight:: 90

## NN Concept Definition: ModelRecords
icon:: boxes
type:: list
color:: teal
weight:: 80

## NN Concept Definition: Artifacts
icon:: file-output
type:: list
color:: teal
weight:: 80

## NN Concept Definition: Procedures
icon:: workflow
type:: list
color:: teal
weight:: 60

# NN Field Definition

<!-- Sources: a raw input file ingested and normalized -->

## NN Field Definition: raw_filename
concept:: Sources
type:: string
description:: Original file name of the raw source, relative to the workspace (e.g. sources/nn/report.docx).

## NN Field Definition: raw_hash
concept:: Sources
type:: string
description:: SHA-256 content hash of the raw file (sha256:...). Stable identity for the source.

## NN Field Definition: size
concept:: Sources
type:: string
description:: Raw file size in bytes.

## NN Field Definition: source_format
concept:: Sources
type:: select
options:: [txt, md, csv, json, docx, pdf, xlsx]
description:: Detected format of the raw source file.

## NN Field Definition: normalized_at
concept:: Sources
type:: string
description:: ISO-8601 timestamp when the source was normalized to Markdown.

## NN Field Definition: normalized_by
concept:: Sources
type:: string
description:: Tool and version that produced the normalized content (e.g. traNNsform v1.5).

## NN Field Definition: normalized_content
concept:: Sources
type:: markdown_file
description:: The normalized Markdown extracted from the raw file (stored under sources/nn/). File-backed asset.

## NN Field Definition: raw_file
concept:: Sources
type:: file
description:: Optional copy of the original raw binary, retained for full reproducibility.

<!-- ModelRecords: a level-3 domain model produced from sources -->

## NN Field Definition: model_ref
concept:: ModelRecords
type:: string
description:: Link or path to the domain model file in the workspace (e.g. ./Business%20Plan_V_0-1-0_business_NN.md). See the cross-model note in the Specification section.

## NN Field Definition: model_template
concept:: ModelRecords
type:: string
description:: The level-2 template the domain model conforms to (e.g. business, organization, procedures).

## NN Field Definition: model_version
concept:: ModelRecords
type:: string
description:: Version of the produced domain model.

## NN Field Definition: derived_from
concept:: ModelRecords
type:: reference
target_concepts:: [Sources]
description:: The Sources this model was derived from (PROV wasDerivedFrom).

## NN Field Definition: generated_by
concept:: ModelRecords
type:: reference
target_concepts:: [Procedures]
description:: The Procedure run that produced this model (PROV wasGeneratedBy).

<!-- Artifacts: a derivative deliverable produced from sources and/or a model -->

## NN Field Definition: artifact_format
concept:: Artifacts
type:: select
options:: [document, report, board, dataset]
description:: Kind of artifact. "board" replaces the retired term "dashboard"; every generated deliverable is an Artifact.

## NN Field Definition: artifact_version
concept:: Artifacts
type:: string
description:: Version of the artifact.

## NN Field Definition: location
concept:: Artifacts
type:: string
description:: Path to the artifact within the workspace (e.g. artifacts/Executive_Summary_V_0-1-0.md).

## NN Field Definition: artifact_hash
concept:: Artifacts
type:: string
description:: Optional SHA-256 hash of the artifact for reproducibility.

## NN Field Definition: derived_from_inputs
concept:: Artifacts
type:: reference
target_concepts:: [Sources, ModelRecords]
description:: The immediate inputs this artifact was derived from — Sources and/or ModelRecords (PROV wasDerivedFrom).

## NN Field Definition: produced_by
concept:: Artifacts
type:: reference
target_concepts:: [Procedures]
description:: The Procedure run that produced this artifact (PROV wasGeneratedBy). Populated when a reproducible procedure is executed.

<!-- Procedures: the transformation activity that produced a Model or Artifact -->

## NN Field Definition: procedure_ref
concept:: Procedures
type:: string
description:: Link or path to the reusable procedure spec (e.g. procedures/Document_Ingest_V_1-0-0_procedures_NN.md).

## NN Field Definition: agent
concept:: Procedures
type:: string
description:: The agent that executed the procedure (tool and/or LLM, e.g. actioNN nn-trannsform + Claude).

## NN Field Definition: run_at
concept:: Procedures
type:: string
description:: ISO-8601 timestamp of the procedure run.

# NN Marker Definition

## NN Marker Definition: verified
applies_to:: [Element]
symbol:: >
icon:: shield-check
color:: green

# NN Matrix Definition

## NN Matrix Definition: Artifact-Source Lineage
source:: Artifacts
target:: Sources
values:: [X]
widget:: boolean
description:: Optional projection view of the `derived_from_inputs` references — which Artifact draws on which Source. The reference fields remain the single source of truth; this matrix is a convenience visualization.

# cogNNitive Template

## A provenance and lineage template that registers the sources ingested and the artifacts and models produced by the cogNNitive pipeline, with explicit derivation edges

## Philosophy

The cogNNitive template treats ingestion and generation as a lineage graph rather than a folder of loose files. It follows the W3C PROV model: **Sources**, **ModelRecords**, and **Artifacts** are entities; **Procedures** are activities; and derivation is recorded as explicit directed edges (`derived_from`, `generated_by`) rather than inferred from folder layout. This makes every generated deliverable auditable back to the exact raw inputs and the run that produced it.

## Objectives

1. Give a stable identity (content hash + name) to every raw Source ingested by cogNNitive, and carry its normalized Markdown as a file-backed asset.
2. Register every produced Model and Artifact as a first-class entity with explicit derivation edges to its inputs.
3. Record the Procedure (activity) that generated each Model or Artifact, so runs are reproducible.
4. Keep all lineage edges as reference fields (PROV-style), not matrices, so they stay sparse, directional, and engine-validated.
5. Retire the terms "dashboard" and "export": every generated deliverable is an **Artifact**; its kind is a field value.

## Specification

The template instantiates the four root primitives of the Metaplantilla Nivel 1: **Concept Definition**, **Field Definition**, **Marker Definition**, and **Matrix Definition**. Its schema is resolved from the body elements of this document, not from frontmatter blocks.

### Concepts

| Concept | PROV role | Purpose |
|---|---|---|
| **Sources** | Entity | A raw input file ingested and normalized (hash, name, format, normalized content). |
| **ModelRecords** | Entity | A level-3 domain model produced from Sources. |
| **Artifacts** | Entity | A derivative deliverable (document, report, board, dataset) produced from Sources and/or ModelRecords. |
| **Procedures** | Activity | The transformation run that produced a Model or Artifact. |

### Lineage mechanism (why references, not matrices)

Lineage is **sparse and directional**, so it is modeled with `reference` fields — the iNNfo analog of PROV `wasDerivedFrom` / `wasGeneratedBy` and OpenLineage `inputs` / `outputs`:

- `ModelRecords.derived_from` → Sources
- `ModelRecords.generated_by` → Procedures
- `Artifacts.derived_from_inputs` → Sources and/or ModelRecords
- `Artifacts.produced_by` → Procedures

Because Sources, ModelRecords, Artifacts, and Procedures all live in this one provenance model, these edges are **intra-model references**, which the engine validates today. Evaluable matrices are reserved for **dense N×M** relations within a model and there are **no cross-model matrices** in iNNfo; the optional `Artifact-Source Lineage` matrix is only a projection view of the reference fields.

The derivation graph is a **DAG, not a fixed chain**: an Artifact may derive from a Model, directly from Sources, or both. Do not assume a fixed `Source → Procedure → Model → Artifact` order — record each entity's immediate inputs and let the graph be what it is.

### Cross-model note (implementation caveat)

`ModelRecords.model_ref` points at the actual domain model file. iNNfo supports qualified cross-workspace references (`Model :: Name`), but the reference **validator currently checks intra-model references only** — persisted cross-model reference validation is not yet implemented in `innfo-core`. Until it is, keep `model_ref` as a Markdown link / path (or the model `title`) rather than relying on a validated `Model :: Name` reference.

### Element / claim-level provenance

Provenance **within** a domain model (which Source backs a specific Element) is intentionally out of scope for this template, because a domain Element can only carry fields its own template declares. Fine-grained, claim-level provenance stays in the existing citation mechanism (`<!-- cite: sources/nn/file.md#heading-slug -->` + visible source) used in drafts and artifacts. A domain template MAY later opt in to a `source` reference field on its concepts.

### Markers

| Marker | Symbol | Purpose |
|---|---|---|
| `verified` | `>` | Human-verified provenance record (hash and derivation confirmed). |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | Optional `Artifact-Source Lineage` projection |
| Graph edge | ❌ | Not applicable (lineage uses reference fields) |
| Sequence | ❌ | Not applicable |

## Template

### Level 3 Model Template (Lightweight)

A cogNNitive provenance model is associated with each workspace/model, named `<Workspace>_V_x-y-z_cogNNitive_NN.md` and listed in the workspace `index.md`:

```yaml
---
level: 3
parent_spec:
  name: "cogNNitive"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/cogNNitive/spec_NN.md"
model_version: "V_x-y-z"
title: "<Workspace> Provenance"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN index
* [[Sources]]
* [[ModelRecords]]
* [[Artifacts]]
* [[Procedures]]

# NN Sources
## NN Sources: report.docx
raw_filename:: sources/nn/report.docx
raw_hash:: sha256:1f3a...c9
size:: 48213
source_format:: docx
normalized_at:: 2026-08-01T10:12:00Z
normalized_by:: traNNsform v1.5
normalized_content:: report.md

# NN Procedures
## NN Procedures: Business ingest run 2026-08-01
procedure_ref:: procedures/Document_Ingest_V_1-0-0_procedures_NN.md
agent:: actioNN nn-trannsform
run_at:: 2026-08-01T10:15:00Z

# NN ModelRecords
## NN ModelRecords: Acme Business Plan
model_ref:: ./Acme%20Business%20Plan_V_0-1-0_business_NN.md
model_template:: business
model_version:: V_0-1-0
derived_from:: [report.docx]
generated_by:: [Business ingest run 2026-08-01]

# NN Artifacts
## NN Artifacts: Executive Summary
artifact_format:: document
artifact_version:: V_0-1-0
location:: artifacts/Executive_Summary_V_0-1-0.md
derived_from_inputs:: [Acme Business Plan]
produced_by:: [Business ingest run 2026-08-01]
```

The application resolves `parent_spec` to this template and uses its Concept, Field, Marker, and Matrix Definitions to validate and render the provenance model.
