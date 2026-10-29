---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-5-0_NN.md"
title: "DomaiNN Blueprint"
blueprint_name: "domaiNN"
blueprint_version: "V_0-4-0"
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

# NN index

* [[domaiNN]]
* [[kNNowledge]]
* [[bluepriNNts]]

# NN Concept Definition

## NN Concept Definition: domaiNN
icon:: layout-dashboard
type:: text
color:: grey
weight:: 100

## NN Concept Definition: kNNowledge
icon:: file-symlink
type:: knowledge
color:: purple
weight:: 95

## NN Concept Definition: bluepriNNts
icon:: copy
type:: model
color:: grey
weight:: 90

# NN Field Definition

## NN Field Definition: tags
concept:: *
type:: select
multiple:: true
description:: Open vocabulary ad-hoc tags and classification labels (e.g. verified).

<!-- domaiNN fields: container conventions -->

## NN Field Definition: name
concept:: domaiNN
type:: string
description:: Display name or title of the domaiNN.

## NN Field Definition: knowledge_dir
concept:: domaiNN
type:: string
description:: Base relative path for kNNowledge documents in the domaiNN (default: kNNowledge/).

## NN Field Definition: blueprints_dir
concept:: domaiNN
type:: string
description:: Base relative path for local bluepriNNts in the domaiNN (default: specs/bluepriNNts/).

<!-- kNNowledge fields: inventory + lineage -->

## NN Field Definition: path
concept:: kNNowledge
type:: knowledge
description:: domaiNN-relative path to the referenced kNNowledge document.

## NN Field Definition: blueprint
concept:: kNNowledge
type:: string
description:: The level-2 bluepriNNt the referenced kNNowledge document conforms to.

## NN Field Definition: status
concept:: kNNowledge
type:: select
options:: [draft, active, archived]
description:: Lifecycle status of the kNNowledge document within this domaiNN.

## NN Field Definition: author
concept:: kNNowledge
type:: string
description:: Author or owner of the kNNowledge document within this domaiNN.

<!-- bluepriNNts fields: local blueprint inventory -->

## NN Field Definition: path
concept:: bluepriNNts
type:: model
description:: domaiNN-relative path to a local bluepriNNt spec (spec_NN.md).

## NN Field Definition: category
concept:: bluepriNNts
type:: string
description:: Domain classification or strategic focus of the local bluepriNNt.

# DomaiNN Blueprint

## A level-2 blueprint for a domaiNN root — linking kNNowledge documents, local bluepriNNts, and taxonomy tags

## Philosophy

A domaiNN is the container for a body of kNNowledge. It is itself a kNNowledge document, so a domaiNN can nest inside another domaiNN without a special case:
* **domaiNN** sets directory conventions and the entry point (`domaiNN_NN.md`).
* **kNNowledge** links to the Level-3 documents with metadata and blueprint binding.
* **bluepriNNts** catalogs local bluepriNNt packages.

## Objectives

- Define the domaiNN root as an ordinary Level-3 kNNowledge document governed by this blueprint.
- Standardize the directory layout: `kNNowledge/` for knowledge and `specs/bluepriNNts/` for local bluepriNNts.
- Make every domaiNN resolvable offline through the parent chain (`domaiNN` → iNNfo V_0-5-0 → defiNNition).

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **domaiNN** | text | Prose description, entry point, and directory conventions of the container |
| **kNNowledge** | knowledge | kNNowledge documents in the domaiNN with metadata and blueprint binding |
| **bluepriNNts** | model | Local bluepriNNt specs the domaiNN references (path + category) |

### Fields

| Concept | Field | Type | Purpose |
|---|---|---|---|
| `*` | `tags` | select (multiple) | Open vocabulary ad-hoc tags and classification labels (e.g. `verified`) |
| domaiNN | `name` | string | Display name or title of the domaiNN |
| domaiNN | `knowledge_dir` | string | Base relative path for kNNowledge documents |
| domaiNN | `blueprints_dir` | string | Base relative path for local bluepriNNts |
| kNNowledge | `path` | knowledge | domaiNN-relative path to referenced document |
| kNNowledge | `blueprint` | string | Level-2 bluepriNNt name |
| kNNowledge | `status` | select | draft, active, archived |
| kNNowledge | `author` | string | Author or owner |
| bluepriNNts | `path` | model | domaiNN-relative path to local spec |
| bluepriNNts | `category` | string | Strategic focus of local bluepriNNt |

### Directory Conventions

| Key | Default | Meaning |
|---|---|---|
| `knowledge_dir` | `kNNowledge/` | Base path for Level-3 kNNowledge documents |
| `blueprints_dir` | `specs/bluepriNNts/` | Base path for local bluepriNNt packages |

The entry point of a domaiNN is a root document named exactly `domaiNN_NN.md`. Legacy entrypoint names (`workspace*.md`, `*_base_NN.md`) are detected as legacy and are never loaded by current tooling.

## Template

### Level 3 kNNowledge Template (Lightweight)

```yaml
---
level: 3
parent_spec:
  name: "domaiNN"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "<DomaiNN Name>"
---

# NN domaiNN

Description of the domaiNN: its purpose, scope, and conventions.

# NN kNNowledge

## NN kNNowledge: Core Knowledge
path:: kNNowledge/core_business_NN.md
blueprint:: business
status:: active
author:: Lead Architect
tags:: [verified]
```

## Examples

A domaiNN that links one business kNNowledge document uses two concepts: `domaiNN` for the container and `kNNowledge` for the linked document. No other structure is required.
