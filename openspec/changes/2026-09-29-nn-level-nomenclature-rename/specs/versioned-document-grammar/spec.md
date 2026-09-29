## ADDED Requirements

### Requirement: The V_0-3-0 language is the only form tooling reads or writes

`innfo-core`, `innfo-mcp` and `innfo-editor` MUST read and write only the iNNfo `V_0-3-0` language. That language defines the keys `knowledge_version`, `blueprint_version`, `blueprint_name`, `knowledge_dir` and `blueprints_dir`, the field property `target_blueprint` (replacing `target_template`), the keyword `type:: knowledge` that replaces `type:: model`, and the concept headings `domaiNN`, `kNNowledge` and `bluepriNNts`. The keys `parent_spec`, `spec_version`, `spec_url`, `level`, `sources_dir` and `skills_dir` are unchanged. All keys and the keyword are lowercase.

#### Scenario: New document parses
- **GIVEN** a kNNowledge document written in the V_0-3-0 language
- **WHEN** the core parser and validator run
- **THEN** the document parses and validates with no legacy issue

#### Scenario: Serializer writes only the new language
- **GIVEN** a parsed V_0-3-0 document
- **WHEN** the serializer emits it
- **THEN** the output contains only the V_0-3-0 key names and `type:: knowledge`
- **AND** the output is byte-identical to the input for an unmodified document

#### Scenario: Scaffolds and editor saves use the new language
- **GIVEN** a new document created by the MCP scaffold or the editor
- **WHEN** its frontmatter and headings are inspected
- **THEN** no legacy key, legacy keyword or legacy heading is present

### Requirement: The language version of a document is resolved deterministically

The normative language version of a document is the Level-1 spec at the end of its parent chain (L3 `parent_spec` to L2 `parent_spec` to L1 `parent`). No explicit language-version key MUST be added to documents. Legacy detection MUST NOT depend on resolving that chain: it MUST use an offline structural fingerprint with these signals: a legacy key in any frontmatter; `type:: model` in a bluepriNNt; a `models/` or `specs/templates/` folder; a `workspace*.md` entrypoint without `domaiNN_NN.md`; a `*_base_NN.md` overview-root entrypoint (`OVERVIEW_ROOT_RE`) without `domaiNN_NN.md`; a `parent_spec.url` containing `/specs/templates/`; an L1 parent below `V_0-3-0`. The `*_base_NN.md` name is a legacy signal only: the new layout recognises exactly `domaiNN_NN.md`. When both legacy and current signals are present, the verdict MUST be `mixed`. A document whose language version resolves to anything older than `V_0-3-0` MUST be classified legacy. The classification MUST be produced without applying the current-language schema to that document.

#### Scenario: Older language version is legacy
- **GIVEN** a document whose parent chain resolves to iNNfo `V_0-2-2`
- **WHEN** it is loaded by new tooling
- **THEN** it is classified legacy

#### Scenario: Mixed signals yield the mixed verdict
- **GIVEN** a domain with both a legacy signal and a current signal
- **WHEN** legacy detection runs
- **THEN** the verdict is `mixed`

#### Scenario: Overview-root entrypoint is a legacy signal
- **GIVEN** a domain root containing `acme_base_01.md` and no `domaiNN_NN.md`
- **WHEN** legacy detection runs
- **THEN** the verdict is `legacy` and the signal `overview-root-entrypoint` is listed

#### Scenario: Legacy detected offline
- **GIVEN** a legacy document whose `parent_spec.url` still resolves over the network
- **WHEN** legacy detection runs with no network access
- **THEN** the document is still classified legacy from its structural signals

#### Scenario: Ambiguous resolution is reported, not guessed
- **GIVEN** a document whose language version cannot be resolved
- **WHEN** it is loaded
- **THEN** a structured resolution issue is reported
- **AND** the document is not treated as current

### Requirement: Legacy documents yield a migration hint, not a parse error

When core, MCP or the editor meets a legacy document or a legacy domain layout, it MUST report that the input is legacy and point to nn-upgrade. This requirement is time-bounded: it holds until the S11 cleanup, after which no legacy detection or hint exists anywhere and a legacy input is simply unsupported (import-as-source stays available only when the user invokes it explicitly). Until then it MUST NOT surface a raw parse error, MUST NOT partially load the document, and MUST NOT write to it.

#### Scenario: MCP call against a legacy domain
- **GIVEN** a domain directory with the legacy entrypoint and `models/` folder
- **WHEN** any MCP tool is called against it
- **THEN** the response identifies the domain as legacy and names nn-upgrade
- **AND** no file in the domain is modified

#### Scenario: Editor opens a legacy domain
- **GIVEN** the editor opening a legacy domain
- **WHEN** loading completes
- **THEN** the user sees the legacy notice with the nn-upgrade pointer
- **AND** no parse error is displayed

### Requirement: Legacy keys are never read outside the quarantine

The legacy key names and the legacy keyword MUST be recognised only inside the legacy quarantine module. A document that declares the V_0-3-0 language but carries a legacy key or keyword MUST fail validation with an explicit issue; the value MUST NOT be silently read from the legacy key.

#### Scenario: Mixed-language document fails validation
- **GIVEN** a V_0-3-0 document that also carries `model_version`
- **WHEN** it is validated
- **THEN** validation reports the legacy key as an error
- **AND** the `knowledge_version` value is not populated from it

#### Scenario: Dual-read is confined
- **GIVEN** the source tree of core, MCP and editor
- **WHEN** it is searched for the legacy key names outside `iNNfo/packages/innfo-core/src/legacy/`
- **THEN** no runtime reader is found
