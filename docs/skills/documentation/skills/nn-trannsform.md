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
│   ├── original/         # User's pristine dropbox — untouched by tools (NEVER move/rename/delete)
│   └── nn/                # LA COLECCIÓN DE FUENTES — normalized Markdown mirroring original subfolders
├── assets/               # Materialized source copies for attachments & media
├── models/               # Structured semantic iNNfo Level 3 models (*_NN.md)
├── procedures/           # Reusable transformation procedure specs (*_procedures_V_0-1-0_NN.md)
├── artifacts/            # Derivative deliverables and generated output products
│   ├── exports/          # Final deliverables (clean Markdown, HTML, PDF, BibTeX)
│   └── reports/          # Validation reports and audit trails
└── index.md              # Semantic workspace index (# NN index)
```

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

Every normalized file in `sources/nn/` contains flat scanner metadata:

```yaml
---
source_file: "sources/original/interview_transcript.pdf"
sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
size_bytes: 1048576
normalized_at: "2026-09-05T12:00:00Z"
normalized_by: "traNNsform V_2-0-0"
---
```

---

## 4. Citation & Export Formats

Before generating final deliverables in `artifacts/exports/`, the user selects their preferred citation format:
- **`[a]` (Recommended)** Standard Markdown Footnotes (`[^1]`)
- **`[b]`** Simple inline attribution (`— Source: file.md#heading`)
- **`[c]`** APA 7th Edition
- **`[d]`** MLA 9th Edition
- **`[e]`** Chicago Author-Date
- **`[f]`** IEEE numbered citations
- **`[h]`** BibTeX export (`.bib` companion file)
- **`[i]`** Clean presentation (no sources / callouts omitted)
