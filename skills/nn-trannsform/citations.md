# Citation Formats — Format-Specific Rules

Load this file when generating deliverables with citations in step §3c.

Citations are rendered in a single pass directly from Level 3 model pointers (`sources:: [<path>@<unit>]`). No intermediate `<!-- cite: ... -->` HTML comments or `_draft.md` files are generated.

## Citation targets: Sources and Models

A `<ref>` is `<path>@<unit>`. It resolves canonically as:
- **Sources** live under `sources/nn/`. An **unqualified** path resolves there by default (`interview.md@## Feedback` → `sources/nn/interview.md@## Feedback`); the explicit `sources/nn/` prefix is still tolerated. Header levels are preserved (`@#`, `@##`, `@###`).
- **Tabular sources** are cited directly from curated CSVs: `sources/nn/metricas_q3.csv@104` (row by first-column key), `sources/nn/metricas_q3.csv@104&mrr_usd` (one cell). Normalized-MD derivatives are an ingestion aid, not a citation target.
- **Models** are a first-class citation target under the explicit `models/` namespace: `models/Finance_V_1-0-0_business_NN.md@## Revenue Forecast`. Same `path@unit` syntax; the parser and workspace-source validator already resolve it.

**Artifact → model → source chain.** A deliverable MAY cite a Model element directly (`models/x.md@## Concept: Element`). That element carries its own `sources::` pointing at `sources/nn/…`, so provenance stays fully traceable end to end: *artifact → `models/x.md@## Concept: Element` → `sources/nn/1.md@## Section`* (or `→ sources/nn/m.csv@104&column` for data claims). Cite the Model when the claim is the model's own synthesized position; cite the Source when the claim is a raw fact.

**Heading-level convention (authoring rule).** For Model-element anchors to be stable and meaningful: `# NN <Concept>` (H1 = Concept), `## NN <Concept>: <Element>` (H2 = Element), `###`+ only inside an element's prose. The slug algorithm is level-agnostic — this is authorial discipline, not a validation gate.

## Format: Standard Markdown Footnotes (`[^1]`) *(Recommended)*

Native CommonMark and GitHub Flavored Markdown (GFM) footnotes. This is the primary recommended citation format.

Rules:
- Insert an inline bracketed footnote marker `[^N]` immediately following the cited claim, statistic, or paragraph.
- Number footnote markers sequentially starting at `[^1]`, `[^2]`, etc., in order of appearance.
- Append footnote definitions at the bottom of the document. Each definition maps the index to the source document and section anchor:
  ```markdown
  [^N]: <Source Title or Filename> (<path>@<unit>), <unit-label>.
  ```
- Units MUST be valid knowledge-unit pointers (`@` grammar: header with level, or CSV row/cell) resolving in the cited file under `sources/nn/` (legacy `#slug` anchors validate with a deprecation warning).

Example:
```markdown
The operational target for Q3 is 12,000 active units[^1].

...

  [^1]: Strategic Growth Plan (strategic_plan_source.md@## Q3 Milestones), section Q3 Milestones.
```

## Format: Simple — Verbatim Source Attribution

Render visible inline attribution directly after the cited claim.

```markdown
— Source: <filename>, section <section-name>
```

Rules:
- Insert visible attribution text directly in the body flow.
- No HTML comments, no parentheses, no author guessing, no numbering. Each citation stands alone.

## Format: APA 7th Edition — In-Text Citations

Render citations in APA 7th edition in-text citation style directly from model pointers.

Rules:
- Use (Author, Year) format in the sentence or at the end.
- For organizational sources (reports, evaluations), use the organization name as author: (Organization, Year).
- Include section when available: (Author, Year, section name).
- Guess the author from the filename or frontmatter context. If uncertain, use the filename stem.
- End-of-sentence citations go before the period.
- No HTML comments or raw `— Source:` text are emitted.

Example:
```markdown
The organization had 45 active members in 2023 (IF Narrative, 2024, section IOE.1).
```

Generate a reference list at the end titled "References" with full entries per unique source.

