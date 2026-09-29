## ADDED Requirements

### Requirement: New defaults for the knowledge and blueprints directories

A domaiNN MUST use `kNNowledge/` as the default knowledge directory, `specs/bluepriNNts/` as the default local blueprints directory, and `~/.agents/bluepriNNts/` as the global user cache. The directories MUST be declared by the `knowledge_dir` and `blueprints_dir` keys of the V_0-3-0 language (`sources_dir` and `skills_dir` are unchanged), and code MUST resolve the declared key value first and the default second. The former defaults `models/`, `specs/templates/` and `~/.agents/templates/` MUST NOT be used as a fallback.

#### Scenario: Defaults apply
- **GIVEN** a domaiNN that declares no directory keys
- **WHEN** tooling resolves the knowledge and blueprints directories
- **THEN** it uses `kNNowledge/` and `specs/bluepriNNts/`

#### Scenario: Declared key wins
- **GIVEN** a domaiNN whose `knowledge_dir` key names a custom folder
- **WHEN** tooling resolves the knowledge directory
- **THEN** it uses the declared folder

#### Scenario: No legacy folder fallback
- **GIVEN** a directory that has `models/` and no `kNNowledge/` and declares no key
- **WHEN** tooling resolves the knowledge directory
- **THEN** it does not read `models/`
- **AND** it reports the domain as legacy with a migration hint

### Requirement: Hard-coded directory names are removed from consumers

Core, MCP, editor and skills MUST NOT hard-code `models/` or `specs/templates/`. Each consumer MUST obtain directory names from the declared keys or the defaults above.

#### Scenario: No hard-coded legacy folder in runtime code
- **GIVEN** the runtime source of core, MCP and editor outside the quarantine module
- **WHEN** it is searched for the literal folder names `models/` and `specs/templates/`
- **THEN** no runtime path construction is found

### Requirement: Layout paths are NN-cased and matched case-exactly

Folders and files are NN-cased (`bluepriNNts/`, `kNNowledge/`, `domaiNN_NN.md`); keys, the keyword, tool names, tags, env vars, and manifest and catalog keys are lowercase. Every path segment MUST come from one constants module in core (`layout.ts`), with no literal elsewhere. Wherever layout is resolved, a case-exact probe (`readdir` plus a strict `===` on the entry name) MUST replace `stat` and `existsSync`, so that Windows behaves like Linux and a mis-cased folder is reported, not silently accepted. CI MUST run on Linux.

#### Scenario: Mis-cased folder is rejected
- **GIVEN** a directory listing that returns `Knowledge` instead of `kNNowledge`
- **WHEN** the layout is resolved
- **THEN** the mis-cased folder is reported and not accepted as the knowledge directory

#### Scenario: Single source of path segments
- **GIVEN** the runtime source of core, MCP and editor
- **WHEN** it is searched for path segment literals such as `kNNowledge` and `bluepriNNts`
- **THEN** they appear only in `layout.ts`

### Requirement: Series and video terms follow the new vocabulary

The existing Series and Video folder layout and the gitignored ephemeral engine directories rules keep their behaviour; wherever they say "model file" or "template" they MUST be read as kNNowledge document and bluepriNNt.

#### Scenario: Behaviour unchanged
- **GIVEN** a domaiNN using the `series/` tree
- **WHEN** tooling resolves video assets
- **THEN** the resolution is identical to before this change
