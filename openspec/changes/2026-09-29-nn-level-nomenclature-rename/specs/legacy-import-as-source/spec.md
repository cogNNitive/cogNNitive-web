## ADDED Requirements

### Requirement: Import-as-source is offered only as an exit, never automatically

nn-upgrade MUST offer import-as-source only when a legacy migration cannot validate or when a bluepriNNt has no schema map. The offer MUST state that this is re-derivation and not migration: provenance is kept, and original identities and version continuity are lost. The user's consent is required, and the legacy domain MUST NOT be modified.

#### Scenario: Offer with stated tradeoff
- **GIVEN** a legacy domain containing a bluepriNNt with no schema map
- **WHEN** the dry-run report is shown
- **THEN** import-as-source is offered
- **AND** the offer states that identities and version continuity are not preserved

#### Scenario: Not offered when migration succeeds
- **GIVEN** a legacy domain that migrates and validates
- **WHEN** the flow ends
- **THEN** import-as-source is not proposed as the default

#### Scenario: Legacy domain untouched
- **GIVEN** an accepted import-as-source
- **WHEN** the flow completes
- **THEN** the legacy domain is byte-identical to before

### Requirement: The exit creates a new domaiNN that ingests the legacy domain as a Source

The exit is invoked as `migrate-domain.js --import-as-source --new-domain-dir <dir>`. It MUST scaffold a new domaiNN in the V_0-3-0 language at `<dir>` and copy the legacy tree under `sources/`. The agent then continues with nn-trannsform and nn-innfo. The exit MUST create a new domaiNN in the V_0-3-0 language, ingest the legacy domain as a Source through the existing nn-trannsform ingestion, and re-derive kNNowledge with Source and Citation lineage. It MUST NOT add core code that reads legacy formats.

#### Scenario: New domaiNN with lineage
- **GIVEN** an accepted import-as-source
- **WHEN** the flow completes
- **THEN** a new domaiNN exists and validates
- **AND** its kNNowledge cites the ingested Source through Citation lineage

#### Scenario: No legacy reader added
- **GIVEN** the implementation of the exit
- **WHEN** the source tree is inspected
- **THEN** it contains no reader for legacy keys, keyword or layout outside the quarantine module

### Requirement: The exit survives the cleanup

The exit MUST carry no `legacy:nn-rename/<id>` marker and MUST have no ledger entry. It MUST remain available after the quarantine module is deleted, and it is the only route for any legacy domain found after the cleanup.

#### Scenario: Available after cleanup
- **GIVEN** the repository after the final cleanup slice
- **WHEN** the user runs nn-upgrade with `--import-as-source` on a legacy domain
- **THEN** a new domaiNN is scaffolded and the legacy tree is copied under its `sources/`
- **AND** nn-upgrade offers no in-place migration
