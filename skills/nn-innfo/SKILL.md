---
name: nn-innfo
version: "V_0-5-13"
last_updated: 2026-10-18
metadata:
  source_type: "original"
  mcp: "nn-mcp"
license: MIT
bundled_blueprints:
  - name: workspace_spec_iNNfo_NN
    path: templates/workspace_spec_iNNfo_NN.md
description: |
  Domain skill for creating, editing, validating, scaffolding, or discussing iNNfo models, apps, specializations, samples, or specification files. Includes the conversational Model Creation Wizard and Architecture Assistant. Triggers: innfo, iNNfo, info, /nn-innfo, model, modelo, template, plantilla, spec, wizard, *_NN.md.
  This includes but is not limited to:
  - Creating a new model step-by-step using apps (Business, Procedures, Organization, Metrics, Blank)
  - Creating or editing any file matching *_NN.md
  - Authoring or modifying business models, procedure models, or any model following an iNNfo app
  - Creating, editing, or modifying apps or specializations under docs/bluepriNNts/
  - Discussing the iNNfo specification, meta-templates, primitives, matrices, or naming conventions
  - Any conversation about how iNNfo works, how to use it, or how to structure iNNfo files
  - Executing procedures declared in a model
---

# iNNfo Skill

## 0. Activation Gate

1. **Activation Gate**: Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check). If already executed by `nn` in the current session, skip duplicate preflight execution.

<!-- generated:shared-rules (source: scripts/skill-shared-rules.md; run node scripts/build-skill-shared-rules.mjs) -->
### Shared Rules (generated — do not edit)

**System Governance & UX Protocol (MANDATORY)**

1. **Zero Unilateral Mutation (Consent First)**: NEVER move, rename, delete, or
   restructure user files without prior explicit confirmation.
2. **Recommended Option First**: In every decision menu, the computed default
   option carries the `(Recommended)` tag and is presented first (option `[a]`
   or `[1]`). When the choices are non-exclusive, also include the notice:
   *"You can select one option or a combination (e.g. A and B)"*.
3. **Conversations as Reference & Source (Zero Discard)**: Allocate the session
   transcript in `conversations/` silently at session start (`status: in_progress`)
   and auto-promote it at close (the user may opt out with `[none]`). All sessions
   are retained unconditionally.
4. **Optimistic Execution & Reversibility**: Proceed immediately on safe,
   standard, reversible actions (e.g. creating the standard directory layout,
   cognitivizing documents in place) without redundant blocking confirmations.
   Reserve explicit confirmation for destructive mutations only.

**Conversation Lifecycle & Closing UX**

1. **Silent reservation**: at session start, silently allocate
   `conversations/YYYY-MM-DD_HHmmss.md` with `status: in_progress`.
2. **Close triggers**: conclude the session on natural-language triggers such as
   `/close`, `cerrar`, `terminar sesión`, `listo por hoy`, or `done`.
3. **Zero Discard**: transcripts are retained unconditionally.
4. **3-title prompt**: on close, present 3 suggested titles plus a manual entry
   option `[m]`, e.g. `[1] user-auth-design`, `[2] api-gateway-refactor`,
   `[3] telemetry-setup`.
5. **Finalize**: rename the file to `conversations/YYYY-MM-DD_<slug>.md`, set the
   frontmatter `title` to the chosen title, `status: completed`, and `ended_at`
   to the ISO 8601 completion timestamp.
6. **Promote**: auto-promote the transcript to `sources/conversations/` (announce
   it; `[none]` opts out).

**Canonical Source Taxonomy & Citation Contract**

1. **Primary Source**: the immutable, original evidence files under
   `sources/import/` or watched via `## NN External Watch Roots:` (read-only).
2. **Normalized / Secondary Source**: cognitivized in place — a co-located sidecar
   `<file>.<ext>_sidecar_NN.md` carries origin metadata (`source_file`, `sha256`,
   `size_bytes`, `source_format`, `normalized_at`); binary sources also carry the
   normalized Markdown body. Text-native files (`md`, `csv`, `json`) are cited
   directly; binaries are cited through their sidecar.
3. **Synthetic Source**: derived deliverables under `artifacts/`, cognitivized in
   place; their upstream is the `sources` they declare.
4. **User Input Source**: in-line interactive input (`source_file: "inline:..."`),
   exempt from physical disk file existence.

Citations use the pointer grammar `sources:: [<path>@<unit>, ...]` — ALWAYS a
bracketed list, with a domaiNN-relative path written in full (no implicit prefix).
A `<unit>` is `@## Heading` (Markdown), `@RowID&col` (CSV), or
`@/items/0/name` (JSON Pointer, RFC 6901). No `src-NNN` IDs, no line-number
ranges, and never a `staging/` target.

**Informative Grace**

Safe, standard, reversible actions proceed without a blocking confirmation.
Announce the action in the user's active session language, then continue; the
user may interrupt. Example (English): *"Proceeding with the standard {action}.
If you'd prefer a different location or want to stop, tell me before I begin."*
<!-- /generated:shared-rules -->

---

## Activation Contract

Activates when the user invokes `/nn-innfo`, mentions domain keywords `innfo`, `iNNfo`, `model`, `template`, references files matching `*_NN.md`, or explicitly asks to:
- Create a new model step-by-step using apps (Business, Procedures, Organization, Metrics, Blank).
- Create or edit any file matching `*_NN.md`.
- Author or modify business models, procedure models, or any model following an iNNfo app.
- Create, edit, or modify apps or specializations under `docs/bluepriNNts/`.
- Discuss the iNNfo specification, meta-templates, primitives, matrices, or naming conventions.
- Execute procedures declared in a model.

This skill guides LLMs and agents in authoring, creating from scratch (wizard), editing, auditing, and validating **iNNfo-compliant files** (Meta-template specification with unified `NN` syntax: `# NN`, `## NN`, and `key:: value`).

**Resolution, validation, and mutation are delegated to the `nn-mcp` server** — a deterministic engine wrapping `@cognnitive/nn-core`. The agent does NOT hand-resolve spec chains, hand-validate models, or guess syntax when the MCP is available. See §1 (MCP Operating Model) and §7 (Delegation Contract).

> 🛡️ **Single Source of Truth & Zero Workspace Pollution**:
> 1. The `iNNfo` repository is the **Single Source of Truth** for all apps and specs. Do NOT duplicate app files across repositories.
> 2. When resolving apps/specs without MCP: if a git fallback clone is required, the agent MUST clone into the system temporary directory (`$env:TEMP/innfo_tmp` or `~/.agents/tmp/`), read the required file, and **immediately delete the temporary folder**. The agent MUST NEVER clone git repositories or leave checkouts inside the user's workspace directory.
> 3. **Windows Network Resilience**: In Windows environments, do NOT execute bare `curl` in PowerShell (which aliases to `Invoke-WebRequest` and fails SSL handshakes). Use `curl.exe` explicitly, Node.js native fetch (`node -e "fetch(...)"`), or git archive.
> 4. **Web GUI & Preview Integration**: When asked to preview a model or element in Web GUI environments, prefer generating structured Markdown cards that point to the domaiNN console (see section 12) or inline SVG diagrams instead of un-sanitizable `<iframe>` tags.

---

## 3-Tier Progressive Disclosure Protocol for Skills

To minimize token usage and unnecessary file I/O operations across large workspaces, all agent interactions MUST adhere to the 3-Tier Progressive Disclosure Protocol:

- **Tier 1 (Root Discovery)**:
  Read `domaiNN_NN.md` (or query `nn-core` DAG topology) to discover workspace dimensions, directory conventions, and top-level catalog references (`models`, `sources`, `procedures`, `artifacts`).
- **Tier 2 (Catalog Query)**:
  Read `sources_NN.md`, `procedures_NN.md`, or `artifacts_NN.md` to scan `summary`, `format`, `status`, `category`, and `tags` of all registered entities with zero additional file I/O. Make routing, indexing, and citation decisions based entirely on these indexed catalog summaries.
- **Tier 3 (Targeted Inspection)**:
  Read specific leaf models (`source_model`, `procedure_model`, `artifact_model`) on-demand ONLY when deep element editing, section-level inspection, or granular verification is required.

---

## 3. Entry Menu & Conversational Model Creation Wizard

### 3a. Intent-First Execution & Entry Menu

#### 1. Intent-First Execution (MANDATORY)
If the user's message already expresses an explicit, actionable intent (e.g. "run preflight", "check for new sources", "validate the model", "scaffold business model", "show uncited sources", "fix matrix error"):
- **EXECUTE IMMEDIATELY**: Process the requested workflow directly without rendering the root options menu (`[a]`, `[b]`, `[c]`, `[d]`, `[x]`, `[w]`, `[y]`).
- **Contextual Follow-up**: Upon completing the requested sub-task, summarize the findings and ask a focused, single follow-up question relevant to the result (e.g. *"I detected 3 uncited sources. Would you like to map them to model elements now?"*).
- **Menu Suppression**: DO NOT regurgitate the global entry menu after targeted actions unless the user explicitly asks for the menu, options, or help.

#### 2. Entry Menu (Undecided / Open-Ended Invocations)
When the user invokes the skill without an explicit intent (e.g., bare `/nn-innfo`, "hola", "qué podés hacer?", or open-ended browsing), present the entry menu:

