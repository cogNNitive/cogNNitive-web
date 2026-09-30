---
spec_version: "V_0-1-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNe_V_0-1-0_NN.md"
level: 0
title: "defiNNe — The Definition of Definitions"
description: "Meta-specification for the CogNNitive ecosystem. Defines the structure, versioning, normative language, terminology discipline, and dependency resolution for all derived specifications."
author: "CogNNitive Team"
status: "Draft"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# defiNNe — The Definition of Definitions

## A meta-specification for defining structured, versioned, and machine-readable technical specifications

## Philosophy

defiNNe is built on four foundational values:

1. **Hierarchical Consistency**: Every specification belongs to a level in a defined hierarchy. Each level inherits the constraints of the levels above it and adds its own.
2. **Explicit Dependencies via Parent Chain**: Every specification declares a reference to its parent, resolvable to an exact document and immutable URL. From any document, the full chain up to level 0 is resolvable.
3. **Rich Specs, Lean Models**: Specification documents (levels 0–2) are semantically rich — they carry Philosophy, Objectives, full specification text. Models (level 3) are lightweight — they carry only data and a pointer to their parent template.
4. **Cacheable Resolution**: The parent chain can be resolved at load time and cached locally, making any model functionally self-contained without duplicating specification content.

## Objectives

- **Standardize** how specifications in the CogNNitive ecosystem are structured, versioned, and referenced.
- **Enable dependency resolution** across specification levels via the parent chain.
- **Provide a normative language** (RFC 2119) that all derived specifications must use.
- **Enforce terminology discipline** so every entity has one canonical name across the ecosystem.
- **Ensure URL persistence** so every specification version is retrievable indefinitely.
- **Define the spec resolver protocol** so applications can auto-download and cache the parent chain.

## Specification

### Hierarchy of Levels

| Level | Role | Example |
|---|---|---|
| **0** | Meta-specification | `defiNNe` |
| **1** | Concrete specification | `iNNfo` |
| **2** | Template | `business`, `procedures`, `organization`, `kb` |
| **3** | Model | `Ghostbusters` |

Rules:

- A level N specification MUST declare `level: N` in its frontmatter.
- A level 1 specification MUST declare `parent` as a string containing the URL, pointing to its level 0 parent.
- A level 2 or level 3 specification MUST declare `parent_spec` as an object with `name` and `url` fields, pointing to its parent (the level 1 specification for a level 2 template; the level 2 template for a level 3 model).
- A level 0 specification MUST NOT declare a `parent` or `parent_spec`.
- Each level ADDS constraints. It MUST NOT relax constraints from the level above.

### Terminology Discipline

Every specification defines its entities once and uses exactly one canonical name for
each throughout its normative text. This applies to all derived specifications:

- A specification MUST include a glossary that names each entity it defines.
- Normative text MUST use only those canonical names. Synonyms MUST NOT be used
  interchangeably for a defined entity.
- Implementation-only vocabulary — in particular the word **"node"** (a runtime graph
  representation) — MUST NOT appear in normative specification text.

The canonical entity vocabulary for semantic models is defined by iNNfo (level 1).

### Parent Reference Fields

The field used to point to the parent document differs by level:

- **Level 1** uses `parent`, a string containing the URL of the parent document:

  ```yaml
  parent: "<immutable-URL-to-the-parent-document>"
  ```

  - `parent`: an immutable URL (RECOMMENDED: git tag-based) pointing to the raw parent document. The application resolves this URL to find the parent.

- **Level 2 and level 3** use `parent_spec`, an object with `name` and `url`:

  ```yaml
  parent_spec:
    name: "<parent-document-name>"
    url: "<immutable-URL-to-the-parent-document>"
  ```

  - `parent_spec.name`: an identifier for the parent document. The application uses this as the resolved document's identity in the parent chain (not merely re-derived from the URL).
  - `parent_spec.url`: an immutable URL (RECOMMENDED: git tag-based) pointing to the raw parent document. The application resolves this URL to find the parent.

A level 0 specification MUST NOT include `parent` or `parent_spec`.

### Spec Resolver Protocol

> **Note for application implementors**: This section describes the RECOMMENDED behavior for applications that consume iNNfo models. It is not a requirement for spec authors.

When an application loads a level 3 model, it SHOULD resolve the full parent chain:

1. Read the model's `parent_spec.url`.
2. If the parent file is NOT already cached in a `specs/` subdirectory next to the model, download it from the URL.
3. Save it to `specs/<parent_basename>_NN.md` (where `parent_basename` is derived from the URL, stripping directories and suffixes).
4. Read the downloaded spec's parent reference — `parent_spec.url` if it is a level 2 template, or `parent` if it is the level 1 specification — and repeat until reaching level 0 (no parent).
5. On subsequent loads, check `specs/` first. Only download missing files.
6. If the model's `parent_spec.url` changes (version bump), the application detects the mismatch and downloads the new parent.

