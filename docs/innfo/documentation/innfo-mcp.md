# innfo-mcp

`@cognnitive/innfo-mcp` is an MCP (Model Context Protocol) server that wraps `@cognnitive/innfo-core` and exposes iNNfo models over the stdio transport, so AI coding agents — Claude Code, OpenCode, and others — can read, validate, and edit iNNfo models through structured tool calls instead of freeform file edits.

## Why an MCP server

- Validation stays **deterministic** — the `innfo-core` validator decides validity, not the calling LLM.
- Specification and template content is never duplicated into agent rules or config — it is always resolved live via `get_spec` / `get_template`.
- Spec and template resolution follows the model's `parent_spec` chain or an explicit URL — no hardcoded spec URLs.

## Tools

<!-- generated:mcp-tools (source: innfo-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->
**22** tools

| Tool | Description |
|------|-------------|
| `list_knowledge` | Scan the knowledge directory and list all iNNfo knowledge documents |
| `read_knowledge` | Parse and return an iNNfo knowledge document's full structure by its id. For surgical work prefer bounded slices: pass concept (+ element) with max_lines (default 150); slices over the cap truncate with truncated=true unless override_reason records a manual override |
| `get_spec` | Resolve the iNNfo specification (level-1) from an explicit url or from a loaded knowledge document. Provide either url or knowledge_id — the URL is never taken from an internal constant |
| `get_blueprint` | Resolve an iNNfo blueprint (level-2) from an explicit url or from a loaded knowledge document. Provide either url or knowledge_id — blueprint names/URLs are never hardcoded |
| `validate_knowledge` | Validate an iNNfo knowledge document against its blueprint. Provide id (file on disk) or content (raw text). The blueprint is resolved from the knowledge parent_spec.url, or from an optional blueprint_url |
| `apply_change` | Apply an intent-level change or changeset to knowledge documents and re-validate. Supports two-phase execution (validate, then persist atomically) from changes/ documents or bare intent operations. Every operation that mutates a Level-3 kNNowledge model (including freeze_slugs and bump_version) is synthesized into a sealed, recorded changeset; only generate_index and the Level-2 bluepriNNt authoring operations (add_concept, add_field, bump_version on a bluepriNNt) write directly. After an applied or partially applied changeset the domain console is regenerated and opened in a browser tab (pass open: false to skip). The result carries console (the regeneration outcome) and next_steps: you MUST relay next_steps.notice to the user. |
| `regenerate_console` | Regenerate the domain console (or one model-scoped console) and open it in a browser tab. Idempotent: an up-to-date console is reported as unchanged. Also the retry path after an apply whose console regeneration failed. The result carries console and next_steps: you MUST relay next_steps.notice to the user. |
| `propose_changeset` | Write a sealed changeset with status proposed under changes/ from a structured list of operations, then regenerate and open the domain console so the user can review it. It never applies the changeset. You derive the operations (update_field, add_element, remove_element, rename_element, rename_concept, update_matrix_cell, update_concept_text, remove_matrix, add_matrix, comment, add_model, freeze_slugs, bump_version); the tool does not interpret conversations. Validation runs before any write: an unknown model, an add_model on an existing model, or an operation missing required keys returns errors and writes nothing. The result carries changeset, console and next_steps: you MUST relay next_steps.notice to the user. When the user replies OK, call apply_change with next_steps.approve.changeset. |
| `init_domain` | Create an empty, conformant domaiNN container in a new directory: the canonical folders (kNNowledge/, sources/import/, sources/conversations/, conversations/, artifacts/, procedures/, staging/, changes/), a .gitattributes with * -text and a domaiNN_NN.md manifest listing no models. Refuses a directory that exists and is not empty. It is not a changeset; add models afterwards with an add_model changeset (propose_changeset) or init_knowledge. Migration recipe: init_domain for a NEW domain, import the old domain as a source (migrate-domain.js --import-as-source), derive add_model/add_element changes that cite it through sources::, propose_changeset, review, apply_change. |
| `validate_knowledge_url` | Validate an iNNfo knowledge document fetched from a URL without writing to disk. Accepts a knowledge URL and optional blueprint_url. Returns validation results. |
| `validate_blueprint` | Validate a Level 2 blueprint against its Level 1 parent spec with frontmatter level-2 auto-detection and parent resolution failure diagnostics |
| `init_knowledge` | Create a new level-3 knowledge document. Create-only: it is a wrapper over a one-change add_model changeset (written to changes/ and applied), so the creation is recorded as a change. It scaffolds canonical YAML frontmatter and a starter body (one section per Concept, no index block: taxonomy lives in the blueprint) from the resolved blueprint schema; an unresolvable blueprint fails and writes nothing. The model id is `<name>_<blueprint>` and carries no version (the version lives in knowledge_version): the server canonicalizes the id you pass (drops any `_V_x-y-z` token, appends `_<blueprint>` when missing) and returns the canonical id. An existing id fails with MODEL_EXISTS and the file is untouched (it never repairs or rewrites a document). Returns filePath, content and changeset on success (none of them on failure), plus console and next_steps: you MUST relay next_steps.notice to the user. |
| `list_blueprints` | List all available Level 2 spec blueprints across local domain, global environment, and installed skills |
| `hydrate_blueprint` | Hydrate (copy) a Level 2 spec blueprint from global or skill store into active domain blueprints directory |
| `sync_domain_manifest` | Reconcile the domain manifest ## NN Knowledge entries against discovered Level-3 knowledge files: additively appends new entries, archives entries whose file disappeared, and reactivates tool-owned entries whose file returned. Never touches hand-authored entries lacking the <!-- nn:auto --> ownership marker. Defaults to a dry run. |
| `check_domain` | Run one consolidated domain integrity pass over every Level-3 knowledge document: validate each against its blueprint and traceability, self-heal missing blueprint packages/specs (write-once hydration), classify each pinned blueprint version against the published catalog, compare the managed sections of the lineage record with a fresh projection (error LINEAGE_DRIFT in the lineage field of the report; read-only), and return one report with a per-knowledge status and a domain aggregate. Non-blocking and informational — validation failures never fail the tool. |
| `query_units` | Run a read-only content query over one workspace file and return matching knowledge-unit URIs: "path?filter=value[&filter...][&projection]". Filters use exact match (trimmed, case-insensitive); a trailing bare segment projects one column/field over the matches. Capped at 100 results with truncated=true. Pass max_values_chars to cap projected value characters for slice-only surgical reads. Never writes files. |
| `cognitivize` | Create or refresh the sidecar (`<file>_sidecar_NN.md`) of one raw file in place, so it can be cited. Markdown, CSV, and JSON files are handled directly; binary formats (PDF, DOCX, XLSX, images) are converted when the environment has converter adapters available. Paths outside the workspace, sidecars, and NN documents are rejected. |
| `sync_lineage` | Recompute the lineage projection from the workspace filesystem and regenerate the canonical lineage record (`<project>_cogNNitive_NN.md`) without requiring the CLI. Re-synchronizes # NN Sources, # NN ModelRecords, and # NN Artifacts sections. |
| `resolve_sources` | Read-only: resolve an element's citation-typed field(s) to their underlying file, anchor, and content. Returns one entry per citation reference: {path, anchor, exists, field, origin, author?, excerpt?, sha256?, version?, error?}. `origin` classifies who produced the cited content ("agent" \| "human" \| "document"), resolved from the `author::` of the `## NN Change:` block the citation anchors to. Omit fieldName to resolve across every citation-typed field on the element (name-based sources/source plus any schema-declared type:: citation field). Never writes files. |
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

### Canonical unit addresses

Console badges, draft pips and review actions share one address grammar, built and
parsed by `innfo-core`'s `unitAddress` / `parseUnitAddress`:

- `<modelId>@<element-slug>` — element
- `<modelId>@<element-slug>&<field>` — element value
- `<modelId>@concept:<concept-slug>` — concept section (and `&<field>` for a value)
- `<modelId>@<matrix-slug>&<row>&<col>` — matrix cell
- `specs/<family>@concept:<slug>` / `specs/<family>@matrix:<slug>` — definitions
- `domaiNN_NN.md` — domain; a bare model id — document; a path with extension — Source

Element, value and matrix-cell addresses stay byte-equal to a changeset `target::`,
so `update_matrix_cell` still resolves cells by row/column slug. Citation parsing
(`parseCitation`, `resolveUnitPath`) is deliberately unchanged.

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
