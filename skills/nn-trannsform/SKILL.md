---
name: nn-trannsform
description: "Bootstrap projects, scan raw documents, normalize them to Markdown with mandatory Source frontmatter, apply V_0-1-0 template-based transformations, and execute multi-step transformation procedures compliant with procedures_V_0-1-0_NN.md. Includes document ingestion, format conversion (txt, md, csv, json, docx, pdf, xlsx), procedure orchestration, and export generation. Triggers: trannsform, transform, workflow, pipeline, procedure, normalize, scan documents, document ingestion, document transformation, document processing, markdown conversion, project bootstrap"
version: "V_3-4-1"
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
Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check).

## System & UX Governance (MANDATORY)

1. **Zero Unilateral Mutation (Consent First)**:
   - NEVER move, rename, or delete user files (e.g. moving PDFs into `sources/import/` or changing folder structure) without prior explicit confirmation from the user.
2. **Recommended Option First**:
   - In all decision menus, option `[a]` or `[1]` MUST carry the `(Recommended)` prefix.
3. **Multi-Selection Clarification**:
   - When choices are non-exclusive, include the notice: `"You can select one option or a combination (e.g. A and B)"`.
4. **Optimistic Execution & Reversibility Protocol (Informative Grace)**:
   - Safe, standard, and reversible actions (e.g. creating standard directory layout, normalizing documents into `sources/nn/`, running scanner passes) MUST NOT block with confirmation prompts.
   - Announce intent with Informative Grace: `"Avanzando con [acción estándar]. Si preferís cambiar la ubicación o interrumpir, avisame antes de empezar."`
   - Explicit confirmation is reserved exclusively for destructive mutations (deleting orphaned sources, moving external user files without copy).
5. **Mandatory Canonical Toolchain for Normalization (No Manual Parsing Bypass)**:
   - NEVER manually calculate SHA-256 hashes, handcraft converted markdown tables, or manually edit source frontmatter to bypass layout mismatches.
   - When updating or refreshing a single source file, always use the atomic command: `node scripts/index.js --normalize-file "<source-path>" --src "<project-dir>"` (with `--flat` if preserving flat root layouts).
   - The canonical toolchain guarantees atomic snapshot archiving in `sources/archive/<basename>/V<N>/`, downstream `[IMPACT WARNING]` audits, and lineage-record synchronization.

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
├── AGENTS.md             # Workspace agent entrypoint (Session Start -> nn-start)
├── sources/
│   ├── import/           # External raw files (PDF, DOCX, CSV, TXT, JSON, HTML). Legacy sources/original/ supported via fallback.
│   ├── conversations/    # Promoted transcripts (*_source.md — full transcript only).
│   ├── export/           # Promoted deliverables re-entering pipeline (is_synthetic: true).
│   ├── archive/          # Version store for past normalized snapshots (sources/archive/<basename>/V<N>/<basename>.md).
│   └── nn/               # Normalized Markdown, mirroring the source subtrees
│                         # (e.g. sources/import/clientA/report.docx -> sources/nn/import/clientA/report.md).
├── conversations/        # Workspace root: raw session interaction transcripts (YYYY-MM-DD_<slug>.md).
├── export/               # Generated deliverables, reports, and dashboards (legacy artifacts/ supported via fallback).
├── assets/               # Binary / media attachments referenced by model elements
│                         # (image/file/video/audio fields). Not a copy of sources/nn/.
├── kNNowledge/               # Structured semantic iNNfo Level 3 models (*_NN.md)
├── procedures/           # Reusable transformation procedure specs (*_procedures_V_0-1-0_NN.md)
├── traNNsformations/     # Transformation templates applied to sources
└── index.md              # Semantic workspace index (# NN index)
```

> [!NOTE]
> **Workspace AGENTS.md Scaffolding**: During workspace initialization (`bootstrapProject`), an `AGENTS.md` file is automatically scaffolded at the workspace root if not already present. It directs AI coding agents (Cursor, Claude Code, OpenCode, Codex, Antigravity) to immediately invoke `nn-start` at session start. Pre-existing `AGENTS.md` files are preserved intact without destructive overwrite.

> [!NOTE]
> **Workspace index.md Format**: The workspace `index.md` file (in the project root) uses standard Markdown links (`* [label](target.md)`), unlike the internal `# NN index` block of Level 3 models which uses WikiLinks (`* [[Concept]]`). When regenerated, the tool preserves existing custom/unknown lines, filters out duplicate or dangling links, and keeps the highest version if multiple versions of the same model base exist.


