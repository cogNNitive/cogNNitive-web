# The entity-relationship model

Every box in the diagrams below is a construct a published specification already
defines — none of them is invented for this page. Read it as a map of the repo's own
data model: the schema a bluepriNNt declares, the data a kNNowledge document holds, and
the inventory a domaiNN keeps around them.

The model has two views, so it is drawn twice: one view follows the specification chain
down to values, the other shows what a domaiNN contains.

## Diagram 1 — from the schema to the values

```mermaid
erDiagram
    META_BLUEPRINT ||--o{ BLUEPRINT : "parent_spec"
    BLUEPRINT }o--o{ BLUEPRINT : "includes"
    BLUEPRINT ||--o{ CONCEPT : "declares"
    BLUEPRINT ||--o{ FIELD : "declares"
    BLUEPRINT ||--o{ MATRIX : "declares"
    BLUEPRINT ||--o{ RELATIONSHIP_TYPE : "declares"
    BLUEPRINT ||--o{ KNOWLEDGE_DOC : "parent_spec"
    CONCEPT }o--o{ FIELD : "typed by (concept)"
    CONCEPT ||--o{ MATRIX : "source, rows"
    CONCEPT ||--o{ MATRIX : "target, columns"
    CONCEPT ||--o{ CONCEPT : "container of distributed instances"
    DOMAIN ||--o{ KNOWLEDGE_DOC : "holds in knowledge_dir"
    DOMAIN }o--o{ BLUEPRINT : "installs in blueprints_dir"
    DOMAIN ||--|| KNOWLEDGE_DOC : "entry, domaiNN_NN.md"
    CONCEPT ||--o{ ELEMENT : "instantiated as"
    KNOWLEDGE_DOC ||--o{ ELEMENT : "contains"
    ELEMENT ||--o{ ELEMENT : "nests, parent_slug"
    ELEMENT ||--o{ FIELD_VALUE : "carries"
    FIELD ||--o{ FIELD_VALUE : "gives meaning to"
    FIELD_VALUE }o--o| ELEMENT : "typed reference target"
    MATRIX ||--o{ MATRIX_CELL : "evaluated in"
    ELEMENT ||--o{ MATRIX_CELL : "row"
    ELEMENT ||--o{ MATRIX_CELL : "column"
    ELEMENT ||--o{ EDGE : "from"
    EDGE }o--|| ELEMENT : "to"
    RELATIONSHIP_TYPE ||--o{ EDGE : "types"

    META_BLUEPRINT {
        string spec_version PK "V_0-7-0 and so on, frozen once published"
        string title
    }
    BLUEPRINT {
        string name PK "blueprint_name, kebab-case"
        string version "blueprint_version"
        string spec_version "the iNNfo version it instantiates"
        string title
    }
    CONCEPT {
        string slug PK "kebab-case, unique in the bluepriNNt"
        string type "text, category, weight, list, steps, sequence, knowledge, model"
        string storage "compact by default, or distributed"
        string placement "folder pattern, required when distributed"
    }
    FIELD {
        string slug PK "kebab-case"
        string concept "owning concept, a list, or *"
        string type "string, select, reference, knowledge, address, citation..."
        boolean multiple "select fields only"
    }
    MATRIX {
        string slug PK "kebab-case"
        string source "concept in the rows"
        string target "concept in the columns"
        string widget "boolean, cycle, scale, set or text"
    }
    RELATIONSHIP_TYPE {
        string key PK "written as key -> target in the document"
        string label
        boolean directed
        string inverse
    }
    KNOWLEDGE_DOC {
        string id PK "hierarchical id, derived from the path, never stored"
        string title "display only, never resolves an address"
        string knowledge_version "V_x-y-z"
        string parent_spec "the bluepriNNt it was authored against"
    }
    ELEMENT {
        string slug PK "kebab-case, immutable"
        string concept "the concept it instantiates"
        string parent_slug "set when the element is nested"
        string body "prose after the property lines"
    }
    FIELD_VALUE {
        string value "plain, quoted, number, boolean, array, object or address"
    }
    EDGE {
        string rel_type "a declared relationship_types key"
        string target_slug
    }
    MATRIX_CELL {
        string value "empty cell, boolean X, or a declared value"
    }
    DOMAIN {
        string name PK "the domaiNN"
        string knowledge_dir "kNNowledge"
        string blueprints_dir "specs/bluepriNNts"
    }
```

## Diagram 2 — what the domaiNN keeps around the documents

```mermaid
erDiagram
    DOMAIN ||--o{ SOURCE : "inventory"
    DOMAIN ||--o{ SYNCHRONIZATION : "declares"
    SYNCHRONIZATION ||--o{ SOURCE : "lands"
    SYNCHRONIZATION ||--o{ MIRROR : "lands"
    MIRROR ||--|| KNOWLEDGE_DOC : "read-only copy of the origin document"
    SOURCE ||--o| SIDECAR : "cognitivized into"
    CHANGE }o--|| KNOWLEDGE_DOC : "target address"

    DOMAIN {
        string name PK "the domaiNN"
    }
    SOURCE {
        string raw_path PK "under sources/import/"
        string type
        string format
        string status
    }
    SYNCHRONIZATION {
        string alias PK "also the folder name under sources/sync"
        string kind "file, folder or url"
        string state
    }
    MIRROR {
        string path PK "sources/sync/alias/"
        string origin_uri
    }
    SIDECAR {
        string hash PK "of the original file"
        number size
        string normalized_body "for binary files"
    }
    CHANGE {
        string op PK "the schema operation applied"
        string target "an address into a document"
        string from
        string to
        string evidence "citation, the one reserved citation field"
        string status
    }
    KNOWLEDGE_DOC {
        string id PK "hierarchical id"
    }
```

