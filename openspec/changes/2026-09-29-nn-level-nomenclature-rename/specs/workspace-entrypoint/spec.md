## MODIFIED Requirements

### Requirement: Primary Entrypoint Discovery and Parsing

The canonical primary entrypoint of a domaiNN MUST be a kNNowledge document whose file name is exactly `domaiNN_NN.md`, conforming to the `domaiNN` bluepriNNt. The match MUST be by exact name, not by prefix: `recursiveParse()` MUST NOT treat any file starting with `domain` or `knowledge` as the entrypoint. The legacy names `workspace_NN.md`, `workspace_01.md`, `workspace.md`, `workspace_*_NN.md` and `*_base_NN.md` MUST only be detected, and only until the S11 cleanup (afterwards no legacy detection exists and these names are ordinary files): when one is present and `domaiNN_NN.md` is absent, `recursiveParse()` MUST report the domain as legacy with a migration hint and MUST NOT load that file as the entrypoint.

#### Scenario: Domain root contains domaiNN_NN.md (canonical)
- GIVEN a domaiNN root directory containing `domaiNN_NN.md` conforming to the `domaiNN` bluepriNNt
- WHEN `recursiveParse()` initializes the domaiNN
- THEN `domaiNN_NN.md` is loaded as the primary entrypoint
- AND no legacy warning is logged

#### Scenario: Look-alike files are not entrypoints
- GIVEN a root containing `Domain_Glossary_NN.md` and `knowledge_notes_NN.md` and no `domaiNN_NN.md`
- WHEN `recursiveParse()` scans the root
- THEN neither file is selected as the entrypoint

#### Scenario: Legacy entrypoint is detected, not loaded
- GIVEN a root containing `workspace_01.md` and no `domaiNN_NN.md`
- WHEN `recursiveParse()` initializes
- THEN the result marks the domain legacy with a migration hint
- AND `workspace_01.md` is not parsed as the entrypoint

#### Scenario: Legacy overview-root entrypoint is detected, not loaded
- GIVEN a root containing `acme_base_01.md` and `workspace_01.md`
- WHEN `recursiveParse()` initializes
- THEN the domain is reported legacy
- AND neither file is loaded as the entrypoint

### Requirement: Legacy Index and Directory Fallback

If no `domaiNN_NN.md` exists at the root and no legacy entrypoint name is present, `recursiveParse()` MUST NOT fall back to `index.md` or to any other compatibility entrypoint (migrate-first forbids compatibility fallbacks); the exact name `domaiNN_NN.md` is the only entrypoint. It MUST scan root `.md` files and emit a missing-entrypoint warning issue. The presence of a legacy entrypoint name MUST take precedence and MUST produce the legacy report.

#### Scenario: index.md is not an entrypoint
- GIVEN a root lacking `domaiNN_NN.md` and any legacy entrypoint name but containing `index.md`
- WHEN `recursiveParse()` executes entrypoint resolution
- THEN `index.md` is not parsed as the entrypoint
- AND a missing-entrypoint warning issue is reported

#### Scenario: Directory scan when no entrypoint exists
- GIVEN a root with neither `domaiNN_NN.md`, a legacy entrypoint name nor `index.md`
- WHEN `recursiveParse()` executes entrypoint resolution
- THEN root directory `.md` files are scanned and incorporated into the graph
- AND a missing entrypoint warning issue is reported in the parse results

#### Scenario: Legacy name beats fallbacks
- GIVEN a root with `workspace_01.md` and `index.md`
- WHEN `recursiveParse()` executes entrypoint resolution
- THEN the legacy report is produced and `index.md` is not used

### Requirement: Submodel Reference Extraction

The parser MUST extract referenced submodels from both traditional markdown/wikilink syntax (`[[target.md]]`, `[label](target.md)`) AND structured `kNNowledge` element properties (e.g. `path::` fields on `type:: knowledge` elements).

#### Scenario: Submodels declared via kNNowledge path fields
- GIVEN a `domaiNN_NN.md` containing a `kNNowledge` element with `path:: kNNowledge/core_engine_01.md`
- WHEN `recursiveParse()` processes the entrypoint
- THEN `kNNowledge/core_engine_01.md` is queued and parsed as a submodel in the graph

#### Scenario: Submodels declared via wikilinks in entrypoint content
- GIVEN a `domaiNN_NN.md` body containing `[[kNNowledge/analytics_01.md]]`
- WHEN `recursiveParse()` extracts links from the entrypoint
- THEN `kNNowledge/analytics_01.md` is parsed and linked in the graph

### Requirement: Level 2 Workspace Template Definition

The canonical Level 2 definition of the domaiNN container MUST be the `domaiNN` bluepriNNt (`domaiNN/spec_NN.md`, see the `domain-blueprint` capability). It MUST define the core concept primitives `domaiNN`, `kNNowledge` (using `type:: knowledge`) and `Tag` (`type:: category`), with standard properties. `workspace_spec_NN.md` and the versioned `workspace_V_0-3-0_spec_NN.md` are frozen predecessors and MUST NOT be a conformance target for new documents.

#### Scenario: Entrypoint validates against the domaiNN bluepriNNt
- GIVEN `domaiNN_NN.md` declaring the `domaiNN` bluepriNNt as its `parent_spec`
- WHEN metamodel validation runs
- THEN the `domaiNN`, `kNNowledge` and `Tag` concept definitions are recognised

#### Scenario: Frozen predecessor is not a conformance target
- GIVEN a new entrypoint declaring `workspace_spec` as its `parent_spec`
- WHEN it is validated
- THEN it is reported legacy with a migration hint