There is no `sources/raw/` — the scanner reads directly from active source subtrees (`sources/import/`, `sources/conversations/`, `sources/export/`, with fallback to `sources/original/`) and writes directly to `sources/nn/`. Change detection uses the sha256 of the source file's content (recorded in the normalized frontmatter). When a source changes, `sources/archive/<basename>/V<N>/<basename>.md` preserves the previous normalized version before overwrite (snapshot-on-change, hash-idempotent). `sources/archive/` is excluded from every scanner walk and is not a default citation target (unqualified `sources::` paths resolve under `sources/nn/` only). When an original file disappears from disk, orphaned sources are archived and removed only with explicit user consent (`[a] Archive & remove`, `[b] Keep`, `[c] Skip`); in non-interactive CLI mode (`--scan`), they are reported as warnings and never mutated automatically (Zero Unilateral Mutation).

Then run:
```bash
node scripts/index.js --src "<source-folder>" --dest "<destination-parent-folder>" --name "<project-name>"
```

---

### 2. Capability Scan & Source Ingestion Protocol (MANDATORY)

#### 2a-0. Canonical Source Taxonomy (Taxonomía Canónica de Fuentes)

The cogNNitive ecosystem operates on four clearly differentiated categories of sources:

1. **Primary Source (Fuente Primaria)**:
   - The immutable, raw original evidence or external watch root (`sources/import/`, `sources/original/`, `## NN External Watch Roots:`).
   - Encompasses documents (PDF, DOCX, XLSX, TXT, CSV, JSON), raw audio/video recordings (`.mp3`, `.wav`, `.m4a`, `.mp4`), and external file drops.
   - The scanner **never mutates, moves, or deletes** primary sources without explicit confirmation.
2. **Normalized / Secondary Source (Fuente Normalizada / Secundaria)**:
   - The structured Markdown representation generated under `sources/nn/` mirroring the active source subtrees.
   - Contains mandatory scanner traceability frontmatter (`source_file`, `sha256`, `size_bytes`, `normalized_at`, and optional `media_file`).
   - Serves as the canonical citation target (`sources:: [path.md#heading-slug]`) for Level 3 models.
3. **Synthetic / Derived Source (Fuente Sintética)**:
   - Internal deliverables or consolidated summaries re-ingested into the workspace graph (`sources/export/`, marked with `is_synthetic: true`).
4. **User Input / Interactive Source (Fuente de Entrada de Usuario)**:
   - In-line sources provided interactively during conversations (e.g. pasted data, calendars).
   - Marked with `source_file: "inline:..."` and exempt from physical file existence checks.

#### 2a-1. Ingest `sources/import/` to `sources/nn/` and Binary Media Companion Linking

**Primary raw files live in `sources/import/` (or legacy `sources/original/`). The tool never moves, renames, or deletes anything there; it only reads.**

1. **Check if `sources/import/` exists** inside the project directory. If not (and no `sources/original/` exists), ask the user and create it: `mkdir sources/import`
2. **Copy files into `sources/import/`** (preserve originals in-place; DO NOT move or delete user files without consent). The user may organize subfolders freely — the scanner mirrors that structure into `sources/nn/`.
3. **Binary Media Companion Linking (Same Stem Pairing)**:
   When a raw binary media file (e.g. `.mp3`, `.wav`, `.m4a`, `.mp4`) exists alongside a text source (e.g. `.txt`, `.srt`, `.json`, `.docx`) with the same base name (`stem`), the scanner automatically links them:
   - The text file is converted/normalized to `sources/nn/.../<stem>.md`.
   - The companion media is recorded via `media_file` in the frontmatter:
     ```yaml
     ---
     source_file: "sources/import/sessions/Grabación (21).txt"
     media_file: "sources/import/sessions/Grabación (21).mp3"
     sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
     media_sha256: "a1b2c3d4e5f6..."
     normalized_at: "2026-09-13T12:00:00Z"
     ---
     ```
   - In iNNfo Modeler / UI, viewing this source automatically mounts an embedded audio/video player for direct playback and transcript verification.