### Primary vs. Secondary Citation Resolution
When a source file in `sources/nn/` contains a `cited_works:` block in its frontmatter (e.g. citing an external work like `porter1985` with `is_primary: true`):
- Cross-reference the claim against the source document's `cited_works:` metadata.
- If the claim is an attribution of a third-party theory or finding (e.g. Porter's framework cited within a Market Report by Doe):
  Format in APA as: *(Porter, 1985, as cited in Doe, 2026)* or prompt to cite the primary work directly.
- Avoid the "telephone game" by preventing false primary attribution to intermediate documents.

## Format: MLA 9th Edition — Parenthetical Citations

Render citations in MLA 9th edition parenthetical style directly from model pointers.

Rules:
- Use (Author Page) for print sources.
- For web/reports with no page numbers, use (Author, par. X) if section is available.
- Omit page number entirely if not available.
- Use the filename stem as author if the actual author is not identifiable.
- End-of-sentence citations go before the period.
- No HTML comments or raw `— Source:` text are emitted.

Generate a "Works Cited" list at the end with full entries per unique source.

## Format: Chicago — Notes-Bibliography or Author-Date

Choose the appropriate Chicago style based on context:
- For narrative documents with few citations: notes-bibliography (superscript number + footnote).
- For citation-dense documents: author-date (Author Year, Page).

Notes-bibliography rules:
- Insert a superscript number at the citation point.
- Add a footnote with: Author, "Title," Source, Date.
- Generate a "Bibliography" section at the end.

Author-date rules:
- Use (Author Year, Page) in text.
- Generate a "References" section at the end.

No HTML comments or raw `— Source:` text are emitted.

## Format: IEEE — Numbered References

Render citations in IEEE numbered reference style.

Rules:
- Assign a sequential bracketed number [1], [2], etc. to each unique source.
- Insert `[N]` at the citation point in text.
- Append a "References" section at the end with:

  [N] A. Author, "Title," Source, Date.

- Reuse the same number when citing the same source.
- No HTML comments or raw `— Source:` text are emitted.

## Format: Vancouver — Numeric Citation Style

Render citations in Vancouver numeric style.

Rules:
- Assign sequential numbers to each unique source.
- Use superscript or bracketed (1) numbers in text (agent chooses based on context).
- Append a "References" section at the end with:

  Author AB. Title. Source. Date;Vol:Pages.

- Reuse the same number for repeated citations of the same source.
- No HTML comments or raw `— Source:` text are emitted.

## Format: BibTeX — Export `.bib` File

Generate the deliverable markdown body without inline citations or HTML comments, and create a companion `.bib` file alongside the deliverable (`export/[Deliverable_Name]_V_x-y-z.bib`) with one entry per unique source file in `sources/nn/`.

Use this template for each entry. Fill placeholder fields from the source filename and frontmatter. The citation key is a slugified version of the `sources/nn/` path (slashes and dots become hyphens):

```bibtex
@techreport{sources-nn-relative-path-to-source-md,
  author       = {Organization or Author Name},
  title        = {Full Source Title},
  year         = {YYYY},
  type         = {Report},
  howpublished = {\url{relative/path/to/source}}
}
```

Rules:
- If the source frontmatter provides a `canonical.bibtex` block, emit that canonical BibTeX entry verbatim rather than re-synthesizing it.
- One entry per unique source path under `sources/nn/` — reuse keys, do not duplicate.
- Adapt entry type for non-report sources:
  - Interviews: `@misc{<key>, author={...}, title={...}, year={...}, howpublished={\url{...}}}`
  - Web pages: `@misc{<key>, author={...}, title={...}, year={...}, howpublished={\url{...}}}`
  - Articles: `@article{<key>, author={...}, title={...}, journal={...}, year={...}}`
- The citation key MUST be derived deterministically from the `sources/nn/` path (e.g., `sources/nn/if-narrative-gv22bo-1.md` → `sources-nn-if-narrative-gv22bo-1-md`), never an arbitrary counter.
- Save the output file as `export/[Deliverable_Name]_V_x-y-z.bib` alongside the exported markdown deliverable.
- Do NOT include HTML comments or visible citations in the main document body — produce a clean document.

Example entry for a report source:

```bibtex
@techreport{sources-nn-if-narrative-gv22bo-1-md,
  author       = {IF Narrative GV22BO-1},
  title        = {IF Narrative GV22BO-1},
  year         = {2024},
  type         = {Report},
  howpublished = {\url{sources/nn/if-narrative-gv22bo-1.md}}
}
```

## Format: No sources — Clean Presentation Deliverable

Omit all inline citation markers, footnote links, source attributions, and trailing reference lists.

Rules:
- Do not emit `[^N]` markers, `— Source:` strings, or bibliographic keys in the text body.
- Do not append footnotes, References, Works Cited, or Bibliography sections.
- Do not generate `.bib` companion files.
- Deliverable is output as clean, presentation-ready markdown directly to `export/[Deliverable_Name]_V_x-y-z.md`.
