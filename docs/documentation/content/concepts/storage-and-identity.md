# Storage and identity

A domaiNN can keep the instances of a concept in one kNNowledge document or spread them over
one document per instance. This page explains how a bluepriNNt declares that choice, how every
document gets an identity that does not depend on its neighbours, and the single address form
that references, change targets and citations of kNNowledge all share.

> [!NOTE]
> This page describes distributed storage as designed for the release that introduces it.
> Existing domaiNNs are **not** migrated by that release. See *Limitations* at the end of this page.

## The problem

Some information is naturally a list inside one document: the Programas of a tutoring business.
Some is naturally a set of independent units, each with its own folder, assets and lifecycle: the
Videos of a series. Until now the system had no way to declare which is which, so the second
shape lived on convention and workarounds:

- The same video was stored twice: as its own document and again as an element of a registry.
- File names carried the parent series so that two videos called `intro` would not collide.
- When two file names did collide, **both** ids silently changed to a path form, which orphaned
  every recorded change target.
- Three address syntaxes coexisted, one of them resolved by title.

The fix separates two questions. *What are the instances of this concept?* must have one answer,
whatever the physical layout. *Where does an instance live?* is declared in the bluepriNNt and
validated.

## Compact and distributed storage

| Form | Where the instances of a concept live |
|---|---|
| **Compact storage** | All instances are elements of one kNNowledge document. |
| **Distributed storage** | Each instance is the root of its own kNNowledge document, called an **instance model**, in its own folder. |

The child concepts of a distributed concept are **elements** of the instance model. They are never
files of their own.

### Distributed: a Series and its Videos

In the `video-script` bluepriNNt, `Series` and `Video` are distributed. `Scene` and `Layer` stay
compact: they are elements inside the Video instance model.

```
series/villabotijos-today/villabotijos-today_video-script_NN.md        Series instance model
series/villabotijos-today/assets/intro/intro_video-script_NN.md        Video instance model
  ## NN Video: Intro                      slug:: intro
  ## NN Scene: 00 Gancho                  slug:: 00-gancho
  ### NN Layer: Gancho Presenter          slug:: 00-gancho-presenter
series/innteresante/innteresante_video-script_NN.md                    Series instance model
series/innteresante/assets/intro/intro_video-script_NN.md              Video instance model
```

Two series, each with a Video `intro`. Both stay legal because identity is hierarchical (see
*Hierarchical identity* below).

### Compact: Programas in one document

The `tutorias` bluepriNNt of a tutoring business declares no storage for `Programa`, `Tutor` or
`Prestación de Servicios`, so all three are compact. They live as elements of one document,
`kNNowledge/LC_programas_Tutorias_NN.md`, whose model id is `LC_programas_Tutorias` (frontmatter
excerpt):

```markdown
---
scope_elements:
  - concept: Programa
  - concept: "Prestación de Servicios"
    parent: programa_ref
---
## NN Programa: Programa Alfa
slug:: programa-alfa

## NN Prestación de Servicios: Pedido 001
slug:: pedido-001
programa_ref:: @programa-alfa
```

A document in another folder cites the program as `LC_programas_Tutorias@programa-alfa`.

> [!NOTE]
> A folder of its own does not make a concept distributed. Only a declaration in the bluepriNNt
> does. A document in a per-instance folder whose concept declares no storage is an ordinary
> compact document and gets no placement checks.

### One collection, whatever the layout

A **collection** is the domain-wide set of instances of a concept, ordered by id. It is the same
whether the instances are instance models or compact elements. Reads see the collection, not the
layout:

| Read | How |
|---|---|
| `list_knowledge` | Returns every model with its `id`, `path`, `version`, `blueprint` and `storage` (`compact`, or the concept and container). It can also return the collection of a concept. |
| `query_units` | Accepts `collection:<Concept>?<filter>`, for example `collection:Video?status=published`. It evaluates the filter over every Video, in every instance model and every compact registry. |
| Domain console | Builds one collection per concept from the bluepriNNt declarations. Two copies of a domaiNN, one compact and one distributed, show the same titles and field values. |

An instance model that violates placement is still discovered and listed. It is flagged, never
silently dropped from its collection.

## Declaring storage per concept

