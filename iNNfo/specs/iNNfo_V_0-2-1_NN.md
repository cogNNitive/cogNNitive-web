---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
level: 1
parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNe_V_0-1-0_NN.md"
title: "iNNfo Meta-template Specification"
description: "Level-1 meta-template defining the four root primitives (Concept Definition, Field Definition, Matrix Definition, Marker Definition) and the unified NN syntax: `# NN` sections, `## NN` elements, and `key:: value` properties."
author: "innV0 Team"
status: "Stable"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# iNNfo Meta-template Specification

## A concrete specification for semantic modeling with concepts, elements, fields, markers, and relationships, expressed through the unified NN syntax and a self-describing meta-template

## Philosophy

iNNfo is designed around five principles:

1. **Rich specs, lean models**: Specification documents (levels 0–2) are semantically rich. Models (level 3) carry only data and a parent pointer. The application resolves and caches the parent chain.
2. **Self-describing**: Every iNNfo document is valid Markdown with YAML frontmatter and the unified `NN` syntax. No proprietary tooling required to read it.
3. **Meta-template**: The level-1 specification is itself a *meta-template*. Level-2 templates are ordinary iNNfo documents that instantiate the four root primitives — `Concept Definition`, `Field Definition`, `Matrix Definition`, and `Marker Definition` — as ordinary elements in their body. There is no separate declaration format.
4. **Relationship polymorphism**: Relationships between concepts and elements are expressed through a typed system — hierarchy, evaluable matrices, graph edges, and sequences.
5. **One name, one identity**: An entity is identified by its name. The name is the single source of truth; there is no separate persisted identifier.

## Objectives

- Define a unified, minimal syntax: `# NN <Concept>`, `## NN <Concept>: <Element>`, and `key:: value` properties.
- Define the **Metaplantilla Nivel 1**: the four root primitives that every level-2 template instantiates.
- Remove the `concepts:` / `markers:` / `matrices:` frontmatter blocks from level-2 templates; their schema is expressed as body elements.
- Enable machine parsing, validation, and visual rendering of models via the parent chain resolver.
- Maintain full human readability and Git-diffability.
- Ensure that model files are lightweight and never duplicate specification content.

## Unified Syntax

iNNfo uses three structural markers. The `NN` token is required and distinguishes iNNfo structure from ordinary Markdown.

| Construct | Syntax | Example |
|---|---|---|
| Concept section | `# NN <Concept>` (H1) | `# NN Stakeholders` |
| Element | `## NN <Concept>: <Element>` (H2) | `## NN Stakeholders: Customer` |
| Property | `key:: value` (line immediately after the element heading) | `importance:: high` |

A **Concept** is a named type declared by a Template. A Concept section is introduced by an H1 heading `# NN <Concept>`.

An **Element** is a single instance of a Concept, declared as an H2 heading `## NN <Concept>: <Element>` within the Concept section. The `<Concept>` token names the owning concept (it MUST match the enclosing section concept).

A **Field** is a typed key-value property of an Element. Element properties are written on consecutive `key:: value` lines immediately after the `## NN` heading, before any free-form description text.

```markdown
# NN Stakeholders

## NN Stakeholders: Customer
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

## Root Primitives (Metaplantilla Nivel 1)

A level-2 **Template** is an iNNfo document (level 2) that instantiates the four root primitives. Each primitive is a reserved Concept name whose Elements carry the schema of the template.

| Primitive | Reserved Concept | Purpose | Instantiation |
|---|---|---|---|
| `Concept Definition` | `# NN Concept Definition` | Declares one Concept of the template | `## NN Concept Definition: <Name>` |
| `Field Definition` | `# NN Field Definition` | Declares one typed Field of a Concept | `## NN Field Definition: <Name>` |
| `Marker Definition` | `# NN Marker Definition` | Declares one evaluative Marker | `## NN Marker Definition: <Name>` |
| `Matrix Definition` | `# NN Matrix Definition` | Declares one evaluable Matrix | `## NN Matrix Definition: <Name>` |

