# Vocabulary: Canonical Terms

The cogNNitive ecosystem pins a canonical vocabulary so every editor label, doc, and
skill refers to the same concept by the same name. The authoritative source is the
machine-readable dictionary at
[`iNNfo/specs/vocabulary.json`](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/vocabulary.json);
this page is the human-readable rendering of it.

## Level Hierarchy & Canonical Terms

| Level | Canonical Term | Deprecated / Former Aliases | Sense |
|---|---|---|---|
| Level 0 | **defiNNition** | `defiNNe` | Level-0 meta-specification language (formerly defiNNe) |
| Level 1 | **iNNfo** | *(none)* | Level-1 concrete specification meta-template defining root primitives (Concept Definition, Field Definition, Matrix Definition) |
| Ecosystem / Role | **tag** | *(none)* | A value of the `tags` Field, an ordinary multi-valued select Field; there is no reserved `tags` property and no Marker primitive |
| Level 1 | **meta-bluepriNNt** | `meta-template` | Level-1 specification describing the structure of bluepriNNts |
| Level 2 | **bluepriNNt** | `app`, `template` | Level-2 domain schema specification file (formerly Template / App; e.g. specs/bluepriNNts/business/spec_NN.md) |
| Level 3 | **kNNowledge** | `model` | Level-3 domain data model (formerly Model). Uncountable noun. The version lives in the `knowledge_version` frontmatter, never in the filename (`_V_` names are retired). |
| Level 3 | **domaiNN** | `workspace` | Container of kNNowledge, bluepriNNts, sources, procedures and related assets (formerly Workspace). A domaiNN is itself a kNNowledge document. |
| Ecosystem / Role | **compact storage** | *(none)* | Storage form in which every instance of a concept is an element of one kNNowledge document. A concept with no `storage` declaration is compact. A kNNowledge-level concept, not a new level: the document that holds the elements is an ordinary kNNowledge document. |
| Ecosystem / Role | **distributed storage** | *(none)* | Storage form in which each instance of a concept is the root element of its own kNNowledge document, called an instance model, in its own folder placed by the concept's placement rule. Declared with `storage:: distributed`. A kNNowledge-level concept, not a new level. |
| Ecosystem / Role | **instance model** | *(none)* | A kNNowledge document that is itself one instance of a distributed concept: its root element is that concept and its `slug::` equals its folder slug. Addressed by a hierarchical id. It is a kNNowledge document, not a new level. |
| Ecosystem / Role | **collection** | *(none)* | The domaiNN-wide set of instances of one concept, ordered by id and identical whatever the storage form: instance models and compact elements are members alike. Same word and one meaning as the `members` collection of the `changes` bluepriNNt: the set of units of one kind, grouped by the concept or document that defines them. A kNNowledge-level concept, not a new level. |
| Ecosystem / Role | **placement rule** | *(none)* | The `placement::` path pattern a distributed concept declares: where each of its instance models lives relative to the domaiNN root, with exactly one `{slug}` and an optional leading `{container}`. It says where an instance lives, never what it inherits. A kNNowledge-level declaration, not a new level. |
| Ecosystem / Role | **synchronization** | *(none)* | A concept of the sources catalog that declares an origin (a file, a folder or a URL) landed into a domaiNN on demand by `nn-sources --sync [alias]`. Models land as mirrors, other files as sources. A kNNowledge-level concept, not a new level. |
| Ecosystem / Role | **mirror** | *(none)* | A read-only copy of an origin's kNNowledge document under `sources/sync/<alias>/`, replaced in place on each synchronization. A consumer addresses its elements with a `reference` path such as `sources/sync/org/organization_NN.md@manager`. Never a model of the consumer domaiNN. |
| Ecosystem / Role | **hierarchical id** | `model id` | The identity of a kNNowledge document, derived only from its own path and the declarations of its bluepriNNt: the stem without `_NN` for a compact model, or a container chain plus slug (`<container-id>/<slug>`) for an instance model. A stem, a title and a path are never ids. A kNNowledge-level concept, not a new level. |
| Ecosystem / Role | **title** | *(none)* | The human label of a kNNowledge document or element. Display-only: it never resolves an address, and two documents may share a title without conflict. Addressing always uses the hierarchical id and the element slug. |
| Ecosystem / Role | **ageNNt** | `actioNN` | Skill ecosystem, execution engine, and dynamic AI persona framework for cogNNitive |
| Ecosystem / Role | **referenced skill** | `external skill` | A third-party agent skill a bluepriNNt declares in its frontmatter `skills:` array, pinned to a commit with an SPDX license, and fetched from its upstream repo at install time (never vendored, never fetched at runtime). Its guarantee is bounded to reproducible + license-declared; the maintainer does not vouch for the author. Distinct from an embedded skill, which is vendored and curated. |
| Level 3 | **sidecar** | *(none)* | Co-located <file>.<ext>_sidecar_NN.md document that carries a file's hash, size, metadata and, for binary files, a normalized body. A concept, not a new level: a kNNowledge-level document that is never a model and is never mirrored into a separate `sources/nn/` tree (that tree is retired). |
| Ecosystem / Role | **cognitivize** | *(none)* | Operation that creates or refreshes a sidecar in place, leaving the original file untouched. One @cognnitive/nn-core operation (cognitivize), surfaced through the nn-sources CLI (--cognitivize <file|dir>) and the nn-mcp tool; raw imports land verbatim in sources/import/ and are cognitivized there. |
| Ecosystem / Role | **artifacts** | *(none)* | The single write destination for every producer output (consoles, reports, curated CSVs, briefs). Replaces the retired `export/` folder: one rename, no fallback. A non-_NN.md file is an artifact lineage node only if it is a timestamped write-once family member or declares upstream sources. |
| Ecosystem / Role | **write-once** | *(none)* | Producer rule: each output is a new family member named with a UTC suffix _YYYYMMDDTHHmmssZ (with -2, -3... same-second tie-breaks) placed before the extension; existing bytes are never overwritten, and latest-of-family is resolved by name. GC only proposes deletions and deletes only with explicit user consent. |
| Ecosystem / Role | **assistant** | `coach`, `architecture coach` | Interactive architecture mentor and modeling guide persona in iNNfo |
| Ecosystem / Role | **console** | *(none)* | User-facing UI that shows and reviews a domaiNN: the domain console (`domaiNN_console.html`, one per domaiNN) whose specialized surfaces are views shown as tabs. Replaces the retired Vue "editor" and the retired hosted web app. |
| Ecosystem / Role | **lineage** | *(none)* | The computed view of a domaiNN: the inventory of sources, models, artifacts and changes, with edges derived from the applied changes (live evidence by default, all-time on request). Nothing is persisted, so there is nothing to drift. |

