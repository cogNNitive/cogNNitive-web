---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/sources/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-1-0"
title: "Sources Catalog App"
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

* [[Source]]

# NN Concept Definition

## NN Concept Definition: Source
icon:: file-input
type:: list
color:: teal
weight:: 100

# NN Field Definition

## NN Field Definition: type
concept:: Source
type:: select
options:: [local_file, url_snapshot, dynamic_feed, git_repo, api_export]
description:: Polymorphic origin category of the primary source.

## NN Field Definition: origin_uri
concept:: Source
type:: string
description:: Universal identifier of origin: local path, web URL (https://), or git repository URI.

## NN Field Definition: format
concept:: Source
type:: select
options:: [pdf, docx, html, md, json, csv, audio, xlsx, repo]
description:: Original file or payload format.

## NN Field Definition: raw_path
concept:: Source
type:: string
description:: Workspace-relative path to the raw/binary asset in sources/import/ or sources/original/.

## NN Field Definition: summary
concept:: Source
type:: string
description:: Mandatory concise semantic summary of the source contents for progressive disclosure.

## NN Field Definition: tags
concept:: Source
type:: string
description:: Categorization and domain tags for grouping and discovery.

## NN Field Definition: status
concept:: Source
type:: select
options:: [ready, stale, processing, error]
description:: Operational and synchronization state of the source.

## NN Field Definition: source_model
concept:: Source
type:: model
description:: Relative link to normalized iNNfo model document in sources/nn/.

# Sources Catalog Template

## A level-2 template for indexing polymorphic primary sources and normalized source models with progressive disclosure summaries

## Philosophy

The Sources Catalog serves as the single source of truth for all primary and normalized sources in an iNNfo workspace. By maintaining concise semantic summaries directly in the catalog, AI agents and human users can query source inventories and make informed citation decisions without performing expensive file I/O operations against normalized leaf models. Physical cryptographic metadata (e.g. SHA-256 hashes, timestamps) remains strictly isolated within normalized document frontmatter under `sources/nn/`.

## Template

### Level 3 Model Template (Lightweight)

```yaml
---
level: 3
parent_spec:
  name: "sources"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/sources/spec_NN.md"
model_version: "V_0-1-0"
title: "<Sources Catalog Name>"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Source]]

# NN Source

## NN Source: Source Name
type:: local_file
origin_uri:: sources/original/document.pdf
raw_path:: sources/original/document.pdf
format:: pdf
summary:: Concise summary of the source document contents.
tags:: [tag1, tag2]
status:: ready
source_model:: sources/nn/document.md
```
