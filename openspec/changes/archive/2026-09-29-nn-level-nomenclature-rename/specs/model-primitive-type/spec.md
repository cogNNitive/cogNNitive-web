## MODIFIED Requirements

### Requirement: Level 1 Normative Specification and Metaschema Definition

The Level 1 normative specification in force for new documents, `iNNfo/specs/iNNfo_V_0-3-0_NN.md`, MUST define the keyword `knowledge` (written `type:: knowledge`) in place of `model` as the 10th primitive field type in the Field Definition types table:
`string | select | reference | markdown_inline | markdown_file | image | file | video | audio | knowledge`.
It MUST include `knowledge` as a valid concept type in Concept Definition:
`text | category | weight | list | steps | sequence | knowledge`.
It MUST define `target_blueprint` as an optional string property of `Field Definition` (renamed from `target_template` by design D3; the frozen `iNNfo_V_0-1-0` keeps the old name). The self-describing Metaschema within `iNNfo_V_0-3-0_NN.md` MUST include `knowledge` in `## NN Field Definition: type` options for both `Concept Definition` and `Field Definition`, and MUST declare the `target_blueprint` property. The frozen `iNNfo_V_0-1-0_NN.md` MUST keep `model` unchanged as permanent history.

#### Scenario: Level 1 metaschema self-conformance
- GIVEN the normative specification file `iNNfo_V_0-3-0_NN.md`
- WHEN bootstrap metamodel validation evaluates the specification
- THEN the Metaschema definitions for `knowledge` and `target_blueprint` are valid without syntax or schema errors

#### Scenario: Declaring a knowledge-reference field in a Level 2 bluepriNNt
- GIVEN a Level 2 bluepriNNt defining a field of type `knowledge` with `target_blueprint` of `procedures`
- WHEN `innfo-core` parses and validates the bluepriNNt
- THEN the field is accepted as a valid field definition with a target constraint

#### Scenario: Old keyword rejected in new documents
- GIVEN a V_0-3-0 document that declares `type:: model`
- WHEN it is validated
- THEN validation reports the retired keyword as an error and does not treat it as the knowledge-reference type

### Requirement: Core Metamodel Type Definitions

`innfo-core` MUST declare `'knowledge'` as a valid value in `ConceptType` and in `ConceptField.type` in `src/types.ts`, and MUST NOT declare `'model'` as a valid value outside the quarantine module. `ConceptField` MUST include the optional property `target_blueprint?: string`. Schema extraction in `src/schema.ts` (`extractTemplateSchema`) MUST parse `target_blueprint`, and aliasing (`applyAliasToSchema`) and canonical hashing (`canonicalValue`) MUST preserve it.

#### Scenario: Concept definition with the keyword
- GIVEN a metamodel spec declaring `type:: knowledge` for concept `kNNowledge`
- WHEN `src/schema.ts` parses the concept schema
- THEN the concept type is extracted as `knowledge` without schema parse errors

#### Scenario: Field definition with keyword and target
- GIVEN a concept field declared with `type:: knowledge` and `target_blueprint` of `business`
- WHEN `src/schema.ts` extracts the schema
- THEN the field type is assigned `knowledge`
- AND `target_blueprint` is parsed as `business`

#### Scenario: Preserving the target during aliasing
- GIVEN an included bluepriNNt with a `knowledge` field whose `target_blueprint` is `finance`
- WHEN `applyAliasToSchema` is called for composition
- THEN the aliased field retains target `finance`

#### Scenario: Retired target property rejected
- GIVEN a V_0-3-0 bluepriNNt whose field declares `target_template`
- WHEN it is validated
- THEN validation reports the retired property as an error and does not read its value

### Requirement: Inline Submodel Creation and Scaffolding in FieldModel

`FieldModel.vue` MUST provide an inline submodel creation action allowing users to instantiate, scaffold, bind, and focus a new kNNowledge document directly from the field editor:
1. When rendered in edit mode, `FieldModel.vue` MUST display a creation trigger action (e.g., `[+ Create & bind new kNNowledge]`).
2. On triggering creation, `FieldModel.vue` MUST determine the target bluepriNNt from the field's target constraint. If unspecified, a fallback bluepriNNt or prompt MAY be provided.
3. The widget MUST resolve or prompt for a relative file path:
   - When the field belongs to an element of a concept, the path MUST follow the hierarchical convention `<knowledge dir>/{parent_stem}/{concept_slug}/{element_slug}/{field_or_blueprint}_NN.md`, where `<knowledge dir>` is the directory declared by `knowledge_dir` (default `kNNowledge/`), `parent_stem` is the parent filename without extension, `concept_slug` and `element_slug` are filesystem-safe slugs derived from the concept and element names, `field_or_blueprint` is the field name or target constraint, and `_NN` is a sequential numeric collision index (e.g., `_01`).
   - When the field is top-level or concept-less, the path MUST fall back to `<knowledge dir>/{parent_stem}_{field_or_blueprint}_NN.md`.
