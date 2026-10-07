---
spec_version: "V_0-4-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-4-0_NN.md"
level: 1
parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md"
title: "iNNfo Meta-bluepriNNt Specification"
description: "Level-1 meta-bluepriNNt defining the four root primitives (Concept Definition, Field Definition, Matrix Definition, Marker Definition), stable element identity via immutable slugs, and the unified NN syntax: `# NN` sections, `## NN` elements, and `key:: value` properties."
author: "innV0 Team"
status: "Draft"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# iNNfo Meta-bluepriNNt Specification

## A concrete specification for semantic modeling with concepts, elements, fields, markers, and relationships, expressed through the unified NN syntax and a self-describing meta-bluepriNNt

## Philosophy

iNNfo is designed around five principles:

1. **Rich specs, lean models**: Specification documents (levels 0–2) are semantically rich. kNNowledge documents (level 3) carry only data and a parent pointer. The application resolves and caches the parent chain.
2. **Self-describing**: Every iNNfo document is valid Markdown with YAML frontmatter and the unified `NN` syntax. No proprietary tooling required to read it.
3. **Meta-bluepriNNt**: The level-1 specification is itself a *meta-bluepriNNt*. Level-2 bluepriNNts are ordinary iNNfo documents that instantiate the four root primitives — `Concept Definition`, `Field Definition`, `Matrix Definition`, and `Marker Definition` — as ordinary elements in their body. There is no separate declaration format.
4. **Relationship polymorphism**: Relationships between concepts and elements are expressed through a typed system — hierarchy, evaluable matrices, graph edges, and sequences.
5. **Stable identity via immutable slugs**: Every entity (element, concept, matrix) possesses an explicit, immutable slug identifier (`slug::`). Display names are decoupled from identity and scoped to their concept, allowing identical display names across distinct concepts. Once assigned, a slug is permanent across renames and edits.

## Objectives

- Define a unified, minimal syntax: `# NN <Concept>`, `## NN <Concept>: <Element>`, immutable `slug::` declarations, and `key:: value` properties.
- Define the **Metaplantilla Nivel 1**: the four root primitives that every level-2 bluepriNNt instantiates.
- Establish immutable slugs for elements, concepts, and matrices to preserve citations and graph stability across renames (D1).
- Support cross-concept duplicate display names while scoping sibling display names within each concept (D3).
- Define extension-less model identity (`model_slug`) and universal `@` addressing grammar for elements, fields, and matrix cells (D4, D5).
- Enforce slug freezing (`freeze_slugs`) on mutation and domain-wide upgrades (D19).
- Remove the `concepts:` / `markers:` / `matrices:` frontmatter blocks from level-2 bluepriNNts; their schema is expressed as body elements.
- Enable machine parsing, validation, and visual rendering of kNNowledge via the parent chain resolver.
- Maintain full human readability and Git-diffability.
- Ensure that kNNowledge files are lightweight and never duplicate specification content.

## Unified Syntax

iNNfo uses three structural markers. The `NN` token is required and distinguishes iNNfo structure from ordinary Markdown.

| Construct | Syntax | Example |
|---|---|---|
| Concept section | `# NN <Concept>` (H1) | `# NN Stakeholders` |
| Element | `## NN <Concept>: <Element>` (H2) | `## NN Stakeholders: Customer` |
| Identity slug | `slug:: <slug>` (first property line) | `slug:: customer` |
| Property | `key:: value` (consecutive lines) | `importance:: high` |

A **Concept** is a named type declared by a bluepriNNt. A Concept section is introduced by an H1 heading `# NN <Concept>`.

An **Element** is a single instance of a Concept, declared as an H2 heading `## NN <Concept>: <Element>` within the Concept section. The `<Concept>` token names the owning concept (it MUST match the enclosing section concept).

An **Element Slug** is declared on the line immediately following the `## NN` heading via `slug:: <slug>`. The slug MUST be lowercase kebab-case conforming to `^[a-z0-9]+(?:-[a-z0-9]+)*$`. The slug is immutable: renaming an element modifies its display name in the `## NN` heading but preserves `slug::` unchanged.

A **Field** is a typed key-value property of an Element. Element properties are written on consecutive `key:: value` lines immediately after the `slug::` line (or heading), before any free-form description text.

