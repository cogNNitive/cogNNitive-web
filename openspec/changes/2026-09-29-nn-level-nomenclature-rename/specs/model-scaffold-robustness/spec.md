## ADDED Requirements

### Requirement: Scaffolds write only the new language and folder

Every scaffold (the MCP init tool, the editor creation flow, wizard workflows and skill scaffolds) MUST write only the V_0-3-0 language: the keys `knowledge_version`, `blueprint_version` and `blueprint_name`, the keyword `type:: knowledge`, and the new concept headings. Scaffolds MUST place files under the directory declared by `knowledge_dir` (default `kNNowledge/`) and the entrypoint MUST be `domaiNN_NN.md`. Version-aware inference and the mismatch refusal MUST apply to the `knowledge_version` key.

#### Scenario: New kNNowledge scaffold
- **GIVEN** a domaiNN and a target bluepriNNt
- **WHEN** `init_knowledge` scaffolds a kNNowledge document
- **THEN** the file is under `kNNowledge/`
- **AND** it carries `knowledge_version`, `blueprint_version` and `blueprint_name` and no legacy key
- **AND** it validates against its own bluepriNNt on the first attempt

#### Scenario: New domaiNN scaffold
- **GIVEN** the wizard creates a domaiNN
- **WHEN** it writes the entrypoint
- **THEN** the file is named `domaiNN_NN.md` and uses the new concept headings

#### Scenario: Scaffold refuses a legacy target
- **GIVEN** an init request against a legacy domain
- **WHEN** the tool runs
- **THEN** it refuses with the legacy notice
- **AND** the response has `success: false` and no `filePath` or `content`

### Requirement: Scaffold tests guard against legacy tokens

The scaffold test suites MUST assert that no scaffold output contains `model_version`, `template_version`, `template_name`, `target_template`, `type:: model`, `models/` or `specs/templates/`.

#### Scenario: Seeded legacy token fails the suite
- **GIVEN** a scaffold that emits `model_version`
- **WHEN** the scaffold tests run
- **THEN** at least one test fails
