---
name: nn-start
description: Primary Front Controller, ecosystem entry point, system governance, setup, environment readiness gate (Preflight), and skill router for cogNNitive. Invoke with /nn-start.
disable-model-invocation: false
version: "V_3-4-1"
last_updated: 2026-09-24
license: MIT
compatibility: opencode, claude-code, cursor, any agent supporting skills
metadata:
  source_type: original
bundled_blueprints: []
---

# nn System & Start Router

Primary Front Controller and single entry point for system governance, setup, readiness checks, and routing in the cogNNitive ecosystem.

---

## 0. Activation Gate & Workspace Entrypoint

Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check).

### Workspace `AGENTS.md` Session Entrypoint Contract
Every bootstrapped cogNNitive workspace contains an `AGENTS.md` file at its root with a mandatory **"Session Start: Load nn-start"** directive. AI coding agents (Cursor, Claude Code, OpenCode, Codex, Antigravity) starting an interactive session must:
1. Load `nn-start` (`skills/nn-start/SKILL.md` or `/nn-start`).
2. Run `nn-preflight` readiness verification.
3. Silently initialize or resume turn logging in `conversations/YYYY-MM-DD_HHmmss.md`.
4. Route user intent to the appropriate cogNNitive skill.

---

## 1. Environment Readiness (Preflight Gate)

Before launching any specialized workflow, `nn-start` verifies the environment:
1. **Preflight Runner**: Ensures the Integrity & Preflight Check passed via `nn-preflight`.
2. **Node.js**: Checks `node --version` (>= 18 required).
3. **MCP Server**: Verifies `innfo-mcp` responsiveness via `innfo-mcp_list_knowledge` (or resolves bundle at `~/.agents/mcp/innfo-mcp.bundle.js` or `.cogNNitive/mcp-bundle.js`).
4. **Workspace Layout**: Ensures workspace contains standard folders (`sources/`, `kNNowledge/`, `procedures/`, `export/`, `conversations/`, `index.md`). Ingestion branches are `sources/import/`, `sources/conversations/`, and `sources/export/` normalized into `sources/nn/` (legacy `sources/original/` and `artifacts/` supported via non-breaking fallback).

---

## 2. System Governance & UX Protocol (MANDATORY)

Every agent interaction across the cogNNitive ecosystem MUST follow these strict UX and governance rules:

1. **Zero Unilateral Mutation (Consent First)**:
   - Prohibit moving, renaming, or deleting user files (e.g. moving raw PDFs to `sources/import/` or restructuring user directories) without prior explicit confirmation from the user.
   - Always ask for confirmation before executing file movements or workspace restructures.

2. **Recommended Option First**:
   - In all decision menus or option lists presented to the user, option `[1]` or `[a]` MUST be labeled with the `(Recommended)` prefix.

3. **Multi-Selection Clarification**:
   - Whenever options are not mutually exclusive, the agent MUST add the explicit notice:
     `"You can select one option or a combination (e.g. A and B)"`.

4. **Visual Component & Artifact Style Selection (`nn-design-presets` Activation)**:
   - Whenever generating any visual component, web interface, HTML dashboard companion, site page, or styled deliverable artifact, the agent MUST ask the user which visual design style / preset to apply before generation.
   - This prompt MUST load and activate the **`nn-design-presets`** skill to retrieve branding tokens (e.g. `morado-nazareno`).

5. **Conversations as Reference & Source Protocol (MANDATORY)**:
   - **Silent Reservation & Continuous Turn Logging**: When an interactive session begins, immediately allocate `conversations/YYYY-MM-DD_HHmmss.md` with initial frontmatter (`status: in_progress`, `turns: 0`, `mutations: false`) without interrupting the user. Update the transcript on each turn to guarantee zero data loss even on abrupt client disconnects.
   - **Guaranteed All-Session Retention (Zero Discard)**: Never automatically delete or discard session transcripts. All sessions remain persisted in `conversations/` with their timestamp.
   - **Session Status Footer & Close Triggers**: On milestone responses or deliverables, provide a brief status footer (`💬 Sesión: conversations/... · Escribí "cerrar" o "/close" para titular y archivar`). Recognize natural close commands (`/close`, `cerrar`, `terminar sesión`, `listo por hoy`, `done`).
   - **Post-Session Title Suggestions**: Present 3 suggested title options with `[1] (Recommended) <title>` plus a manual entry option. Finalize frontmatter (`status: completed`, `ended_at: ISO_8601`) and rename the file to `conversations/YYYY-MM-DD_<slug>.md`.
   - **Promotion Prompt**: Prompt the user to promote the conversation transcript into workspace knowledge sources (`sources/conversations/`):
     - `[full] (Recommended) Full Transcript`: Promotes the verbatim dialogue with per-turn author attribution to `sources/conversations/<session-slug>_source.md`.
     - `[none]`: Leaves transcript in `conversations/` only.
     No executive-summary (`_summary.md`) or combined option is offered; `_summary.md` files are not produced by the standard promotion flow.
     Promoted sources link back via `origin_transcript: conversations/...` and are normalized into `sources/nn/conversations/` via `nn-trannsform` scanner for citation by models (`sources:: [conversations/<file>.md#<anchor>]`).

