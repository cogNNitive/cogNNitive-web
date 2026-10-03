---
spec_version: "V_0-3-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/sidecar/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-3-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"
blueprint_version: "V_0-1-0"
title: "Sidecar App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Sidecar]]

# NN Concept Definition

## NN Concept Definition: Sidecar
icon:: file-check
type:: list
color:: teal
weight:: 100

# NN Field Definition

## NN Field Definition: source_file
concept:: Sidecar
type:: string
description:: Workspace-relative path of the file this sidecar describes (its subject). Must match the subject implied by the sidecar file name.

## NN Field Definition: sha256
concept:: Sidecar
type:: string
description:: SHA-256 of the subject's raw bytes (never of decoded text), as lowercase hex. A changed hash makes the sidecar stale.

## NN Field Definition: size_bytes
concept:: Sidecar
type:: string
description:: Size of the subject in bytes, written as a decimal integer.

## NN Field Definition: source_format
concept:: Sidecar
type:: string
description:: Format of the subject, taken from its extension (for example pdf, docx, csv, md, json).

## NN Field Definition: normalized_at
concept:: Sidecar
type:: string
description:: ISO-8601 UTC instant at which the sidecar was written or last refreshed.

## NN Field Definition: normalized_by
concept:: Sidecar
type:: string
description:: Optional. Name of the normalizer that produced the body for a binary subject. Absent for text-native subjects, whose sidecar has no body.

## NN Field Definition: sources
concept:: Sidecar
type:: citation
description:: Optional. Citations to the upstream sources the subject was produced from. This is the only upstream edge a sidecar may declare; a sidecar never declares derived_from.

# Sidecar Template

## A level-2 template for the co-located metadata document that makes any workspace file a citable source

## Philosophy

A sidecar binds metadata to bytes. It sits next to its subject, keeps the subject's original extension in its own name, and records the subject's hash, size, and format. For binary subjects it also carries a normalized Markdown body, so citations by heading or row stay valid while the raw file stays untouched. Text-native subjects (Markdown, CSV, JSON) need no body: the file is its own text.

A sidecar is a concept, not a new level. It is a kNNowledge-level document that is never a model: model discovery, manifests, console targets, and editor workspace detection all ignore it. It is created or refreshed by the `cognitivize` operation, which is the only writer. Raw files and write-once artifacts are never edited; a sidecar is rewritten when the subject's hash changes.

## Naming

A sidecar is named `<file>.<ext>_sidecar_NN.md`. The original extension stays in the name, so `report.pdf` is described by `report.pdf_sidecar_NN.md` in the same folder. The name carries the blueprint, so the name invariant holds without exception: the stem `report.pdf_sidecar` ends with `_sidecar`.

## Template

### Level 3 Document Template

```yaml
---
level: 3
parent_spec:
  name: "sidecar"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/sidecar/spec_NN.md"
source_file: "sources/import/report.pdf"
sha256: "<64 lowercase hex characters>"
size_bytes: 1048576
source_format: "pdf"
normalized_at: "2026-10-02T10:15:00Z"
normalized_by: "nn-trannsform"
sources: []
---
```

The body is optional. A sidecar for a binary subject carries the normalized Markdown under ordinary headings; a sidecar for a Markdown, CSV, or JSON subject has no body.

## Rules

1. `source_file`, `sha256`, `size_bytes`, `source_format`, and `normalized_at` are required. `normalized_by` and `sources` are optional.
2. A normalizer may add its own metadata keys to the frontmatter; they are preserved on refresh.
3. A sidecar never declares `derived_from`. The upstream edge of a subject is `sources`; the lineage projection derives its own `derived_from` from it.
4. The sidecar of a sidecar does not exist. `cognitivize` rejects sidecars, `_NN.md` documents, excluded paths, and over-long paths.
