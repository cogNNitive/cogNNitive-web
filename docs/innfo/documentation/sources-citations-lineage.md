# Sources, Citations & Lineage

The cogNNitive pipeline tracks where knowledge comes from with **three** words,
one meaning each:

| Term | What it is |
| :--- | :--- |
| **Source** | A normalised Markdown or structured file under `sources/nn/`, plus its **origin metadata** in the frontmatter (`source_file`, `sha256`, `size_bytes`, `normalized_at`, `normalized_by`, and, for web imports, `source_url` / `downloaded_at`). One Source per original ingested file. |
| **Citation** | A pointer from a consumer to a Source or model unit. Two altitudes: a **model citation** uses the unified `@` grammar (e.g. `sources:: sources/nn/<path>.md@## Heading` or `sources/nn/<path>.csv@RowID&col`) or a file-level citation (e.g. `kNNowledge/<Doc>_NN.md`); an **artifact citation** is `[^1]` / APA / IEEE / … inside a generated deliverable. |
| **Lineage** | The single generated record `<Project>_V_x-y-z_cogNNitive_NN.md` consisting of **projected view sections** (`# NN Sources`, `# NN ModelRecords`, `# NN Artifacts`) and an **append-only journal** (`# NN Procedures`). |

```
sources/import/        ──►   sources/nn/        ──►   kNNowledge/*_NN.md  ──►   export/
sources/conversations/       (Sources: normalised     (model Citations:          (deliverables +
sources/export/               + origin metadata)       sources:: [a.md@## H])     artifact Citations)
        └──────────────────────── recorded in the Lineage record ───────────────────────┘
```

---

## 1. Sources — Ingestion & Origin Metadata

`nn-trannsform` scans active source subtrees (`sources/import/`, `sources/conversations/`, and `sources/export/`),
normalises each supported format to Markdown under the matching path in
`sources/nn/`, and writes a flat, deterministic YAML frontmatter:

- `sha256` of the **original** file's bytes — the change-detection key. Git is
  the *repo-wide* history mechanism; per-source snapshots live in
  `sources/archive/` (see §5).
- `source_file`, `size_bytes`, `normalized_at`, `normalized_by`.
- `conversation_format:` / `source_type:` — set on promoted transcripts under `sources/conversations/`.
- `canonical:` — this document's own bibliographic identity (title, author,
  year, DOI, a BibTeX block), when known.
- `cited_works:` — the external works **this Source cites** (`id`, `citation`,
  `doi`, `is_primary`). *Named `cited_works`, not `references`, so it does not
  collide with the iNNfo `reference` field type, which is a cross-model link.*
  `references:` is still accepted as a deprecated input alias.

A transient extraction buffer, `sources/staging/` (Whisper SRTs, raw OCR), is
ignored by the scanner and git and is **never a valid Citation target**.

### Supported formats

| Format | Extension | Converter | Output |
| :--- | :--- | :--- | :--- |
| Subtitles / transcripts | `.srt`, `.vtt` | `convertSubtitles` | Timestamp-chunked paragraphs under `#`/`## NN` headings |
| Tabular data | `.csv` | `convertCsv` | `# NN Dataset Schema` + `## NN Summary Statistics`, then rows |
| Data / structured records | `.json` | `convertJson` | `# NN Dataset Schema` profile for arrays of objects; fenced json block for general objects |
| Word | `.docx` | `convertDocx` (mammoth) | Markdown, heading hierarchy + tables preserved |
| Spreadsheets | `.xlsx`, `.xls` | `convertXlsx` (xlsx) | One Markdown table per sheet |
| PDF | `.pdf` | `convertPdf` (pdf-parse) | Extracted text |
| Text / Markdown | `.txt`, `.md`, `.html` | direct | Content preserved, third-party frontmatter stripped |

### Progressive disclosure

For very large Sources, `nn-trannsform` supports a two-tier split:
`{basename}_summary.md` (a short semantic distillation for discovery) and
`{basename}_source.md` (the complete normalised text with anchors for deep
Citation).

---

## 2. Model Citations & The Unified `@` Grammar

Level 3 knowledge elements point at Sources with `sources::` using canonical `@` grammar:

```markdown
## NN Stakeholders: Enterprise Clients
sources:: [sources/nn/interview.md@## Key Clients, sources/nn/notes/kickoff.md@## Priorities]
```

### The Three Lineage Rules