4. **Scanner Normalization with Origin-Metadata Frontmatter**:
   Every normalized file generated under `sources/nn/` MUST include the mandatory, flat scanner traceability frontmatter — this schema is exact and must match the iNNfo editor:

```yaml
---
# 1. Origin metadata (where this Source came from)
source_file: "sources/import/interview_transcript.pdf"
media_file: "sources/import/interview_transcript.mp3"   # Optional companion media link (same stem)
sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
size_bytes: 1048576
normalized_at: "2026-08-02T13:30:00Z"
normalized_by: "traNNsform V_2-0-0"
staging_file: "sources/staging/interview_transcript.srt" # Optional link to intermediate buffer
is_synthetic: false                                     # Set to true ONLY if produced by an internal deliverable

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
   source_model:: sources/nn/<filename>.md
   ```
   Normalized files under `sources/nn/*.md` maintain SSOT physical and cryptographic metadata (`sha256`, `raw_path`, `normalized_at`, `normalized_by`), while semantic metadata and summaries reside in `sources_NN.md` to support Tier 2 zero-I/O querying.

> **⚠️ Staging Buffer Rule (`sources/staging/`)**: Intermediate dumps from extraction tools (Whisper SRTs, raw OCR text) live temporarily in `sources/staging/`. This directory is strictly ignored by scanners, git, and models. `sources/staging/` is **NEVER a valid citation target**.

> **⚠️ Citation Rule**: There is no `source_id`/`src-NNN` system. Downstream Level 3 models reference sources directly by filename via `sources:: <path>.md#<heading-slug>` (resolving relative to `sources/nn/`; multiple values use list syntax: `sources:: [a.md#intro, b.md#summary]`). Line numbers are prohibited; heading slugs are mandatory.

> **Heading slugs transliterate accents** (`## Visión` → `#vision`, not `#visin`) — the same rule the iNNfo editor and `@cognnitive/innfo-core` use. A workspace created before this change must re-run `--scan` so its `sources/nn/` anchors (and any `sources::` pointing at accented headings) line up.

#### 2a-1. Reviewer Feedback Ingestion (`sources/import/feedback/`)

Reviewer consoles export structured feedback JSON (see `iNNfo/specs/bluepriNNts/console/feedback.schema.json`). The drop zone is `sources/import/feedback/` (legacy `sources/original/feedback/` supported). Files MUST be named `{PrimaryModel}_V_{version}_{slug}_feedback_{YYYYMMDD-HHMMSS}.json`.

1. **Routing**: during `--scan`, `.json` files under `import/feedback/` (or `original/feedback/`) route to `convertFeedbackJson`, NOT the generic structured-data `convertJson` branch. Every other `sources/import/` JSON file keeps the generic path. The legacy Slack/Teams heuristic parser (`convertChatJson`) is removed — chat transcripts ingest via the `conversations/` lifecycle, never via `.json` heuristics.
2. **Validation**: each payload validates against the feedback contract (`meta` with `source_model`, `source_knowledge_version` as `V_x-y-z`, `artifact`, `artifact_version`, `exported_at` ISO-8601 with seconds, `author`, `feedback_slug`, `viewer`; items with `id` as `fb-NNN`, `kind` as `correction|comment|new|delete`, non-empty `target`, `status` as `pending|applied|rejected`). Unknown draft fields are ignored. A file failing validation is **skipped and reported in the registry — the run never aborts**.
3. **Frontmatter contract**: normalized feedback lands mirrored at `sources/nn/import/feedback/<name>.md` with the standard origin frontmatter (`source_file` pointing at the `sources/import/feedback/` origin, `sha256`, `size_bytes`, `normalized_at`, `normalized_by`) **plus** `source_type: "feedback"` and `is_synthetic: true`.
4. **Citation**: the normalized body renders one `### <fb-NNN> (<kind>, <status>)` heading per item, so agents cite items directly: `sources:: import/feedback/<file>.md#fb-001`. Downstream, the app's `apply_feedback_NN.md` procedure carries accepted items back into the model (staleness check, diff preview, `apply_change` per item, `validate_knowledge`, single patch bump, stable-name console regeneration).

