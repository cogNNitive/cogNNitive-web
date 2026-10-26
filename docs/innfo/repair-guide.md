# iNNfo kNNowledge Repair Guide

This guide describes how to resolve common validation warnings and errors in `iNNfo` kNNowledge documents using the automated repair tools.

## 1. Missing Taxonomy Index Section (`body-index`)

### Warning:
`No NN index section found — concepts will render in front matter declaration order. Add a # NN index section to control ordering and hierarchy.`

### Solution:
Call the `apply_change` MCP tool with the `generate_index` operation. This will automatically fetch the parent blueprint, extract the correct concept hierarchy, filter it for the concepts defined in your document, and write the `# NN index` section at the top of the body.

**MCP Call Example:**
```json
{
  "name": "apply_change",
  "arguments": {
    "id": "arenzano_cogNNitive",
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
When a kNNowledge document lacks frontmatter or has a corrupt YAML block, it cannot be loaded by the parser. Use the `init_knowledge` MCP tool to initialize a fresh, spec-compliant frontmatter block from the resolved blueprint. Note that `init_knowledge` is create-only: it fails with `MODEL_EXISTS` if the id already exists, so remove or rename the broken file first, then create it fresh.

**MCP Call Example:**
```json
{
  "name": "init_knowledge",
  "arguments": {
    "id": "arenzano_residential",
    "blueprint_name": "residential",
    "blueprint_url": "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/residential/spec_NN.md",
    "title": "Arenzano Residential",
    "knowledge_version": "V_0-5-1"
  }
}
```

---

## 3. Element Name Collision across Documents

### Error/Warning:
`Element "Propietario" appears in both "arenzano_business" and "arenzano_project_projects" — consider renaming to "Propietario (arenzano_project_projects)"`

### Solution:
Qualify the name of one of the clashing elements in the domain by calling the `apply_change` tool with the `rename_element` operation. The tool will transactionally update the element header, list references, matrix entries, and wikilinks inside the document to match.

**MCP Call Example:**
```json
{
  "name": "apply_change",
  "arguments": {
    "id": "arenzano_project_projects",
    "op": "rename_element",
    "args": {
      "conceptName": "Proyecto",
      "elementName": "Propietario",
      "newName": "Propietario (arenzano_project_projects)"
    }
  }
}
```
