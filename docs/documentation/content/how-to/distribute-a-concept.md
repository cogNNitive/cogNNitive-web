# Distribute a concept

Give each instance of a concept its own kNNowledge document: declare the storage in the
bluepriNNt, create instance models, move or rename them, and extract instances out of an existing
compact document. This guide uses the `coNNtent` shape: a Series that contains Videos.

Read [Storage and identity](../concepts/storage-and-identity.md) first if the terms *instance
model*, *placement pattern* or *hierarchical id* are new.

## Quick path

1. Declare `storage`, `container` and `placement` on the concept in the bluepriNNt.
2. Create each instance with `add_model` and a hierarchical id, container first.
3. Rename or move an instance with `move_model`, retargeting its referrers in the same changeset.
4. Convert instances that sit in a compact document with `extract_instance`.
5. Ask your agent to run the domain check and fix anything it reports.

> [!NOTE]
> You normally ask your agent in plain words and review the proposal in the console, as described
> in [Review changesets](review-changesets.md). The change blocks below show what the agent writes
> and what you will see in that review. Every operation here is applied atomically and recorded,
> like any other change.

Operation failures come back as `errors[]` entries, each with a stable `code` and a message that
starts with that code; the changeset is `rejected` and nothing is written unless the table says
otherwise. A domain-check finding carries a `severity` of `error` or `warning`, and a message of
the form `<CODE>: <path or subject> - <what is wrong>; <fix>`.

## 1. Declare storage on a concept

Add the three properties to the concept's definition and bump the bluepriNNt's `blueprint_version`.
The bluepriNNt must pin iNNfo `V_0-7-0` or later.

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
```

- Leave `storage` out for a compact concept. `Scene` and `Layer` stay compact: they are elements of
  the Video instance model.
- A contained concept names its container with `container::` and starts its pattern with
  `{container}`.
- The pattern ends in `/`, has exactly one `{slug}` and uses lowercase kebab-case literals.

Ask your agent to validate the bluepriNNt. These are the diagnostics you can meet:

| Diagnostic | Fix |
|---|---|
| `STORAGE_UNKNOWN_MODE` | Use `compact` or `distributed`, or remove the property. |
| `PLACEMENT_REQUIRED` | Add `placement` to the distributed concept. |
| `PLACEMENT_FORBIDDEN` | Remove `placement` and `container` from a compact concept, or make it distributed. |
| `PLACEMENT_INVALID` | Correct the pattern: one `{slug}`, `{container}` first, no reserved segment (`archive`, `staging`, `specs`, `backups`, `kNNowledge`), trailing `/`. |
| `CONTAINER_NOT_DISTRIBUTED` | Declare the container concept distributed, or remove `container`. |
| `CONTAINER_CYCLE` | Break the loop: a container cannot sit, directly or indirectly, under its own contents. |
| `PLACEMENT_OVERLAP` | Change a pattern so two concepts of the bluepriNNt never match the same folder. |

## 2. Create an instance model

`add_model` with a `concept` creates the instance model at its placement path. The target is the
hierarchical id; its last segment is the slug and the rest must be an existing container.

```markdown
## NN Change: c-01
op:: add_model
target:: villabotijos-today/new-episode
concept:: Video
blueprint_name:: coNNtent
blueprint_url:: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md
name:: New Episode
evidence:: decision
author:: agent
```

Result:

```
series/villabotijos-today/assets/new-episode/new-episode_coNNtent_NN.md
```

The file starts with its instance root already in it (`## NN Video: New Episode` with the slug
`new-episode`), so it is valid immediately. Nothing is written under `kNNowledge/`.

- Name the concept explicitly with `concept::`. Without it, or with a compact concept, the target is
  a plain id with no `/` and the file goes to `kNNowledge/` as before.
- **Create the container first.** In one changeset, an `add_model` for the Series must come before
  the `add_model` for `new-series/intro`. Otherwise `ADD_MODEL_ORDER`.
- Elements of the instance are added afterwards with `add_element` and `update_field`, as for any
  document.

