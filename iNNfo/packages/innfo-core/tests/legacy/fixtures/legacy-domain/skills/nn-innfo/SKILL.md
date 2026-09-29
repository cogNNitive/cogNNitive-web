---
name: nn-innfo
version: "V_0-5-1"
last_updated: 2026-09-12
metadata:
  source_type: "original"
  mcp: "innfo-mcp"
license: MIT
bundled_templates:
  - name: workspace_spec_NN
    path: templates/workspace_spec_NN.md
description: |
  Domain skill for creating, editing, validating, scaffolding, or discussing iNNfo models, apps, specializations, samples, or specification files. Includes the conversational Model Creation Wizard and Architecture Assistant. Triggers: innfo, iNNfo, /nn-innfo, model, template, *_NN.md, procedures_V_0-1-0_NN.md.
  This includes but is not limited to:
  - Creating a new model step-by-step using apps (Business, Procedures, Organization, Metrics, Blank)
  - Creating or editing any file matching *_NN.md
  - Authoring or modifying business models, procedure models, or any model following an iNNfo app
  - Creating, editing, or modifying apps or specializations under docs/templates/
  - Discussing the iNNfo V_0-2-0 specification, meta-templates, primitives, matrices, or naming conventions
  - Any conversation about how iNNfo works, how to use it, or how to structure iNNfo files
  - Executing procedures declared in a model
---

# iNNfo Skill

## 0. Activation Gate & Conversation Lifecycle Gate
1. **Activation Gate**: Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check).
2. **Conversation Lifecycle Gate**: Follow `nn-router` Rule 5:
   - Silently reserve `conversations/YYYY-MM-DD_HHmmss.md` upon session start (`status: in_progress`).
   - Upon session exit or wizard completion:
     - Discard trivial sessions (<2 turns, 0 workspace mutations).
     - For non-trivial sessions, present 3 suggested titles (`[1] (Recommended)`), finalize frontmatter (`status: completed`), and rename to `conversations/YYYY-MM-DD_<slug>.md`.
     - Prompt for promotion to `sources/conversations/` (`[full]`, `[none]` — the raw transcript is always registered in `conversations/`; `_source.md` promotion is optional) for ingestion into the workspace knowledge graph and model citations (`sources:: [conversations/<file>.md@<unit>]`).

---

## Activation Contract

Activates when the user invokes `/nn-innfo`, mentions domain keywords `innfo`, `iNNfo`, `model`, `template`, references files matching `*_NN.md` or `procedures_V_0-1-0_NN.md`, or explicitly asks to:
- Create a new model step-by-step using apps (Business, Procedures, Organization, Metrics, Blank).
- Create or edit any file matching `*_NN.md`.
- Author or modify business models, procedure models, or any model following an iNNfo app.
- Create, edit, or modify apps or specializations under `docs/templates/`.
- Discuss the iNNfo V_0-2-0 specification, meta-templates, primitives, matrices, or naming conventions.
- Execute procedures declared in a model.

This skill guides LLMs and agents in authoring, creating from scratch (wizard), editing, auditing, and validating **iNNfo-compliant files** (V_0-2-0 Meta-template specification with unified `NN` syntax: `# NN`, `## NN`, and `key:: value`).

**Resolution, validation, and mutation are delegated to the `innfo-mcp` server** — a deterministic engine wrapping `@cognnitive/innfo-core`. The agent does NOT hand-resolve spec chains, hand-validate models, or guess syntax when the MCP is available. See §1 (MCP Operating Model) and §7 (Delegation Contract).

> 🛡️ **Single Source of Truth & Zero Workspace Pollution**:
> 1. The `iNNfo` repository is the **Single Source of Truth** for all apps and specs. Do NOT duplicate app files across repositories.
> 2. When resolving apps/specs without MCP: if a git fallback clone is required, the agent MUST clone into the system temporary directory (`$env:TEMP/innfo_tmp` or `~/.agents/tmp/`), read the required file, and **immediately delete the temporary folder**. The agent MUST NEVER clone git repositories or leave checkouts inside the user's workspace directory.
> 3. **Windows Network Resilience**: In Windows environments, do NOT execute bare `curl` in PowerShell (which aliases to `Invoke-WebRequest` and fails SSL handshakes). Use `curl.exe` explicitly, Node.js native fetch (`node -e "fetch(...)"`), or git archive.
> 4. **Web GUI & Preview Integration**: When asked to preview a model or element in Web GUI environments, prefer generating structured Markdown cards with interactive deep links (`https://cognnitive.com/innfo/app/?view=editor&model={model_id}#{element_id}`) or inline SVG diagrams instead of un-sanitizable `<iframe>` tags.

---

## Canonical Source Taxonomy & Provenance Contract

The iNNfo ecosystem establishes an explicit taxonomy for sources and evidence:

1. **Primary Source (Fuente Primaria)**:
   - The immutable, original evidence files located in `sources/import/` (or legacy `sources/original/`) or watched via `## NN External Watch Roots:` (read-only).
   - Includes raw text documents, spreadsheets, PDFs, and raw media (`.mp3`, `.wav`, `.mp4`).
2. **Normalized Source / Secondary Source (Fuente Normalizada / Secundaria)**:
   - Structured Markdown files generated under `sources/nn/` carrying canonical origin metadata in frontmatter (`source_file`, `sha256`, optional `media_file`).
   - Cited in Level 3 model elements via `sources:: [path.md#heading-slug]`.
3. **Companion Media & Lineage Playback**:
   - When a source is paired with a companion audio/video file sharing the same stem (e.g. `Grabación (21).txt` + `Grabación (21).mp3`), the normalized Markdown links it via `media_file`.
   - In the iNNfo Modeler lineage modal, companion media is surfaced with an embedded audio/video player for seamless evidence playback.
4. **Synthetic Source (Fuente Sintética)**:
   - Derived deliverables re-ingested into `sources/export/` (`is_synthetic: true`).
5. **User Input Source (Fuente de Entrada de Usuario)**:
   - In-line interactive input (`source_type: "user_input"`, `source_file: "inline:..."`) exempt from physical disk file existence.

---

## 3-Tier Progressive Disclosure Protocol for Skills

To minimize token usage and unnecessary file I/O operations across large workspaces, all agent interactions MUST adhere to the 3-Tier Progressive Disclosure Protocol:

- **Tier 1 (Root Discovery)**:
  Read `workspace_NN.md` (or query `innfo-core` DAG topology) to discover workspace dimensions, directory conventions, and top-level catalog references (`models`, `sources`, `procedures`, `artifacts`).
- **Tier 2 (Catalog Query)**:
  Read `sources_NN.md`, `procedures_NN.md`, or `artifacts_NN.md` to scan `summary`, `format`, `status`, `category`, and `tags` of all registered entities with zero additional file I/O. Make routing, indexing, and citation decisions based entirely on these indexed catalog summaries.
