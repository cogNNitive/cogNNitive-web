---
name: nn
description: Primary Front Controller, ecosystem entry point, job loop menu ([s] Sources, [m] Models, [r] Review/Artifacts, [p] Procedures, [h] Help, [x] Cancel), system governance, and preflight readiness gate. Triggers: /nn, NN, nn, cognnitive, cognitive, start, router.
disable-model-invocation: false
version: "V_3-4-0"
last_updated: 2026-10-01
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

Activates whenever the user types `/nn`, `/nn-start`, `/start`, mentions `cognnitive`, `cogNNitive`, or begins an interactive session in a cogNNitive domain workspace.

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

---

## 4. System Governance & UX Protocol (MANDATORY)

1. **Zero Unilateral Mutation (Consent First)**:
   - Prohibit moving, renaming, or deleting user files without prior explicit confirmation.
2. **Dynamic Recommendation First**:
   - The computed `(Recommended)` option is displayed first or highlighted with `(Recommended)`.
3. **Multi-Selection Notice**:
   - When options can be combined, notify: *"You can select one option or a combination (e.g. A and B)"*.
4. **Visual Design Selection (`nn-design-presets`)**:
   - When generating visual artifacts (HTML consoles, dashboards, sites), prompt for the visual preset using `nn-design-presets`.
5. **Conversations as Reference & Source Protocol (Zero Discard)**:
   - Silently allocate `conversations/YYYY-MM-DD_HHmmss.md` upon session start (`status: in_progress`).
   - Zero Discard Policy: all sessions are retained unconditionally.
    - Upon session close, suggest 3 descriptive titles (`[1] (Recommended)`), finalize frontmatter (`status: completed`), rename to `conversations/YYYY-MM-DD_<slug>.md`, and auto-promote to `sources/conversations/` (announce it; the user can opt out with `[none]`).
6. **Session Language Coherence**:
   - Maintain the user's active conversation language across all prompts, responses, and menus throughout the session.
