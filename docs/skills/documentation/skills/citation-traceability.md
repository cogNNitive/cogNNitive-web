# Citation & Traceability Skill Specification

The `citation-traceability` subsystem governs how agent skills ingest raw files, normalize content, maintain cryptographic integrity, and connect assertions in `iNNfo` models with verifiable single-edge provenance.

---

## 1. Scanner Architecture & Ingestion Pipeline

The `scanner.js` orchestrator cognitivizes raw sources in place under `sources/import/` and `sources/conversations/`, writing a co-located sidecar `<file>.<ext>_sidecar_NN.md` next to each raw file:

1. **Discovery (`walkImport`):**
   - Preserves folder and subfolder hierarchies.
   - Skips `staging/`, sidecars, and dot-directories.
2. **Deterministic Conversion (`scanner-converters.js`):**
   - Subtitles (`.srt`, `.vtt`) parsed into timed sections under `#`/`## NN` headings.
   - Tabular files (`.csv`) parsed into schema dictionaries and summaries.
   - Word (`.docx`), Excel (`.xlsx`), and PDF (`.pdf`) extracted via dedicated parsers.
3. **Cryptographic Fingerprinting (`computeFileHash`):**
   - Generates 64-character lowercase hexadecimal SHA-256 hash for every raw file.

---

## 2. Frontmatter Standards

Every sidecar carries strict, flat YAML frontmatter (`source_file` records the
raw file's workspace-relative path):

```yaml
---
level: 3
parent_spec:
  name: sidecar
source_file: "sources/import/reports/annual_2026.pdf"
sha256: "4a8f9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"
size_bytes: 524288
source_format: pdf
normalized_at: "2026-10-01T10:00:00.000Z"
normalized_by: "nn-sources"
---
```

Optional metadata fields:
- `source_url`: Original HTTP URL if imported via web downloader.
- `downloaded_at`: Download timestamp.
- `title`, `author`: Document authorship metadata.
- `sources`: Upstream citations of a binary subject.
- `cited_works`: External bibliographic citations.

The sidecar body is present only for binary sources; markdown, CSV, and JSON
sidecars are bodyless and the raw file is the citation target.

---

## 3. Reference Syntax & Anchor Discipline

In models and skills, citations use the canonical single-edge `@` grammar:

- **Markdown Heading Citation:** `sources:: [sources/import/executive_brief.md@## Key Metrics]`
- **CSV Row/Column Citation:** `sources:: [sources/import/dataset.csv@R12&price]`
- **JSON Pointer Citation:** `sources:: [sources/import/data.json@/items/0/name]`
- **File-Level Citation (bare path):** `derived_from:: [kNNowledge/Client_business_NN.md]`
- **Binary Source:** cite the sidecar body, `sources/import/report.pdf_sidecar_NN.md@## Findings`.
- **Forbidden (Rejected):** `sources:: [report.md#L10-L25]` (line ranges) or legacy ID wrappers (`src-NNN`).

---

## 4. Deliverable Artifact Citations

When producing final write-once deliverables under `artifacts/`:
- **Footnotes View:** Writes reports with standard Markdown footnotes (`[^1]`).
- **Inline View:** Simple attributions (`— Source: file.md`).
- **Academic Citation Styles:** APA 7th, MLA 9th, Chicago, IEEE, Vancouver, and BibTeX companion `.bib` export.