| Diagnostic | Meaning | Fix |
|---|---|---|
| `CONTAINER_MISSING` | The id's prefix is not an existing instance, for example `no-such-series`. Nothing is written. | Create the container first, in the same or an earlier changeset. |
| `ADD_MODEL_ORDER` | The container is created later in the changeset. | Reorder so the container comes first. |
| `ADD_MODEL_INVALID_TARGET` | The id is unsafe, the `concept::` does not belong to the bluepriNNt, or the placement rule rejects the id. | Fix the target or the `concept::` named in the message. |
| `ADD_MODEL_DUPLICATE` | Two `add_model` changes target the same id. | Merge them, or give one a different slug. |
| `MODEL_EXISTS` | The id is taken, or the placement folder is occupied. The existing file is untouched and dependent changes are conflicted. | Pick another slug, or edit the existing instance. |
| `BLUEPRINT_UNRESOLVED` | The bluepriNNt could not be resolved. Nothing is written. | Check `blueprint_name` and `blueprint_url`. |
| `VALIDATION_FAILED` | The created model fails whole-file validation. Nothing is written. | Read the diagnostics it carries and correct the change. |

## 3. Move or rename an instance

`move_model` changes an instance's slug, its container, or both, in one atomic step. It moves the
instance root folder, renames the file stem if the slug changed, and rewrites the root `slug::`.
Instances nested under it move with it. Its id, and the ids of those nested instances, change.

Rename `innteresante/intro` to `innteresante/welcome`:

```markdown
## NN Change: c-01
op:: move_model
target:: innteresante/intro
to:: innteresante/welcome
evidence:: decision
author:: agent
```

Move it to another series by changing the container part of `to`:

```markdown
## NN Change: c-01
op:: move_model
target:: innteresante/intro
to:: villabotijos-today/intro
evidence:: decision
author:: agent
```

**Retarget every referrer in the same changeset.** A reference to the old id that is left
unchanged is rejected with `MOVE_LEAVES_DANGLING_REFERENCES`. Add one `update_field` per referrer.
`propose_changeset` runs the same check and returns the missing `update_field` changes ready to
merge, so you do not have to find them by hand. For a hypothetical field `related_video` in
`innteresante/pitch`:

```markdown
## NN Change: c-02
op:: update_field
target:: innteresante/pitch@opening&related_video
from:: innteresante/intro
to:: villabotijos-today/intro
evidence:: decision
author:: agent
```

What to expect:

- Element slugs do not change: `innteresante/intro@00-gancho` becomes
  `villabotijos-today/intro@00-gancho`.
- Earlier changes recorded against the old id keep resolving, and `check_domain` reports no drift
  because of the move. Sealed changesets are never edited.
- The moved model's version is bumped only if its body changed. Nested instances are relocated
  without a version change.
- Changing a **title** is not a move. Use `update_field` on the title, or `rename_element` on the
  root.

| Diagnostic | Meaning | Fix |
|---|---|---|
| `MOVE_REQUIRES_INSTANCE` | The target is a compact model, not an instance model. | `move_model` applies to instance models only. For elements of a compact model, use `extract_instance`. |
| `MOVE_INVALID_TARGET` | The target or `to` is not a usable id, or the placement rule rejects the new id. | Fix the id the message names. |
| `MODEL_EXISTS` | The new id is taken. Nothing changes. | Choose a different slug or container. |
| `CONTAINER_MISSING` | The new container does not exist. | Create it first. |
| `MOVE_DESTINATION_OCCUPIED` | The destination folder already exists. The original folder and file are untouched. | Choose another slug, or move the existing folder first. |
| `MOVE_LEAVES_DANGLING_REFERENCES` | A reference to the old id is not retargeted. | Add the `update_field` changes, or take them from `propose_changeset`. |
| `VALIDATION_FAILED` | The result would be invalid, for example the new name breaks the naming rule. No file or folder changes. | Fix what the diagnostic names. |

If the destination folder is already occupied, the move is rejected and the original folder and
file are left as they were.

## 4. Extract instances from a compact document

Use `extract_instance` when a compact document, such as a registry of Videos, holds instances of a
concept that is now distributed. It creates the instance model, moves the element and its
descendants (for a Video: Scenes and Layers) into it with their slugs unchanged, and removes them
from the source.

```markdown
## NN Change: c-01
op:: extract_instance
target:: InnteresanteVideos@intro
to:: innteresante/intro
blueprint_name:: coNNtent
blueprint_url:: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md
evidence:: decision
author:: agent
```

`InnteresanteVideos` is the illustrative id of a compact registry. The target is
`<compact-id>@<slug>`, and `to` is the new instance id.

What to expect:

- Field values, descendant slugs and citations are copied unchanged. `innteresante/intro@00-gancho`
  keeps its slug.
- The operation is recorded, so the moved units raise neither `UNIT_WITHOUT_RECORD` nor
  `EDITED_WITHOUT_RECORD`. Doing the same move by hand does raise them.
