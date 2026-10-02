---
spec_version: "V_0-3-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/visual-catalog/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-3-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"
title: "Visual Catalog App"
blueprint_version: "V_0-1-0"
procedures:
  - id: "ingest-visual-catalog"
    name: "Ingest Visual Catalog Procedure"
    path: "procedures/ingest_visual_catalog_NN.md"
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

* [[Entry]]
* [[Category]]
* [[Evidence]]

# NN Concept Definition

## NN Concept Definition: Entry
icon:: box
type:: list
color:: teal
weight:: 100

## NN Concept Definition: Category
icon:: folder-tree
type:: category
color:: blue
weight:: 90

## NN Concept Definition: Evidence
icon:: image
type:: list
color:: orange
weight:: 80

# NN Field Definition

## NN Field Definition: name
concept:: Entry
type:: string
description:: STABLE domain identity of the catalogued thing. MUST NOT be derived from an image filename or path.

## NN Field Definition: category
concept:: Entry
type:: reference
target_concepts:: [Category]
description:: The Category this Entry belongs to.

## NN Field Definition: description
concept:: Entry
type:: markdown_inline
description:: Free-text description of the Entry.

## NN Field Definition: attributes
concept:: Entry
type:: string
description:: Structured key/value attributes or inline Markdown notes for domain-specific facts.

## NN Field Definition: status
concept:: Entry
type:: select
options:: [candidate, confirmed, rejected]
description:: Review state of the Entry.

## NN Field Definition: tags
concept:: Entry
type:: string
description:: Categorization tags for grouping and discovery.

## NN Field Definition: source
concept:: Entry
type:: citation
description:: OPTIONAL citation to the normalized source (sources/nn/...) this Entry derives from.

## NN Field Definition: description
concept:: Category
type:: markdown_inline
description:: Human-readable explanation of the Category scope.

## NN Field Definition: parent
concept:: Category
type:: reference
target_concepts:: [Category]
description:: Parent Category for a hierarchical taxonomy.

## NN Field Definition: image
concept:: Evidence
type:: image
description:: The witness image. First declared `type:: image` field — resolves as the main image.

## NN Field Definition: captured_at
concept:: Evidence
type:: string
description:: Capture date or timestamp of the image.

## NN Field Definition: original_ref
concept:: Evidence
type:: string
description:: Workspace-relative path to the ORIGINAL binary asset in sources/import/ or sources/original/.

## NN Field Definition: source
concept:: Evidence
type:: citation
description:: Citation to the normalized source under sources/nn/ that carries sha256 (original) and media_sha256 (derivative).

## NN Field Definition: notes
concept:: Evidence
type:: markdown_inline
description:: Optional analyst notes about the image or attribution.

# NN Marker Definition

## NN Marker Definition: confidence
applies_to:: [Element]
widget:: scale
widget_config:: {"min": 0, "max": 10, "step": 1, "unit": "/10"}
icon:: gauge
color:: purple

## NN Marker Definition: review
applies_to:: [Element]
widget:: boolean
widget_config:: {"true_label": "Reviewed", "false_label": "Pending"}
icon:: check-circle
color:: green

# NN Matrix Definition

## NN Matrix Definition: Entry x Evidence matrix
source:: Entry
target:: Evidence
values:: [primary, visible, partial]
widget:: set
widget_config:: {"multi": true}
description:: Which Evidence witness(es) show each Entry, and how directly. N:M — many Entries may share one Evidence.

## NN Matrix Definition: item-markers matrix
source:: Entry
target:: Markers

# Visual Catalog App

## A domain-agnostic schema for cataloging things extracted from images, with traceability to their witness image and normalized source

## Philosophy

Visual knowledge is captured as images long before it is structured as data. Cataloguing it by hand drifts into two failure modes: identity gets conflated with the image filename, and the link between a catalogue entry, the picture that witnesses it, and the normalized source it came from is lost. The Visual Catalog App gives that workflow a durable, domain-agnostic schema: an `Entry` is the thing itself, identified by a stable domain name rather than a filename; an `Evidence` is a witness image plus a citation to the normalized source carrying its hashes; and the `Entry x Evidence` free matrix records which witnesses show which entries, and how directly. The same blueprint covers museum passes, product photos, site surveys, or any other image-derived catalogue.

## Objectives

- Provide a reusable Level-2 blueprint for image-derived catalogues across domains.
- Pin `Entry.name` as a **stable domain identity**, independent of any filename or path.
- Model the witness image (`Evidence.image`) and its normalized source (`Evidence.source`) as first-class, citable data.
- Express many-to-many "which evidence shows which entry, and how" with the `Entry x Evidence` free matrix.
- Carry extraction confidence and review state with the `confidence` and `review` markers.
- Ship an idempotent ingestion SOP (`ingest-visual-catalog`) that defines the double-hash discipline and the deterministic upsert keys.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Entry** | `list` | The catalogued thing, identified by a stable domain name |
| **Category** | `category` | Hierarchical taxonomy grouping Entries |
| **Evidence** | `list` | A witness image and its citation to the normalized source |

### Fields

