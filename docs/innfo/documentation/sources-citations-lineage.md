# Sources, Citations & Lineage

The cogNNitive pipeline tracks where knowledge comes from with **three** words,
one meaning each:

| Term | What it is |
| :--- | :--- |
| **Source** | A raw citable file with a co-located sidecar `<file>.<ext>_sidecar_NN.md` next to it. The sidecar carries the **origin metadata** (`source_file`, `sha256`, `size_bytes`, `source_format`, `normalized_at`, `normalized_by`, and, for web imports, `source_url` / `downloaded_at`). One Source per cognitivized file; the raw file is never moved or renamed. |
| **Citation** | A pointer from a consumer to a Source or knowledge unit. Two altitudes: a **model citation** uses the unified `@` grammar (e.g. `sources:: sources/import/<path>.md@## Heading`, `sources/import/<path>.csv@RowID&col`, or `sources/import/<path>.json@/items/0`) or a file-level citation (e.g. `kNNowledge/<Doc>_NN.md`); an **artifact citation** is `[^1]` / APA / IEEE / … inside a generated deliverable. |
| **Lineage** | The single living record `<Project>_cogNNitive_NN.md` consisting of **projected view sections** (`# NN Sources`, `# NN ModelRecords`, `# NN Artifacts`) and an **append-only journal** (`# NN Procedures`). The version lives in the `knowledge_version` frontmatter, never in the name. |

```
sources/import/        ──►   co-located sidecar    ──►   kNNowledge/*_NN.md  ──►   artifacts/
sources/conversations/       (<file>.<ext>_sidecar_NN.md) (model Citations:          (deliverables +
                                  + origin metadata)       sources:: [a.md@## H])      artifact Citations)
        └──────────────────────── recorded in the Lineage record ───────────────────────┘
```

---

## 1. Sources — In-Place Cognition & Origin Metadata

`nn-sources` scans the active source subtrees (`sources/import/` and
`sources/conversations/`), and for each file writes a co-located sidecar
`<file>.<ext>_sidecar_NN.md` through the single `cognitivize` operation. The raw
file's bytes and path are never changed, and there is no `sources/nn/` mirror.
The sidecar carries a flat, deterministic YAML frontmatter:

- `sha256` of the **raw** file's bytes — the change-detection key. Hashing uses
  raw bytes only (no line-ending normalization), and the domaiNN ships a
  `.gitattributes` with `* -text` so the hash stays byte-stable across checkouts.
  Git is the *repo-wide* history mechanism; per-source versions are the
  write-once family members themselves (see §5).
- `source_file`, `sha256`, `size_bytes`, `source_format`, `normalized_at`,
  `normalized_by`.
- `source_type:` — set on promoted transcripts under `sources/conversations/`
  (`conversation_transcript`) and on feedback JSON (`feedback`).
- `sources` — the upstream citations of the subject, used for binary subjects
  that cannot declare their own.
- `canonical:` — this document's own bibliographic identity (title, author,
  year, DOI, a BibTeX block), when known.
- `cited_works:` — the external works **this Source cites** (`id`, `citation`,
  `doi`, `is_primary`). *Named `cited_works`, not `references`, so it does not
  collide with the iNNfo `reference` field type, which is a cross-model link.*
  `references:` is still accepted as a deprecated input alias.

A transient extraction buffer, `staging/` (Whisper SRTs, raw OCR), is ignored by
the scanner and git and is **never a valid Citation target**. It is never
discovered, cited, or projected as a lineage node, and write-once rules do not
apply to it.

For markdown, CSV, and JSON files the sidecar has no normalized body; the raw
file is the citation target. For every other (binary) format the sidecar carries
the normalized markdown body produced by the injected normalizer, so headings
stay citable.

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

Raw imports (external files, watch roots, URL fetches) copy bytes verbatim into
`sources/import/` — the only canonical raw-import location — through the
write-once path, then cognitivize the copy. Identical bytes dedupe to no write.

---

## 2. Model Citations & The Unified `@` Grammar

Level 3 knowledge elements point at Sources with `sources::` using canonical `@` grammar:

```markdown
## NN Stakeholders: Enterprise Clients
sources:: [sources/import/interview.md@## Key Clients, sources/import/notes/kickoff.md@## Priorities]
```

### The Three Lineage Rules

1. **Direct citations only (Single Edge)**: Downstream models and artifacts cite their immediate upstream inputs directly. There are no intermediate ID schemes (`src-NNN`), synthetic proxy edges, or duplicated provenance layers.
2. **Single provenance path**: Downstream derived artifacts (such as HTML consoles) cite their source knowledge document via a file-level citation (`meta.sources: ["kNNowledge/Client_business_NN.md"]`) rather than duplicating all transitive upstream source citations.
3. **Optional sources on deliverables**: If an artifact or CSV has no external source inputs, the `sources` field/column is simply omitted, denoting a terminal or self-contained artifact.

### Citation Grammar

