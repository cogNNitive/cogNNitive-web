/**
 * Canonical Template Registry & Offline Fallback Table.
 *
 * Provides bundled Level 2 templates and canonical alias mappings
 * ensuring CLI tools, MCP operations, and test suites operate with
 * offline resilience and zero workspace pollution when network or local
 * lookups fail.
 */

export interface CanonicalTemplate {
  name: string
  version: string
  aliases: string[]
  specContent: string
}

const DEFINNITION_SPEC_CONTENT = "---\nspec_version: \"V_0-1-0\"\nspec_url: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md\"\nlevel: 0\ntitle: \"defiNNition — The Definition of Definitions\"\ndescription: \"Meta-specification for the CogNNitive ecosystem. Defines the structure, versioning, normative language, terminology discipline, and dependency resolution for all derived specifications.\"\nauthor: \"CogNNitive Team\"\nstatus: \"Draft\"\n---\n\n> [!NOTE]\n> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).\n\n# defiNNition — The Definition of Definitions\n\n## A meta-specification for defining structured, versioned, and machine-readable technical specifications\n\n## Philosophy\n\ndefiNNition is built on four foundational values:\n\n1. **Hierarchical Consistency**: Every specification belongs to a level in a defined hierarchy. Each level inherits the constraints of the levels above it and adds its own.\n2. **Explicit Dependencies via Parent Chain**: Every specification declares a reference to its parent, resolvable to an exact document and immutable URL. From any document, the full chain up to level 0 is resolvable.\n3. **Rich Specs, Lean Models**: Specification documents (levels 0–2) are semantically rich — they carry Philosophy, Objectives, full specification text. Models (level 3) are lightweight — they carry only data and a pointer to their parent template.\n4. **Cacheable Resolution**: The parent chain can be resolved at load time and cached locally, making any model functionally self-contained without duplicating specification content.\n\n## Objectives\n\n- **Standardize** how specifications in the CogNNitive ecosystem are structured, versioned, and referenced.\n- **Enable dependency resolution** across specification levels via the parent chain.\n- **Provide a normative language** (RFC 2119) that all derived specifications must use.\n- **Enforce terminology discipline** so every entity has one canonical name across the ecosystem.\n- **Ensure URL persistence** so every specification version is retrievable indefinitely.\n- **Define the spec resolver protocol** so applications can auto-download and cache the parent chain.\n\n## Specification\n\n### Hierarchy of Levels\n\n| Level | Role | Example |\n|---|---|---|\n| **0** | Meta-specification | `defiNNition` |\n| **1** | Concrete specification | `iNNfo` |\n| **2** | bluepriNNt | `business`, `procedures`, `organization`, `kb` |\n| **3** | kNNowledge | `Ghostbusters` |\n\nRules:\n\n- A level N specification MUST declare `level: N` in its frontmatter.\n- A level 1 specification MUST declare `parent` as a string containing the URL, pointing to its level 0 parent.\n- A level 2 or level 3 specification MUST declare `parent_spec` as an object with `name` and `url` fields, pointing to its parent (the level 1 specification for a level 2 template; the level 2 template for a level 3 model).\n- A level 0 specification MUST NOT declare a `parent` or `parent_spec`.\n- Each level ADDS constraints. It MUST NOT relax constraints from the level above.\n\n### Terminology Discipline\n\nEvery specification defines its entities once and uses exactly one canonical name for\neach throughout its normative text. This applies to all derived specifications:\n\n- A specification MUST include a glossary that names each entity it defines.\n- Normative text MUST use only those canonical names. Synonyms MUST NOT be used\n  interchangeably for a defined entity.\n- Implementation-only vocabulary — in particular the word **\"node\"** (a runtime graph\n  representation) — MUST NOT appear in normative specification text.\n\nThe canonical entity vocabulary for semantic models is defined by iNNfo (level 1).\n\n### Parent Reference Fields\n\nThe field used to point to the parent document differs by level:\n\n- **Level 1** uses `parent`, a string containing the URL of the parent document:\n\n  ```yaml\n  parent: \"<immutable-URL-to-the-parent-document>\"\n  ```\n\n  - `parent`: an immutable URL (RECOMMENDED: git tag-based) pointing to the raw parent document. The application resolves this URL to find the parent.\n\n- **Level 2 and level 3** use `parent_spec`, an object with `name` and `url`:\n\n  ```yaml\n  parent_spec:\n    name: \"<parent-document-name>\"\n    url: \"<immutable-URL-to-the-parent-document>\"\n  ```\n\n  - `parent_spec.name`: an identifier for the parent document. The application uses this as the resolved document's identity in the parent chain (not merely re-derived from the URL).\n  - `parent_spec.url`: an immutable URL (RECOMMENDED: git tag-based) pointing to the raw parent document. The application resolves this URL to find the parent.\n\nA level 0 specification MUST NOT include `parent` or `parent_spec`.\n\n### Spec Resolver Protocol\n\n> **Note for application implementors**: This section describes the RECOMMENDED behavior for applications that consume iNNfo models. It is not a requirement for spec authors.\n\nWhen an application loads a level 3 model, it SHOULD resolve the full parent chain:\n\n1. Read the model's `parent_spec.url`.\n2. If the parent file is NOT already cached in a `specs/` subdirectory next to the model, download it from the URL.\n3. Save it to `specs/<parent_basename>_NN.md` (where `parent_basename` is derived from the URL, stripping directories and suffixes).\n4. Read the downloaded spec's parent reference — `parent_spec.url` if it is a level 2 template, or `parent` if it is the level 1 specification — and repeat until reaching level 0 (no parent).\n5. On subsequent loads, check `specs/` first. Only download missing files.\n6. If the model's `parent_spec.url` changes (version bump), the application detects the mismatch and downloads the new parent.\n\nThe cached directory structure:\n\n```\n📂 <Model>_V_x-y-z_<Template>/\n  📄 <Model>_V_x-y-z_<Template>_NN.md\n  📂 specs/\n    📄 <parent_name>_NN.md        ← level 2 (template)\n    📄 <grandparent_name>_NN.md   ← level 1 (iNNfo)\n    📄 <great-grandparent_name>_NN.md  ← level 0 (defiNNition)\n```\n\n### Normative Language (RFC 2119)\n\nWhen a specification makes a normative statement (a rule, requirement, or constraint), it MUST use these keywords with RFC 2119 semantics:\n\n| Keyword | Meaning |\n|---|---|\n| **MUST** / **REQUIRED** / **SHALL** | Absolute requirement |\n| **MUST NOT** / **SHALL NOT** | Absolute prohibition |\n| **SHOULD** / **RECOMMENDED** | Valid reasons to ignore may exist |\n| **SHOULD NOT** / **NOT RECOMMENDED** | Valid reasons to accept may exist |\n| **MAY** / **OPTIONAL** | Truly optional |\n\nPurely descriptive or explanatory text (tables of concepts, examples, taxonomy listings) is NOT required to use RFC 2119 keywords.\n\n### Required Frontmatter Structure\n\nAll specifications MUST begin with a YAML frontmatter block.\n\n**Level 0 (defiNNition)**\n\n```yaml\n---\nspec_version: \"V_x-y-z\"\nspec_url: \"<immutable-URL>\"\nlevel: 0\ntitle: \"...\"\ndescription: \"...\"\nauthor: \"...\"\nstatus: \"Draft | Stable | Deprecated\"\n---\n```\n\nNo `parent` or `parent_spec`.\n\n**Level 1 (concrete specifications)**\n\n```yaml\n---\nspec_version: \"V_x-y-z\"\nspec_url: \"<immutable-URL>\"\nlevel: 1\nparent: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md\"\ntitle: \"...\"\ndescription: \"...\"\n---\n```\n\n**Level 2 (bluepriNNts)**\n\n```yaml\n---\nspec_version: \"V_x-y-z\"\nspec_url: \"<immutable-URL>\"\nlevel: 2\nparent_spec:\n  name: \"iNNfo_V_0-3-0\"\n  url: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md\"\ntitle: \"...\"\nblueprint_version: \"V_x-y-z\"\nincludes:                        # OPTIONAL — additive schema composition\n  - name: \"<base-blueprint>\"\n    url: \"<immutable-URL>\"\nrelationship_types: {...}\n---\n```\n\nA level 2 bluepriNNt's `concepts`, `fields`, `markers`, and `matrices` are NOT\nfrontmatter blocks. They are declared in the body as elements that instantiate\nthe four root primitives defined by iNNfo (level 1); see the iNNfo specification.\n`includes` composes the schemas of peer bluepriNNts additively — it is horizontal\n(bluepriNNt ∪ bluepriNNt), unlike the vertical `parent_spec` chain; see iNNfo.\n\n**Level 3 (kNNowledge) — Lightweight**\n\n```yaml\n---\nlevel: 3\nparent_spec:\n  name: \"<blueprint-name>\"\n  url: \"<immutable-URL-to-blueprint>\"\nknowledge_version: \"V_x-y-z\"\ntitle: \"...\"\n---\n```\n\nA level 3 kNNowledge document MUST NOT inline the bluepriNNt definition; it MUST rely on the `parent_spec.url` + spec resolver to obtain its schema.\n\n**Frontmatter Extensibility**\n\nSpecifications MAY include additional fields beyond those required above. Applications MUST ignore unrecognized fields. Additional fields MUST NOT contradict or override the required fields defined here.\n\n### File Naming Convention\n\nAll specification and kNNowledge files use the `_NN.md` suffix.\n\n| Level | Pattern | Example |\n|---|---|---|\n| 0 | `<Name>_V_x-y-z_NN.md` | `defiNNition_V_0-1-0_NN.md` |\n| 1 | `<Name>_V_x-y-z_NN.md` | `iNNfo_V_0-3-0_NN.md` |\n| 2 | `<Blueprint>_V_x-y-z_NN.md` | `business_V_0-1-0_NN.md` |\n| 3 | `<Knowledge>_V_x-y-z_<Blueprint>_NN.md` | `Ghostbusters_V_0-1-0_business_NN.md` |\n\nFiles live in a single flat `specs/` tree, with no per-version snapshot directories:\n\n```\nspecs/\n├── defiNNition_V_x-y-z_NN.md  ← level 0 specs, directly at the root\n├── iNNfo_V_x-y-z_NN.md        ← level 1 specs, directly at the root\n└── templates/                 ← level 2 bluepriNNts\n    ├── <blueprint>/\n    │   ├── <blueprint>_V_x-y-z_NN.md\n    │   └── samples/\n    │       └── <Knowledge>_V_x-y-z_<blueprint>_NN.md\n    └── ...\n```\n\nLevel 0 and level 1 specifications sit directly under `specs/` — there is no\n`level0/`/`level1/` subfolder. Each level 2 bluepriNNt lives under\n`specs/templates/<blueprint-name>/`, and that bluepriNNt's shipped samples live\nunder `specs/templates/<blueprint-name>/samples/`. There is no `latest/` alias:\nevery file already carries its own version in its filename (see\n**Versioning**), so a consumer always resolves an exact, versioned path.\n\n### Versioning\n\nAll versions use Semantic Versioning with hyphen separators: `V_MAJOR-MINOR-PATCH`.\n\n| Increment | When to apply |\n|---|---|\n| **MAJOR** | Breaking change in structure or semantics |\n| **MINOR** | Backward-compatible addition |\n| **PATCH** | Bug fix, clarification, examples |\n\nVersioning is filename-encoded and immutable: a specification's version is the\n`V_x-y-z` segment already present in its own filename (see **File Naming\nConvention**) — not a directory it is copied into.\n\n- A version bump MUST always create a new file (e.g.\n  `specs/templates/procedures/procedures_V_0-2-0_NN.md` alongside the existing\n  `procedures_V_0-1-0_NN.md`). It MUST NOT rename or overwrite the previous\n  version's file in place.\n- Once published, a specification file MUST NOT be edited or deleted while any\n  kNNowledge document still references it. Corrections and errata are published as a new\n  PATCH version, not as an in-place edit.\n- There is no `latest/` alias and no parallel version-snapshot directory (e.g.\n  `v0.2.0/`, `v0.2.1/`). A `parent_spec.url` or `parent` reference MUST always\n  point at a specific versioned filename.\n\n### Specification URL Persistence\n\n- The `spec_url` MUST point to an immutable version of the specification.\n- RECOMMENDED: use a git tag: `https://raw.githubusercontent.com/cogNNitive/<repo>/v<version>/<path>`\n- Once a version is published under a given URL, its content MUST NOT change.\n- Corrections and errata MUST be published as a new PATCH version.\n\n### Required Body Sections (Levels 0, 1, 2)\n\nThe document body of any level 0, 1, or 2 specification MUST include these sections as H2 headings, in this exact order, with no other section before the one-sentence summary:\n\n```\n## <one-sentence-summary>\n\n## Philosophy\n\n## Objectives\n\n## Specification\n\n## Template\n\n## Examples\n```\n\nThe `<one-sentence-summary>` placeholder means a brief H2 heading that summarizes the specification in one sentence.\n\nLevel 3 kNNowledge documents MUST NOT include these sections. They contain only data.\n\n### Document Notice\n\nThe first content in the Markdown body — immediately after the frontmatter — MUST be a GFM `> [!NOTE]` admonition. This applies to ALL levels (0–3).\n\n### Cross-References\n\nInternal cross-references MUST use stable heading names, not section numbers. Sections are unnumbered so that references remain valid as the document evolves.\n\n### Compliance Checklist\n\nA document is defiNNition-compliant only if ALL of the following hold:\n\n1. Filename matches the level convention (see **File Naming Convention**).\n2. Frontmatter contains `spec_version` in `V_MAJOR-MINOR-PATCH` form (see **Versioning**).\n3. Frontmatter contains a resolvable `spec_url` (see **Specification URL Persistence**).\n4. Frontmatter contains `level`.\n5. If level = 1: frontmatter contains `parent` as a string URL. If level = 2 or 3: frontmatter contains `parent_spec` as an object with `name` and `url`.\n6. If level ≤ 2: body contains the required sections in order (see **Required Body Sections**).\n7. If level = 3: body does NOT contain the required sections.\n8. Body begins with the required Document Notice (see **Document Notice**).\n9. Normative language uses RFC 2119 keywords (see **Normative Language**).\n10. Normative text obeys the **Terminology Discipline** (canonical names only; no \"node\").\n\n## Template\n\n### Level 3 kNNowledge Template (Lightweight)\n\n```markdown\n---\nlevel: 3\nparent_spec:\n  name: \"<blueprint-name>\"\n  url: \"<immutable-url-to-blueprint>\"\nknowledge_version: \"V_x-y-z\"\ntitle: \"Document Name\"\n---\n\n> [!NOTE]\n> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).\n\n# _NN index\n...\n\n# _NN ConceptName\n...\n```\n\n## Examples\n\n### Full Parent Chain Resolution\n\nFrom the sample kNNowledge `specs/templates/business/samples/Ghostbusters_V_0-1-0_business_NN.md`:\n\n```yaml\n# Ghostbusters (level 3)\nparent_spec:\n  name: \"business_V_0-1-0\"\n  url: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/business_V_0-1-0_NN.md\"\n\n# business_V_0-1-0 (level 2)\nparent_spec:\n  name: \"iNNfo_V_0-3-0\"\n  url: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md\"\n\n# iNNfo_V_0-3-0 (level 1)\nparent: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md\"\n\n# defiNNition_V_0-1-0 (level 0) — this document\n# No parent — root of the chain\n```\n\n### Cached Directory After First Load\n\n```\n📂 Ghostbusters_V_0-1-0_business/\n  📄 Ghostbusters_V_0-1-0_business_NN.md\n  📂 specs/\n    📂 templates/business/\n      📄 business_V_0-1-0_NN.md\n    📄 iNNfo_V_0-3-0_NN.md\n    📄 defiNNition_V_0-1-0_NN.md\n```\n";