- **Tier 3 (Targeted Inspection)**:
  Read specific leaf models (`source_model`, `procedure_model`, `artifact_model`) on-demand ONLY when deep element editing, section-level inspection, or granular verification is required.

---

## 0. Entry Menu & Conversational Model Creation Wizard

### 0a. Intent-First Execution & Entry Menu

#### 1. Intent-First Execution (MANDATORY)
If the user's message already expresses an explicit, actionable intent (e.g. "run preflight", "check for new sources", "validate the model", "scaffold business model", "show uncited sources", "fix matrix error"):
- **EXECUTE IMMEDIATELY**: Process the requested workflow directly without rendering the root options menu (`[a]`, `[b]`, `[c]`, `[d]`, `[x]`, `[y]`).
- **Contextual Follow-up**: Upon completing the requested sub-task, summarize the findings and ask a focused, single follow-up question relevant to the result (e.g. *"I detected 3 uncited sources. Would you like to map them to model elements now?"*).
- **Menu Suppression**: DO NOT regurgitate the global entry menu after targeted actions unless the user explicitly asks for the menu, options, or help.

#### 2. Entry Menu (Undecided / Open-Ended Invocations)
When the user invokes the skill without an explicit intent (e.g., bare `/nn-innfo`, "hola", "qué podés hacer?", or open-ended browsing), present the entry menu:

- **[a] (Recommended)** Create a new model (Conversational Wizard)
- **[b]** Edit / extend an existing model
- **[c]** Validate a model with MCP
- **[d]** Analyze consistency and robustness (Architecture Assistant) — audit the model across formal, logical, semantic, and solidity layers (§8c)
- **[x]** Execute a model procedure — list procedures declared in the model and execute the chosen one
- **[y]** Cancel / help

*Notice: You can select one option or a combination (e.g. A and B).*

### 0a-bis. Active Model Context & Selection Gate (MANDATORY for [b], [c], [d], [x])

Before executing options **[b]**, **[c]**, **[d]**, or **[x]**, the agent MUST ensure there is an active model in context (`active_model_path`).

1. **Verify Session Context:** Check if a model is currently being edited/active in the session.
2. **Dynamic Discovery:** If no model is active, call `innfo-mcp_list_models` to scan the workspace:
   - **If 0 models found:** Inform the user that no models exist in `models/` and suggest creating one (redirecting to option **[a]**).
   - **If 1 model found (Auto-Bind with Informative Grace):** Bind it automatically as the active model (`active_model_path`) without asking. Announce: *"Vinculando `models/{ModelName}_NN.md` (único modelo detectado en el workspace). Voy a avanzar con este modelo; si querés usar otro o crear uno nuevo, avisame antes de empezar."* Proceed immediately.
   - **If multiple models found:** Present a numbered list of all models found and ask the user to select one: *"Multiple models detected. Please select which one you want to work with:"*. Set the selected file as `active_model_path` and proceed.
3. **Session Persistence:** Once a model is selected or created, save its path in context. Subsequent actions (validation, edits, audits) MUST default to this active model. To switch models, the user can explicitly ask to "switch model" or select the change option in the quick actions menu.

### 0a-ter. Step 0 Schema Integrity Gate (MANDATORY before downstream repairs)

Before attempting to diagnose or repair child reference warnings, matrix mismatches, or element field inconsistencies in a Level 3 model, the agent MUST verify that the model's `parent_spec` resolves cleanly to a valid Level 2 template.

1. **Gate Verification**: Inspect the output of `innfo-mcp_validate_model` (or `innfo-mcp_get_template`) for `PARENT_RESOLUTION_FAILED` or `CRITICAL_BLOCKER` diagnostics.
2. **Fail-Fast Policy**: If `parent_spec` cannot be resolved:
   - **HALT**: The agent MUST halt all downstream field, matrix, or reference remediation immediately.
   - **NO MUTATION**: The agent MUST NOT attempt to edit child elements or add missing fields while the parent schema is unreachable.
   - **Report to User**: Report the unresolved parent template to the user, displaying the searched paths `(searched: ...)` and offering concrete remediation options:
     - Correct `parent_spec.url` to a valid stable HTTP/HTTPS URL or workspace-relative path (`specs/...`).
     - Rehydrate the template into `specs/` using `innfo-mcp_hydrate_template` or canonical registry fallback.
     - Check the MCP root configuration (`INNFO_MODELS_DIR`).
3. **Execution Condition**: Only after the schema resolution gate passes (`parent_spec` successfully resolved) SHALL the agent proceed to Phase 3/4 content, matrix, and reference remediation.

---

### 0b. Proactive Discovery (Option A)

If the user wants to create a model but is unsure which app fits best:

1. Ask 2-3 brief diagnostic questions:
   - Is the goal to structure a business model / value proposition, a step-by-step operational process, an organizational / team structure, or a quantified metrics / projections model?
   - Do you have source documents in `sources/nn/` to extract information from, or are we starting from scratch?
2. Recommend the optimal app with a 1-sentence technical justification and mark option `[a]` with `(Recommended)`.

---

### 0c. Model Creation Wizard: Phase A (App) + Phase B (Model)

When the user asks to "create a new model", "start a model from scratch", or selects option [a]:

Creating **any** model — with a canonical app, custom app, or without an app — always follows two separate phases. First, the **App (Level 2)** is designed and approved (Phase A), then the **Model (Level 3)** is designed and approved (Phase B). No file is written until the user confirms the plan for the corresponding phase.

#### Phase A — App Design (Level 2)

**A1. Base Selection:**
- **[a] (Recommended)** Business Model 🏢
- **[b]** Procedures Model 📋
- **[c]** Organization Model 👥
- **[d]** Metrics Model 📊
- **[e]** Blank / 100% custom design from scratch
- **[x]** Cancel
*(Notice: You can select one option or a combination (e.g. A and B))*.

**A2a. If a canonical app was selected ([a]/[b]/[c]/[d]) (Optimistic Execution with Informative Grace):**
Resolve the app with `innfo-mcp_get_template` and display an informative summary of the Concepts, Fields, Matrices, and Markers it already defines. Then discover its procedures with `innfo-mcp_list_template_procedures`: if the app declares an explicit empty procedures block, announce it — *"This app declares no executable procedures yet."* — instead of silently presenting an app with nothing executable.

**Do NOT block on an intermediate customization menu.** By default, canonical apps are used as-is. Announce with Informative Grace:
*"Usando la plantilla estándar {App}. Voy a avanzar con el diseño de elementos del modelo; si preferís personalizar la plantilla o crear una especialización, avisame antes de empezar."*
Proceed directly to **Phase B (Model Design)**. Only branch to customization if the user explicitly asks to customize or interrupts.