#### 2a-2. Dynamic Sources & Impact Checking (`--check-impact` / `--normalize-file`)

When an existing source file is modified in `sources/import/` (or `sources/original/`), its SHA-256 hash changes:
1. **Automatic Snapshot & Scan Warning**: `--scan` creates a version snapshot under `sources/archive/<basename>/V<N>/<basename>.md`, normalizes the new version into `sources/nn/`, and immediately audits downstream models in `kNNowledge/`. If any model citation (`sources:: [file.md#heading-slug]`) points to an altered or removed section, an `[IMPACT WARNING]` is printed to the console.
2. **Atomic Single-Source Refresh Command**:
   To update or normalize a single file without a whole-workspace scan:
   ```bash
   node scripts/index.js --normalize-file "<source-path>" --src "<project-dir>"
   ```
   - Automatically detects if the file already exists in a legacy flat layout (`sources/nn/<basename>.md`) and preserves that destination to prevent breaking existing model citations.
   - Use `--flat` (or `--preserve-layout`) to explicitly force flat destination normalization.
   - Atomically creates the `sources/archive/<basename>/V<N>/` snapshot, updates the normalized Markdown, audits downstream citations for `[IMPACT WARNING]`, and updates the workspace lineage record.
3. **On-Demand Audit Command**:
   ```bash
   node scripts/index.js --check-impact --src "<project-dir>"
   ```
   Inspects every Level 3 model in `kNNowledge/`, parses all `sources::` citations, and verifies that the cited file exists under `sources/nn/` AND that the exact `#heading-slug` anchor is present. Reports errors for drifted or missing anchors along with fuzzy suggestions for closest matching headings. Exits non-zero if drift errors are detected.

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
3. **Immutable Timestamped Ingestion (`YYYYMMDD-HHmmss`)**:
   Dynamic sources are ingested into `sources/import/<stem>_<YYYYMMDD-HHmmss>.<ext>` and normalized into `sources/nn/import/<stem>_<YYYYMMDD-HHmmss>.md`. Existing citations remain permanently valid without broken links.
4. **Source Family Evolution & Impact Guidance**:
   The impact checker detects when models reference older snapshots of an evolving source family and advises when newer snapshots are available.

#### 2a-3b. Session-Start Digest (`--watch-digest` / `--digest-decide`)

A domaiNN that declares `## NN External Watch Roots:` can be checked **at session start**, not only before authoring. `nn-start` offers one digest of what changed and lets the user decide per item.

1. **Machine-readable scan** — `node scripts/index.js --scan-external --json` prints the classified roots as stable JSON (changed items only).
2. **Digest** — `node scripts/index.js --watch-digest [--json]` renders the scan filtered to items still awaiting a decision. It is **read-only**: it never writes to `sources/`. It prints nothing when no roots are declared, so it never blocks or delays session start.
3. **Decide** — `node scripts/index.js --digest-decide "<key>" --status <ignore|postpone|import> [--note "<text>"]`.
   - `ignore` — suppress this exact content (by sha256) permanently.
   - `postpone` — re-offer next session (default).
   - `import` — copy the file as an immutable timestamped snapshot into `sources/import/` and normalize it.
4. **State** — decisions persist in `.cognnitive/watch-digest.json` (workspace-local cache; never a source, never a citation target), keyed by `(root, relPath, sha256)`. An edited file (new hash) is re-offered; an unchanged, ignored file is not.

#### 2a-4. Curating a CSV for Row-Level Citation