```markdown
# NN Stakeholders

## NN Stakeholders: Customer
slug:: customer
importance:: high
needs:: [speed, accuracy]
Customer description text follows the properties.
```

Property values follow a small value grammar:

- Plain text — `relationship_model:: Dedicated`
- Quoted text — `brand_name:: "Acme Inc."`
- Numbers — `weight:: 90`
- Booleans — `published:: true`
- Inline arrays — `options:: [Ideation, MVP, Validation]`
- Inline objects (JSON) — `config:: {"a": 1}`

There is exactly ONE syntax. Older documents that use the legacy `_NN` markers or
fenced ```yaml blocks are not supported and MUST be migrated to the unified syntax.

## Universal Addressing Grammar

Source references and citations support semantic addressing across documents without relying on fragile headings or filesystem extensions:

| Target | Grammar Syntax | Resolves To |
|---|---|---|
| Entire Model | `model_slug` | Model document root |
| Element | `model_slug@element-slug` | Specific element instance |
| Element Field | `model_slug@element-slug&field_name` | Value of an element field |
| Matrix | `model_slug@matrix-slug` | Specific matrix definition/table |
| Matrix Cell | `model_slug@matrix-slug&row-slug&col-slug` | Specific cell at row × col |
| Heading (Legacy) | `doc.md@## Heading` or `doc.md#heading` | Headings/sections fallback |

Within the same model or domain, references (`[[target]]`) resolve with the following 3-tier precedence:
1. Exact element slug match (`element.slug`).
2. Exact display name match (legacy fallback).
3. Normalized display name match (case and punctuation insensitive fallback).

If a display name reference matches multiple elements belonging to different concepts, the reference is rejected as ambiguous (`AMBIGUOUS_ELEMENT_NAME`). Authors MUST qualify the reference or use the element's unique `slug`.

## Root Primitives (Metaplantilla Nivel 1)

A level-2 **bluepriNNt** is an iNNfo document (level 2) that instantiates the four root primitives. Each primitive is a reserved Concept name whose Elements carry the schema of the bluepriNNt.

| Primitive | Reserved Concept | Purpose | Instantiation |
|---|---|---|---|
| `Concept Definition` | `# NN Concept Definition` | Declares one Concept of the bluepriNNt | `## NN Concept Definition: <Name>` |
| `Field Definition` | `# NN Field Definition` | Declares one typed Field of a Concept | `## NN Field Definition: <Name>` |
| `Marker Definition` | `# NN Marker Definition` | Declares one evaluative Marker | `## NN Marker Definition: <Name>` |
| `Matrix Definition` | `# NN Matrix Definition` | Declares one evaluable Matrix | `## NN Matrix Definition: <Name>` |

### Concept Definition

Declares a Concept. The Element name is the Concept name. Allowed properties:

| Property | Type | Description |
|---|---|---|
| `slug` | string | Explicit kebab-case slug identifier |
| `type` | `text` \| `category` \| `weight` \| `list` \| `steps` \| `sequence` \| `knowledge` | Representation of the Concept (required) |
| `icon` | string | Lucide icon identifier |
| `color` | string | Theme color |
| `weight` | number | Display priority (higher = more prominent) |

```markdown
# NN Concept Definition

## NN Concept Definition: Stakeholders
slug:: stakeholders
icon:: users
type:: weight
color:: blue
weight:: 80
```

### Field Definition

Declares a typed Field of a Concept. The Element name is the Field name. Allowed properties:

| Property | Type | Description |
|---|---|---|
| `slug` | string | Explicit kebab-case slug identifier |
| `concept` | string | Name of the owning Concept Definition (required) |
| `type` | `string` \| `select` \| `reference` \| `markdown_inline` \| `markdown_file` \| `image` \| `file` \| `video` \| `audio` \| `url` \| `knowledge` \| `citation` | Field type (required) |
| `options` | array | Allowed values for `select` fields |
| `target_concepts` | array | Target concepts for `reference` fields |
| `description` | string | Human-readable explanation |
| `target_blueprint` | string | Required bluepriNNt name or URL for knowledge fields |

```markdown
# NN Field Definition

## NN Field Definition: status
concept:: Stakeholders
type:: select
options:: [Ideation, MVP, Validation]
```