## Level Terms Detail

### **defiNNition**

- **Sense**: Level-0 meta-specification language (formerly defiNNe)
- **Deprecated Aliases**: `defiNNe`
- **Excluded Senses** (not renamed): `ordinary-english-definition`

### **iNNfo**

- **Sense**: Level-1 concrete specification meta-template defining root primitives (Concept Definition, Field Definition, Matrix Definition)

### **tag**

- **Sense**: A value of the `tags` Field, an ordinary multi-valued select Field; there is no reserved `tags` property and no Marker primitive
- **Excluded Senses** (not renamed): `git-tag`, `release-tag`, `html-tag`

### **meta-bluepriNNt**

- **Sense**: Level-1 specification describing the structure of bluepriNNts
- **Deprecated Aliases**: `meta-template`

### **bluepriNNt**

- **Sense**: Level-2 domain schema specification file (formerly Template / App; e.g. specs/bluepriNNts/business/spec_NN.md)
- **Deprecated Aliases**: `app`, `template`
- **Excluded Senses** (not renamed): `vue-sfc-template`, `generic-english`

### **kNNowledge**

- **Sense**: Level-3 domain data model (formerly Model). Uncountable noun. The version lives in the `knowledge_version` frontmatter, never in the filename (`_V_` names are retired).
- **Deprecated Aliases**: `model`
- **Grammar Rule**: Uncountable noun. Written as `N kNNowledge documents`.
- **Distinct Senses**: "knowledge unit"
- **Excluded Senses** (not renamed): `llm-model`, `statistical-model`

### **domaiNN**

- **Sense**: Container of kNNowledge, bluepriNNts, sources, procedures and related assets (formerly Workspace). A domaiNN is itself a kNNowledge document.
- **Deprecated Aliases**: `workspace`
- **Container Nature**: A domaiNN is itself a kNNowledge document containing other documents.
- **Excluded Senses** (not renamed): `npm workspace`, `VS Code workspace`, `git worktree`, `IndexedDB workspace`, `subject-area domain`

### **compact storage**

- **Sense**: Storage form in which every instance of a concept is an element of one kNNowledge document. A concept with no `storage` declaration is compact. A kNNowledge-level concept, not a new level: the document that holds the elements is an ordinary kNNowledge document.
- **Excluded Senses** (not renamed): `compressed-storage`, `database-storage`