The scanner normalizes a CSV to a Markdown *profile* (`sources/nn/import/<stem>.md`) — an ingestion aid, **not** a citation target. Row-level citations (`sources:: [<file>.csv@<row-id>]`) require the CSV itself under `sources/nn/`, with a unique, non-empty key in its **first column** (the row-id). Curate it with:

```bash
node scripts/index.js --curate-csv "<path-to-csv>" --key "<column>" [--dedup] --src "<project-dir>"
```

- Moves the `--key` column to the first position (defaults to the first column), validates it, and writes an RFC-4180 CSV to `sources/nn/import/`, mirroring the `sources/import/` subtree. The raw file is never modified.
- Without `--dedup` it aborts when the key has empty or duplicate values; with `--dedup` it collapses duplicate-key rows (first wins) and drops empty-key rows, reporting both counts.
- Cite a row as `sources:: [import/<stem>.csv@<row-id>]` (or `@<row-id>&<column>` for one cell). The iNNfo editor highlights the cited row when the source pill is clicked.
- The curated CSV is surfaced in the lineage record as `curated_csv:: sources/nn/...` on its source entry, so the citable file is tracked alongside its profile.

#### 2b. Progressive Disclosure & Source Naming Convention

To prevent LLM context degradation (*Lost in the Middle*) and maintain workspace clarity:
1. **Two-Tier Progressive Disclosure Contract**:
   - **Tier 1 (L1 - Executive Overview)**: `[Descriptor]_summary.md` (500–1,500 words). High-density semantic overview. Loaded by default for broad reasoning, discovery, and scope.
   - **Tier 2 (L2 - Granular Evidence)**: `[Descriptor]_source.md` (complete text with explicit headings). Loaded only on-demand when the agent needs to verify a specific claim or citation anchor.
2. **File Naming Suffixes (`sources/nn/`)**:
   - `_source.md`: Direct normalized representation of an original text document.
   - `_transcript.md`: Audio/video transcription normalized into coherent paragraphs.
   - `_summary.md`: High-density semantic distillation of a massive source.
   - `_schema.md`: Dataset profile and statistical summary for tabular data (CSV/Excel).
   - `_synthetic.md`: An internal deliverable re-ingested as a source (`is_synthetic: true`).

#### 2c. Importing from the Web (URL / online PDF)

When the user pastes a URL in chat and wants it ingested:

