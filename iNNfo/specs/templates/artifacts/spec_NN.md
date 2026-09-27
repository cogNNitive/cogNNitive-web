---
spec_version: "V_0-2-2"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/artifacts/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md"
template_version: "V_0-2-0"
title: "Artifacts Catalog App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
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

* [[Artifact]]

# NN Concept Definition

## NN Concept Definition: Artifact
icon:: file-output
type:: list
color:: teal
weight:: 100

# NN Field Definition

## NN Field Definition: format
concept:: Artifact
type:: select
options:: [model, markdown, html, json, csv, binary]
description:: Format of the deliverable or output artifact.

## NN Field Definition: summary
concept:: Artifact
type:: string
description:: Mandatory concise summary of the artifact contents for progressive disclosure.

## NN Field Definition: status
concept:: Artifact
type:: select
options:: [draft, verified, published, deprecated]
description:: Lifecycle and verification state of the artifact.

## NN Field Definition: tags
concept:: Artifact
type:: string
description:: Categorization and domain tags for grouping and discovery.

## NN Field Definition: produced_by
concept:: Artifact
type:: string
description:: Reference to the procedure or workflow run that produced this artifact (PROV wasGeneratedBy).

## NN Field Definition: sources
concept:: Artifact
type:: citation
description:: Citations to the Source documents and domain models this artifact derives from (PROV wasDerivedFrom).

## NN Field Definition: artifact_model
concept:: Artifact
type:: model
description:: Link to structured output model in artifacts/models/ when format is model.

## NN Field Definition: file_path
concept:: Artifact
type:: string
description:: Relative path to generated deliverable file when format is non-model.

# Artifacts Catalog Template

## A level-2 template for indexing derivative deliverables, generated reports, structured models, and export artifacts with progressive disclosure summaries

## Philosophy

The Artifacts Catalog registers all tangible and digital outputs generated within an iNNfo workspace. Artifacts encompass interactive web consoles, compiled HTML hubs, documents, tabular datasets, and structured downstream models. By capturing concise summaries and W3C PROV lineage (produced_by, sources) in the catalog, agents and users can trace output lineage without scanning raw deliverable files.

## Template

### Level 3 Model Template (Lightweight)

```yaml
---
level: 3
parent_spec:
  name: "artifacts"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/artifacts/spec_NN.md"
model_version: "V_0-1-0"
title: "<Artifacts Catalog Name>"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Artifact]]

# NN Artifact

## NN Artifact: Artifact Name
format:: model
summary:: Concise summary of the deliverable contents.
status:: verified
tags:: [report, summary]
produced_by:: [[Procedure Name]]
sources:: [sources/nn/source_document.md#section]
artifact_model:: artifacts/models/report_NN.md
```
