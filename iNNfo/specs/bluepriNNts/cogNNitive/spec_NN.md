---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/cogNNitive/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-3-0"
title: "cogNNitive Template"
relationship_types:
  hierarchy:
    enabled: true
    via: index block
  evaluable_matrix:
    enabled: false
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

## NN Field Definition: media_filename
concept:: Sources
type:: string
description:: Optional media file name associated with the source (e.g. sources/media/recording.mp4).

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

## NN Field Definition: curated_csv
concept:: Sources
type:: string
description:: Path to optional curated CSV data associated with the source.

## NN Field Definition: status
concept:: Sources
type:: select
options:: [archived]
description:: Lifecycle status of the source (e.g. archived).

## NN Field Definition: version
concept:: Sources
type:: string
description:: Ingestion version of the source.

## NN Field Definition: archive_path
concept:: Sources
type:: string
description:: Path where the previous version of the source is archived.

## NN Field Definition: superseded_by
concept:: Sources
type:: string
description:: Identifier or version of the newer source that supersedes this one.

## NN Field Definition: derived_from
concept:: Sources
type:: citation
description:: Citations to the upstream sources or inputs this source derives from.

<!-- ModelRecords: a level-3 domain model produced from sources -->

## NN Field Definition: model_ref
concept:: ModelRecords
type:: string
description:: Path to the domain model file in the workspace (e.g. kNNowledge/Business_Plan_V_0-1-0_business_NN.md).

## NN Field Definition: knowledge_version
concept:: ModelRecords
type:: string
description:: Version of the produced domain model.

## NN Field Definition: model_template
concept:: ModelRecords
type:: string
description:: The level-2 template the domain model conforms to (e.g. business, organization, procedures).

## NN Field Definition: derived_from
concept:: ModelRecords
type:: citation
description:: Citations to the Sources this model was derived from (PROV wasDerivedFrom).

<!-- Artifacts: a derivative deliverable produced from sources and/or a model -->

## NN Field Definition: artifact_ref
concept:: Artifacts
type:: string
description:: Path to the artifact deliverable within the workspace (e.g. export/Executive_Summary_V_0-1-0.md).

## NN Field Definition: artifact_format
concept:: Artifacts
type:: select
options:: [document, report, board, dataset]
description:: Kind of artifact. "board" replaces the retired term "dashboard"; every generated deliverable is an Artifact.

## NN Field Definition: derived_from
concept:: Artifacts
type:: citation
description:: Citations to the immediate inputs this artifact was derived from (Sources and/or ModelRecords).

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

# cogNNitive Template

## A provenance and lineage template that registers the sources ingested and the artifacts and models produced by the cogNNitive pipeline, with explicit derivation citations

## Philosophy

The cogNNitive template treats ingestion and generation as a lineage graph rather than a folder of loose files. It follows the W3C PROV model: **Sources**, **ModelRecords**, and **Artifacts** are entities; **Procedures** are activities; and derivation is recorded as explicit directed citation edges (`derived_from`) rather than inferred from folder layout. This makes every generated deliverable auditable back to the exact raw inputs and the run that produced it.

## Objectives

1. Give a stable identity (content hash + name) to every raw Source ingested by cogNNitive, and carry its normalized Markdown as a file-backed asset.
2. Register every produced Model and Artifact as a first-class entity with explicit derivation citations to its inputs.
3. Record the Procedure (activity) that generated each Model or Artifact, so runs are reproducible.
4. Keep all lineage edges as single-edge `citation` fields rather than duplicate matrices or cross-model relations.
5. Retire the terms "dashboard" and "export": every generated deliverable is an **Artifact**; its kind is a field value.

## Specification

The template instantiates the three root primitives of the Metaplantilla Nivel 1: **Concept Definition**, **Field Definition**, and **Marker Definition**. Its schema is resolved from the body elements of this document, not from frontmatter blocks.

### Concepts

| Concept | PROV role | Purpose |
|---|---|---|
| **Sources** | Entity | A raw input file ingested and normalized (hash, name, format, normalized content). |
| **ModelRecords** | Entity | A level-3 domain model produced from Sources. |
| **Artifacts** | Entity | A derivative deliverable (document, report, board, dataset) produced from Sources and/or ModelRecords. |
| **Procedures** | Activity | The transformation run that produced a Model or Artifact. |

### Lineage mechanism (why citations)

Lineage is **sparse and directional**, modeled with single-edge `citation` fields:

- `Sources.derived_from` → upstream Sources
- `ModelRecords.derived_from` → Sources
- `Artifacts.derived_from` → Sources and/or ModelRecords

The derivation graph is a **DAG, not a fixed chain**: an Artifact may derive from a Model, directly from Sources, or both.

### Element / claim-level provenance

Provenance **within** a domain model (which Source backs a specific Element) is carried directly by element citations (`sources:: [sources/nn/file.md@## Heading]`) or citation annotations (`<!-- cite: sources/nn/file.md@## Heading -->`).

### Markers

| Marker | Symbol | Purpose |
|---|---|---|
| `verified` | `>` | Human-verified provenance record (hash and derivation confirmed). |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ❌ | Not applicable |
| Graph edge | ❌ | Not applicable (lineage uses citation fields) |
| Sequence | ❌ | Not applicable |

## Template

### Level 3 Model Template (Lightweight)

A cogNNitive provenance model is associated with each workspace/model, named `<Workspace>_V_x-y-z_cogNNitive_NN.md` and listed in the workspace `index.md`:

```yaml
---
level: 3
parent_spec:
  name: "cogNNitive"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/cogNNitive/spec_NN.md"
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
version:: V_1-0-0
derived_from:: []

# NN Procedures
## NN Procedures: Business ingest run 2026-08-01
procedure_ref:: procedures/Document_Ingest_V_1-0-0_procedures_NN.md
agent:: actioNN nn-trannsform
run_at:: 2026-08-01T10:15:00Z

# NN ModelRecords
## NN ModelRecords: Acme Business Plan
model_ref:: kNNowledge/Acme_Business_Plan_V_0-1-0_business_NN.md
model_template:: business
knowledge_version:: V_0-1-0
derived_from:: [sources/nn/report.md@## Executive Summary]

# NN Artifacts
## NN Artifacts: Executive Summary
artifact_ref:: export/Executive_Summary_V_0-1-0.md
artifact_format:: document
derived_from:: [kNNowledge/Acme_Business_Plan_V_0-1-0_business_NN.md@## Strategy]
```

The application resolves `parent_spec` to this template and uses its Concept, Field, and Marker Definitions to validate and render the provenance model.