1. Confirm the URL and target project with the user (Zero Unilateral Mutation still applies).
2. Run the download step, which saves the resource directly into `sources/import/` (or legacy `sources/original/` — same dropbox as manually-dropped files):
   ```bash
   node scripts/index.js --import-url "<url>" --scan --src "<project-dir>"
   ```
   `--import-url` downloads the resource (content type decides the extension, from the response's `Content-Type` header or the URL as fallback), saves it under `sources/import/`, and — chained with `--scan` — immediately normalizes it into `sources/nn/` with `source_url`/`downloaded_at` (and, for HTML pages, best-effort `title`/`description`/`author` scraped from `<title>`, Open Graph tags, meta tags, and JSON-LD) merged into its frontmatter.
3. Confirm to the user that the file landed in `sources/import/`, then continue with the normal scan/normalize flow.
4. Downloaded PDFs go through the same existing `.pdf` handling as a manually dropped PDF (pdf-parse, on-demand install); if pdf-parse's own `info.Title`/`info.Author` are available, they populate the same optional frontmatter keys.

#### 2d. Lineage Record Filesystem Sync

The cogNNitive **lineage record** (`<Project>_V_0-2-0_cogNNitive_NN.md`, or `<Project>_V_0-1-0_cogNNitive_NN.md` on older workspaces) keeps three of its four sections in sync with the workspace filesystem on every build/refresh (bootstrap, `--scan`, `--import-url`, or the standalone `--lineage` flag):

- **`# NN Sources`** — one entry per active normalized file under `sources/nn/` (carrying `version::` and `archive_path::` when snapshots exist), plus one entry per archived snapshot under `sources/archive/` (carrying `status:: archived`, `version::`, and `superseded_by::` when superseded). Synthetic sources retain `is_synthetic: true`.
- **`# NN ModelRecords`** — one entry per `kNNowledge/*_NN.md`, with `model_ref`, `knowledge_version`, `model_template`, and `derived_from::` scraped from that model's `sources::` Citations.
- **`# NN Artifacts`** — one entry per deliverable file under `export/` (with fallback to `artifacts/`), with `derived_from::` read from the artifact's frontmatter (`model` + `knowledge_version`) or an HTML `export-meta` block. Note: the concept name `# NN Artifacts` remains identical in Level 2 and Level 3 lineage records.

All three use **idempotent replace**: re-running regenerates them from the current filesystem state, no duplicate entries, and removed files drop out.

- **`# NN Procedures`** is an **append-only run log**. Each pipeline run (`--scan`, `--import-url`, `--apply`) appends one `## NN Procedures:` entry (`command`, `flags`, `run_at`, `inputs`, `outputs`). A section refresh never removes existing procedure entries. The agent should still add `## NN Procedures:` entries by hand for **non-scripted** research/analysis steps it performs itself. This is distinct from the `procedures/` directory (§6), which holds saved, user-authored orchestration specs.

Run `node scripts/index.js --check` to report drift between the lineage record and the filesystem. It flags:
1. Missing models (`kNNowledge/*_NN.md` without entry) or dangling `derived_from` / `sources::` references;
2. Unlisted snapshots (`sources/archive/**` file with no `status:: archived` lineage element);
3. Dangling archive pointers (`archive_path::` or `superseded_by::` that does not resolve);
4. Hash mismatches (archived element `raw_hash` differs from snapshot frontmatter `sha256`);
5. Orphan archive chains (warning: archive directory with neither an active source nor an archived lineage element).
It exits non-zero when any error is found.

#### 2e. Binary / Batch Sources Not Covered by Auto-Sync

The filesystem sync (§2d) covers files that went through the standard `nn-trannsform` scan pipeline (`# NN Sources`) or that exist as real files under `kNNowledge/` / `artifacts/`. Two cases still need EXPLICIT manual registration by the agent:

1. **Formats routed to "skip" in the capability matrix** (§2g, e.g. legacy `.doc`): before skipping, ask the user whether to register a minimal `## NN Sources:` entry anyway (file name, format, and a note that content wasn't extracted) so the file isn't silently untraceable. Do not skip in silence.
2. **Large binary batches processed by a custom procedure outside the standard scan** (e.g. a photo-import workflow using Jimp/LLM Vision instead of `--scan`): once the procedure completes, the agent MUST register the batch in the Lineage record — either as one aggregate `## NN Sources:` entry (folder path, file count, date range, e.g. "79 photos in `sources/import/photos/`, imported 2026-08-12") when per-file entries would be unwieldy, or as individual entries when the batch is small (roughly under 10 files). This registration is the agent's responsibility, NOT automatic — a custom procedure is by definition not covered by the standard scan pipeline in §2d.

#### 2f. Conversation Transcripts & Knowledge Promotion Protocol

Interaction dialogues are first-class source streams. The transcript lifecycle follows:
1. **Silent Reservation**: When an interactive session begins, immediately allocate `conversations/YYYY-MM-DD_HHmmss.md` with initial frontmatter (`status: in_progress`, `turns: 0`, `mutations: false`).
2. **Trivial Discard Filter**: Upon session exit, if `turns < 2` AND `mutations === false`, delete the reserved transcript automatically to prevent workspace clutter.
3. **Title Suggestions & Renaming**: For non-trivial sessions, present 3 suggested title options with `[1] (Recommended) <slug>` plus a manual entry option. Update frontmatter (`status: completed`, `ended_at: <ISO>`) and rename the file to `conversations/YYYY-MM-DD_<slug>.md`.
4. **Promotion to Knowledge Sources (`sources/conversations/`)**: The raw transcript is **always** registered in `conversations/`. Promotion to a normalized source is optional — prompt the user with two choices only:
   - `[full] (Recommended) Full Transcript`: Promotes verbatim dialogue turns to `sources/conversations/<session-slug>_source.md`.
   - `[none]`: Keeps the transcript in `conversations/` only, without promotion.
   - `_summary.md` promotion is **retired** — there is no executive-summary option and no `_summary.md` is produced.
5. **Author Naming (before promoting on the `[full]` path)**: Before writing the `_source.md`, present an author-naming step for the transcript's participants — human first, agent second. Suggest the human name from `git config user.name` and/or the OS user (`$env:USERNAME`), offer a manual entry and a skip, then confirm the agent's own tool id (e.g. `OpenCode`, `Antigravity`, `ClaudeCode`). The user may confirm or edit each suggestion before the promoted file is written:

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

   A participant the user declines to name (or skips) renders the deterministic placeholder `unnamed`; promotion still completes — a missing name never blocks or aborts the `_source.md` write.
6. **Scanner Normalization**: Promoted transcripts link to their origin (`origin_transcript: conversations/...`), render each turn under a `## NN Turn NN: <author-id>` heading (1-based, 2-digit zero-padded: `## NN Turn 01: Architect`, …, `## NN Turn 100: X`), and are normalized into `sources/nn/conversations/` with `conversation_format: "full"` and `is_synthetic: false`. The sequential number makes every turn heading unique and addressable under the workspace heading-slug rules. Downstream models cite these sources using `sources:: [conversations/<file>.md#<anchor>]` for plain headings and the `@` pointer grammar for turn headings: `sources:: [conversations/<session-slug>_source.md@## NN Turn 01: Architect]`. The `#` fragment form MUST NOT be used for `## NN …: …` headings — the Concept/Element boundary in their slug contains `--`, which `parseSourceRef` rejects (`KU_MALFORMED`). Turn headings carry no `author::` key: embedded modification blocks self-describe as they travel across turns.
7. **CLI Promotion**:
   ```bash
   node scripts/index.js --promote-conv "conversations/YYYY-MM-DD_<slug>.md" --format full
   ```
   The CLI path is a mechanical verbatim copy (no turn headings added); the agent-driven path — naming step + turn-structured body passed as `fullContent` — produces the author-attributed `_source.md`.
8. **Agent Modification lineage**: When an agent turn in the transcript pasted a `## NN Agent Modification: <slug>` block (per `nn-innfo` §5), that heading survives promotion into the `_source.md` and is citeable via the `@` pointer grammar: `sources:: [conversations/<session-slug>_source.md@## NN Agent Modification: <scope>]`. This is how synthetic agent reasoning enters the workspace Lineage graph.

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
1. **Consent Gate**: Never delete files unilaterally. List the full cascade of files (raw files in `sources/import/`, companion media files, normalized Markdown in `sources/nn/`, cached assets under `assets/`, archive snapshots in `sources/archive/`) and request confirmation: `[a] (Recommended) Confirm purge | [x] Cancel`.
2. **Deterministic Purge Execution**:
   ```bash
   node scripts/index.js --unlink "<path-or-stem>" --src "<workspace-dir>"
   ```
3. **Automated Cascade Cleanup**:
   - Removes physical source files in `sources/import/` (and linked companion media if confirmed).
   - Removes normalized file(s) in `sources/nn/`.
   - Removes matching assets directory in `assets/<stem>/`.
   - Re-syncs `sources/nn/index.md` and workspace `index.md`.
   - Re-generates the lineage record (`<Project>_V_0-2-0_cogNNitive_NN.md`) in idempotent replace mode, eliminating all dangling references.

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

When transforming normalized Markdown into an iNNfo Level 3 Model:
- Frontmatter MUST use lightweight V_0-1-0 format (`level: 3`, `spec_version: "V_0-1-0"`, `parent_spec: { name, url }`).
- Body MUST use unified NN syntax: `# NN <Concept>`, `## NN <Concept>: <Element>`, `key:: value`.
- Every element MUST include explicit citation pointers via `sources::`. Unqualified filenames resolve canonically relative to `sources/nn/` (no redundant `sources/nn/` prefix required):

```markdown
# NN Stakeholders

## NN Stakeholders: Enterprise Clients
sources:: [interview_transcript.md#key-clients, notes_source.md#stakeholder-priorities]
relationship_model:: B2B Long-term
```

A single value may be written without brackets: `sources:: interview_transcript.md#key-clients`. There is no `src-NNN`/`source_id` system anywhere in this pipeline, and line ranges (`#L1-L10`) are strictly prohibited in favor of stable GitHub-compatible heading slugs (`#heading-slug`).

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

Derived deliverables are generated in a single pass directly to `export/[Deliverable_Name]_V_x-y-z.md` (or legacy `artifacts/` if existing) without intermediate `_draft.md` files or non-standard `<!-- cite: ... -->` HTML comments:
1. **Direct Formatting**: Apply the citation format selected in §3c directly during generation per rules in `citations.md`.
2. **Source Traceability**: When citations are included (formats `[a]`–`[h]`), resolve claims directly from the Level 3 model's `sources::` pointers (`<path>.md#<heading-slug>`, resolving canonically against `sources/nn/`).
3. **Clean Presentation**: Format `[i]` (No sources) produces presentation-ready deliverables omitting all citation markers and reference lists.

---

### 5. Output Directory Conventions

| Entity Type | Target Directory | Example File Path | Notes |
|------|------|---------|-------|
| **Normalized Markdown** | `sources/nn/` | `sources/nn/import/clientA/doc1.md` | Ingested source with scanner frontmatter, mirrors active source subtrees |
| **Model** (`*_NN.md`) | `kNNowledge/` | `kNNowledge/Business_Plan_V_1-0-0_NN.md` | iNNfo Level 3 V_0-1-0 semantic models with `sources::` |
| **Export Deliverable** | `export/` | `export/Executive_Summary_V_1-0-0.md` | Clean deliverable in user-selected citation format (legacy `artifacts/` alias supported) |
| **Validation Report** | `export/` | `export/Ingest_Audit_V_1-0-0_report.md` | Carries `type: report` in frontmatter; same folder as deliverables |
| **Procedure Spec** | `procedures/` | `procedures/Document_Ingest_V_1-0-0_procedures_NN.md` | Procedure spec compliant with `procedures_V_0-1-0_NN.md` |

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
4. **Mandatory Scanner Origin Metadata**: Normalized Markdown in `sources/nn/` MUST include scanner frontmatter (`source_file`, `sha256`, `size_bytes`, `normalized_at`, `normalized_by`, plus optional `staging_file`, `is_synthetic`, `canonical`, and `cited_works`). No `source_id`/`src-NNN`.
5. **Mandatory Model Citations**: Level 3 elements MUST include `sources:: <path.md#heading-slug>` (or a list `sources:: [a.md#slug, b.md#slug]`) resolving canonically against `sources/nn/` — no `src-NNN` IDs, no line-number ranges.
6. **V_0-1-0 Compliance**: Target iNNfo V_0-1-0 meta-template specification and unified NN syntax (`# NN`, `## NN`, `key:: value`).
7. **Saved Procedure Proactive Check**: When starting `nn-trannsform` or `nn-start`, check for existing procedures in `procedures/` and offer them as runnable options to the user before starting standard ingestion.
7a. **Lineage Record Sync**: `# NN Sources`, `# NN ModelRecords` and `# NN Artifacts` re-sync from the filesystem (`sources/nn/`, `kNNowledge/`, `export/`, fallback `artifacts/`) on every `--scan`/`--import-url`/`--lineage` run — idempotent replace, removed files drop out. `# NN Procedures` is an append-only log: scripted runs (`--scan`, `--import-url`, `--apply`) append their own entry; the agent still adds `## NN Procedures:` entries by hand for non-scripted research/analysis steps (see §2d). `node scripts/index.js --check` reports drift.
8. **Prose Description in Level 3 Models**: The description of an element in a Level 3 model must NEVER be formatted as a `description::` property field. It must always be written as free-form Markdown prose below the `key:: value` fields list, separated from them by a blank line.
9. **Scored Matching, Never Silent Exclusion**: normalized sources map to model elements through `scorePairs` (`scripts/lib/score-matcher.js`, threshold 0.7); below-threshold pairs enter the review queue with a recorded decision, and undecided pairs stay queued across sessions.