### Concept Definition

Declares a Concept. The Element name is the Concept name. Allowed properties:

| Property | Type | Description |
|---|---|---|
| `type` | `text` \| `category` \| `weight` \| `list` \| `steps` \| `sequence` \| `model` | Representation of the Concept (required) |
| `icon` | string | Lucide icon identifier |
| `color` | string | Theme color |
| `weight` | number | Display priority (higher = more prominent) |

```markdown
# NN Concept Definition

## NN Concept Definition: Stakeholders
icon:: users
type:: weight
color:: blue
weight:: 80
```

### Field Definition

Declares a typed Field of a Concept. The Element name is the Field name. Allowed properties:

| Property | Type | Description |
|---|---|---|
| `concept` | string | Name of the owning Concept Definition (required) |
| `type` | `string` \| `select` \| `reference` \| `markdown_inline` \| `markdown_file` \| `image` \| `file` \| `video` \| `audio` \| `url` \| `model` | Field type (required) |
| `options` | array | Allowed values for `select` fields |
| `target_concepts` | array | Target concepts for `reference` fields |
| `description` | string | Human-readable explanation |
| `target_template` | string | Required template name or URL for model fields |

```markdown
# NN Field Definition

## NN Field Definition: status
concept:: Stakeholders
type:: select
options:: [Ideation, MVP, Validation]
```

**Reference Fields (`type:: reference`).** Property values for fields declared with `type:: reference` MUST be formatted using WikiLink syntax `[[Target Element]]` (e.g. `location:: [[Salón-Comedor]]`). Bare string values without WikiLink delimiters are not parsed as active element-to-element graph references.

**Model Fields (`type:: model`).** A Field of any Concept MAY be declared `type:: model`. Its value is a workspace-relative path, a `./`-relative path, or a WikiLink wrapping either (`[[models/acme_business_NN.md]]`). When the Field declares `target_template`, the referenced model's `parent_spec` MUST identify that template. Model fields are followed during workspace traversal, so a model referenced by two parents appears once in the graph with both incoming edges — a diamond is not a cycle.

**Qualified Cross-Model References.** A `reference` or `model` Field MAY target an Element in another model in the same workspace using the qualified form `[[Model Title :: Element Name]]`. `Model Title` is the target model's frontmatter `title` (its filename without `.md` is accepted as a fallback) and MUST be unique within the workspace. `Element Name` is an Element name in that model. Positional or anchor forms (`path#slug`) are not defined. Cross-workspace references are not defined.


### Marker Definition

Declares an evaluative Marker scored per Element or Concept via the reserved `item-markers matrix`. The Element name is the Marker name. Allowed properties:

| Property | Type | Description |
|---|---|---|
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
applies_to:: [Element]
symbol:: !
icon:: flag
color:: red

## NN Marker Definition: certainty
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
| `source` | string | Source Concept (rows) — required |
| `target` | string | Target Concept or reserved pseudo-Concept (columns) — required |
| `values` | array | Allowed cell values (empty cell `-` and boolean marker `X` are always accepted) |
| `widget` | `boolean` \| `cycle` \| `scale` \| `set` \| `text` | Cell interaction widget |
| `widget_config` | object | Widget-specific configuration — see Widget Configuration |
| `description` | string | Human-readable explanation |

```markdown
# NN Matrix Definition

## NN Matrix Definition: problems-value propositions matrix
source:: Problems
target:: Value propositions
widget:: set
values:: [Max, Very High, High]
```

### Widget Configuration

`widget_config` is an OPTIONAL inline JSON object that parameterizes the cell
interaction `widget` of a Matrix Definition or a Marker Definition. Its keys are
fixed per `widget` value (see the table). An application SHOULD warn on a key not
listed for the declared `widget`, MUST treat a missing `min`/`max` under
`widget:: scale` as an ERROR, MUST otherwise ignore unrecognized keys, and MUST
NOT accept a semicolon- or comma-delimited string DSL in its place (the removed
`params: "a;b;c"` form).