- **[a] (Recommended)** Create a new model (Conversational Wizard)
- **[b]** Edit / extend an existing model (Conversational Wizard)
- **[c]** Audit & validate model (MCP Syntax + Architecture Coherence)
- **[d]** Export / update console artifacts (domaiNN console)
- **[x]** Execute a model procedure — delegate selection and execution to the canonical Procedure Execution Protocol (§16-bis), which discovers procedures from model `## NN Procedure:` sections, blueprint frontmatter, and `workspace/procedures/`
- **[w]** View & consult documentation — browse iNNfo specs, primitives, and guides
- **[y]** Cancel / help

*Notice: You can select one option or a combination (e.g. A and B).*

### 0a-bis. Active Model Context & Selection Gate (MANDATORY for [b], [c], [d], [x])

Before executing options **[b]**, **[c]**, **[d]**, or **[x]**, the agent MUST ensure there is an active model in context (`active_model_path`).

1. **Verify Session Context:** Check if a model is currently being edited/active in the session.
2. **Dynamic Discovery:** If no model is active, call `nn-mcp_list_knowledge` to scan the workspace:
   - **If 0 models found:** Inform the user that no models exist in `kNNowledge/` and suggest creating one (redirecting to option **[a]**).
   - **If 1 model found (Auto-Bind with Informative Grace):** Bind it automatically as the active model (`active_model_path`) without asking. Announce it in the user's active session language — e.g. (English) *"Binding `kNNowledge/{ModelName}_NN.md` (the only model detected in the workspace). Proceeding with this model; tell me if you want to use another or create a new one before I start."* Proceed immediately.
   - **If multiple models found:** Present a numbered list of all models found and ask the user to select one: *"Multiple models detected. Please select which one you want to work with:"*. Set the selected file as `active_model_path` and proceed.
3. **Session Persistence:** Once a model is selected or created, save its path in context. Subsequent actions (validation, edits, audits, console exports) MUST default to this active model. To switch models, the user can explicitly ask to "switch model" or select the change option in the quick actions menu.

### 0a-ter. Step 0 Schema Integrity Gate (MANDATORY before downstream repairs)

Before attempting to diagnose or repair child reference warnings, matrix mismatches, or element field inconsistencies in a Level 3 model, the agent MUST verify that the model's `parent_spec` resolves cleanly to a valid Level 2 template.

1. **Gate Verification**: Inspect the output of `nn-mcp_validate_knowledge` (or `nn-mcp_get_blueprint`) for `PARENT_RESOLUTION_FAILED` or `CRITICAL_BLOCKER` diagnostics.
2. **Fail-Fast Policy**: If `parent_spec` cannot be resolved:
   - **HALT**: The agent MUST halt all downstream field, matrix, or reference remediation immediately.
   - **NO MUTATION**: The agent MUST NOT attempt to edit child elements or add missing fields while the parent schema is unreachable.
   - **Report to User**: Report the unresolved parent template to the user, displaying the searched paths `(searched: ...)` and offering concrete remediation options:
     - Correct `parent_spec.url` to a valid stable HTTP/HTTPS URL or workspace-relative path (`specs/...`).
     - Rehydrate the template into `specs/` using `nn-mcp_hydrate_blueprint` or canonical registry fallback.
     - Check the MCP root configuration (`INNFO_MODELS_DIR`).
3. **Execution Condition**: Only after the schema resolution gate passes (`parent_spec` successfully resolved) SHALL the agent proceed to Phase 3/4 content, matrix, and reference remediation.

---

### 0b. Proactive Discovery (Option A)

If the user wants to create a model but is unsure which app fits best:

1. Ask 2-3 brief diagnostic questions:
   - Is the goal to structure a business model / value proposition, a step-by-step operational process, an organizational / team structure, or a quantified metrics / projections model?
   - Do you have source documents in `sources/import/` (cognitivized, so they carry sidecars) to extract information from, or are we starting from scratch?
2. Recommend the optimal app with a 1-sentence technical justification and mark option `[a]` with `(Recommended)`.

---

### 0c. Model Creation Wizard: Phase A (App) + Phase B (Model)

When the user asks to "create a new model", "start a model from scratch", or selects option [a]:

Creating **any** model — with a canonical app, custom app, or without an app — always follows two separate phases. First, the **App (Level 2)** is designed and approved (Phase A), then the **Model (Level 3)** is designed and approved (Phase B). No file is written until the user confirms the plan for the corresponding phase.

#### Phase A — App Design (Level 2)

**A0. Domain Language Auto-Alignment (MANDATORY):**
If the user's conversational prompt is in language $L$ (e.g. Spanish) or the primary sources to be ingested are in language $L$, the proposed Concepts, Field names, and Matrix titles MUST be authored in language $L$ by default. Never propose an English schema to a non-English domain without explicit prior confirmation.

**A1. Base Selection:**
- **[a] (Recommended)** Business Model 🏢
- **[b]** Procedures Model 📋
- **[c]** Organization Model 👥
- **[d]** Metrics Model 📊
- **[e]** Blank / 100% custom design from scratch
- **[x]** Cancel
*(Notice: You can select one option or a combination (e.g. A and B))*.

**A2a. If a canonical app was selected ([a]/[b]/[c]/[d]) (Optimistic Execution with Informative Grace):**
Resolve the app with `nn-mcp_get_blueprint` and display an informative summary of the Concepts, Fields, and Matrices it already defines. Then discover its procedures with `nn-mcp_list_blueprint_procedures`: if the app declares an explicit empty procedures block, announce it — *"This app declares no executable procedures yet."* — instead of silently presenting an app with nothing executable. The listing also returns shadowed procedures (an `id` clash lost to a nearer definition): present only the entries whose `status` is `selected`.

**Do NOT block on an intermediate customization menu.** By default, canonical apps are used as-is. Announce with Informative Grace in the user's active session language — e.g. (English): *"Using the standard {App} blueprint. Proceeding with the model's element design; tell me before I start if you'd prefer to customize the blueprint or create a specialization."*
Proceed directly to **Phase B (Model Design)**. Only branch to customization if the user explicitly asks to customize or interrupts.

**A2b. If [e] Blank was selected, or the user confirmed customization in A2a [b]:**
Design from scratch, in this order, consulting `nn-mcp_get_spec` for the exact grammar of each primitive (never invent it):

1. **Concepts**: which Concepts the app will have (the root categories of the model).
2. **Fields per Concept**, with their `type::` — apply the **Type Heuristic** (below) before assigning `string` to any field.
3. **Matrices**: which relationships between Concepts warrant a matrix — apply the **Matrix Heuristic** (below). Each Matrix Definition can declare `values::` (set of allowed cell values), `widget::` (`boolean` | `cycle` | `scale` | `set` | `text`), and `widget_config::` (JSON object: `scale`→`{min,max,step}`, `cycle`→`{order}`, `set`→`{max_selections}`, `text`→`{max_length}`). `widget:: scale` without `min`/`max` in `widget_config` is a validation ERROR.
4. **`includes` (additive composition, optional)**: if the app should reuse Concepts/Fields/Matrices from other *peer* apps, declare them in frontmatter as `includes:` with entries `{ name, url }`. This is horizontal composition (app ∪ app), additive: NOTHING is overridden or deleted, and a name collision between two sources is an ERROR. This is a different axis from `parent_spec` (vertical chain to L1) and `specializes` (inert). See §9.

##### Type Heuristic (String vs. Reference)

Before assigning `type:: string` to a field, ask: **does the value of this field identify or point to another Element or Concept in the model (existing or to be created)?**
- If yes → `type:: reference`, never `string`.
- Red flag in field name: `owner::`, `client::`, `lead::`, `category::`, `location::`, `vendor::`, `assigned_to::`, and similar — names that point to an entity, rather than describing an inherent attribute of the Element itself.
- If the referenced entity is not yet a modeled Concept/Element, do not hide it as `string`: propose creating the corresponding Concept/Element before typing the field.

##### Matrix Heuristic (Matrix vs. Reference)

- 1:N relationship with no cross-attributes → a `reference` field suffices.
- N:M relationship (both sides repeat) → matrix.
- Any relationship where each cross-point needs its own state/type/attribute (e.g. `X` / `-` / `primary`) → matrix, typically with `values::`.
- Quick test: if you can count the same Element more than once on each side of the relationship, it is a strong signal for a matrix.

**A3. Consolidated App Plan (mandatory gate):**
Before writing the app file, present EVERYTHING together in a single block — Concepts, Fields with types, Matrices — and ask if anything needs adjustment:

```markdown
📋 Proposed App Plan:
- Concepts: Stakeholders, Segments, Offerings
- Fields:
  - Stakeholders: name (string), owner (reference), budget (string)
  - Offerings: name (string), category (reference), price (string)
- Matrices: Stakeholders × Offerings (N:M, values: interested/buyer/dismissed)

Confirm this design, or would you like to adjust anything before creating the app?
- [a] (Recommended) Confirm and create app
- [b] Adjust Concepts/Fields/Matrices
- [x] Cancel
```

Only upon confirming [a] is the app file written: `<Template>_spec_NN.md` if completely new, or `<Model>_<Template>_spec_NN.md` if specializing an existing base (see §9). The version lives in the `spec_version` frontmatter key, not in the file name.

---

#### Phase B — Model Design (Level 3)

Once the Phase A app is approved (or confirmed as-is):

**B1. Elements and Crossings Plan (mandatory gate):**
Present what Elements will be created for each Concept, and what matrix crossings will be populated, BEFORE writing content:

```markdown
📋 Proposed Model Plan:
- Stakeholders: Enterprise Customer, Pilot Customer
- Offerings: Basic Plan, Premium Plan
- Matrix Stakeholders × Offerings: Enterprise Customer↔Premium Plan (buyer), Pilot Customer↔Basic Plan (interested)

Confirm this structure, or would you like to adjust any Element or crossing?
- [a] (Recommended) Confirm and continue
- [b] Adjust Elements or crossings
- [x] Cancel
```

