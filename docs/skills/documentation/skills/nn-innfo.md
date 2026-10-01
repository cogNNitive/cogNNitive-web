---
title: "nn-innfo — Semantic Modeling & Architecture Assistant"
description: "Author, edit, validate, and audit iNNfo-compliant models and templates with the conversational Model Creation Wizard and Architecture Assistant."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-innfo
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn-innfo

**Skill**: `nn-innfo` · **Role**: Semantic Modeling & Architecture Assistant

Guides LLMs and agents in authoring, scaffolding, editing, auditing, and validating **iNNfo-compliant files** (Level 1 Meta-template specification with unified `NN` syntax: `# NN`, `## NN`, and `key:: value`).

Resolution, validation, and mutations are deterministically delegated to the **`innfo-mcp`** server wrapping `@cognnitive/innfo-core`.

---

## 0. Entry Menu & Model Creation Wizard

When activated, `nn-innfo` presents the entry menu:

- **`[a]` (Recommended)** Create a new model (Conversational Wizard: Phase A Template &rarr; Phase B Model)
- **`[b]`** Edit / extend an existing model
- **`[c]`** Validate a model with MCP (`innfo-mcp_validate_model`)
- **`[d]`** Analyze coherence & solidity (Architecture Assistant audit)
- **`[x]`** Execute a declared model procedure
- **`[y]`** Cancel / help

---

## 1. iNNfo Architecture Levels

| Level | Role | Syntax & Structure |
| :--- | :--- | :--- |
| **0** | Meta-specification (`defiNNe`) | Meta-rules of the specification language. |
| **1** | Concrete Specification (`iNNfo`) | Level 1 meta-template defining the 4 root primitives: `Concept Definition`, `Field Definition`, `Matrix Definition`, `Marker Definition`. |
| **2** | Template / Specialization | Document with frontmatter `level: 2`. Body instantiates the 4 root primitives. |
| **3** | Data Model | Instantiates concepts, fields, matrices, and markers defined by its parent template (`parent_spec`). |

---

## 2. Core Modeling Rules

1. **Unified Syntax**: Use `# NN <Concept>`, `## NN <Concept>: <Element>`, `key:: value`.
2. **WikiLink Referential Discipline**: When a field has `type:: reference`, its value MUST be wrapped in WikiLinks (e.g. `owner:: [[Director]]`). Plain text without brackets is strictly prohibited.
3. **Element Descriptions in Prose**: The description of an element in an L3 model MUST NEVER be written as a `description::` field. It must always be written as Markdown prose separated from field lines by an empty line.
4. **Index Block Contains Only Concepts**: The `# NN index` block defines navigation hierarchy between Concepts only. Elements never appear in the index block.
5. **Provenance Protocol (`sources::`)**: Citations point canonically to files under `sources/nn/` with stable heading anchors (e.g. `sources:: [interview.md#stakeholders, report.md#summary]`).