const INNFO_SPEC_CONTENT = "---\nspec_version: \"V_0-3-0\"\nspec_url: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md\"\nlevel: 1\nparent: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md\"\ntitle: \"iNNfo Meta-bluepriNNt Specification\"\ndescription: \"Level-1 meta-bluepriNNt defining the four root primitives (Concept Definition, Field Definition, Matrix Definition, Marker Definition) and the unified NN syntax: `# NN` sections, `## NN` elements, and `key:: value` properties.\"\nauthor: \"innV0 Team\"\nstatus: \"Stable\"\n---\n\n> [!NOTE]\n> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).\n\n# iNNfo Meta-bluepriNNt Specification\n\n## A concrete specification for semantic modeling with concepts, elements, fields, markers, and relationships, expressed through the unified NN syntax and a self-describing meta-bluepriNNt\n\n## Philosophy\n\niNNfo is designed around five principles:\n\n1. **Rich specs, lean models**: Specification documents (levels 0–2) are semantically rich. kNNowledge documents (level 3) carry only data and a parent pointer. The application resolves and caches the parent chain.\n2. **Self-describing**: Every iNNfo document is valid Markdown with YAML frontmatter and the unified `NN` syntax. No proprietary tooling required to read it.\n3. **Meta-bluepriNNt**: The level-1 specification is itself a *meta-bluepriNNt*. Level-2 bluepriNNts are ordinary iNNfo documents that instantiate the four root primitives — `Concept Definition`, `Field Definition`, `Matrix Definition`, and `Marker Definition` — as ordinary elements in their body. There is no separate declaration format.\n4. **Relationship polymorphism**: Relationships between concepts and elements are expressed through a typed system — hierarchy, evaluable matrices, graph edges, and sequences.\n5. **One name, one identity**: An entity is identified by its name. The name is the single source of truth; there is no separate persisted identifier.\n\n## Objectives\n\n- Define a unified, minimal syntax: `# NN <Concept>`, `## NN <Concept>: <Element>`, and `key:: value` properties.\n- Define the **Metaplantilla Nivel 1**: the four root primitives that every level-2 bluepriNNt instantiates.\n- Remove the `concepts:` / `markers:` / `matrices:` frontmatter blocks from level-2 bluepriNNts; their schema is expressed as body elements.\n- Enable machine parsing, validation, and visual rendering of kNNowledge via the parent chain resolver.\n- Maintain full human readability and Git-diffability.\n- Ensure that kNNowledge files are lightweight and never duplicate specification content.\n\n## Unified Syntax\n\niNNfo uses three structural markers. The `NN` token is required and distinguishes iNNfo structure from ordinary Markdown.\n\n| Construct | Syntax | Example |\n|---|---|---|\n| Concept section | `# NN <Concept>` (H1) | `# NN Stakeholders` |\n| Element | `## NN <Concept>: <Element>` (H2) | `## NN Stakeholders: Customer` |\n| Property | `key:: value` (line immediately after the element heading) | `importance:: high` |\n\nA **Concept** is a named type declared by a bluepriNNt. A Concept section is introduced by an H1 heading `# NN <Concept>`.\n\nAn **Element** is a single instance of a Concept, declared as an H2 heading `## NN <Concept>: <Element>` within the Concept section. The `<Concept>` token names the owning concept (it MUST match the enclosing section concept).\n\nA **Field** is a typed key-value property of an Element. Element properties are written on consecutive `key:: value` lines immediately after the `## NN` heading, before any free-form description text.\n\n```markdown\n# NN Stakeholders\n\n## NN Stakeholders: Customer\nimportance:: high\nneeds:: [speed, accuracy]\nCustomer description text follows the properties.\n```\n\nProperty values follow a small value grammar:\n\n- Plain text — `relationship_model:: Dedicated`\n- Quoted text — `brand_name:: \"Acme Inc.\"`\n- Numbers — `weight:: 90`\n- Booleans — `published:: true`\n- Inline arrays — `options:: [Ideation, MVP, Validation]`\n- Inline objects (JSON) — `config:: {\"a\": 1}`\n\nThere is exactly ONE syntax. Older documents that use the legacy `_NN` markers or\nfenced ```yaml blocks are not supported and MUST be migrated to the unified syntax.\n\n## Root Primitives (Metaplantilla Nivel 1)\n\nA level-2 **bluepriNNt** is an iNNfo document (level 2) that instantiates the four root primitives. Each primitive is a reserved Concept name whose Elements carry the schema of the bluepriNNt.\n\n| Primitive | Reserved Concept | Purpose | Instantiation |\n|---|---|---|---|\n| `Concept Definition` | `# NN Concept Definition` | Declares one Concept of the bluepriNNt | `## NN Concept Definition: <Name>` |\n| `Field Definition` | `# NN Field Definition` | Declares one typed Field of a Concept | `## NN Field Definition: <Name>` |\n| `Marker Definition` | `# NN Marker Definition` | Declares one evaluative Marker | `## NN Marker Definition: <Name>` |\n| `Matrix Definition` | `# NN Matrix Definition` | Declares one evaluable Matrix | `## NN Matrix Definition: <Name>` |\n\n### Concept Definition\n\nDeclares a Concept. The Element name is the Concept name. Allowed properties:\n\n| Property | Type | Description |\n|---|---|---|\n| `type` | `text` \\| `category` \\| `weight` \\| `list` \\| `steps` \\| `sequence` \\| `knowledge` | Representation of the Concept (required) |\n| `icon` | string | Lucide icon identifier |\n| `color` | string | Theme color |\n| `weight` | number | Display priority (higher = more prominent) |\n\n```markdown\n# NN Concept Definition\n\n## NN Concept Definition: Stakeholders\nicon:: users\ntype:: weight\ncolor:: blue\nweight:: 80\n```\n\n### Field Definition\n\nDeclares a typed Field of a Concept. The Element name is the Field name. Allowed properties:\n\n| Property | Type | Description |\n|---|---|---|\n| `concept` | string | Name of the owning Concept Definition (required) |\n| `type` | `string` \\| `select` \\| `reference` \\| `markdown_inline` \\| `markdown_file` \\| `image` \\| `file` \\| `video` \\| `audio` \\| `url` \\| `knowledge` \\| `citation` | Field type (required) |\n| `options` | array | Allowed values for `select` fields |\n| `target_concepts` | array | Target concepts for `reference` fields |\n| `description` | string | Human-readable explanation |\n| `target_blueprint` | string | Required bluepriNNt name or URL for knowledge fields |\n\n```markdown\n# NN Field Definition\n\n## NN Field Definition: status\nconcept:: Stakeholders\ntype:: select\noptions:: [Ideation, MVP, Validation]\n```\n\n**Reference Fields (`type:: reference`).** Property values for fields declared with `type:: reference` MUST be formatted using WikiLink syntax `[[Target Element]]` (e.g. `location:: [[Salón-Comedor]]`). Bare string values without WikiLink delimiters are not parsed as active element-to-element graph references.\n\n**Knowledge Fields (`type:: knowledge`).** A Field of any Concept MAY be declared `type:: knowledge`. Its value is a domain-relative path, a `./`-relative path, or a WikiLink wrapping either (`[[kNNowledge/acme_business_NN.md]]`). When the Field declares `target_blueprint`, the referenced kNNowledge document's `parent_spec` MUST identify that bluepriNNt. Knowledge fields are followed during domaiNN traversal, so a document referenced by two parents appears once in the graph with both incoming edges — a diamond is not a cycle.\n\n**Citation Fields (`type:: citation`).** A Field declared `type:: citation` holds a pointer list to the Source documents it derives from, using the same bracketed grammar as the reserved `sources::` property (`[sources/nn/<filename>#<heading-slug>, ...]`). Unlike `reference` and `knowledge`, its values are validated by the `KU_*` integrity checks and are read into the element's source citations.\n\n**Qualified Cross-Knowledge References.** A `reference` or `knowledge` Field MAY target an Element in another kNNowledge document in the same domaiNN using the qualified form `[[Document Title :: Element Name]]`. `Document Title` is the target document's frontmatter `title` (its filename without `.md` is accepted as a fallback) and MUST be unique within the domaiNN. `Element Name` is an Element name in that document. Positional or anchor forms (`path#slug`) are not defined. Cross-domain references are not defined.\n\n\n### Marker Definition\n\nDeclares an evaluative Marker scored per Element or Concept via the reserved `item-markers matrix`. The Element name is the Marker name. Allowed properties:\n\n| Property | Type | Description |\n|---|---|---|\n| `applies_to` | array of `Element` \\| `Concept` | Which entities may be scored on this Marker. Defaults to `[Element]`. An `item-markers matrix` row whose subject is not permitted by `applies_to` is a validation ERROR. |\n| `values` | array | Allowed scores for this Marker (empty cell `-` is always accepted). Omit for a free numeric Marker constrained only by `widget_config`. |\n| `widget` | `boolean` \\| `cycle` \\| `scale` \\| `set` \\| `text` | Cell interaction widget for this Marker's `item-markers matrix` column. |\n| `widget_config` | object | Widget-specific configuration — see Widget Configuration. |\n| `symbol` | string | Display symbol (e.g. `*`, `!`, `?`) |\n| `icon` | string | Lucide icon identifier |\n| `color` | string | Theme color |\n| `weight` | number | Display priority (higher = more prominent). This is NOT a score. |\n\nScoring a Marker is mechanically an `evaluable_matrix` relationship (`Elements` or\n`Concepts` × `Markers`), so a Marker Definition shares the `values` / `widget` /\n`widget_config` vocabulary of a Matrix Definition. The Marker Definition remains a\ndistinct root primitive; it is not rewritten as a Matrix Definition.\n\n```markdown\n# NN Marker Definition\n\n## NN Marker Definition: priority\napplies_to:: [Element]\nsymbol:: !\nicon:: flag\ncolor:: red\n\n## NN Marker Definition: certainty\napplies_to:: [Element, Concept]\nwidget:: scale\nwidget_config:: {\"min\": 0, \"max\": 100, \"step\": 5}\nicon:: help-circle\ncolor:: green\n```\n\n### Matrix Definition\n\nDeclares an evaluable Matrix. The Element name is the Matrix name. Allowed properties:\n\n| Property | Type | Description |\n|---|---|---|\n| `source` | string | Source Concept (rows) — required |\n| `target` | string | Target Concept or reserved pseudo-Concept (columns) — required |\n| `values` | array | Allowed cell values (empty cell `-` and boolean marker `X` are always accepted) |\n| `widget` | `boolean` \\| `cycle` \\| `scale` \\| `set` \\| `text` | Cell interaction widget |\n| `widget_config` | object | Widget-specific configuration — see Widget Configuration |\n| `description` | string | Human-readable explanation |\n\n```markdown\n# NN Matrix Definition\n\n## NN Matrix Definition: problems-value propositions matrix\nsource:: Problems\ntarget:: Value propositions\nwidget:: set\nvalues:: [Max, Very High, High]\n```\n\n### Widget Configuration\n\n`widget_config` is an OPTIONAL inline JSON object that parameterizes the cell\ninteraction widget. It MUST be valid JSON on a single line.\n\n| Widget | Key | Type | Default | Description |\n|---|---|---|---|---|\n| `scale` | `min` | number | `0` | Minimum numeric score |\n| | `max` | number | `100` | Maximum numeric score |\n| | `step` | number | `1` | Step increment |\n| | `unit` | string | `\"\"` | Optional display suffix (e.g. `\"%\"` or `\"pts\"`) |\n| `set` | `multi` | boolean | `false` | Allow selecting multiple values simultaneously |\n| `cycle` | `wrap` | boolean | `true` | Cycle back to first value after reaching the last |\n| `boolean` | `true_label` | string | `\"X\"` | Display text when true |\n| | `false_label` | string | `\"-\"` | Display text when false |\n| `text` | `max_length` | number | `200` | Character limit for cell input |\n| | `placeholder` | string | `\"\"` | Hint text for empty cells |\n\n```markdown\n## NN Marker Definition: confidence\napplies_to:: [Element]\nwidget:: scale\nwidget_config:: {\"min\": 0, \"max\": 10, \"step\": 1, \"unit\": \"/10\"}\ncolor:: purple\n\n## NN Matrix Definition: feature-segment priority matrix\nsource:: Features\ntarget:: Segments\nwidget:: set\nwidget_config:: {\"multi\": true}\nvalues:: [Core, Secondary, Nice-to-have]\n```\n\n### Item-Markers Matrix\n\nTo score Markers on Elements or Concepts, a bluepriNNt uses a reserved Matrix Definition:\n`## NN Matrix Definition: item-markers matrix`.\n\n- `source`: the Concept whose Elements are being scored (e.g. `Stakeholders`), or `Concepts`\n- `target`: `Markers` (the reserved pseudo-Concept representing all defined Markers)\n\n```markdown\n# NN Matrix Definition\n\n## NN Matrix Definition: item-markers matrix\nsource:: Stakeholders\ntarget:: Markers\n```\n\nScoring is written in the kNNowledge document's matrix section:\n\n```markdown\n# NN matrices: item-markers matrix\n\n| Element | priority | certainty |\n|---|---|---|\n| Customer | ! | 85 |\n| Competitor | - | 40 |\n```\n\n### Free Matrices\n\nAny Matrix that does NOT target `Markers` is a **Free Matrix** — an evaluable\nrelationship between two domain Concepts (e.g. `Problems` × `Value propositions`).\n\n```markdown\n# NN matrices: problems-value propositions matrix\n\n| Problems | Solution A | Solution B |\n|---|---|---|\n| High latency | Max | High |\n| Data loss | Max | Very High |\n```\n\n### Relationship Types Block (Frontmatter)\n\nLevel-2 bluepriNNts MAY declare custom graph edge types in frontmatter under\n`relationship_types:`. A relationship type defines a typed directed connection\nbetween elements.\n\n```yaml\n---\nrelationship_types:\n  depends_on:\n    directed: true\n    label: \"Depends on\"\n    inverse: \"Required by\"\n    color: \"#e06c75\"\n    style: \"dashed\"\n  influences:\n    directed: true\n    label: \"Influences\"\n    color: \"#61afef\"\n    style: \"solid\"\n---\n```\n\nGraph edges are written in the kNNowledge document's element section using `->` syntax:\n\n```markdown\n## NN Work: Deploy\ndepends_on -> [[Build]]\ninfluences -> [[Monitoring]]\n```\n\n### Custom Guidance Headings in BluepriNNts\n\nLevel-2 bluepriNNts MAY include prose documentation sections after the schema definitions.\nThese sections provide human-readable guidance for authors and AI assistants filling out\nkNNowledge documents based on the bluepriNNt.\n\nTo prevent guidance text from being parsed as model elements, bluepriNNt authors MUST use\nregular Markdown headings (without the `NN` token) for guidance sections:\n\n```markdown\n# Concept Guidance Documentation\n\n## Stakeholders\n### Summary\nStakeholders are individuals, groups, or organizations that have an interest in or are affected by the system.\n\n### Identification Strategy\n1. Identify direct users who interact with the system daily.\n2. Identify decision makers who approve funding and strategy.\n3. Identify external parties subject to compliance or regulation.\n\n### Fields Reference\n- `importance`: Relative business impact (high, medium, low).\n- `needs`: Bulleted list of explicit operational requirements.\n```\n\n- Headings starting with `# NN` or `## NN` are **structural** (parsed as schema).\n- Headings starting with `#` or `##` (without `NN`) are **descriptive** (ignored by the schema parser).\n\n## Level 2 BluepriNNt Structure\n\nA level 2 bluepriNNt MUST follow this structure:\n\nFrontmatter:\n\n```yaml\n---\nspec_version: \"V_0-3-0\"\nspec_url: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/<name>/spec_NN.md\"\nlevel: 2\nparent_spec:\n  name: \"iNNfo_V_0-3-0\"\n  url: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md\"\ntitle: \"<BluepriNNt Title>\"\nblueprint_name: \"<blueprint-name>\"\nblueprint_version: \"V_x-y-z\"\nincludes:                        # OPTIONAL — additive schema composition\n  - name: \"<base-blueprint>\"\n    url: \"<immutable-URL>\"\nrelationship_types:              # OPTIONAL — custom graph edges\n  ...\n---\n```\n\n### Schema Composition (`includes`)\n\nA level-2 bluepriNNt MAY declare `includes:`, an array of `{name, url}` references to\npeer level-2 bluepriNNts. `includes` composes the schemas of the included bluepriNNts into\nthe including bluepriNNt additively.\n\n```yaml\n---\nincludes:\n  - name: \"base\"\n    url: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/base/spec_NN.md\"\n---\n```\n\n#### Collision Rules\n\nWhen two included bluepriNNts (or an included bluepriNNt and the including bluepriNNt) declare a\nDefinition with the same name:\n\n1. If their canonical forms are **identical**, the collision is resolved cleanly: they\n   carry a shared Definition (e.g. two slices of a former bluepriNNt both declaring\n   the same `importance` Marker) and still compose.\n2. If their canonical forms **differ**, it is a validation ERROR that MUST name\n   both source documents and the Definition.\n\nThe **canonical form** of a Definition is its parsed body with: property order\nnormalized, surrounding whitespace in values trimmed, and set-like arrays\n(`applies_to`, `options`, `target_concepts`) treated as order-insensitive. Every\nactual value — `type`, `symbol`, `source`, `target`, `values`, `weight`,\n`description`, a Concept's Field set, etc. — is significant. This rule applies\nacross the whole `includes` graph (transitively, depth-first, left to right); the\n`includes` cycle check is unaffected (a diamond is not a cycle).\n\nBody:\n\n```markdown\n> [!NOTE]\n> This is an **iNNfo document**...\n\n# NN index\n* [[...]]  (the blueprint's root concepts)\n\n# NN Concept Definition\n## NN Concept Definition: <Concept>\nicon:: <icon>\ntype:: <type>\ncolor:: <color>\nweight:: <n>\n\n# NN Field Definition\n## NN Field Definition: <Field>\nconcept:: <Concept>\ntype:: <type>\noptions:: [...]\ntarget_concepts:: [...]\n\n# NN Marker Definition\n## NN Marker Definition: <Marker>\nsymbol:: <symbol>\n\n# NN Matrix Definition\n## NN Matrix Definition: <Matrix>\nsource:: <Concept>\ntarget:: <Concept>\nvalues:: [..]\nwidget:: set\n\n# <Blueprint Name>       (prose: Philosophy, Objectives, Specification)\n# Concept Guidance Documentation   (## <Concept> with ### Summary/Description/...)\n```\n\n## Level 3 kNNowledge Structure (Lightweight)\n\n```yaml\n---\nspec_version: \"V_0-3-0\"\nspec_url: \"<immutable-url>\"\nlevel: 3\nparent_spec:\n  name: \"<blueprint-name>\"\n  url: \"<immutable-url>\"\nknowledge_version: \"V_x-y-z\"\ntitle: \"...\"\n---\n\n> [!NOTE]\n> ...\n# NN index\n...\n# NN Concept\n## NN Concept: Element\nkey:: value\n...\n```\n\n## DomaiNN Structure\n\nAn iNNfo DomaiNN is a workspace directory containing one or more kNNowledge documents. The entry point is a\n`domaiNN_NN.md` (or root index) file at the DomaiNN root.\n\nStandard directory conventions:\n- `knowledge_dir`: `kNNowledge/`\n- `blueprints_dir`: `specs/bluepriNNts/`\n\n\n## Immutable Versioning Policy\n\n- **Published specs are frozen.** Once a specification version is released, its file is\n  never modified. Corrections or improvements require a new spec version.\n- **Migrating a kNNowledge document** to a new spec version means creating a new copy of the document\n  adapted to the new version.\n- **Parent chain resolution** always resolves to the version the document was authored\n  against.\n\n## Removed Constructs\n\nThe following are NOT part of iNNfo:\n\n- **FOLDER mode / `_F` markers** — documents are single files using `NN` markers only.\n- **Hierarchy matrices** — hierarchy is expressed only through the index block.\n- **`_FORMAT.md` filenames** — the canonical suffix is `_NN.md`.\n- **`* _NN` element bullets and fenced ```yaml property blocks** — replaced by the\n  unified `## NN` headings and `key:: value` properties.\n\n## Metaschema (Self-Description)\n\nThe four root primitives are described by the prose tables above **and** expressed\nmechanically, in iNNfo's own syntax, by the metaschema below. An application MUST\nbe able to validate any level-2 bluepriNNt by resolving this metaschema and checking\nthe bluepriNNt's `… Definition` elements against it.\n\n### The Metaschema\n\n```markdown\n# NN Concept Definition\n\n## NN Concept Definition: Concept Definition\ntype:: list\n\n## NN Concept Definition: Field Definition\ntype:: list\n\n## NN Concept Definition: Marker Definition\ntype:: list\n\n## NN Concept Definition: Matrix Definition\ntype:: list\n\n# NN Field Definition\n\n## NN Field Definition: type\nconcept:: Concept Definition\ntype:: select\noptions:: [text, category, weight, list, steps, sequence, knowledge]\ndescription:: Representation of the Concept (required).\n\n## NN Field Definition: icon\nconcept:: Concept Definition\ntype:: string\ndescription:: Lucide icon identifier.\n\n## NN Field Definition: color\nconcept:: Concept Definition\ntype:: string\ndescription:: Theme color.\n\n## NN Field Definition: weight\nconcept:: Concept Definition\ntype:: string\ndescription:: Display priority (higher = more prominent).\n\n## NN Field Definition: concept\nconcept:: Field Definition\ntype:: string\ndescription:: Name of the owning Concept Definition (required).\n\n## NN Field Definition: type\nconcept:: Field Definition\ntype:: select\noptions:: [string, select, reference, markdown_inline, markdown_file, image, file, video, audio, url, knowledge, citation]\ndescription:: Field type (required).\n\n## NN Field Definition: options\nconcept:: Field Definition\ntype:: string\ndescription:: Allowed values for select fields (inline array).\n\n## NN Field Definition: target_concepts\nconcept:: Field Definition\ntype:: string\ndescription:: Target concepts for reference fields (inline array).\n\n## NN Field Definition: target_blueprint\nconcept:: Field Definition\ntype:: string\ndescription:: Required blueprint name or URL for fields of type knowledge.\n\n## NN Field Definition: description\nconcept:: Field Definition\ntype:: string\ndescription:: Human-readable explanation.\n\n## NN Field Definition: applies_to\nconcept:: Marker Definition\ntype:: string\ndescription:: Inline array of Element and/or Concept — which entities may be scored. Default [Element].\n\n## NN Field Definition: values\nconcept:: Marker Definition\ntype:: string\ndescription:: Allowed scores (inline array). Omit for a free numeric scale.\n\n## NN Field Definition: widget\nconcept:: Marker Definition\ntype:: select\noptions:: [boolean, cycle, scale, set, text]\ndescription:: Cell interaction widget for the item-markers matrix column.\n\n## NN Field Definition: widget_config\nconcept:: Marker Definition\ntype:: string\ndescription:: Widget-specific configuration (inline JSON object).\n\n## NN Field Definition: symbol\nconcept:: Marker Definition\ntype:: string\ndescription:: Display symbol.\n\n## NN Field Definition: icon\nconcept:: Marker Definition\ntype:: string\ndescription:: Lucide icon identifier.\n\n## NN Field Definition: color\nconcept:: Marker Definition\ntype:: string\ndescription:: Theme color.\n\n## NN Field Definition: weight\nconcept:: Marker Definition\ntype:: string\ndescription:: Display priority. Not a score.\n\n## NN Field Definition: source\nconcept:: Matrix Definition\ntype:: string\ndescription:: Source Concept (rows) — required.\n\n## NN Field Definition: target\nconcept:: Matrix Definition\ntype:: string\ndescription:: Target Concept or reserved pseudo-Concept (columns) — required.\n\n## NN Field Definition: values\nconcept:: Matrix Definition\ntype:: string\ndescription:: Allowed cell values (inline array). Empty cell - and boolean marker X are always accepted.\n\n## NN Field Definition: widget\nconcept:: Matrix Definition\ntype:: select\noptions:: [boolean, cycle, scale, set, text]\ndescription:: Cell interaction widget.\n\n## NN Field Definition: widget_config\nconcept:: Matrix Definition\ntype:: string\ndescription:: Widget-specific configuration (inline JSON object).\n\n## NN Field Definition: description\nconcept:: Matrix Definition\ntype:: string\ndescription:: Human-readable explanation.\n```\n\n### Bootstrap Axiom\n\nThe metaschema is written in the very syntax it constrains. Its own conformance is\nthe single irreducible axiom of the system: an application **asserts** — it does\nnot derive — that the metaschema's `Field Definition` elements are valid\n`Field Definition` instances. Every other conformance check in the ecosystem\n(L2 against L1, L3 against L2) is mechanical and follows from it. This mirrors MOF\nbeing defined in MOF and `Ecore.ecore` describing Ecore.\n\n## Self-Description\n\nThis document (`iNNfo_V_0-3-0_NN.md`) is itself a level 1 specification following\ndefiNNition. It declares `parent: \"https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md\"` and defines\nthe four root primitives — plus the mechanical metaschema above — that every\nlevel-2 bluepriNNt instantiates.\n";