Storage is declared on the **concept**, not on the bluepriNNt. One bluepriNNt can mix both forms,
and a concept with no declaration is compact. The declaration is three properties on the
`## NN Concept Definition:` element:

| Property | Meaning |
|---|---|
| `storage:: distributed` | Each instance is its own instance model. Omit it for compact. |
| `container:: <Concept>` | Optional. The distributed concept this concept's instances are stored under. |
| `placement:: "<path pattern>"` | Required when distributed, forbidden when compact. Where an instance lives. |

Worked example, from `video-script`:

```markdown
## NN Concept Definition: Series
slug:: series
type:: list
storage:: distributed
placement:: "series/{slug}/"

## NN Concept Definition: Video
slug:: video
type:: list
storage:: distributed
container:: Series
placement:: "{container}/assets/{slug}/"

## NN Concept Definition: Scene
slug:: scene
type:: list
```

`Scene` has no `storage`, so it is compact and lives inside the Video instance model.

Per concept, not per bluepriNNt, is what makes this work: `Series` and `Video` are promoted to
documents while `Scene`, `Layer` and `Preset` stay elements, all in one bluepriNNt. A local
bluepriNNt that includes `video-script` inherits the declarations through normal composition.
The three properties are declared by iNNfo `V_0-7-0`; a bluepriNNt that pins an older iNNfo
gets a warning for each of them as an unknown property.

### The placement pattern

The pattern is a path relative to the domaiNN root, ending in `/`.

| Rule | Detail |
|---|---|
| Literal segments | Lowercase kebab-case, for example `series` or `assets`. |
| `{slug}` | Exactly one. It becomes the instance's own slug. |
| `{container}` | Optional, only as the **first** segment, and only when `container::` is declared. It expands to the container instance's folder, so a contained instance is physically nested in its container. |
| Reserved | `..`, a segment starting with `.`, `archive`, `staging`, `specs`, `backups`, `sources` at the root, and `kNNowledge` (reserved for compact documents) are rejected. |

The folder that ends at `{slug}` is the **instance root folder**. It is the unit that moves, and
the instance model file sits directly in it, named `<slug>_<bluepriNNt-name>_NN.md`. The
concept is not part of the file name, and the parent is not either: that was the old workaround.

Inside the instance model, the **instance root** is the element of the distributed concept. Its
`slug::` must equal the folder slug.

### Declaration diagnostics

| Code | Raised when |
|---|---|
| `STORAGE_UNKNOWN_MODE` | `storage` is not `compact` or `distributed`. |
| `PLACEMENT_REQUIRED` | A distributed concept has no `placement`. |
| `PLACEMENT_FORBIDDEN` | A compact concept declares `placement` or `container`. |
| `PLACEMENT_INVALID` | The pattern breaks a rule of the table above. |
| `CONTAINER_NOT_DISTRIBUTED` | `container` names a concept that is not distributed. |
| `CONTAINER_CYCLE` | Containers form a cycle. |
| `PLACEMENT_OVERLAP` | Two patterns of one bluepriNNt can match the same folder. |

A compact document may not hold elements of a distributed concept, and a distributed concept's
container must itself be distributed.

## Storage is not inheritance

Placement says **where** an instance lives. The scope chain says **from whom it inherits values**.
The two are orthogonal, and declaring storage does not change the scope chain at all.

| Question | Answered by |
|---|---|
| Where must a Video document sit? | The `placement` of the `Video` concept. |
| Which values does it inherit? | The scope chain of its own path: enclosing folders that hold a document with `scope: true`, up to the domaiNN root. |

Two real settings documents show the chain:

- The series scope of `villabotijos-today` carries `voice_id`, `music`, `fps`, `resolution` and
  `output_formats`. Every episode of the series inherits them.
- `LC_programas_settings_NN.md` is a root-level scope with `precio_hora_tutoria: 84`, inherited by
  everything below it.

With the new `video-script`, the Series instance model **is** the series scope document: it
carries `scope: true`, and its root element's fields are the `series` level of the cascade.
`resolve_effective` still resolves `fps` for `villabotijos-today/pepper-mapache` from that
document, and being a member of a collection adds, removes or reorders no supplier. A folder that
holds an instance model but no `scope: true` document is not part of the chain.

