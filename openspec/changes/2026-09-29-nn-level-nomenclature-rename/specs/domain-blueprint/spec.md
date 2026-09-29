## ADDED Requirements

### Requirement: The domaiNN bluepriNNt is a new Level 2 identity

A `domaiNN` bluepriNNt MUST exist at `V_0-1-0`, at the canonical package path for bluepriNNts `iNNfo/specs/bluepriNNts/`, as `domaiNN/spec_NN.md`. It MUST declare iNNfo `V_0-3-0` as its parent. The former `workspace_spec_NN.md` outlier path MUST NOT be carried over.

#### Scenario: Package follows the standard layout
- **GIVEN** the bluepriNNt package folder for `domaiNN`
- **WHEN** it is inspected
- **THEN** it holds `spec_NN.md` like every other bluepriNNt
- **AND** no `workspace_spec_NN.md` exists in the package tree

#### Scenario: Identity metadata
- **GIVEN** `domaiNN/spec_NN.md`
- **WHEN** its frontmatter is read
- **THEN** `blueprint_name` is `domaiNN`, `blueprint_version` is `V_0-1-0`, and the parent is iNNfo `V_0-3-0`

### Requirement: The domaiNN bluepriNNt defines the container concepts

The bluepriNNt MUST define the concepts `domaiNN`, `kNNowledge` and `bluepriNNts` in place of `Workspace`, `Models` and `Templates`, and MUST keep the remaining container concepts (Specs, Sources, Procedures, Artifacts, Skills, Tools, Tag). The kNNowledge concept MUST use the keyword `type:: knowledge`.

#### Scenario: Concepts validate
- **GIVEN** the `domaiNN` bluepriNNt
- **WHEN** it is validated as a Level 2 spec
- **THEN** the concepts `domaiNN`, `kNNowledge` and `bluepriNNts` are recognised and no legacy concept name is present

#### Scenario: Legacy concept headings are absent
- **GIVEN** the `domaiNN` bluepriNNt
- **WHEN** it is searched for the headings `Workspace`, `Models` and `Templates`
- **THEN** none is found

### Requirement: Directory defaults and entrypoint are declared by the bluepriNNt

The bluepriNNt MUST declare the defaults `kNNowledge/` for the knowledge directory (key `knowledge_dir`) and `specs/bluepriNNts/` for the local blueprints directory (key `blueprints_dir`), and MUST declare `domaiNN_NN.md` as the entrypoint name. Folder and file names are NN-cased exactly as written; keys are lowercase.

#### Scenario: Defaults present
- **GIVEN** a domaiNN scaffolded from the bluepriNNt
- **WHEN** `knowledge_dir` and `blueprints_dir` are read
- **THEN** they resolve to `kNNowledge/` and `specs/bluepriNNts/`

#### Scenario: Entrypoint name
- **GIVEN** the bluepriNNt
- **WHEN** the entrypoint declaration is read
- **THEN** it is `domaiNN_NN.md`

### Requirement: A domaiNN is a container and is itself kNNowledge

The bluepriNNt description and the glossary MUST state that a domaiNN is a container of kNNowledge, bluepriNNts, sources and related assets, and is not a subject-area "domain". The domaiNN entrypoint is itself a kNNowledge document governed by this bluepriNNt.

#### Scenario: Description states container semantics
- **GIVEN** the bluepriNNt description and the glossary entry
- **WHEN** they are read
- **THEN** both describe a container and neither describes a subject area

### Requirement: The bluepriNNt is registered and released as a new identity

The bluepriNNt MUST be registered in the manifest, the generated catalog and the shipped-versions registry in the same change, and MUST be discovered by `blueprint-catalog --check` and the template-inventory guard. The `workspace` predecessor MUST move to the frozen-blueprints list and MUST NOT be removed.

#### Scenario: Catalog lists domaiNN
- **GIVEN** the generated catalog
- **WHEN** it is read
- **THEN** `domaiNN` is listed with adopted version `V_0-1-0`
- **AND** `--check` passes

#### Scenario: Unregistered folder fails CI
- **GIVEN** a bluepriNNt folder with no manifest entry
- **WHEN** the verification gates run
- **THEN** the inventory guard fails