The cached directory structure:

```
📂 <Model>_V_x-y-z_<Template>/
  📄 <Model>_V_x-y-z_<Template>_NN.md
  📂 specs/
    📄 <parent_name>_NN.md        ← level 2 (template)
    📄 <grandparent_name>_NN.md   ← level 1 (iNNfo)
    📄 <great-grandparent_name>_NN.md  ← level 0 (defiNNe)
```

### Normative Language (RFC 2119)

When a specification makes a normative statement (a rule, requirement, or constraint), it MUST use these keywords with RFC 2119 semantics:

| Keyword | Meaning |
|---|---|
| **MUST** / **REQUIRED** / **SHALL** | Absolute requirement |
| **MUST NOT** / **SHALL NOT** | Absolute prohibition |
| **SHOULD** / **RECOMMENDED** | Valid reasons to ignore may exist |
| **SHOULD NOT** / **NOT RECOMMENDED** | Valid reasons to accept may exist |
| **MAY** / **OPTIONAL** | Truly optional |

Purely descriptive or explanatory text (tables of concepts, examples, taxonomy listings) is NOT required to use RFC 2119 keywords.

### Required Frontmatter Structure

All specifications MUST begin with a YAML frontmatter block.

**Level 0 (defiNNe)**

```yaml
---
spec_version: "V_x-y-z"
spec_url: "<immutable-URL>"
level: 0
title: "..."
description: "..."
author: "..."
status: "Draft | Stable | Deprecated"
---
```

No `parent` or `parent_spec`.

**Level 1 (concrete specifications)**

```yaml
---
spec_version: "V_x-y-z"
spec_url: "<immutable-URL>"
level: 1
parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNe_V_0-1-0_NN.md"
title: "..."
description: "..."
---
```

**Level 2 (templates)**

```yaml
---
spec_version: "V_x-y-z"
spec_url: "<immutable-URL>"
level: 2
parent_spec:
  name: "iNNfo_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md"
title: "..."
template_version: "V_x-y-z"
includes:                        # OPTIONAL — additive schema composition
  - name: "<base-template>"
    url: "<immutable-URL>"
relationship_types: {...}
---
```

A level 2 template's `concepts`, `fields`, `markers`, and `matrices` are NOT
frontmatter blocks. They are declared in the body as elements that instantiate
the four root primitives defined by iNNfo (level 1); see the iNNfo specification.
`includes` composes the schemas of peer templates additively — it is horizontal
(template ∪ template), unlike the vertical `parent_spec` chain; see iNNfo.

**Level 3 (models) — Lightweight**

```yaml
---
level: 3
parent_spec:
  name: "<template-name>"
  url: "<immutable-URL-to-template>"
model_version: "V_x-y-z"
title: "..."
---
```

A level 3 model MUST NOT inline the template definition; it MUST rely on the `parent_spec.url` + spec resolver to obtain its schema.

**Frontmatter Extensibility**

Specifications MAY include additional fields beyond those required above. Applications MUST ignore unrecognized fields. Additional fields MUST NOT contradict or override the required fields defined here.

### File Naming Convention

All specification and model files use the `_NN.md` suffix.

| Level | Pattern | Example |
|---|---|---|
| 0 | `<Name>_V_x-y-z_NN.md` | `defiNNe_V_0-1-0_NN.md` |
| 1 | `<Name>_V_x-y-z_NN.md` | `iNNfo_V_0-1-0_NN.md` |
| 2 | `<Template>_V_x-y-z_NN.md` | `business_V_0-1-0_NN.md` |
| 3 | `<Model>_V_x-y-z_<Template>_NN.md` | `Ghostbusters_V_0-1-0_business_NN.md` |

Files live in a single flat `specs/` tree, with no per-version snapshot directories:

```
specs/
├── defiNNe_V_x-y-z_NN.md      ← level 0 specs, directly at the root
├── iNNfo_V_x-y-z_NN.md        ← level 1 specs, directly at the root
└── templates/                 ← level 2 templates
    ├── <template>/
    │   ├── <template>_V_x-y-z_NN.md
    │   └── samples/
    │       └── <Model>_V_x-y-z_<template>_NN.md
    └── ...
```