4. `innfo-editor` (via its store) MUST scaffold starter Level-3 markdown content containing valid V_0-3-0 frontmatter:
   - `knowledge_version` initialized to a valid SemVer string (e.g., `"0.1.0"`).
   - `blueprint_name` matching the resolved target constraint.
   - Required standard Level-3 headers (`level: 3`, `title`, and starter concept sections conforming to the target bluepriNNt).
5. `FieldModel.vue` MUST bind the relative path of the newly scaffolded document to the field value via `update:modelValue`.
6. Upon creation and binding, `innfo-editor` MUST register the new node in its store and automatically navigate/focus the active view to it.

The scaffold MUST NOT write any legacy key, the legacy keyword or the `models/` folder.

#### Scenario: Rendering create and bind trigger in edit mode
- GIVEN a field of the knowledge-reference type with a target of `business`
- AND `FieldModel.vue` is rendered in edit mode (not readonly)
- WHEN the user views the field editor
- THEN a creation trigger is rendered and clickable

#### Scenario: Hierarchical path derivation for concept element
- GIVEN a field with a target of `business` on element `Alpha` of concept `Projects` in parent `kNNowledge/Company_V_0-1-0_NN.md`
- WHEN the user triggers creation
- THEN the suggested path resolves to `kNNowledge/Company_V_0-1-0/projects/alpha/business_01.md`
- AND starter frontmatter carries `blueprint_name: business`, `level: 3`, and `knowledge_version: "0.1.0"`
- AND the relative path is bound to the field value

#### Scenario: Distinct non-colliding paths for sibling elements
- GIVEN elements `Alpha` and `Beta` under concept `Projects` in parent `kNNowledge/Company_NN.md`
- WHEN creation is triggered on element `Beta`'s field with target `business`
- THEN the suggested path resolves under `kNNowledge/Company_NN/projects/beta/business_01.md`
- AND does not collide with element `Alpha`'s path

#### Scenario: Fallback path derivation for concept-less field
- GIVEN a field `top_model` with target `architecture` not belonging to a concept element in parent `kNNowledge/System_NN.md`
- WHEN the user triggers creation
- THEN the suggested path falls back to `kNNowledge/System_architecture_01.md`

#### Scenario: Auto-focusing the new document
- GIVEN a new document has been scaffolded and bound via `FieldModel.vue`
- WHEN creation completes
- THEN the editor focuses the new node

#### Scenario: No legacy tokens in the scaffold
- GIVEN a scaffolded starter document
- WHEN it is searched for `model_version`, `template:` and `type:: model`
- THEN none is found

### Requirement: MCP Tooling Support

`innfo-mcp` tools (`list-read`, `mutate`, `spec`), under their canonical names, MUST support reading, querying, and mutating concepts and fields declared with `type:: knowledge`. In addition, `findModelFile` (or its renamed equivalent) MUST support recursive discovery of kNNowledge files across all subdirectories of the knowledge directory.

#### Scenario: Querying knowledge-reference concepts via MCP
- GIVEN a domaiNN containing concepts declared with `type:: knowledge`
- WHEN `list_knowledge` or `read_knowledge` is invoked
- THEN those concepts and properties are returned in the response JSON payload

#### Scenario: Locating nested files
- GIVEN a nested file at `kNNowledge/subsystems/auth/tokens_NN.md`
- WHEN the file finder searches for `tokens_NN.md` or the full relative path
- THEN the file is located recursively and returned

### Requirement: `type:: model` Normative for Fields on Any Level-2 Concept

The field type `type:: knowledge` MUST be valid on fields declared within any Level-2 bluepriNNt's concept, not limited to the `domaiNN.kNNowledge` concept. Schema extraction, per-file reference validation, and traversal support for such fields MUST apply uniformly regardless of which domain concept declares them.

#### Scenario: Domain concept declares a knowledge-reference field
- GIVEN a domain bluepriNNt `startup` whose `Startup` concept declares field `business_model` of type `knowledge` with target `business_V_0-2-0`
- WHEN `src/schema.ts` extracts the schema
- THEN `business_model` is recognised as a valid field on the `Startup` concept
- AND per-file reference validation (`references.ts`) applies the same dangling-file and target checks used for `domaiNN.kNNowledge`