**Reference Fields (`type:: reference`).** Property values for fields declared with `type:: reference` MUST be formatted using WikiLink syntax `[[Target Element]]` (e.g. `location:: [[Salón-Comedor]]`). Bare string values without WikiLink delimiters are not parsed as active element-to-element graph references.

**Knowledge Fields (`type:: knowledge`).** A Field of any Concept MAY be declared `type:: knowledge`. Its value is a domain-relative path, a `./`-relative path, or a WikiLink wrapping either (`[[kNNowledge/acme_business_NN.md]]`). When the Field declares `target_blueprint`, the referenced kNNowledge document's `parent_spec` MUST identify that bluepriNNt. Knowledge fields are followed during domaiNN traversal, so a document referenced by two parents appears once in the graph with both incoming edges — a diamond is not a cycle.

**Citation Fields (`type:: citation`).** A Field declared `type:: citation` holds a pointer list to the Source documents it derives from, using the same bracketed grammar as the reserved `sources::` property (`[sources/nn/<filename>#<heading-slug>, ...]`). Unlike `reference` and `knowledge`, its values are validated by the `KU_*` integrity checks and are read into the element's source citations.

**Qualified Cross-Knowledge References.** A `reference` or `knowledge` Field MAY target an Element in another kNNowledge document in the same domaiNN using the qualified form `[[Document Title :: Element Name]]` or `[[model_slug@element-slug]]`.

### Marker Definition

Declares an evaluative Marker scored per Element or Concept via the reserved `item-markers matrix`. The Element name is the Marker name. Allowed properties:

| Property | Type | Description |
|---|---|---|
| `slug` | string | Explicit kebab-case slug identifier |
| `applies_to` | array of `Element` \| `Concept` | Which entities may be scored on this Marker. Defaults to `[Element]`. An `item-markers matrix` row whose subject is not permitted by `applies_to` is a validation ERROR. |
| `values` | array | Allowed scores for this Marker (empty cell `-` is always accepted). Omit for a free numeric Marker constrained only by `widget_config`. |
| `widget` | `boolean` \| `cycle` \| `scale` \| `set` \| `text` | Cell interaction widget for this Marker's `item-markers matrix` column. |
| `widget_config` | object | Widget-specific configuration — see Widget Configuration. |
| `symbol` | string | Display symbol (e.g. `*`, `!`, `?`) |
| `icon` | string | Lucide icon identifier |
| `color` | string | Theme color |
| `weight` | number | Display priority (higher = more prominent). This is NOT a score. |

Scoring a Marker is mechanically an `evaluable_matrix` relationship (`Elements` or
`Concepts` × `Markers`), so a Marker Definition shares the `values` / `widget` /
`widget_config` vocabulary of a Matrix Definition. The Marker Definition remains a
distinct root primitive; it is not rewritten as a Matrix Definition.

```markdown
# NN Marker Definition

## NN Marker Definition: priority
slug:: priority
applies_to:: [Element]
symbol:: !
icon:: flag
color:: red

## NN Marker Definition: certainty
slug:: certainty
applies_to:: [Element, Concept]
widget:: scale
widget_config:: {"min": 0, "max": 100, "step": 5}
icon:: help-circle
color:: green
```

### Matrix Definition

Declares an evaluable Matrix. The Element name is the Matrix name. Allowed properties:

| Property | Type | Description |
|---|---|---|
| `slug` | string | Explicit kebab-case slug identifier |
| `source` | string | Source Concept (rows) — required |
| `target` | string | Target Concept or reserved pseudo-Concept (columns) — required |
| `values` | array | Allowed cell values (empty cell `-` and boolean marker `X` are always accepted) |
| `widget` | `boolean` \| `cycle` \| `scale` \| `set` \| `text` | Cell interaction widget |
| `widget_config` | object | Widget-specific configuration — see Widget Configuration |
| `description` | string | Human-readable explanation |

```markdown
# NN Matrix Definition

## NN Matrix Definition: problems-value propositions matrix
slug:: problems-value-propositions
source:: Problems
target:: Value propositions
widget:: set
values:: [Max, Very High, High]
```

### Widget Configuration

`widget_config` is an OPTIONAL inline JSON object that parameterizes the cell
interaction widget. It MUST be valid JSON on a single line.