## Terms: stem, title, slug, id, address

Five words name five different things. Taking one Video:

| Term | Meaning | Example |
|---|---|---|
| **stem** | The file name without `.md`. For instance models it derives from the folder slug and is **not** an identity. Equal stems in different folders are legal. | `pepper-mapache_video-script_NN` |
| **title** | The human label, shown in the console and in diagnostics. It is never used to resolve anything. | `El mapache fuera de la ley` |
| **slug** | The immutable identity of a concept, element or matrix, declared with `slug::`. For an instance it is also the last id segment and the folder name. | `pepper-mapache` |
| **id** | The identity of a kNNowledge document, derived from its path and the declarations of its bluepriNNt. | `villabotijos-today/pepper-mapache` |
| **address** | An id plus, optionally, an element and a field. | `villabotijos-today/pepper-mapache@00-gancho&voice` |

## Hierarchical identity

A model id carries its container, so it never depends on which other files exist.

| Kind | Id | Example |
|---|---|---|
| Compact model | The file name without `_NN`. Unchanged from before. | `LC_programas_Tutorias` |
| Instance model, no container | `<slug>` | `villabotijos-today` |
| Instance model in a container | `<container-id>/<slug>` | `villabotijos-today/intro` |

The two `intro` Videos of the example are `villabotijos-today/intro` and `innteresante/intro`.
Their stems are equal and that is fine: the stem is not the id.

Rules that hold everywhere:

- An id is derived **only** from the file's own path and the declarations of its bluepriNNt.
  Adding, removing or reordering other files never changes it.
- Ids are case-sensitive. Instance segments are lowercase slugs.
- Two models that derive the same id are an error, `DUPLICATE_MODEL_ID`, listing every path.
  Neither is preferred.
- The old collision rule is gone: no id ever flips to a path form and `AMBIGUOUS_MODEL_ID` no
  longer exists.
- A bare stem (`intro_video-script`) and a bare slug (`intro`) are not ids and do not resolve. An
  unresolved address lists the candidate ids that share its last segment.
