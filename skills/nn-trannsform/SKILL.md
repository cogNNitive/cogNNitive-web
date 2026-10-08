---
name: nn-trannsform
description: "Bootstrap projects, scan raw documents, normalize them to Markdown with mandatory Source frontmatter, apply V_0-1-0 template-based transformations, and execute multi-step transformation procedures compliant with procedures_V_0-1-0_NN.md. Includes document ingestion, format conversion (txt, md, csv, json, docx, pdf, xlsx), procedure orchestration, and export generation. Triggers: trannsform, transform, workflow, pipeline, procedure, normalize, scan documents, document ingestion, document transformation, document processing, markdown conversion, project bootstrap"
version: "V_3-4-2"
last_updated: 2026-09-30
empty_sections_mode: "ask-per-section"
license: MIT
metadata:
  source_type: "integrated"
  source: "https://github.com/cogNNitive/cogNNitive/tree/main/skills/nn-trannsform"
  installed_at: "2026-08-02"
  depends_on:
    skills: ["nn-innfo"]
    mcp_servers: ["innfo-mcp"]
    cli_tools: ["scripts/index.js"]
bundled_blueprints: []
---

# Skill: nn-trannsform

## 0. Activation Gate
Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check). If already executed by `nn` in the current session, skip duplicate preflight execution.

## System & UX Governance (MANDATORY)

1. **Zero Unilateral Mutation (Consent First)**:
   - NEVER move, rename, or delete user files (e.g. moving PDFs into `sources/import/` or changing folder structure) without prior explicit confirmation from the user.
2. **Recommended Option First**:
   - In all decision menus, option `[a]` or `[1]` MUST carry the `(Recommended)` prefix.
3. **Multi-Selection Clarification**:
   - When choices are non-exclusive, include the notice: `"You can select one option or a combination (e.g. A and B)"`.
4. **Optimistic Execution & Reversibility Protocol (Informative Grace)**:
   - Safe, standard, and reversible actions (e.g. creating standard directory layout, cognitivizing documents in place, running scanner passes) MUST NOT block with confirmation prompts.
   - Announce intent with Informative Grace: `"Avanzando con [acción estándar]. Si preferís cambiar la ubicación o interrumpir, avisame antes de empezar."`
   - Explicit confirmation is reserved exclusively for destructive mutations (deleting orphaned sources, moving external user files without copy).
5. **Mandatory Canonical Toolchain for Normalization (No Manual Parsing Bypass)**:
   - NEVER manually calculate SHA-256 hashes, handcraft converted markdown tables, or manually edit source frontmatter to bypass layout mismatches.
   - When updating or refreshing a single source file, always use the atomic command: `node scripts/index.js --normalize-file "<source-path>" --src "<project-dir>"`. To cognitivize a file or a whole folder in place, use `node scripts/index.js --cognitivize "<file-or-dir>" --src "<project-dir>"` (recursive; skips sidecars and `staging/`).
   - The canonical toolchain guarantees write-once handling (imports, promotions and generated artifacts never overwrite: changed bytes add a new UTC-suffixed family member, identical bytes are deduplicated), sidecar refresh when a raw file's bytes change, downstream `[IMPACT WARNING]` audits, and lineage-record synchronization.

## Preflight Gate (MANDATORY — run before any transformation)

Before any other action:
1. Ensure the Integrity & Preflight Check above passed.
2. If the task involves iNNfo model output (business, procedure, catalog, etc.), verify Tier 2 model structure.
3. Read the report. If any blocker exists, ask the user before continuing. If all checks pass (or user overrides), continue.

This skill enables the agent to interactively guide the user through document ingestion, normalization, and transformation.

---

## Interaction Flow for Agent Execution

### 1. Project Initialization & Bootstrap

Initialize workspace directories optimistically with Informative Grace:
1. **Source Folder**: Detect or resolve original source files (`sources/import/` or specified source path).
2. **Project Name & Destination**: Standard location (recommend `%USERPROFILE%\Documents\_NN\[project-name]`).
Announce: *"Inicializando estructura de workspace estándar en `[destination]/[project-name]`. Voy a avanzar con esta preparación; si querés cambiar el nombre, ubicación o interrumpir, avisame antes de empezar."*
Proceed directly to create required directories without blocking.

#### Standard Workspace Directory Layout

Every project workspace MUST adhere to the following structure:

```
[project-name]/
├── AGENTS.md             # Workspace agent entrypoint (Session Start -> nn)
├── sources/
│   ├── import/           # The only raw-import location (PDF, DOCX, CSV, TXT, JSON, HTML...). Each raw file is
│   │                     # cognitivized in place: a co-located sidecar sits next to it, e.g.
│   │                     #   sources/import/clientA/report_20261001T101500Z.pdf
│   │                     #   sources/import/clientA/report_20261001T101500Z.pdf_sidecar_NN.md
│   └── conversations/    # Promoted transcripts (<slug>_<UTC stamp>.md, full transcript only) + their sidecars.
├── conversations/        # Workspace root: raw session interaction transcripts (YYYY-MM-DD_<slug>.md).
├── artifacts/            # Every generated output (deliverables, reports, dashboards, curated CSVs). Write-once:
│                         # each output is a new UTC-suffixed family member, e.g. artifacts/curated/prices_20261001T101500Z.csv.
├── staging/              # Scratch (extraction buffers such as Whisper SRTs or raw OCR). Created on demand; never scanned or cited.
├── assets/               # Binary / media attachments referenced by model elements
│                         # (image/file/video/audio fields). Not a copy of sources/.
├── kNNowledge/               # Structured semantic iNNfo Level 3 models (*_NN.md)
├── procedures/           # Reusable transformation procedure specs (*_procedures_NN.md)
├── traNNsformations/     # Transformation templates applied to sources
└── index.md              # Semantic workspace index (# NN index)
```

> [!NOTE]
> **Workspace AGENTS.md Scaffolding**: During workspace initialization (`bootstrapProject`), an `AGENTS.md` file is automatically scaffolded at the workspace root if not already present. It directs AI coding agents (Cursor, Claude Code, OpenCode, Codex, Antigravity) to immediately invoke `nn` at session start. Pre-existing `AGENTS.md` files are preserved intact without destructive overwrite.

> [!NOTE]
> **Workspace index.md Format**: The workspace `index.md` file (in the project root) uses standard Markdown links (`* [label](target.md)`), unlike the internal `# NN index` block of Level 3 models which uses WikiLinks (`* [[Concept]]`). When regenerated, the tool preserves existing custom/unknown lines, filters out duplicate or dangling links, and keeps the highest version if multiple versions of the same model base exist.