### **distributed storage**

- **Sense**: Storage form in which each instance of a concept is the root element of its own kNNowledge document, called an instance model, in its own folder placed by the concept's placement rule. Declared with `storage:: distributed`. A kNNowledge-level concept, not a new level.
- **Excluded Senses** (not renamed): `distributed-database`, `object-storage`

### **instance model**

- **Sense**: A kNNowledge document that is itself one instance of a distributed concept: its root element is that concept and its `slug::` equals its folder slug. Addressed by a hierarchical id. It is a kNNowledge document, not a new level.
- **Excluded Senses** (not renamed): `instance-in-an-object-model`

### **collection**

- **Sense**: The domaiNN-wide set of instances of one concept, ordered by id and identical whatever the storage form: instance models and compact elements are members alike. Same word and one meaning as the `members` collection of the `changes` bluepriNNt: the set of units of one kind, grouped by the concept or document that defines them. A kNNowledge-level concept, not a new level.
- **Excluded Senses** (not renamed): `data-structure-collection`, `database-table`

### **placement rule**

- **Sense**: The `placement::` path pattern a distributed concept declares: where each of its instance models lives relative to the domaiNN root, with exactly one `{slug}` and an optional leading `{container}`. It says where an instance lives, never what it inherits. A kNNowledge-level declaration, not a new level.
- **Excluded Senses** (not renamed): `css-placement`, `ad-placement`

### **synchronization**

- **Sense**: A concept of the sources catalog that declares an origin (a file, a folder or a URL) landed into a domaiNN on demand by `nn-sources --sync [alias]`. Models land as mirrors, other files as sources. A kNNowledge-level concept, not a new level.
- **Excluded Senses** (not renamed): `sync_domain_manifest`, `file-sync-daemon`

### **mirror**

- **Sense**: A read-only copy of an origin's kNNowledge document under `sources/sync/<alias>/`, replaced in place on each synchronization. A consumer addresses its elements with a `reference` path such as `sources/sync/org/organization_NN.md@manager`. Never a model of the consumer domaiNN.
- **Excluded Senses** (not renamed): `git-mirror`, `network-mirror`

### **hierarchical id**

- **Sense**: The identity of a kNNowledge document, derived only from its own path and the declarations of its bluepriNNt: the stem without `_NN` for a compact model, or a container chain plus slug (`<container-id>/<slug>`) for an instance model. A stem, a title and a path are never ids. A kNNowledge-level concept, not a new level.
- **Deprecated Aliases**: `model id`
- **Excluded Senses** (not renamed): `database-id`, `uuid`

### **title**

- **Sense**: The human label of a kNNowledge document or element. Display-only: it never resolves an address, and two documents may share a title without conflict. Addressing always uses the hierarchical id and the element slug.
- **Excluded Senses** (not renamed): `html-title`, `frontmatter-property`

### **ageNNt**

- **Sense**: Skill ecosystem, execution engine, and dynamic AI persona framework for cogNNitive
- **Deprecated Aliases**: `actioNN`
- **Excluded Senses** (not renamed): `generic-agent`, `subagent-runtime`

### **referenced skill**

- **Sense**: A third-party agent skill a bluepriNNt declares in its frontmatter `skills:` array, pinned to a commit with an SPDX license, and fetched from its upstream repo at install time (never vendored, never fetched at runtime). Its guarantee is bounded to reproducible + license-declared; the maintainer does not vouch for the author. Distinct from an embedded skill, which is vendored and curated.
- **Deprecated Aliases**: `external skill`
- **Excluded Senses** (not renamed): `embedded skill`, `vendored skill`

### **sidecar**

- **Sense**: Co-located <file>.<ext>_sidecar_NN.md document that carries a file's hash, size, metadata and, for binary files, a normalized body. A concept, not a new level: a kNNowledge-level document that is never a model and is never mirrored into a separate `sources/nn/` tree (that tree is retired).
- **Excluded Senses** (not renamed): `motorcycle-sidecar`, `sidecar-container`

### **cognitivize**

- **Sense**: Operation that creates or refreshes a sidecar in place, leaving the original file untouched. One @cognnitive/nn-core operation (cognitivize), surfaced through the nn-sources CLI (--cognitivize <file|dir>) and the nn-mcp tool; raw imports land verbatim in sources/import/ and are cognitivized there.

### **artifacts**

- **Sense**: The single write destination for every producer output (consoles, reports, curated CSVs, briefs). Replaces the retired `export/` folder: one rename, no fallback. A non-_NN.md file is an artifact lineage node only if it is a timestamped write-once family member or declares upstream sources.
- **Excluded Senses** (not renamed): `git-artifacts`, `build-artifacts`

