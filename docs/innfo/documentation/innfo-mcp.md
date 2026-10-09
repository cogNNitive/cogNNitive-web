# innfo-mcp

`@cognnitive/innfo-mcp` is an MCP (Model Context Protocol) server that wraps `@cognnitive/innfo-core` and exposes iNNfo models over the stdio transport, so AI coding agents — Claude Code, OpenCode, and others — can read, validate, and edit iNNfo models through structured tool calls instead of freeform file edits.

## Why an MCP server

- Validation stays **deterministic** — the `innfo-core` validator decides validity, not the calling LLM.
- Specification and template content is never duplicated into agent rules or config — it is always resolved live via `get_spec` / `get_template`.
- Spec and template resolution follows the model's `parent_spec` chain or an explicit URL — no hardcoded spec URLs.

## Tools

<!-- generated:mcp-tools (source: innfo-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->
**21** tools

| Tool | Description |
|------|-------------|
| `list_knowledge` | Scan the knowledge directory and list all iNNfo knowledge documents |
| `read_knowledge` | Parse and return an iNNfo knowledge document's full structure by its id. For surgical work prefer bounded slices: pass concept (+ element) with max_lines (default 150); slices over the cap truncate with truncated=true unless override_reason records a manual override |
| `get_spec` | Resolve the iNNfo specification (level-1) from an explicit url or from a loaded knowledge document. Provide either url or knowledge_id — the URL is never taken from an internal constant |
| `get_blueprint` | Resolve an iNNfo blueprint (level-2) from an explicit url or from a loaded knowledge document. Provide either url or knowledge_id — blueprint names/URLs are never hardcoded |
| `validate_knowledge` | Validate an iNNfo knowledge document against its blueprint. Provide id (file on disk) or content (raw text). The blueprint is resolved from the knowledge parent_spec.url, or from an optional blueprint_url |
| `apply_change` | Apply an intent-level change or changeset to knowledge documents and re-validate. Supports two-phase transactional execution from changes/ documents or legacy intent operations. |
| `validate_knowledge_url` | Validate an iNNfo knowledge document fetched from a URL without writing to disk. Accepts a knowledge URL and optional blueprint_url. Returns validation results. |
| `validate_blueprint` | Validate a Level 2 blueprint against its Level 1 parent spec with frontmatter level-2 auto-detection and parent resolution failure diagnostics |
| `init_knowledge` | Initialize or repair a level-3 knowledge document file: writes canonical YAML frontmatter and, when the file has no concept sections and the blueprint resolves, scaffolds a starter body (index block + one section per Concept) from the blueprint schema. Returns blueprintResolved / scaffolded / warnings. |
| `list_blueprints` | List all available Level 2 spec blueprints across local domain, global environment, and installed skills |
| `hydrate_blueprint` | Hydrate (copy) a Level 2 spec blueprint from global or skill store into active domain blueprints directory |
| `sync_domain_manifest` | Reconcile the domain manifest ## NN Knowledge entries against discovered Level-3 knowledge files: additively appends new entries, archives entries whose file disappeared, and reactivates tool-owned entries whose file returned. Never touches hand-authored entries lacking the <!-- nn:auto --> ownership marker. Defaults to a dry run. |
| `check_domain` | Run one consolidated domain integrity pass over every Level-3 knowledge document: validate each against its blueprint and traceability, self-heal missing blueprint packages/specs (write-once hydration), classify each pinned blueprint version against the published catalog, compare the managed sections of the lineage record with a fresh projection (error LINEAGE_DRIFT in the lineage field of the report; read-only), and return one report with a per-knowledge status and a domain aggregate. Non-blocking and informational — validation failures never fail the tool. |
| `query_units` | Run a read-only content query over one workspace file and return matching knowledge-unit URIs: "path?filter=value[&filter...][&projection]". Filters use exact match (trimmed, case-insensitive); a trailing bare segment projects one column/field over the matches. Capped at 100 results with truncated=true. Pass max_values_chars to cap projected value characters for slice-only surgical reads. Never writes files. |
| `cognitivize` | Create or refresh the sidecar (`<file>_sidecar_NN.md`) of one raw markdown, CSV, or JSON file in place, so it can be cited. Binary formats (pdf, docx, images, ...) are never converted here: the result has status `requires-cli` and nothing is written (use the nn-trannsform CLI). Paths outside the workspace, sidecars, and NN documents are rejected. |
| `resolve_sources` | Read-only: resolve an element's citation-typed field(s) to their underlying file, anchor, and content. Returns one entry per citation reference: {path, anchor, exists, field, origin, author?, excerpt?, sha256?, version?, error?}. `origin` classifies who produced the cited content ("agent" \| "human" \| "reviewer" \| "document"), resolved from the heading the citation anchors to. Omit fieldName to resolve across every citation-typed field on the element (name-based sources/source plus any schema-declared type:: citation field). Never writes files. |
| `build_console_payload` | Compile canonical schema and model JSON slot strings for an iNNfo model console artifact. Returns escaped slot strings and outputPath. |
| `record_feedback_verdict` | Append a validated verdict entry to the root feedback-ledger.jsonl. Refuses writes if item is orphaned or stale without confirm_stale. |
| `evaluate_feedback_items` | Evaluate feedback items staleness and orphan status against current model. Appends stale entries to the root feedback-ledger.jsonl idempotently. |
| `list_blueprint_procedures` | List all procedures defined in a blueprint and its transitively included blueprints up to depth 10 |
| `list_blueprint_skills` | List all agent skills defined in a blueprint and its transitively included blueprints up to depth 10. Skills shipped inside a package under skills/<name>/SKILL.md are returned with embedded: true and a resolved absolute path. |
<!-- /generated:mcp-tools -->

### `apply_change` operations

`apply_change` accepts an `op` and operation-specific `args`:

- `add_concept`
- `add_field`
- `set_marker`
- `add_element`
- `update_field`
- `remove_element`
- `rename_concept`
- `rename_element`
- `generate_index`
- `bump_version`

Each call re-validates the model and returns either the updated model or the validation errors that blocked the change.

## Architecture

```
AI coding agent (Claude Code, OpenCode, ...) → innfo-mcp (MCP server, stdio) → @cognnitive/innfo-core
                                                        ↓
                                    Public iNNfo spec/template URLs (single source of truth)
```

## Running

```bash
# Build the server
npm run build -w @cognnitive/innfo-mcp

# The server communicates over stdio — register it with your MCP-compatible agent/client
```

By default the server scans models under the current working directory; override with the `INNFO_MODELS_DIR` environment variable.

See [OpenCode iNNfo Agent](opencode-innfo-agent) for a full walkthrough of connecting innfo-mcp to OpenCode Desktop.