| `widget` | `widget_config` keys | Meaning |
|---|---|---|
| `scale` | `min` (number, required), `max` (number, required), `step` (number, default `1`) | Numeric range of the slider |
| `cycle` | `order` (array) | Explicit cycle order; defaults to `values` order |
| `set` | `max_selections` (number, default unbounded) | Maximum simultaneously-selected values |
| `text` | `max_length` (number) | Maximum character count |
| `boolean` | — | No configuration |

```markdown
## NN Matrix Definition: effort-impact matrix
source:: Initiatives
target:: Outcomes
widget:: scale
widget_config:: {"min": 1, "max": 10, "step": 1}
```

### Resolving a Template Schema

An application resolves a Template's schema by parsing its body: the effective `concepts` are the elements of its `Concept Definition` sections, each Field Definition is attached to the Concept named by its `concept` property, and so on for Markers and Matrices. There is no other declaration format.

The primitives' own schema — which properties each `… Definition` element may
carry, and their allowed values — is itself an iNNfo document: the **Metaschema**
(see Metaschema (Self-Description)). An application validates a level-2 Template
against the Metaschema with the same Schema Resolution Algorithm it uses to
validate a level-3 Model against its Template. If the Template declares
`includes`, the composed schema is the additive union described under Level 2
Template Structure.

## Entity Glossary

iNNfo defines exactly these entities. Normative text uses only these canonical names.
The word "node" is an implementation term (a runtime graph representation) and MUST
NOT appear in normative text. The words block, section, instance, item, property, and
attribute MUST NOT be used as substitutes for the entities below.

**Containment spine (generic → specific):**

| Entity | Definition |
|---|---|
| **Workspace** | A directory with an `index.md` at its root that lists one or more Models. |
| **Model** | One level-3 document conforming to a Template. Contains Concepts and Elements. |
| **Concept** | A named type declared by the Template. Groups Elements of one kind. |
| **Element** | A single instance of a Concept. |
| **Field** | A typed key-value property of an Element, whose schema is declared on the Concept. |

**Cross-cutting entities:**

| Entity | Definition |
|---|---|
| **Marker** | A named evaluative dimension (e.g. weight, certainty, priority) scored per Element or Concept. |
| **Relationship** | A typed connection between Elements. Its subtypes are the Relationship Types. |
| **Matrix** | A first-class entity that realizes the `evaluable_matrix` Relationship Type: a table of Elements (rows) against Elements or a reserved pseudo-Concept (columns), each cell scored on a declared value set. Declared by a Matrix Definition. |

**Definitional layer:**

| Entity | Definition |
|---|---|
| **Specification** | A level-0 (defiNNe) or level-1 (iNNfo) document. |
| **Template** | A level-2 document that instantiates the four root primitives (Concept, Field, Marker, Matrix Definitions) to declare the Concepts, Markers, Matrices, and Relationship Types available to its Models. |

## Reserved Pseudo-Concepts

The names `Concepts`, `Elements`, and `Markers` are RESERVED. A Template MUST NOT
declare a Concept with any of these names. They denote cross-cutting sets:

- `Concepts` — the set of all Concepts in the Model.
- `Elements` — the set of all Elements across every Concept in the Model.
- `Markers` — the set of all declared Markers.

They are used as the `source`/`target` of cross-cutting matrices (for example, the
reserved `item-markers matrix` targets `Markers`).

## Identity & Naming

The **name is the single source of truth** for identity. No slug or opaque id is
persisted in a model file.

**Uniqueness:**

- An Element name MUST be unique within the whole Model — across all Concepts.
- A Concept name MUST be unique within the Model.
- A Model's logical name is its frontmatter `title`, which MUST be unique within the
  Workspace.
- A name collision is a validation ERROR. Applications MUST NOT silently disambiguate.

