# innfo-mcp

`@cognnitive/innfo-mcp` is an MCP (Model Context Protocol) server that wraps `@cognnitive/innfo-core` and exposes iNNfo models over the stdio transport, so AI coding agents — Claude Code, OpenCode, and others — can read, validate, and edit iNNfo models through structured tool calls instead of freeform file edits.

## Why an MCP server

- Validation stays **deterministic** — the `innfo-core` validator decides validity, not the calling LLM.
- Specification and template content is never duplicated into agent rules or config — it is always resolved live via `get_spec` / `get_template`.
- Spec and template resolution follows the model's `parent_spec` chain or an explicit URL — no hardcoded spec URLs.

## Tools

<!-- generated:mcp-tools (source: innfo-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->
**17** tools

| Tool | Description |
|------|-------------|
| `list_models` | Scan the models directory and list all iNNfo models |
| `read_model` | Parse and return an iNNfo model's full structure by its id. For surgical work prefer bounded slices: pass concept (+ element) with max_lines (default 150); slices over the cap truncate with truncated=true unless override_reason records a manual override |
| `get_spec` | Resolve the iNNfo specification (level-1) from an explicit url or from a loaded model. Provide either url or model_id — the URL is never taken from an internal constant |
| `get_template` | Resolve an iNNfo template (level-2) from an explicit url or from a loaded model. Provide either url or model_id — template names/URLs are never hardcoded |
| `validate_model` | Validate an iNNfo model against its template. Provide id (file on disk) or content (raw text). The template is resolved from the model parent_spec.url, or from an optional template_url |
| `apply_change` | Apply an intent-level change to a model and re-validate. Returns updated model or validation errors |
| `validate_model_url` | Validate an iNNfo model fetched from a URL without writing to disk. Accepts a model URL and optional template_url. Returns validation results. |
| `validate_template` | Validate a Level 2 template against its Level 1 parent spec with frontmatter level-2 auto-detection and parent resolution failure diagnostics |
| `init_model` | Initialize or repair a level-3 model file: writes canonical YAML frontmatter and, when the file has no concept sections and the template resolves, scaffolds a starter body (index block + one section per Concept) from the template schema. Returns templateResolved / scaffolded / warnings. |
| `list_templates` | List all available Level 2 spec templates across local workspace, global environment, and installed skills |
| `hydrate_template` | Hydrate (copy) a Level 2 spec template from global or skill store into active workspace templates directory |
| `sync_workspace_manifest` | Reconcile the workspace manifest ## NN Models entries against discovered Level-3 model files: additively appends new entries, archives entries whose file disappeared, and reactivates tool-owned entries whose file returned. Never touches hand-authored entries lacking the <!-- nn:auto --> ownership marker. Defaults to a dry run. |
| `check_workspace` | Run one consolidated workspace integrity pass over every Level-3 model: validate each against its template and traceability, self-heal missing template packages/specs (write-once hydration), classify each pinned template version against the published catalog, and return one report with a per-model status and a workspace aggregate. Non-blocking and informational — validation failures never fail the tool. |
| `query_units` | Run a read-only content query over one workspace file and return matching knowledge-unit URIs: "path?filter=value[&filter...][&projection]". Filters use exact match (trimmed, case-insensitive); a trailing bare segment projects one column/field over the matches. Capped at 100 results with truncated=true. Pass max_values_chars to cap projected value characters for slice-only surgical reads. Never writes files. |
| `resolve_sources` | Read-only: resolve an element's citation-typed field(s) to their underlying file, anchor, and content. Returns one entry per citation reference: {path, anchor, exists, field, origin, author?, excerpt?, sha256?, version?, error?}. `origin` classifies who produced the cited content ("agent" \| "human" \| "reviewer" \| "document"), resolved from the heading the citation anchors to. Omit fieldName to resolve across every citation-typed field on the element (name-based sources/source plus any schema-declared type:: citation field). Never writes files. |
| `list_template_procedures` | List all procedures defined in a template and its transitively included templates up to depth 10 |
| `list_template_skills` | List all agent skills defined in a template and its transitively included templates up to depth 10 |
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