6. **Canonical Source Taxonomy (Zero Confusion Gate)**:
   - **Primary Sources (Fuentes Primarias)**: Raw files in `sources/import/`, `sources/original/`, or external watch roots (`## NN External Watch Roots:`). Includes documents and raw media (`.mp3`, `.wav`).
   - **Normalized Sources (Fuentes Normalizadas)**: Structured Markdown in `sources/nn/`. Companion media files sharing the same stem are linked via `media_file` frontmatter.
   - **Synthetic Sources (Fuentes Sintéticas)**: Deliverables re-ingested into graph (`is_synthetic: true`).
   - **User Input Sources (Entrada de Usuario)**: In-line conversational inputs (`inline:` / `chat:`), exempt from physical file checks.

7. **Optimistic Execution & Reversibility Protocol (Informative Grace)**:
   - **Convention over Confirmation**: For all safe, standard, idempotent, or reversible actions (e.g. working on the default `dev` branch, auto-binding a single discovered model, creating standard workspace layout folders, using the standard canonical app as-is without customization, running deterministic validation gates):
     - **NEVER block with numbered menus or redundant confirmation requests.**
     - **Announce intent with Informative Grace**, proceed immediately, and provide an effortless rollback/interruption path:
       `"Voy a avanzar con [acción estándar]. Si preferís otra opción o querés cambiarlo, avisame antes de empezar (o interrumpí en cualquier momento)."`
   - **Single Candidate Auto-Bind**: If dynamic discovery finds exactly 1 model/resource, bind it automatically and proceed. Never ask confirmation when there is only one option.
   - **Explicit Consent Exclusivity**: Reserve blocking confirmation gates strictly for irreversible or destructive mutations (permanent deletions, git hard resets, force pushes) or genuine architectural forks where no canonical default exists.

---

## 3. Canonical Skill Catalog (7 Core Skills)

The cogNNitive ecosystem is streamlined into 7 specialized skills:

| Skill | Role & Scope | Invocation |
|:---|:---|:---|
| **`nn-start`** | System governance, setup, preflight readiness gate & routing | User / `/nn-start` |
| **`nn-preflight`** | Environment readiness gate (Tier 1/2 checks) — loaded by `nn-start` and `nn-trannsform` before they proceed | Model (Auto) |
| **`nn-trannsform`** | Document ingestion (PDF/DOCX/XLSX), template transformation & procedures orchestration (`procedures_V_0-2-0_NN.md`) | User / Model |
| **`nn-innfo`** | iNNfo model authoring, editing, schema validation & step-by-step Model Creation Wizard (Meta-template V_0-2-0) | User / Model |
| **`nn-site-generator`** | Website generation & hydration | User / Model |
| **`nn-design-presets`** | Visual design system tokens (Morado Nazareno, 8px grid) — activated for visual artifacts | Model (Auto/User) |
| **`nn-skills-lifecycle`** | Install/update/audit skills from the remote manifest (Steward branch) | User / Model |

---

## 4. How to Route

1. Read the generated registry: [`.cogNNitive/skill-registry.md`](../../.cogNNitive/skill-registry.md).
2. Match the user's request against the 5 core skills above.
3. For model authoring/wizard → Load **`nn-innfo`**.
4. For documents, transformations or multi-step procedures → Load **`nn-trannsform`**.
5. For web design or site generation → Load **`nn-site-generator`** / **`nn-design-presets`**.

---

## If the user doesn't know where to start

Ask them to describe their current situation in one sentence, then recommend the
single best-fit skill from the registry — do not dump the whole list. Always format the recommendation with `(Recommended)` as option `[a]`.
