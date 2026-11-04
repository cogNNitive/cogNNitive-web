# Sources, citations and lineage

Provenance in cogNNitive rests on three words that are easy to blur together: **Source**,
**Citation**, and **Lineage**. They are distinct objects at distinct layers. Getting them
straight is what makes "where did this claim come from?" a mechanical question rather
than a research task.

## The problem

A knowledge base is only as trustworthy as its ability to answer: *what evidence backs
this element, and what did we build from it?* If a tool stores only the text of a claim,
that question is unanswerable. cogNNitive separates the evidence (a Source), the pointer
to it (a Citation), and the record of everything derived (the Lineage).

## Source

A **Source** is a file that lives under `sources/`. Concretely:

- **Raw imports** sit in `sources/import/`, exactly as they arrived.
- Each raw file is **cognitivized in place**: a co-located sidecar
  `<file>.<ext>_sidecar_NN.md` records its `sha256`, `size_bytes`, `source_format`, and
  `normalized_at`, and carries a normalized body for binary formats.
- Promoted conversation transcripts live in `sources/conversations/`.
- A **synthetic** source is a derived deliverable under `artifacts/`, cognitivized in
  place; its upstream is the `sources` it declares.

A Source is never a Citation and never a model. It is the ground truth a Citation points
at.

## Citation

A **Citation** is a pointer from a kNNowledge element to an anchor inside a Source. It
uses the `@` pointer grammar:

| Target | Grammar | Example |
|---|---|---|
| Markdown heading | `<path>@## <Heading>` | `sources/import/notes.md@## Key Clients` |
| CSV row | `<csv>@<row>` | `sources/import/prices.csv@SKU-42` |
| CSV cell | `<csv>@<row>&<column>` | `sources/import/prices.csv@SKU-42&amount` |
| JSON value | `<json>@/<pointer>` | `sources/import/data.json@/items/0/name` |
| kNNowledge unit | `<hierarchical-id>@<slug>` | `villabotijos-today/pepper-mapache@00-gancho` |

Rules that hold everywhere:

- The path is **`domaiNN`-relative and written in full** — there is no implicit prefix.
- A change cites one source per `evidence::` line; a change that needs several evidence items
  repeats the key (or uses a bracketed list `[a.md@## Intro, b.csv@SKU-42]`).
- A **binary** file cannot be cited directly; cite its sidecar instead.
- There is **no `src-NNN` identifier system and no line-number anchors** (`#L1-L10`).
  Anchors are human-readable headings, CSV row keys, or JSON Pointers.
- The path grammar is for **raw files** (including a sidecar's headings, such as
  `report.pdf_sidecar_NN.md@## Findings`). A kNNowledge document is cited with its
  [address](storage-and-identity.md), never by path and heading: `kNNowledge/x_NN.md@## A` is
  rejected as `MODEL_CITED_BY_PATH`, and a changeset cited by one of its headings is rejected as
  `NN_DOCUMENT_CITED_BY_HEADING`.

A Citation appears as the `evidence::` of an **applied change**. A kNNowledge unit has no
citation field of its own: the reserved property and `type:: citation` are banned on Level 3,
and its provenance is derived from the change log.

## Lineage

The **Lineage** is **computed, never persisted**. `read_lineage` projects the inventory from
the filesystem and the edges from the applied changes:

- **sources** — one entry per cognitivized raw file, with its sidecar and family version.
- **models** — one entry per knowledge document, with its `knowledge_version` and template.
- **artifacts** — one entry per generated file that is a write-once family member or has a
  `produce_artifact` change.
- **changes** — the changesets, each with its changes and status.
- **edges** — `evidence` (cited file → owner), `target` (unit → owner) and `produced`
  (artifact → changeset), all derived from the applied changes; live evidence by default,
  all-time on request.

There is no record to refresh, so there is nothing to drift: the projection is recomputed on
every call.

## `resolve_sources`

`resolve_sources` is the read-only tool that turns a Citation back into evidence. Given
an element, it resolves its citation-typed field(s) to the underlying file, anchor, and
content, returning one entry per reference with fields such as `path`, `anchor`,
`exists`, `field`, `origin`, `excerpt`, and `sha256`. The `origin` classifies who
produced the cited content (`agent`, `human`, or `document`), resolved from the `author::`
of the change block the citation anchors to. It never writes files.

## The drift check

Drift is the difference between the applied changes and the files on disk. `check_domain`
returns a `provenance` report: `EDITED_WITHOUT_RECORD` for a value edited by hand after the
change that set it, `UNIT_WITHOUT_RECORD` for a unit no change accounts for,
`EVIDENCE_UNKNOWN` for a change with no evidence, and `EVIDENCE_SOURCE_CHANGED` when the
cited bytes moved. `strict: true` replays the changes and compares the serialized body, so a
whitespace-only edit is drift there and not in the default fold. A model that applied changes
touched but that has no file (for example an instance model deleted by hand) is reported as `MODEL_WITHOUT_FILE`: a
warning in the default fold and an error in strict mode. Moving or renaming an instance model, or
extracting instances from a compact document, is recorded as a change, so it raises no drift. The
check is read-only.