- **Markdown heading citation**: `sources/import/report.md@## Executive Summary`
- **CSV row and column citation**: `sources/import/pricing.csv@R12&rate`
- **JSON Pointer citation (RFC 6901)**: `sources/import/data.json@/items/0/name`
- **File-level citation (bare path)**: `kNNowledge/Client_business_NN.md`
- **Binary source**: cite the sidecar body, `sources/import/report.pdf_sidecar_NN.md@## Findings`.
- **Path resolution**: every citation path is **workspace-relative with no implicit prefix**. `report.md@## Overview` resolves only if `report.md` exists at the workspace root; there is no default under a retired folder.
- **Retired-prefix paths** (`sources/nn/`, `sources/original/`, `sources/export/`, `export/`, `models/`) have no special handling: they simply do not exist and dangle (`KU_DANGLING_FILE`). The legacy layout detector, not the resolver, explains why. An existing file under `sources/archive/` is a plain path and still resolves.
- **Legacy `#slug` read path**: Legacy `#slug` citations (`sources/import/report.md#overview`) remain readable for frozen historical specs with a deprecation warning (`KU_DEPRECATED_HASH`). All active producers write `@` citations.

Line numbers (`#L10-L20`) and `src-NNN` wrappers are strictly forbidden.

---

## 3. The Lineage Record: View + Journal

The workspace Lineage record (`<Project>_cogNNitive_NN.md`) is maintained by pure projection in `@cognnitive/innfo-core`:

```
Record = Projected View Sections + Append-Only Journal
```

### Projected View Sections (Dynamic)

The view sections are pure functions of the workspace file snapshot. Node roles
come from the naming contract: a file with a co-located sidecar is a Source, a
`knowledge` document is a ModelRecord, and any other non-`_NN.md` file is an
Artifact node only if it is a timestamped family member or declares upstream
`sources` (a hand-written markdown file with neither is not projected). Sidecars,
the record itself, and `staging/` never appear as nodes.

| Section | Synced from | Rendered fields |
| :--- | :--- | :--- |
| `# NN Sources` | Every raw file with a co-located sidecar | `raw_hash, size, source_format, normalized_at, normalized_by, version, superseded_by, derived_from` |
| `# NN ModelRecords` | `kNNowledge/*_NN.md` | `model_ref, knowledge_version, model_template, derived_from` |
| `# NN Artifacts` | `artifacts/**/*.{md,html,csv,json}` | `artifact_ref, artifact_format, derived_from` |

`derived_from` fields are typed `citation` and carry exact upstream `@` or file-level references. `version` is `V<rank>` (the 1-based position in the family order) and `superseded_by` holds the next member's path; the latest member carries neither `superseded_by` nor any archive field.

### Drift gate

The persisted record is only trustworthy if its managed view sections equal a
fresh projection. The drift gate recomputes the projection and compares the
on-disk text of `# NN Sources`, `# NN ModelRecords`, and `# NN Artifacts` byte by
byte. It runs in three sites — `nn-sources --lineage --check`,
`node scripts/verify.js`, and the MCP `check_workspace` tool — and never compares
the `# NN Procedures` journal, hand-authored blocks, or frontmatter. Fixing drift
is the job of `--lineage` (regeneration), never of the gate.

### Append-Only Journal

- **`# NN Procedures`** is an **append-only run log**. Each pipeline execution (`--scan`, `--import-url`) appends one `## NN Procedures:` entry (`command`, `flags`, `run_at`, `inputs`, `outputs`). Existing procedure entries are never rewritten or lost on resync.

---

## 4. Artifact Citations & Deliverables

`nn-sources` derives deliverables into `artifacts/` (reports, dashboards,
summaries). Every output is **write-once**: it gets a UTC suffix
`_YYYYMMDDTHHmmssZ` before the extension, with `-2`, `-3`… as a same-second
tie-break. Running a producer twice on unchanged input writes nothing (dedup
against the latest member); changed input writes a new member and leaves earlier
bytes identical. "Latest" is a query over names, never a moving `_latest` alias.
Validation reports go to the same folder.

The retired `export/` folder is replaced by `artifacts/` in a single rename, with
no fallback.

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
2. **Write-once families & content hashing**: Each source version is an immutable family member named with a UTC suffix (`_YYYYMMDDTHHmmssZ`), and every raw file is fingerprinted with SHA-256 (`sha256` in its sidecar and `meta.sha256` in consoles). The `_V_` filename form is retired for kNNowledge; the version lives in frontmatter.

### The Staleness Principle

- Upstream source updates are detected by comparing sidecar `sha256` hashes against the raw file's current bytes; `writeOnce` refuses to write when an input's sidecar hash no longer matches (`HASH_MISMATCH`).
- Downstream models audit anchor freshness: if a source heading changes or moves, `validateWorkspaceSources` and impact checkers report missing or altered targets with diagnostic suggestions.
- Consoles verify currency via `meta.sha256` of their parent knowledge document.

---

## 6. Retention: Write-Once Families & Consent-Gated GC

A changed source is not snapshotted; it becomes a **new family member**. The
previous member keeps its bytes, so existing citations keep resolving. The V-chain
is the family ordered by name, not an archive directory.

Garbage collection only *proposes*: `nn-sources --gc` (dry run) lists the
non-latest, uncited members, and only `--gc --apply --yes --paths <list>` deletes
the intersection of the user-confirmed list and a freshly recomputed plan. Cited
members, the latest member, and the lineage record are never proposed. Deleting a
member also deletes its sidecar. Non-interactive runs (CI, `verify`) never pass
`--apply`.
