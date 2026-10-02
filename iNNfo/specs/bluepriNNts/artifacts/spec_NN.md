---
spec_version: "V_0-3-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/artifacts/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-3-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"
blueprint_version: "V_0-4-0"
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

## NN Field Definition: artifact_model
concept:: Artifact
type:: knowledge
description:: Link to structured output model in artifacts/models/ when format is model.

## NN Field Definition: file_path
concept:: Artifact
type:: string
description:: Relative path to generated deliverable file when format is non-model.

# Artifacts Catalog Template

## A level-2 template for indexing derivative deliverables, generated reports, structured models, and export artifacts with progressive disclosure summaries

## Philosophy

The Artifacts Catalog registers all tangible and digital outputs generated within an iNNfo workspace. Artifacts encompass interactive web consoles, compiled HTML hubs, documents, tabular datasets, and structured downstream models. By capturing concise summaries in the catalog, agents and users can discover outputs without scanning raw deliverable files.

## Template

### Level 3 Model Template (Lightweight)

```yaml
---
level: 3
parent_spec:
  name: "artifacts"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/artifacts/spec_NN.md"
knowledge_version: "V_0-1-0"
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
artifact_model:: artifacts/models/report_NN.md
```