**Model name vs filename:** the Model's logical name is `title`, decoupled from the
filename. The filename carries version and template purely for the resolver; an
application MAY warn on a mismatch between filename and `title`.

**Qualified references:** within a Model a bare name resolves because names are unique.
Across a Workspace, an Element is referenced as `Model :: Name` (or
`Model :: Concept :: Name` when needed). Any fully-qualified path is constructed by the
application at load time for the Workspace in which the Model is opened; it is NEVER
persisted in the model file, so a Model stays portable across Workspaces.

**Rename** is an application operation. It MUST rewrite every reference to the renamed
entity — the declaring marker, index entries, matrix row/column labels,
reference-typed field values, graph edges, and cross-model references — in a single
transaction, then re-validate. References that are broken by out-of-application edits
MUST be reported by the application as dangling references.

## Parent Chain

iNNfo is a level 1 specification. Its `parent` points to defiNNe:

```yaml
parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNe_V_0-1-0_NN.md"
```

All templates (level 2) MUST declare `parent_spec` pointing to iNNfo. All models
(level 3) MUST declare `parent_spec` pointing to their template. Resolution follows the
Spec Resolver Protocol defined in defiNNe.

## Template Inline Restriction

A level 3 model MUST NOT include `concepts`, `markers`, `matrices`, or
`relationship_types` in its frontmatter. These are defined by the template (level 2)
as body elements instantiating the root primitives, and resolved via the
parent chain. The model frontmatter is limited to:

```yaml
---
level: 3
parent_spec:
  name: "<template-name>"
  url: "<immutable-url>"
model_version: "V_x-y-z"
title: "..."
---
```

## Fields & Assets

A Field is either **inline** or **file-backed**:

- **Inline field** — the value lives in the Element's `key:: value` properties
  (`string`, `select`, `reference`) or, for prose, as `markdown_inline` content.
- **File-backed field** — the value is a filename or URL; the content lives in a sidecar file or remote URL.
  The file-backed types are `markdown_file`, `image`, `file`, `video`, and `audio`.

**Image Fields & Main Image Resolution (Rule 1).** Fields holding image paths or URLs MUST be declared with `type:: image`. The primary/main image of an Element is deterministically defined as the FIRST field declared of `type:: image` in the owning Template's field definition order. Applications MUST NOT guess main images by inspecting field names or file extensions.

**Attribution Companion (`<base>_metadata`).** An optional companion field named `<baseField>_metadata` (`markdown_inline`) MAY be provided next to any file-backed or image field to store provenance and attribution data. When structured citations are provided, they SHOULD be encoded as a single-line CSL-JSON object:

```markdown
image_url:: assets/actors/Gene_Kelly.png
image_url_metadata:: {"id":"wikimedia-gene-kelly-1952","type":"webpage","author":[{"literal":"Wikimedia Commons"}],"title":"Gene Kelly (1952)","URL":"https://commons.wikimedia.org/...","license":"CC BY-SA"}
```

**Storage convention (single, canonical).** Every local file-backed field's file MUST be
stored at:

```
{modelDir}/assets/{element-slug}/{filename}
```

- `{element-slug}` is the Element's derived slug.
- The Element's property value holds the `{filename}`; the directory is derived by
  this convention and never stored.
- There is exactly ONE storage convention. An application MUST resolve, scan, and write
  file-backed fields through this single rule. There is no `asset_mode` and no
  per-element-at-root storage.

**Declared fields vs attachments.** The Concept `fields` schema is the source of truth
for which typed Fields an Element has. A file present under `assets/{element-slug}/` that
does not correspond to a declared Field is surfaced as an untyped **attachment**, not as
a Field. There is no parallel discovery mechanism.

**Rename.** Renaming an Element changes its `{element-slug}`; the transactional rename
MUST relocate the Element's `assets/{element-slug}/` folder accordingly.

## Provenance & Traceability (sources)

`sources` is an **optional** reserved property for Level 3 Elements that establishes traceability to source documents.