**Cognitivize in place.** Folders are write destinations; a file's role comes from its name. There is no mirror tree: the scanner (`--scan`) walks `sources/import/` and `sources/conversations/` recursively, and for every raw file without an up-to-date sidecar it writes a co-located `<file>.<ext>_sidecar_NN.md` through the one core operation `cognitivize` (the same one behind `--cognitivize <file|dir>` and the MCP `cognitivize` tool). The raw file is never moved, renamed or rewritten. Change detection uses the sha256 of the raw bytes recorded in the sidecar: when the bytes change, `--scan` refreshes the sidecar in place (no snapshot is taken), and the downstream `[IMPACT WARNING]` audit runs. Imports (`--import-url`, `--scan-external`) and conversation promotion are write-once: they never overwrite, a changed external file lands as a new UTC-suffixed family member (`<stem>_<YYYYMMDDTHHmmssZ>.<ext>`) and identical bytes are deduplicated. Files you drop into `sources/import/` by hand keep their names (unsuffixed family members). Retired layouts (the old normalized mirror, archive, export and original folders) are never read or written by the runtime; an old domaiNN is upgraded with `nn-upgrade` (see §2i). When a raw file disappears from disk, its sidecar is reported as an orphan warning and preserved; nothing is deleted without explicit user consent (`--unlink`, `--gc`), and a non-interactive `--scan` never mutates anything (Zero Unilateral Mutation).

Then run:
```bash
node scripts/index.js --src "<source-folder>" --dest "<destination-parent-folder>" --name "<project-name>"
```

---

### 2. Capability Scan & Source Ingestion Protocol (MANDATORY)

#### 2a-0. Canonical Source Taxonomy (Taxonomía Canónica de Fuentes)

The cogNNitive ecosystem operates on four clearly differentiated categories of sources:

1. **Primary Source (Fuente Primaria)**:
   - The immutable, raw original evidence or external watch root (`sources/import/`, `## NN External Watch Roots:`).
   - Encompasses documents (PDF, DOCX, XLSX, TXT, CSV, JSON), raw audio/video recordings (`.mp3`, `.wav`, `.m4a`, `.mp4`), and external file drops.
   - The scanner **never mutates, moves, or deletes** primary sources without explicit confirmation.
2. **Normalized / Secondary Source (Fuente Normalizada / Secundaria)**:
   - The co-located sidecar `<file>.<ext>_sidecar_NN.md` written next to a raw file when it is cognitivized. For binaries (PDF, DOCX, XLSX...) the sidecar body holds the normalized Markdown; for `md`, `csv` and `json` files the sidecar is bodyless metadata, because the raw file is already text.
   - Contains mandatory scanner traceability frontmatter (`source_file`, `sha256`, `size_bytes`, `source_format`, `normalized_at`).
   - Serves as the canonical citation target for Level 3 models: text-native files are cited directly (`sources:: [sources/import/notes.md@## Heading]`) and binaries through their sidecar (`sources:: [sources/import/report_20261001T101500Z.pdf_sidecar_NN.md@## Heading]`).
3. **Synthetic / Derived Source (Fuente Sintética)**:
   - An internal deliverable or consolidated summary re-ingested into the workspace graph: any file under `artifacts/` (or elsewhere) that is cognitivized in place. It is not moved or copied; its upstream lineage is the `sources` it declares (in its own frontmatter, or in its sidecar for non-markdown files).
4. **User Input / Interactive Source (Fuente de Entrada de Usuario)**:
   - In-line sources provided interactively during conversations (e.g. pasted data, calendars).
   - Marked with `source_file: "inline:..."` and exempt from physical file existence checks.

#### 2a-1. Cognitivize `sources/import/` in Place and Raw Media

**Primary raw files live in `sources/import/`. The tool never moves, renames, or deletes anything there; it reads the raw bytes and writes a co-located sidecar next to each file.**

1. **Check if `sources/import/` exists** inside the project directory. If not, ask the user and create it: `mkdir sources/import`
2. **Copy files into `sources/import/`** (preserve originals in-place; DO NOT move or delete user files without consent). The user may organize subfolders freely — sidecars simply sit next to their raw file, so no structure is mirrored anywhere. Files placed by hand keep their names; files brought in by `--import-url`, `--scan-external` or conversation promotion are written write-once with a UTC suffix.
3. **Raw media (audio/video/images)**:
   `.mp3`, `.wav`, `.png`, `.jpg` and similar files are not converted by the scanner: `--scan` reports them as skipped (needs manual action) and `nn-preflight` lists un-transcribed media as informational `raw-media`. To make the content citable, place a transcript or description as a text source (`.txt`, `.md`, `.srt`, `.vtt`...) in `sources/import/` and cognitivize it. Raw media is kept untouched; no automatic same-stem pairing exists.
4. **Sidecar with Origin-Metadata Frontmatter**:
   Every raw file that is cognitivized gets a sidecar `<file>.<ext>_sidecar_NN.md` (`level: 3`, `parent_spec` naming the `sidecar` bluepriNNt). `cognitivize` is the only writer: it owns `source_file`, `sha256` (of the raw bytes), `size_bytes`, `source_format`, `normalized_at` and, when a converter ran, `normalized_by`. A re-run with unchanged bytes writes nothing (`unchanged`); changed bytes rewrite the sidecar in place (`refreshed`). The body is present only for binary sources:

```yaml
---
# 1. Origin metadata (where this Source came from) — owned by `cognitivize`
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
# sources: [kNNowledge/x_business_NN.md]   # Optional: upstream of the subject (e.g. a curated CSV declares its raw file here)

# The keys below are optional descriptive metadata carried from the import or a raw .md frontmatter
# 2. Canonical Identity of THIS Document (Self BibTeX & PID)
canonical:
  title: "Strategic Vision and Market Positioning 2026"
  author: "Jane Doe"
  year: 2026
  doi: "10.1145/3290605.3300233"
  bibtex: |
    @misc{doe2026strategic,
      author = {Doe, Jane},
      title = {Strategic Vision and Market Positioning 2026},
      year = {2026}
    }

# 3. External works this Source cites (Primary vs Secondary)
cited_works:
  - id: "porter1985"
    citation: "Porter, M. E. (1985). Competitive Advantage."
    doi: "10.1002/smj.4250060308"
    is_primary: true
---
```

5. **Catalog Registration in `sources_NN.md` (SSOT Separation & Progressive Disclosure)**:
   Whenever a source is ingested or refreshed, the agent registers or updates its catalog entry in `sources_NN.md` conforming to `iNNfo/specs/bluepriNNts/sources/spec_NN.md`:
   ```markdown
   ## NN Source: <Title or Identifier>
   type:: local_file
   origin_uri:: sources/import/<file>
   raw_path:: sources/import/<file>
   format:: <pdf|docx|html|md|json|csv|audio|xlsx|repo>
   summary:: <Mandatory concise 1-2 sentence semantic summary of the source contents>
   tags:: [<tag1>, <tag2>]
   status:: ready
   source_model:: sources/import/<file>_sidecar_NN.md
   ```
   Sidecars maintain SSOT physical and cryptographic metadata (`sha256`, `source_file`, `normalized_at`, `normalized_by`), while semantic metadata and summaries reside in `sources_NN.md` to support Tier 2 zero-I/O querying.

