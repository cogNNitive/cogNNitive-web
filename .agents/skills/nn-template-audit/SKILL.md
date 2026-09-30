---
name: nn-template-audit
version: "1.0.0"
description: Skill for auditing, validating, and refactoring iNNfo Level 2 apps and Level 3 canonical samples against the 7 core compliance criteria, unified Ghostbusters Inc. sample universe, and 100% English requirement.
---

# nn-template-audit Skill (iNNfo App & Sample Compliance Auditor)

## Overview

`nn-template-audit` is the authoritative skill for verifying, auditing, and refactoring **iNNfo Level 2 Apps** (`_spec_NN.md`) and **Level 3 Canonical Samples** under `iNNfo/specs/templates/`.

It enforces syntactic compliance with `iNNfo_V_0-1-0_NN.md` and `iNNfo_V_0-2-0_NN.md`, guarantees structural integrity, enforces the **Ghostbusters Inc.** unified sample universe, and validates 100% English technical copy.

---

## Audit Log & Compliance Matrix

The official audit state, timestamps, and compliance checklists for all templates and samples are recorded in [.agents/skills/nn-template-audit/AUDIT_LOG.md](../nn-template-audit/AUDIT_LOG.md).

Every audit run or sample refactoring MUST update `AUDIT_LOG.md` with the new timestamp and status (`PASSED`, `IN_PROGRESS`, `NEEDS_REVIEW`).

## Greeting Protocol (MANDATORY)

When this skill is activated or loaded, the agent MUST print as its very first output line:

```
🔧 You're using skill: nn-template-audit (🔍)
```

---

## 0. Entry Menu

When activated, present the following interactive options:

```markdown
🔍 iNNfo — App & Sample Compliance Auditor

- [a] (Recomendado) Auditar cumplimiento formal completo de todas las plantillas y samples (7 criterios)
- [b] Auditar/Refactorizar una familia específica de plantillas (ej. Business / Business Model)
- [c] Generar/Alinear sample canónico de Ghostbusters Inc. para una plantilla
- [d] Verificar descripciones de conceptos para el sidebar derecho de la UI
- [x] Cancelar
```

---

## 1. The 7 Core Verification Criteria

Every Level 2 app and Level 3 sample in `iNNfo/specs/templates/` MUST pass all 7 criteria:

### Criterion 1: Strict Syntactic Compliance (iNNfo Grammar)
- **Level 2 Frontmatter:** MUST declare `level: 2`, `spec_version`, `spec_url`, `parent_spec` (name & url), `template_version`, `title`, and `relationship_types`.
- **FORBIDDEN Frontmatter Keys:** `concepts: []` or `fields: []` MUST NOT appear in the YAML frontmatter of Level 2 apps.
- **Section Headings:** MUST use canonical headers `# NN Concept Definition`, `# NN Field Definition`, `# NN Marker Definition`, `# NN Matrix Definition`.

### Criterion 2: `# NN index` Taxonomy Ownership
- **Level 2 Apps:** MUST contain an `# NN index` section listing ONLY Concept names in WikiLinks (`* [[Concept]]`), NEVER Elements or instance names.
- **Level 3 Models (Instances & Samples):** MUST NOT contain an `# NN index` section. Taxonomy hierarchy is owned by the parent Level 2 app — Level 3 documents instantiate elements directly under `# NN <Concept>` headers.

### Criterion 3: Reference Fields & WikiLink Syntax
- **`type:: reference`:** Every field that points to or identifies another Concept/Element MUST use `type:: reference` (never `type:: string`).
- **Single WikiLink Value:** `field_name:: [[Target Element]]`
- **Multiple WikiLink Values:** Enclose the list in brackets `[...]` with individual WikiLinks inside: `field_name:: [[[Target A]], [[Target B]]]`