- **Optionality:** A Level 3 Model is syntactically valid with or without `sources::` properties. The parser and validator MUST NOT emit an error solely because `sources::` is omitted.
- **Location Convention:** Ingested source documents are stored under `sources/nn/` (or relative subfolders within `sources/`).
- **Syntax:** `sources:: [sources/nn/<filename>#<heading-slug>, ...]` (MUST always be formatted as a list enclosed in brackets `[...]`, even when referencing a single source document; no scalar string syntax or aliases are allowed). The anchor is a GitHub-style slug of the target document's heading, not a line range — it stays valid as long as the cited section isn't renamed or removed, regardless of reformatting elsewhere in the document.
- **Hierarchical Resolution & Scoping (Lexical Proximity Lookup):**
  - **Project / Local Scope (Default):** Relative paths (e.g., `sources/nn/<filename>.md#<anchor>` or `./sources/nn/...`) resolve against the nearest ancestor directory containing a `sources/` folder or local `sources_NN.md` catalog. This ensures project subdirectories and bounded contexts remain isolated and portable without polluting the global workspace catalog.
  - **Workspace Scope (Fallback & Root Citation):** Paths prefixed with `/` (e.g., `/sources/nn/<filename>.md#<anchor>`) or relative paths not found in the local project scope fall back to the root `sources/` directory declared in `workspace_NN.md`.

Example (Single Local Source):

```markdown
## NN Stakeholders: Enterprise Clients
sources:: [sources/nn/market_analysis.md#enterprise-clients]
relationship_model:: B2B Long-term
```

Example (Multiple Scoped Sources):

```markdown
## NN Stakeholders: Enterprise Clients
sources:: [sources/nn/market_analysis.md#enterprise-clients, /sources/nn/workspace_normative.md#regulatory-guidelines]
relationship_model:: B2B Long-term
```

## Relationship Types

A Template enables Relationship Types via a `relationship_types` map in its frontmatter:

```yaml
relationship_types:
  hierarchy:
    enabled: true
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
```

| Type | Meaning | Representation |
|---|---|---|
| `hierarchy` | Parent-child taxonomy | The `# NN index` block (see Index Block) |
| `evaluable_matrix` | N-to-M relationship on a value set | A **Matrix** (see Entity Glossary), declared by a Matrix Definition |
| `graph_edge` | Labeled/weighted graph edge | frontmatter `graph_edges` array |
| `sequence` | Ordered steps or events | Concept of type `steps` or `sequence` |

Hierarchy is expressed **only** through the index block. There is no hierarchy matrix.

## Model Body Syntax

**Document Notice (Required).** The first content in the body MUST be:

```markdown
> [!NOTE]
> This is an **iNNfo document**...
```

**Index Block.** The index block defines the taxonomy hierarchy of **Concepts** via
nested Markdown lists. Each list item identifies a **Concept** using **WikiLink syntax**
`[[Name]]`:

```markdown
# NN index
* [[Parent Concept]]
  * [[Child Concept]]
    * [[Grandchild Concept]]
* [[Another Root Concept]]
```

- Nesting depth indicates parent-child relationships between Concepts.
- The index block is identified by the name `index`.
- Every reference MUST resolve to a Concept name defined in the model; unresolvable
  references are reported as dangling references.
- List items MUST use `*` or `-` as the bullet character. Numbered lists are not
  supported. The valid-item pattern is `/^\s*[*\-]\s+/`.

**Elements MUST NOT appear in the index block.** Elements are declared within their
Concept sections using `## NN <Concept>: <Element>` headings. The relationship between
Elements and Concepts is established by the section structure (the Element heading
declares which Concept it belongs to) and by reference-typed fields (e.g.
`location:: [[Element Name]]`), NOT by nesting in the index.

The index block is the single mechanism for hierarchy.

**Concept Block.** Each Concept in the model corresponds to a section. The content
syntax depends on the Concept's `type`:

