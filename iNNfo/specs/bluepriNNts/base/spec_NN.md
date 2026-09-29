---
spec_version: "V_0-1-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/base/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
title: "Base Workspace Overview Template"
template_version: "V_0-1-0"
includes:
  - name: "workspace_V_0-2-0"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/workspace_spec_NN.md"
  - name: "cogNNitive_V_0-2-0"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/cogNNitive/spec_NN.md"
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

* [[Overview]]

# NN Concept Definition

## NN Concept Definition: Overview
icon:: compass
type:: text
color:: blue
weight:: 110

# NN Field Definition

## NN Field Definition: manifest
concept:: Overview
type:: model
target_template:: workspace_V_0-2-0
description:: The workspace inventory manifest (workspace_NN.md).

## NN Field Definition: provenance
concept:: Overview
type:: model
target_template:: cogNNitive_V_0-2-0
description:: The cogNNitive provenance model for this workspace.

# Base Workspace Overview Template

## A level-2 composite template that ties the workspace inventory manifest and the cogNNitive provenance model together under one overview-root document

## Philosophy

`base` is **the one sanctioned composer of `workspace`**. `workspace_spec_NN.md` states, in its own Philosophy section, that "no domain template `includes` it; it stands alone as the schema for the `workspace_NN.md` entry-point document at a workspace root." That statement is still true of every domain template (`business`, `organization`, `procedures`, `projects`, `analysis`, `innovation`, `blank`) — none of them, and none that come after them, should `includes: [workspace_V_0-2-0]`. `base` is the deliberate, structural exception: it is not a domain vocabulary describing subject matter, it is a composition root whose only job is to give the inventory manifest (`workspace`) and the provenance/lineage record (`cogNNitive`) one shared parent document, so an application can open a single file and reach both. Composing `workspace` here does not license any other template to do the same.

The `manifest` and `provenance` fields stay on two separate lanes rather than folding one into the other: the workspace manifest answers "which models live here and who owns them," the cogNNitive model answers "where did each of those models come from." A hard merge of the two concepts was considered and rejected — they answer different questions and evolve independently.

## Objectives

- Give workspaces that want one an overview-root document that composes the inventory manifest and the provenance model as siblings, without altering either published template.
- Declare `base` as the one sanctioned exception to `workspace`'s "no domain template includes it" rule, and say so explicitly so the rule is never read as accidentally violated.
- Document `workspace_id`, the model title-uniqueness rule, the overview-root entrypoint pattern, and how an existing workspace opts in — all in one place, since `workspace_spec_NN.md` and `spec_NN.md` are both write-once and cannot carry this text themselves.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Overview** | `text` | The composition root: one element carrying pointers to the workspace's manifest and provenance models |

`base` also inherits, additively, every concept declared by its `includes` — `Workspace`, `Models`, `Folder`, `Asset` (from `workspace_V_0-2-0`) and `Sources`, `ModelRecords`, `Artifacts`, `Procedures` (from `cogNNitive_V_0-2-0`). The two included schemas declare disjoint concept and field names, so composing both produces no `[COMPOSITION_COLLISION]` error.

### Fields

| Field | Concept | Type | Purpose |
|---|---|---|---|
| `manifest` | Overview | `model` (`target_template:: workspace_V_0-2-0`) | Points at the workspace's inventory manifest document |
| `provenance` | Overview | `model` (`target_template:: cogNNitive_V_0-2-0`) | Points at the workspace's cogNNitive provenance document |

Both fields are declared `type:: model`: the parser follows them during workspace traversal (the same mechanism that follows `path::`/`file_ref::` and any other `type:: model` field), so the referenced manifest and provenance documents become children of the `Overview` element in the parsed graph.

### Workspace Identity (`workspace_id`)

The workspace entrypoint document — whichever file `findPrimaryWorkspaceFile` resolves, a plain `workspace*.md` manifest or, when present, an overview root conforming to this template — MAY declare an optional `workspace_id` frontmatter field: a stable slug identifying the workspace (e.g. `workspace_id: "acme"`). Exactly one workspace document should declare it. It is optional in v1: its absence produces no error or warning, and `innfo-core` does not enforce uniqueness of `workspace_id` across workspaces. This field is documented here, rather than in `workspace_spec_NN.md`, because that template is write-once.

### Model Title Uniqueness

Model titles (the frontmatter `title` of any level-3 model in a workspace) **MUST be unique within a workspace**. This is not a rule `base` invents — it is the precondition that qualified cross-model references (`[[Model Title :: Element Name]]`, see `iNNfo_V_0-2-1_NN.md`) depend on to resolve unambiguously, and the workspace index enforces it as an error when two models share a title. Adopting `base` does not change this rule; it applies equally to workspaces with or without an overview root.

### Overview-Root Entrypoint Pattern

A level-3 model conforming to `base_V_0-1-0` — filename pattern `<name>_base_NN.md` (matched case-insensitively, ending in `.md`, e.g. `Ghostbusters_V_0-1-0_base_NN.md` in a template package's own samples, or `acme_base_01.md` in a deployed workspace) — MAY act as the workspace's overview root. When such a file is present at the workspace root, `findPrimaryWorkspaceFile` discovers it **ahead of** any `workspace*.md` file, and it is parsed as the primary Level-3 workspace entrypoint. Its `manifest` and `provenance` fields make the plain inventory manifest and the cogNNitive provenance model children of the overview root in the parsed graph, instead of the manifest being the entrypoint itself. This is opt-in: a workspace root file that does not match the pattern never takes precedence, and a workspace with no such file behaves exactly as it did before this template existed.

### Adoption

Adopting `base` requires no change to any existing file. To add an overview root to a workspace that already has `workspace_NN.md` and a `cogNNitive` provenance model, create `<name>_base_NN.md` at the workspace root, conforming to this template, referencing your existing `workspace_NN.md` and `<name>_cogNNitive_NN.md` via the `manifest` and `provenance` fields (see the `samples/` directory next to this file for a worked example). Workspaces that do not add such a file are unaffected.

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ❌ | Not applicable |
| Graph edge | ❌ | Not applicable |
| Sequence | ❌ | Not applicable |

## Template

### Level 3 Model Template (Lightweight)

To create an overview root, place a `<name>_base_NN.md` at the workspace root:

```yaml
---
level: 3
parent_spec:
  name: "base_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/base/spec_NN.md"
model_version: "V_x-y-z"
title: "<Workspace Name> Overview"
workspace_id: "<workspace-slug>"
---

> [!NOTE]
> This is an **iNNfo document**...

# NN index
* [[Overview]]

# NN Overview

## NN Overview: <Workspace Name>
manifest:: workspace_NN.md
provenance:: <Workspace Name>_cogNNitive_NN.md
```

The application resolves the `parent_spec` URL, downloads this template (which itself resolves its `includes`), and follows `manifest` and `provenance` during workspace traversal to load the two referenced documents as children of this one.

## Examples

See `samples/Ghostbusters_V_0-1-0_base_NN.md` for a complete overview root pointing at `samples/workspace_NN.md` (manifest) and `samples/Ghostbusters_cogNNitive_NN.md` (provenance).