const PROCEDURES_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Procedures App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
viewers:
  - id: "guided-procedure"
    view_type: "fsm-stepper"
    target_concept: "Work"
    label: "Guided Procedure Execution"
    icon: "play-circle"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Concept Definition

## NN Concept Definition: Procedure
icon:: workflow
type:: list
color:: teal
weight:: 110

## NN Concept Definition: Work
icon:: list-ordered
type:: list
color:: blue
weight:: 100

## NN Concept Definition: Artifact
icon:: package
type:: list
color:: orange
weight:: 80

## NN Concept Definition: Tools
icon:: wrench
type:: list
color:: orange
weight:: 70

## NN Concept Definition: Roles
icon:: users
type:: list
color:: green
weight:: 60

# NN Field Definition

## NN Field Definition: category
concept:: Procedure
type:: select
options:: [ingestion, transformation, audit, reporting, custom]

## NN Field Definition: summary
concept:: Procedure
type:: string

## NN Field Definition: inputs_required
concept:: Procedure
type:: string

## NN Field Definition: outputs_expected
concept:: Procedure
type:: string

## NN Field Definition: executed_by
concept:: Procedure
type:: string

## NN Field Definition: procedure_model
concept:: Procedure
type:: model

## NN Field Definition: step_type
concept:: Work
type:: select
options:: [task, decision, event]

