---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/sources/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-6-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-6-0_NN.md"
blueprint_version: "V_0-4-0"
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
nature:
  structure: catalog
  ownership: derived
---

# NN index

* [[Source]]
* [[Synchronization]]

# NN Concept Definition

## NN Concept Definition: Source
icon:: file-input
type:: list
color:: teal
weight:: 100

## NN Concept Definition: Synchronization
icon:: refresh-cw
type:: list
color:: teal
weight:: 90
description:: Declares an origin (a file, a folder or a URL) that `nn-sources --sync` lands into this domaiNN on demand: models as mirrors under `sources/sync/<alias>/`, other files as sources under `sources/import/<alias>/`.

# NN Field Definition

## NN Field Definition: tags
concept:: *
type:: select
multiple:: true
description:: Open vocabulary ad-hoc tags and classification labels.

## NN Field Definition: type
concept:: Source
type:: select
options:: [local_file, url_snapshot, dynamic_feed, git_repo, api_export]
description:: Polymorphic origin category of the primary source.

## NN Field Definition: origin_uri
concept:: [Source, Synchronization]
type:: string
description:: Universal identifier of origin: local path, web URL (https://), or git repository URI.

## NN Field Definition: alias
concept:: Synchronization
type:: string
description:: Folder-safe slug that names the landing folders `sources/sync/<alias>/` and `sources/import/<alias>/`. Unique within the catalog.

## NN Field Definition: kind
concept:: Synchronization
type:: select
options:: [file, folder]
description:: Whether the origin is a single file or a folder. A URL origin is always a file.

## NN Field Definition: state
concept:: Synchronization
type:: select
options:: [active, paused]
description:: A paused Synchronization is skipped by `nn-sources --sync`.

## NN Field Definition: format
concept:: Source
type:: select
options:: [pdf, docx, html, md, json, csv, audio, xlsx, repo]
description:: Original file or payload format.

## NN Field Definition: raw_path
concept:: Source
type:: string
description:: Workspace-relative path to the raw/binary asset in sources/import/.

## NN Field Definition: summary
concept:: Source
type:: string
description:: Mandatory concise semantic summary of the source contents for progressive disclosure.

## NN Field Definition: status
concept:: Source
type:: select
options:: [ready, stale, processing, error]
description:: Operational and synchronization state of the source.

## NN Field Definition: source_model
concept:: Source
type:: knowledge
description:: Relative link to the source's co-located sidecar, `<file>.<ext>_sidecar_NN.md` under sources/import/.

# Sources Catalog Template

## A level-2 template for indexing polymorphic primary sources and normalized source models with progressive disclosure summaries

## Philosophy

The Sources Catalog serves as the single source of truth for all primary and normalized sources in an iNNfo workspace. By maintaining concise semantic summaries directly in the catalog, AI agents and human users can query source inventories and make informed citation decisions without performing expensive file I/O operations against normalized leaf models. Physical cryptographic metadata (e.g. SHA-256 hashes, timestamps) remains strictly isolated within each source's co-located sidecar under `sources/import/`.

## Template

### Level 3 Model Template (Lightweight)

```yaml
---
level: 3
parent_spec:
  name: "sources"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/sources/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "<Sources Catalog Name>"
---

# NN index

* [[Source]]

# NN Source

## NN Source: Source Name
type:: local_file
origin_uri:: sources/import/document.pdf
raw_path:: sources/import/document.pdf
format:: pdf
summary:: Concise summary of the source document contents.
tags:: [tag1, tag2]
status:: ready
source_model:: sources/import/document.pdf_sidecar_NN.md
```

### Synchronization

```markdown
# NN Synchronization

## NN Synchronization: Organization
alias:: org
origin_uri:: ../organization
kind:: folder
state:: active
```

A Synchronization is a declaration, not a copy. `nn-sources --sync [alias]` lands the origin on demand: a folder holding a `domaiNN_NN.md` is mirrored model by model, any other folder splits into mirrored models and imported raw files. A consumer points at a mirrored element with a `reference` field whose value is a path address such as `sources/sync/org/organization_NN.md@manager`.
