# Template Package Structure Specification

This document specifies the standard directory structure, asset organization, resolution rules, and composition semantics for **Level 2 Template Packages** across the `cogNNitive` ecosystem.

---

## 1. Directory Layout

A Level 2 template package consolidates a template specification alongside its associated samples, SOP procedures, and agent skills into a single directory tree. In this repository the layout is flat (the version lives in the spec frontmatter as `blueprint_version`, not in a directory segment):

```
iNNfo/specs/bluepriNNts/<template-name>/
├── spec_NN.md                # Canonical L2 template spec document
├── samples/                  # Sample L3 model files instantiating this template
├── procedures/               # Bundled SOP procedure spec files (*_NN.md)
└── skills/<skill-name>/      # Embedded agent skills (SKILL.md, scripts/, references/, test/)
```

### Path Conventions
- `<template-name>`: Lowercase identifier of the template (e.g. `business`, `projects`, `organization`).
- Version: the `blueprint_version` frontmatter field of `spec_NN.md` (e.g. `V_0-2-0`). Resolvers that hydrate a package remotely store it under a `<version>/` directory.
- Main Spec File: `spec_NN.md` (or `<template-name>_V_<version>_NN.md`).

---

## 2. Asset Subdirectories

### `samples/`
Contains sample Level 3 model files (`*.md`) that instantiate the parent template package. These serve as authoritative reference models for visual preview, automated testing, and agent scaffolding context.

### `procedures/`
Contains Standard Operating Procedure (SOP) spec files (`*_procedures_V_x-y-z_NN.md`). Procedures declared in the template frontmatter under `procedures:` reference paths relative to this package directory or workspace root:

```yaml
procedures:
  - id: "relevar-vivienda"
    name: "Relevamiento de Vivienda"
    path: "procedures/relevamiento_vivienda_NN.md"
```

### `skills/`
Contains agent skills embedded in the package, one folder per skill (`skills/<skill-name>/SKILL.md` plus its scripts, references and tests). The folder name is the skill identity. `list_blueprint_skills` discovers these folders and returns each one with `embedded: true` and a resolved absolute `path`. Installing the bluepriNNt projects each embedded skill into the user's skills directory (`~/.agents/skills/<skill-name>/`), and any change under `skills/**` requires a `blueprint_version` bump of the owning package. Embedded skills must be text-only, because remote hydration writes UTF-8.

Skills that live outside the package are declared in frontmatter under `skills:`. They are **referenced**, not vendored: they are fetched at install time from their upstream repo, so each entry MUST pin a `commit` (40-hex) and declare a `license` (SPDX), and SHOULD carry a `sha256` tree digest for integrity:

```yaml
skills:
  - name: "external-thing"
    repo: "owner/repo"
    path: "skills/external-thing"
    commit: "9f2c1a…40-hex…"
    ref: "v1.2.3"
    sha256: "…64-hex…"
    license: "MIT"
    distribution: "referenced"
```

**Guarantee tiers.** An `embedded` skill (vendored under `skills/`) is curated by the maintainer and guaranteed by the package version. A `referenced` external skill gets a **bounded** guarantee only: reproducible (pinned commit), unmodified since the pin (the `sha256` digest is verified at install time) and license-declared. cogNNitive does **not** vouch for a referenced skill's author. Install it with `skills-manager install-external --name … --repo … --path … --commit … --sha256 …`; the `distribution: vendored` value (permissive license required) is reserved for skills shipped inside cogNNitive.

---

## 3. Frontmatter Schema & Composition Syntax

Template frontmatter in `spec_NN.md` declares metadata, additive `includes`, explicit `alias` maps, bundled `procedures`, and attached `skills`:

```yaml
---
level: 2
spec_version: "V_0-2-1"
title: "Composite Business & Project Spec"
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
includes:
  - name: "business"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/V_0-2-0/spec_NN.md"
    alias:
      concepts:
        "Task": "BusinessTask"
      fields:
        "Item.status": "Item.business_status"
  - name: "projects"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/projects/V_0-2-0/spec_NN.md"
    alias:
      concepts:
        "Task": "ProjectTask"
procedures:
  - id: "audit-process"
    name: "Audit Process"
    path: "procedures/audit_NN.md"
skills:
  - name: "nn-audit"
    repo: "cogNNitive/cogNNitive-web"
    path: "skills/nn-audit"
    commit: "9f2c1a…40-hex…"
    license: "MIT"
---
```

---

## 4. Multi-Tier Resolution Order

When resolving a template package by name and optional version, `innfo-mcp` searches across four local tiers in order:

1. **Workspace Package Directory**: `./specs/bluepriNNts/<name>/<version>/`
2. **Workspace Flat Fallback**: `./templates/<name>_V_<version>_NN.md` or `./specs/`
3. **Global User Cache**: `~/.agents/templates/<name>/<version>/`
4. **Installed Skills Directory**: `~/.agents/skills/*/templates/<name>/<version>/`

### Immutability & Hydration
- Remote package downloads write to temporary staging directories (`specs/bluepriNNts/<name>/.staging-<pid>-<time>/`) and perform atomic rename operations to guarantee write completeness.
- Hydrated packages are **write-once immutable**: once a versioned package directory exists, existing contents are preserved without redundant re-downloads or overwrites.

---

## 5. Transitive Discovery & Collision Safety

- **Transitive Discovery**: Invoking `list_blueprint_procedures` or `list_blueprint_skills` recursively traverses composite `includes` and `parent_spec` trees up to a maximum depth of 10, deduplicating procedures by `id` and skills by `name`.
- **Composition Collision Safety**: When composing peer templates via `includes`, duplicate concept or field names must be explicitly renamed via frontmatter `alias` maps. Un-aliased collisions trigger a blocking `[COMPOSITION_COLLISION]` validation error.