- A path where an id is expected (a value ending in `.md`, or containing `\`) is
  `MODEL_ADDRESSED_BY_PATH`.
- `specs` is reserved as the first segment of an id (`RESERVED_MODEL_ID`), because
  `specs/<family>@...` addresses a bluepriNNt.
- A model whose bluepriNNt cannot be resolved gets no id: `MODEL_UNADDRESSABLE`. Tools refuse to
  address it, and there is no fallback id.

### Element identity

An element is addressed by its model id plus its slug. Slugs are unique within a model and may
repeat across models, so `00-gancho` can exist in every Video:

```
villabotijos-today/pepper-mapache@00-gancho
villabotijos-today/intro@00-gancho
```

Element **names** are display text. Repeating a name is legal; a repeated **slug** in one model is
still `DUPLICATE_SLUG`.

### When an instance moves

Moving an instance to another container, or changing its slug, changes its id and the id of every
instance nested under it. Element slugs inside the model never change:

| Before | After moving `innteresante/intro` into `villabotijos-today` |
|---|---|
| `innteresante/intro` | `villabotijos-today/intro` |
| `innteresante/intro@00-gancho` | `villabotijos-today/intro@00-gancho` |

The old id stops resolving. A move happens only through the `move_model` operation (see
[Distribute a concept](../how-to/distribute-a-concept.md)). Targets recorded in earlier changesets
keep resolving to the moved instance, so history stays attached and no drift is reported. The
sealed changesets are never edited.

If the new id is taken, the move is rejected with `MODEL_EXISTS`. Here `villabotijos-today/intro`
already exists, so moving `innteresante/intro` there would fail.

## One reference grammar

Every kNNowledge unit is addressed with one syntax:

```
<hierarchical-id>[@<slug>[&<field>]]
```

It is used by reference fields, by the `target` of every change, by the recorded `resolved_target`,
and by citations whose target is a kNNowledge unit.

| Address | Points at |
|---|---|
| `villabotijos-today/pepper-mapache` | A model. In a field that expects an element, an instance model id alone means its instance root. |
| `villabotijos-today/pepper-mapache@00-gancho` | An element. |
| `villabotijos-today/pepper-mapache@00-gancho&voice` | A field of an element. |
| `villabotijos-today/pepper-mapache@00-gancho&#body` | The prose body of an element. |
| `villabotijos-today@villabotijos-today&voice_id` | A field of the Series root. `villabotijos-today&voice_id` is invalid because it names no element. |

The unit forms `@concept:<slug>`, `@matrix:<slug>` and matrix cells `@<matrix>&<row>&<col>` are
unchanged.

Rules:

- **Titles are display-only.** Resolution never uses a title, and two documents with the same
  title are not an error. A field stores the address and the console shows the target's title.
- **An address resolves exactly or not at all.** A partial id never resolves, even when only one
  model has that slug today, because adding a second would change its meaning.
- **Inside a document, same-document references are relative**: `@programa-alfa`, not the full
  address. An absolute self-reference is `ADDRESS_NOT_CANONICAL`, so internal references survive a
  move.
- **Nobody types ids by hand.** The console reference editor searches by title and writes the
  address of the selected target. When several targets share a title, each is shown with its
  address and none is picked for you.
- Concept and bluepriNNt membership checks (`target_concepts`, `target_template`) apply to the
  target an address resolves to, whatever its storage form.

### What was removed

There is no second form and no compatibility mode. The old forms are rejected:

| Removed form | Use instead |
|---|---|
| `[[Villabotijos Today :: Celedonio Full]]` (title-qualified reference) | The address of the target. |
| `[[Programa Alfa]]` as the value of a reference field | `@programa-alfa` (same document) or the full address. |
| A file name stem, or a path, as a model id | The hierarchical id. |
| `kNNowledge/x_NN.md@## Revenue` (a model cited by path and heading) | `<model-id>@<slug>`. Rejected as `MODEL_CITED_BY_PATH`. |
| `changes/x_changes_NN.md@## NN Change: c-09` (a changeset cited by heading) | Rejected as `NN_DOCUMENT_CITED_BY_HEADING`. |

Wikilinks in prose and descriptions are display text, not addressing, and are untouched. So are
citations of raw files: `sources/import/notes.md@## Heading`, CSV rows, JSON pointers and
`<file>_sidecar_NN.md` headings keep the path grammar described in
[Sources, citations and lineage](sources-citations-lineage.md).

### Reference diagnostics

| Code | Meaning |
|---|---|
| `ADDRESS_MALFORMED` | A segment breaks the grammar. The message names the segment. |
| `ADDRESS_NOT_CANONICAL` | A same-document reference written as an absolute address. |
| `REF_MODEL_NOT_FOUND` | No model has that id. The message lists candidates and, after a move, names the recorded successor. |
| `REF_ELEMENT_NOT_FOUND` | The model exists but not the element. |
| `REF_CONCEPT_MISMATCH` | Warning: the target's concept is not in `target_concepts`. |
| `REF_BLUEPRINT_MISMATCH` | Warning: the target's bluepriNNt does not match. |

## Placement validation

Discovery stays path-agnostic: any `_NN.md` file that qualifies as a model is a model. Placement
validation then compares what was found with the bluepriNNt declarations. For instances of
distributed concepts it checks four things:

1. The file sits where the placement pattern says.
2. Its name satisfies the naming contract.
3. Its identity is unique.
4. The instance is **not** also stored as an element of another document.

`check_domain` reports them in a `layout` section. `validate_knowledge {workspace: true}` files each
one against the model it names. Plain `validate_knowledge` on one file reports only what one file
can know: placement, naming and cardinality.

| Code | Severity | Meaning |
|---|---|---|
| `PLACEMENT_MISMATCH` | error | The instance is not at its expected folder. The message shows the folder. |
| `INSTANCE_NAME_MISMATCH` | error | The file name is not the one the folder slug requires. |
| `INSTANCE_SLUG_MISMATCH` | error | The root element's `slug::` differs from the folder slug. |
| `CONTAINER_MISSING` | error | The container instance does not exist. |
| `DUPLICATE_MODEL_ID` | error | Two documents derive the same id. |
| `DISTRIBUTED_CONCEPT_IN_COMPACT_MODEL` | error | Elements of a distributed concept sit in a compact document, including a registry that duplicates an instance model. |
| `MIXED_INSTANCE_MODEL` | error | One instance model holds roots of two distributed concepts. |
| `MODEL_UNADDRESSABLE` | error | The bluepriNNt cannot be resolved, so there is no id. |
| `RESERVED_MODEL_ID` | error | The derived id starts with `specs`, which is reserved for blueprint addresses. |
| `MODEL_ID_INVALID` | error | An id cannot be placed: wrong segment count, a non-slug segment, or a `/` on a compact concept. |
| `DUPLICATE_SLUG` | error | Two elements in one model carry the same `slug::`; the second is dropped from the graph. |
| `INSTANCE_SHADOWS_ELEMENT_ASSETS` | warning | An element of the container model has the same slug as a contained instance, so both use that folder under `assets/`. |
| `BLUEPRINT_VERSION_SKEW` | error | See the next section. |
| `MODEL_WITHOUT_FILE` | warning in `check_domain`, error in strict replay | A model touched by applied changes has no file and no recorded move that ends in a live model. |
| `STALE_TARGET_MOVED` | error | A pending change names an instance that was renamed after the change's `base_version`; retarget it to the new id. |

Messages have the form `<CODE>: <subject> - <what is wrong>; <fix>`, always name the path, and
carry a `severity` of `error` or `warning` on the finding itself (`check_domain.layout`). For
example:

```
PLACEMENT_MISMATCH: series/x/videos/intro/intro_video-script_NN.md holds Video "intro" - Video instances live at series/x/assets/intro/; move the file there
```

Two or more roots of one concept in a single document also fail, with a cardinality error naming
the concept.

## Version uniformity

A domaiNN uses **one version per bluepriNNt**. A document pins exactly one bluepriNNt, so this is
the same as one version per concept, for compact and distributed storage alike.

`check_domain` reports `BLUEPRINT_VERSION_SKEW` as an error, **once per bluepriNNt**, not once per
document:

```
BLUEPRINT_VERSION_SKEW: bluepriNNt "video-script" (concepts: Series, Video) - pinned at 2 versions across 24 models: V_0-15-0 (20: <first 3 paths>...), unpinned (4: <paths>); a domaiNN uses one version per bluepriNNt, run nn-update
```

- A bare name such as `video-script`, or a pin whose URL cannot be classified, is listed as an
  **incomparable** pin. It is never counted as uniform.
- Two different bluepriNNts, for example `villabotijos-today` and `innteresante`, are never
  compared with each other.
- Single-file `validate_knowledge` does not report skew. It sees one document.
- A new instance model pinned to an older version makes the finding appear again.

> [!IMPORTANT]
> The rule is not limited to distributed concepts. Any domaiNN whose documents pin one bluepriNNt
> at several versions now fails `check_domain`.

[nn-update](../skills/nn-update.md) fixes skew: its upgrade unit is the whole bluepriNNt group.
It repins and re-validates every member, or none, and a document added after the plan was made
aborts the run. When a group is already skewed, the whole group goes to the adopted version.

## Limitations

- **Existing domaiNNs are not migrated.** The `video_NN` and `LC_programas` domaiNNs fail
  validation once their documents pin a bluepriNNt version that declares storage, and no flag
  silences the errors. Migrating them is a separate, later change.
- **There is no operation that removes an instance model.** Deleting an instance file by hand is
  reported as `MODEL_WITHOUT_FILE` (a warning in the default check, an error in strict replay).
- **Scene and Layer cannot be split into their own files.** Children of a distributed concept stay
  elements.
- **Compact to distributed only.** `extract_instance` converts in that direction. Converting back
  is not specified.
- **No per-instance or lazy upgrades.** Version uniformity is all-or-nothing.
- **Skew between different local bluepriNNts** that compose one shared bluepriNNt at different
  versions is not detected.
- **Staleness checks scan the newest 50 changesets.** A pending change older than that window is
  not checked for a stale target. This was already the case.

## See also

- [Distribute a concept](../how-to/distribute-a-concept.md) - declare, create, move and extract.
- [The four levels](levels.md)
- [The specification chain](specifications.md)
- [Validator behavior](validator-behavior.md)
- [Sources, citations and lineage](sources-citations-lineage.md)
- [Review changesets](../how-to/review-changesets.md)
- [Glossary](../reference/glossary.md)
