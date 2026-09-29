## MODIFIED Requirements

### Requirement: Canonical term dictionary is machine-readable and human-visible

The system MUST provide a canonical term dictionary in two forms: a machine-readable map (`vocabulary.json` under `iNNfo/specs/`) that drives editor labels and skill copy, and a human-readable page under `docs/innfo/documentation/vocabulary.md`. No separate `iNNfo/AGENTS.md` exists: the root `AGENTS.md` MUST carry a pointer to the dictionary and the vocabulary page so that agents load the canonical terms.

#### Scenario: Dictionary consumed by editor labels

- GIVEN the canonical dictionary published as `vocabulary.json`
- WHEN `innfo-editor` renders a label for a Level-2 schema
- THEN the label MUST use the canonical term `bluepriNNt` for the schema sense

#### Scenario: Dictionary rendered as docs page

- GIVEN the canonical dictionary
- WHEN `docs/innfo/documentation/vocabulary.md` is generated
- THEN it lists every canonical term with its deprecated aliases and sense exclusions

## REMOVED Requirements

### Requirement: `app` is canonical, `template` is an explicit deprecated alias

**Reason**: This change supersedes the `app` decision. `bluepriNNt` becomes the canonical Level-2 noun, and both `app` and `template` are retired.

**Migration**: See the ADDED requirement "bluepriNNt is the canonical Level-2 noun; app and template are retired aliases".

### Requirement: Identifiers remain stable

**Reason**: The identifier migration this requirement deferred is now performed by this change under the migrate-first policy.

**Migration**: See the ADDED requirement "Retired identifiers are recorded with their replacement, and nothing is aliased at runtime".

## ADDED Requirements

### Requirement: bluepriNNt is the canonical Level-2 noun; app and template are retired aliases

The dictionary MUST declare **bluepriNNt** as the canonical noun for the Level-2 schema. `vocabulary.json` MUST list `app` and `template` as deprecated aliases of bluepriNNt, published explicitly and never as a silent fallback. Level-1 "meta-template" MUST be recorded as "meta-bluepriNNt". No new user-facing copy MAY use `app` or `template` for the Level-2 sense.

#### Scenario: New copy uses bluepriNNt
- **GIVEN** user-facing copy authored after this change
- **WHEN** it refers to a Level-2 schema
- **THEN** it uses `bluepriNNt`

#### Scenario: Deprecated aliases are listed
- **GIVEN** `iNNfo/specs/vocabulary.json`
- **WHEN** the entry for bluepriNNt is read
- **THEN** both `app` and `template` appear as deprecated aliases

### Requirement: Canonical terms for the level hierarchy

The dictionary MUST define: defiNNition (Level 0, formerly `defiNNe`), iNNfo (Level 1, unchanged), bluepriNNt (Level 2), kNNowledge (Level 3, formerly Model) and domaiNN (the container, formerly Workspace). The Level-1 primitives Concept, Field, Matrix and Marker Definition MUST be recorded as not renamed.

#### Scenario: All five terms present
- **GIVEN** `vocabulary.json`
- **WHEN** it is loaded
- **THEN** it contains an entry for each of defiNNition, iNNfo, bluepriNNt, kNNowledge and domaiNN
- **AND** the formerly used terms are listed as deprecated aliases

### Requirement: kNNowledge is uncountable

Copy MUST NOT pluralise kNNowledge. A count MUST be written as "N kNNowledge documents". A "knowledge unit" MUST remain a distinct sense meaning a unit inside a kNNowledge.

#### Scenario: Plural form rejected
- **GIVEN** copy containing `kNNowledges`
- **WHEN** the vocabulary guard runs
- **THEN** it fails and names the file

#### Scenario: Knowledge unit sense preserved
- **GIVEN** existing uses of "knowledge unit"
- **WHEN** the guard runs
- **THEN** they are not flagged

### Requirement: domaiNN is a container

