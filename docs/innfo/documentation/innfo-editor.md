# innfo-editor

**iNNfo Modeler** — the unified workspace editor for the cogNNitive ecosystem. Open any folder, edit iNNfo models with dedicated per-node views, and let AI agents drive the same workspace alongside you.

## End-to-end flow

1. **Open a workspace** — pick a folder via the File System Access API (`showDirectoryPicker`), resume a recent workspace from IndexedDB history, load a starter app (Business, Procedures, or Organization) or its sample model, or load a model directly from a URL.
2. **Single recursive parse** — the workspace is parsed once into a normalized node graph shared by every view.
3. **Edit** — each node opens the editing sub-view that fits its kind.
4. **Auto-validate** — every parse runs the `@cognnitive/innfo-core` validator (`validateFormatContent` / `validateModel`); results surface as a status badge in the header.
5. **Use AI** — click the "Use AI" button in the header to open the AI Guide view, with step-by-step instructions and copiable prompts (prefixed with `innfo:`) for connecting an external AI coding agent to the current workspace.
6. **Save** — writes back to disk with automatic backups and a version bump.

## Home

- **Open folder** — browse and open any local workspace directory.
- **Resume** — reopen a previously used workspace from IndexedDB history without re-prompting for folder access.
- **Starter apps** — bootstrap a new workspace from the Business, Procedures, or Organization starter, or load one of the live sample models (Ghostbusters, Code Review Process, Engineering Team).
- **Load from URL** — point the editor at a raw `_NN.md` model URL.

## Editing sub-views

The editor selects the editing surface per node kind:

| View | Purpose |
|------|---------|
| **TextEditor** | Markdown body editing |
| **TreeEditor** | Structural node editing |
| **BlockFeed / BlockSheet** | Concept element cards |
| **ConceptTableView** | Spreadsheet-like list editing for a concept's elements |

## Validation

Validation runs automatically on every parse via `@cognnitive/innfo-core`. A pass/warn/error badge in the `Header` opens the full `ValidationReport` overlay (backed by `ValidationService`), showing every diagnostic against the resolved app.

## Visualization and inspection

- **GraphViewer** — node and relationship graph visualization of the model.
- **MatricesGrid** / **MetamatrixConfig** — evaluable matrices between concepts.
- **ModelInfoPanel** — workspace and metamodel inspection.
- **ConsoleHubView** — embedded, sandboxed view of the workspace hub and each model's canonical template console (e.g. `procedures_console.html`).

Interactive domain visualizations and guided procedures are delivered as standalone template console artifacts (e.g. `assets/*_console.html`) rendered via `ConsoleHubView`.

## AI Guide View

The **"Use AI"** button in the header opens the AI Guide view (`AiWorkflowPanel`) — a step checklist for connecting an external coding agent (Claude Code, Google Antigravity, or OpenCode Desktop) to the current workspace, with copiable prompts prefixed with `innfo:` for each step.

## Development

```bash
# From repo root
npm run build -w @cognnitive/innfo-core   # Build dependency first
npm run dev -w @cognnitive/innfo-editor   # Start dev server

# Run tests
npm run test -w @cognnitive/innfo-editor
```
