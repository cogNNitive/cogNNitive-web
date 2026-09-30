# iNNfo Model Repair Guide

This guide describes how to resolve common validation warnings and errors in `iNNfo` models using the automated repair tools.

## 1. Missing Taxonomy Index Section (`body-index`)

### Warning:
`No NN index section found — concepts will render in front matter declaration order. Add a # NN index section to control ordering and hierarchy.`

### Solution:
Call the `apply_change` MCP tool with the `generate_index` operation. This will automatically fetch the parent template spec, extract the correct concept hierarchy, filter it for the concepts defined in your model, and write the `# NN index` section at the top of the body.

**MCP Call Example:**
```json
{
  "name": "apply_change",
  "arguments": {
    "id": "arenzano_V_0-1-0_cogNNitive",
    "op": "generate_index",
    "args": {}
  }
}
```

---

## 2. Missing or Corrupt Frontmatter (`missing spec_version`)

### Error/Warning:
`File uses the _NN naming convention but has no valid iNNfo frontmatter (missing spec_version) — skipped`

### Solution:
When a model file lacks a frontmatter or has a corrupt YAML block, it cannot be loaded by the parser. Use the `init_model` MCP tool to initialize a fresh, spec-compliant frontmatter block while preserving your existing body content.

**MCP Call Example:**
```json
{
  "name": "init_model",
  "arguments": {
    "id": "arenzano_residential_V_0-5-1_residential",
    "template_name": "residential_V_0-5-1",
    "template_url": "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/residential/residential_V_0-1-0_NN.md",
    "title": "Arenzano Residential",
    "model_version": "V_0-5-1"
  }
}
```

---

## 3. Element Name Collision across Models

### Error/Warning:
`Element "Propietario" appears in both "arenzano_V_1-0-1_business" and "arenzano_project_V_0-1-0_projects" — consider renaming to "Propietario (arenzano_project_V_0-1-0_projects)"`

### Solution:
Qualify the name of one of the clashing elements in the workspace by calling the `apply_change` tool with the `rename_element` operation. The tool will transactionally update the element header, list references, matrix entries, and wikilinks inside the model to match.

**MCP Call Example:**
```json
{
  "name": "apply_change",
  "arguments": {
    "id": "arenzano_project_V_0-1-0_projects",
    "op": "rename_element",
    "args": {
      "conceptName": "Proyecto",
      "elementName": "Propietario",
      "newName": "Propietario (arenzano_project_V_0-1-0_projects)"
    }
  }
}
```