The dictionary MUST define domaiNN as a container of kNNowledge, bluepriNNts, sources and related assets, not as a subject-area domain, and MUST state that a domaiNN is itself a kNNowledge document.

#### Scenario: Glossary line
- **GIVEN** the dictionary entry for domaiNN
- **WHEN** it is read
- **THEN** it states container semantics and the self-kNNowledge relation

### Requirement: Sense boundaries for reused words

The dictionary MUST record senses that are not renamed: `<template>` blocks in Vue single-file components, generic English "template", nn-trannsform transformation templates, LLM "model", "workspace" in npm, VS Code, git worktrees and the editor IndexedDB workspace, and "definition" in ordinary English. Internal code identifiers (for example `modelStore`, `ParsedModel`) MUST be recorded as code names, renamed only in the mechanical track.

#### Scenario: Excluded senses are not flagged
- **GIVEN** a `.vue` file with a `<template>` block and a doc using "npm workspace"
- **WHEN** the vocabulary guard runs
- **THEN** neither is flagged

### Requirement: The vocabulary guard is test-first and case-sensitive

`test-vocabulary.js` MUST be rewritten test-first for the new dictionary and MUST search case-sensitively, so that `defiNNition` is distinguished from ordinary "definition".

#### Scenario: Case-sensitive match
- **GIVEN** a file containing "definition" in plain English and `defiNNe` as a retired term
- **WHEN** the guard runs
- **THEN** only the `defiNNe` occurrence outside allowed contexts is flagged

#### Scenario: Seeded retired term fails
- **GIVEN** new user-facing copy that says "Workspace" for the container sense
- **WHEN** the guard runs
- **THEN** it fails

### Requirement: Retired identifiers are recorded with their replacement, and nothing is aliased at runtime

The dictionary's alias table MUST record each retired identifier (paths, keys, tool names, environment variable, tag namespace, entrypoint name) with its replacement. The table is documentation only; no runtime alias MUST result from it.

#### Scenario: Table lists replacements
- **GIVEN** the dictionary alias table
- **WHEN** the entry for `INNFO_MODELS_DIR` is read
- **THEN** it names `INNFO_DOMAIN_DIR` as the replacement and states that there is no fallback

#### Scenario: Skill and capability-folder mapping recorded
- **GIVEN** the dictionary alias table and glossary
- **WHEN** the entries for the skill `nn-workspace-git` and for the openspec capability folders are read
- **THEN** the skill is recorded as renamed to `nn-domain-git`
- **AND** the capability folders are recorded as keeping their names, with the old-to-new name mapping listed

### Requirement: Technical documentation moves with the code

Each slice MUST update the technical docs (`docs/innfo`, `docs/skills`, `docs/use`) and regenerate the generated indexes for the surfaces that slice changes. Commercial web copy is out of scope and is handled by the follow-up change `nn-nomenclature-commercial-web`.

#### Scenario: Slice with docs drift fails
- **GIVEN** a slice that renames a tool but leaves the tool documented under the old name
- **WHEN** the docs and generated-index gates run
- **THEN** at least one fails

#### Scenario: Commercial pages untouched
- **GIVEN** this change
- **WHEN** its diff is inspected
- **THEN** `docs/index.html`, `use-cases.html`, `llms.txt` and `ai-index.yaml` are not edited for vocabulary

### Requirement: Agents load the dictionary through the root AGENTS.md

Because no `iNNfo/AGENTS.md` exists, the root `AGENTS.md` MUST carry a pointer to `vocabulary.json` and the vocabulary page, and `docs/innfo/documentation/vocabulary.md` MUST be generated from `vocabulary.json` and drift-checked by `verify.js`.

#### Scenario: Pointer present
- **GIVEN** the root `AGENTS.md`
- **WHEN** it is read
- **THEN** it points to the canonical dictionary and the vocabulary page

#### Scenario: Generated page drift fails
- **GIVEN** `vocabulary.json` changed without regenerating the vocabulary page
- **WHEN** `verify.js` runs
- **THEN** it fails and names the stale page