| Widget | Key | Type | Default | Description |
|---|---|---|---|---|
| `scale` | `min` | number | `0` | Minimum numeric score |
| | `max` | number | `100` | Maximum numeric score |
| | `step` | number | `1` | Step increment |
| | `unit` | string | `""` | Optional display suffix (e.g. `"%"` or `"pts"`) |
| `set` | `multi` | boolean | `false` | Allow selecting multiple values simultaneously |
| `cycle` | `wrap` | boolean | `true` | Cycle back to first value after reaching the last |
| `boolean` | `true_label` | string | `"X"` | Display text when true |
| | `false_label` | string | `"-"` | Display text when false |
| `text` | `max_length` | number | `200` | Character limit for cell input |
| | `placeholder` | string | `""` | Hint text for empty cells |

```markdown
## NN Marker Definition: confidence
applies_to:: [Element]
widget:: scale
widget_config:: {"min": 0, "max": 10, "step": 1, "unit": "/10"}
color:: purple

## NN Matrix Definition: feature-segment priority matrix
source:: Features
target:: Segments
widget:: set
widget_config:: {"multi": true}
values:: [Core, Secondary, Nice-to-have]
```

### Item-Markers Matrix

To score Markers on Elements or Concepts, a bluepriNNt uses a reserved Matrix Definition:
`## NN Matrix Definition: item-markers matrix`.

- `source`: the Concept whose Elements are being scored (e.g. `Stakeholders`), or `Concepts`
- `target`: `Markers` (the reserved pseudo-Concept representing all defined Markers)

```markdown
# NN Matrix Definition

## NN Matrix Definition: item-markers matrix
source:: Stakeholders
target:: Markers
```

Scoring is written in the kNNowledge document's matrix section:

```markdown
# NN matrices: item-markers matrix

| Element | priority | certainty |
|---|---|---|
| Customer | ! | 85 |
| Competitor | - | 40 |
```

### Free Matrices

Any Matrix that does NOT target `Markers` is a **Free Matrix** — an evaluable
relationship between two domain Concepts (e.g. `Problems` × `Value propositions`).

```markdown
# NN matrices: problems-value propositions matrix

| Problems | Solution A | Solution B |
|---|---|---|
| High latency | Max | High |
| Data loss | Max | Very High |
```

### Relationship Types Block (Frontmatter)

Level-2 bluepriNNts MAY declare custom graph edge types in frontmatter under
`relationship_types:`. A relationship type defines a typed directed connection
between elements.

```yaml
---
relationship_types:
  depends_on:
    directed: true
    label: "Depends on"
    inverse: "Required by"
    color: "#e06c75"
    style: "dashed"
  influences:
    directed: true
    label: "Influences"
    color: "#61afef"
    style: "solid"
---
```

Graph edges are written in the kNNowledge document's element section using `->` syntax:

```markdown
## NN Work: Deploy
depends_on -> [[Build]]
influences -> [[Monitoring]]
```

### Custom Guidance Headings in BluepriNNts

Level-2 bluepriNNts MAY include prose documentation sections after the schema definitions.
These sections provide human-readable guidance for authors and AI assistants filling out
kNNowledge documents based on the bluepriNNt.

To prevent guidance text from being parsed as model elements, bluepriNNt authors MUST use
regular Markdown headings (without the `NN` token) for guidance sections:

```markdown
# Concept Guidance Documentation

## Stakeholders
### Summary
Stakeholders are individuals, groups, or organizations that have an interest in or are affected by the system.

### Identification Strategy
1. Identify direct users who interact with the system daily.
2. Identify decision makers who approve funding and strategy.
3. Identify external parties subject to compliance or regulation.

### Fields Reference
- `importance`: Relative business impact (high, medium, low).
- `needs`: Bulleted list of explicit operational requirements.
```

- Headings starting with `# NN` or `## NN` are **structural** (parsed as schema).
- Headings starting with `#` or `##` (without `NN`) are **descriptive** (ignored by the schema parser).

## Level 2 BluepriNNt Structure

A level 2 bluepriNNt MUST follow this structure:

Frontmatter:

