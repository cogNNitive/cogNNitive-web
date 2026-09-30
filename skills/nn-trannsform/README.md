# nn-trannsform

Agent skill for document ingestion, normalization, and template-based transformation. The agent orchestrates the full workflow: bootstraps a project, scans raw documents of various formats, normalizes them to Markdown, then transforms the consolidated content using its own LLM guided by user-defined templates.

## How it works

The skill ships with a Node.js CLI tool (`scripts/index.js`) that handles file operations — scanning directories, converting binary formats (docx, pdf, xlsx, html) to Markdown, downloading web resources, and maintaining an ingestion manifest. The actual content transformation and multi-step procedure orchestration is executed using the agent's LLM and `procedures_V_0-1-0_NN.md` specifications.

The workflow is:

1. **Bootstrap** — The agent creates a project directory with standard workspace folders: `sources/import/` (the user's raw external files dropbox), `sources/conversations/` (promoted transcripts), `sources/export/` (synthetic deliverables re-entering the pipeline), `sources/archive/` (version store for past normalized snapshots), `sources/nn/` (normalized Markdown mirroring active source subtrees), `conversations/` (raw session interaction logs), `models/` (iNNfo Level 3 models), `procedures/` (transformation specs), and `export/` (all generated output — deliverables and validation reports). Legacy `sources/original/` and `artifacts/` are supported via non-breaking fallback.
2. **Scan & normalize** — The CLI tool reads files directly from active source trees (`sources/import/`, `sources/conversations/`, `sources/export/`, recursively preserving subfolders), converts supported formats straight into the matching path under `sources/nn/`, writes the ingestion manifest (`sources/nn/index.md`), and generates/refreshes the **provenance model** (`<Project>_V_0-2-0_cogNNitive_NN.md`, or `<Project>_V_0-1-0_cogNNitive_NN.md`) whose Sources are auto-populated from active and archived files. Change detection is based on the sha256 recorded in normalized frontmatter; mutated sources trigger hash-idempotent snapshot-on-change into `sources/archive/<basename>/V<N>/<basename>.md`.
3. **Import from the web** — The user can paste a URL in chat; the agent runs `node scripts/index.js --import-url "<url>" --scan --src "<project-dir>"`, which downloads the resource straight into `sources/import/` (or fallback `sources/original/`) and immediately normalizes it, recording `source_url`/`downloaded_at` and metadata.
4. **Transform & Orchestrate** — The agent applies template-based transformations or multi-step procedure specs (`procedures_V_0-1-0_NN.md`) to generate models or deliverables in `export/`, and records each in the provenance model (Models/Artifacts/Procedures) with explicit lineage.
5. **Conversations Lifecycle & Promotion** — Interactive sessions silently reserve transcripts in `conversations/YYYY-MM-DD_HHmmss.md`, discard trivial sessions (<2 turns, 0 mutations), offer 3 title suggestions, and allow promoting transcripts to `sources/conversations/` as full verbatim transcripts (`_source.md`).
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
    scanner.js              Format detection, file conversion (txt, md, csv, json, html, docx, pdf, xlsx)
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

- **Draft** (`_draft.md`) — Includes source citations, revision notes, uncertainty markers, and GitHub-style alert blocks (`[!NOTE]`, `[!WARNING]`, `[!TIP]`). Intended for review.
- **Final** (`_v_0-1-0.md`) — Clean output with semantic versioning. Optionally includes source references.

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