> **⚠️ Staging Buffer Rule (`staging/`)**: Intermediate dumps from extraction tools (Whisper SRTs, raw OCR text) live temporarily in a `staging/` folder. Any `staging` path segment is strictly ignored by scanners, `--cognitivize` on a directory, the lineage projection and models, and write-once rules do not apply to it. `staging/` is **NEVER a valid citation target** (a citation into it reports `KU_EXCLUDED_PATH`: scratch, not missing).

> **⚠️ Citation Rule**: There is no `source_id`/`src-NNN` system and **no implicit path prefix**: a citation path is domaiNN-relative, written in full. Downstream Level 3 models reference sources directly by path and `@` anchor via `sources:: sources/import/<file>.md@## <Heading>` (CSV row/col: `sources/import/<file>.csv@RowID&col`; JSON Pointer: `sources/import/<file>.json@/items/0/name`, RFC 6901, starting with `/`, a literal `&` written `%26`; or file-level citation `kNNowledge/<model>_NN.md`; multiple values use list syntax: `sources:: [sources/import/a.md@## Intro, sources/import/b_20261001T101500Z.pdf_sidecar_NN.md@## Summary]`). Binary raw files cannot be cited directly: cite the binary's sidecar (citing `x.pdf@...` reports `KU_BINARY_TARGET` and suggests `x.pdf_sidecar_NN.md@...`). Line numbers are prohibited; heading text anchors, CSV row keys or JSON Pointers are mandatory.

> **Heading anchors use the human-readable heading text** (`@## Visión`) — the same rule the iNNfo editor and `@cognnitive/innfo-core` use.

#### 2a-1b. Cognitivize a File or a Folder (`--cognitivize`)

`--cognitivize` makes any file in the domaiNN citable without moving it:

```bash
node scripts/index.js --cognitivize "<file-or-dir>" --src "<project-dir>"
```

- Accepts a path inside the domaiNN (a file, or a directory processed recursively). Sidecars, other `_NN.md` documents, `staging/` and dot entries are skipped; a path outside the project is rejected.
- Injects the skill's converters (`lib/normalizer.js`) as the normalizer, so binaries (PDF, DOCX, XLSX) get a normalized body in their sidecar. `--scan` runs the same per-file operation over `sources/import/` and `sources/conversations/`, so the two always produce the same sidecar.
- Re-running on unchanged bytes writes nothing; changed bytes refresh the sidecar in place. The raw file is never modified.
- The innfo-mcp server exposes the same operation as the `cognitivize` tool for `md`, `csv` and `json` files only; for a binary it returns the non-throwing status `requires-cli` and writes nothing, so run the CLI for those.

#### 2a-1. Reviewer Feedback Ingestion (`sources/import/feedback/`)

Reviewer consoles export structured feedback JSON (see `iNNfo/specs/bluepriNNts/console/feedback.schema.json`). The drop zone is `sources/import/feedback/`. Files MUST be named `{PrimaryModel}_V_{version}_{slug}_feedback_{YYYYMMDD-HHMMSS}.json` (the name the console exports; it is kept as dropped).

1. **Routing**: during `--scan`, `.json` files under `import/feedback/` are validated as reviewer feedback and tagged `source_type: feedback`; every other `sources/import/` JSON file is cognitivized as a plain JSON source. The legacy Slack/Teams heuristic parser (`convertChatJson`) is removed — chat transcripts ingest via the `conversations/` lifecycle, never via `.json` heuristics.
2. **Validation**: each payload validates against the feedback contract (`meta` with `source_knowledge`, `source_knowledge_version` as `V_x-y-z`, `artifact`, `artifact_version`, `exported_at` ISO-8601 with seconds, `author`, `feedback_slug`, `viewer`; items with `id` as `fb-NNN`, `kind` as `correction|comment|new|delete`, non-empty `target`). Unknown draft fields are ignored. A file failing validation is **skipped and reported in the registry — the run never aborts**.
3. **Sidecar contract**: a valid feedback file gets a co-located, bodyless sidecar `<name>.json_sidecar_NN.md` with the standard origin frontmatter (`source_file`, `sha256`, `size_bytes`, `normalized_at`, `normalized_by`) **plus** `source_type: "feedback"`. An invalid file gets no sidecar.
4. **Citation**: the raw JSON is the citation target, addressed with a JSON Pointer per item: `sources:: sources/import/feedback/<file>.json@/items/0`. Downstream, the `reconcile_feedback_NN.md` procedure carries accepted items back into the model (staleness check, diff preview, `apply_change` per item, `validate_knowledge`, single patch bump, stable-name console regeneration).

#### 2a-2. Dynamic Sources & Impact Checking (`--check-impact` / `--normalize-file`)

When an existing source file is modified in `sources/import/`, its SHA-256 hash changes:
1. **Automatic Sidecar Refresh & Scan Warning**: `--scan` finds the stale sidecar (its `sha256` no longer matches the raw bytes), refreshes it in place (no snapshot, no archive copy), and immediately audits downstream models in `kNNowledge/`. If any model citation (`sources:: [sources/import/file.md@## Heading]`) points to an altered or removed section, an `[IMPACT WARNING]` is printed to the console. Sources that arrive as a new write-once family member (a re-import) keep the earlier member's bytes and sidecar intact, so citations to it stay valid; the impact checker then advises that a newer member exists.
2. **Atomic Single-Source Refresh Command**:
   To refresh a single file without a whole-workspace scan:
   ```bash
   node scripts/index.js --normalize-file "<source-path>" --src "<project-dir>"
   ```
   - Cognitivizes just that file in place (the same operation as `--scan` and `--cognitivize`), audits downstream citations for `[IMPACT WARNING]`, and updates the workspace lineage record.
   - There are no layout flags: sidecars are always co-located with their raw file.
3. **On-Demand Audit Command**:
   ```bash
   node scripts/index.js --check-impact --src "<project-dir>"
   ```
   Inspects every Level 3 model in `kNNowledge/`, parses all `sources::` citations, and verifies that the cited file exists (a domaiNN-relative path) AND that the cited anchor (`@## Heading`, `@RowID&col` or a JSON Pointer) is present. Reports errors for drifted or missing anchors along with fuzzy suggestions for closest matching headings. Exits non-zero if drift errors are detected.

