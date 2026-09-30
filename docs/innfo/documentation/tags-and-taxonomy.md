# Tags & Open Taxonomy

cogNNitive models support open-ended tagging across all architectural layers. This document outlines the **Open Taxonomy with Progressive Enhancement** pattern, which combines lightweight ad-hoc labeling at the model level with structured, visually enhanced taxonomies defined at the workspace root.

---

## 1. Concepts: Tags vs. Markers vs. Releases

To maintain clean architectural boundaries, cogNNitive cleanly distinguishes three dimensions of classification:

| Mechanism | Purpose | Scope | Schema Requirement |
| :--- | :--- | :--- | :--- |
| **Tags (`tags::`)** | Cross-cutting categorization, ad-hoc taxonomy, and multi-dimensional view filtering (e.g. `strategy-a`, `enterprise`, `q4`). | Model Elements and Concepts | **None** (ad-hoc, open vocabulary). |
| **Markers** | Quantitative evaluation, matrix intersections, and lifecycle scoring with formal widgets (`scale`, `cycle`, `boolean`). | Specific matrices and elements | **Mandatory** definition in Level 2 app (`spec_NN.md`). |
| **Releases / Snapshots** | Immutable point-in-time milestones for frozen baselines, pipeline inputs, and public distribution. | Whole model repository | Defined via version tags (`V_1-0-0`) and git tags. |

> [!TIP]
> **CONCEPTS > CODE**: Use **Tags** to filter the dimensional space (what elements belong to which strategy); use **Releases** to freeze the timeline (a verified baseline of the whole model).

---

## 2. Using Tags in Models (Ad-hoc / Open Vocabulary)

At the model level (Level 3), you can attach `tags::` to any Element or Concept heading without declaring them upfront in your app:

```markdown
# NN Oferta

## NN Oferta: Enterprise Cloud Platform
tags:: strategy-growth, b2b, enterprise
precio:: 12000
status:: active

## NN Oferta: Community Starter
tags:: [strategy-plg, open-source]
precio:: 0
status:: active

## NN Oferta: Premium Onboarding
tags:: strategy-growth, strategy-plg
precio:: 2500
status:: optional
```

### Syntax Rules
* **Comma-separated**: `tags:: strategy-a, b2b, core`
* **Bracket array**: `tags:: [strategy-a, b2b, core]`
* The parser normalizes tags to trimmed, lowercase strings (`string[]`).
* Elements can belong to one, multiple, or zero tags.

---

## 3. The Workspace Catalog: Progressive Enhancement

While tags can be created on-the-fly, workspaces (`workspace_NN.md`) can provide a centralized **Tag Catalog** to give semantic meaning, standardized colors, and icons to common tags.

### Workspace Specification (`workspace_spec_NN.md`)
The `workspace_spec` defines the `Tag` Concept and its fields:
* `color`: Hex code (e.g. `#10b981`) or design token for badge styling.
* `icon`: Lucide icon name (e.g. `rocket`, `layers`, `shield`).
* `description`: Semantic definition and strategic intent.

### Declaring Workspace Tags (`workspace_NN.md`)
```markdown
# NN Tag

## NN Tag: strategy-growth
color:: #10b981
icon:: trending-up
description:: Initiatives focused on enterprise revenue expansion and corporate accounts.

## NN Tag: strategy-plg
color:: #6366f1
icon:: users
description:: Product-Led Growth and community self-serve adoption.

## NN Tag: enterprise
color:: #f59e0b
icon:: building
description:: Mission-critical features required for Fortune 500 deployments.
```

---

## 4. Progressive Resolution in the Modeler & Procedures

When the cogNNitive visual editor (`innfo-editor`) or an agent procedure encounters a tag:

1. **Workspace Hit**: If the tag matches an entry in `workspace_NN.md`, it renders as an enriched badge with its designated color, icon, and a hover tooltip showing its description.
2. **Graceful Fallback**: If the tag was created ad-hoc in the model and has no workspace entry, it renders as a neutral gray badge. It remains completely valid and never triggers validation warnings.

---

## 5. View Projection and Filtering

In `innfo-editor`, clicking the **Search (Magnifying Glass)** icon in the header opens the search and filter popup:

* **Conceptos Tab**: Filters models by domain structure (e.g. show only `Offerings` or `Stakeholders`).
* **Etiquetas Tab**: Displays all tags present in the workspace and active models.
  * Toggling tags dynamically filters the view to show only elements matching the selected tags.
  * Multi-tag filtering allows projecting specific strategic combinations (e.g., all offerings belonging to both `strategy-growth` AND `enterprise`).
  * Convenient **Todas** and **Ninguna** buttons enable rapid filter switching.
