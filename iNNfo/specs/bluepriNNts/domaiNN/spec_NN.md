---
spec_version: "V_0-3-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-3-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"
title: "DomaiNN Blueprint"
blueprint_name: "domaiNN"
blueprint_version: "V_0-1-0"
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

* [[domaiNN]]
* [[kNNowledge]]
* [[Tags]]

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

## NN Concept Definition: Tags
icon:: tag
type:: category
color:: grey
weight:: 50

# NN Field Definition

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

## NN Field Definition: derived_from
concept:: kNNowledge
type:: citation
description:: The Source documents this kNNowledge document derives from.

<!-- Tags fields -->

## NN Field Definition: color
concept:: Tags
type:: string
description:: Hex color code (e.g. #10b981) or CSS token for tag badges and highlights.

## NN Field Definition: icon
concept:: Tags
type:: string
description:: Icon identifier (e.g. Lucide icon name) displayed with the tag badge.

## NN Field Definition: description
concept:: Tags
type:: string
description:: Semantic description, strategic intent, or scope of the tag.

# NN Marker Definition

## NN Marker Definition: verified
applies_to:: [Element]
symbol:: >
icon:: shield-check
color:: green

# DomaiNN Blueprint

## A level-2 blueprint for a domaiNN root — linking kNNowledge documents, local bluepriNNts, and taxonomy tags

## Philosophy

A domaiNN is the container for a body of kNNowledge. It is itself a kNNowledge document, so a domaiNN can nest inside another domaiNN without a special case:
* **domaiNN** sets directory conventions and the entry point (`domaiNN_NN.md`).
* **kNNowledge** links to the Level-3 documents with metadata, blueprint binding, and derivation lineage.
* **Tags** provides a centralized taxonomy catalog (`color`, `icon`, `description`) used across the domaiNN.

## Objectives

- Define the domaiNN root as an ordinary Level-3 kNNowledge document governed by this blueprint.
- Standardize the directory layout: `kNNowledge/` for knowledge and `specs/bluepriNNts/` for local bluepriNNts.
- Make every domaiNN resolvable offline through the parent chain (`domaiNN` → iNNfo V_0-3-0 → defiNNition).

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **domaiNN** | text | Prose description, entry point, and directory conventions of the container |
| **kNNowledge** | knowledge | kNNowledge documents in the domaiNN with metadata and derivation lineage |
| **Tags** | category | Centralized taxonomy tags with color, icon, and description |

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

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN domaiNN

Description of the domaiNN: its purpose, scope, and conventions.

# NN kNNowledge

## NN kNNowledge: Core Knowledge
path:: kNNowledge/core_business_NN.md
blueprint:: business
status:: active
author:: Lead Architect

# NN Tags

## NN Tags: Strategic
color:: #3b82f6
icon:: target
description:: High-level strategic knowledge.
```

## Examples

A domaiNN that links one business kNNowledge document and one shared tag uses three concepts only: `domaiNN` for the container, `kNNowledge` for the linked document, and `Tags` for the taxonomy entry. No other structure is required.