Level 0 and level 1 specifications sit directly under `specs/` — there is no
`level0/`/`level1/` subfolder. Each level 2 template lives under
`specs/templates/<template-name>/`, and that template's shipped samples live
under `specs/templates/<template-name>/samples/`. There is no `latest/` alias:
every file already carries its own version in its filename (see
**Versioning**), so a consumer always resolves an exact, versioned path.

### Versioning

All versions use Semantic Versioning with hyphen separators: `V_MAJOR-MINOR-PATCH`.

| Increment | When to apply |
|---|---|
| **MAJOR** | Breaking change in structure or semantics |
| **MINOR** | Backward-compatible addition |
| **PATCH** | Bug fix, clarification, examples |

Versioning is filename-encoded and immutable: a specification's version is the
`V_x-y-z` segment already present in its own filename (see **File Naming
Convention**) — not a directory it is copied into.

- A version bump MUST always create a new file (e.g.
  `specs/templates/procedures/procedures_V_0-2-0_NN.md` alongside the existing
  `procedures_V_0-1-0_NN.md`). It MUST NOT rename or overwrite the previous
  version's file in place.
- Once published, a specification file MUST NOT be edited or deleted while any
  model still references it. Corrections and errata are published as a new
  PATCH version, not as an in-place edit.
- There is no `latest/` alias and no parallel version-snapshot directory (e.g.
  `v0.2.0/`, `v0.2.1/`). A `parent_spec.url` or `parent` reference MUST always
  point at a specific versioned filename.

### Specification URL Persistence

- The `spec_url` MUST point to an immutable version of the specification.
- RECOMMENDED: use a git tag: `https://raw.githubusercontent.com/cogNNitive/<repo>/v<version>/<path>`
- Once a version is published under a given URL, its content MUST NOT change.
- Corrections and errata MUST be published as a new PATCH version.

### Required Body Sections (Levels 0, 1, 2)

The document body of any level 0, 1, or 2 specification MUST include these sections as H2 headings, in this exact order, with no other section before the one-sentence summary:

```
## <one-sentence-summary>

## Philosophy

## Objectives

## Specification

## Template

## Examples
```

The `<one-sentence-summary>` placeholder means a brief H2 heading that summarizes the specification in one sentence.

Level 3 models MUST NOT include these sections. They contain only model data.

### Document Notice

The first content in the Markdown body — immediately after the frontmatter — MUST be a GFM `> [!NOTE]` admonition. This applies to ALL levels (0–3).

### Cross-References

Internal cross-references MUST use stable heading names, not section numbers. Sections are unnumbered so that references remain valid as the document evolves.

### Compliance Checklist

A document is defiNNe-compliant only if ALL of the following hold:

1. Filename matches the level convention (see **File Naming Convention**).
2. Frontmatter contains `spec_version` in `V_MAJOR-MINOR-PATCH` form (see **Versioning**).
3. Frontmatter contains a resolvable `spec_url` (see **Specification URL Persistence**).
4. Frontmatter contains `level`.
5. If level = 1: frontmatter contains `parent` as a string URL. If level = 2 or 3: frontmatter contains `parent_spec` as an object with `name` and `url`.
6. If level ≤ 2: body contains the required sections in order (see **Required Body Sections**).
7. If level = 3: body does NOT contain the required sections.
8. Body begins with the required Document Notice (see **Document Notice**).
9. Normative language uses RFC 2119 keywords (see **Normative Language**).
10. Normative text obeys the **Terminology Discipline** (canonical names only; no "node").

## Template

### Level 3 Model Template (Lightweight)

```markdown
---
level: 3
parent_spec:
  name: "<template-name>"
  url: "<immutable-url-to-template>"
model_version: "V_x-y-z"
title: "Model Name"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# _NN index
...

# _NN ConceptName
...
```

## Examples

### Full Parent Chain Resolution

From the sample model `specs/templates/business/samples/Ghostbusters_V_0-1-0_business_NN.md`:

```yaml
# Ghostbusters (level 3)
parent_spec:
  name: "business_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/business_V_0-1-0_NN.md"

# business_V_0-1-0 (level 2)
parent_spec:
  name: "iNNfo_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-1-0_NN.md"

# iNNfo_V_0-1-0 (level 1)
parent: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNe_V_0-1-0_NN.md"

# defiNNe_V_0-1-0 (level 0) — this document
# No parent — root of the chain
```

### Cached Directory After First Load

```
📂 Ghostbusters_V_0-1-0_business/
  📄 Ghostbusters_V_0-1-0_business_NN.md
  📂 specs/
    📂 templates/business/
      📄 business_V_0-1-0_NN.md
    📄 iNNfo_V_0-1-0_NN.md
    📄 defiNNe_V_0-1-0_NN.md
```