| Type | Syntax | Description |
|---|---|---|
| `text` | Free-form Markdown | Single block of content, no elements |
| `weight` | `## NN` element headings | Multi-instance, each with optional `key:: value` properties |
| `list` | `## NN` element headings | Multi-instance, each with optional `key:: value` properties |
| `category` | No content block | Taxonomy-only concept; children appear in index |
| `steps` | `## NN` element headings | Ordered sequence of instances |
| `sequence` | `## NN` element headings | Ordered sequence of events |

All multi-instance types use the same element-heading syntax:

```markdown
# NN Stakeholders
## NN Stakeholders: Element Name
field1:: value1
field2:: value2
Optional description text.

## NN Stakeholders: Another Element
Description without properties.
```

- The `# NN <Concept>` heading introduces a Concept block; the Concept name MUST match
  a concept defined in the template.
- The `## NN <Concept>: <Element>` heading declares an Element of that Concept. The
  parser pattern is `/^\s*##\s+NN\s+([^:\n]+?):\s+(.*)$/`. Element order is determined
  by document position.
- Property lines `key:: value` immediately follow the element heading. The parser
  pattern is `/^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*::\s*(.*)$/`.
- A single-instance `text` concept has no element headings; its content is plain
  Markdown.

**Matrix Block.** iNNfo supports two matrix kinds, distinguished by the section name in
`# NN matrices:`:

*Relational Matrix* — cross-tabulates Elements of a source Concept (rows) against
Elements of a target Concept (columns). Cells contain a value from the matrix's
declared `values`:

```markdown
# NN matrices: problems-value propositions matrix
| Problems \ Value propositions | VP Name |
| :--- | :---: |
| Problem name | High |
```

*Item-Markers Matrix* — the reserved section name `item-markers matrix` assigns Marker
scores to Elements or Concepts. Rows are Element or Concept names; columns are Marker
names defined in the template:

```markdown
# NN matrices: item-markers matrix
| Item \ Marker | weight | certainty | priority |
| :--- | :---: | :---: | :---: |
| Element Name | 9 | 5 | - |
```

## Level 2 Template Structure (Metaplantilla)

A template is a level-2 iNNfo document. Its frontmatter declares only identity, parent_spec,
and relationship settings; its body instantiates the four root primitives.

```yaml
---
spec_version: "V_0-2-0"
spec_url: "<immutable-url>"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-0_NN.md"
title: "<Template Name>"
template_version: "V_x-y-z"
specializes: "<base-template-name>"          # reserved, inert
includes:                                    # OPTIONAL — additive schema composition
  - name: "<base-template-name>"
    url: "<immutable-url>"
relationship_types: {...}
---
```