1. **Direct citations only (Single Edge)**: Downstream models and artifacts cite their immediate upstream inputs directly. There are no intermediate ID schemes (`src-NNN`), synthetic proxy edges, or duplicated provenance layers.
2. **Single provenance path**: Downstream derived artifacts (such as HTML consoles) cite their source knowledge document via a file-level citation (`meta.sources: ["kNNowledge/Client_NN.md"]`) rather than duplicating all transitive upstream source citations.
3. **Optional sources on deliverables**: If an artifact or CSV has no external source inputs, the `sources` field/column is simply omitted, denoting a terminal or self-contained artifact.

### Citation Grammar

- **Markdown heading citation**: `sources/nn/report.md@## Executive Summary`
- **CSV row and column citation**: `sources/nn/pricing.csv@R12&rate`
- **File-level citation (bare path)**: `kNNowledge/Client_NN.md` or `sources/export/memo.md`
- **Unqualified source path resolution**: `report.md@## Overview` resolves canonically against `sources/nn/report.md`.
- **Legacy `#slug` read path**: Legacy `#slug` citations (`sources/nn/report.md#overview`) remain readable for frozen historical specs with a deprecation warning (`KU_DEPRECATED_HASH`). All active producers write `@` citations.

Line numbers (`#L10-L20`) and `src-NNN` wrappers are strictly forbidden.

---

## 3. The Lineage Record: View + Journal

The workspace Lineage record (`<Project>_V_x-y-z_cogNNitive_NN.md`) is maintained by pure projection in `@cognnitive/innfo-core`:

```
Record = Projected View Sections + Append-Only Journal
```

### Projected View Sections (Dynamic)

The view sections are pure functions of the workspace file snapshot:

| Section | Synced from | Rendered fields |
| :--- | :--- | :--- |
| `# NN Sources` | `sources/nn/`, `sources/archive/`, `sources/export/` | `raw_filename, media_filename, raw_hash, size, source_format, normalized_at, normalized_by, normalized_content, curated_csv, status, version, archive_path, superseded_by, derived_from` |
| `# NN ModelRecords` | `kNNowledge/*_NN.md` | `model_ref, knowledge_version, model_template, derived_from` |
| `# NN Artifacts` | `export/**/*.{md,html,csv,json}` | `artifact_ref, artifact_format, derived_from` |

`derived_from` fields are typed `citation` and carry exact upstream `@` or file-level references.

### Append-Only Journal

- **`# NN Procedures`** is an **append-only run log**. Each pipeline execution (`--scan`, `--import-url`, `--apply`) appends one `## NN Procedures:` entry (`command`, `flags`, `run_at`, `inputs`, `outputs`). Existing procedure entries are never rewritten or lost on resync.

---

## 4. Artifact Citations & Deliverables

`nn-trannsform` derives deliverables into `export/[Deliverable_Name]_V_x-y-z.md` (reports, dashboards, summaries).
Validation reports go to the same folder, tagged `type: report` in frontmatter.

Supported deliverable citation styles:
- `[a]` **Standard Markdown Footnotes** (`[^1]`) — the recommended default.
- `[b]` Simple inline attribution — `— Source: <filename>, section <name>`.
- `[c]`–`[g]` APA 7th / MLA 9th / Chicago / IEEE / Vancouver.
- `[h]` BibTeX — a clean body plus a companion `.bib` file.
- `[i]` No sources — a clean, unannotated deliverable.

---

## 5. Versioning & The Staleness Principle

cogNNitive uses **two complementary versioning systems**:

1. **Git / GitHub**: Whole-repository history, branches, diffs, and release tags (`blueprints-v*`, `skills-v*`, `innfo-mcp-v*`).
2. **Native SemVer & Content Hashing**: Per-artifact identities (`V_MAJOR-MINOR-PATCH`) and cryptographic SHA-256 fingerprints (`sha256` frontmatter and `meta.sha256`).

### The Staleness Principle

- Upstream source updates are detected by comparing `sha256` hashes against active sources.
- Downstream models audit anchor freshness: if a source heading changes or moves, `validateWorkspaceSources` and impact checkers report missing or altered targets with diagnostic suggestions.
- Consoles verify currency via `meta.sha256` of their parent knowledge document.

---

## 6. Native Source Archive

When `nn-trannsform --scan` detects that an existing source file has changed:
1. It archives the previous normalized text to `sources/archive/<basename>/V<N>/<basename>.md`.
2. It normalizes the new version in place in `sources/nn/`.
3. The Lineage record reflects the archive chain (`version::`, `archive_path::`, `superseded_by::`).
4. `sources/archive/` is excluded from standard scanner walks and is not a default citation target.