#### 2a-3. External Watch Roots & Immutable Timestamped Sources (`--scan-external`)

Workspaces can watch external file drops without daemons or external mutations:

1. **Declarative Watch Roots in the Lineage record**:
   ```markdown
   ## NN External Watch Roots:
   - Root: "D:/External_Drops/Client_Inputs"
     Cadence: "dynamic"
     Recursive: true
     Filter: ["*.pdf", "*.docx", "*.xlsx", "*.csv", "*.json"]
   - Root: "Z:/Vault/Legal"
     Cadence: "static"
     Recursive: false
     Filter: ["*.pdf"]
   ```
2. **On-Demand Scan with Fast Path**:
   ```bash
   node scripts/index.js --scan-external --src "<project-dir>"
   ```
   Inspects external file metadata (`mtimeMs` and `size`) to avoid unnecessary disk I/O, hashes changed files, and classifies changes (`NEW`, `EVOLVED_DYNAMIC`, `STATIC_ALERT`, `DISCONNECTED`).
3. **Write-Once Timestamped Ingestion (UTC `YYYYMMDDTHHmmssZ`)**:
   Every imported file (any cadence: the `static`/`dynamic` cadence only sets how often a root is re-checked) is copied verbatim into `sources/import/<stem>_<YYYYMMDDTHHmmssZ>.<ext>` and cognitivized in place (`<stem>_<YYYYMMDDTHHmmssZ>.<ext>_sidecar_NN.md` next to it). Identical bytes are deduplicated against the latest member of the family; changed bytes add a new member and never touch the earlier ones, so existing citations remain permanently valid. Watch roots are only read, never written.
4. **Source Family Evolution & Impact Guidance**:
   The impact checker detects when models reference older snapshots of an evolving source family and advises when newer snapshots are available.

#### 2a-3b. Session-Start Digest (`--watch-digest` / `--digest-decide`)

A domaiNN that declares `## NN External Watch Roots:` can be checked **at session start**, not only before authoring. `nn` offers one digest of what changed and lets the user decide per item.

1. **Machine-readable scan** — `node scripts/index.js --scan-external --json` prints the classified roots as stable JSON (changed items only).
2. **Digest** — `node scripts/index.js --watch-digest [--json]` renders the scan filtered to items still awaiting a decision. It is **read-only**: it never writes to `sources/`. It prints nothing when no roots are declared, so it never blocks or delays session start.
3. **Decide** — `node scripts/index.js --digest-decide "<key>" --status <ignore|postpone|import> [--note "<text>"]`.
   - `ignore` — suppress this exact content (by sha256) permanently.
   - `postpone` — re-offer next session (default).
   - `import` — copy the file as a write-once, UTC-suffixed family member into `sources/import/` and cognitivize it.
4. **State** — decisions persist in `.cognnitive/watch-digest.json` (workspace-local cache; never a source, never a citation target), keyed by `(root, relPath, sha256)`. An edited file (new hash) is re-offered; an unchanged, ignored file is not.

#### 2a-4. Curating a CSV for Row-Level Citation

A raw CSV is cognitivized in place as it is (bodyless sidecar, the file itself is the citation target). Row-level citations (`sources:: [<path>.csv@<row-id>]`) require a unique, non-empty key in the CSV's **first column** (the row-id). When the raw CSV does not satisfy that, curate it:

```bash
node scripts/index.js --curate-csv "<path-to-csv>" --key "<column>" [--dedup] --src "<project-dir>"
```

- Moves the `--key` column to the first position (defaults to the first column), validates it, and writes an RFC-4180 CSV as a write-once artifact, `artifacts/curated/<stem>_<YYYYMMDDTHHmmssZ>.csv`, cognitivized in place (its sidecar declares the raw file as upstream via `sources`). The raw file is never modified, and curating unchanged input twice writes nothing new.
- Without `--dedup` it aborts when the key has empty or duplicate values; with `--dedup` it collapses duplicate-key rows (first wins) and drops empty-key rows, reporting both counts.
- Cite a row as `sources:: [artifacts/curated/<stem>_<YYYYMMDDTHHmmssZ>.csv@<row-id>]` (or `@<row-id>&<column>` for one cell); the command prints the exact citation to use. The iNNfo editor highlights the cited row when the source pill is clicked.
- The curated CSV appears in the lineage record as a Source whose `derived_from::` is the raw file, so the citable file is tracked together with its upstream.

#### 2a-5. Source Convergence Strategies (`--converge`)

A timestamped source **family** (the snapshot series sharing a filename stem) can
declare how a new snapshot converges into the model, right in the domaiNN
manifest:

```markdown
## NN Source Family: youtube_analytics_monthly
strategy:: upsert
key:: video_id
concept:: VideoMetric
```

- `cite-only` (default): no convergence; new snapshots are just citable.
- `upsert`: add new keys, **flag** changed values for review.
- `replace-values`: add new keys, **overwrite** changed values on apply.
- `key`: required unless `cite-only` — one single column/field, unique and
  non-empty across the snapshot. Missing/empty/duplicate key aborts with a
  non-zero exit and no proposal.
- `concept`: optional target Concept, needed to emit an apply plan.

Produce a read-only proposal (never writes `sources/` or the model):

```bash
node scripts/index.js --converge <family> [--json] [--src <project-dir>]
```

- Compares the two newest members of the family (`<family>_<UTC stamp>.csv|json`,
  ordered by name) under `sources/` and prints added / changed / removed keys.
- Removed keys are **flag-only** — never deleted.
- Reuses `.cognnitive/watch-digest.json`: an `ignore`d item is not re-proposed.
- **Idempotent**: an already-applied proposal (or identical snapshots) yields an
  empty proposal.

Add `--plan` to emit the exact `innfo-mcp_apply_change` operation plan (requires
`concept::`): one `add_element` per new key, one `update_field` per changed value
**only for `replace-values`** (`upsert` returns changed values under `review`),
and a single final `bump_version`. Removed keys are never an operation.

Apply the proposal through the reviewed mutation path (run the plan's `ops` via
`innfo-mcp_apply_change` + `validate_knowledge`), then mark it applied so re-running
is a no-op:

```bash
node scripts/index.js --converge-mark <family> --version <V_x-y-z> [--src <project-dir>]
```

#### 2a-bis. Garbage collection of superseded members (`--gc`)

Write-once families (`artifacts/`, `sources/import/`, console exports) only grow.
`--gc` is a dry run that lists the members that are neither the latest of their
family nor cited anywhere (a cited sidecar keeps its subject). It deletes nothing:

```bash
node scripts/index.js --gc [--json] [--src <project-dir>]
node scripts/index.js --gc --apply --yes --paths <path>[,<path>...] [--src <project-dir>]
```

