---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/blank/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-0"
title: "Blank App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
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

* [[Content]]

# NN Concept Definition

## NN Concept Definition: Content
icon:: file-text
type:: text
color:: blue
weight:: 100

# NN Field Definition

## NN Field Definition: summary
concept:: Content
type:: string
description:: Free-form one-line summary or label for the content block.

# NN Marker Definition

## NN Marker Definition: importance
applies_to:: [Element]
symbol:: *
icon:: plus
color:: blue

# NN Matrix Definition

# Blank Template

## A minimal starting point for defining new concepts and fields from scratch

## Philosophy

The Blank Template is the empty canvas of the iNNfo ecosystem. Where the Business, Organization, Procedures, and Projects templates ship pre-built domain concepts, the Blank Template declares a single minimal `Content` concept and leaves every other Concept, Field, Marker, and Matrix Definition to the model author. Use it to model a domain that has no dedicated template yet, or to bootstrap a custom specialization without inheriting unrelated structure.

By design it keeps model creation unopinionated: you add `# NN Concept Definition`, `# NN Field Definition`, `# NN Marker Definition`, and `# NN Matrix Definition` elements to this page to shape your own schema, then author Level 3 models against them.

## Objectives

- Provide a minimal, valid Level 2 template that can be used as `parent_spec` for any new or exploratory model.
- Avoid forcing any domain vocabulary onto the model author.
- Keep the body valid against the `iNNfo_V_0-2-0` meta-template (the four root primitives instantiated in the body, no `concepts:`/`fields:` frontmatter).
- Serve as the starting point for authoring a specialization that still follows iNNfo conventions.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Content** | `text` | A single free-form container for notes, prose, or unstructured content |

The `Content` concept exists so the template has a non-empty, resolvable `# NN index` and a place for the model author to put opening content. Additional Concepts are added by the author through `# NN Concept Definition` elements.

### Markers

| Marker | Purpose |
|---|---|
| `importance` | Core importance score (1–10) |

### Matrices

None by default. Add `# NN Matrix Definition` elements as your schema grows.

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ❌ | Not applicable by default |
| Graph edge | ❌ | Not applicable |
| Sequence | ❌ | Not applicable |

## Template

### Level 3 Model Template (Lightweight)

To create a blank model, create a level 3 FILE mode document with:

```yaml
---
level: 3
parent_spec:
  name: "blank_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/blank/spec_NN.md"
model_version: "V_x-y-z"
title: "<Your Model Name>"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN index
* [[Content]]

# NN Content
Your opening content here.
```

The application will resolve the `parent` URL, download this template, and use its Concept, Field, Marker, and Matrix Definitions to validate and render your model. To model a richer domain, extend the template (or create a specialization) with additional `# NN Concept Definition` and `# NN Field Definition` elements following the `iNNfo_V_0-2-0` meta-template.

## Examples

### Canonical Sample

The Blank Template intentionally ships without a domain sample, because a blank model is defined entirely by its author. For a guided example of a fully populated template, see the Business (`specs/templates/business/`), Organization (`specs/templates/organization/`), Procedures (`specs/templates/procedures/`), or Projects (`specs/templates/projects/`) templates.

### Parent Chain

```yaml
# This template's parent:
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
```

Models targeting this template set:

```yaml
parent_spec:
  name: "blank_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/blank/spec_NN.md"
```

# Concept Guidance Documentation

## Content

### Summary
A free-form container for the model author's opening content, notes, or prose.

### Description
The `Content` concept is the only concept the Blank Template declares. It is a single-instance `text` block where you can place an introduction, a summary, or unstructured notes before you define your own purposeful Concepts and Fields. Extend the template as needed to model your domain.
