---
title: "nn-start — Front Controller & Ecosystem Start Router"
description: "Primary Front Controller, ecosystem entry point, system governance, setup, preflight readiness gate, and skill router for cogNNitive."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-start
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn System & Start Router

**Skill**: `nn-start` · **Role**: Primary Front Controller & Governance

Primary Front Controller and single entry point for system governance, setup, environment readiness checks, and routing across the **cogNNitive** ecosystem.

---

## 0. Activation Gate

When invoked, `nn-start` immediately executes the canonical activation gate defined in [`nn-preflight`](skills/nn-preflight.md):
1. **Session Greeting Banner**: Prints the canonical ecosystem greeting.
2. **Deterministic Preflight Integrity Check**: Runs `node scripts/preflight-check.js` to verify dependencies and lockfile integrity.

---

## 1. Environment Readiness (Preflight Gate)

Before launching any specialized workflow, `nn-start` verifies:
1. **Preflight Runner**: Ensures the integrity check passes via `nn-preflight`.
2. **Node.js**: Requires `node --version >= 18`.
3. **MCP Server**: Verifies `innfo-mcp` responsiveness via `innfo-mcp_list_models` (or resolves bundle at `~/.agents/mcp/innfo-mcp.bundle.js`).
4. **Workspace Layout**: Confirms standard directory layout (`sources/`, `models/`, `procedures/`, `artifacts/`, `index.md`).

---

## 2. System Governance & UX Protocol (MANDATORY)

Every agent interaction across cogNNitive strictly enforces these foundational rules:

1. **Zero Unilateral Mutation (Consent First)**:
   - Moving, renaming, or deleting user files without prior explicit confirmation is strictly prohibited.
2. **Recommended Option First**:
   - In all menus, option `[1]` or `[a]` MUST be labeled with `(Recommended)`.
3. **Multi-Selection Notice**:
   - When options are non-exclusive, the agent explicitly clarifies:  
     `"You can select one option or a combination (e.g. A and B)"`.
4. **Visual Style Selection**:
   - Whenever generating visual components or web pages, prompt the user for design presets using [`nn-design-presets`](skills/nn-design-presets.md) (Morado Nazareno `#4D0E4E`).
5. **Conversation Logging Protocol**:
   - Every session persists an audit record under `conversations/YYYY-MM-DD_<model_name>_<topic>.md`.

---

## 3. Canonical Skill Catalog (7 Core Skills)

The cogNNitive ecosystem is streamlined into 7 specialized skills:

| Skill | Role & Scope | Invocation / Triggers |
| :--- | :--- | :--- |
| **[`nn-start`](skills/nn-start.md)** | Front Controller, governance, setup, preflight gate & routing | `NN`, `nn`, `/nn`, `/nn-start`, `setup` |
| **[`nn-preflight`](skills/nn-preflight.md)** | Environment readiness gate (Tier 1/2 checks) | `preflight`, `readiness`, `environment check` |
| **[`nn-innfo`](skills/nn-innfo.md)** | iNNfo model authoring, schema validation & Model Creation Wizard | `NN`, `nn`, `model`, `wizard`, `template`, `innfo` |
| **[`nn-trannsform`](skills/nn-trannsform.md)** | Document ingestion (PDF/DOCX/XLSX), normalization & procedures | `trannsform`, `transform`, `workflow`, `pipeline` |
| **[`nn-site-generator`](skills/nn-site-generator.md)** | Website generation, layout hydration & Docsify suites | `/nn-site-generator`, `generate site`, `create website` |
| **[`nn-skills-lifecycle`](skills/nn-skills-lifecycle.md)** | Skill installation, updates & manifest governance | `/nn-skills-lifecycle`, `install skill`, `update skills` |
| **[`nn-design-presets`](skills/nn-design-presets.md)** | Design system tokens (Morado Nazareno, 8px grid) | `design preset`, `morado-nazareno`, visual artifact styling |

---

## 4. How to Route

When a user prompt arrives:
1. Match the request against the canonical skill domains above.
2. If the user intent is ambiguous or simply `nn`, prompt the user to describe their current situation in one sentence, then recommend the single best-fit skill.