**B2. Co-creation Mode (Incremental vs Batch)**:
With structure approved, offer the drafting mode:
- **[a] (Recommended) Step-by-Step Co-creation:** We interact concept by concept, Element by Element.
- **[b] Full Generation:** The agent drafts the complete draft in a single file for subsequent audit, following the plan approved in B1.

**B3. Model Naming & Scaffolding**:
Prompt for `{ModelName}` and create `{ModelName}_{Template}_NN.md` (the stem ends with the bluepriNNt name; the version lives in the `knowledge_version` frontmatter key, not in the file name) with workspace structure (`kNNowledge/`, `sources/import/`, `procedures/`, `artifacts/`, `index.md`). When creating a new workspace, emit `workspace_id: "<folder-slug>"` in the entrypoint's frontmatter (a stable slug derived from the workspace folder name, so the workspace keeps a correlatable identity across renames/moves). This field is optional and unvalidated — omit it for existing workspaces rather than retrofitting one.

**B4. Validation & Visual Checklist**:
Validate via `nn-mcp_validate_knowledge` and output the Visual Expectation Checklist (§12).

---

### 0d. Documentation Consultation (Option W)

When the user selects option `[w]` (View & consult documentation):
1. Present available iNNfo documentation categories and guides:
   - **Level 1 Core Specification**: the iNNfo specification, fetched with `nn-mcp_get_spec` (Primitives: Concepts, Fields, Matrices).
   - **Level 2 Canonical Templates**: Business, Procedures, Organization, Metrics, Projects, Innovation, Analysis, Documentation.
   - **Syntactic & Structural Rules**: Heading conventions (`# NN`, `## NN`), typing heuristics, WikiLink reference formatting (`[[...]]`), and source citation grammar (`sources:: [...]`).
   - **Artifact & Console Architecture**: Console shell, slot payloads, and interactive console runtimes.
2. **Read-only consultation**: This workflow is purely informational and performs **zero workspace filesystem mutations**.

---

## Greeting Protocol (MANDATORY)

When this skill is activated, the agent MUST print exactly:

```
🔧 You're using skill: nn-innfo (🧠)
```

as its very first output — before any questions, analysis, or tool calls. Session-scoped: only once per conversation. After the greeting, proceed with the capabilities relevant to the current request.

---

## Core Concepts & Single Source of Truth

> [!NOTE]
> **The MCP server (`nn-mcp`) and the canonical specifications are the ONLY source of truth (SSOT) for syntax and data types.** The agent does NOT reproduce grammar rules from memory; it queries them dynamically via MCP (`nn-mcp_get_spec` / `nn-mcp_get_blueprint`).

### iNNfo Level Summary

| Level | Role | Canonical Term | Syntax & Structure |
|---|---|---|---|
| **0** | Meta-specification | `defiNNition` | Defines the meta-rules for specifications. |
| **1** | Concrete Specification | `iNNfo` / `meta-bluepriNNt` | Level 1 meta-template. Defines the 3 root primitives (`Concept Definition`, `Field Definition`, `Matrix Definition`). |
| **2** | Domain Schema | `bluepriNNt` | An iNNfo document with lightweight frontmatter (`level: 2`). The body instantiates the 3 root primitives as Markdown elements. **FORBIDDEN to put `concepts: []` or `fields: []` in the YAML frontmatter.** |
| **3** | Domain Data Model | `kNNowledge` | Instantiates the concepts and fields defined by its parent bluepriNNt (`parent_spec`). |

---

## 1. MCP Operating Model

The `nn-mcp` server exposes a deterministic tool set built on `@cognnitive/nn-core`.