## NN Field Definition: parent
concept:: Work
type:: reference
target_concepts:: [Work]

## NN Field Definition: next
concept:: Work
type:: reference
target_concepts:: [Work]

## NN Field Definition: condition
concept:: Work
type:: string

## NN Field Definition: input
concept:: Work
type:: reference
target_concepts:: [Artifact]

## NN Field Definition: output
concept:: Work
type:: reference
target_concepts:: [Artifact]

## NN Field Definition: output_status
concept:: Work
type:: string

## NN Field Definition: tool
concept:: Work
type:: reference
target_concepts:: [Tools]

## NN Field Definition: scope
concept:: Roles
type:: select
options:: [internal, external]

# NN Marker Definition

## NN Marker Definition: complexity
applies_to:: [Element, Concept]
icon:: gauge
color:: green
weight:: 50

# NN Matrix Definition

## NN Matrix Definition: work-roles matrix
source:: Work
target:: Roles
values:: [Responsible, Accountable, Consulted, Informed]

## NN Matrix Definition: work-tools matrix
source:: Work
target:: Tools
values:: [Uses]

## NN Matrix Definition: work-artifacts matrix
source:: Work
target:: Artifact
values:: [Creates, Modifies, Validates, Reviews]
`

const SOURCES_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/sources/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-1-0"
title: "Sources Catalog App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Source]]

# NN Concept Definition

## NN Concept Definition: Source
icon:: file-input
type:: list
color:: teal
weight:: 100

# NN Field Definition

## NN Field Definition: type
concept:: Source
type:: select
options:: [local_file, url_snapshot, dynamic_feed, git_repo, api_export]

## NN Field Definition: origin_uri
concept:: Source
type:: string

## NN Field Definition: format
concept:: Source
type:: select
options:: [pdf, docx, html, md, json, csv, audio, xlsx, repo]

## NN Field Definition: raw_path
concept:: Source
type:: string

## NN Field Definition: summary
concept:: Source
type:: string

## NN Field Definition: tags
concept:: Source
type:: string

## NN Field Definition: status
concept:: Source
type:: select
options:: [ready, stale, processing, error]

## NN Field Definition: source_model
concept:: Source
type:: model
`