### Criterion 4: Unified Sample Universe — "Ghostbusters Inc."
- All canonical Level 3 samples under `templates/<category>/samples/` MUST belong to a single, coherent business universe: **Ghostbusters Inc.** (Cazafantasmas).
- **Core Entities:** Peter Venkman, Egon Spengler, Ray Stantz, Winston Zeddemore, Janine Melnitz, Ecto-1, Proton Packs, Containment Unit, Ghost Trap, Slimer, Gozer.
- Samples across different templates (`business`, `organization`, `procedures`, `projects`, `analysis`, `innovation`) MUST cross-reference each other consistently.

### Criterion 5: Prose vs. Property Scoping
- **Level 2 Field Definitions:** Use the explicit `description::` property (e.g., `description:: Primary contact for the stakeholder.`).
- **Level 2 Concept Definitions:** Use properties (`icon::`, `type::`, `color::`, `weight::`) plus free-form Markdown prose text directly under the definition block for rich documentation.
- **Level 3 Elements (Instances):** Descriptions MUST be written in free-form Markdown prose below the `key:: value` pairs — NEVER as a `description::` key-value property.

### Criterion 6: UI Sidebar Concept Documentation
- Every `# NN Concept Definition: <Concept>` in Level 2 apps MUST provide clear documentation for the iNNfo Modeler right sidebar.
- **Mandatory Sub-headings:** `### Summary` and `### Description` are the ONLY two required documentation sub-headings per Concept Definition.
- **Optional Sub-headings:** `### Methodologies` and `### Prompts` are optional, domain-specific enrichments — they MUST NOT be treated as global validation requirements.

### Criterion 7: 100% English Technical Copy
- All technical artifacts — template names, concept definitions, field names, descriptions, options, markers, matrix labels, and sample data — MUST be written 100% in English.

### Criterion 8: 100% Field Exhaustiveness in Canonical Samples
- Canonical Level 3 samples MUST be 100% complete and fully populated.
- NO field defined in the Level 2 parent app should be left unassigned, blank, or rendering as `-` in the Modeler UI.
- Every element in a Level 3 sample MUST explicitly populate all fields declared for its concept in the parent template AND include rich Markdown prose documentation below the key-value properties.

---

## 2. Architecture of Composite vs. Standalone Apps

- **Master Composite Apps (`business`):**
  - Act as top-level umbrella specs.
  - Contain NO concept or field definitions of their own.
  - Explicitly declare `includes:` pointing to standalone peer apps:
    ```yaml
    includes:
      - name: "business-model"
        url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/templates/business-model/business-model_V_0-2-0_NN.md"
      - name: "analysis"
        url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/templates/analysis/analysis_V_0-2-0_NN.md"
      - name: "organization"
        url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/templates/organization/organization_V_0-2-0_NN.md"
      - name: "projects"
        url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/templates/projects/projects_V_0-2-0_NN.md"
    ```
- **Standalone Domain Apps (`business-model`, `analysis`, `organization`, `projects`, `procedures`, `innovation`):**
  - Define their own domain concepts, fields, markers, and matrices.
  - `Organization` defines: `Organization`, `Roles`, `Functions`, `Position`, `Person`, `Skills`. (Note: `Contributions` and `Compensations` belong to `business-model`, NOT `organization`).
  - `Business Model` (`business-model`) defines core business concepts including `Contributions` and `Compensations` under `Team`/`Finance`.
  - MUST NOT include other peer apps unless designed as a composite.

---

## 3. Audit Protocol & Execution Steps

1. **Scan Workspace:** Discover all files matching `iNNfo/specs/templates/**/*.md`.
2. **Validate Frontmatter & Version Alignment:** Confirm filename version matches `spec_version` and `template_version`.
3. **Verify Field Types:** Convert any `string` fields pointing to entities into `type:: reference` with `target_concepts:: [...]`.
4. **Audit Concept Descriptions:** Ensure every concept has rich UI sidebar text.
5. **Verify/Generate Ghostbusters Samples:** Audit existing samples or generate new L3 samples conforming to the Ghostbusters Inc. universe.
6. **Validate with MCP:** Run `innfo-mcp_validate_template` and `innfo-mcp_validate_model` on all app and sample files.
