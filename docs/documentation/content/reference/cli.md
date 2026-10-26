# CLI and scripts

Reference for the command-line interfaces shipped with the ecosystem: the `nn-sources` ingestion CLI and the repository scripts that build, generate, and verify the project.

> [!NOTE]
> You normally never run these commands yourself — your agent does. This page is the reference for the command surface behind the agent-first guides (and for contributors). For everyday use, see the [How-To Guides](../how-to/import-sources.md).

## `nn-sources` CLI

The ingestion CLI lives in the `nn-sources` skill at `skills/nn-sources/scripts/index.js`. It normalizes raw documents into citable sources and keeps the lineage record in sync. Run it from the repository root, or from the skill's own directory as `node scripts/index.js`.

```bash
node skills/nn-sources/scripts/index.js <flags> --src <project-dir>
```

| Flag | Purpose |
|---|---|
| `--cognitivize <file\|dir>` | Create or refresh the co-located sidecar of a file, or of every file in a directory (recursive; skips sidecars, `_NN.md` documents, `staging/`, and dot entries). The raw file is never modified. |
| `--normalize-file <file>` | Atomic single-file refresh: cognitivize one file in place, audit downstream citations, and refresh the lineage record. |
| `--scan` | Walk `sources/import/` and `sources/conversations/` recursively and cognitivize every raw file without an up-to-date sidecar. Non-interactive: never mutates sources. |
| `--lineage --check` | Report drift between the lineage record and the filesystem (missing record, dangling or mismatched citations, unlisted family members, hash mismatches, `LINEAGE_DRIFT`). Exits non-zero on any error. |
| `--lineage` | Regenerate the lineage record's managed sections (`# NN Sources`, `# NN ModelRecords`, `# NN Artifacts`) from the current filesystem. |
| `--check-impact` | Verify every `sources::` citation in `kNNowledge/` resolves to an existing file and anchor; print `[IMPACT WARNING]` for drifted anchors. Exits non-zero on drift errors. |
| `--import-url <url>` | Download a resource into `sources/import/` as a write-once, UTC-suffixed family member. |
| `--scan-external` | Scan the `## NN External Watch Roots:` declared in the lineage record and classify changes (`NEW`, `EVOLVED_DYNAMIC`, `STATIC_ALERT`, `DISCONNECTED`). |
| `--watch-digest` / `--digest-decide <key> --status <ignore\|postpone\|import>` | Render, then decide, the session-start digest of pending external changes. |
| `--curate-csv <path> --key <column> [--dedup]` | Produce a citation-ready RFC-4180 CSV with a unique first-column key under `artifacts/curated/`. |
| `--converge <family> [--plan]` / `--converge-mark <family> --version <V_x-y-z>` | Compare the two newest members of a timestamped source family and emit a read-only proposal, optionally as a `propose_changeset` payload; mark a proposal applied. |
| `--gc [--json]` / `--gc --apply --yes --paths <paths>` | List superseded, uncited write-once family members (dry run), or delete the confirmed paths. |
| `--unlink <path-or-stem>` | Remove a source, its co-located sidecar, and matching assets, then regenerate the lineage record. Consent-gated. |
| `--promote-conv <file> --format full` | Promote a session transcript into `sources/conversations/`. |

The skill also ships `skills/nn-sources/scripts/extract.js` for quick text extraction without ingestion:

```bash
node skills/nn-sources/scripts/extract.js "<file>" [--format pdf|docx|xlsx|doc|txt|md|csv|json|html]
```

## Repository scripts

| Script | Purpose | Invocation |
|---|---|---|
| `scripts/generate-docsify-suite.mjs` | Generate the Docsify navigation and index artifacts (`_sidebar.md`, `_navbar.md`, `llms.txt`, `ai-index.yaml`) from a domain model. | `node scripts/generate-docsify-suite.mjs <model-path> [--output-dir <dir>] [--dry-run]` |
| `scripts/generate-docs-facts.mjs` | Regenerate the generated documentation regions (the `mcp-tools` inventory and the `skills-catalog`) from their canonical sources. | `node scripts/generate-docs-facts.mjs [--check] [--against <git-ref>]` |
| `scripts/export-console.mjs` | Compile the self-contained domain console (`domaiNN_console.html`) from a workspace's Level-3 kNNowledge documents. | `node scripts/export-console.mjs <workspaceRoot> --domain [--no-open]` |
| `scripts/verify.js` | Deterministic, offline verification runner: inventory parity, static type checks, and generated-manifest freshness. | `node scripts/verify.js [--fast] [--only=<substring>] [--jobs=N] [--verbose]` |
| `scripts/build-docs.mjs` | Build orchestration for the docs site: build `@cognnitive/nn-core` and `@cognnitive/nn-mcp`, then stage the blueprint catalog. | `node scripts/build-docs.mjs` (honors `INNFO_DOCS_OUT`) |
| `scripts/nn-session.mjs` | Manage per-session git worktrees for isolated development on `dev`. | `node scripts/nn-session.mjs start\|list\|status\|batch-status\|stop\|sweep [--id <id>] [--no-install]` |

## See also

- [MCP tools](mcp-tools.md)
- [Sources, citations and lineage](../concepts/sources-citations-lineage.md)
