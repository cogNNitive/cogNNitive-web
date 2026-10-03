---
title: "nn-trannsform — Document Ingestion & Transformation Pipeline"
description: "Scan raw documents, normalize them to Markdown with mandatory provenance frontmatter, and execute multi-step transformation procedures."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-trannsform
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn-trannsform

**Skill**: `nn-trannsform` · **Role**: Document Ingestion & Transformation Pipeline

Bootstrap projects, scan raw multi-modal documents, normalize them to Markdown with mandatory provenance frontmatter, apply template-based transformations, and execute multi-step procedures compliant with `procedures_V_0-1-0_NN.md`.

---

## 1. Canonical Workspace Directory Layout

Every project workspace adheres to this standard structure:

```text
[project-name]/
├── sources/
│   ├── import/           # Raw imports, verbatim and write-once (UTC-suffixed names)
│   │   └── <file>.<ext>_sidecar_NN.md   # Co-located sidecar (hash, size, metadata)
│   └── conversations/    # Promoted transcripts, cognitivized in place
├── conversations/        # Live session transcripts (scratch)
├── assets/               # Materialized source copies for attachments & media
├── kNNowledge/           # Structured semantic iNNfo Level 3 documents (*_NN.md)
├── procedures/           # Reusable transformation procedure specs (<verb>_<noun>_procedures_NN.md)
├── artifacts/            # Every producer output, write-once (UTC-suffixed names)
├── staging/              # Scratch extraction buffer — never cited, never projected
└── domaiNN_NN.md         # Workspace entrypoint (# NN index)
```

`sources/nn/`, `sources/original/`, `sources/export/`, `sources/archive/`, and
`export/` are retired and are never resolved at runtime.

---

## 2. Multi-Format Normalization Matrix

| Format | Native Reading | Node.js Converter | Output Format |
| :--- | :--- | :--- | :--- |
| `txt` / `md` | ✅ Direct read | — | Direct markdown with scanner frontmatter |
| `srt` / `vtt` | ✅ Direct read | Subtitle Parser | Timed conversational sections |
| `csv` | ✅ Direct read | CSV Analyzer | Data Dictionary + Statistical Summary |
| `docx` | ❌ Binary | `mammoth` | Markdown with section headings |
| `pdf` | ⚠️ Model-dependent | `pdf-parse` | Extracted text + metadata |
| `xlsx` | ❌ Binary | `xlsx` | Per-sheet markdown tables with schema profiling |

---

## 3. Mandatory Scanner Provenance Frontmatter

Every co-located sidecar carries flat scanner metadata:

```yaml
---
level: 3
parent_spec:
  name: sidecar
source_file: "sources/import/interview_transcript.pdf"
sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
size_bytes: 1048576
source_format: pdf
normalized_at: "2026-09-05T12:00:00Z"
normalized_by: "traNNsform V_2-0-0"
---
```

---

## 4. Citation & Export Formats

Before generating write-once final deliverables under `artifacts/`, the user selects their preferred citation format:
- **`[a]` (Recommended)** Standard Markdown Footnotes (`[^1]`)
- **`[b]`** Simple inline attribution (`— Source: file.md@## Heading`)
- **`[c]`** APA 7th Edition
- **`[d]`** MLA 9th Edition
- **`[e]`** Chicago Author-Date
- **`[f]`** IEEE numbered citations
- **`[h]`** BibTeX export (`.bib` companion file)
- **`[i]`** Clean presentation (no sources / callouts omitted)