- Targets recorded for `InnteresanteVideos@intro` keep resolving to `innteresante/intro`.
- The source document is bumped once. Each new instance model records only a result version.
- Extractions of one changeset that share a source are all-or-nothing: if one destination is
  occupied, none is created and every element stays.

| Diagnostic | Meaning | Fix |
|---|---|---|
| `EXTRACT_INVALID_TARGET` | The target is not `<compact-id>@<slug>`, `to` is not a hierarchical id, or the destination placement rejects the id. | Fix the target or `to` the message names. |
| `EXTRACT_REQUIRES_COMPACT` | The source is already an instance model. | Use `move_model`; extraction converts a compact element only. |
| `EXTRACT_ELEMENT_NOT_FOUND` | The source holds no element with that slug; the message lists the slugs it holds. | Use one of the listed slugs. |
| `EXTRACT_NOT_DISTRIBUTED` | The element's concept is not distributed in the bluepriNNt. | Declare the concept distributed first, or do not extract. |
| `EXTRACT_SLUG_MISMATCH` | `to` does not end in the element's slug. | Keep the slug: extraction never renames an instance. |
| `CONTAINER_MISSING` | The destination container does not exist. | Create it first. |
| `MODEL_EXISTS` | The instance already exists, so the registry holds a duplicate. | Do not extract. Remove the registry copy with `remove_element`. |
| `EXTRACT_DESTINATION_OCCUPIED` | The destination folder exists but holds no model with that id. | Clear or move that folder first. |
| `DISTRIBUTED_CONCEPT_IN_COMPACT_MODEL` | Reported by the domain check for a distributed concept still stored in a compact document. | `extract_instance`, or `remove_element` when an instance model already exists. |

The operation is also rejected, naming the problem, when the destination container is missing, when
an element cannot become a valid instance model, or when the element belongs to a concept that is
not distributed.

## 5. Check the domaiNN

Ask your agent to run the domain check. Layout problems appear in its `layout` section. Each
message names the path, the id when there is one, and the fix.

| Diagnostic | Fix |
|---|---|
| `PLACEMENT_MISMATCH` | Move the file to the folder the message shows. |
| `INSTANCE_NAME_MISMATCH` | Rename the file to the expected name shown. |
| `INSTANCE_SLUG_MISMATCH` | Make the root element's `slug::` equal the folder slug. |
| `CONTAINER_MISSING` | Create the container instance, or move the instance under an existing one. |
| `DUPLICATE_MODEL_ID` | Two documents derive the same id. Give one a different slug through `move_model`. |
| `DISTRIBUTED_CONCEPT_IN_COMPACT_MODEL` | Extract the instances, or remove the duplicate elements. |
| `MIXED_INSTANCE_MODEL` | Keep one distributed concept per instance model. |
| `MODEL_UNADDRESSABLE` | Make the document's bluepriNNt resolvable. Such a document has no id. |
| `RESERVED_MODEL_ID` | The id starts with `specs`; rename the file or its folder. |
| `MODEL_ID_INVALID` | Fix the id: the message names the segment or segment count the concept expects. |
| `DUPLICATE_SLUG` | Give each element of the model its own `slug::`. |
| `INSTANCE_SHADOWS_ELEMENT_ASSETS` | Warning. Rename the element or the instance so they do not share an `assets/` folder. |
| `BLUEPRINT_VERSION_SKEW` | Ask your agent to run [nn-upgrade](../skills/nn-upgrade.md). It repins every document of the bluepriNNt, or none. |
| `MODEL_WITHOUT_FILE` | A document touched by changes has no file. Restore it. See the limit below. |
| `STALE_TARGET_MOVED` | A pending change names an instance renamed after its `base_version`; retarget it to the id the message names. |

References have their own codes (`REF_MODEL_NOT_FOUND`, `ADDRESS_MALFORMED` and others), listed in
[Storage and identity](../concepts/storage-and-identity.md) under *Reference diagnostics*.

## Limitations

- **Removing an instance model is not supported.** No operation exists for it, so there is no
  supported way to delete one. Deleting its file by hand is reported as `MODEL_WITHOUT_FILE`.
- **Migrating existing domaiNNs is a separate change.** `move_model` and `extract_instance` are the
  tools it will use. Until then a domaiNN that stores a concept both ways fails the domain check.
- **Scene and Layer cannot be split** into their own files.
- **Extraction only goes from compact to distributed.**

## See also

- [Storage and identity](../concepts/storage-and-identity.md)
- [Review changesets](review-changesets.md)
- [Validate a domaiNN](validate-domain.md)
- [nn-upgrade](../skills/nn-upgrade.md)
- [MCP tools](../reference/mcp-tools.md)
