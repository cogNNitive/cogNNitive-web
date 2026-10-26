# nn-sources

`nn-sources` is the ingestion and provenance skill. It bootstraps projects, scans raw documents,
normalizes them into citable **sources**, and keeps the domaiNN lineage record in sync. It is the
owner of the `[s] Sources` stage of the [nn](nn.md) job loop.

Its two non-negotiable rules:

- **Mandatory sidecar provenance** — every cognitivized raw file gets a co-located sidecar
  `<file>.<ext>_sidecar_NN.md` recording its origin metadata.
- **No manual parsing bypass** — never hand-compute a SHA-256, hand-build a converted table, or
  hand-edit sidecar frontmatter. Always go through the canonical toolchain.

## Supported formats

Raw files are cognitivized **in place**: the tool reads the raw bytes and writes a sidecar next to
the file. The raw file is never moved, renamed, or rewritten.

| Format | Route |
|---|---|
| `txt`, `md`, `csv`, `json` | Direct read — cited directly. |
| `png`, `jpg` | Multimodal vision; `sharp` for local resize. |
| `pdf` | `pdf-parse` (on-demand install). |
| `docx` | `mammoth`. |
| `xlsx` | `xlsx`. |
| `doc` | Unsupported — legacy; convert to `.docx` first. |

Raw media (`.mp3`, `.wav`, `.png`, `.jpg`, and similar) is not converted by the scanner. To make
its content citable, place a transcript or description as a text source and cognitivize that.

## Sidecar provenance

Every cognitivized raw file gets a sidecar with origin-metadata frontmatter. `cognitivize` is the
only writer; it owns `source_file`, `sha256` (of the raw bytes), `size_bytes`, `source_format`,
`normalized_at`, and `normalized_by` when a converter ran. The body is present only for binary
sources.

```yaml
---
level: 3
parent_spec:
  name: sidecar
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/sidecar/spec_NN.md"
source_file: "sources/import/interview_transcript_20261001T101500Z.pdf"
sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
size_bytes: 1048576
source_format: "pdf"
normalized_at: "2026-10-01T10:15:00Z"
normalized_by: "traNNsform v1.0.0"
---
```

A re-run with unchanged bytes writes nothing (`unchanged`); changed bytes rewrite the sidecar in
place (`refreshed`). Semantic metadata and summaries live in the `sources_NN.md` catalog, so the
sidecar stays the single source of truth for physical and cryptographic facts.

## Citation contract

Citations use the pointer grammar `sources:: [<path>@<unit>, ...]` — always a bracketed list, with
a domaiNN-relative path written in full (no implicit prefix).

| Source kind | Unit | Example |
|---|---|---|
| Markdown | `@## Heading` | `sources/import/notes.md@## Key Feedback` |
| CSV | `@<row-id>` or `@<row-id>&<col>` | `sources/import/metricas_q3.csv@104&mrr_usd` |
| JSON | JSON Pointer (RFC 6901) | `sources/import/data.json@/items/0/name` |
| Binary | cite the sidecar | `sources/import/report.pdf_sidecar_NN.md@## Findings` |

Binary raw files cannot be cited directly (citing one reports `KU_BINARY_TARGET`). Line-number
ranges are prohibited; heading anchors, CSV row keys, and JSON Pointers are mandatory. Any
`staging/` path is never a valid citation target.

## CLI reference

The skill ships its own CLI. Run it from the skill folder, or via
`node skills/nn-sources/scripts/index.js`:

```bash
node scripts/index.js <flag> [--src "<project-dir>"]
```

| Flag | Purpose |
|---|---|
| `--src <dir>` | The domaiNN directory to operate on. |
| `--dest <dir>` `--name <n>` | Bootstrap a new project at a destination parent folder. |
| `--scan` | Walk `sources/import/` and `sources/conversations/`, cognitivizing every raw file that lacks an up-to-date sidecar. |
| `--cognitivize <file\|dir>` | Cognitivize one file or a directory recursively (skips sidecars, `_NN.md`, and `staging/`). |
| `--normalize-file "<path>"` | Atomically refresh one source file, audit downstream citations, and refresh the lineage record. |
| `--check-impact` | Audit every kNNowledge citation for drifted or missing anchors; exits non-zero on drift. |
| `--import-url "<url>"` | Download a resource into `sources/import/` as a write-once, UTC-suffixed family member. |
| `--scan-external` | Scan declared external watch roots; classify changes as `NEW`, `EVOLVED_DYNAMIC`, `STATIC_ALERT`, or `DISCONNECTED`. |
| `--watch-digest [--json]` | Render the read-only session-start digest of changed items awaiting a decision. |
| `--digest-decide "<key>" --status <ignore\|postpone\|import>` | Record a per-item digest decision in `.cognnitive/watch-digest.json`. |
| `--curate-csv "<path>" --key "<col>" [--dedup]` | Write a citation-ready RFC-4180 CSV to `artifacts/curated/` with a validated first-column key. |
| `--converge <family> [--json] [--plan]` | Produce a read-only convergence proposal for a timestamped source family. |
| `--converge-mark <family> --version <v>` | Mark a convergence proposal applied so re-running is a no-op. |
| `--promote-conv "<file>" --format full` | Promote a session transcript into `sources/conversations/`. |
| `--lineage [--check]` | Regenerate the lineage record, or report drift against the filesystem. |
| `--unlink "<path-or-stem>"` | Consent-gated purge of a source, its sidecar, and matching assets. |
| `--gc [--apply --yes --paths <p,...>]` | Dry-run list (or consent-gated delete) of superseded, uncited family members. |

For quick text extraction without ingestion:

```bash
node scripts/extract.js "<file>"
```

## Lineage synchronization

The lineage record (`<Project>_cogNNitive_NN.md`) keeps three sections in sync with the filesystem
on every build or refresh, using **idempotent replace**:

- `# NN Sources` — one entry per cognitivized raw file.
- `# NN ModelRecords` — one entry per kNNowledge document.
- `# NN Artifacts` — one entry per generated file that is a write-once family member.

`# NN Procedures` is different: it is an **append-only run log**. Scripted runs append their own
entry; the agent adds entries by hand for non-scripted research steps.

```bash
node scripts/index.js --lineage --check
```

reports drift, including hand-edited managed sections and hash mismatches.

## Replacing a domaiNN on the retired layout

Domains created before cognitivize-in-place used a mirrored normalized tree and snapshot archive.
The runtime never reads or writes those folders, and such a domain is not migrated in place.
Create a new domain and import the old one as a source with [nn-upgrade](nn-upgrade.md).

## See also

- [nn](nn.md) — the front controller that routes to this skill.
- [nn-innfo](nn-innfo.md) — the owner of procedure execution and kNNowledge authoring.
- [Sources, citations and lineage](../concepts/sources-citations-lineage.md) — the provenance model.
- [CLI and scripts](../reference/cli.md) — the wider script surface.
