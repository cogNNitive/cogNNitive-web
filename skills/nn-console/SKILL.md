---
name: nn-console
description: "Author, scaffold, customize, and regenerate iNNfo domain consoles and custom views. Guides reusable InnfoUI component usage (KuBadge, Table, KpiGrid, ElementCard) for Knowledge Units, DaisyUI styling patterns, the registerView contract, shared draft store mutation, and console compilation. Triggers: console, custom view, add view, new view, domaiNN_console, regenerate console, innfo-ui, triage view"
version: "V_1-0-0"
last_updated: 2026-10-17
empty_sections_mode: "ask-per-section"
license: MIT
metadata:
  source_type: "integrated"
  source: "https://github.com/cogNNitive/cogNNitive/tree/main/skills/nn-console"
  installed_at: "2026-10-17"
  depends_on:
    skills: ["nn-innfo"]
    mcp_servers: ["innfo-mcp"]
    cli_tools: ["scripts/export-console.mjs", "scripts/console-views.mjs"]
bundled_blueprints: []
---

# Skill: nn-console

## 0. Activation Gate
Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check). If already executed by `nn` in the current session, skip duplicate preflight execution.

---

## 1. Scope & Core Principles

This skill governs the lifecycle of **domaiNN consoles** (`domaiNN_console.html`) and specialized **views (tabs)**.

### Core Architecture Rules:
1. **Single-file Artifact**: A domaiNN console is a standalone, offline, self-contained HTML file compiled into `artifacts/<stem>_console/<stem>_console.html` (or `domaiNN_console.html` at domain root).
2. **Views are Modular Tabs**: A custom console is built by adding views. Views are discovered strictly by file-system convention; there is no manifest file.
3. **Write-once & Shared Changeset**: All editable views share the same live draft store and modal. Any proposed change lands in the domain's unified changeset.

---

## 2. UI & Design Rules: Knowledge Units & DaisyUI

### 2a. Knowledge Unit Presentation (Mandatory Component Reuse)
Whenever displaying, citing, or referencing a **Knowledge Unit** (element, concept, field, cell, marker, citation, status), the agent **MUST** reuse canonical `ctx.ui` (`InnfoUI`) components rather than crafting custom markup:
- **Entities & Badges**: Represent entities with `ctx.ui.KuBadge({ kind, id, name, value, ... })` or `ctx.ui.ElementPill(...)`.
- **Tabular Data**: Use `ctx.ui.Table({ columns, rows }, { onEdit, onSelect })`. It automatically renders proper `KuBadge` elements and handles styling.
- **Metrics & KPIs**: Use `ctx.ui.KpiGrid({ items: [...] })`.
- **Card Presentations**: Use `ctx.ui.ElementCard(...)`.
- **Action Triggers**: Use `ctx.ui.KuActions(...)` or `ctx.ui.icon(name, size)`.

### 2b. Custom UI & Styling (DaisyUI First)
When custom UI elements, panels, cards, filters, or layout controls are needed:
1. **Use DaisyUI**: Style elements using the **DaisyUI** component classes and Tailwind utility classes already embedded in `innfo-ui.css`:
   - **Buttons**: `btn`, `btn-primary`, `btn-sm`, `btn-outline`, `btn-ghost`.
   - **Containers & Cards**: `card`, `card-body`, `card-title`, `bg-base-100`, `bg-base-200`, `shadow-sm`, `rounded-lg`.
   - **Badges & Tags**: `badge`, `badge-primary`, `badge-outline`.
   - **Alerts & Notices**: `alert`, `alert-info`, `alert-warning`, `alert-error`.
   - **Form Controls**: `input input-bordered input-sm`, `select select-bordered select-sm`, `checkbox`, `textarea`.
   - **Layout & Spacing**: Flexbox and grid utilities (`flex`, `flex-col`, `grid`, `gap-2`, `gap-4`, `p-4`, `items-center`).
2. **No Ad-Hoc Raw CSS**: Avoid inline styles (`style="..."`) or injecting custom `<style>` tags when a DaisyUI or layout utility class accomplishes the design.

