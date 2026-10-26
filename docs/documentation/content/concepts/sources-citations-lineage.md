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

Rules that hold everywhere:

- The path is **`domaiNN`-relative and written in full** — there is no implicit prefix.
- Multiple citations use a bracketed list: `sources:: [a.md@## Intro, b.csv@SKU-42]`.
- A single value may be written without brackets.
- A **binary** file cannot be cited directly; cite its sidecar instead.
- There is **no `src-NNN` identifier system and no line-number anchors** (`#L1-L10`).
  Anchors are human-readable headings, CSV row keys, or JSON Pointers.

A Citation appears either as the reserved `sources::` property or as a Field declared
`type:: citation`.

## Lineage

The **Lineage** is the record `<project>_cogNNitive_NN.md`. It is the map of the whole
`domaiNN`, and it is found by its role — never by its file name or version. It carries:

- `# NN Sources` — one entry per cognitivized raw file.
- `# NN ModelRecords` — one entry per knowledge document.
- `# NN Artifacts` — one entry per generated file that is a write-once family member or
  declares upstream sources.
- `# NN Procedures` — an append-only run log.

The first three sections are **idempotently re-synced** from the filesystem on every
build; the procedures journal only grows.

## `resolve_sources`

`resolve_sources` is the read-only tool that turns a Citation back into evidence. Given
an element, it resolves its citation-typed field(s) to the underlying file, anchor, and
content, returning one entry per reference with fields such as `path`, `anchor`,
`exists`, `field`, `origin`, `excerpt`, and `sha256`. The `origin` classifies who
produced the cited content (`agent`, `human`, or `document`), resolved from the `author::`
of the change block the citation anchors to. It never writes files.

## The drift gate

The **drift gate** is the consistency check that the managed view sections of the
persisted lineage record equal a fresh projection computed from the filesystem. If a
managed line is edited by hand, the gate reports `LINEAGE_DRIFT` naming the record and
the section, and the record is left byte-identical (the check is read-only). Your agent
runs it through the `nn-sources` lineage check and the domain check; the cogNNitive
repository runs it in its own build gate. Regenerating the record restores agreement.

## See also

- [The knowledge lifecycle](knowledge-lifecycle.md)
- [Validator behavior](validator-behavior.md)
- [Import and cite sources](../how-to/import-sources.md)
- [Sync lineage and back up a domaiNN](../how-to/sync-and-backup.md)
- [MCP tools](../reference/mcp-tools.md)