const ARTIFACTS_SPEC_CONTENT = `---
spec_version: "V_0-2-2"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/artifacts/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md"
template_version: "V_0-2-0"
title: "Artifacts Catalog App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Artifact]]

# NN Concept Definition

## NN Concept Definition: Artifact
icon:: file-output
type:: list
color:: teal
weight:: 100

# NN Field Definition

## NN Field Definition: format
concept:: Artifact
type:: select
options:: [model, markdown, html, json, csv, binary]

## NN Field Definition: summary
concept:: Artifact
type:: string

## NN Field Definition: status
concept:: Artifact
type:: select
options:: [draft, verified, published, deprecated]

## NN Field Definition: tags
concept:: Artifact
type:: string

## NN Field Definition: produced_by
concept:: Artifact
type:: string

## NN Field Definition: sources
concept:: Artifact
type:: citation

## NN Field Definition: artifact_model
concept:: Artifact
type:: model

## NN Field Definition: file_path
concept:: Artifact
type:: string
`

const ORGANIZATION_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-2"
title: "Organization App"
procedures:
  - id: "audit-skill-gaps"
    name: "Audit Skill Gaps"
    path: "procedures/audit_skill_gaps_NN.md"
  - id: "export-team-directory"
    name: "Export Team Directory"
    path: "procedures/export_team_directory_NN.md"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Organization]]
  * [[Roles]]
  * [[Functions]]
  * [[Position]]
  * [[Person]]
  * [[Skills]]

# NN Concept Definition

## NN Concept Definition: Organization
icon:: building-2
type:: text
color:: blue
weight:: 100

## NN Concept Definition: Roles
icon:: user-check
type:: list
color:: green
weight:: 60

## NN Concept Definition: Functions
icon:: workflow
type:: list
color:: purple
weight:: 55

## NN Concept Definition: Position
icon:: contact
type:: list
color:: teal
weight:: 50

## NN Concept Definition: Person
icon:: user
type:: list
color:: cyan
weight:: 40

## NN Concept Definition: Skills
icon:: award
type:: list
color:: indigo
weight:: 30

# NN Field Definition

## NN Field Definition: scope
concept:: Roles
type:: select
options:: [internal, external]

## NN Field Definition: position_ref
concept:: Person
type:: reference
target_concepts:: [Position]
description:: Reference to the Position held by the team member.

## NN Field Definition: compensation
concept:: Person
type:: string
description:: Compensation structure, salary, equity, or incentives.

## NN Field Definition: contributions
concept:: Person
type:: string
description:: Primary contributions, role dedication, and key deliverables.

## NN Field Definition: image
concept:: Person
type:: image
description:: Visual portrait or avatar representing the person.

# NN Marker Definition

## NN Marker Definition: complexity
applies_to:: [Element, Concept]
icon:: gauge
color:: green
weight:: 50

# NN Matrix Definition

## NN Matrix Definition: positions-roles matrix
source:: Position
target:: Roles
values:: [Assumes]
widget:: boolean

## NN Matrix Definition: persons-positions matrix
source:: Person
target:: Position
values:: [Occupies]
widget:: boolean

## NN Matrix Definition: Functions-Positions Matrix
source:: Functions
target:: Position
values:: [Assumes]
widget:: boolean
description:: Boolean assignment of which Position assumes responsibility for each Function.
`

const METRICS_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Metrics App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
procedures:
  - id: "create-timeline"
    name: "Create Timeline"
    path: "procedures/create_timeline_NN.md"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Metrics]]
* [[Variables]]
* [[Evolution]]
* [[Scenario]]

# NN Concept Definition

## NN Concept Definition: Metrics
icon:: bar-chart-3
type:: list
color:: blue
weight:: 100

## NN Concept Definition: Variables
icon:: settings-2
type:: list
color:: green
weight:: 80

## NN Concept Definition: Evolution
icon:: trending-up
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Scenario
icon:: layers
type:: list
color:: purple
weight:: 70

# NN Field Definition

## NN Field Definition: metricValue
concept:: Metrics
type:: string

## NN Field Definition: metricFormula
concept:: Metrics
type:: string

## NN Field Definition: dependsOn
concept:: Metrics
type:: reference
target_concepts:: [Metrics, Variables]

## NN Field Definition: metricType
concept:: Metrics
type:: select
options:: [result, revenue, expense, tax, investment]

## NN Field Definition: metricUnit
concept:: Metrics
type:: string

## NN Field Definition: varValue
concept:: Variables
type:: string

## NN Field Definition: varUnit
concept:: Variables
type:: string

## NN Field Definition: changePercent
concept:: Evolution
type:: string

## NN Field Definition: probability
concept:: Scenario
type:: string

# NN Marker Definition

## NN Marker Definition: is_variable
applies_to:: [Element]
icon:: variable
color:: green

## NN Marker Definition: is_formula
applies_to:: [Element]
icon:: calculator
color:: blue

## NN Marker Definition: is_derived
applies_to:: [Element]
icon:: git-branch
color:: orange

# NN Matrix Definition

## NN Matrix Definition: metrics-dependencies
source:: Metrics
target:: Metrics
values:: [Feeds]

## NN Matrix Definition: metric-variables
source:: Metrics
target:: Variables
values:: [Uses]

## NN Matrix Definition: scenario-metrics
source:: Scenario
target:: Metrics
values:: [Modifies]
`

