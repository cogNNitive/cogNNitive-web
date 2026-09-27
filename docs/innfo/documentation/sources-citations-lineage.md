# Sources, Citations & Lineage

The cogNNitive pipeline tracks where knowledge comes from with **three** words,
one meaning each. Everything else ("provenance", "traceability", "grounding",
"3-tier lineage") is retired in favour of these:

| Term | What it is |
| :--- | :--- |
| **Source** | A normalised Markdown file under `sources/nn/`, plus its **origin metadata** in the frontmatter (`source_file`, `sha256`, `size_bytes`, `normalized_at`, `normalized_by`, and, for web imports, `source_url` / `downloaded_at`). One Source per original file. |
| **Citation** | A pointer from something to a Source section. Two altitudes: a **model citation** is `sources:: <path>.md#<heading-slug>` on a Level 3 element; an **artifact citation** is `[^1]` / APA / IEEE / … inside a generated deliverable. Same idea, different granularity. |
| **Lineage** | The single generated record `<Project>_V_x-y-z_cogNNitive_NN.md` that says, for every Source, Model, Artifact and pipeline run in the workspace, what it derives from. |

```
sources/import/        ──►   sources/nn/        ──►   models/*_NN.md      ──►   export/
sources/conversations/       (Sources: normalised     (model Citations:          (deliverables +
sources/export/               + origin metadata)       sources:: [a.md#x])        artifact Citations)
        └──────────────────────── recorded in the Lineage record ───────────────────────┘
```

---

## 1. Sources — ingestion & origin metadata

`nn-trannsform` scans active source subtrees (`sources/import/` with fallback to `sources/original/`, `sources/conversations/`, and `sources/export/`),
normalises each supported format to Markdown under the matching path in
`sources/nn/`, and writes a flat, deterministic YAML frontmatter:

- `sha256` of the **original** file's bytes — the change-detection key. Git is
  the *repo-wide* history mechanism; per-source snapshots live in
  `sources/archive/` (see §5).
- `source_file`, `size_bytes`, `normalized_at`, `normalized_by`.
- `is_synthetic:` — set to `true` on promoted deliverables under `sources/export/`.
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

## 2. Model Citations (`sources::`)

Level 3 model elements point at Sources with `sources::`:

```markdown
## NN Stakeholders: Enterprise Clients
sources:: [interview.md#key-clients, notes/kickoff.md#priorities]
```

Rules — enforced by `@cognnitive/innfo-core` (`parseSourceRef` /
`validateWorkspaceSources`) and surfaced by the `innfo-mcp` `validate_model`
tool in workspace mode, and in the editor:

- **Unqualified paths resolve under `sources/nn/`** — `report.md#financials` →
  `sources/nn/report.md`. An explicit `sources/nn/` prefix still works. A
  `models/…` path is a cross-model reference.
- **Heading-slug anchors only.** Line-range anchors (`#L12-L45`) and the legacy
  `src-NNN` wrapper are rejected as an `error`; an anchor that matches no
  heading in the target file is a `warning`.
- **Element-level, not claim-level.** One `sources::` covers every field of the
  element together. Per-claim Citation is an *artifact* concern (§4), never
  inside a `*_NN.md`.
- **Optional.** A greenfield / creative model needs no Citations; the agent only
  suggests `sources::` when `sources/nn/` actually has files.

---

## 3. The Lineage record

`buildProvenanceModel` (run on bootstrap and every `--scan` / `--import-url` /
`--lineage`) keeps the Lineage record synced with the filesystem:

| Section | Synced from | Semantics |
| :--- | :--- | :--- |
| `# NN Sources` | `sources/nn/` and `sources/archive/` frontmatter (active sources carry `version::` and `archive_path::`; archived sources carry `status:: archived`, `version::`, and `superseded_by::`) | idempotent replace |
| `# NN Models` | `models/*_NN.md` (`derived_from::` scraped from each model's `sources::`) | idempotent replace |
| `# NN Artifacts` | `export/` (with fallback to `artifacts/`) (`derived_from::` from frontmatter `model` + `model_version`, or an HTML `export-meta` block) | idempotent replace |
| `# NN Procedures` | one entry appended per run (`--scan`, `--import-url`, `--apply`): `command`, `flags`, `run_at`, `inputs`, `outputs` | **append-only log** |

Removed files drop out of the three replaced sections; the Procedures log is
never rewritten. Run `node scripts/index.js --check` to report drift — a model
with no entry, an artifact citing a model/version that no longer exists, a
`sources::` that resolves nowhere, an unlisted snapshot under `sources/archive/`,
a dangling `archive_path::` or `superseded_by::` pointer, a hash mismatch
between an archived element and its snapshot, or an orphan archive chain (warning);
it exits non-zero on any error.

---

## 4. Artifact Citations

`nn-trannsform` derives deliverables in a single pass straight to
`export/[Deliverable_Name]_V_x-y-z.md` (legacy `artifacts/` accepted as fallback;
validation reports go to the same folder, tagged `type: report` in frontmatter — there is no `exports/` or
`reports/` subfolder). The citation style is chosen per deliverable:

- `[a]` **Standard Markdown Footnotes** (`[^1]`) — the recommended default.
- `[b]` Simple inline attribution — `— Source: <filename>, section <name>`.
- `[c]`–`[g]` APA 7th / MLA 9th / Chicago / IEEE / Vancouver.
- `[h]` BibTeX — a clean body plus a companion `.bib` file.
- `[i]` No sources — a clean, unannotated deliverable.

Claims are resolved from the model's `sources::` pointers. When a Source's
`cited_works:` marks an external work `is_primary: true`, an APA rendering
attributes it as *(Porter, 1985, as cited in Doe, 2026)* rather than falsely
crediting the intermediate document.

Full per-format rules: `skills/nn-trannsform/citations.md`.

---

## Planned, not implemented

The following appear in older design notes and are **not** part of the shipped
pipeline. They are listed here only so nobody assumes the guarantee exists:

- **Open Knowledge Format (OKF) / W3C PROV-O / RO-Crate emission.** The
  `sources/nn/index.md` manifest is a plain ingestion log with YAML frontmatter;
  nothing emits PROV-O or RO-Crate.
- **A separate `artifacts/canonical/` view** with inline `^[...]` markers. Only
  the single-pass `artifacts/` output described in §4 exists.

---

## 5. Versioning: Git vs. the native semantic-versioning system

cogNNitive carries **two** versioning mechanisms that answer different
questions. They are **complementary, not substitutive** — understand the role
of each before relying on one for the other's job.

### Git / GitHub — repo-wide history and release anchors

Git records the state of the **whole repository** at any commit: branches,
merges, diffs, collaboration, and a remote backup on GitHub. It operates at the
granularity of the *tree* and of *commits*. It is the copy-of-record, the
global rollback mechanism, and the only mechanism that gives you **shared,
collaborative** history across machines and people.

Git also anchors **releases**: every published distribution gets a tag
(`innfo-mcp-v0.2.5`, `skills-v1.1.5`, `templates-v0.2.1`, `v0.2.5`), so a
version number always resolves to a specific point in history.

### The native semantic-versioning system — reference contracts

Every iNNfo artifact carries its version **in the filename and in the
frontmatter**, following the SemVer `V_MAJOR-MINOR-PATCH` convention defined at
Level 0 (`defiNNe`). The version *is* the identity of the artifact, and
versioned artifacts are **write-once**: you never edit a published
`V_0-2-0` in place — you create a new `V_0-2-1` file. This is what makes
references resolvable and auditable without consulting git history:

| Level | Artifact | Version identity |
| :--- | :--- | :--- |
| 0 | `defiNNe` | meta-spec; defines the versioning conventions themselves |
| 1 | Specifications | `iNNfo_V_0-1-0_NN.md`, `iNNfo_V_0-2-0_NN.md`, `iNNfo_V_0-2-1_NN.md` — `spec_version` in frontmatter |
| 2 | Apps | `business_V_0-2-0_NN.md` — `template_version` + `spec_version` in frontmatter; the app catalog (`catalog.json`) tracks every `versions[]` and the `adopted` one |
| 3 | Models | `<Name>_V_<x-y-z>_<template>_NN.md` — `model_version` in frontmatter; `parent_spec.url` pins the exact app version it conforms to |
| — | Sources | `sources/archive/<basename>/V<N>/<basename>.md` — per-source snapshots (see below) |

The same pattern extends to the **distribution layer**: the MCP server ships as
versioned bundles (`docs/innfo/cdn/innfo-mcp-v0.2.5.bundle.js`) and the CDN
`manifest.json` records `latest`. The resolver caches every resolved parent
under `specs/` **write-once** — if the versioned filename already exists it is
never overwritten, so a locally cached template is byte-identical to the
published one for that version.

The whole chain is *content-pinned by name*: a model's `parent_spec.url`
points at `…/business_V_0-2-0_NN.md`, which stays valid no matter how many
commits happen afterwards — the file at that version is never mutated.

### Native source archive — per-source lineage inside the workspace

The source-versioning archive (change `2026-09-06-source-versioning-archive`)
gives every **source** its own sequential version history **inside the
workspace**, independent of whether you ever commit. When a scan detects that a
source changed (its `sha256` differs from the active file), the scanner copies
the previous normalised version to `sources/archive/<basename>/V<N>/<basename>.md`
(semver `V1`, `V2`, …), hash-idempotent so no duplicate snapshots are ever
written. The Lineage record's `# NN Sources` carries the chain:
`version::`, `archive_path::`, `superseded_by::`.

```
sources/original/   ──►   sources/nn/            ──►   models/*_NN.md
  (immutable               (active Source,              (Citations)
   dropbox)                 changed in place)
        │  change detected
        └──────────────────────────────────────►  sources/archive/
        snapshot of previous normalized version      <basename>/V<N>/
```

The archive answers: *"what exact version of a source did model X see at time
T?"* — auditability **per source**, even if no commit was ever made. `sources/archive/`
is excluded from every scanner walk and is **not** a default Citation target
(unqualified `sources::` resolves under `sources/nn/` only).

### Dynamic Sources & The Impact Check

When a living source document changes over time (e.g. quarterly metrics, edited interview notes):
1. **Automatic Scan Warning**: When `node scripts/index.js --scan` creates an archive snapshot, it compares the heading structure of the archived vs new version. If any downstream model citations point to altered or missing heading slugs, the scanner immediately emits an `[IMPACT WARNING]`.
2. **On-Demand Citation Audit**: Running `node scripts/index.js --check-impact` (or `--impact`) traverses all models in `models/`, parses all `sources::` pointers, and verifies that both the file and the exact heading anchor exist in `sources/nn/`. Drifted citations are reported with fuzzy matching suggestions.

### Where they overlap — and the rule that keeps them apart

The overlap is **real**: the same files (apps, specs, models) are versioned
by both systems, and both speak SemVer — native `V_0-2-0` (underscores) vs. git
tags `v0.2.5` (dots). The bootstrap manifest itself records both on the same
entry (`version: "V_3-2-0"` next to `ref: "skills-v1.1.5"` and the `commit`
hash). That duality is the system working as designed.

| Concern | Git | Native semver |
| :--- | :--- | :--- |
| Granularity | whole repo / commit | per artifact (spec, app, model, source) |
| History mechanism | SHA object graph + tags | version-in-filename + write-once files |
| What a version means | a point in repo history | the immutable identity of the artifact |
| Requires a commit? | yes, per change | no — version exists in the file itself |
| Enforces immutability? | no | yes (write-once, by convention + validation) |
| Shared / collaborative? | yes (remote + branches) | no, per-artifact |
| Answers | how is / was the whole tree? | what exact version does this artifact / model / reference point to? |

They are **not** substitutes, for two reasons:

1. **Git does not enforce the write-once contract.** You *can* commit an edit
   to `business_V_0-2-0_NN.md` in place — Git has no opinion about that. The
   native versioning discipline (new version file, never mutate a published
   one) is exactly the guarantee Git cannot give; it is enforced by convention
   and by validation, not by the VCS.
2. **Native semver does not give you history or collaboration.** The version in
   the filename tells you *what* an artifact is, not *how it changed* or *who
   worked on it*. Only Git answers that.

The natural handshake between them:

- **Git transports and anchors.** The stable `raw.githubusercontent.com`
  URLs, the release tags, and the commit history are Git's job.
- **Native semver is the reference contract.** Models pin apps, apps
  pin specs, exports pin sources — each by an immutable version that must stay
  stable regardless of commit activity.
- **Releases couple them.** The release flow bumps the native version,
  regenerates the bundle/manifest, and creates the git tag — one release, two
  representations of the same version.

**Convention (the single source of truth):**

- **Git = history, collaboration and release anchors.** For branches, diff
  review, rollback, and shipping a versioned tag.
- **Native semver = the identity and the write-once contract.** For references
  that must resolve and stay valid (`parent_spec.url`, `sources::`, catalog
  entries) independent of commits.
- **Never edit a published versioned artifact in place.** When a spec,
  template, model or source changes, create its next version (or let the
  archive snapshot it) instead of rewriting the published file — otherwise the
  "immutable version" promise breaks even though git is healthy.

When both are present, version the whole repo with Git and let the native
semver carry the per-artifact identity and the per-source archive carry the
lineage; the archive tree is deliberately invisible to the scanner and to
citations, so the two coexist without polluting the pipeline.
