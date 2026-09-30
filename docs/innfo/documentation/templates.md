# Templates (Apps) Overview

iNNfo templates (Level 2 Specifications) define domain-specific schemas, concepts, fields, and procedures for modeling structured knowledge in a cogNNitive workspace.

All templates are validated against Level 1 (`iNNfo_V_0-2-1`) and are declared in the central catalog [`docs/innfo/templates/catalog.json`](https://github.com/cogNNitive/cogNNitive/blob/main/docs/innfo/templates/catalog.json).

---

## Shipped Level 2 Templates

| Template / App | Adopted Version | Description & Scope | Source Spec |
|---|---|---|---|
| **Video** | `V_0-3-2` | Video production, cogNNitive-video VUS scripts, voiceover & talking avatars | [`specs/templates/video/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/video/spec_NN.md) |
| **Business** | `V_0-2-5` | Composite template combining Business Model and Analysis | [`specs/templates/business/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/business/spec_NN.md) |
| **Business Model** | `V_0-2-3` | Value propositions, segments, and channels | [`specs/templates/business-model/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/business-model/spec_NN.md) |
| **Analysis** | `V_0-2-1` | Strategic analysis, SWOT, and evaluable matrices | [`specs/templates/analysis/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/analysis/spec_NN.md) |
| **Documentation** | `V_0-2-1` | Technical specifications and manual authoring | [`specs/templates/documentation/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/documentation/spec_NN.md) |
| **Design Presets** | `V_0-1-0` | Color palettes, typography presets, and visual styles | [`specs/templates/design-presets/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/design-presets/spec_NN.md) |
| **Procedures** | `V_0-2-2` | Step-by-step operational playbooks and workflows | [`specs/templates/procedures/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md) |
| **Projects** | `V_0-2-2` | Deliverables, milestones, tasks, and roadmaps | [`specs/templates/projects/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/projects/spec_NN.md) |
| **Organization** | `V_0-2-2` | Org charts, teams, roles, and responsibilities | [`specs/templates/organization/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/organization/spec_NN.md) |
| **Innovation** | `V_0-2-1` | Ideas, research hypotheses, and experimentation | [`specs/templates/innovation/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/innovation/spec_NN.md) |
| **Metrics** | `V_0-2-1` | Key Performance Indicators and quantitative tracking | [`specs/templates/metrics/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/metrics/spec_NN.md) |
| **Repository** | `V_0-1-1` | Source code repositories and package tracking | [`specs/templates/repository/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/repository/spec_NN.md) |
| **Sources** | `V_0-1-0` | External citations and reference catalogs | [`specs/templates/sources/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/sources/spec_NN.md) |
| **Workspace** | `V_0-6-0` | Top-level workspace layout and metadata | [`specs/templates/workspace_spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/workspace_spec_NN.md) |
| **Blank** | `V_0-2-0` | Minimal starter schema | [`specs/templates/blank/spec_NN.md`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/bluepriNNts/blank/spec_NN.md) |

---

## Three-Pathway Authorship & Review Architecture

iNNfo supports three complementary pathways for knowledge modeling, curation, and asynchronous stakeholder review:

1. **Pathway 1: Conversational AI (Pair Programming & Agents)**
   - Knowledge architects and developers converse with AI agents (Claude, Copilot, Antigravity) to generate, refine, and evolve Level 3 models from unstructured documentation, interviews, and source code.
2. **Pathway 2: Direct App GUI (Visual Workspace Editor)**
   - Interactive visual modeling through the Vue 3 workspace editor, allowing direct schema exploration, element graph manipulation, and rich data entry.
3. **Pathway 3: Asynchronous Console Review (Three-Tier Consoles)**
   - Domain experts and non-technical stakeholders review compiled standalone HTML consoles (`<Model>_V_<Version>_console.html`).
   - Features zero-build offline `file://` execution, persistent reviewer identity (`localStorage['innfo_reviewer_name']`), visual review badges on cards/rails, and a Universal Review Tab.
   - Stakeholders annotate and export standardized review JSON payloads (`<Model>_V_<Version>_<user>_review.json` adhering to `https://cognntive.dev/schemas/console-review-v1.json`) which are ingested back into Pathway 1 or Pathway 2 for automated model updates.

---

## Detailed Template Guides

- [Video App & Voice/Avatar Catalog](template-video)
- [Reviewer Guide & Asynchronous Consoles](reviewer-guide)