const WORKSPACE_SPEC_CONTENT = `---
spec_version: "V_0-2-2"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/workspace_spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md"
title: "Workspace Specification App"
template_version: "V_0-6-0"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Workspace]]
* [[Models]]
* [[Templates]]
* [[Specs]]
* [[Sources]]
* [[Procedures]]
* [[Artifacts]]
* [[Skills]]
* [[Tools]]
* [[Tags]]

# NN Concept Definition

## NN Concept Definition: Workspace
icon:: layout-dashboard
type:: text
color:: grey
weight:: 100

## NN Concept Definition: Models
icon:: file-symlink
type:: model
color:: purple
weight:: 95

## NN Concept Definition: Templates
icon:: copy
type:: model
color:: grey
weight:: 90

## NN Concept Definition: Specs
icon:: book-open
type:: model
color:: grey
weight:: 85

## NN Concept Definition: Sources
icon:: file-input
type:: model
color:: grey
weight:: 80

## NN Concept Definition: Procedures
icon:: workflow
type:: model
color:: grey
weight:: 75

## NN Concept Definition: Artifacts
icon:: file-output
type:: model
color:: grey
weight:: 70

## NN Concept Definition: Skills
icon:: bot
type:: list
color:: grey
weight:: 65

## NN Concept Definition: Tools
icon:: wrench
type:: list
color:: grey
weight:: 60

## NN Concept Definition: Tags
icon:: tag
type:: category
color:: grey
weight:: 50

# NN Field Definition

<!-- Workspace fields: conventions & global config -->

## NN Field Definition: name
concept:: Workspace
type:: string
description:: Display name or title of the workspace.

## NN Field Definition: environment
concept:: Workspace
type:: select
options:: [development, staging, production]
description:: Execution context of the workspace.

## NN Field Definition: models_dir
concept:: Workspace
type:: string
description:: Base relative path for domain models in the workspace (default: models/).

## NN Field Definition: sources_dir
concept:: Workspace
type:: string
description:: Base relative path for normalized sources in the workspace (default: sources/nn/).

## NN Field Definition: templates_dir
concept:: Workspace
type:: string
description:: Base relative path for template packages in the workspace (default: templates/).

## NN Field Definition: skills_dir
concept:: Workspace
type:: string
description:: Base relative path for agent skills in the workspace (default: skills/).

<!-- Specs fields -->

## NN Field Definition: path
concept:: Specs
type:: model
description:: Workspace-relative path to the formal specification document (e.g. specs/iNNfo_V_0-2-1_NN.md).

## NN Field Definition: level
concept:: Specs
type:: select
options:: [0, 1, 2]
description:: Abstraction level of the spec (0=primitive meta-meta, 1=meta-template, 2=template spec).

<!-- Templates fields -->

## NN Field Definition: path
concept:: Templates
type:: model
description:: Workspace-relative path to the template spec_NN.md file (e.g. templates/business/spec_NN.md).

## NN Field Definition: category
concept:: Templates
type:: string
description:: Domain classification or strategic focus of the template.

<!-- Models fields: inventory + lineage -->

## NN Field Definition: path
concept:: Models
type:: model
description:: Workspace-relative path to the referenced model file.

## NN Field Definition: template
concept:: Models
type:: string
description:: The level-2 template the referenced model conforms to.

## NN Field Definition: status
concept:: Models
type:: select
options:: [draft, active, archived]
description:: Lifecycle status of the model within this workspace.

## NN Field Definition: author
concept:: Models
type:: string
description:: Author or owner of the model within this workspace (workspace-scoped; not stored in the model file).

## NN Field Definition: generated_by
concept:: Models
type:: reference
target_concepts:: [Procedures]
description:: The Procedure run that produced this model (PROV wasGeneratedBy).

<!-- Sources fields: link to sources catalog model -->

## NN Field Definition: path
concept:: Sources
type:: model
description:: Workspace-relative path to the sources catalog model document (e.g. sources_NN.md).

<!-- Procedures fields: link to procedures catalog model -->

## NN Field Definition: path
concept:: Procedures
type:: model
description:: Workspace-relative path to the procedures catalog model document (e.g. procedures_NN.md).

<!-- Artifacts fields: link to artifacts catalog model -->

## NN Field Definition: path
concept:: Artifacts
type:: model
description:: Workspace-relative path to the artifacts catalog model document (e.g. artifacts_NN.md).

<!-- Skills fields: link to AI agent skills -->

## NN Field Definition: path
concept:: Skills
type:: file
description:: Relative path to the agent SKILL.md file.

## NN Field Definition: role
concept:: Skills
type:: string
description:: Operational role and specialization of the skill agent.

## NN Field Definition: target_agents
concept:: Skills
type:: string
description:: Compatible agent platforms (e.g. Antigravity, Claude Code, OpenCode).

<!-- Tools fields: link to executable tools and scripts -->

## NN Field Definition: path
concept:: Tools
type:: file
description:: Relative path to the executable tool script or CLI runner.

## NN Field Definition: runtime
concept:: Tools
type:: select
options:: [node, python, bash, powershell]
description:: Execution runtime required for this tool.

<!-- Tags fields -->

## NN Field Definition: color
concept:: Tags
type:: string
description:: Hex color code (e.g. #10b981) or CSS token for tag badges and highlights.

## NN Field Definition: icon
concept:: Tags
type:: string
description:: Icon identifier (e.g. Lucide icon name) displayed with the tag badge.

## NN Field Definition: description
concept:: Tags
type:: string
description:: Semantic description, strategic intent, or scope of the tag.

# NN Marker Definition

## NN Marker Definition: verified
applies_to:: [Element]
symbol:: >
icon:: shield-check
color:: green
`

const COGNNITIVE_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/cogNNitive/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-0"
title: "cogNNitive Template"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Sources]]
* [[ModelRecords]]
* [[Artifacts]]
* [[Procedures]]

# NN Concept Definition

## NN Concept Definition: Sources
icon:: file-input
type:: list
color:: teal
weight:: 90

## NN Concept Definition: ModelRecords
icon:: boxes
type:: list
color:: teal
weight:: 80

## NN Concept Definition: Artifacts
icon:: file-output
type:: list
color:: teal
weight:: 80

## NN Concept Definition: Procedures
icon:: workflow
type:: list
color:: teal
weight:: 60

# NN Field Definition

## NN Field Definition: raw_filename
concept:: Sources
type:: string

## NN Field Definition: raw_hash
concept:: Sources
type:: string

## NN Field Definition: size
concept:: Sources
type:: string

## NN Field Definition: source_format
concept:: Sources
type:: select
options:: [txt, md, csv, json, docx, pdf, xlsx]

## NN Field Definition: normalized_at
concept:: Sources
type:: string

## NN Field Definition: normalized_by
concept:: Sources
type:: string

## NN Field Definition: normalized_content
concept:: Sources
type:: markdown_file

## NN Field Definition: raw_file
concept:: Sources
type:: file

## NN Field Definition: model_ref
concept:: ModelRecords
type:: string

## NN Field Definition: model_template
concept:: ModelRecords
type:: string

## NN Field Definition: model_version
concept:: ModelRecords
type:: string

## NN Field Definition: derived_from
concept:: ModelRecords
type:: reference
target_concepts:: [Sources]

## NN Field Definition: generated_by
concept:: ModelRecords
type:: reference
target_concepts:: [Procedures]

## NN Field Definition: artifact_format
concept:: Artifacts
type:: select
options:: [document, report, board, dataset]

## NN Field Definition: artifact_version
concept:: Artifacts
type:: string

## NN Field Definition: location
concept:: Artifacts
type:: string

## NN Field Definition: artifact_hash
concept:: Artifacts
type:: string

## NN Field Definition: derived_from_inputs
concept:: Artifacts
type:: reference
target_concepts:: [Sources, ModelRecords]

## NN Field Definition: produced_by
concept:: Artifacts
type:: reference
target_concepts:: [Procedures]

## NN Field Definition: procedure_ref
concept:: Procedures
type:: string

## NN Field Definition: agent
concept:: Procedures
type:: string

## NN Field Definition: run_at
concept:: Procedures
type:: string

# NN Marker Definition

## NN Marker Definition: verified
applies_to:: [Element]
symbol:: >
icon:: shield-check
color:: green

# NN Matrix Definition

## NN Matrix Definition: Artifact-Source Lineage
source:: Artifacts
target:: Sources
values:: [X]
widget:: boolean
`

const ANALYSIS_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/analysis/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-1"
title: "Analysis App"
procedures:
  - id: "run-coherence-audit"
    name: "Run Coherence Audit"
    path: "procedures/run_coherence_audit_NN.md"
  - id: "prioritize-experiments"
    name: "Prioritize Experiments"
    path: "procedures/prioritize_experiments_NN.md"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Analysis]]
  * [[Assumptions]]
  * [[Risks]]
  * [[Keys]]
  * [[Suggestions]]
* [[Validation]]
  * [[Coherence]]
  * [[Experiments]]

# NN Concept Definition

## NN Concept Definition: Analysis
icon:: microscope
type:: category
color:: red
weight:: 80

## NN Concept Definition: Assumptions
icon:: circle-help
type:: weight
color:: red
weight:: 50

## NN Concept Definition: Risks
icon:: shield-alert
type:: weight
color:: red
weight:: 90

## NN Concept Definition: Suggestions
icon:: messages-square
type:: weight
color:: red
weight:: 30

## NN Concept Definition: Keys
icon:: key-round
type:: weight
color:: red
weight:: 50

## NN Concept Definition: Validation
icon:: clipboard-check
type:: category
color:: green
weight:: 90

## NN Concept Definition: Coherence
icon:: link
type:: weight
color:: green
weight:: 25

## NN Concept Definition: Experiments
icon:: flask-conical
type:: weight
color:: green
weight:: 40

# NN Marker Definition

## NN Marker Definition: importance
applies_to:: [Element]
icon:: alert-circle
color:: red
weight:: 80

## NN Marker Definition: completion
applies_to:: [Element]
icon:: check-circle-2
color:: green
weight:: 60

## NN Marker Definition: certainty
applies_to:: [Element]
icon:: help-circle
color:: blue
weight:: 50

## NN Marker Definition: priority
applies_to:: [Element]
icon:: flame
color:: orange
weight:: 90

## NN Marker Definition: rating
applies_to:: [Element]
icon:: star
color:: yellow
weight:: 70

# NN Matrix Definition

## NN Matrix Definition: Assumptions-Risks
source:: Assumptions
target:: Risks
values:: [Mitigates, Exacerbates, Independent]

## NN Matrix Definition: Experiments-Assumptions
source:: Experiments
target:: Assumptions
values:: [Tests, Validates, Invalidates]
`

const PROJECTS_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-0"
title: "Projects App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Project]]
  * [[Phases]]
  * [[Milestone]]
  * [[Deliverable]]
  * [[Task]]
  * [[Risk]]
  * [[Project roles]]

# NN Concept Definition

## NN Concept Definition: Project
icon:: folder-kanban
type:: text
color:: blue
weight:: 100

## NN Concept Definition: Phases
icon:: calendar
type:: list
color:: blue
weight:: 80

## NN Concept Definition: Milestone
icon:: flag
type:: list
color:: green
weight:: 70

## NN Concept Definition: Deliverable
icon:: package
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Task
icon:: check-square
type:: list
color:: purple
weight:: 50

## NN Concept Definition: Risk
icon:: alert-triangle
type:: list
color:: red
weight:: 40

## NN Concept Definition: Project roles
icon:: user
type:: list
color:: green
weight:: 30

# NN Field Definition

## NN Field Definition: start_date
concept:: Phases
type:: string

## NN Field Definition: end_date
concept:: Phases
type:: string

## NN Field Definition: due_date
concept:: Milestone
type:: string

## NN Field Definition: status
concept:: Task
type:: select
options:: [todo, in_progress, blocked, done]

## NN Field Definition: assignee
concept:: Task
type:: reference
target_concepts:: [Project roles]

## NN Field Definition: severity
concept:: Risk
type:: select
options:: [low, medium, high, critical]

# NN Marker Definition

## NN Marker Definition: health
applies_to:: [Element]
icon:: activity
color:: green

# NN Matrix Definition

## NN Matrix Definition: task-roles
source:: Task
target:: Project roles
values:: [Assigned]

## NN Matrix Definition: task-deliverables
source:: Task
target:: Deliverable
values:: [Produces]

## NN Matrix Definition: risks-milestones
source:: Risk
target:: Milestone
values:: [Threatens]
`

const BUSINESS_MODEL_SPEC_CONTENT = `---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business-model/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-2"
title: "Business Model App"
includes:
  - name: "organization"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
  - name: "projects"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Business summary]]
* [[Market]]
  * [[Stakeholders]]
    * [[Stakeholder roles]]
  * [[Segments]]
    * [[Profiles]]
      * [[Persona]]
    * [[Segmentation]]
  * [[Market trends]]
  * [[Market size]]
  * [[Competition]]
