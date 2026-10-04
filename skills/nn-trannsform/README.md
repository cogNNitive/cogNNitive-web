# nn-trannsform

Agent skill for document ingestion, normalization, and template-based transformation. The agent orchestrates the full workflow: bootstraps a project, scans raw documents of various formats, normalizes them to Markdown, then transforms the consolidated content using its own LLM guided by user-defined templates.

## How it works

The skill ships with a Node.js CLI tool (`scripts/index.js`) that handles file operations — scanning directories, cognitivizing files in place (converting binary formats such as docx, pdf and xlsx into the Markdown body of a co-located sidecar), downloading web resources, and keeping the lineage record in sync. The actual content transformation and multi-step procedure orchestration is executed using the agent's LLM and `procedures_V_0-1-0_NN.md` specifications.

The workflow is:

1. **Bootstrap** — The agent creates a project directory with standard workspace folders: `sources/import/` (the user's raw external files dropbox, the only raw-import location), `sources/conversations/` (promoted transcripts), `conversations/` (raw session interaction logs), `artifacts/` (every generated output: deliverables, validation reports, curated CSVs), `kNNowledge/` (iNNfo Level 3 models), `procedures/` (transformation specs) and `traNNsformations/`, plus a `.gitattributes` with `* -text` so raw-byte hashes survive a checkout. There is no mirror tree, snapshot archive or export folder under `sources/`.
2. **Scan & cognitivize in place** — The CLI tool reads files directly from the raw source trees (`sources/import/`, `sources/conversations/`, recursively), and writes a co-located sidecar (`<file>.<ext>_sidecar_NN.md`) next to each raw file: origin frontmatter (`source_file`, `sha256`, `size_bytes`, `source_format`, `normalized_at`) for every file, plus the normalized Markdown body for binaries (PDF, DOCX, XLSX). `--cognitivize <file|dir>` does the same for any file or folder in the domaiNN. Raw files are never moved or modified. Change detection is based on the sha256 of the raw bytes recorded in the sidecar: a changed file gets its sidecar refreshed in place. The CLI also generates/refreshes the **provenance model** (`<Project>_cogNNitive_NN.md`), whose Sources, Models and Artifacts sections are projected from the sidecars and file names; `--lineage --check` fails when the record drifts from a fresh projection.
3. **Import from the web** — The user can paste a URL in chat; the agent runs `node scripts/index.js --import-url "<url>" --scan --src "<project-dir>"`, which downloads the resource straight into `sources/import/` as a write-once, UTC-suffixed file (`<stem>_<YYYYMMDDTHHmmssZ>.<ext>`; identical bytes are deduplicated) and immediately cognitivizes it, recording `source_url`/`downloaded_at` and metadata in its sidecar.
4. **Transform & Orchestrate** — The agent applies template-based transformations or multi-step procedure specs (`procedures_V_0-1-0_NN.md`) to generate models or deliverables in `artifacts/` (write-once: each output is a new UTC-suffixed file, nothing is overwritten), and records each in the provenance model (Models/Artifacts/Procedures) with explicit lineage. Citations use full domaiNN-relative paths (binaries through their sidecar); `--gc` proposes, and only with explicit consent deletes, superseded members.
5. **Conversations Lifecycle & Promotion** — Interactive sessions silently reserve transcripts in `conversations/YYYY-MM-DD_HHmmss.md`, retain all sessions unconditionally under the Zero Discard policy, offer 3 title suggestions, and allow promoting transcripts to `sources/conversations/` as full verbatim transcripts (`<slug>_<YYYYMMDDTHHmmssZ>.md`, write-once, cognitivized in place).
6. **Post-Transformation Feedback Protocol** — If modifications to the transformation logic occurred during the conversation, the agent prompts the user to save a new `procedures` spec, update the existing one, or leave specs unchanged.

## Installation

Copy this folder to your agent's skills directory:

```bash
# Any agent that scans ~/.agents/skills/
cp -r nn-trannsform ~/.agents/skills/
```

Dependencies (`mammoth`, `minimist`, `prompts`) are installed automatically by the agent on first use — it detects the missing `node_modules/` directory and runs `npm install` inside the skill folder.

### Requirements

- **Node.js 18+** — Required for the CLI tool. The agent checks availability at runtime.
- **npm** — Bundled with Node.js, used for first-time dependency installation.

## File structure

```
nn-trannsform/
  SKILL.md                  Agent instructions — the agent reads this to learn the workflow
  package.json              Declares npm dependencies (mammoth, minimist, prompts)
  README.md                 You are here
  scripts/
    index.js                CLI entry point — bootstrap, scan, apply transformations, web import
    scanner.js              Format detection and the scan / cognitivize loop (txt, md, csv, json, html, docx, pdf, xlsx)
    extract.js              Quick text extraction (no ingestion) — prints a single file's plain text to stdout
    webImport.js            Downloads a URL straight into sources/import/ + HTML metadata extraction
    transformer.js          Template listing + a mechanical (verbatim-concat) fallback
    provenance.js           Builds/refreshes the lineage record + semantic index.md
    lib/conversations.js    Conversation session reservation, discard filtering, and promotion helpers
    config.js               Persistent config (last project path, default directories)
  examples/
    workflows/              Sample multi-step transformation workflows
```

## How dependencies are resolved

This skill follows the same pattern used by `anthropics/skills` (the most popular skill repository, 156k GitHub stars): scripts live inside the skill folder, and the agent resolves missing dependencies at runtime.

When the agent executes `node scripts/index.js` and encounters a `MODULE_NOT_FOUND` error, it runs `npm install` in the skill directory. The `package.json` exists to make this a single install command rather than installing each dependency individually. No `node_modules/` is committed to the repository — the `.gitignore` at the repo root excludes `skills/*/node_modules/`.

## Supported formats

| Format | Agent-native | CLI tool (Node.js) |
|--------|-------------|-------------------|
| txt    | ✅ Read directly | — |
| md     | ✅ Read directly | — |
| csv    | ✅ Read directly | — |
| json   | ✅ Read directly | — |
| html/htm | ✅ Read directly | zero-dep tag stripping |
| pdf    | ⚠️ Model-dependent | pdf-parse |
| docx   | ❌ Not available | mammoth |
| xlsx   | ❌ Not available | xlsx |

The agent presents a decision matrix to the user for non-plain-text formats, letting them choose between agent-native reading (may cost extra tokens) or local Node.js conversion.

## Output types

The transformation step produces two kinds of output:

- **Draft** (`_draft`) — Includes source citations, revision notes, uncertainty markers, and GitHub-style alert blocks (`[!NOTE]`, `[!WARNING]`, `[!TIP]`). Intended for review.
- **Final** — Clean output. Optionally includes source references.

Both are written under `artifacts/` as new UTC-suffixed files (for example `Summary_draft_20261001T101500Z.md`); an earlier output is never overwritten.

## For maintainers

### Adding a new format

1. Add the extension to `EXT_OK`, `EXT_PROMPT`, or `EXT_NO` in `scripts/scanner.js`.
2. Add a label to `EXT_LABELS` and a dependency entry to `EXT_DEPS` if needed.
3. Implement the conversion logic in `scanner.js`'s `scanAndProcess` function.
4. Update the capability matrix in `SKILL.md`.

### Updating the SKILL.md

The `SKILL.md` is the primary interface between the skill and the agent. It must remain in English frontmatter (for the skill loader) but the interaction content is in Spanish to match the user's language. When making changes:

- Keep all file paths relative to the skill directory (e.g., `scripts/index.js`, not absolute paths).
- The skill description in frontmatter must include relevant triggers for agent auto-discovery.

## Origin

This skill is part of the [`cogNNitive`](https://github.com/cogNNitive/cogNNitive) collection at [`skills/nn-trannsform/`](https://github.com/cogNNitive/cogNNitive/tree/main/skills/nn-trannsform).