| Concept | Field | Type | Purpose |
|---|---|---|---|
| Entry | `name` | string | STABLE domain identity — never a filename |
| Entry | `category` | reference → Category | The Category this Entry belongs to |
| Entry | `description` | markdown_inline | Free-text description |
| Entry | `attributes` | string | Structured key/value or inline notes |
| Entry | `status` | select | candidate / confirmed / rejected |
| Entry | `tags` | string | Categorization tags |
| Entry | `source` | citation | Optional citation to `sources/nn/...` |
| Category | `parent` | reference → Category | Parent Category |
| Category | `description` | markdown_inline | Scope explanation |
| Evidence | `image` | image | The witness image (first `type:: image` = main image) |
| Evidence | `captured_at` | string | Capture date/timestamp |
| Evidence | `original_ref` | string | Path to the ORIGINAL binary asset |
| Evidence | `source` | citation | Citation to the normalized source (carries `sha256` + `media_sha256`) |
| Evidence | `notes` | markdown_inline | Optional analyst notes |

`Category.name` is intentionally omitted: `Category` is a `type:: category` concept and inherits the element name as its identity. `Evidence.name` is likewise omitted; an Evidence element is identified by its own name, and duplicating the `name` field declaration under two concepts is rejected by the parser.

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | `Entry x Evidence matrix`, `item-markers matrix` |
| Graph edge | ❌ | Citations are typed onto the graph; no free graph edges |
| Sequence | ❌ | Ingestion ordering lives in the bundled SOP |

## Level 3 Authoring Template

A catalog is a **standalone Level-3 document** linked to this blueprint via `type:: knowledge` with `target_blueprint: visual-catalog`. A minimal catalogue:

```yaml
---
level: 3
parent_spec:
  name: "visual-catalog"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/visual-catalog/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "<Catalog Name>"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Entry]]
* [[Category]]
* [[Evidence]]

# NN Entry: <stable identity>
name:: <stable identity>
category:: [[<Category>]]
status:: candidate
tags:: [tag1, tag2]
source:: sources/nn/<file>.md#<slug>

# NN Evidence: <label>
image:: evidence/<file>.png
captured_at:: <iso-date>
original_ref:: sources/import/<file>.png
source:: sources/nn/<file>.md#<slug>
```

`source::` citations use the canonical pointer form (`<path>@<unit>`); the `#<slug>` form shown above is accepted for legacy compatibility. The `image::` value resolves under `{modelDir}/assets/{element-slug}/`; the `original_ref::` value points into `sources/import/` (the ORIGINAL is never citable as a source — only the normalized file under `sources/nn/` is).

# Concept Guidance Documentation

## Entry

### Summary

The catalogued thing — the unit a human or agent reasons about. Identified by a stable domain name, never by an image filename.

### Description

An `Entry` is one `## NN Entry: <name>` element. Its `name` field is the **stable domain identity**: two differently named photos of the same real thing produce exactly one Entry, and re-ingesting a source must update that Entry in place rather than append a duplicate. `category` links the Entry into the `Category` taxonomy; `status` tracks its review lifecycle; `tags` and `attributes` carry domain-specific facts. The optional `source` field cites the normalized source the Entry derives from.

### Methodologies

- **Stable Identity**: normalise case and whitespace and canonicalise synonyms into one `Entry.name`; never let an image path or filename become the identity.
- **Idempotent Upsert**: find-or-create by `Entry.name`; re-running ingestion updates, never duplicates.
- **Free-matrix linkage**: express which Evidence witnesses an Entry through `Entry x Evidence matrix` cells, not through a per-Entry list.

### Prompts

- "Create an `Entry` named `<name>` in category `<Category>`."
- "Set status of `<entry>` to `confirmed`."
- "Which Evidence witnesses `<entry>`?"
- "Merge `<entry-a>` and `<entry-b>` into one Entry."

## Category

### Summary

A hierarchical taxonomy grouping Entries.

### Description

`Category` is a `type:: category` concept: the element's own name is its identity, so no explicit `name` field is declared. `parent` is a self-reference, so categories nest arbitrarily deep (for example `Tickets` under `Documents`). `description` explains the category scope. Use categories for discovery and grouping, not as substitutes for `Entry.attributes`.

### Methodologies

- **Progressive disclosure**: keep the taxonomy shallow by default; deepen only where it earns its keep.
- **Separation of concerns**: categories describe *what kind of thing* an Entry is, never *how sure* we are — that is `confidence`.

### Prompts

- "Create Category `<name>` with parent `<parent>`."
- "List all Entries in Category `<name>`."
- "Move Category `<child>` under `<parent>`."

## Evidence

### Summary

A witness image plus a citation to the normalized source that carries its original and derivative hashes.

### Description

An `Evidence` is one `## NN Evidence: <label>` element. Its `image` field is the FIRST declared `type:: image` field in this blueprint, so it resolves as the main image and its value is stored under the owning model's `assets/{element-slug}/` folder. `original_ref` points at the ORIGINAL binary asset in `sources/import/` or `sources/original/`; `source` cites the normalized `sources/nn/...` file whose frontmatter carries `sha256` (original) and, when a derivative exists, `media_file` + `media_sha256`. The `Entry x Evidence matrix` records which Entries each Evidence witnesses and how directly (`primary`, `visible`, `partial`).

### Methodologies

- **Double-hash discipline**: the normalized source frontmatter records `sha256` of the ORIGINAL and `media_sha256` of the DERIVATIVE; the ingestion SOP writes both and re-checks the pair.
- **Deduplicate by hash**: collapse duplicate Evidence by image path (preferred) or normalized-source `sha256` before upserting.
- **One main image**: keep exactly one `image` field per Evidence; put any additional imagery in the element's own assets folder.

### Prompts

- "Create an `Evidence` named `<label>` with image `<file>`."
- "Cite the normalized source for `<evidence>`."
- "Mark `<entry>` as `primary` in `<evidence>`."
- "Re-check the original and derivative hashes for `<evidence>`."