* [[Value propositions]]
  * [[Problems]]
  * [[Messages]]
  * [[Channels]]
  * [[Perceptions]]
  * [[Emotions]]
  * [[Behaviors]]
  * [[Journey]]
* [[Solutions]]
  * [[Products and services]]
    * [[Components]]
    * [[Features]]
    * [[Roadmap]]
  * [[Offerings]]
* [[Marketing]]
  * [[Branding]]
  * [[Media plan]]
  * [[Communication]]
  * [[Pitch]]
  * [[Web]]
  * [[Storytelling]]
  * [[Presentations]]
* [[Team]]
  * [[Contributions]]
  * [[Compensations]]
* [[Business idea]]
  * [[Inspiration]]
  * [[Opportunity]]
* [[Business status]]
* [[Challenges]]
* [[Business objectives]]
  * [[Mission]]
  * [[Vision]]
  * [[Organizational values]]
  * [[Organizational goals]]
* [[Goals]]
* [[Operations]]
  * [[Activities]]
  * [[Resources]]
* [[Finance]]
  * [[Revenue]]
  * [[Costs]]
  * [[Unit economics]]
  * [[Funding sources]]
    * [[Shareholders]]
  * [[Projections]]
* [[Legal]]
  * [[Legal issues]]
  * [[Contracts]]
* [[Unfair advantage]]
* [[Procedure]]
* [[Misc]]

# NN Concept Definition

## NN Concept Definition: Business summary
icon:: file-text
type:: text
color:: blue
weight:: 90

## NN Concept Definition: Market
icon:: store
type:: category
color:: orange
weight:: 80

## NN Concept Definition: Stakeholders
icon:: users
type:: list
color:: orange
weight:: 70

## NN Concept Definition: Stakeholder roles
icon:: user-cog
type:: list
color:: orange
weight:: 50

## NN Concept Definition: Segments
icon:: pie-chart
type:: list
color:: orange
weight:: 75

## NN Concept Definition: Profiles
icon:: contact
type:: list
color:: orange
weight:: 65

## NN Concept Definition: Persona
icon:: user-check
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Segmentation
icon:: split
type:: list
color:: orange
weight:: 55

## NN Concept Definition: Market trends
icon:: trending-up
type:: list
color:: orange
weight:: 50

## NN Concept Definition: Market size
icon:: maximize-2
type:: list
color:: orange
weight:: 50

## NN Concept Definition: Competition
icon:: swords
type:: list
color:: orange
weight:: 60

## NN Concept Definition: Value propositions
icon:: gem
type:: list
color:: yellow
weight:: 85

## NN Concept Definition: Problems
icon:: alert-circle
type:: list
color:: yellow
weight:: 80

## NN Concept Definition: Messages
icon:: message-square
type:: list
color:: yellow
weight:: 60

## NN Concept Definition: Channels
icon:: radio
type:: list
color:: yellow
weight:: 65

## NN Concept Definition: Perceptions
icon:: eye
type:: list
color:: yellow
weight:: 50

## NN Concept Definition: Emotions
icon:: heart
type:: list
color:: yellow
weight:: 45

## NN Concept Definition: Behaviors
icon:: activity
type:: list
color:: yellow
weight:: 55

## NN Concept Definition: Journey
icon:: navigation
type:: list
color:: yellow
weight:: 70

## NN Concept Definition: Solutions
icon:: lightbulb
type:: category
color:: green
weight:: 80

## NN Concept Definition: Products and services
icon:: package
type:: list
color:: green
weight:: 75

## NN Concept Definition: Components
icon:: cpu
type:: list
color:: green
weight:: 60

## NN Concept Definition: Features
icon:: star
type:: list
color:: green
weight:: 65

## NN Concept Definition: Roadmap
icon:: map
type:: list
color:: green
weight:: 70

## NN Concept Definition: Offerings
icon:: shopping-bag
type:: list
color:: green
weight:: 80

## NN Concept Definition: Marketing
icon:: megaphone
type:: category
color:: purple
weight:: 70

## NN Concept Definition: Branding
icon:: palette
type:: list
color:: purple
weight:: 60

## NN Concept Definition: Media plan
icon:: tv
type:: list
color:: purple
weight:: 50

## NN Concept Definition: Communication
icon:: share-2
type:: list
color:: purple
weight:: 55

## NN Concept Definition: Pitch
icon:: presentation
type:: list
color:: purple
weight:: 65

## NN Concept Definition: Web
icon:: globe
type:: list
color:: purple
weight:: 50

## NN Concept Definition: Storytelling
icon:: book-open
type:: list
color:: purple
weight:: 45

## NN Concept Definition: Presentations
icon:: file-slides
type:: list
color:: purple
weight:: 50

## NN Concept Definition: Team
icon:: users-2
type:: category
color:: blue
weight:: 70

## NN Concept Definition: Contributions
icon:: gift
type:: list
color:: blue
weight:: 50

## NN Concept Definition: Compensations
icon:: dollar-sign
type:: list
color:: blue
weight:: 50

## NN Concept Definition: Business idea
icon:: sparkler
type:: category
color:: cyan
weight:: 60

## NN Concept Definition: Inspiration
icon:: sun
type:: list
color:: cyan
weight:: 40

## NN Concept Definition: Opportunity
icon:: compass
type:: list
color:: cyan
weight:: 50

## NN Concept Definition: Business status
icon:: flag
type:: list
color:: cyan
weight:: 45

## NN Concept Definition: Challenges
icon:: mountain
type:: list
color:: cyan
weight:: 50

## NN Concept Definition: Business objectives
icon:: target
type:: category
color:: emerald
weight:: 75

## NN Concept Definition: Mission
icon:: rocket
type:: text
color:: emerald
weight:: 70

## NN Concept Definition: Vision
icon:: telescope
type:: text
color:: emerald
weight:: 70

## NN Concept Definition: Organizational values
icon:: shield
type:: list
color:: emerald
weight:: 60

## NN Concept Definition: Organizational goals
icon:: check-circle
type:: list
color:: emerald
weight:: 65

## NN Concept Definition: Goals
icon:: crosshair
type:: list
color:: emerald
weight:: 60

## NN Concept Definition: Operations
icon:: cog
type:: category
color:: slate
weight:: 70

## NN Concept Definition: Activities
icon:: zap
type:: list
color:: slate
weight:: 65

## NN Concept Definition: Resources
icon:: box
type:: list
color:: slate
weight:: 60

## NN Concept Definition: Finance
icon:: wallet
type:: category
color:: lime
weight:: 80

## NN Concept Definition: Revenue
icon:: arrow-up-right
type:: list
color:: lime
weight:: 75

## NN Concept Definition: Costs
icon:: arrow-down-right
type:: list
color:: lime
weight:: 70

## NN Concept Definition: Unit economics
icon:: scale
type:: list
color:: lime
weight:: 60

## NN Concept Definition: Funding sources
icon:: landmark
type:: list
color:: lime
weight:: 65

## NN Concept Definition: Shareholders
icon:: user-check
type:: list
color:: lime
weight:: 50

## NN Concept Definition: Projections
icon:: line-chart
type:: list
color:: lime
weight:: 70

## NN Concept Definition: Legal
icon:: scale
type:: category
color:: amber
weight:: 50

## NN Concept Definition: Legal issues
icon:: alert-octagon
type:: list
color:: amber
weight:: 45

## NN Concept Definition: Contracts
icon:: file-signature
type:: list
color:: amber
weight:: 50

## NN Concept Definition: Unfair advantage
icon:: trophy
type:: list
color:: violet
weight:: 65

## NN Concept Definition: Procedure
icon:: workflow
type:: list
color:: teal
weight:: 60

## NN Concept Definition: Misc
icon:: more-horizontal
type:: list
color:: gray
weight:: 20

# NN Field Definition

## NN Field Definition: relationship_model
concept:: Stakeholders
type:: string

## NN Field Definition: problem_severity
concept:: Problems
type:: select
options:: [critical, major, moderate, minor]

## NN Field Definition: price_model
concept:: Offerings
type:: string

# NN Marker Definition

## NN Marker Definition: importance
applies_to:: [Element]
icon:: alert-circle
color:: red
weight:: 80

## NN Marker Definition: completion
applies_to:: [Element]
icon:: check-circle-2
color:: green
weight:: 60

## NN Marker Definition: certainty
applies_to:: [Element]
icon:: help-circle
color:: blue
weight:: 50

## NN Marker Definition: priority
applies_to:: [Element]
icon:: flame
color:: orange
weight:: 90

## NN Marker Definition: rating
applies_to:: [Element]
icon:: star
color:: yellow
weight:: 70

# NN Matrix Definition

## NN Matrix Definition: Journey map
source:: Journey
target:: Touchpoints
values:: [High, Med, Low, None]

## NN Matrix Definition: Segmentation-Profiles
source:: Segmentation
target:: Profiles
values:: [Primary, Secondary, Target]

## NN Matrix Definition: Problems-Value propositions
source:: Problems
target:: Value propositions
values:: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]
widget:: set

## NN Matrix Definition: Value propositions-Messages
source:: Value propositions
target:: Messages
values:: [Addresses]

## NN Matrix Definition: Messages-Channels
source:: Messages
target:: Channels
values:: [Broadcasts]

## NN Matrix Definition: Features-Milestone
source:: Features
target:: Milestone
values:: [Targeted]

## NN Matrix Definition: Organizational values-Organizational goals
source:: Organizational values
target:: Organizational goals
values:: [Reinforces]

## NN Matrix Definition: Activities-Resources
source:: Activities
target:: Resources
values:: [Requires]

## NN Matrix Definition: Problems-Competition
source:: Problems
target:: Competition
values:: [Better, Parity, Worse]
`

const BUSINESS_SPEC_CONTENT = `---
spec_version: "V_0-2-5"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-2-6"
title: "Business App"
includes:
  - name: "business-model"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business-model/spec_NN.md"
  - name: "analysis"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/analysis/spec_NN.md"
  - name: "organization"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/organization/spec_NN.md"
  - name: "projects"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/projects/spec_NN.md"
  - name: "metrics"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/metrics/spec_NN.md"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: true
assets:
  - id: "model-viewer-shell"
    name: "Model Viewer HTML Layout"
    path: "assets/model_viewer.html"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Matrix Definition