## How to read it

- **Two worlds in one diagram.** `CONCEPT`, `FIELD`, `MATRIX` and `RELATIONSHIP_TYPE`
  are what a bluepriNNt *declares*. `ELEMENT`, `FIELD_VALUE`, `EDGE` and `MATRIX_CELL`
  are what a kNNowledge document *holds*. An element only means something against the
  concept it instantiates, which is why `CONCEPT ||--o{ ELEMENT` is the central edge.
- **Crow's foot.** `||--o{` is one-to-many, `||--||` one-to-one, `}o--o{` many-to-many,
  `}o--o|` many-to-zero-or-one. The label names the role, not a column.
- **`PK` marks identity, not storage.** No entity has a stored primary key: a document is
  identified by its hierarchical id and an element by its slug, both derived. The marker
  says what makes two instances different.
- **The source and change boxes are concept instances.** `Source`, `Synchronization`,
  `Change` and `Mirror` are elements of concepts declared by the `sources` and `changes`
  bluepriNNts; they appear as entities here only because they carry relations the reader
  cares about. Their storage is the same `ELEMENT` machinery as everything else.
- **History is not stored.** `CHANGE` records what was applied and where; the lineage and
  the history of a document are computed from those changes, so no edge in the diagram
  represents a cache.

## Where each box comes from

| Box | Level | Defined by |
|---|---|---|
| `META_BLUEPRINT` | 1 | `iNNfo/specs/iNNfo_V_0-7-0_NN.md` (the meta-bluepriNNt) |
| `BLUEPRINT` | 2 | the meta-bluepriNNt: frontmatter plus the three root primitives |
| `CONCEPT` | 2 | `# NN Concept Definition` |
| `FIELD` | 2 | `# NN Field Definition` |
| `MATRIX` | 2 | `# NN Matrix Definition` |
| `RELATIONSHIP_TYPE` | 2 | the `relationship_types:` frontmatter block |
| `KNOWLEDGE_DOC`, `ELEMENT`, `FIELD_VALUE`, `EDGE`, `MATRIX_CELL` | 3 | the meta-bluepriNNt's Level 3 structure |
| `DOMAIN` | 3 | `iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md` |
| `SOURCE`, `SYNCHRONIZATION` | 3 | `iNNfo/specs/bluepriNNts/sources/spec_NN.md` |
| `SIDECAR` | 3 | `iNNfo/specs/bluepriNNts/sidecar/spec_NN.md` |
| `CHANGE` | 3 | `iNNfo/specs/bluepriNNts/changes/spec_NN.md` |

## The three identities the diagram relies on

1. **Hierarchical id** — the identity of a document, derived only from its own path and
   its bluepriNNt's declarations: the stem without `_NN` for a compact document, a
   container chain plus slug for an instance model. A stem, a path and a title are never
   ids.
2. **Element slug** — the identity of an element inside its document, immutable: renaming
   the element changes its display name and leaves the slug alone.
3. **Title** — display only. Two documents may share a title without conflict, because no
   address ever resolves through it.

## Storage shows up as cardinality

`CONCEPT.storage` changes how the diagram is populated, not its shape:

- **compact** (the default): every instance of the concept is an `ELEMENT` inside one
  `KNOWLEDGE_DOC`.
- **distributed**: every instance is the root `ELEMENT` of its own `KNOWLEDGE_DOC` — an
  instance model — placed by the concept's `placement` rule, with `slug::` equal to its
  folder slug. Its child concepts stay elements of that same document.

Either way one `COLLECTION` exists — the domaiNN-wide set of instances of one concept,
ordered by id — and it is computed, never stored, so it has no box.

## Deliberately absent

| Not drawn | Why |
|---|---|
| addresses (`doc@element&field`, `matrix&row&col`) | a value grammar, not a table; they live in `FIELD_VALUE` and `CHANGE.target` |
| lineage, collections, index | computed on demand from documents and applied changes |
| `artifacts/` and its write-once families | producer output, outside the schema: no concept declares it |
| the bluepriNNt catalog | a folder of `BLUEPRINT` instances, not a new entity |

## See also

- [The four levels](levels.md) — what each level is allowed to say
- [The specification chain](specifications.md) — `parent_spec`, `includes` and freezing
- [Storage and identity](storage-and-identity.md) — hierarchical ids and instance models
- [Sources, citations and lineage](sources-citations-lineage.md) — the second diagram in prose
- [The knowledge lifecycle](knowledge-lifecycle.md) — how `CHANGE` entries accumulate
- [Canonical vocabulary](../vocabulary.md) — the canonical name of every box above