```yaml
---
spec_version: "V_0-4-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/<name>/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-4-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-4-0_NN.md"
title: "<BluepriNNt Title>"
blueprint_name: "<blueprint-name>"
blueprint_version: "V_x-y-z"
includes:                        # OPTIONAL — additive schema composition
  - name: "<base-blueprint>"
    url: "<immutable-URL>"
relationship_types:              # OPTIONAL — custom graph edges
  ...
---
```

### Schema Composition (`includes`)

A level-2 bluepriNNt MAY declare `includes:`, an array of `{name, url}` references to
peer level-2 bluepriNNts. `includes` composes the schemas of the included bluepriNNts into
the including bluepriNNt additively.

```yaml
---
includes:
  - name: "base"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/base/spec_NN.md"
---
```

#### Collision Rules

When two included bluepriNNts (or an included bluepriNNt and the including bluepriNNt) declare a
Definition with the same name:

1. If their canonical forms are **identical**, the collision is resolved cleanly: they
   carry a shared Definition (e.g. two slices of a former bluepriNNt both declaring
   the same `importance` Marker) and still compose.
2. If their canonical forms **differ**, it is a validation ERROR that MUST name
   both source documents and the Definition.

The **canonical form** of a Definition is its parsed body with: property order
normalized, surrounding whitespace in values trimmed, and set-like arrays
(`applies_to`, `options`, `target_concepts`) treated as order-insensitive. Every
actual value — `type`, `symbol`, `source`, `target`, `values`, `weight`,
`description`, a Concept's Field set, etc. — is significant. This rule applies
across the whole `includes` graph (transitively, depth-first, left to right); the
`includes` cycle check is unaffected (a diamond is not a cycle).

Body:

```markdown
> [!NOTE]
> This is an **iNNfo document**...

# NN index
* [[...]]  (the blueprint's root concepts)

# NN Concept Definition
## NN Concept Definition: <Concept>
slug:: <concept-slug>
icon:: <icon>
type:: <type>
color:: <color>
weight:: <n>

# NN Field Definition
## NN Field Definition: <Field>
slug:: <field-slug>
concept:: <Concept>
type:: <type>
options:: [...]
target_concepts:: [...]

# NN Marker Definition
## NN Marker Definition: <Marker>
slug:: <marker-slug>
symbol:: <symbol>

# NN Matrix Definition
## NN Matrix Definition: <Matrix>
slug:: <matrix-slug>
source:: <Concept>
target:: <Concept>
values:: [..]
widget:: set

# <Blueprint Name>       (prose: Philosophy, Objectives, Specification)
# Concept Guidance Documentation   (## <Concept> with ### Summary/Description/...)
```

## Level 3 kNNowledge Structure (Lightweight)

```yaml
---
spec_version: "V_0-4-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-4-0_NN.md"
model_slug: "<model-slug>"
workspace_id: "<workspace-id>"
level: 3
parent_spec:
  name: "<blueprint-name>"
  url: "<immutable-url>"
knowledge_version: "V_x-y-z"
title: "..."
---

> [!NOTE]
> ...
# NN index
...
# NN Concept
## NN Concept: Element
slug:: <element-slug>
key:: value
...
```

## DomaiNN Structure

An iNNfo DomaiNN is a workspace directory containing one or more kNNowledge documents. The entry point is a
`domaiNN_NN.md` (or root index) file at the DomaiNN root.

Standard directory conventions:
- `knowledge_dir`: `kNNowledge/`
- `blueprints_dir`: `specs/bluepriNNts/`

## Immutable Versioning Policy

- **Published specs are frozen.** Once a specification version is released, its file is
  never modified. Corrections or improvements require a new spec version.
- **Migrating a kNNowledge document** to a new spec version means creating a new copy of the document
  adapted to the new version.
- **Parent chain resolution** always resolves to the version the document was authored
  against.

## Removed Constructs

The following are NOT part of iNNfo:

- **FOLDER mode / `_F` markers** — documents are single files using `NN` markers only.
- **Hierarchy matrices** — hierarchy is expressed only through the index block.
- **`_FORMAT.md` filenames** — the canonical suffix is `_NN.md`.
- **`* _NN` element bullets and fenced ```yaml property blocks** — replaced by the
  unified `## NN` headings and `key:: value` properties.

## Metaschema (Self-Description)

