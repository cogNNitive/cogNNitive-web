# Import and cite sources

A **Source** is a file that lives inside your domaiNN and can be cited. You never place or format these files yourself: you tell your agent what to bring in, and the agent puts the file in the right place and makes it citable.

## Tell your agent what to bring in

From the `nn` job loop this is the `[s] Sources` stage. You can also just say what you want:

> Add this folder of meeting notes to the domain.

> Bring in the PDF I just downloaded.

> Import this page: https://example.com/report

The agent takes the file (or folder, or link), places it inside the domain, and makes it citable. You do not copy files or convert anything by hand.

## What "citable" means

Once a file is in the domain, the agent makes it **citable** by writing a small companion document next to it — a **sidecar**. The original file is never changed, moved, or renamed: the sidecar records where the file came from, and the file itself stays exactly as you gave it. See [Cognitivize documents with sidecars](cognitivize.md).

Formats the agent handles directly include text, Markdown, CSV, JSON, HTML, Word, PDF, and Excel. Media like images and audio is not converted — instead, give the agent a transcript or a written description of it, and the agent makes that citable while leaving the media untouched.

## How a citation points at a heading

When the agent builds your model, each element records where its content came from as a **citation**. A citation is not a line number and not an opaque id: it points at a *named unit* inside the source, so it stays readable and survives edits above it.

- In a Markdown or text file, a citation points at a **heading** — for example, the section titled *Key Feedback*.
- In a spreadsheet, it points at a **row** by its key, optionally at a single column.
- In a JSON file, it points at a specific value.
- A whole file can be cited as-is.

Binary files (PDF, Word, Excel, images) are never cited directly — the agent cites their companion document instead, which holds the readable text.

## The rules that keep citations honest

The agent applies these automatically, but they explain why some references are refused:

- A citation names a real unit, never a line range.
- It points at a file inside the domain — scratch folders are not citable.
- It points at real content, never a query or a filter.
- A source is cited once; if an element has no real source, the agent omits the citation entirely.

## See also

- [Cognitivize documents with sidecars](cognitivize.md) — the sidecar in detail.
- [Sources, citations and lineage](../concepts/sources-citations-lineage.md) — how the three provenance terms relate.
- [Model a domain from scratch](../tutorials/domain-from-scratch.md) — the full walkthrough.

## Under the hood

The agent ingests through the `nn-sources` skill and the `nn-mcp` server; citations follow the `@` pointer grammar (`path@## Heading`, `csv@RowID&col`, `json@/pointer`). See [CLI and scripts](../reference/cli.md) and [MCP tools](../reference/mcp-tools.md).