`--apply` deletes only the confirmed `--paths` that are still in a freshly computed
plan (each with its sidecar) and refuses without `--yes` and `--paths`. CI never applies.

#### 2b. Progressive Disclosure & Source Naming Convention

To prevent LLM context degradation (*Lost in the Middle*) and maintain workspace clarity:
1. **Two-Tier Progressive Disclosure Contract**:
   - **Tier 1 (L1 - Executive Overview)**: an optional, agent-authored overview of a large source (500–1,500 words), kept as an ordinary file (not generated by the scanner). High-density semantic overview. Loaded by default for broad reasoning, discovery, and scope.
   - **Tier 2 (L2 - Granular Evidence)**: the cognitivized source itself (the raw `md`/`csv`/`json` file, or the binary's sidecar body with explicit headings). Loaded only on-demand when the agent needs to verify a specific claim or citation anchor.
2. **File Naming (names carry the structure, not folders)**:
   - Raw file: keeps the name it was dropped with, or `<stem>_<YYYYMMDDTHHmmssZ>.<ext>` when imported or promoted (UTC, write-once; a same-second collision adds `-2`, `-3`...). Family order is derived from the names alone.
   - Sidecar: `<file>.<ext>_sidecar_NN.md`, next to its raw file.
   - Knowledge documents (`*_NN.md`): the stem equals the bluepriNNt name or ends with `_<bluepriNNt>` (e.g. `Acme_business_NN.md`); the version is read from the `knowledge_version` frontmatter key, never from the file name.
   - A synthetic or derived source is a regular file cognitivized in place; its upstream lineage is its own `sources:` frontmatter (or its sidecar's `sources` for non-markdown files). No `is_synthetic` flag is stored.

#### 2c. Importing from the Web (URL / online PDF)

When the user pastes a URL in chat and wants it ingested:

1. Confirm the URL and target project with the user (Zero Unilateral Mutation still applies).
2. Run the download step, which saves the resource directly into `sources/import/` (same dropbox as manually-dropped files):
   ```bash
   node scripts/index.js --import-url "<url>" --scan --src "<project-dir>"
   ```
   `--import-url` downloads the resource (content type decides the extension, from the response's `Content-Type` header or the URL as fallback) and saves it under `sources/import/` as a write-once, UTC-suffixed family member (a repeat download of identical bytes is reported as already imported and writes nothing). Chained with `--scan`, it immediately cognitivizes it in place, recording `source_url`/`downloaded_at` (and, for HTML pages, best-effort `title`/`description`/`author` scraped from `<title>`, Open Graph tags, meta tags, and JSON-LD) in the sidecar frontmatter.
3. Confirm to the user that the file landed in `sources/import/`, then continue with the normal scan/cognitivize flow.
4. Downloaded PDFs go through the same existing `.pdf` handling as a manually dropped PDF (pdf-parse, on-demand install); if pdf-parse's own `info.Title`/`info.Author` are available, they populate the same optional sidecar frontmatter keys.

#### 2d. Lineage Record Filesystem Sync

The cogNNitive **lineage record** (a `*_cogNNitive_NN.md` document; a new one is created as `<Project>_cogNNitive_NN.md`, and an existing one is found by its role, never by its file name or version) keeps three of its four sections in sync with the workspace filesystem on every build/refresh (bootstrap, `--scan`, `--cognitivize`, `--import-url`, or the standalone `--lineage` flag). The projection walks the whole domaiNN (scratch such as `staging/` is skipped) and derives everything from names and sidecars, not from folders:

- **`# NN Sources`** — one entry per cognitivized raw file (the subject of each sidecar), carrying `raw_filename`, `raw_hash`, `normalized_content` (the sidecar), `version::` (its rank in its UTC-suffixed family, `V1`, `V2`...), `superseded_by::` (the next family member, when there is one) and `derived_from::` (the upstream the file declares via `sources`).
- **`# NN ModelRecords`** — one entry per knowledge document (`kNNowledge/*_NN.md`), with `model_ref`, `knowledge_version`, `model_template`, and `derived_from::` projected from that model's `sources::` Citations.
- **`# NN Artifacts`** — one entry per generated file that is a UTC-suffixed family member or declares upstream `sources` (e.g. everything the producers write under `artifacts/`), with `derived_from::` projected from its upstream citations. A hand-written Markdown file with neither is not an artifact node.

All three use **idempotent replace**: re-running regenerates them from the current filesystem state, no duplicate entries, and removed files drop out.

- **`# NN Procedures`** is an **append-only run log**. Each pipeline run (`--scan`, `--import-url`, `--apply`) appends one `## NN Procedures:` entry (`command`, `flags`, `run_at`, `inputs`, `outputs`). A section refresh never removes existing procedure entries. The agent should still add `## NN Procedures:` entries by hand for **non-scripted** research/analysis steps it performs itself. This is distinct from the `procedures/` directory (§6), which holds saved, user-authored orchestration specs.

Run `node scripts/index.js --lineage --check` (or `--check`) to report drift between the lineage record and the filesystem. It flags:
1. A missing record, or any model citation that fails validation (dangling `sources::` references, missing anchors);
2. Unlisted family members (a cognitivized file on disk with no element in `# NN Sources`) and projection diagnostics such as a sidecar whose `source_file` does not match the subject its name derives (`SIDECAR_SUBJECT_MISMATCH`);
3. Dangling `superseded_by::` pointers that resolve to no element or file;
4. Hash mismatches (a sidecar `sha256` that differs from the hash of its raw bytes);
5. **Lineage drift** (`LINEAGE_DRIFT`): a managed section of the record (`# NN Sources`, `# NN ModelRecords`, `# NN Artifacts`) that differs, byte for byte, from a fresh projection. The `# NN Procedures` journal and hand-authored blocks (such as `## NN External Watch Roots`) are never compared. Regenerate with `--lineage`. The MCP `check_domain` tool reports the same drift;
6. Orphaned sidecars (warning only: the raw file is gone, and the sidecar is preserved).
It exits non-zero when any error is found.

#### 2e. Binary / Batch Sources Not Covered by Auto-Sync

The filesystem sync (§2d) covers files that went through the standard `nn-trannsform` scan pipeline (`# NN Sources`) or that exist as real files under `kNNowledge/` / `artifacts/`. Two cases still need EXPLICIT manual registration by the agent:

1. **Formats routed to "skip" in the capability matrix** (§2g, e.g. legacy `.doc`): before skipping, ask the user whether to register a minimal `## NN Sources:` entry anyway (file name, format, and a note that content wasn't extracted) so the file isn't silently untraceable. Do not skip in silence.
2. **Large binary batches processed by a custom procedure outside the standard scan** (e.g. a photo-import workflow using Jimp/LLM Vision instead of `--scan`): once the procedure completes, the agent MUST register the batch in the Lineage record — either as one aggregate `## NN Sources:` entry (folder path, file count, date range, e.g. "79 photos in `sources/import/photos/`, imported 2026-08-12") when per-file entries would be unwieldy, or as individual entries when the batch is small (roughly under 10 files). This registration is the agent's responsibility, NOT automatic — a custom procedure is by definition not covered by the standard scan pipeline in §2d.

#### 2f. Conversation Transcripts & Knowledge Promotion Protocol

Interaction dialogues are first-class source streams. The transcript lifecycle follows:
1. **Silent Reservation**: When an interactive session begins, immediately allocate `conversations/YYYY-MM-DD_HHmmss.md` with initial frontmatter (`status: in_progress`, `turns: 0`, `mutations: false`).
2. **Zero Discard Policy**: Transcripts are retained unconditionally (Zero Discard). Trivial sessions (`turns < 2` AND `mutations === false`) are preserved in `conversations/` with `status: completed`.
3. **Title Suggestions & Renaming**: For non-trivial sessions, present 3 suggested title options with `[1] (Recommended) <slug>` plus a manual entry option. Update frontmatter (`status: completed`, `ended_at: <ISO>`) and rename the file to `conversations/YYYY-MM-DD_<slug>.md`.
4. **Promotion to Knowledge Sources (`sources/conversations/`)**: The raw transcript is **always** registered in `conversations/`. Promotion to a normalized source is optional — prompt the user with two choices only:
   - `[full] (Recommended) Full Transcript`: Promotes verbatim dialogue turns to `sources/conversations/<session-slug>_<YYYYMMDDTHHmmssZ>.md` (write-once, UTC stamp; promoting identical bytes again writes nothing, and existing `YYYY-MM-DD_*` transcripts stay as they are, never renamed).
   - `[none]`: Keeps the transcript in `conversations/` only, without promotion.
   - `_summary.md` promotion is **retired** — there is no executive-summary option and no `_summary.md` is produced.
5. **Author Naming (before promoting on the `[full]` path)**: Before writing the promoted transcript, present an author-naming step for the transcript's participants — human first, agent second. Suggest the human name from `git config user.name` and/or the OS user (`$env:USERNAME`), offer a manual entry and a skip, then confirm the agent's own tool id (e.g. `OpenCode`, `Antigravity`, `ClaudeCode`). The user may confirm or edit each suggestion before the promoted file is written:

   ```
   📋 Author naming (before promoting to sources/conversations/):
   Who is the human participant?
     [a] (Recommended) Architect (from git config user.name)
     [b] architect               (from $env:USERNAME / OS user)
     [c] enter a name manually
     [x] leave unnamed
   > a
   Your tool id (who produced your turns — e.g. OpenCode, Antigravity)?
     author-id: OpenCode   [Enter] confirm · type to edit
   > (confirm)
   ```

   A participant the user declines to name (or skips) renders the deterministic placeholder `unnamed`; promotion still completes — a missing name never blocks or aborts the promotion.
6. **Cognitivize in Place**: Promoted transcripts link to their origin (`origin_transcript: conversations/...`) and render each turn under a `## NN Turn NN: <author-id>` heading (1-based, 2-digit zero-padded: `## NN Turn 01: Architect`, …, `## NN Turn 100: X`). The promoted file is Markdown, so its co-located sidecar (`<slug>_<stamp>.md_sidecar_NN.md`) is bodyless and records `source_type: conversation_transcript`; the transcript itself is the citation target. The sequential number makes every turn heading unique and addressable under the workspace heading rules. Downstream models cite these sources using canonical `@` pointer grammar: `sources:: [sources/conversations/<session-slug>_<YYYYMMDDTHHmmssZ>.md@## NN Turn 01: Architect]`. Turn headings carry no `author::` key: embedded modification blocks self-describe as they travel across turns.
7. **CLI Promotion**:
   ```bash
   node scripts/index.js --promote-conv "conversations/YYYY-MM-DD_<slug>.md" --format full
   ```
   The CLI path is a mechanical verbatim copy (no turn headings added); the agent-driven path — naming step + turn-structured body passed as `fullContent` — produces the author-attributed promoted transcript.
8. **Agent Modification lineage**: When an agent turn in the transcript pasted a `## NN Agent Modification: <slug>` block (per `nn-innfo` §5), that heading survives promotion into the promoted transcript and is citeable via the `@` pointer grammar: `sources:: [sources/conversations/<session-slug>_<YYYYMMDDTHHmmssZ>.md@## NN Agent Modification: <scope>]`. This is how synthetic agent reasoning enters the workspace Lineage graph.

#### 2g. Capability Assessment — Decision Matrix

Present the diagnostic panel:

```
╔════════════╦══════════════════════╦══════════════════════════╗
║  Format    ║ Agent-native         ║ Node.js Library          ║
╠════════════╬══════════════════════╬══════════════════════════╣
║ txt        ║ ✅ Direct read       ║ —                        ║
║ md         ║ ✅ Direct read       ║ —                        ║
║ csv/json   ║ ✅ Direct read       ║ —                        ║
║ png/jpg    ║ ✅ Multimodal vision ║ sharp (npm local resize) ║
║ pdf        ║ ⚠️  Model-dependent  ║ pdf-parse (npm)          ║
║ docx       ║ ❌ Not available     ║ mammoth (npm)            ║
║ xlsx       ║ ❌ Not available     ║ xlsx (npm)               ║
║ doc        ║ 🚫 Unsupported       ║ (Legacy — skip to .docx)  ║
╚════════════╩══════════════════════╩══════════════════════════╝
```

Option selection format:

```
Format: PDF (1 file)
  [a] (Recommended) Node.js (pdf-parse) — local processing, reproducible, no extra token cost
  [b] Agent-native — depends on model, variable token cost
  [c] Skip this format

Which route do you prefer for PDF?
(Notice: You can select one option or a combination (e.g. A and B))
```

#### Quick text extraction (no ingestion)

When the agent model cannot read a binary directly (pdf/docx/xlsx) and a full ingestion is not needed, extract the text without running a scan:

```
node scripts/extract.js "<file>"
```

Prints only the extracted plain text to stdout (no frontmatter, no heading noise). The format is detected from the file extension (or forced with `--format pdf|docx|xlsx|doc|txt|md|csv|json|html`). The script lives inside the skill folder, so `pdf-parse`/`mammoth`/`xlsx` resolve against the skill's own `node_modules` — no `NODE_PATH` needed.

#### 2h. Atomic Source Unlink & Purge Protocol (`--unlink`)

When a user requests to remove, delete, or unlink a source completely from the workspace:
1. **Consent Gate**: Never delete files unilaterally. List the full cascade of files (matching raw files under `sources/`, each with its co-located sidecar, and cached assets under `assets/`) and request confirmation: `[a] (Recommended) Confirm purge | [x] Cancel`. The command itself deletes immediately, so the consent must be obtained first. To retire only superseded members of a write-once family, prefer the consent-gated `--gc` (§2a-bis).
2. **Deterministic Purge Execution**:
   ```bash
   node scripts/index.js --unlink "<path-or-stem>" --src "<workspace-dir>"
   ```
3. **Automated Cascade Cleanup**:
   - Removes the matching raw source file(s) under `sources/` together with each file's co-located sidecar, so no orphaned sidecar is left behind.
   - Removes matching assets in `assets/` (by stem or slug).
   - Re-scans, re-syncs the workspace `index.md`, and re-generates the lineage record in idempotent replace mode, eliminating all dangling references.

#### 2i. Upgrading a Domain Created with the Retired Layout

Domains created before cognitivize-in-place used a mirrored normalized tree and a snapshot archive under `sources/`, plus separate `original` and `export` folders (and a root `export/` folder for deliverables). The runtime of this skill never reads or writes those folders; `nn-preflight` reports such a domain as `legacy-layout`. Upgrade it with the consent-gated migrator of `nn-upgrade` instead of moving files by hand:

```bash
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir "<domain>" [--layout-only]
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir "<domain>" --apply --plan-hash "<hash>" --yes
```

- The first command is a dry run: it prints the moves, deletes (byte-identical duplicates and retired mirrors only), the sidecars to write, the citation rewrites and a `Plan Hash`. `--layout-only` limits it to the layout step. The apply command needs that hash (it refuses if the tree changed since the dry run) and `--yes`, and takes a full backup first (`--restore <backupDir>` rolls back).
- Existing archive snapshots are left in place as inert files that still resolve as plain paths; citations into them are reported as warnings and never rewritten, and nothing the user wrote is deleted.

---

### 3. Transformation & Level 3 Modeling (V_0-1-0 Unified Syntax)

#### 3a. Template Type: Markdown vs iNNfo V_0-1-0

When creating a new transformation, ask the user:

**"What kind of template do you want to create?"**

- **[a] (Recommended)** iNNfo V_0-1-0 template — structured model with typed concepts, fields, markers, and matrices
- **[b]** Generic Markdown template — free-form document with narrative sections
- **[x]** Cancel

*(Notice: You can select one option or a combination (e.g. A and B))*

#### 3b. Mandatory Citations in Level 3 Models (Bloque 2)

When transforming cognitivized sources into an iNNfo Level 3 Model:
- Frontmatter MUST use lightweight V_0-1-0 format (`level: 3`, `spec_version: "V_0-1-0"`, `parent_spec: { name, url }`).
- Body MUST use unified NN syntax: `# NN <Concept>`, `## NN <Concept>: <Element>`, `key:: value`.
- Every element MUST include explicit citation pointers via `sources::`. A citation path is domaiNN-relative and written in full: there is no implicit `sources/` prefix. Text-native files (`md`, `csv`, `json`) are cited directly; a binary is cited through its sidecar:

```markdown
# NN Stakeholders

## NN Stakeholders: Enterprise Clients
sources:: [sources/import/interview_transcript.md@## Key Clients, sources/import/notes_20261001T101500Z.pdf_sidecar_NN.md@## Stakeholder Priorities]
relationship_model:: B2B Long-term
```

A single value may be written without brackets: `sources:: sources/import/interview_transcript.md@## Key Clients`. There is no `src-NNN`/`source_id` system anywhere in this pipeline, and line ranges (`#L1-L10`) are strictly prohibited in favor of stable human-readable heading anchors (`@## Heading Text`), CSV row keys (`@RowID&col`) or JSON Pointers (`data.json@/items/0/name`).

#### 3c. Citation Format Selection

Before generating the document, prompt the user:

```
Select the citation and export format for the deliverable:

  [a] (Recommended) Standard Markdown Footnotes ([^1]) — clean superscript links with bottom references
  [b] Simple — inline attribution (— Source: filename, section)
  [c] APA 7th Edition — (Author, Year) in-text with trailing References
  [d] MLA 9th Edition — (Author, par. X) parenthetical with Works Cited
  [e] Chicago — Notes-Bibliography or Author-Date with Bibliography
  [f] IEEE — [N] numbered references with trailing References
  [g] Vancouver — numeric citation style with trailing References
  [h] BibTeX export — clean document + companion .bib file
  [i] No sources — clean text without citations or lineage markers
  [x] Cancel
```

---

#### 3d. Scored Source-to-Element Matching + Review Queue

When normalized sources must be mapped to Level 3 model elements (`sources::`), score deterministically first and spend LLM attention on doubtful pairs only:

1. **Score outside the hot loop**: run `scorePairs(sources, elements, { threshold })` from `scripts/lib/score-matcher.js` over every normalized source against the candidate elements. Scoring is a pure token-set similarity — zero LLM calls, zero context cost. `DEFAULT_THRESHOLD = 0.7`; change it only with measured fixture evidence showing systematic misclassification.
2. **Link confident pairs automatically**: every pair scoring at or above threshold links immediately; record `{ sourceId, elementId, score }` alongside the element's `sources::` pointer.
3. **Queue everything else — never silently exclude**: a source scoring below threshold for every element enters the review queue as `{ sourceId, candidates, reason, status: pending }` (`reason` is `below-threshold`, `no-overlap`, or `no-elements`; at most 3 top candidates). An unmatched source is queued, never dropped.
4. **Review doubtful pairs with the user**: present queued pairs top-candidates-first and confirm or reject each one:
   - `[a] (Recommended) Confirm link` — record the link together with the decision.
   - `[b] Reject link` — record the rejection; the source stays traceable, never silently excluded.
   - Undecided pairs stay `pending` across sessions — ending a review session never treats them as excluded.

   (Notice: You can select one option or a combination (e.g. A and B) when several pairs are confirmed in one pass.)
5. **Record the cost**: bulk scoring is deterministic (no LLM call to record); each LLM review turn is recorded as one `match`-intent call via the `usage-counters.js` convention (`scripts/lib/usage-counters.js`, JSONL append, OS temp directory by default). `match` calls MUST NOT carry raw sources — candidates only.

---

### 4. Citation & Lineage Protocol

Derived deliverables are generated in a single pass directly to `artifacts/[Deliverable_Name]_<YYYYMMDDTHHmmssZ>.md` (a new write-once family member: an existing file is never overwritten) without intermediate `_draft.md` files or non-standard `<!-- cite: ... -->` HTML comments:
1. **Direct Formatting**: Apply the citation format selected in §3c directly during generation per rules in `citations.md`.
2. **Source Traceability**: When citations are included (formats `[a]`–`[h]`), resolve claims directly from the Level 3 model's `sources::` pointers (domaiNN-relative paths such as `sources/import/<path>.md@## Heading`, or a binary's sidecar).
3. **Clean Presentation**: Format `[i]` (No sources) produces presentation-ready deliverables omitting all citation markers and reference lists.

---

### 5. Output Directory Conventions

| Entity Type | Target Directory | Example File Path | Notes |
|------|------|---------|-------|
| **Raw source + sidecar** | `sources/import/` | `sources/import/clientA/doc1_20261001T101500Z.docx` + `doc1_20261001T101500Z.docx_sidecar_NN.md` | Raw file untouched; co-located sidecar carries the origin frontmatter (and the normalized body for binaries) |
| **Model** (`*_NN.md`) | `kNNowledge/` | `kNNowledge/Acme_business_NN.md` | iNNfo Level 3 V_0-1-0 semantic models with `sources::`; the stem ends with the bluepriNNt name and the version lives in frontmatter |
| **Deliverable** | `artifacts/` | `artifacts/Executive_Summary_20261001T101500Z.md` | Clean deliverable in user-selected citation format; write-once, UTC-suffixed |
| **Validation Report** | `artifacts/` | `artifacts/Impact_Audit_report_20261001T101500Z.md` | Written by `--check-impact --report`; identical findings write nothing new |
| **Curated CSV** | `artifacts/curated/` | `artifacts/curated/prices_20261001T101500Z.csv` | Citation-ready CSV from `--curate-csv` |
| **Procedure Spec** | `procedures/` | `procedures/Document_Ingest_V_1-0-0_procedures_NN.md` | Procedure spec compliant with `procedures_V_0-1-0_NN.md` |
| **Transformation Template** | `traNNsformations/` | `traNNsformations/Summary.md` | Single-shot template applied with `--apply <name>` |

> **Templates vs Procedures (backlog 30, decided 2026-10-07: keep both).**
> `traNNsformations/` holds single-shot transformation templates (one input → one
> output, `--apply`). `procedures/` holds multi-step orchestrated SOPs (FSM over
> `Work` steps with `next::`). Rule of thumb: if it fits in one pass with no
> branching, it is a template; if it has steps, conditions, or tools, it is a
> procedure. Do not merge them and do not rename `traNNsformations/` — the CLI
> vocabulary (`--apply`) depends on it.

---

### 6. Execution of Saved Procedures (Orchestration)

When the user selects to execute a saved procedure from the `procedures/` directory:
1. **Load Procedure Spec**: Read the selected `*_procedures_NN.md` file.
2. **Build Execution Flow (FSM)**:
   - Scan all `Work` elements in the file.
   - Find the start step (a `Work` element that is not targeted by any other step's `next::` field).
   - Trace the sequence by following the `next::` pointers to build the ordered task list.
3. **Iterative Step Execution**:
   - For each step, present the step name, the required tool, input/output artifacts, and description.
   - **Autocompletion check**: Verify if the target output artifact already exists. If it does, inform the user and offer to mark the step as completed automatically.
   - Prompt the user to proceed with executing the task.
   - Upon completion, transition to the next step declared in `next::`.
   - Provide options to pause, override status, or restart the flow.
   - **Procedure adaptation**: If during execution the user changes tools, order, input/output artifacts, or adds/modifies tasks, the agent MUST capture these deviations as potential improvements to the procedure spec.

---

### 7. Post-Transformation Closing Protocol

At the end of transformation:
1. Summarize adjustments made.
2. Present options menu with `[a] (Recommended)` prefix.
3. Offer to save the procedure of the session if a new sequence was executed.
4. **Procedure updates**: If an existing procedure was executed and adaptations or improvements were introduced during the conversation, the agent MUST ask the user if they want to modify and update the original procedure file to incorporate these changes.
5. Print **Visual Expectation Checklist** (§12 of `nn-innfo`) when iNNfo models were created/edited.



## Core Rules

1. **Zero Unilateral Mutation**: NEVER move, rename, or delete files in `sources/import/` (or any user file) without prior explicit confirmation.
2. **Recommended Option First**: Always prefix option `[a]` with `(Recommended)`.
3. **Multi-Selection Notice**: Add `"You can select one option or a combination (e.g. A and B)"` when applicable.
4. **Mandatory Scanner Origin Metadata**: Every cognitivized raw file MUST have a co-located `<file>.<ext>_sidecar_NN.md` whose frontmatter records `source_file`, `sha256`, `size_bytes`, `source_format` and `normalized_at` (plus `normalized_by` when a converter ran, and optional `canonical` and `cited_works`). Only `cognitivize` writes sidecars; never handcraft one. No `source_id`/`src-NNN`.
5. **Mandatory Model Citations**: Level 3 elements MUST include `sources:: sources/import/<path.md>@## Heading` (or a list `sources:: [sources/import/a.md@## H1, sources/import/b.pdf_sidecar_NN.md@## H2]`) with a domaiNN-relative path and no implicit prefix; binaries are cited through their sidecar — no `src-NNN` IDs, no line-number ranges.
6. **V_0-1-0 Compliance**: Target iNNfo V_0-1-0 meta-template specification and unified NN syntax (`# NN`, `## NN`, `key:: value`).
7. **Saved Procedure Proactive Check**: When starting `nn-trannsform` or `nn`, check for existing procedures in `procedures/` and offer them as runnable options to the user before starting standard ingestion.
7a. **Lineage Record Sync**: `# NN Sources`, `# NN ModelRecords` and `# NN Artifacts` re-sync from the filesystem (sidecars, `kNNowledge/`, `artifacts/`) on every `--scan`/`--cognitivize`/`--import-url`/`--lineage` run — idempotent replace, removed files drop out. `# NN Procedures` is an append-only log: scripted runs (`--scan`, `--cognitivize`, `--import-url`, `--apply`) append their own entry; the agent still adds `## NN Procedures:` entries by hand for non-scripted research/analysis steps (see §2d). `node scripts/index.js --lineage --check` reports drift, including hand-edited managed sections.
8. **Prose Description in Level 3 Models**: The description of an element in a Level 3 model must NEVER be formatted as a `description::` property field. It must always be written as free-form Markdown prose below the `key:: value` fields list, separated from them by a blank line.
9. **Scored Matching, Never Silent Exclusion**: normalized sources map to model elements through `scorePairs` (`scripts/lib/score-matcher.js`, threshold 0.7); below-threshold pairs enter the review queue with a recorded decision, and undecided pairs stay queued across sessions.