The four root primitives are described by the prose tables above **and** expressed
mechanically, in iNNfo's own syntax, by the metaschema below. An application MUST
be able to validate any level-2 bluepriNNt by resolving this metaschema and checking
the bluepriNNt's `… Definition` elements against it.

### The Metaschema

```markdown
# NN Concept Definition

## NN Concept Definition: Concept Definition
type:: list

## NN Concept Definition: Field Definition
type:: list

## NN Concept Definition: Marker Definition
type:: list

## NN Concept Definition: Matrix Definition
type:: list

# NN Field Definition

## NN Field Definition: type
concept:: Concept Definition
type:: select
options:: [text, category, weight, list, steps, sequence, knowledge]
description:: Representation of the Concept (required).

## NN Field Definition: icon
concept:: Concept Definition
type:: string
description:: Lucide icon identifier.

## NN Field Definition: color
concept:: Concept Definition
type:: string
description:: Theme color.

## NN Field Definition: weight
concept:: Concept Definition
type:: string
description:: Display priority (higher = more prominent).

## NN Field Definition: concept
concept:: Field Definition
type:: string
description:: Name of the owning Concept Definition (required).

## NN Field Definition: type
concept:: Field Definition
type:: select
options:: [string, select, reference, markdown_inline, markdown_file, image, file, video, audio, url, knowledge, citation]
description:: Field type (required).

## NN Field Definition: options
concept:: Field Definition
type:: string
description:: Allowed values for select fields (inline array).

## NN Field Definition: target_concepts
concept:: Field Definition
type:: string
description:: Target concepts for reference fields (inline array).

## NN Field Definition: target_blueprint
concept:: Field Definition
type:: string
description:: Required blueprint name or URL for fields of type knowledge.

## NN Field Definition: description
concept:: Field Definition
type:: string
description:: Human-readable explanation.

## NN Field Definition: applies_to
concept:: Marker Definition
type:: string
description:: Inline array of Element and/or Concept — which entities may be scored. Default [Element].

## NN Field Definition: values
concept:: Marker Definition
type:: string
description:: Allowed scores (inline array). Omit for a free numeric scale.

## NN Field Definition: widget
concept:: Marker Definition
type:: select
options:: [boolean, cycle, scale, set, text]
description:: Cell interaction widget for the item-markers matrix column.

## NN Field Definition: widget_config
concept:: Marker Definition
type:: string
description:: Widget-specific configuration (inline JSON object).

## NN Field Definition: symbol
concept:: Marker Definition
type:: string
description:: Display symbol.

## NN Field Definition: icon
concept:: Marker Definition
type:: string
description:: Lucide icon identifier.

## NN Field Definition: color
concept:: Marker Definition
type:: string
description:: Theme color.

## NN Field Definition: weight
concept:: Marker Definition
type:: string
description:: Display priority. Not a score.

## NN Field Definition: source
concept:: Matrix Definition
type:: string
description:: Source Concept (rows) — required.

## NN Field Definition: target
concept:: Matrix Definition
type:: string
description:: Target Concept or reserved pseudo-Concept (columns) — required.

## NN Field Definition: values
concept:: Matrix Definition
type:: string
description:: Allowed cell values (inline array). Empty cell - and boolean marker X are always accepted.

## NN Field Definition: widget
concept:: Matrix Definition
type:: select
options:: [boolean, cycle, scale, set, text]
description:: Cell interaction widget.

## NN Field Definition: widget_config
concept:: Matrix Definition
type:: string
description:: Widget-specific configuration (inline JSON object).

## NN Field Definition: description
concept:: Matrix Definition
type:: string
description:: Human-readable explanation.
```

### Bootstrap Axiom

The metaschema is written in the very syntax it constrains. Its own conformance is
the single irreducible axiom of the system: an application **asserts** — it does
not derive — that the metaschema's `Field Definition` elements are valid
`Field Definition` instances. Every other conformance check in the ecosystem
(L2 against L1, L3 against L2) is mechanical and follows from it. This mirrors MOF
being defined in MOF and `Ecore.ecore` describing Ecore.

## Self-Description

This document (`iNNfo_V_0-4-0_NN.md`) is itself a level 1 specification following
defiNNition. It declares `parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md"` and defines
the four root primitives — plus the mechanical metaschema above — that every
level-2 bluepriNNt instantiates.
