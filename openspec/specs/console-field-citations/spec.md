# console-field-citations Specification

## Purpose

Bake resolved citations into the generic model console at compile time, and let a reviewer holding an offline HTML console tell whether a value came from a document, a human, an AI agent, or reviewer feedback — without an MCP session.

## Requirements

### Requirement: Compile-time citation payload

The compile procedure MUST call `resolve_sources` once per element and embed the result as `el.citations: { "<citationFieldName>": ResolvedCitation[] }` on that element, plus a document-level `meta.citationsResolvedAt` timestamp. No citation resolution MUST happen at console runtime; the shipped HTML MUST render only from the embedded payload.

#### Scenario: Citations embedded per element

- GIVEN a model with an element carrying a populated `sources` field and a `precio_source` field
- WHEN the compile procedure runs
- THEN the compiled element has `el.citations.sources` and `el.citations.precio_source`, each an array of `ResolvedCitation` entries matching `resolve_sources` output for that field

#### Scenario: Document-level resolution timestamp

- GIVEN a compile run that resolves at least one citation
- WHEN compilation completes
- THEN the compiled document's `meta.citationsResolvedAt` is set

#### Scenario: No runtime resolution

- GIVEN a compiled console opened via `file://` with no network and no MCP session
- WHEN citation icons and the detail dialog are used
- THEN all shown data comes from the embedded `el.citations` payload, with no attempt to call `resolve_sources` at runtime

### Requirement: Backward-compatible rendering

An element compiled without a `citations` payload MUST render exactly as it did before this change. Absence of `el.citations` MUST NOT produce an error, a placeholder icon, or a layout shift.

#### Scenario: Console compiled without citations

- GIVEN a console compiled by a procedure version that predates this change, with no `el.citations` on any element
- WHEN the console renders
- THEN the output is unchanged from pre-change rendering

### Requirement: Origin-typed citation icons

`renderElement()` MUST place one icon per citation-typed field with resolved citations, as follows:

- For `sources`-family fields, the icon MUST be placed on the element header.
- For any other citation-typed field, the icon MUST be placed on that field's row.
- The icon MUST have one visually distinct variant per `origin` (`agent`, `human`, `reviewer`, `document`), plus a distinct warning variant used when any entry for that field has `error` set. The `human` variant MUST be visually distinct from both the `agent` variant and the `document` variant.
- Icons MUST be inline SVG/CSS with no new runtime dependency.
- A plain field (e.g. `precio`) MUST NOT receive an icon derived from a citation-typed sibling field (e.g. `precio_source`); only the citation-typed field itself is icon-eligible.

#### Scenario: Header icon for a sources-family field

- GIVEN an element whose `el.citations.sources` has one resolved entry with `origin: "document"`
- WHEN the element renders
- THEN the document-origin icon appears on the element header

#### Scenario: Row icon for a non-sources citation field

- GIVEN an element whose `el.citations.precio_source` has one resolved entry with `origin: "agent"`
- WHEN the element renders
- THEN the agent-origin icon appears on the `precio_source` field's row, and the plain `precio` field row shows no icon

#### Scenario: Warning variant on resolution error

- GIVEN a citation entry with `error` set
- WHEN the icon for that field renders
- THEN the warning variant is shown instead of an origin-typed variant

#### Scenario: Human origin distinguishable from agent and document

- GIVEN two elements, one with a `sources` citation at `origin: "agent"` and another at `origin: "human"`
- WHEN both render
- THEN the two icons are visually distinct from each other and from the `document` variant

### Requirement: Native citation detail dialog

Clicking a citation icon MUST open a native `<dialog id="innfo-citation-dialog">` via `showModal()`, following the existing `innfo-ref-dialog` pattern in `innfo-runtime.js` and `render-procedure-stepper.js`. The dialog MUST show, per selected citation entry: path, anchor, excerpt (with a visible truncation mark when the excerpt was capped), author, version, sha256, and error. A field absent from the underlying `ResolvedCitation` entry (including `author` when the resolver omitted it) MUST be omitted from the dialog rather than shown as a placeholder.

#### Scenario: Opening the dialog

- GIVEN a rendered citation icon for a field with one resolved entry
- WHEN the icon is clicked
- THEN `<dialog id="innfo-citation-dialog">` opens via `showModal()` and shows that entry's path, anchor, and excerpt

#### Scenario: Truncated excerpt shows a mark

- GIVEN a resolved entry whose excerpt was capped at ~500 characters
- WHEN the dialog renders that entry
- THEN a truncation mark is visible at the end of the excerpt

#### Scenario: Missing author is omitted, not placeholdered

- GIVEN a resolved entry with `origin: "reviewer"` and no `author` field
- WHEN the dialog renders that entry
- THEN no author line is shown, and no generic label (e.g. "Reviewer") is substituted

#### Scenario: Error entry shown in dialog

- GIVEN a resolved entry with `error` set and no `excerpt`, `sha256`, or `version`
- WHEN the dialog renders that entry
- THEN the error message is shown and the omitted fields are not rendered as empty placeholders
