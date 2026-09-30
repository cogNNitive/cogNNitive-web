## MODIFIED Requirements

### Requirement: Canonical Workspace Manifests
Each sample use case directory (`startup-founder`, `consulting-sales`, `freelance-designer`, `youtube-creator`) MUST contain a valid `domaiNN_NN.md` entrypoint file that conforms to the `domaiNN` bluepriNNt.

1. The entrypoint MUST declare standard frontmatter including `level`, `parent_spec`, `knowledge_version`, and `title`.
2. The entrypoint MUST declare an `# NN index` block referencing standard domaiNN sections.
3. The entrypoint MUST declare `# NN domaiNN`, `# NN Specs`, `# NN bluepriNNts`, `# NN kNNowledge`, `# NN Sources`, `# NN Procedures`, and `# NN Artifacts` sections with relative paths to constituent assets.

#### Scenario: Inspecting sample domaiNN entrypoint
- GIVEN any sample use case directory under `docs/cognitive_nn/use-cases/`
- WHEN the entrypoint `domaiNN_NN.md` is parsed by the domaiNN parser
- THEN all declared kNNowledge, sources, procedures, and artifacts are resolved against the local folder tree without broken paths.

---

### Requirement: Standardized Directory Hierarchy and Artifacts Migration
All sample use case domaiNNs MUST adhere to the standard iNNfo directory structure:
1. Deliverable output files previously located in `export/` MUST be migrated to `artifacts/`. The legacy `export/` directory MUST be removed.
2. Raw multi-modal imported files MUST reside under `sources/import/`.
3. Semantically normalized markdown sources MUST reside under `sources/nn/`.
4. kNNowledge documents MUST reside under `kNNowledge/`; the legacy `models/` directory MUST NOT exist.
5. Operating procedures and procedural kNNowledge MUST reside under `procedures/`.

#### Scenario: Resolving deliverable artifacts
- GIVEN a sample domaiNN containing generated deliverables (such as pitch deck summary, commercial proposals, dashboard blue-prints, or script cue sheets)
- WHEN inspecting the directory structure
- THEN all deliverables are located under `artifacts/`
- AND no legacy `export/` folder exists.

#### Scenario: No legacy models folder
- GIVEN any sample domaiNN
- WHEN its directory tree is inspected
- THEN `kNNowledge/` exists and `models/` does not

---

### Requirement: Procedure Relocation to Dedicated Subdirectory
Procedural kNNowledge and workflow execution definitions MUST be located in the `procedures/` subdirectory rather than `kNNowledge/`.

#### Scenario: Relocating YouTube Creator production procedure
- GIVEN the `youtube-creator` sample use case
- WHEN inspecting procedural workflows for episode production
- THEN `Episode_42_Production_V_1-0-0_procedures_NN.md` is located under `procedures/`
- AND the entrypoint `domaiNN_NN.md` references the procedure under the `# NN Procedures` section.

---

### Requirement: Multi-Level Epistemic Coverage (Levels 1 to 4)
The sample domaiNNs MUST collectively demonstrate all four levels of the cogNNitive knowledge evolution framework:
1. **Level 1 (Multi-Modal Normalization)**: Raw multi-format files in `sources/import/` normalized into traceable markdown in `sources/nn/`.
2. **Level 2 (Domain Modeling)**: bluepriNNt-governed kNNowledge in `kNNowledge/` with explicit semantic entity relationships.
3. **Level 3 (domaiNN Composition & Cross-kNNowledge References)**: Multi-document cohesion governed by `domaiNN_NN.md`.
4. **Level 4 (Closed-Loop Procedures & Artifacts)**: Automated multi-step procedures producing verifiable artifacts in `artifacts/`.

#### Scenario: End-to-end provenance verification in Level 4 domaiNN
- GIVEN the `youtube-creator` Level 4 sample domaiNN
- WHEN tracing a cue sheet or B-roll checklist artifact in `artifacts/`
- THEN the artifact traces back through the procedure in `procedures/` to the script kNNowledge in `kNNowledge/` and original research sources in `sources/nn/` and `sources/import/`.

## ADDED Requirements

### Requirement: Samples and dogfood domains are migrated through nn-upgrade

`workspace_NN/`, `_samples_nn/` and the four `docs/cognitive_nn/use-cases/*` domains (`consulting-sales`, `freelance-designer`, `startup-founder`, `youtube-creator`) MUST be migrated by running nn-upgrade, not by hand editing. After migration, each MUST validate, MUST round-trip, MUST pass the eight simulacro journeys, and each kNNowledge document MUST keep its `knowledge_version` value unless it received a bluepriNNt schema migration, in which case the value MUST be bumped by the nn-upgrade rule (at least MINOR, because every shipped bluepriNNt receives a MINOR bump). Documents governed by shipped bluepriNNts will therefore be bumped. The `workspace_NN/` entrypoint with malformed frontmatter quoting MUST be corrected before its dry-run can pass.

#### Scenario: Migrated domain validates
- **GIVEN** a dogfood domain after its migration PR
- **WHEN** it is validated and re-serialized
- **THEN** validation passes and the output is byte-identical

#### Scenario: Language-only documents keep their version
- **GIVEN** a kNNowledge document governed by a custom bluepriNNt in a dogfood domain
- **WHEN** the migration completes
- **THEN** its `knowledge_version` value equals its former `model_version` value

#### Scenario: Simulacro journeys pass
- **GIVEN** every migrated dogfood domain
- **WHEN** the eight simulacro journeys run
- **THEN** all pass

#### Scenario: Reader flip and sample migration ship in the same release unit
- **GIVEN** the reader flips (slices S6a/b/c) and the fixture and sample migration (slices S9a/S9b) on the tracker branch
- **WHEN** the tracker is released
- **THEN** every fixture, sample and journey those readers consume is migrated and green at the tracker tip
- **AND** nothing reaches `main` with a flipped reader and an unmigrated fixture

#### Scenario: Live simulacro fixture migrated, frozen copy kept
- **GIVEN** `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion` consumed by `simulacro-user-workspace.test.ts`
- **WHEN** slice S9a completes
- **THEN** the live copy is migrated and the test passes against it
- **AND** the frozen legacy copy under `tests/legacy/fixtures/legacy-domain/` is unchanged