### **write-once**

- **Sense**: Producer rule: each output is a new family member named with a UTC suffix _YYYYMMDDTHHmmssZ (with -2, -3... same-second tie-breaks) placed before the extension; existing bytes are never overwritten, and latest-of-family is resolved by name. GC only proposes deletions and deletes only with explicit user consent.
- **Excluded Senses** (not renamed): `write-once-memory`

### **assistant**

- **Sense**: Interactive architecture mentor and modeling guide persona in iNNfo
- **Deprecated Aliases**: `coach`, `architecture coach`
- **Excluded Senses** (not renamed): `system-prompt-generic`

### **console**

- **Sense**: User-facing UI that shows and reviews a domaiNN: the domain console (`domaiNN_console.html`, one per domaiNN) whose specialized surfaces are views shown as tabs. Replaces the retired Vue "editor" and the retired hosted web app.
- **Excluded Senses** (not renamed): `terminal-console`, `browser-dev-console`, `game-console`

### **lineage**

- **Sense**: The computed view of a domaiNN: the inventory of sources, models, artifacts and changes, with edges derived from the applied changes (live evidence by default, all-time on request). Nothing is persisted, so there is nothing to drift.
- **Excluded Senses** (not renamed): `lineage-cache`

## Retired Identifiers (Documentation Only)

The following table lists retired identifiers and their canonical replacements.
This mapping is documentation-only; no runtime aliases exist.