`template_version` is the template's own immutable identity, independent of
`spec_version` (which tracks the template's L1-compliance level, not the
template's own revision history). It is filename-encoded — a bump always produces a
new file (e.g. `procedures_V_0-1-0_NN.md` → `procedures_V_0-2-0_NN.md`); the old
file is never edited in place or deleted while any model still references it.

`specializes` is a **reserved, inert** optional field naming a base template for
future structural inheritance. It MUST NOT be interpreted or enforced by any
resolver, validator, or mutation tool — it is a no-op today, kept deliberately
distinct from `template_version` so specialization and versioning are never
conflated into the same mechanism again.

`includes` is an OPTIONAL array of `{ name, url }` entries naming peer templates
whose schemas are composed into this template **additively**. A bare string
entry is tolerated on read as shorthand for `{ name, url: "" }` (resolved
locally by name). When an application resolves a Template that declares
`includes`:

1. It resolves each included Template first — itself resolved through its own
   parent chain and its own `includes`, depth-first, left to right.
2. It unions their `Concept Definition`, `Field Definition`, `Marker Definition`,
   and `Matrix Definition` elements.
3. It then applies this Template's own definitions on top.

**How `includes` relates to the parent chain and `specializes`.** These are three
independent axes:

| Axis | Question | Direction | Cardinality |
|---|---|---|---|
| `parent_spec` (parent chain) | Which schema level do I conform to? | Vertical — L3 → L2 → L1 → L0 | Exactly one |
| `includes` | Which *peer* templates do I borrow Definitions from? | Horizontal — L2 ∪ L2 | Zero or more |
| `specializes` | Which base template will I *override* (future)? | Horizontal, by substitution | Zero or one — **inert today** |

A level-2 template's `parent_spec` is always the level-1 iNNfo spec, never
another template. The template that declares `includes` is the **composite** —
the one a Model names as its `parent_spec`; the included templates are ordinary
standalone templates used as ingredients, not a lower tier. `includes` is only
valid on level-2 templates; a level-3 Model composes through its template's
`includes`, never its own.

Composition is **purely additive**. A definition MUST NOT override or remove an
inherited one.

**Duplicate names across sources.** When two sources (two included Templates, or
an included Template and the composite's own body) declare a Definition of the
same primitive with the same name (compared case-insensitively):

1. If their **canonical form is identical**, the duplicate is silently merged —
   the composed schema keeps a single entry. This lets independent Templates each
   carry a shared Definition (e.g. two slices of a former template both declaring
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

For example, composing both `projects` and `organization` while each declares a
`Roles` Concept with a *different* body is an ERROR until one side renames;
composing two Templates that declare a byte-identical `Roles` is not.

`includes` is distinct from `specializes` (which stays inert) and from
`template_version`; an application MUST NOT conflate the three, and `includes`
does not read or interact with `specializes`.

Body:

```markdown
> [!NOTE]
> This is an **iNNfo document**...

# NN index
* [[...]]  (the template's root concepts)

# NN Concept Definition
## NN Concept Definition: <Concept>
icon:: <icon>
type:: <type>
color:: <color>
weight:: <n>

# NN Field Definition
## NN Field Definition: <Field>
concept:: <Concept>
type:: <type>
options:: [...]
target_concepts:: [...]

# NN Marker Definition
## NN Marker Definition: <Marker>
symbol:: <symbol>

# NN Matrix Definition
## NN Matrix Definition: <Matrix>
source:: <Concept>
target:: <Concept>
values:: [..]
widget:: set

# <Template Name>       (prose: Philosophy, Objectives, Specification)
# Concept Guidance Documentation   (## <Concept> with ### Summary/Description/...)
```

## Level 3 Model Structure (Lightweight)

```yaml
---
spec_version: "V_0-2-0"
spec_url: "<immutable-url>"
level: 3
parent_spec:
  name: "<template-name>"
  url: "<immutable-url>"
model_version: "V_x-y-z"
title: "..."
---

> [!NOTE]
> ...
# NN index
...
# NN Concept
## NN Concept: Element
key:: value
...
```

## Workspace Structure

A iNNfo Workspace is a directory containing one or more Models. The entry point is an
`index.md` file at the Workspace root.

**index.md (Required).** Every Workspace MUST have an `index.md` at its root. The
application reads `index.md` as the single entry point — no filesystem scanning. It uses
`# NN index` with standard Markdown links to list all Workspace Models:

```markdown
# NN index

* [Business Model](./Business%20Model_V_1-0-0_business_NN.md)
* [KB Model](./KB%20Model_V_1-0-0_kb_NN.md)
```

- The Workspace root `index.md` MUST use Markdown link syntax for Open Knowledge Format
  (OKF) compatibility.
- Each link target MUST be an `_NN.md` file relative to the Workspace root.
- If `index.md` is missing, the application SHALL return an error.
- If a link targets a non-existent file, the parser SHALL emit a warning and skip it.

**Relationship to Open Knowledge Format (OKF).** iNNfo's Workspace convention is
informed by the [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).
Both use Markdown files with YAML frontmatter. OKF consumers can navigate a iNNfo
Workspace: `index.md` has no frontmatter and is read as a reserved index file; links are
standard Markdown; `NN` markers are plain text and safely ignored. iNNfo extends OKF
with structured semantic modeling (parent chain, root primitives, markers, matrices)
that OKF does not define; these are additive.

## Immutable Versioning Policy

- **Published specs are frozen.** Once a specification version is released, its file is
  never modified. Corrections or improvements require a new spec version.
- **Migrating a model** to a new spec version means creating a new copy of the model
  adapted to the new version.
- **Parent chain resolution** always resolves to the version the model was authored
  against.

## Removed Constructs

The following are NOT part of iNNfo:

- **FOLDER mode / `_F` markers** — models are single files using `NN` markers only.
- **Hierarchy matrices** — hierarchy is expressed only through the index block.
- **`_FORMAT.md` filenames** — the canonical suffix is `_NN.md`.
- **`* _NN` element bullets and fenced ```yaml property blocks** — replaced by the
  unified `## NN` headings and `key:: value` properties.

## Metaschema (Self-Description)

The four root primitives are described by the prose tables above **and** expressed
mechanically, in iNNfo's own syntax, by the metaschema below. An application MUST
be able to validate any level-2 Template by resolving this metaschema and checking
the Template's `… Definition` elements against it.

The **property/enum conformance pass** (steps 4–5 below) is shared: L2-against-L1
and L3-against-L2 run the *same* check, differing only in which schema document is
resolved. The remaining passes are level-specific — reference-field resolution and
matrix-cell validation apply only to level-3 Models, and the Concept `type` enum
is enforced only at the L2-against-L1 boundary (a level-3 Model has no analogous
per-Concept `type` field).

### Schema Resolution Algorithm

To validate a document `D` against a schema document `S`:

1. Parse `S`'s `Concept Definition` elements into the set of allowed Concepts.
2. For each `Field Definition` element in `S`, attach `{type, options,
   target_concepts, description}` to the Concept named by its `concept` property.
   Field Definition element names are keyed **per owning Concept**, not globally —
   two Concepts may each declare a Field named `type`.
3. For each `Marker Definition` / `Matrix Definition` element in `S`, record its
   allowed property set likewise.
4. Walk `D`'s elements. For each, resolve its owning Concept in the schema and
   check every `key:: value` property against that Concept's Field schema: the
   value's type, its membership in `options` when the Field is `select`, and
   WikiLink form when the Field is `reference`.
5. Report any value that violates its Field's type or `options` (ERROR) and any
   missing required property (ERROR). An element whose Concept is absent from the
   schema is an ERROR. A property not declared on its Concept is a WARNING when
   `D` is a level-2 Template (an undeclared property on a `… Definition` is
   always a mistake); at level 3 it is allowed — extra per-Element metadata is a
   legitimate authoring pattern.

When `D` is a level-2 Template, `S` is this metaschema and `D`'s Concepts are the
reserved primitive names below; the `type` enum of a Concept Definition
(`text | category | weight | list | steps | sequence | model`) is enforced by this
pass — a value outside the set is an ERROR. When `D` is a level-3 Model, `S` is `D`'s
resolved level-2 Template (its own Definitions plus everything it `includes`).

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
options:: [text, category, weight, list, steps, sequence, model]
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
options:: [string, select, reference, markdown_inline, markdown_file, image, file, video, audio, url, model]
description:: Field type (required).

## NN Field Definition: options
concept:: Field Definition
type:: string
description:: Allowed values for select fields (inline array).

## NN Field Definition: target_concepts
concept:: Field Definition
type:: string
description:: Target concepts for reference fields (inline array).

## NN Field Definition: target_template
concept:: Field Definition
type:: string
description:: Required template name or URL for fields of type model.

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

This document (`iNNfo_V_0-2-1_NN.md`) is itself a level 1 specification following
defiNNe. It declares `parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNe_V_0-1-0_NN.md"` and defines
the four root primitives — plus the mechanical metaschema above — that every
level-2 template instantiates.