---

## 3. View Discovery & File Locations

Views are discovered automatically during console compilation:

| Type | Path Convention | Notes |
|---|---|---|
| **domaiNN View** | `<domainRoot>/consoles/views/<slug>.js` | Most common. Domain-specific (e.g. `triage.js`, `missing-descriptions.js`). |
| **bluepriNNt View** | `<blueprintDir>/assets/console-view-<slug>.js` | Shipped with a reusable blueprint package. Must be flat under `assets/`. |

### Script Constraints (Classic Scripts):
- **NO ES Modules**: Views are classic browser scripts wrapped in an IIFE. **Never** use `import` or `export` keywords (compilation will fail AST verification).
- **Slug Identity**: The view `id` is derived strictly from the filename slug (`/^[a-z0-9]+(-[a-z0-9]+)*$/`).
- **Reserved IDs**: Do not use `explorer`, `matrices`, or `review`.
- **Regeneration via MCP**: When authoring or editing custom views in an agent session, call the `regenerate_console` MCP tool (or CLI `scripts/export-console.mjs <domainRoot> --domain`) to compile views and refresh `domaiNN_console.html`.

---

## 4. Scaffolding CLI

Before manually authoring a view, execute the built-in scaffolding CLI:

```bash
# Domain custom view (default: table template)
node scripts/export-console.mjs <domainRoot> --new-view <slug> --template table --title "<Title>"

# Available templates: table, kpi, blank
node scripts/export-console.mjs <domainRoot> --new-view triage --template blank --title "Source Triage"
```

---

## 5. View Contract (`registerView`)

Every view file must call `registerView(def)`:

```javascript
registerView({
  title: 'Triage Fuentes',   // String visible in tab
  icon: 'filter',             // Icon slug from Lucide/InnfoUI
  order: 40,                  // Numeric tab order (lower appears first)
  kind: 'editable',           // 'editable' (can propose changes) or 'readonly' (isolated)
  mount(ctx) {
    // Render view inside ctx.container
  }
})
```

### The `mount(ctx)` Context:
The `ctx` object provides:
- `ctx.container`: DOM HTMLElement representing the tab panel.
- `ctx.doc`: The DOM `document` object.
- `ctx.ui`: The `InnfoUI` component library.
- `ctx.payload.model`: The active domain knowledge graph (elements, matrices, metadata).
- `ctx.payload.schema`: Active blueprint schemas and concept definitions.
- `ctx.store` *(editable only)*: Shared draft store (`propose()`, `drafts()`, `onChange()`).
- `ctx.modal` *(editable only)*: Shared review and edit modal (`edit()`, `comment()`).
- `ctx.mountHtml(html)` *(readonly only)*: Mounts static HTML into a sandboxed, CSP-hardened iframe.

---

## 6. Proposing Changes from a View

When user interaction in a view should modify domain data, NEVER write directly to disk files. Always propose drafts through `ctx.store.propose`:

```javascript
// Propose a correction on an existing element's field
ctx.store.propose({
  kind: 'correction',
  elementId: el.id,
  field: 'status',
  proposed: 'developing'
});

// Propose a reviewer comment
ctx.store.propose({
  kind: 'comment',
  elementId: el.id,
  comment: 'Identified during visual triage for transcription.'
});
```

Drafts appear immediately in the **Changes** tab of the console and are exported in the unified changeset.

---

## 7. Compilation & Regeneration Protocol

Whenever a view file is created or updated:

1. **Via MCP Tool (Recommended)**:
   Call `innfo-mcp.regenerate_console` with `{ domain: "<domainRoot>", open: true }`.
2. **Via CLI**:
   Run `node scripts/export-console.mjs <domainRoot> --domain`.
3. **Verify Integrity**:
   - Check stderr for size warnings (warn > 5 MB, fail > 15 MB).
   - Ensure AST syntax verification passed (no ES module syntax).
   - Report the generated artifact path to the user.