**A2b. If [e] Blank was selected, or the user confirmed customization in A2a [b]:**
Design from scratch, in this order, consulting `innfo-mcp_get_spec` for the exact grammar of each primitive (never invent it):

1. **Concepts**: which Concepts the app will have (the root categories of the model).
2. **Fields per Concept**, with their `type::` — apply the **Type Heuristic** (below) before assigning `string` to any field.
3. **Matrices**: which relationships between Concepts warrant a matrix — apply the **Matrix Heuristic** (below). Each Matrix Definition can declare `values::` (set of allowed cell values), `widget::` (`boolean` | `cycle` | `scale` | `set` | `text`), and `widget_config::` (JSON object: `scale`→`{min,max,step}`, `cycle`→`{order}`, `set`→`{max_selections}`, `text`→`{max_length}`). `widget:: scale` without `min`/`max` in `widget_config` is a validation ERROR.
4. **Markers**: ask explicitly — *"Does this app need Markers (reusable tags/states, e.g. for matrix cells or cross-cutting Element classification)? If so, which ones?"* Do not assume they are not needed just because the user did not mention them. Each Marker Definition declares:
   - `applies_to:: [Element]` (default), `[Concept]`, or `[Element, Concept]` — which entities can be scored. Scoring a row whose scope is not in `applies_to` is a validation ERROR.
   - `values:: / widget:: / widget_config::` — same vocabulary as Matrix Definition (omit `values` for an open numeric marker bounded only by `widget_config`).
   - `symbol / icon / color / weight` — presentational; `weight` is NOT a score.
5. **`includes` (additive composition, optional)**: if the app should reuse Concepts/Fields/Markers/Matrices from other *peer* apps, declare them in frontmatter as `includes:` with entries `{ name, url }`. This is horizontal composition (app ∪ app), additive: NOTHING is overridden or deleted, and a name collision between two sources is an ERROR. This is a different axis from `parent_spec` (vertical chain to L1) and `specializes` (inert). See §9.

##### Type Heuristic (String vs. Reference)

Before assigning `type:: string` to a field, ask: **does the value of this field identify or point to another Element or Concept in the model (existing or to be created)?**
- If yes → `type:: reference`, never `string`.
- Red flag in field name: `owner::`, `client::`, `lead::`, `category::`, `location::`, `vendor::`, `assigned_to::`, and similar — names that point to an entity, rather than describing an inherent attribute of the Element itself.
- If the referenced entity is not yet a modeled Concept/Element, do not hide it as `string`: propose creating the corresponding Concept/Element before typing the field.

##### Matrix Heuristic (Matrix vs. Reference)

- 1:N relationship with no cross-attributes → a `reference` field suffices.
- N:M relationship (both sides repeat) → matrix.
- Any relationship where each cross-point needs its own state/type/attribute (e.g. `X` / `-` / `primary`) → matrix, typically with Markers.
- Quick test: if you can count the same Element more than once on each side of the relationship, it is a strong signal for a matrix.

**A3. Consolidated App Plan (mandatory gate):**
Before writing the app file, present EVERYTHING together in a single block — Concepts, Fields with types, Matrices, Markers — and ask if anything needs adjustment:

```markdown
📋 Proposed App Plan:
- Concepts: Stakeholders, Segments, Offerings
- Fields:
  - Stakeholders: name (string), owner (reference), budget (string)
  - Offerings: name (string), category (reference), price (string)
- Matrices: Stakeholders × Offerings (N:M, markers: interested/buyer/dismissed)
- Markers: interested, buyer, dismissed

Confirm this design, or would you like to adjust anything before creating the app?
- [a] (Recommended) Confirm and create app
- [b] Adjust Concepts/Fields/Matrices/Markers
- [x] Cancel
```

Only upon confirming [a] is the app file written: `<Template>_V_0-1-0_spec_NN.md` if completely new, or `<Model>_<Template>_V_x-y-z_spec_NN.md` if specializing an existing base (see §9).

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
Prompt for `{ModelName}` and create `{ModelName}_V_0-1-0_{Template}_NN.md` with workspace structure (`models/`, `sources/nn/`, `procedures/`, `artifacts/`, `index.md`). When creating a new workspace, emit `workspace_id: "<folder-slug>"` in the entrypoint's frontmatter (a stable slug derived from the workspace folder name, so the workspace keeps a correlatable identity across renames/moves). This field is optional and unvalidated — omit it for existing workspaces rather than retrofitting one.

**B4. Validation & Visual Checklist**:
Validate via `innfo-mcp_validate_model` and output the Visual Expectation Checklist (§12).

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
> **The MCP server (`innfo-mcp`) and the canonical specifications are the ONLY source of truth (SSOT) for syntax and data types.** The agent does NOT reproduce grammar rules from memory; it queries them dynamically via MCP (`innfo-mcp_get_spec` / `innfo-mcp_get_template`).

### iNNfo Level Summary (V_0-2-0)

| Level | Role | Syntax & Structure |
|---|---|---|
| **0** | Meta-specification (`defiNNe`) | Defines the meta-rules for specifications. |
| **1** | Concrete Specification (`iNNfo`) | Level 1 meta-template. Defines the 4 root primitives (`Concept Definition`, `Field Definition`, `Matrix Definition`, `Marker Definition`). |
| **2** | App (App / Specialization) | An iNNfo document with lightweight frontmatter (`level: 2`). The body instantiates the 4 root primitives as Markdown elements. **FORBIDDEN to put `concepts: []` or `fields: []` in the YAML frontmatter.** |
| **3** | Data Model | Instantiates the concepts and fields defined by its parent app (`parent_spec`). |

---

## 1. MCP Operating Model

The `innfo-mcp` server exposes 15 deterministic tools built on `@cognnitive/innfo-core`.

| Tool | Purpose |
|---|---|
| `list_models` | Scans the directory for valid iNNfo models. |
| `read_model` | Parses a model into a structured AST / JSON. |
| `get_spec` | Dynamically resolves the Level 1 specification. |
| `get_template` | Dynamically resolves the Level 2 app and its primitives. |
| `validate_model` | Runs deterministic syntactic and schema validation (with a `(searched: ...)` diagnostic when the parent chain does not resolve). |
| `check_workspace` | Runs one consolidated workspace integrity pass over every Level-3 model: validates each against its app and traceability, self-heals missing app packages/specs (write-once hydration), classifies each pinned app version against the published catalog, and returns one report with a per-model status and a workspace aggregate. Non-blocking and informational — validation failures never fail the tool. Accepts `root`, `summary_only` (aggregate + failing/upgrade-available models only, capped at 25), and `offline`. The editor runs the same pass on workspace open. |
| `validate_model_url` | Validates a model from a URL without writing it to disk. |
| `validate_template` | Validates a Level 2 app against its parent Level 1 specification. |
| `apply_change` | Runs deterministic mutations (add field, rename, `bump_version`, etc.). |
| `list_templates` | Lists Level 2 apps in the workspace, the global cache, and installed skills. |
| `hydrate_template` | Atomically and immutably copies a Level 2 app into the workspace. |
| `prune_orphaned_specs` | Analyzes reachability and purges orphaned specs with a zip backup. |
| `sync_workspace_manifest` | Additively reconciles the `## NN Models` entries of the manifest against the Level 3 models discovered on disk (`dry_run` defaults to `true`). See §14. |
| `list_template_procedures` | Discovers SOP procedures transitively across the `includes` tree (depth 10). |
| `list_template_skills` | Discovers agent skills transitively across the `includes` tree (depth 10). |

