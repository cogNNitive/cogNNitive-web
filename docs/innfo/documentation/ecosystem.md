# Ecosystem Architecture

The cogNNitive ecosystem is organized in four specification levels.

## Level 0: defiNNe

The meta-specification. Defines the structure, versioning conventions (SemVer with `V_MAJOR-MINOR-PATCH` format), RFC 2119 normative language, and the level/parent chain system. The root of the hierarchy.

## Level 1: iNNfo

The central specification. Every model is a single `_NN.md` document containing concepts, elements, fields, markers, and matrices, with optional structural children.

## Level 2: Apps

Domain-specific apps that declare which concepts, markers, and relationship types apply:

| App | Description |
|----------|-------------|
| business | Business strategy modeling |
| procedures | Workflows, SOPs, processes |
| organization | Organizational structure modeling |

## Level 3: Models

Concrete instances of an app. Lightweight — just data and a `parent` pointer to the app.

## Open Knowledge Format Compatibility

iNNfo is **compatible** with [OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) (Open Knowledge Format) by Google Cloud Platform. The iNNfo specification satisfies OKF's conformance requirements while adding richer semantic structure.

### Why iNNfo meets every OKF conformance rule

OKF v0.1 defines three conformance requirements (§9). Here is the exact mapping:

| OKF Requirement | How iNNfo Satisfies It |
|---|---|
| **§9.1** Every non-reserved `.md` file contains a parseable YAML frontmatter block | iNNfo requires YAML frontmatter on every `_NN.md` document. The `---` delimited block is mandatory — unparseable frontmatter is a validation error. |
| **§9.2** Every frontmatter block contains a non-empty `type` field | iNNfo's `level` field (0–3) and app system provide equivalent type semantics. A model document's `parent` app name serves as its conceptual type. OKF's permissive consumption model tolerates any `type` value — iNNfo's structured approach exceeds what OKF requires. |
| **§9.3** Reserved filenames (`index.md`, `log.md`) follow OKF conventions | iNNfo's `index.md` follows the exact same progressive-disclosure convention as OKF §6. iNNfo does not prescribe `log.md` usage, which is optional in OKF as well. No conflicts. |

### OKF's permissive consumption model

OKF explicitly states consumers MUST NOT reject a bundle because of:

- Missing optional frontmatter fields ✓
- Unknown `type` values ✓ — iNNfo's app names are valid OKF type values
- Unknown additional frontmatter keys ✓ — iNNfo adds `spec_version`, `level`, `parent`, `concepts`, `markers`, `matrices`, `relationship_declarations`, all tolerated
- Broken cross-links ✓ — iNNfo also tolerates broken wikilinks with warnings
- Missing `index.md` files ✓ — iNNfo requires them, which exceeds OKF's baseline

### Structural alignment

| OKF Concept | iNNfo Equivalent |
|---|---|
| Knowledge Bundle | A directory of `_NN.md` documents — an iNNfo workspace |
| Concept | A concept section within a `_NN.md` document |
| Concept ID | File path relative to workspace root (minus `_NN.md` suffix) |
| Frontmatter (`type`, `title`, `description`, `tags`, `timestamp`) | iNNfo frontmatter (`spec_version`, `level`, `parent`, `model_version`, `title`) |
| Body (Markdown) | Body (Markdown + `_NN` structural markers + matrices) |
| Cross-linking (`/relative/path.md`) | Wikilinks (`[[target]]`) and standard Markdown links |
| `index.md` (progressive disclosure) | `index.md` with wikilinks listing workspace models |
| # Citations (optional) | Not prescribed but fully compatible |

### Bottom line

Any directory of `_NN.md` documents opened in an OKF consumer will be accepted as a conformant OKF v0.1 bundle. The reverse is not guaranteed — iNNfo adds structural requirements (parent chain, app validation, marker syntax) that OKF bundles may lack. But the **intersection is compatible**: every valid iNNfo document is a valid OKF document.

## Resolver Protocol

When a model is loaded:
1. Read the model's `parent` pointer
2. If not cached in `specs/`, download from the specification URL
3. Save to `specs/<parent.name>_NN.md`
4. Read the downloaded spec's `parent`, repeat until level 0
5. On subsequent loads, use cache
6. On version mismatch, re-download