| Old Identifier / Name | Canonical Replacement | Kind | Notes |
|---|---|---|---|
| `Marker Definition` | ``tags` Field value (flag) or a declared Field (valued)` | primitive | Retired in iNNfo V_0-5-0: a flag marker becomes a value of the tags Field, a valued marker becomes a normal Field; a document that still carries one fails with MARKERS_REMOVED |
| `item-markers matrix` | `declared Fields + concept-level values` | primitive | Retired in iNNfo V_0-5-0: removed with remove_matrix; cells become field values and concept rows become concept-level values |
| `set_marker` | `update_field / update_concept_field` | operation | Retired schema operation; apply_change now rejects it with UNKNOWN_OPERATION |
| `specs/templates/` | `specs/bluepriNNts/` | path | Relocated under iNNfo/specs/bluepriNNts/ and domain specs/bluepriNNts/ |
| `models/` | `kNNowledge/` | path | Domain models directory renamed to kNNowledge/ |
| `export/` | `artifacts/` | path | Producer output folder renamed once to artifacts/, with no fallback; runtime never resolves export/ |
| `sources/nn/` | `sources/import/ + co-located sidecars` | path | Retired mirror tree; raw files live in sources/import/ and are cognitivized in place |
| `sources/original/` | `sources/import/` | path | Retired legacy fallback; sources/import/ is the only canonical raw-import location |
| `sources/export/` | `artifacts/` | path | Retired promotion folder; an artifact reused as input is cognitivized where it lives |
| `sources/archive/` | `write-once families` | path | Retired; a changed source becomes a new suffixed family member, so no snapshot is needed. Any pre-existing content is inert |
| `<name>_V_<x-y-z>_<bp>_NN.md` | `knowledge_version frontmatter` | naming | kNNowledge names drop _V_; the version lives in the knowledge_version frontmatter key |
| `~/.agents/templates` | `~/.agents/bluepriNNts` | path | Global template storage location renamed to bluepriNNts |
| `model_version` | `knowledge_version` | key | Level-3 frontmatter version property |
| `template_version` | `blueprint_version` | key | Level-2 frontmatter version property |
| `template_name` | `blueprint_name` | key | Level-2 schema name property |
| `models_dir` | `knowledge_dir` | key | Domain layout configuration key |
| `templates_dir` | `blueprints_dir` | key | Domain layout configuration key |
| `target_template` | `target_blueprint` | key | Field definition property naming target blueprint |
| `type:: model` | `type:: knowledge` | keyword | Grammar keyword for submodel references |
| `workflow: model` | `workflow: knowledge` | key | Manifest workflow definition key |
| `workflow: template` | `workflow: blueprint` | key | Manifest workflow template parameter key |
| `INNFO_MODELS_DIR` | `INNFO_DOMAIN_DIR` | env_var | Domain root environment variable (no fallback) |
| `templates-v*` | `blueprints-v*` | tag_namespace | Tag namespace for blueprint releases |
| `workspace_NN.md` | `domaiNN_NN.md` | entrypoint | Domain container entrypoint document |
| `nn-workspace-git` | `nn-domain-git` | skill | Skill renamed to reflect domaiNN terminology |
| `capability_folders` | `capability_folders` | mapping | Openspec capability folders retain their existing kebab-case names per D13 |
| `13 legacy tool names` | `13 canonical blueprint/knowledge tool names` | mcp_tools | list_knowledge, read_knowledge, init_knowledge, validate_knowledge, validate_knowledge_url, get_blueprint, validate_blueprint, list_blueprints, hydrate_blueprint, list_blueprint_procedures, list_blueprint_skills, sync_domain_manifest, check_domain |
| `editor` | `console` | ui_term | Retired user-facing UI term: the Vue editor app is replaced by the domain console (see the console term). Not used in user-facing copy. |
| `hosted app` | `console` | ui_term | Retired user-facing UI term for the hosted web application; the domain console replaces it. Distinct from the "app" alias of bluepriNNt, which keeps its entry and is untouched. |
| `innfo-mcp` | `nn-mcp` | release_key | Distribution prefix rename. Existing `innfo-mcp-v*` git tags, published CDN files and stamped exports remain valid and are not renamed; only new releases use `nn-mcp-v*`. |
| `innfo-console` | `nn-console` | release_key | Distribution prefix rename. Existing `innfo-console-v*` git tags, published CDN files and stamped exports remain valid and are not renamed; only new releases use `nn-console-v*`. |
| `@cognnitive/innfo-core` | `@cognnitive/nn-core` | package | npm workspace package renamed to the nn- prefix; workspace-only, never published to the npm registry. |
| `@cognnitive/innfo-mcp` | `@cognnitive/nn-mcp` | package | npm workspace package renamed to the nn- prefix. |
| `@cognnitive/innfo-console` | `@cognnitive/nn-console` | package | npm workspace package renamed to the nn- prefix. |
| `iNNfo/packages/innfo-core` | `iNNfo/packages/nn-core` | path | Package directory renamed to the nn- prefix. |
| `iNNfo/packages/innfo-mcp` | `iNNfo/packages/nn-mcp` | path | Package directory renamed to the nn- prefix. |
| `innfo-mcp` | `nn-mcp` | mcp_server | The MCP `bin` name and the `Server({name})` identity. The old bundle `bin/innfo-mcp.bundle.js` is deleted; existing `innfo-mcp-v*` CDN files and stamped exports remain valid and resolvable. |
| `innfo-mcp_` | `nn-mcp_` | tool_prefix | The MCP tool prefix in skills and documentation. The client builds the prefix from the registered server name; tool names after the prefix are unchanged. |
| `@innfo-console-v` | `@nn-console-v` | console_pin | The console shell pin. Readers still accept `@innfo-console-v*` so already-stamped exports keep resolving; nothing emits it. |
| `innfo-` | `nn-` | prefix | Console assets, generated mirrors and wrapper scripts renamed to the nn- prefix. Existing published files under the old name are never moved or deleted, so old stamps and CDN URLs keep resolving. |
| `[[Title :: Name]]` | `<hierarchical-id>@<slug> address` | reference_syntax | Removed by distributed-storage: a type:: reference value is an address, and a title is display-only. The parser reports ADDRESS_MALFORMED naming the removed form. |
| `key:: [[Name]]` | `@slug (same document) or <hierarchical-id>@<slug>` | reference_syntax | Removed by distributed-storage for typed reference fields. Prose and index wikilinks stay display text and are untouched. |
| `<stem> used as a model id` | `<hierarchical-id>` | identity | A bare stem such as intro_video-script is not an id and never resolves. The stem derives from the folder slug and equal stems in different folders are legal. |
| `a model id rewritten to a path when two stems collided` | `<hierarchical-id>, never rewritten` | identity | The old collision flip is gone: an id depends only on the file's own path and its bluepriNNt declarations. Two documents that derive the same id are DUPLICATE_MODEL_ID. |
| `AMBIGUOUS_MODEL_ID` | `REF_MODEL_NOT_FOUND with the candidate ids` | diagnostic_code | Retired by distributed-storage together with the package-stem alias and the stem-collision module. An unresolved address lists the candidate ids that share its last segment. |

## Consumer Notes

- **Editor labels**: read `vocabulary.json` (read-only) to drive user-facing copy.
- **Skill copy**: references the same dictionary for consistency.
- **Agent Ubiquitous Language**: `AGENTS.md` points to this dictionary and vocabulary page.