**Golden Rule:** The specification/app URL always comes from `parent_spec.url` or from the user. Never hardcode or invent URLs.

---

## 2. Canonical Specification Reference

Stable reference URLs (the version lives in the file name — `main` is already content-pinned):
- **iNNfo (Level 1):** `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-0_NN.md`
- **Business (Level 2):** `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/business_V_0-2-0_NN.md`
- **Procedures (Level 2):** `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/procedures_V_0-2-0_NN.md`
- **Organization (Level 2):** `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/organization_V_0-2-0_NN.md`

### The `parent_spec.url` Rule for Level 3 Models

1. A Level 3 model's `parent_spec.url` must be a **STABLE (http/https)** URL pointing at the Level 2 app, or a **workspace-relative path** (e.g. `specs/MyTemplate_V_0-1-0_spec_NN.md`).
2. **FORBIDDEN: absolute Windows paths** (e.g. `C:/Users/.../MyTemplate_spec_NN.md`): they break resolution in the Modeler (fetch over a local path) and in the MCP. The `innfo-mcp` resolver (`resolver-node.ts`) looks for the app only under the workspace's `specs/` (recursively); the canonical form is the stable http URL.
3. After setting `parent_spec.url`, ALWAYS verify resolution (see §5, parent-chain pre-check) before declaring the model done.
4. **Relative paths resolve against the MCP server's root** (the `INNFO_MODELS_DIR` environment variable, or the process cwd when the server starts), NOT against the model file's own folder. Therefore, to validate a workspace with relative paths, the MCP root MUST be the workspace root; `root:` overrides only apply where the tool accepts them (`validate_model` with `root`, `get_spec`/`get_template` with `url`).
5. **The resolver AUTO-CACHES every resolved parent** (local or remote) into `<workspace>/specs/`, under the document's own canonical versioned file name (write-once: if a file with that name already exists, it is never overwritten). There is no separate cache directory — `specs/` is the only local lookup, recursive, relative to the MCP server's `root`. (Note: `.spec-cache/` and `.specs/` are scanned only by the in-browser editor, as an extra heuristic for a version notice — they are not part of the MCP's real resolution; do not copy files there expecting the MCP to use them.) If a resolution fails, check that the MCP `root` points at the workspace root so relative paths resolve correctly. NEVER copy files into `specs/` by hand — let the resolver sync them.

---

## 4. Source Citation Protocol (`sources::`)

1. **Optional:** `sources::` is an **OPTIONAL** traceability property. It does not syntactically invalidate a Level 3 model if absent.
2. **Sources and Path Resolution:** Normalized sources live in the Source Collection (`sources/nn/`). **Every unqualified path resolves against `sources/nn/` by default**, removing redundant prefixes:
   - Simple relative paths: `client_interview_transcript.md#feedback` resolves canonically to `sources/nn/client_interview_transcript.md`.
   - Subfolders: `interviews/interview_transcript.md#overview` resolves to `sources/nn/interviews/interview_transcript.md`.
   - The explicit `sources/nn/` prefix is still tolerated for backward compatibility.
    - **A Model is a first-class Source.** `models/<path>.md@<unit>` is a valid citation target with the identical `path@unit` syntax as a Source — the parser (`parseKnowledgeUnitRef`) and validator already resolve it. Citing a Model element chains provenance: `artifact → models/x.md@## Concept: Element → sources/nn/1.md@## Section`. Model paths are always explicit (`models/…`); only unqualified paths default to `sources/nn/`.
    - **Curated CSVs are citable.** `sources/nn/<file>.csv@<row-id>` addresses the row whose first-column value equals `<row-id>` (e.g. `metricas_q3.csv@104`); append `&<column>` for one cell (`metricas_q3.csv@104&mrr_usd`). Raw uploads under `sources/original/` are never citable.
   - **Heading-level convention (authoring rule).** So model-heading slugs are stable and meaningful: `# NN <Concept>` (H1 = Concept), `## NN <Concept>: <Element>` (H2 = Element), and `###`+ only inside an element's description/prose — never as standalone structural blocks. The slug algorithm is level-agnostic; this is discipline, not validation.
   - Global PIDs use schema identifiers: `doi:10.1145/3290605.3300233`.
3. **Staging Isolation (`sources/staging/`):** The `sources/staging/` folder is a transient extraction buffer (OCR, Whisper, etc.) and is **NEVER a valid citation target**. Models only cite normalized sources under `sources/nn/`.
4. **Exact grammar and stable anchors:**
   ```
   sources:: <ref>
   sources:: [<ref>, <ref>, ...]

    <ref>  ::= <relative-path>@<unit>( &<subunit> )*
    <unit> ::= <level><slug>          (Markdown: `@## Section`, header level preserved)
             | <row-id>               (CSV: `@104`, explicit first-column value)
    <subunit> ::= <field-name> | <column-name>   (names only, never values)
    ```
    - Markdown units keep their header level (`@#`, `@##`, `@###`) and slugify GitHub-style, except the `Concept: Element` boundary which stays visible as `--` (e.g. `@## NN Person: Dr. Egon Spengler` → slug `nn-person--dr-egon-spengler`).
    - Numeric line ranges (`#L1-L10`) and legacy `#slug` fragments are **deprecated** (the latter still validates with a warning during transition) — ranges are fragile under reformatting, bare slugs are level-blind.
    - Every unit must resolve in the cited document; queries (`?filter=…`) are NEVER valid inside `sources::` — they belong to retrieval tools, not provenance.
5. **`sources::` is ALWAYS a bracketed list `[...]`, even for a single source.** The L1 spec requires `sources:: [sources/nn/<filename>@<unit>, ...]` — it MUST always be formatted as a list enclosed in brackets `[...]`, even when referencing a single source document. There is no scalar syntax and no bracket omission for a single value (see `iNNfo/specs/iNNfo_V_0-2-0_NN.md`). In `type:: reference` fields, the WikiLink syntax `[[...]]` is separately mandatory (see §8d and Core Rule 12):
   ```markdown
   ## NN Stakeholders: Enterprise Customer
    sources:: [sources/nn/client_interview_transcript.md@## Key Feedback, sources/nn/notes_source.md@## Key Points]
   relationship_model:: B2B Long-term

   ## NN Stakeholders: Pilot Customer
    sources:: [sources/nn/notes_source.md@## Key Points]
   relationship_model:: Trial
   ```
6. **Granularity: element-level, not individual-claim level.** `sources::` covers the set of sources backing the WHOLE element (all its fields together) — there is no per-field or per-sentence citation mechanism inside a domain model. If different fields of the same element come from different sources, list the union of them all in the element's single `sources::`. Claim-level citation (via standard `[^1]` footnotes or bibliographic formats) is a separate mechanism, used only inside artifacts generated from the model (see `nn-trannsform/SKILL.md` §4) — never inside a `*_NN.md`.
7. **No duplicates or empty references.** Do not repeat the same `<ref>` twice in one list. If there is no real source to cite, omit the whole field — do not write `sources:: []` or a placeholder value.
8. **Conversational instruction:** If the project has files under `sources/nn/`, the agent should suggest adding `sources::`. If it is a greenfield / creative model from scratch, the agent does NOT request or require citations. In both cases the skill's general rule applies: never invent a `<ref>` or content that is not verifiably present in the cited file.
9. **Retrieval queries (`?`) are never provenance.** A `path?filter=value` expression (e.g. `metricas_q3.csv?segmento=Enterprise`) selects a SET of units for retrieval tools — it MUST NEVER appear inside `sources::` (the validator rejects it: run the query, then cite the resulting `@` pointers). `@` addresses one unit; `?` selects many; the two never mix in one string.

---

## 5. Operating Instructions & MCP Flow

1. Get the app with `innfo-mcp_get_template({ url })`.
2. Present concepts to the user using the format with `[a] (Recommended)`.
3. Draft the body using the unified syntax `# NN <Concept>`, `## NN <Concept>: <Element>`, `key:: value`.
4. Validate the model with `innfo-mcp_validate_model({ content })`.
5. **Parent-chain pre-check (MANDATORY before reporting done):** resolve the parent chain with `innfo-mcp_get_template({ model_id })` (or `{ url }`) BEFORE declaring the model done. If the app does NOT resolve (`Template could not be resolved` / `PARENT_RESOLUTION_FAILED`):
   - Do NOT report the model as done.
   - Warn that the app is unresolved, showing the problematic `parent_spec.url`.
   - Read the new actionable `(searched: ...)` diagnostic returned by `validate_model` / `get_template`: it lists the directories the resolver searched for the parent. If the searched directories look wrong (e.g. they don't point at the workspace root), the problem is the **MCP root** (`INNFO_MODELS_DIR` or the server cwd), not the model: fix the root/URL and re-validate (see §2, rule 4).
   - Offer to fix it: a stable http/https URL or a workspace-relative path (never an absolute Windows path — see §2).
6. When finished, show the **Visual Expectation Checklist (§12)** and the **Contextual Navigation Shortcuts (§13)** section.

#### Canonical `.md` write path (MANDATORY)

Every skill-driven `.md` write (new model, app, specialization, or full-file rewrite) MUST go through a single canonical path so files validate cleanly:

1. **Preferred:** scaffold via `innfo-mcp_init_model` (frontmatter version inferred from the resolved parent — never hand-written), then apply content with `innfo-mcp_apply_change` or a documented file-write tool.
2. **Encoding:** UTF-8 without BOM, LF line endings, exactly one trailing newline.
3. **FORBIDDEN:** shell `echo` / `printf` redirection for file writes — they mangle encodings, join lines, and drop trailing newlines.
4. **Verify:** accented characters MUST round-trip byte-identical; re-validate with `innfo-mcp_validate_model` — no encoding or line-joining diagnostics may appear.

#### Agent Modification provenance (MANDATORY on every successful `apply_change`)

Whenever an `innfo-mcp_apply_change` call returns `success: true` **and** a `modification` field, you MUST paste that block **verbatim** into your reply, under its own `## NN Agent Modification: <slug>` heading exactly as returned (the block already opens with that heading — reproduce it, do not re-slug it). This makes the synthetic reasoning addressable by heading-slug, so a promoted `_source.md` transcript is citeable via `@` pointers — pasted modifications via `sources:: [conversations/<session-slug>_source.md@## NN Agent Modification: <scope>]` and transcript turns via `sources:: [conversations/<session-slug>_source.md@## NN Turn NN: <author-id>]`. The `#` fragment form (`#<slug>`) MUST NOT be used for `## NN …: …` headings: the Concept/Element boundary in their slug contains `--`, which `parseSourceRef` rejects (`KU_MALFORMED`).

- The returned block carries `rationale:: _`. Replace `_` with your concrete reasoning for the change **at paste time** — the pasted block MUST NOT keep an unfilled `rationale:: _`.
- The returned block carries `author:: _`. Replace `_` with your own tool id — the identifier of the agent you are (e.g. `OpenCode`, `Antigravity`, `ClaudeCode`) — **at paste time**; the pasted block MUST NOT keep an unfilled `author:: _`.
- Pass `rationale` (and, when the user explicitly authorized the change, `approved_by: "user"`) and your own `author: "<your-tool-id>"` in the `apply_change` `args` so the block is populated at the source: `args: { …, rationale: "why", approved_by: "user", author: "<your-tool-id>" }`. The tool id you pass IS the id you paste — same identifier convention.
- On a **failed** mutation (`success: false`, no `modification`), do NOT fabricate a block.
- One heading per successful change; do not merge multiple modifications under one heading.

#### Atomic version bump

To raise the version of a Level 3 model and its associated app (parent_spec), use the MCP's `bump_version` operation — do NOT edit the frontmatter by hand:

```
innfo-mcp_apply_change({
  id: "<model_id>",
  op: "bump_version",
  args: { 
    version: "V_0-5-0",
    parent_version: "V_0-5-0" // Optional: to re-version and rename the associated app
  }
})
```

- **Automated Behavior**:
  1. Updates `model_version` in the frontmatter and renames the model file atomically.
  2. If `parent_version` is provided, physically renames the local app file, updates its `spec_version` (in frontmatter), updates `parent_spec.name`/`url` in the model frontmatter, and copies the renamed app to the `specs/` directory.
  3. Consistently updates references in workspace `index.md`.
  4. Everything is validated via pre-check before performing any write (if validation fails, aborts without writing).
- **Remaining manual checklist**: If the app was remote, remember to push it to its corresponding server or repository.

---

## 6. Rename Safety & Referential Integrity

When a Concept or Element must be renamed:
* **Delegate to the MCP:** The agent does NOT perform blind manual find-and-replace. It uses `innfo-mcp_apply_change` with the matching rename operation (`rename_concept` or `rename_element`) to guarantee deterministic updates of `[[Concept]]` WikiLinks, matrices, and cross-references.

---

## 7. Delegation & Fallback Contract

* **With MCP available:** NEVER resolve specifications by hand or validate manually. Delegate to `innfo-mcp_get_spec`, `innfo-mcp_validate_model`, and `innfo-mcp_apply_change`.
* **Fallback mode (no MCP):** Inspect local files on disk and check that the `# NN`, `## NN`, `key:: value` syntax and the lightweight Level 3 YAML frontmatter are respected.

---

## 8. Field Creation & Change-Preview Protocol (Option D)

Every field must declare an explicit `type` (`string`, `select`, `reference`, `markdown_inline`, `markdown_file`, `image`, `file`, `video`, `audio`, `model`).

> 💡 **Submodel Fields (`type:: model`)**: When you need a field to reference or contain another iNNfo model document (`*_NN.md`) with app enforcement (e.g. `target_template:: business`), use `type:: model`. Never claim that `type:: model` or submodel composition does not exist — it is a fully supported normative primitive in iNNfo (V_0-2-1+).

> ⚠️ **List syntax — NEVER use quotes without brackets.** For any field with multiple values (`reference`, `sources::`, or any other list type), the only valid format is `[a, b, c]` — no quotes around each value. The format `"a", "b"` (individual quotes, no enclosing brackets) **corrupts parsing silently**: the validator treats it as a single unreadable string instead of a list, and ends up reporting a generic dangling reference without explaining the real cause. If you see that error and the field has loose quotes with no `[...]`, this is almost certainly the cause.

### Change Preview with Diff (Option D)
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

Once the user confirms, run the mutation via `innfo-mcp_apply_change` and re-validate with `innfo-mcp_validate_model`. Feed the "Rationale" line from this preview into `apply_change` as `args.rationale`, and — since the user just confirmed — pass `args.approved_by: "user"` and `args.author: "<your-tool-id>"` so the block is populated at the source. Then paste the returned `modification` block verbatim per §5 (Agent Modification provenance).

---

## 8b. Asset & Image Field Protocol

* **Explicit type:** Always use `type:: image` for image paths or URLs (never `string`).
* **Specification rules:** The primary image resolution rule (Rule 1) and the grammar of the free companion field `<field>_metadata` with single-line CSL-JSON citations are officially defined in the Level 1 Specification (`iNNfo_NN.md`).
* **Agent interaction:** If the user includes images or assets with attribution information, the agent suggests adding the `<field>_metadata` field with the matching CSL-JSON citation.

---

## 8c. Coherence & Solidity Analysis — "Architecture Assistant" Mode (Option C)

When the user picks option `[d]` (Analyze coherence), the agent takes the role of **Architecture Assistant**:

1. Load the model (`read_model`) and its app (`get_template`).
2. Evaluate the 4 layers: **Formal Correctness**, **Logical Coherence**, **Semantic Coherence**, and **Solidity/Robustness**.
3. **Presentation with Functional Impact (Assistant Mode):**
   Do not just list technical errors; explain the **business/functional risk** and offer the **1-click fix**:

```markdown
🧠 Architecture Assistant Diagnosis:

1. ⚠️ [Logical Coherence] Broken Reference
   - Finding: Element `Enterprise Customer` references `CommercialDirector`, which does not exist.
   - Functional impact: It will break the navigation-tree links in iNNfo Modeler.
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

1. **Ad-hoc tagging at Level 3**: Any Element or Concept in a Level 3 model may declare the `tags::` property for free-form categorization *on the fly*, without modifying the Level 2 app or predefining a `Marker Definition`.
2. **List syntax**: Written as an inline list `tags:: [urgent, sprint-1, vip-client]` (or `tags:: urgent` for a single tag). For multiple values, the bracketed `[...]` syntax is MANDATORY.
3. **Agent use**: When the user asks to "filter or act only on elements with tag X", the agent MUST inspect the `tags::` fields of each Element/Concept to restrict its scope to the matching entities only.
4. **Coexistence with Markers**: `tags::` are lightweight plain-text labels. If the user needs an icon, color, weight, or participation in comparative matrices, the tag can be promoted to a formal Level 2 `Marker Definition`.

---

## 9. Specialization Strategy

When a model needs custom concepts or fields beyond the base app:
1. **NEVER modify** specifications published under `specs/`.
2. Create a specialization app file `<Model>_<Template>_V_x-y-z_spec_NN.md` with `level: 2`.
3. Point the Level 3 model's `parent_spec.url` at the specialization file.
4. **The workspace `index.md` lists ONLY Level 3 models.** A `_spec_NN.md` file (Level 2 app / specialization) MUST NOT be listed as a model in `index.md`: it is resolved as an app via `parent_spec.url` and rendered as a `spec:` node, never as a model in the navigation tree.

> **Note — 100% new app (no base to specialize):** When Phase A (§0c) results in a from-scratch design, with no canonical app as a base, the file is named `<Template>_V_0-1-0_spec_NN.md` (without the `<Model>_` prefix, because there is no base to specialize). The rest of the flow — the Level 3 model's `parent_spec.url`, `index.md` listing only Level 3 models — applies the same.

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
1. Run `innfo-mcp_validate_model()`.
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
      - Files: `models/Master_V_0-1-0_NN.md` and `models/subsystems/`
      - iNNfo code: The main model references subsystems via `file_ref:: ./subsystems/auth_V_0-1-0_NN.md`

  [b] Option 1: Single Monolithic Model
      - File: `models/System_V_0-1-0_NN.md`

  [c] Option 2: Independent Models in the same directory
      - Files: `models/DomainA_V_0-1-0_NN.md`, `models/DomainB_V_0-1-0_NN.md`

  [d] Option 3: Multi-Folder Hybrid per Project
      - Files: `projects/domainA/models/index.md`, `projects/domainB/models/index.md`

  [x] Cancel

*(Notice: You can select one option or a combination (e.g. A and B))*
```

---

## 12. Visual Expectation Checklist (App Verification)

Upon completing the creation or modification of a model, the agent MUST print the Visual Checklist with dynamic deep links instead of the generic `https://cognnitive.com/innfo/app/`.

### Deep URL construction instruction:
- **Base URL**: `https://cognnitive.com/innfo/app/?view=editor`
- **Model Query Parameter**: `&model=<model_id>` (where `<model_id>` is the model identifier/filename without extension, e.g. `arenzano_V_1-2-0_business`).
- **Workspace Query Parameter** (optional): `&ws=<workspace_folder_name>` — the root folder name of the workspace where the model lives (e.g. `rejas_rehabilitacion`). Include it whenever the workspace folder is known: it lets the editor reopen the correct workspace from the recent list instead of the most recently opened one. Links to models living in different workspaces MUST each carry their own `&ws=`. When the folder name is unknown, omit `&ws=` — the editor then resolves the model across the user's recently opened workspaces.
- **Concept Deep Link (Hash)**: `#@<ConceptName>` (URL-encoded if containing spaces, e.g. `#@Market%20trends`).
- **Element Deep Link (Hash)**: `#<ConceptName>.<ElementName>` (e.g. `#Products.CogNNitive`).

If there is an active model in context, use its `model_id` and show interactive links to its main sections.

Example of dynamic checklist to generate:
```markdown
📋 Visual Expectation Checklist in iNNfo Modeler (assuming workspace is already open):

- [ ] 🌳 [**Navigation Sidebar Tree**](https://cognnitive.com/innfo/app/?view=editor&model=<model_id>&ws=<workspace_folder_name>):
      Hierarchical structure based on `# NN index` with fluid navigation across concepts and elements.
- [ ] 📋 [**Concept Field Panels** (e.g. <Concept>)](https://cognnitive.com/innfo/app/?view=editor&model=<model_id>&ws=<workspace_folder_name>#@<Concept_url_encoded>):
      Detailed view rendered for each `key:: value` (properties, types, and references).
- [ ] 🎴 [**Element Cards** (e.g. <Element>)](https://cognnitive.com/innfo/app/?view=editor&model=<model_id>&ws=<workspace_folder_name>#<Concept_url_encoded>.<Element_url_encoded>):
      Interactive cards for each `## NN <Concept>: <Element>` block showing metadata and descriptions.
- [ ] 📊 [**Comparative Matrix Tables**](https://cognnitive.com/innfo/app/?view=matrices&model=<model_id>&ws=<workspace_folder_name>):
      N-to-M relationship tables and `item-markers matrix` rendered with interactive cells (`X` / `-`).
```

---

## 13. Contextual Navigation Shortcuts / Quick Actions (Option E)

Upon concluding the generation or editing of a model, the agent MUST include logical shortcuts based on current context. When finishing a new model, the first option MUST be guided review:

```markdown
📌 Suggested next steps:
- [a] (Recommended) Guided review of generated concepts and elements
- [b] Run Architecture Assistant audit ([d])
- [c] Edit or add a new concept/element
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

The workspace manifest (`workspace_NN.md`, section `# NN Models`) can drift out of sync with the filesystem: a new Level 3 model is created and nobody adds its entry, or a file is deleted and the manifest entry keeps pointing at a model that no longer exists. The MCP's `sync_workspace_manifest` tool reconciles this additively, never destructively:

- Adds a `## NN Models: <name>` entry (marked with `<!-- nn:auto -->`) for every discovered Level 3 model not yet listed, always at the end of the `# NN Models` section — never reordering or regrouping existing entries.
- Sets `status:: archived` on an entry the tool itself created (identifiable by `<!-- nn:auto -->`) when its file no longer exists on disk — never deleting it.
- Reactivates (`status:: active`) a previously archived tool-owned entry if its file reappears.
- **Never modifies an entry without the `<!-- nn:auto -->` marker**, leaving it completely intact whether or not its file exists. Every hand-authored entry is untouchable by design.
- Excludes from discovery the manifest itself, any model whose app is `cogNNitive` or `workspace` (in any version — those are lineage records, not navigation references), and anything outside the reconciliation scope (`backups/`, `archive/`, `specs/`).

**Invocation protocol (mandatory — same pattern as the Change Preview with Diff, §8):**
1. Run first with `dry_run: true` (the default) and inspect `changes` and `diff` in the response.
2. Present the user a natural-language summary of the proposed changes (how many entries would be added, which would be archived/reactivated) before writing anything.
3. Only after the user's explicit confirmation, call again with `dry_run: false` to persist the changes to disk.

---

## 15. External Watch Roots & Pre-Authoring Scanner Integration

When authoring or auditing models that rely on external data drops (e.g. client spreadsheets, RFPs, audio transcripts):
1. **Detect Declarative Watch Roots**: Check if the workspace provenance model (`workspace_NN.md` or `<Project>_V_0-2-0_cogNNitive_NN.md`) defines a `## NN External Watch Roots:` section.
2. **Pre-Authoring Scan Check**: Before updating or creating a model citing dynamic sources, offer to scan external roots:
   > *"This workspace defines external watch roots. Would you like to scan for new or evolved primary sources before authoring?"*
3. **Execution**: Invoke `node actioNN/skills/nn-trannsform/scripts/index.js --scan-external --check-impact` to inspect external changes, import timestamped snapshots (`YYYYMMDD-HHmmss`), and check source family evolutions.

innfo-mcp_sync_workspace_manifest({ dry_run: true })
// review result.changes / result.diff with the user before continuing
innfo-mcp_sync_workspace_manifest({ dry_run: false }) // only after explicit confirmation
```

This is the headless / CLI-equivalent path for actioNN — there is no separate `nn` binary; synchronization always goes through the existing MCP bridge (`innfo-mcp`), like every other tool in this skill.

---

## 15. Model Procedure & Skill Discovery

Executable procedures and agent skills are content declared dynamically in models and apps (not a fixed catalog in the skill). They are discovered by calling the MCP tools `list_template_procedures` and `list_template_skills`, which transitively walk the `parent_spec` hierarchy and the `includes` composition tree to a depth of 10 levels, deduplicating procedures by `id` and skills by `name`.

Additionally, procedures are discovered by reading the `## NN Procedure: ...` sections of the active model and the workspace's `procedures/` folder (`*_procedures_V_0-1-0_NN.md`).

The template console procedure (historically referred to as "master.html", "showroom", or "gallery") generates the canonical interactive console for a model (e.g. `business_console.html`, `procedures_console.html`). For multi-model workspaces, the `workspace_hub` procedure generates the aggregated workspace portal (`artifacts/workspace_hub.html`). If the user asks for a "console", "master", "hub", "showroom", "gallery", or "visual framework", offer to generate the corresponding canonical console or workspace hub.

---

## 16. Context Efficiency: Intent, Slices, Budgets

Every automated call declares its context budget and intent class. Nothing travels "just in case". Diagnostic codes are defined by `validator-robustness` (referenced, not re-specified).

### 16a. Intent declaration (`intent:`)

Each call MUST declare exactly one intent — `coach`, `surgical`, `verify`, or `match`:

```yaml
intent: surgical   # coach | surgical | match | verify; omit = current behavior
override_intent: verify  # always wins when present
```

1. An undeclared intent MUST default to current behavior (no-op) — omission never breaks a call.
2. A manual override MUST always be available and MUST take precedence over the declared intent. When the declared intent proves wrong mid-task, the operator overrides it and execution continues under the override rules.
3. Work spanning two intents MUST declare the broader (more expensive) intent.

### 16b. Slice-first reads for surgical work

Surgical work (few elements of one concept) MUST read bounded slices through existing query units and MUST NOT include whole files. No included unit SHALL exceed 150 lines without an explicit slice or recorded override:

1. Assemble surgical context as one concept slice plus schema excerpt: `read_model` with `concept` + `element` + `max_lines` (default 150), and `query_units` with capped projections. A unit over 150 lines included whole, without slice or override, is a caller violation — not a server error.
2. When the needed context spans the cap, record a manual `override_reason` alongside the call; the wider unit MAY then be included.
3. Honor the `truncated` flag: when set, the slice is partial — narrow the query instead of widening the read.

### 16c. Differential verify prompts

`verify` prompts MUST carry only outcome data and MUST NOT embed full logs or rendered artifacts; full logs remain on disk by path reference:

1. Build the prompt from `validate_model(baseline_path)` as `{ exit, new_errors, verdict, log_path }` — exit status plus errors new against the baseline only.
2. A clean run carries the verdict only; historical errors are never re-explained.

### 16d. Per-intent budgets and measurement

| Intent | Budget rule |
|---|---|
| `coach` | SHALL be few calls but MAY consume up to half the session budget |
| `surgical` / `verify` | SHALL form the majority of calls at a fraction of the cost each |
| `match` | MUST NOT carry raw sources |

Each session MUST record per-intent call and token counts via the `usage-counters.js` convention: caller-side JSONL append of `{ ts, intent, inputTokens, outputTokens }`, defaulting to the OS temp directory (session-scoped, never the workspace tree — an explicit workspace path is opt-in only). One promotion per change MUST be benchmarked before versus after, recording per-intent call/token totals and the measured reduction.

---

## Core Rules

1. **Strict V_0-2-0 Meta-template:** Level 2 apps define primitives in the body (`# NN Concept Definition`). NEVER put `concepts: [...]` or `fields: [...]` in the Level 2 YAML frontmatter.
2. **Unified NN syntax:** Use `# NN <Concept>`, `## NN <Concept>: <Element>`, `key:: value`. Do not use obsolete `_NN` bullets or ````yaml` code blocks.
3. **Optional, up-to-date Source Citations:** `sources::` is optional; it resolves canonically against the Source Collection (`sources/nn/`) without a redundant prefix, anchors to knowledge units (`@<unit>`), and takes bracketed lists `[a, b]` for multiple sources (no `src-xxx` IDs, no `#L...` line ranges, no `sources/staging/` buffer).
4. **Zero Unilateral Mutation:** Never rename or move files without explicit confirmation.
5. **Recommended Option First:** Always prefix option `[a]` with `(Recommended)`.
6. **Multi-Selection Notice:** Include `"You can select one option or a combination (e.g. A and B)"` when applicable.
7. **Change Preview with Diff:** Show a natural-language summary before applying any MCP mutation.
8. **Architecture Assistant Mode:** In the `[d]` audit, explain business/functional risks and offer 1-click fixes.
9. **Contextual Shortcuts:** End every response by offering 2-3 suggested next actions (Quick Actions).
10. **Full MCP Delegation:** Query types, schemas, and validation from the `innfo-mcp` server; do not guess or duplicate the grammar.
11. **Index Block Scope (`# NN index`):** The `# NN index` is reserved exclusively for workspace manifest documents (`workspace_NN.md` / `index.md`) and Level 2 templates (defining the taxonomy hierarchy of Concepts). Level 3 domain data models (`models/*_NN.md`) MUST NOT contain a root `# NN index` block; navigation in Level 3 models is derived dynamically from Concept and Element headings.
12. **Mandatory WikiLink syntax in references:** In every reference field (`type:: reference`), the value MUST be formatted using WikiLink syntax (`key:: [[Element]]`). Plain text without WikiLink brackets is forbidden.
13. **Element descriptions in prose:** The description/explanation of an element in a Level 3 model must NEVER be written as a `description::` field. It must always be free-form Markdown prose below the `key:: value` field list, separated by a blank line.
14. **Active Model Selection Gate:** Never perform editing, validation, audits, or model procedure execution without a validated active model in context. Run workspace discovery first if none is set.
15. **Dynamic Quick Actions:** Only list procedure shortcuts in next steps if the model contains declared procedures.
16. **Free-form Tags (`tags::`)**: Any Element or Concept in a Level 3 model may declare `tags:: [tag1, tag2]` for free-form categorization without modifying the Level 2 app. Multi-tag syntax requires brackets `[...]`. Agents should use this field to filter and scope actions to tagged elements.
17. **Step 0 Schema Integrity Gate (MANDATORY)**: Always verify that `parent_spec` resolves cleanly before diagnosing or repairing child element fields, matrices, or references. If unresolved, halt and resolve schema reachability first.
18. **Mechanical Linting & BOM Encoding Sanitization**: Always enforce UTF-8 without BOM (`\uFEFF`), detect and disambiguate heading/slug collisions, and enforce clean V_0-2-0 frontmatter.

---

## Mechanical Linting & Upgrade Playbook

Deterministic instructions for identifying and mechanically repairing legacy syntax, corrupted encodings, and obsolete structural patterns:

1. **BOM Encoding Sanitization**:
   - Detect files containing UTF-8 Byte Order Marks (`\uFEFF` / `0xFEFF`).
   - Strip leading BOM characters upon reading and saving, strictly enforcing UTF-8 without BOM.
2. **Obsolete Level 3 `# NN index` Removal**:
   - The `# NN index` heading is reserved exclusively for workspace manifest documents (`workspace_NN.md` / `index.md`) and Level 2 templates, NOT Level 3 domain data models (`models/*_NN.md`).
   - When linting or refactoring Level 3 models, remove any root `# NN index` navigation blocks. Navigation in Level 3 models is derived dynamically from Concept headings (`# NN <Concept>`) and Element headings (`## NN <Concept>: <Element>`).
3. **Heading and Slug Collision Detection**:
   - Detect duplicate `## NN <Concept>: <Element>` headings within a model file that yield identical slugs (e.g. `## NN Person: Alice` and another `## NN Person: Alice`).
   - Prompt the user for disambiguation or rename duplicate elements deterministically using `innfo-mcp_apply_change` (`rename_element`).
4. **Frontmatter Standardization (V_0-2-0)**:
   - Ensure Level 3 frontmatter contains only valid metadata: `model_version`, `parent_spec: { name, url }`, `title`, and optional workspace/provenance tags.
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

1. **Read the template** (`get_template`) to obtain the defined Concepts
2. **Identify root Concepts** (first level of the index)
3. **Identify sub-Concepts** (if the app has hierarchies)
4. **Generate the index** listing ONLY Concepts, NOT Elements
5. **Validate** with `validate_template` that the index contains no Elements

### Elements↔Concepts Relationship

In Level 3 data models, Elements relate to their Concepts by:

1. **Section structure:** `## NN <Concept>: <Element>` declares that Element belongs to that Concept
2. **Reference fields:** `location:: [[Element Name]]` establishes relationships between Elements
3. **Matrices:** Matrices cross Elements from different Concepts

NEVER by hierarchy in a Level 3 index.
