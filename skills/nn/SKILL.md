---
name: nn
description: Primary Front Controller, ecosystem entry point, job loop menu ([s] Sources, [m] Models, [r] Review/Artifacts, [p] Procedures, [h] Help, [x] Cancel), system governance, and preflight readiness gate. Triggers: /nn, NN, nn, cognnitive, cognitive, start, router.
disable-model-invocation: false
version: "V_3-4-2"
last_updated: 2026-10-09
license: MIT
compatibility: opencode, claude-code, cursor, any agent supporting skills
metadata:
  source_type: original
bundled_blueprints: []
---

# nn Front Controller

The primary interactive entry point and front controller for the cogNNitive ecosystem.

---

## 0. Activation Contract

Activates whenever the user types `/nn`, `/start`, mentions `cognnitive`, `cogNNitive`, or begins an interactive session in a cogNNitive domain workspace.

---

## 1. Environment Readiness (Domain State Probe Gate)

Upon activation, `nn` executes the fast local domain probe as the **sole gate owner** for the session:
```bash
node skills/nn-preflight/scripts/domain-probe.js --workspace-dir . --json
```

The probe deterministically returns:
- **Layout**: `current` (canonical `kNNowledge/`), `legacy` (`models/`), or `mixed`. If legacy/mixed, offers migration via `nn-upgrade`.
- **Preflight status**: Checks node version, MCP server availability, and workspace integrity. Exit code 1 indicates non-blocking actionable warnings (surfaced to user without halting the session).
- **Domain state counts**:
  - `sources.pending_count`: unnormalized raw files in `sources/import/`
  - `knowledge.count`: active kNNowledge documents in `kNNowledge/`
  - `procedures.domain_count` & `procedures.blueprint_count`: available executable procedures

---

## 2. Job Loop Navigation Menu

`nn` organizes workspace operations into a continuous, job-oriented loop:

```
[s] Sources  ───►  [m] Model  ───►  [r] Review/Deliverables  ───►  [p] Procedures
```

### Recommendation Logic
The `(Recommended)` tag is dynamically assigned to the first actionable stage based on the probe results:
1. If `sources.pending_count > 0` → `[s] (Recommended)`
2. Else if `knowledge.count > 0` → `[m] (Recommended)`
3. Else (empty workspace) → `[s] (Recommended)`

### Menu Structure
```text
[s] (Recommended) Sources — Ingest, scan, normalize, or refresh sources (<N> pending)
[m] Model — Create, author, validate, or audit kNNowledge models (<N> models)
[r] Review & Deliverables — Generate/preview dashboards, sites, consoles, reports
[p] Procedures — Discover and execute domain & blueprint SOP procedures (<N> available)
[h] Help & Documentation — Explore blueprints catalog, specs, guides
[x] Cancel / Exit
```

---

## 3. Unified Procedure Catalog (Multi-Scope Execution)

When the user selects `[p]` or requests procedure execution, `nn` aggregates available procedures across three distinct scopes:

1. **Model Scope** (`[model]`): Procedures declared inline or attached to active kNNowledge documents.
2. **Blueprint Scope** (`[blueprint]`): Attached SOPs declared in the parent blueprint's `procedures/` folder (discovered via MCP `list_blueprint_procedures` or local `specs/bluepriNNts/<name>/procedures/`).
3. **Domain Scope** (`[domain]`): Global workspace procedures located in `procedures/`.

### Precedence & Disambiguation
If duplicate procedure names exist across scopes, precedence is:
$$\text{Model Scope} > \text{Blueprint Scope} > \text{Domain Scope}$$
Each option displays its origin badge (e.g. `[p1] Extract Key Risks [blueprint:business]`).

### Execution Owner
Once a procedure is selected, execution follows the canonical Procedure
Execution Protocol in `nn-innfo` §16-bis; `nn` routes the intent to that owner
and does not execute steps from its own text. Do not restate the protocol here.

---

## 4. System Governance & UX Protocol (MANDATORY)

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
<!-- /generated:shared-rules -->

### nn-specific additions

5. **Visual Design Selection (`nn-design-presets`)**:
   - When generating visual artifacts (HTML consoles, dashboards, sites), prompt for the visual preset using `nn-design-presets`.
6. **Session Language Coherence**:
   - Maintain the user's active conversation language across all prompts, responses, and menus throughout the session.
