# Citation & Traceability Skill Specification

The `citation-traceability` subsystem governs how agent skills ingest raw files, normalize content, maintain cryptographic integrity, and connect assertions in `iNNfo` models with verifiable provenance.

---

## 1. Scanner Architecture & Ingestion Pipeline

The `scanner.js` orchestrator discovers and transforms raw sources from `sources/original/` to `sources/nn/`:

1. **Discovery (`walkOriginal`):**
   - Preserves complete folder and subfolder hierarchies.
   - Skips `sources/staging/` buffer and dot-directories.
2. **Deterministic Conversion (`scanner-converters.js`):**
   - Subtitles (`.srt`, `.vtt`) parsed into timed sections.
   - Tabular files (`.csv`) parsed into schema dictionaries and summaries.
   - Chat histories (`.json`) formatted with speaker headers.
   - Word (`.docx`), Excel (`.xlsx`), and PDF (`.pdf`) extracted via dedicated parsers.
3. **Cryptographic Fingerprinting (`computeFileHash`):**
   - Generates 64-character lowercase hexadecimal SHA-256 hash for every raw file.
4. **OKF Manifest Generation (`sources/nn/index.md`):**
   - Writes the ingestion manifest conforming to Google's **Open Knowledge Format (OKF v0.1)**.

```yaml
---
type: "index"
title: "traNNsform Ingestion Manifest & Processing Log"
description: "Source documents registry and processing log for normalized knowledge assets"
tags: [sources, ingestion, manifest, okf, provenance]
timestamp: "2026-09-05T12:00:00Z"
---
```

---

## 2. Clean Frontmatter Standards

Every file normalized into `sources/nn/` contains strict, flat frontmatter:

```yaml
---
source_file: "sources/original/reports/annual_2026.pdf"
sha256: "4a8f9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"
size_bytes: 524288
normalized_at: "2026-09-05T10:00:00.000Z"
normalized_by: "traNNsform v1.0.0"
---
```

Optional metadata fields:
- `source_url`: Original HTTP URL if imported via web downloader.
- `downloaded_at`: Download timestamp.
- `title`, `author`: Document authorship metadata.
- `staging_file`: Relative path if pre-processed through staging.
- `is_synthetic`: Boolean flag (`true` if AI-generated, `false` for verbatim conversions).

---

## 3. Reference Syntax & Anchor Discipline

In models and skills:
- **Valid:** `sources:: [executive_brief.md#key-metrics]`
- **Valid:** `sources:: [subfolder/dataset.md#sheet1]`
- **Invalid (Rejected):** `sources:: [report.md#L10-L25]` (Line numbers break easily and are forbidden).

---

## 4. Artifact Generation & BibTeX Compilation

When producing final deliverables:
- **Canonical View:** Writes reports with `^[source.md#slug]` citations for mathematical traceability.
- **Export View:** Converts callouts to sequential bracketed markers (`[1]`, `[2]`), appends a formal `## References` section, and generates a standard `.bib` file for academic citation managers (Zotero, Mendeley, LaTeX).