<!-- generated:mcp-tools (source: nn-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->
**24** tools

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
| `list_blueprint_procedures` | List all procedures defined in a blueprint and its transitively included blueprints up to depth 10. A procedure that loses a name clash is returned with status shadowed (shadowed_by names the winner), never dropped. With path (a document or scope directory) the listing is scope-aware: the procedures visible from that scope, selected and shadowed (model > nearest scope > ... > root procedures/ > the bluepriNNt package), each with its source, slots, fork record and warnings; a path outside any domaiNN returns NO_DOMAIN_ROOT with the directories searched. The scoped listing is bound to the server domain root: path cannot be combined with domain or root (INVALID_ARGUMENT), and path must be a non-empty string. |
| `list_blueprint_skills` | List all agent skills defined in a blueprint and its transitively included blueprints up to depth 10. Skills shipped inside a package under skills/<name>/SKILL.md are returned with embedded: true and a resolved absolute path. |
| `resolve_effective` | Read-only: the effective value of a key at a document (or at one scope element of it), folded over the scope chain with a merge strategy, plus the trace that explains it. Strategies: override (nearest declaration wins), union (named entries accumulate, nearer shadows farther) and none (only the target node supplies the value; ancestors and the bluepriNNt floor are reported under notInherited, never inherited). The floor is the single document under the defaults/ folder of the bluepriNNt package named by the innermost scope document. Returns {present, value, winner, trace}, or a structured error (NO_DOMAIN_ROOT, PATH_OUTSIDE_SCOPE, UNSUPPORTED_STRATEGY, UNKNOWN_ELEMENT, ...). Never writes files. |
| `explain` | Read-only: why a key resolves the way it does at a document (or at one scope element of it). Takes the same inputs as resolve_effective and returns the same trace, plus the chain of scopes it was computed over (node ids and kinds, outermost first) and the floor supplier. Never writes files. |
<!-- /generated:mcp-tools -->

**Golden Rule:** The specification/app URL always comes from `parent_spec.url` or from the user. Never hardcode or invent URLs.

---

## 2. Canonical Specification Reference

Do NOT hardcode specification URLs or versions in this skill: spec file names and versions change between releases. Resolve specs at runtime:

- **iNNfo (Level 1) and any Level 2 blueprint:** `nn-mcp_get_spec` / `nn-mcp_get_blueprint` (list available ones with `nn-mcp_list_blueprints`).
- **A model's own parent:** the `parent_spec.url` declared in its frontmatter.

### The `parent_spec.url` Rule for Level 3 Models

1. A Level 3 model's `parent_spec.url` must be a **STABLE (http/https)** URL pointing at the Level 2 app, or a **workspace-relative path** (e.g. `specs/MyBlueprint_spec_NN.md`). The version lives in that file's `spec_version` frontmatter key, not in the path.
2. **FORBIDDEN: absolute Windows paths** (e.g. `C:/Users/.../MyTemplate_spec_NN.md`): they break resolution in the Modeler (fetch over a local path) and in the MCP. The `nn-mcp` resolver (`resolver-node.ts`) looks for the app only under the workspace's `specs/` (recursively); the canonical form is the stable http URL.
3. After setting `parent_spec.url`, ALWAYS verify resolution (see §5, parent-chain pre-check) before declaring the model done.
4. **Relative paths resolve against the MCP server's root** (the `INNFO_MODELS_DIR` environment variable, or the process cwd when the server starts), NOT against the model file's own folder. Therefore, to validate a workspace with relative paths, the MCP root MUST be the workspace root; `root:` overrides only apply where the tool accepts them (`validate_knowledge` with `root`, `get_spec`/`get_blueprint` with `url`).
5. **The resolver AUTO-CACHES every resolved parent** (local or remote) into `<workspace>/specs/`, under the document's own canonical versioned file name (write-once: if a file with that name already exists, it is never overwritten). There is no separate cache directory — `specs/` is the only local lookup, recursive, relative to the MCP server's `root`. (Note: `.spec-cache/` and `.specs/` are scanned only by the in-browser editor, as an extra heuristic for a version notice — they are not part of the MCP's real resolution; do not copy files there expecting the MCP to use them.) If a resolution fails, check that the MCP `root` points at the workspace root so relative paths resolve correctly. NEVER copy files into `specs/` by hand — let the resolver sync them.

---

## 4. Source Citation Protocol (`sources::`)

1. **Optional:** `sources::` is an **OPTIONAL** traceability property. It does not syntactically invalidate a Level 3 model if absent.
2. **Sources and Path Resolution:** Sources are cognitivized in place: a raw file keeps its path and gets a co-located sidecar (`<file>.<ext>_sidecar_NN.md`). **There is no implicit path prefix**: every citation path is domaiNN-relative and written in full.
   - Text files (`md`, `csv`, `json`) are cited directly: `sources/import/client_interview_transcript.md@## Feedback`.
   - Subfolders are part of the path: `sources/import/interviews/interview_transcript.md@## Overview`.
   - Binary files (PDF, DOCX, XLSX) cannot be cited directly (`KU_BINARY_TARGET`): cite the sidecar, whose body holds the normalized Markdown: `sources/import/report_20261001T101500Z.pdf_sidecar_NN.md@## Findings`.
    - **A Model is a first-class Source.** `kNNowledge/<path>.md@<unit>` is a valid citation target with the identical `path@unit` syntax as a Source — the parser (`parseKnowledgeUnitRef`) and validator already resolve it. Citing a Model element chains Lineage: `artifact → kNNowledge/x_business_NN.md@## Concept: Element → sources/import/1.md@## Section`.
    - **CSVs are citable by row.** `sources/import/<file>.csv@<row-id>` addresses the row whose first-column value equals `<row-id>` (e.g. `sources/import/metricas_q3.csv@104`); append `&<column>` for one cell (`...csv@104&mrr_usd`). The first column must be a unique, non-empty key; when the raw CSV has none, cite the curated CSV that `nn-sources --curate-csv` writes under `artifacts/curated/`.
    - **JSON files are citable by JSON Pointer** (RFC 6901, starting with `/`; a literal `&` is written `%26`): `sources/import/data.json@/items/0/name`.
   - **Heading-level convention (authoring rule).** So model-heading slugs are stable and meaningful: `# NN <Concept>` (H1 = Concept), `## NN <Concept>: <Element>` (H2 = Element), and `###`+ only inside an element's description/prose — never as standalone structural blocks. The slug algorithm is level-agnostic; this is discipline, not validation.
   - Global PIDs use schema identifiers: `doi:10.1145/3290605.3300233`.
3. **Staging Isolation (`staging/`):** Any `staging/` folder is a transient extraction buffer (OCR, Whisper, etc.) and is **NEVER a valid citation target** (a citation into it reports `KU_EXCLUDED_PATH`). Models only cite cognitivized sources (raw text files or sidecars).
4. **Exact grammar and stable anchors:**
   ```
   sources:: <ref>
   sources:: [<ref>, <ref>, ...]

    <ref>  ::= <relative-path>@<unit>( &<subunit> )*
    <unit> ::= <level><slug>          (Markdown: `@## Section`, header level preserved)
             | <row-id>               (CSV: `@104`, explicit first-column value)
             | <json-pointer>         (JSON: `@/items/0/name`, RFC 6901, starts with `/`)
    <subunit> ::= <field-name> | <column-name>   (names only, never values)
    ```
    - Markdown units keep their header level (`@#`, `@##`, `@###`) and slugify GitHub-style, except the `Concept: Element` boundary which stays visible as `--` (e.g. `@## NN Person: Dr. Egon Spengler` → slug `nn-person--dr-egon-spengler`).
    - Numeric line ranges (`#L1-L10`) and legacy `#slug` fragments are **deprecated** (the latter still validates with a warning during transition) — ranges are fragile under reformatting, bare slugs are level-blind.
    - Every unit must resolve in the cited document; queries (`?filter=…`) are NEVER valid inside `sources::` — they belong to retrieval tools, not citations.
5. **`sources::` is ALWAYS a bracketed list `[...]`, even for a single source.** The L1 spec requires `sources:: [sources/import/<filename>@<unit>, ...]` — it MUST always be formatted as a list enclosed in brackets `[...]`, even when referencing a single source document. There is no scalar syntax and no bracket omission for a single value (see the iNNfo specification via `nn-mcp_get_spec`). In `type:: reference` fields, the WikiLink syntax `[[...]]` is separately mandatory (see §8d and Core Rule 12):
   ```markdown
   ## NN Stakeholders: Enterprise Customer
    sources:: [sources/import/client_interview_transcript.md@## Key Feedback, sources/import/notes.md@## Key Points]
   relationship_model:: B2B Long-term

   ## NN Stakeholders: Pilot Customer
    sources:: [sources/import/notes.md@## Key Points]
   relationship_model:: Trial
   ```
6. **Granularity: element-level in `sources::`, per-field through `<field>_source`.** `sources::` covers the set of sources backing the WHOLE element (all its fields together). If different fields of the same element come from different sources, list the union of them all in the element's `sources::`. A single field can additionally carry its own citation in a companion `<field>_source` (or `<field>_sources`) field: `apply_change` writes it when an `update_field` touches the field (it cites the applied change and the previous citation moves to the change's `replaced_sources::`). There is no per-sentence citation mechanism inside a domain model. Claim-level citation (via standard `[^1]` footnotes or bibliographic formats) is a separate mechanism, used only inside artifacts generated from the model (see `nn-sources/SKILL.md` §4) — never inside a `*_NN.md`.
7. **No duplicates or empty references.** Do not repeat the same `<ref>` twice in one list. If there is no real source to cite, omit the whole field — do not write `sources:: []` or a placeholder value.
8. **Conversational instruction:** If the project has cognitivized sources (files under `sources/` with sidecars), the agent should suggest adding `sources::`. If it is a greenfield / creative model from scratch, the agent does NOT request or require citations. In both cases the skill's general rule applies: never invent a `<ref>` or content that is not verifiably present in the cited file.
9. **Retrieval queries (`?`) are never a citation.** A `path?filter=value` expression (e.g. `metricas_q3.csv?segmento=Enterprise`) selects a SET of units for retrieval tools — it MUST NEVER appear inside `sources::` (the validator rejects it: run the query, then cite the resulting `@` pointers). `@` addresses one unit; `?` selects many; the two never mix in one string.
10. **`conflicts::` flags disagreeing Sources.** `conflicts::` is a reserved, OPTIONAL element property with the identical pointer-array grammar as `sources::` (same `<ref>` syntax, same bracketed-list requirement, same `@unit`/`&subunit` addressing). It is used when 2+ cited Sources genuinely disagree on a fact backing the element. The validator checks each `conflicts::` pointer exactly like a `sources::` pointer (same malformed-reference errors), but a `conflicts::` reference is **never** treated as a citation edge — it never contributes to `node.sources` or to any Lineage relationship. A valid `conflicts::` pointer instead raises a `SRC_CONFLICT_FLAGGED` warning, surfacing the disagreement for human review. Resolution is manual and out of band: state which Source is authoritative (or how the conflict was reconciled) in the element's `rationale::` field — there is no automated precedence or conflict-resolution ranking.
11. **A change derived from evidence MUST carry `sources::`.** A change block (`## NN Change: <id>`) that derives from a Source, an imported old domain, or a transcript MUST declare a `sources::` line citing its evidence, in the single `<ref>` grammar above (a bare path or `<path>@<unit>`); a change with no evidence — a bare review comment — omits it. The proposer writes it at proposal time and it is sealed into the proposal; `apply_change` only verifies that every citation resolves and **never adds, removes or rewrites** it (an unresolvable citation rejects the whole changeset with `CITATION_UNRESOLVED`, writing nothing). Example:
    ```markdown
    ## NN Change: c-01
    op:: update_field
    target:: strategy@vision&statement
    from:: "Initial draft"
    to:: "Accelerate renewable adoption"
    sources:: sources/import/client_interview_transcript.md@## Key Feedback
    ```

---

## 5. Operating Instructions & MCP Flow

1. Get the app with `nn-mcp_get_blueprint({ url })`.
2. Present concepts to the user using the format with `[a] (Recommended)`.
3. Draft the body using the unified syntax `# NN <Concept>`, `## NN <Concept>: <Element>`, `key:: value`.
4. Validate the model with `nn-mcp_validate_knowledge({ content })`.
5. **Parent-chain pre-check (MANDATORY before reporting done):** resolve the parent chain with `nn-mcp_get_blueprint({ model_id })` (or `{ url }`) BEFORE declaring the model done. If the app does NOT resolve (`Template could not be resolved` / `PARENT_RESOLUTION_FAILED`):
   - Do NOT report the model as done.
   - Warn that the app is unresolved, showing the problematic `parent_spec.url`.
   - Read the new actionable `(searched: ...)` diagnostic returned by `validate_knowledge` / `get_blueprint`: it lists the directories the resolver searched for the parent. If the searched directories look wrong (e.g. they don't point at the workspace root), the problem is the **MCP root** (`INNFO_MODELS_DIR` or the server cwd), not the model: fix the root/URL and re-validate (see §2, rule 4).
   - Offer to fix it: a stable http/https URL or a workspace-relative path (never an absolute Windows path — see §2).
6. When finished, show the **Visual Expectation Checklist (§12)** and the **Contextual Navigation Shortcuts (§13)** section.

#### Canonical `.md` write path (MANDATORY)

Every skill-driven `.md` write (new model, app, specialization, or full-file rewrite) MUST go through a single canonical path so files validate cleanly:

1. **Preferred:** create the model with `nn-mcp_init_knowledge` (create-only; it records an applied `add_model` changeset and infers the frontmatter version from the resolved parent, never hand-written), or propose it with `nn-mcp_propose_changeset` (`add_model`). Then change content through a changeset: `nn-mcp_propose_changeset` for reviewed changes, `nn-mcp_apply_change` for direct operations. There is no other file-write path (a changeset file may also be authored by hand for large batches — see *Authoring a changeset by hand*).
2. **Encoding:** UTF-8 without BOM, LF line endings, exactly one trailing newline.
3. **FORBIDDEN:** shell `echo` / `printf` redirection for file writes — they mangle encodings, join lines, and drop trailing newlines.
4. **Verify:** accented characters MUST round-trip byte-identical; re-validate with `nn-mcp_validate_knowledge` — no encoding or line-joining diagnostics may appear.

#### Review-and-approve flow (changesets)

Every content change a user should review goes through a changeset, never a direct file edit:

1. `nn-mcp_propose_changeset({ operations })` writes a sealed changeset with `status: proposed` under `changes/`. You derive the operations (`update_field`, `add_element`, `remove_element`, `rename_element`, `rename_concept`, `update_matrix_cell`, `comment`, `add_model`); the tool does not interpret conversations. It validates before writing and never applies.
2. The tool regenerates the domain console (`artifacts/<stem>_console/<stem>_console.html`, a stable file overwritten in place) and opens it in a browser tab. `nn-mcp_regenerate_console` does the same on demand and is the retry path when a regeneration failed.
3. The user reviews the proposal in the console, can add drafts there (edit a field, comment, or **New element**), and exports a changeset file from it.
4. The user replies **OK** and you call `nn-mcp_apply_change({ changeset })`. After an applied or partially applied changeset the console is regenerated again so it shows the result.

The result of `propose_changeset`, `apply_change`, `regenerate_console` and `init_knowledge` carries `next_steps`. You MUST relay `next_steps.notice` to the user verbatim: it lists the numbered steps above, the console path when the browser could not be opened, and the OK shortcut ("simply reply OK to apply them"). The console is static HTML and cannot call the MCP, so approval always comes back through you.

#### Authoring a changeset by hand (bulk or agent-generated)

`propose_changeset` is for operations you derive interactively. For large, mechanical batches (for example thousands of `update_field` operations across a whole model), you MAY author the changeset file yourself under `changes/` and apply it with `nn-mcp_apply_change({ changeset })`. This is a supported path, not a workaround:

- Write `changes/<prefix>_<author>_<stamp>_changes_NN.md`: the frontmatter (`spec_version`, `level: 3`, `parent_spec` → changes, `blueprint_version`, `status: proposed`, `title`, `author`) followed by one `## NN Change: <id>` block per operation (`op::`, `target::`, `to::`, optional `from::`).
- **Omit `proposal_sha`.** At intake the runtime seals the document itself (`proposal_sha = sha256(changes)`). Include it only if you compute the exact hash; a present but non-matching value is rejected with `PROPOSAL_TAMPERED` ("...or clear `frontmatter.proposal_sha` so it is re-sealed at intake").
- Every operation is validated and applied in a single atomic pass; each touched model version bumps once.
- It stays auditable: it is a normal changeset in `changes/`, cited by the mutated elements, and kept as part of the audit trail.

Prefer `propose_changeset` for interactive, review-driven changes; hand-author when the batch is large and mechanical.

#### Canonical 2-Hop Traceability Contract (MANDATORY)

In the cogNNitive architecture, Level-3 model elements do NOT cite raw source files directly.
Every change is audited through an immutable changeset:
```
[Element] ───sources::───► [Changeset] ───sources::───► [Primary Source]
```
- `apply_change` automatically stamps the mutated element's `sources::` field with the changeset reference (`changes/<file>.md@## NN Change: <id>`).
- To cite a primary source, declare it on the changeset operation as `sources`, a single citation STRING (not an array): `sources: "sources/import/<file>.md@## <Heading>"`. The change's `sources` is the evidence; it is sealed with the proposal and is not copied onto the element.
- Only `update_field` and `add_element` rewrite citations. Never attempt to manually override an element's `sources::` field with a direct source path: the mutation engine enforces the audit trail.

#### New domain and migration

- `nn-mcp_init_domain({ dir, name })` creates an empty, conformant domaiNN in a new directory (canonical folders, `changes/`, `.gitattributes` with `* -text`, a manifest listing no models). It refuses a non-empty directory and is not a changeset.
- Add models afterwards with an `add_model` change (alone or together with `add_element` changes in the same changeset) via `propose_changeset`, or with `init_knowledge`.
- Migration recipe: `init_domain` for a NEW domain, import the old domain as a source (`node skills/nn-upgrade/scripts/migrate-domain.js --import-as-source`), derive `add_model` / `add_element` changes that cite it through `sources::`, `propose_changeset`, review in the console, reply OK, `apply_change`.

#### Version bump

To raise the version of a Level 3 model, use the MCP's `bump_version` operation — do NOT edit the frontmatter by hand. It is a changeset operation: a bare call is synthesized into a sealed, recorded, applied changeset (or put a `bump_version` change in a proposal, with the level in `to`):

```
nn-mcp_apply_change({
  id: "<model_id>",
  op: "bump_version",
  args: { bump: "minor" } // "patch" (default) | "minor" | "major"
})
```

- **Behavior**:
  1. Raises `knowledge_version` by the requested level. The model is bumped exactly once per changeset: a `bump_version` change replaces the default patch bump of `apply_change`, it never adds to it. A higher level resets the lower ones.
  2. The model file is never renamed (`kNNowledge/<stem>_NN.md` is invariant) and no reference elsewhere is rewritten.
  3. An explicit `version` is refused (`INVALID_BUMP_LEVEL`); so is the unversioned lineage record.
  4. `freeze_slugs` follows the same rule: on a Level 3 model it is a changeset operation.
- **Level 2 bluepriNNts**: `bump_version` on a bluepriNNt sets `blueprint_version` in place and writes directly (`{ bump }` or `{ version }`). `add_concept`, `add_field` and `set_marker` also stay direct on a bluepriNNt and are refused on a Level 3 model (`SCHEMA_OP_ON_LEVEL3`).
- **Remaining manual checklist**: none; a bluepriNNt bump is traced by git, so commit it.

---

## 6. Rename Safety & Referential Integrity

When a Concept or Element must be renamed:
* **Delegate to the MCP:** The agent does NOT perform blind manual find-and-replace. It uses `nn-mcp_apply_change` with the matching rename operation (`rename_concept` or `rename_element`) to guarantee deterministic updates of `[[Concept]]` WikiLinks, matrices, and cross-references.

---

## 7. Delegation & Fallback Contract

* **With MCP available:** NEVER resolve specifications by hand or validate manually. Delegate to `nn-mcp_get_spec`, `nn-mcp_validate_knowledge`, and `nn-mcp_apply_change`.
* **Fallback mode (no MCP):** Inspect local files on disk and check that the `# NN`, `## NN`, `key:: value` syntax and the lightweight Level 3 YAML frontmatter are respected.

---

## 8. Field Creation & Change-Preview Protocol

Every field must declare an explicit `type` (`string`, `select`, `reference`, `markdown_inline`, `markdown_file`, `image`, `file`, `video`, `audio`, `model`).

> 💡 **Submodel Fields (`type:: model`)**: When you need a field to reference or contain another iNNfo model document (`*_NN.md`) with app enforcement (e.g. `target_blueprint:: business`), use `type:: model`. Never claim that `type:: model` or submodel composition does not exist — it is a fully supported normative primitive in iNNfo (V_0-2-1+).

> ⚠️ **List syntax — NEVER use quotes without brackets.** For any field with multiple values (`reference`, `sources::`, or any other list type), the only valid format is `[a, b, c]` — no quotes around each value. The format `"a", "b"` (individual quotes, no enclosing brackets) **corrupts parsing silently**: the validator treats it as a single unreadable string instead of a list, and ends up reporting a generic dangling reference without explaining the real cause. If you see that error and the field has loose quotes with no `[...]`, this is almost certainly the cause.

### Change Preview with Diff
Before running any change or mutation on the model, the agent MUST present a short natural-language summary of the proposed change:

```markdown
📋 Proposed Change Preview:
- Target concept: Stakeholders
- New field: budget (type: string)
- Rationale: Store the annually allocated budget

Shall we proceed with this modification?
- [a] (Recommended) Confirm and apply change
- [b] Modify data type or configuration
- [x] Cancel
```

Once the user confirms, run the mutation via `nn-mcp_apply_change` and re-validate with `nn-mcp_validate_knowledge`.

#### Applying a Source-Convergence Proposal

When a source family declares a convergence strategy (`## NN Source Family:` in the domaiNN manifest), a new snapshot produces a **read-only convergence proposal** via `node skills/nn-sources/scripts/index.js --converge <family>`. Apply it through this same reviewed loop — never hand-edit the source (sources are immutable citation targets):

1. Present the proposal as a Change Preview with Diff: the added keys, the changed values (`key.field: from -> to`), and the flagged removed keys.
2. Run `--converge <family> --plan` to get ONE `propose_changeset` payload (it requires the family to declare `concept::` and `model::`). Submit the plan's `operations` as a single `nn-mcp_propose_changeset`, relay `next_steps.notice`, and on the user's OK call `nn-mcp_apply_change`, then re-validate with `nn-mcp_validate_knowledge`. `upsert` plans never overwrite a changed value — those arrive under `review` for an explicit user decision.
3. The plan ends in **one** `bump_version` change (`to` names the level) for the affected model; inside the single changeset it replaces the default patch bump, so the model is bumped once.
4. Mark the family applied so re-running `--converge` is a no-op: `node skills/nn-sources/scripts/index.js --converge-mark <family> --version <model-version>`.

Removed keys are flag-only: never delete or archive a model element from a convergence proposal without an explicit user decision.

---

## 8b. Asset & Image Field Protocol

* **Explicit type:** Always use `type:: image` for image paths or URLs (never `string`).
* **Specification rules:** The primary image resolution rule (Rule 1) and the grammar of the free companion field `<field>_metadata` with single-line CSL-JSON citations are officially defined in the Level 1 Specification (`iNNfo_NN.md`).
* **Agent interaction:** If the user includes images or assets with attribution information, the agent suggests adding the `<field>_metadata` field with the matching CSL-JSON citation.

---

## 8c. Audit, Validation & Architecture Assistant Mode (Option C)

When the user picks option `[c]` (Audit & validate model), the agent executes deterministic syntactic validation (`nn-mcp_validate_knowledge`) and takes the role of **Architecture Assistant**:

1. Load the model (`read_knowledge`) and its app (`get_blueprint`).
2. Run MCP syntactic validation (`nn-mcp_validate_knowledge`) and report any formal grammar or schema errors.
3. Evaluate the 4 architectural layers: **Formal Correctness**, **Logical Coherence**, **Semantic Coherence**, and **Solidity/Robustness**.
4. **Presentation with Functional Impact (Assistant Mode):**
   Do not just list technical errors; explain the **business/functional risk** and offer the **1-click fix**:

```markdown
🧠 Architecture Assistant Diagnosis:

1. ⚠️ [Logical Coherence] Broken Reference
   - Finding: Element `Enterprise Customer` references `CommercialDirector`, which does not exist.
   - Functional impact: It will break the navigation-tree links in the domaiNN console.
   - Suggested fix: Create the `CommercialDirector` element or correct the name.

Would you like me to apply the recommended fix automatically?
- [a] (Recommended) Apply suggested fix
- [b] View details of other findings
- [x] Ignore for now
```

---

## 8d. Relationship Protocol & WikiLink Syntax in Reference Fields

There are **4 formal relationship forms** in iNNfo (`hierarchy`, `evaluable_matrix`, `graph_edge`, `sequence`) and two cross-linking mechanisms (`reference` fields and contextual mentions):

1. **Taxonomic hierarchy (`hierarchy`)**: Declared **only** via nested WikiLink lists in the `# NN index` (`* [[Parent]]` -> `  * [[Child]]`).
2. **Reference fields (`reference`)**: When a field has `type:: reference` in its app definition, its value in the Level 3 model **MUST be enclosed in WikiLink brackets `[[...]]`** (e.g. `location:: [[Dining-Room]]`). NEVER write the value as plain text (`location:: Dining-Room`), because that prevents incoming-reference detection in the editor.
3. **Evaluable N-to-M relationships (`evaluable_matrix`)**: Expressed in `# NN matrices:` blocks for complex or scored relationships between concepts.
4. **Contextual mentions**: Written as WikiLinks `[[Element]]` inside the prose Markdown description.

**Wizard / co-creation instruction**: During model creation or editing, the agent MUST guide or ask the user how they want to structure relationships (hierarchy in `# NN index`, a reference field `[[...]]`, or an N-to-M matrix).

---

## 8e. Free-form Tag Protocol (`tags::`)

1. **`tags` is an ordinary Field.** At Level 3 an Element may carry a `tags:: [...]` value only when the Level 2 app declares a Field named `tags` (canonically `concept:: *`, `type:: select`, `multiple:: true`, `options:: []` for an open vocabulary). There is no reserved `tags` property and no Marker Definition: `tags` is a normal Field like any other.
2. **List syntax**: Written as an inline list `tags:: [urgent, sprint-1, vip-client]` (or `tags:: urgent` for a single value). For multiple values, the bracketed `[...]` syntax is mandatory.
3. **Agent use**: When the user asks to "filter or act only on elements with tag X", the agent inspects the `tags` Field of each Element/Concept to restrict its scope. In the console the filter token is `tags:<x>` (exact membership; `tags:a|b` is any-of).
4. **Concept-level tags**: a Concept row may declare `tags:: [core]`; elements without their own `tags` inherit those values.
5. **Valued fields replace valued markers**: if a value needs a widget, bounds, or participation in a matrix, declare a normal Field (`type::`, `widget::`, `multiple::`) instead of a marker.

---

## 8e-bis. Recipe: MARKERS_REMOVED

An older document that still contains a `# NN Marker Definition` section or an `item-markers matrix` fails validation with the diagnostic `MARKERS_REMOVED` (its `promptHint` is *"nn-innfo recipe MARKERS_REMOVED"*). Never rewrite the offending file directly: turn the diagnostic into a reviewable changeset.

1. **Run validation and read `meta`**: call `validate_knowledge` / `validate_blueprint` and read `MARKERS_REMOVED`'s message plus `meta.markers` and `meta.matrixColumns`. Both a Marker Definition and an `item-markers matrix` produce exactly ONE diagnostic per document.
2. **Classify each marker**:
   - **Flag markers** (symbol-only, or cells carrying `X` / `-`): become **a tag** — a value of the `tags` Field (`update_field`). Confirm the tag name mapping with the user before proposing.
   - **Valued markers** (a score, state or type per cell): become **a declared Field** (`concept:: *` or a list, with `type`/`widget`). Each cell becomes a `field:: value` line; a Concept row becomes a **concept-level value** (`update_concept_field`).
3. **Build ONE changeset**: `update_field` per element (own `tags` arrays and valued fields), `update_concept_field { conceptName, fieldName, value }` for concept rows, and `remove_matrix { matrixName }` for the `item-markers matrix`. **State explicitly which numeric scores were dropped**: a score whose semantics have no declared Field is dropped, not silently remapped.
4. **Level-2 vs Level-3**: changesets target Level-3 documents only, and no operation removes a Marker Definition section. For a **shipped bluepriNNt**, upgrade it with the Flow B template upgrade. For a **custom Level-2**, propose a direct edit and wait for consent — the Level-3 documents that depend on it stay invalid until that edit lands.
5. **Propose with `propose_changeset`**: seal the changeset and open the console so the user reviews and approves it. Do not apply it yourself before review.

`nn-upgrade` links here when its impact analysis finds a marker-bearing model; it does not ask mapping questions.

---


## 8f. Console Artifact Export & Inspection (Option D)

When the user selects option `[d]` (Export / update console artifacts):
1. Verify active model context via the Active Model Selection Gate (§0a-bis).
2. Execute console compilation for the active model:
   - Run `node <path-to>/export-console.mjs . <model_name>` (or `--stale` / `--all` depending on user intent). The CLI ships in the cogNNitive repo at `scripts/export-console.mjs`; run it from a checkout, or from the copy installed under `~/.agents/console/` once console assets are distributed.
   - The CLI resolves its console assets from `$INNFO_CONSOLE_DIR`, then the repo's `iNNfo/specs/bluepriNNts/console/`, then `~/.agents/console/`. The installed set is `export-console.mjs`, `console-views.mjs`, `artifact_shell.html`, `nn-console.bundle.js`, `nn-ui.css` and `console-payload.generated.cjs`, all flat in one folder; `--domain` needs every one of them. Set `INNFO_CONSOLE_DIR` when running outside a checkout.
   - After upgrading, run `skills-manager install` (or `update`, which also adds the console files a newer release introduced) so the set is complete; `--domain` fails with a clear error when `console-views.mjs` or `nn-ui.css` is missing.
   - `--domain` also reads bluepriNNt console views from the installed bluepriNNt packages in `$INNFO_BLUEPRINTS_DIR`, defaulting to `~/.agents/bluepriNNts/`, and warns on stderr when a model's bluepriNNt package cannot be found there.
   - `--view <id>` writes one console holding only that custom view, for the whole domain, to `artifacts/<id>_view/`. It cannot be combined with `--domain`, `--all`, `--stale`, `--filter` or a model name (exit 2), and it needs the same assets as `--domain`. Its drafts are kept apart from the domain console's.
   - `--domain` and `--view` print a size breakdown, warn on stderr above 5 MB and fail above 15 MB without writing anything.
   - If the user requests inspection or status, invoke with `--status` or `--tree` (read-only mode).
3. Present the compiled artifact path (the latest member of the write-once family, e.g. `artifacts/<stem>_console/<stem>_console_<UTC stamp>.html`; earlier exports are never overwritten) with instructions for opening offline or in browser.

---

## 9. Specialization Strategy

When a model needs custom concepts or fields beyond the base app:
1. **NEVER modify** specifications published under `specs/`.
2. Create a specialization app file `<Model>_<Template>_V_x-y-z_spec_NN.md` with `level: 2`.
3. Point the Level 3 model's `parent_spec.url` at the specialization file.
4. **The workspace `index.md` lists ONLY Level 3 models.** A `_spec_NN.md` file (Level 2 app / specialization) MUST NOT be listed as a model in `index.md`: it is resolved as an app via `parent_spec.url` and rendered as a `spec:` node, never as a model in the navigation tree.

> **Note — 100% new app (no base to specialize):** When Phase A (§0c) results in a from-scratch design, with no canonical app as a base, the file is named `<Template>_spec_NN.md` (without the `<Model>_` prefix, because there is no base to specialize). The rest of the flow — the Level 3 model's `parent_spec.url`, `index.md` listing only Level 3 models — applies the same.

### 9-bis. `includes` vs. specialization

They are distinct mechanisms:

| | `includes` (composition) | Specialization (`parent_spec` pointing at a `_spec_NN.md`) |
|---|---|---|
| What it does | Additively unions Definitions from *peer* apps | The model points at its own app that replaces the canonical one |
| Override | Forbidden (name collision = ERROR) | The specialization redefines the whole body |
| When | You need to combine several canonical apps as-is | You need to change/extend a specific app for one model |

A **composite** app (the one that declares `includes`) is the one the model names in its `parent_spec`; the included ones are standalone apps used as ingredients, not a lower category. `includes` is valid only at Level 2 — a Level 3 model composes through *its* app's `includes`, never its own. Combining `projects` + `organization` via `includes` is an ERROR while both declare the Concept `Roles` (you must rename on one side).

---

## 10. Post-Edit Validation & Versioning

After editing a model:
1. Run `nn-mcp_validate_knowledge()`.
2. Present result and version menu:
   - **[a] (Recommended)** Bump Patch (`V_x-y-z+1`)
   - **[b]** Keep current version (`V_x-y-z`)
   - **[c]** Bump Minor (`V_x-y+1-0`)
   - **[x]** Cancel
3. Update links in `index.md` if the physical file name changes.

---

## 11. Architecture Scaling Decision (1 to N Models)

When the project scales to multiple sub-models, present the **4 Architectural Alternatives**:

```markdown
💡 Architecture Scaling Selection (1 to N Models):

  [a] (Recommended) Option 4: Hybrid Master Aggregator with `file_ref::` references
      - Files: `kNNowledge/Master_NN.md` and `kNNowledge/subsystems/`
      - iNNfo code: The main model references subsystems via `file_ref:: ./subsystems/auth_NN.md`

  [b] Option 1: Single Monolithic Model
      - File: `kNNowledge/System_NN.md`

  [c] Option 2: Independent Models in the same directory
      - Files: `kNNowledge/DomainA_NN.md`, `kNNowledge/DomainB_NN.md`

  [d] Option 3: Multi-Folder Hybrid per Project
      - Files: `projects/domainA/kNNowledge/index.md`, `projects/domainB/kNNowledge/index.md`

  [x] Cancel

*(Notice: You can select one option or a combination (e.g. A and B))*
```

---

## 12. Visual Expectation Checklist (Console Verification)

Upon completing the creation or modification of a model, the agent MUST print the Visual Checklist pointing to the domaiNN console, the single review surface. Print its file path, never a web link.

### Console location
- Regenerate the console first (option `[d]`, `apply_change` regeneration) so it reflects the change. Print the path of the generated `domaiNN_console.html` (under `artifacts/<stem>_console/`) and tell the user to open it in a browser; it is self-contained and works offline.
- Name the model to look for (`<model_id>`), not a URL: the console lists every model in the domaiNN.

### Review is a file

The console is a static file the MCP regenerates. Relay `next_steps.notice` (it carries the console path) and let the user open the file. To change the model the user prompts the agent, or drafts changes in the console and exports a changeset.

Example of dynamic checklist to generate:
```markdown
📋 Visual Expectation Checklist in the domaiNN console (open `<console path>` in a browser):

- [ ] 🌳 **Navigation tree** — `<model_id>`: hierarchical structure based on `# NN index`, with concepts and elements.
- [ ] 📋 **Concept field panels** (e.g. <Concept>): each `key:: value` (properties, types and references) rendered per concept.
- [ ] 🎴 **Element cards** (e.g. <Element>): one card per `## NN <Concept>: <Element>` block with its metadata and description.
- [ ] 📊 **Comparative matrix tables**: N-to-M relationship tables rendered with interactive cells (`X` / `-`).
```

---

## 13. Contextual Navigation Shortcuts / Quick Actions (Option E)

Upon concluding the generation or editing of a model, the agent MUST include logical shortcuts based on current context. When finishing a new model, the first option MUST be guided review:

```markdown
📌 Suggested next steps:
- [a] (Recommended) Guided review of generated concepts and elements
- [b] Run Architecture Assistant audit ([c])
- [c] Export / update console artifacts ([d])
- [m] Switch active model (select another model)
```

**Dynamic Procedure Listing:**
* **Only if** the active model actually contains declared procedures (e.g. sections `## NN Procedure: ...`), append the following block:
```markdown
📌 Available procedures in model:
- [p1] Execute: <Procedure 1>
- [pn] ... (if the model declares a console procedure, it will appear here as "Generate <Template> Console")
```
* If the model does not declare any procedures, omit the "Available procedures in model" block completely to avoid broken shortcuts or noise.

---

## 14. Workspace Manifest Synchronization (Self-Registration)

The workspace manifest (`domaiNN_NN.md`, section `# NN kNNowledge`) can drift out of sync with the filesystem: a new Level 3 model is created and nobody adds its entry, or a file is deleted and the manifest entry keeps pointing at a model that no longer exists. The MCP's `sync_domain_manifest` tool reconciles this additively, never destructively:

- Adds a `## NN kNNowledge: <name>` entry (marked with `<!-- nn:auto -->`) for every discovered Level 3 model not yet listed, always at the end of the `# NN kNNowledge` section — never reordering or regrouping existing entries.
- Sets `status:: archived` on an entry the tool itself created (identifiable by `<!-- nn:auto -->`) when its file no longer exists on disk — never deleting it.
- Reactivates (`status:: active`) a previously archived tool-owned entry if its file reappears.
- **Never modifies an entry without the `<!-- nn:auto -->` marker**, leaving it completely intact whether or not its file exists. Every hand-authored entry is untouchable by design.
- Excludes from discovery the manifest itself, any model whose app is `cogNNitive` or `workspace` (in any version — those are lineage records, not navigation references), and anything outside the reconciliation scope (`backups/`, `archive/`, `specs/`).

**Invocation protocol (mandatory — same pattern as the Change Preview with Diff, §8):**
1. Run first with `dry_run: true` (the default) and inspect `changes` and `diff` in the response.
2. Present the user a natural-language summary of the proposed changes (how many entries would be added, which would be archived/reactivated) before writing anything.
3. Only after the user's explicit confirmation, call again with `dry_run: false` to persist the changes to disk.

```typescript
nn-mcp_sync_domain_manifest({ dry_run: true })
// review result.changes / result.diff with the user before continuing
nn-mcp_sync_domain_manifest({ dry_run: false }) // only after explicit confirmation
```

This is the headless / CLI-equivalent path for actioNN — there is no separate `nn` binary; synchronization always goes through the existing MCP bridge (`nn-mcp`), like every other tool in this skill.

---

## 15. External Watch Roots & Pre-Authoring Scanner Integration

The session-start surfacing of watch roots — the contextual `[s] Sources` sub-option, the `[h] Help` capability entry, and the read-only `--watch-digest` — is owned by `nn` (see the `router-governance` and `external-watch-roots` capabilities). This section covers only the pre-authoring check that runs when a model citing dynamic sources is about to be written.

When authoring or auditing models that rely on external data drops (e.g. client spreadsheets, RFPs, audio transcripts):
1. **Detect Declarative Watch Roots**: Check if the workspace Lineage record (`domaiNN_NN.md` or `<Project>_cogNNitive_NN.md`) defines a `## NN External Watch Roots:` section.
2. **Pre-Authoring Scan Check**: Before updating or creating a model citing dynamic sources, offer to scan external roots:
   > *"This workspace defines external watch roots. Would you like to scan for new or evolved primary sources before authoring?"*
3. **Execution**: Invoke `node skills/nn-sources/scripts/index.js --scan-external --check-impact` to inspect external changes, import timestamped snapshots (`YYYYMMDD-HHmmss`), and check source family evolutions.
4. **Shared Digest State**: Consult `.cognnitive/watch-digest.json` and skip any item the session-start digest already offered or decided (`ignore`/`import`), so the user is not asked twice for the same content.

---

## 16. Model Procedure & Skill Discovery

Executable procedures and agent skills are content declared dynamically in models and apps (not a fixed catalog in the skill). They are discovered by calling the MCP tools `list_blueprint_procedures` and `list_blueprint_skills`, which transitively walk the `parent_spec` hierarchy and the `includes` composition tree to a depth of 10 levels, reporting a procedure that loses an `id` clash as `shadowed` (never dropped) and deduplicating skills by `name`. With a `path` (a document or scope directory) `list_blueprint_procedures` lists what is visible from that scope: selected and shadowed procedures from the scope chain, the domaiNN root `procedures/` and the bluepriNNt package, each with its slots, fork record and warnings. A skill shipped inside a package under `skills/<name>/SKILL.md` is discovered from disk and returned with `embedded: true` and an absolute `path`; it wins over a same-name frontmatter `skills:` entry.

Additionally, procedures are discovered by reading the `## NN Procedure: ...` sections of the active model and the workspace's `procedures/` folder (predicate: Level 3 documents whose `parent_spec` resolves to the procedures bluepriNNt).

The template console procedure (historically referred to as "master.html", "showroom", or "gallery") generates the canonical interactive console for a model (e.g. `business_console.html`, `procedures_console.html`). A domaiNN console aggregates every model and registered view into one self-contained `domaiNN_console.html` (see `console-architecture`). If the user asks for a "console", "master", "showroom", "gallery", or "visual framework", offer to generate the corresponding canonical console.

---

## 16-bis. Procedure Execution Protocol

Canonical owner protocol for discovering and running a procedure. Every other
skill that runs a procedure links here and MUST NOT restate these steps.

### 16-bis.1 Trigger

Run a procedure when the user selects a discovered procedure or names one. If no
source declares the named procedure, report it as unknown — never invent one.

### 16-bis.2 Discovery

Discover candidate procedures from every source: (a) the active model's
`## NN Procedure:` sections, (b) bluepriNNt `procedures:` frontmatter (also via
MCP `list_blueprint_procedures`), and (c) `workspace/procedures/*_NN.md` files.
Discovery does not require an executor tool. List each result with its id and
source; if none is found, say so. When the same name appears in more than one
source, resolve it by precedence: model > nearest scope > ... > root (including
`workspace/procedures/`) > bluepriNNt. The bluepriNNt is the floor; the domaiNN root is
more specific. A procedure that loses a clash is reported as shadowed, naming the
winner, never dropped silently. MCP `list_blueprint_procedures` with a `path`
implements this order. The listing returns shadowed entries too: a picker MUST
offer only the entries whose `status` is `selected` (show the `shadowed` ones only
as the explanation of what was replaced).

The `scope::` element field of the procedures bluepriNNt (for example `scope:: internal`)
is unrelated to the `scope: true` frontmatter flag that marks a scope document and to
`fork_of.scope`, the scope path of a forked original. The names coincide; the meanings do not.

### 16-bis.3 Step order (FSM)

Read the procedure's step `Work` elements. The start step is the one no other
step's `next::` reference targets; follow each `next::` to build the ordered
list. If a `next::` targets a step that does not exist, stop and report the
broken reference.

### 16-bis.4 Output routing

Write each step's output to the destination the procedure declares (write-once
under `artifacts/`); when none is declared, ask the user before writing. Append
`## NN Procedures:` lineage entries via the existing provenance path.

### 16-bis.5 Delegation

When a step declares an NN Tool or an embedded skill, load that skill and let it
run the step (e.g. CLI ingestion → `nn-sources`); do not inline another skill's
commands.

### 16-bis.6 Adaptation

When execution deviates from the declared procedure, capture the deviation and
offer to update the procedure spec.

---

## 17. Context Efficiency: Intent, Slices, Budgets

Every automated call declares its context budget and intent class. Nothing travels "just in case". Diagnostic codes are defined by `validator-robustness` (referenced, not re-specified).

### 17a. Intent declaration (`intent:`) — RESERVED, NOT ENFORCED

> **Status (2026-09-22): not implemented.** `intent` is accepted by `read_knowledge`,
> `validate_knowledge` and `query_units` and is then ignored — no handler reads it,
> so a declared intent does not change what the server returns. The companion
> `override_intent` parameter was removed from the tool schemas entirely; because
> the schemas do not set `additionalProperties: false`, passing it is silently
> dropped rather than rejected. Do not rely on either to change server behaviour.

A call MAY declare one intent — `coach`, `surgical`, `verify`, or `match` — to
record the caller's purpose for humans and for future enforcement:

```yaml
intent: surgical   # coach | surgical | match | verify; advisory only today
```

1. An undeclared intent MUST default to current behavior — omission never breaks
   a call. This holds trivially today, since a declared intent is also a no-op.
2. Work spanning two intents SHOULD declare the broader (more expensive) intent,
   so the recorded purpose stays honest once enforcement lands.
3. Context discipline is therefore the CALLER's responsibility right now: the
   budgets and slice rules in 17b-17c are real obligations on how you build
   requests, not something the server enforces on your behalf.

### 17b. Slice-first reads for surgical work

Surgical work (few elements of one concept) MUST read bounded slices through existing query units and MUST NOT include whole files. No included unit SHALL exceed 150 lines without an explicit slice or recorded override:

1. Assemble surgical context as one concept slice plus schema excerpt: `read_knowledge` with `concept` + `element` + `max_lines` (default 150), and `query_units` with capped projections. A unit over 150 lines included whole, without slice or override, is a caller violation — not a server error.
2. When the needed context spans the cap, record a manual `override_reason` alongside the call; the wider unit MAY then be included.
3. Honor the `truncated` flag: when set, the slice is partial — narrow the query instead of widening the read.

### 17c. Differential verify prompts

`verify` prompts MUST carry only outcome data and MUST NOT embed full logs or rendered artifacts; full logs remain on disk by path reference:

1. Build the prompt from `validate_knowledge(baseline_path)` as `{ exit, new_errors, verdict, log_path }` — exit status plus errors new against the baseline only.
2. A clean run carries the verdict only; historical errors are never re-explained.

### 17d. Per-intent budgets and measurement

| Intent | Budget rule |
|---|---|
| `coach` | SHALL be few calls but MAY consume up to half the session budget |
| `surgical` / `verify` | SHALL form the majority of calls at a fraction of the cost each |
| `match` | MUST NOT carry raw sources |

Each session MUST record per-intent call and token counts via the `usage-counters.js` convention: caller-side JSONL append of `{ ts, intent, inputTokens, outputTokens }`, defaulting to the OS temp directory (session-scoped, never the workspace tree — an explicit workspace path is opt-in only). One promotion per change MUST be benchmarked before versus after, recording per-intent call/token totals and the measured reduction.

---

## Core Rules

1. **Strict Meta-template:** Level 2 apps define primitives in the body (`# NN Concept Definition`). NEVER put `concepts: [...]` or `fields: [...]` in the Level 2 YAML frontmatter.
2. **Unified NN syntax:** Use `# NN <Concept>`, `## NN <Concept>: <Element>`, `key:: value`. Do not use obsolete `_NN` bullets or ````yaml` code blocks.
3. **Optional, up-to-date Source Citations:** `sources::` is optional; its paths are domaiNN-relative and written in full (no implicit prefix; binaries are cited through their sidecar), it anchors to knowledge units (`@<unit>`), and takes bracketed lists `[a, b]` for multiple sources (no `src-xxx` IDs, no `#L...` line ranges, no `staging/` buffer).
4. **Change Preview with Diff:** Show a natural-language summary before applying any MCP mutation.
5. **Architecture Assistant Mode:** In the `[c]` audit, explain business/functional risks and offer 1-click fixes.
6. **Contextual Shortcuts:** End every response by offering 2-3 suggested next actions (Quick Actions).
7. **Full MCP Delegation:** Query types, schemas, and validation from the `nn-mcp` server; do not guess or duplicate the grammar.
8. **Index Block Scope (`# NN index`):** The `# NN index` is reserved exclusively for workspace manifest documents (`domaiNN_NN.md` / `index.md`) and Level 2 templates (defining the taxonomy hierarchy of Concepts). Level 3 domain data models (`kNNowledge/*_NN.md`) MUST NOT contain a root `# NN index` block; navigation in Level 3 models is derived dynamically from Concept and Element headings.
9. **Mandatory WikiLink syntax in references:** In every reference field (`type:: reference`), the value MUST be formatted using WikiLink syntax (`key:: [[Element]]`). Plain text without WikiLink brackets is forbidden.
10. **Element descriptions in prose:** The description/explanation of an element in a Level 3 model must NEVER be written as a `description::` field. It must always be free-form Markdown prose below the `key:: value` field list, separated by a blank line.
11. **Active Model Selection Gate:** Never perform editing, validation, audits, console export, or model procedure execution without a validated active model in context. Run workspace discovery first if none is set.
12. **Dynamic Quick Actions:** Only list procedure shortcuts in next steps if the model contains declared procedures.
13. **Free-form Tags (`tags::`)**: When the Level 2 app declares a Field named `tags`, any Element or Concept may carry `tags:: [tag1, tag2]` for free-form categorization without a Marker Definition. Multi-value syntax requires brackets `[...]`. Agents use this Field to filter and scope actions (console token `tags:<x>`).
14. **Step 0 Schema Integrity Gate (MANDATORY)**: Always verify that `parent_spec` resolves cleanly before diagnosing or repairing child element fields, matrices, or references. If unresolved, halt and resolve schema reachability first.
15. **Mechanical Linting & BOM Encoding Sanitization**: Always enforce UTF-8 without BOM (`\uFEFF`), detect and disambiguate heading/slug collisions, and enforce clean frontmatter.

---

## Mechanical Linting & Upgrade Playbook

Deterministic instructions for identifying and mechanically repairing legacy syntax, corrupted encodings, and obsolete structural patterns:

1. **BOM Encoding Sanitization**:
   - Detect files containing UTF-8 Byte Order Marks (`\uFEFF` / `0xFEFF`).
   - Strip leading BOM characters upon reading and saving, strictly enforcing UTF-8 without BOM.
2. **Obsolete Level 3 `# NN index` Removal**:
   - The `# NN index` heading is reserved exclusively for workspace manifest documents (`domaiNN_NN.md` / `index.md`) and Level 2 templates, NOT Level 3 domain data models (`kNNowledge/*_NN.md`).
   - When linting or refactoring Level 3 models, remove any root `# NN index` navigation blocks. Navigation in Level 3 models is derived dynamically from Concept headings (`# NN <Concept>`) and Element headings (`## NN <Concept>: <Element>`).
3. **Heading and Slug Collision Detection**:
   - Detect duplicate `## NN <Concept>: <Element>` headings within a model file that yield identical slugs (e.g. `## NN Person: Alice` and another `## NN Person: Alice`).
   - Prompt the user for disambiguation or rename duplicate elements deterministically using `nn-mcp_apply_change` (`rename_element`).
4. **Frontmatter Standardization**:
   - Ensure Level 3 frontmatter contains only valid metadata: `knowledge_version`, `parent_spec: { name, url }`, `title`, and optional workspace/lineage tags.
   - Remove forbidden legacy frontmatter structures such as `concepts: []` or `fields: []` embedded in YAML frontmatter.

---

## Generating the Index Block (Level 2 Templates & Workspace Manifests)

### Fundamental Rule

The `# NN index` defines the **navigation** hierarchy between Concepts in Level 2 templates or between Models in workspace manifests. Elements do NOT
appear in the index — they are discovered by expanding a Concept in the sidebar tree.

### Correct Format (Level 2 Template)

```markdown
# NN index
* [[Market]]
  * [[Stakeholders]]
  * [[Segments]]
* [[Solutions]]
  * [[Offerings]]
  * [[Features]]
* [[Finance]]
  * [[Revenue]]
  * [[Costs]]
```

### INCORRECT Format (mixes Concepts and Elements)

```markdown
# NN index
* [[Market]]
  * [[Stakeholders]]    ← Element, does NOT belong in the index
    * [[John Doe]]       ← Element of Stakeholders, does NOT belong in the index
  * [[Segments]]        ← Element, does NOT belong in the index
```

### Automatic Generation (Level 2)

When creating or editing a template, the agent must:

1. **Read the template** (`get_blueprint`) to obtain the defined Concepts
2. **Identify root Concepts** (first level of the index)
3. **Identify sub-Concepts** (if the app has hierarchies)
4. **Generate the index** listing ONLY Concepts, NOT Elements
5. **Validate** with `validate_blueprint` that the index contains no Elements

### Elements↔Concepts Relationship

In Level 3 data models, Elements relate to their Concepts by:

1. **Section structure:** `## NN <Concept>: <Element>` declares that Element belongs to that Concept
2. **Reference fields:** `location:: [[Element Name]]` establishes relationships between Elements
3. **Matrices:** Matrices cross Elements from different Concepts

NEVER by hierarchy in a Level 3 index.