## NN Matrix Definition: Metrics-Organizational goals Matrix
source:: Metrics
target:: Organizational goals
values:: [Max, Very High, High, Slightly High, Neutral, Slightly Low, Low, Very Low, Min]
widget:: set
description:: Scores how directly each Metric tracks each Organizational goal.
`

export const CANONICAL_TEMPLATES: Record<string, CanonicalTemplate> = {
  business: {
    name: 'business',
    version: 'V_0-2-6',
    aliases: [
      'business',
      'business_spec_nn',
      'business_spec',
      'business_v_0-2-0_nn',
      'business_v_0-2-0',
      'business_v_0-2-1',
      'business_v_0-2-2',
      'business_v_0-2-3',
      'business_v_0-2-4',
      'business_v_0-2-5',
      'business_v_0-1-0',
      'business_v_0-1-1',
      'specs/templates/business/spec_nn.md',
      'specs/templates/business/business_v_0-2-0_nn.md',
      'specs/templates/business/business_v_0-2-1_nn.md',
      'specs/templates/business/business_v_0-2-3_nn.md',
      'specs/templates/business/business_v_0-2-4_nn.md',
      'specs/templates/business/business_v_0-2-5_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-1_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-3_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-4_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business/business_v_0-2-5_nn.md',
    ],
    specContent: BUSINESS_SPEC_CONTENT,
  },
  procedures: {
    name: 'procedures',
    version: 'V_0-2-1',
    aliases: [
      'procedures',
      'procedures_spec_nn',
      'procedures_spec',
      'procedures_v_0-2-0_nn',
      'procedures_v_0-2-0',
      'procedures_v_0-2-1',
      'procedures_v_0-1-0',
      'specs/templates/procedures/spec_nn.md',
      'specs/templates/procedures/procedures_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/procedures/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/procedures/procedures_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/procedures/procedures_v_0-2-1_nn.md',
    ],
    specContent: PROCEDURES_SPEC_CONTENT,
  },
  sources: {
    name: 'sources',
    version: 'V_0-1-0',
    aliases: [
      'sources',
      'sources_spec_nn',
      'sources_spec',
      'sources_v_0-1-0_nn',
      'sources_v_0-1-0',
      'specs/templates/sources/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/sources/spec_nn.md',
    ],
    specContent: SOURCES_SPEC_CONTENT,
  },
  artifacts: {
    name: 'artifacts',
    version: 'V_0-2-0',
    aliases: [
      'artifacts',
      'artifacts_spec_nn',
      'artifacts_spec',
      'artifacts_v_0-1-0_nn',
      'artifacts_v_0-1-0',
      'artifacts_v_0-2-0',
      'specs/templates/artifacts/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/artifacts/spec_nn.md',
    ],
    specContent: ARTIFACTS_SPEC_CONTENT,
  },
  organization: {
    name: 'organization',
    version: 'V_0-2-1',
    aliases: [
      'organization',
      'organization_spec_nn',
      'organization_spec',
      'organization_v_0-2-0_nn',
      'organization_v_0-2-0',
      'organization_v_0-2-1',
      'organization_v_0-2-2',
      'specs/templates/organization/spec_nn.md',
      'specs/templates/organization/organization_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/organization/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/organization/organization_v_0-2-0_nn.md',
    ],
    specContent: ORGANIZATION_SPEC_CONTENT,
  },
  metrics: {
    name: 'metrics',
    version: 'V_0-2-1',
    aliases: [
      'metrics',
      'metrics_spec_nn',
      'metrics_spec',
      'metrics_v_0-2-0_nn',
      'metrics_v_0-2-0',
      'metrics_v_0-2-1',
      'specs/templates/metrics/spec_nn.md',
      'specs/templates/metrics/metrics_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/metrics/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/metrics/metrics_v_0-2-0_nn.md',
    ],
    specContent: METRICS_SPEC_CONTENT,
  },
  workspace: {
    name: 'workspace',
    version: 'V_0-6-0',
    aliases: [
      'workspace',
      'workspace_spec_nn',
      'workspace_spec',
      'workspace_v_0-1-0',
      'workspace_v_0-2-0_nn',
      'workspace_v_0-2-0',
      'workspace_v_0-2-1',
      'workspace_v_0-3-0',
      'workspace_v_0-3-0_spec',
      'workspace_v_0-3-0_spec_nn',
      'workspace_v_0-4-0',
      'workspace_v_0-5-1',
      'workspace_v_0-6-0',
      'specs/templates/workspace_spec_nn.md',
      'specs/templates/workspace/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/workspace_spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/workspace_v_0-3-0_spec_nn.md',
    ],
    specContent: WORKSPACE_SPEC_CONTENT,
  },
  cognnitive: {
    name: 'cogNNitive',
    version: 'V_0-2-1',
    aliases: [
      'cognnitive',
      'cognnitive_spec_nn',
      'cognnitive_spec',
      'cognnitive_v_0-2-0_nn',
      'cognnitive_v_0-2-0',
      'specs/templates/cognnitive/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/cognnitive/spec_nn.md',
    ],
    specContent: COGNNITIVE_SPEC_CONTENT,
  },
  analysis: {
    name: 'analysis',
    version: 'V_0-2-1',
    aliases: [
      'analysis',
      'analysis_spec_nn',
      'analysis_spec',
      'analysis_v_0-2-0',
      'analysis_v_0-2-1',
      'specs/templates/analysis/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/analysis/spec_nn.md',
    ],
    specContent: ANALYSIS_SPEC_CONTENT,
  },
  projects: {
    name: 'projects',
    version: 'V_0-2-1',
    aliases: [
      'projects',
      'projects_spec_nn',
      'projects_spec',
      'projects_v_0-2-0',
      'projects_v_0-2-1',
      'specs/templates/projects/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/projects/spec_nn.md',
    ],
    specContent: PROJECTS_SPEC_CONTENT,
  },
  'business-model': {
    name: 'business-model',
    version: 'V_0-2-1',
    aliases: [
      'business-model',
      'business_model',
      'business-model_spec_nn',
      'business-model_spec',
      'business-model_v_0-2-0',
      'business-model_v_0-2-1',
      'business-model_v_0-2-2',
      'specs/templates/business-model/spec_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/templates/business-model/spec_nn.md',
    ],
    specContent: BUSINESS_MODEL_SPEC_CONTENT,
  },
  definition: {
    name: 'defiNNition',
    version: 'V_0-1-0',
    aliases: [
      'definition',
      'defiNNition',
      'definne',
      'defiNNe',
      'defiNNition_spec_NN',
      'defiNNition_V_0-1-0',
      'defiNNition_V_0-1-0_NN',
      'defiNNition_V_0-1-0_NN.md',
      'specs/defiNNition_V_0-1-0_NN.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/definnition_v_0-1-0_nn.md',
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/defiNNition_V_0-1-0_NN.md',
    ],
    specContent: DEFINNITION_SPEC_CONTENT,
  },
  innfo: {
    name: 'innfo',
    version: 'V_0-2-0',
    aliases: [
      'innfo',
      'iNNfo',
      'innfo_spec_NN',
      'iNNfo_spec_NN',
      'innfo_V_0-2-0',
      'iNNfo_V_0-2-0',
      'innfo_V_0-2-0_NN',
      'iNNfo_V_0-2-0_NN',
      'innfo_V_0-2-1',
      'iNNfo_V_0-2-1',
      'innfo_V_0-2-1_NN',
      'iNNfo_V_0-2-1_NN',
      'innfo_V_0-2-2',
      'iNNfo_V_0-2-2',
      'innfo_V_0-2-2_NN',
      'iNNfo_V_0-2-2_NN',
      'specs/iNNfo_V_0-2-0_NN.md',
      'specs/iNNfo_V_0-2-1_NN.md',
      'specs/iNNfo_V_0-2-2_NN.md',
      'specs/iNNfo_V_0-3-0_NN.md',
      'innfo_V_0-3-0',
      'iNNfo_V_0-3-0',
      'innfo_V_0-3-0_NN',
      'iNNfo_V_0-3-0_NN',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/innfo_v_0-3-0_nn.md',
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/innfo_v_0-2-0_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/innfo_v_0-2-1_nn.md',
      'https://raw.githubusercontent.com/cognnitive/cognnitive/main/innfo/specs/innfo_v_0-2-2_nn.md',
    ],
    specContent: INNFO_SPEC_CONTENT,
  },
}

function normalizeKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\.(md|markdown)$/i, '')
    .replace(/_(nn|format|f)$/i, '')
}

/**
 * Find a canonical Level 2 template by name, alias, shorthand, or URL.
 */
export function findCanonicalTemplate(identifier: string): CanonicalTemplate | null {
  if (!identifier) return null
  const rawClean = identifier.trim()
  const lower = rawClean.toLowerCase()

  // 1. Direct match on key
  if (CANONICAL_TEMPLATES[lower]) {
    return CANONICAL_TEMPLATES[lower]
  }

  // 2. Normalized key match
  const normalized = normalizeKey(rawClean)
  if (CANONICAL_TEMPLATES[normalized]) {
    return CANONICAL_TEMPLATES[normalized]
  }

  // 3. Check all templates and their aliases
  for (const tmpl of Object.values(CANONICAL_TEMPLATES)) {
    if (tmpl.name.toLowerCase() === lower || normalizeKey(tmpl.name) === normalized) {
      return tmpl
    }
    for (const alias of tmpl.aliases) {
      const aliasLower = alias.toLowerCase()
      if (aliasLower === lower || normalizeKey(alias) === normalized) {
        return tmpl
      }
    }
  }

  // 4. Match by URL/path stem (e.g. ".../templates/business/spec_NN.md" or ".../business_V_0-2-0_NN.md")
  const urlParts = rawClean.split(/[/\\]/)
  const lastPart = urlParts[urlParts.length - 1]
  const parentPart = urlParts.length > 1 ? urlParts[urlParts.length - 2] : ''

  if (lastPart) {
    const lastNorm = normalizeKey(lastPart)
    if (CANONICAL_TEMPLATES[lastNorm]) {
      return CANONICAL_TEMPLATES[lastNorm]
    }
    // Check if parent part is template name (e.g. templates/business/spec_NN.md)
    if (parentPart) {
      const parentNorm = normalizeKey(parentPart)
      if (CANONICAL_TEMPLATES[parentNorm]) {
        return CANONICAL_TEMPLATES[parentNorm]
      }
    }
  }

  return null
}

/**
 * Get canonical spec content for a template identifier.
 */
export function getCanonicalSpecContent(identifier: string): string | null {
  return findCanonicalTemplate(identifier)?.specContent ?? null
}

/**
 * List all available canonical templates in the registry.
 */
export function listCanonicalTemplates(): CanonicalTemplate[] {
  return Object.values(CANONICAL_TEMPLATES)
}
