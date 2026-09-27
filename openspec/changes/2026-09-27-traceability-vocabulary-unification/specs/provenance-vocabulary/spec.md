# Spec: Provenance Vocabulary Unification (Completion)

## MODIFIED Requirements

### Requirement: Documentation uses only Source / Citation / Lineage

Every user-visible surface of the citation/lineage feature area — documentation
prose, doc titles, filenames, `SKILL.md` headings and prose, error and warning
strings, and core-language spec section headings — MUST describe the pipeline
using exactly three nouns — **Source**, **Citation**, **Lineage** — and MUST
NOT introduce "provenance" as a standalone concept, "traceability",
"grounding", "3-tier lineage", or "canonical view". This supersedes the prior,
narrower version of this requirement, which only reached doc prose and
`SKILL.md` prose and left doc filenames, doc titles, and the core-language
heading unaddressed.

In particular:
- `docs/innfo/documentation/citations-provenance.md` MUST be renamed to a
  filename and title that use only Source/Citation/Lineage vocabulary (no
  "provenance" in either the filename or the `#` title), and every inbound
  link to the old filename (including but not limited to `_sidebar.md`,
  `llms.txt`, `ai-index.yaml`, `documentation_NN.md`, `offline-consoles.md`,
  and the `scanner-core.js` source comment) MUST be updated to the new path.
- The `nn-trannsform` and `nn-innfo` `SKILL.md` headings and prose MUST NOT
  contain "provenance" as a standalone concept.
- The core-language section heading previously titled
  `## Provenance & Traceability (sources)` MUST be renamed to a heading using
  only Source/Citation/Lineage vocabulary in the new core-language version.

#### Scenario: Provenance doc rewrite

- GIVEN `docs/innfo/documentation/citations-provenance.md`
- WHEN it is reviewed after this change
- THEN it defines Source, Citation, and Lineage once each
- AND it contains no `artifacts/canonical/` reference
- AND OKF v0.1 / W3C PROV-O / RO-Crate appear only under an explicit
  "Planned, not implemented" heading or not at all

#### Scenario: Provenance doc renamed and re-linked

- GIVEN the documentation set as it exists after this change
- WHEN the six known inbound links to
  `docs/innfo/documentation/citations-provenance.md` are inspected
- THEN none of them still resolve to a "provenance"-named file
- AND all six point at the new "Sources & Lineage"-named file

#### Scenario: Core-language heading no longer says "Provenance"

- GIVEN the core-language file that succeeds `iNNfo_V_0-2-1_NN.md`
- WHEN its section headings are inspected
- THEN no heading contains the word "provenance"
- AND the section previously titled "Provenance & Traceability (sources)" is
  present under a Source/Citation/Lineage-only heading

## ADDED Requirements

### Requirement: Single Written Derivation Term Is `sources`

There MUST be exactly one term an author writes to express "this
model/artifact was derived from these inputs": `sources::` (element/model
level) or the optional artifact frontmatter `sources:` (same pointer-array
grammar, validated by the same citation validator used for `sources::`
elsewhere). The Models catalog `derived_from` field MUST be removed; a
model's derivation is read from the model's own `sources::`, which
`collectModels` already scrapes. The Artifacts catalog free-text
`derived_from_inputs::` field is superseded by `sources::` using the element
pointer-array grammar. The Lineage record's own `derived_from` key is a
computed read-side output and is unaffected — it is never authored directly
and is not one of the write-side terms this requirement collapses.

#### Scenario: Model derivation is read from sources, not a separate field

- GIVEN a model file whose own `sources::` field lists its input models
- WHEN the Models catalog is built
- THEN the model's derivation is read from that `sources::` field
- AND no separate `derived_from` field is written or read from the Models
  catalog entry

#### Scenario: Artifact derivation is authored as sources

- GIVEN a new artifact entry being authored in the Artifacts catalog
- WHEN its derivation inputs are recorded
- THEN they are written as `sources::` using the element pointer-array
  grammar, not as free-text `derived_from_inputs::`
- AND an artifact frontmatter block MAY carry the same information as an
  optional `sources:` field using the identical pointer syntax

### Requirement: Legacy Derivation Keys Are Deprecated Read-Only Aliases

`derived_from` (Models catalog) and `derived_from_inputs::` (Artifacts
catalog) MUST continue to be read from existing workspaces for one release
cycle, MUST NOT be removed or rejected outright, and MUST NOT be written by
any new authoring path. Reading either MUST surface a deprecation warning,
mirroring the precedent already established for `references:` as a
deprecated alias of `cited_works:`. New workspaces and new artifacts MUST use
`sources::` / `sources:` only.

#### Scenario: Legacy Models derived_from still read with a warning

- GIVEN an existing model entry carrying a `derived_from` field in the Models
  catalog
- WHEN the Models catalog is built
- THEN the field is still read
- AND a deprecation warning is recorded in the run log
- AND no new `derived_from` field is written back

#### Scenario: Legacy Artifacts derived_from_inputs still read with a warning

- GIVEN an existing Artifacts catalog entry carrying `derived_from_inputs::`
- WHEN the Artifacts catalog is built or synchronized
- THEN the field is still read
- AND a deprecation warning is recorded in the run log
- AND no new `derived_from_inputs::` field is written back

#### Scenario: New artifact never authors a legacy key

- GIVEN a newly created artifact entry
- WHEN its derivation is authored
- THEN it is written using `sources::` / `sources:` only

### Requirement: Frontmatter external-works key is `cited_works` [MODIFIED]

Normalised Source frontmatter and Level 3 model frontmatter MUST use
`cited_works:` for the list of external works a document cites. `references:`
MUST be accepted as a deprecated alias (read, not written) for one more
release cycle.

This corrects the base requirement's "Legacy references still read" scenario,
which described a run-log deprecation note that was never implemented: the
scanner's alias (`scanner-core.js`) silently maps `references:` to
`cited_works:` on read, with no log line. No code change is made by this
change — the scenario below is a wording fix to match actual, already-shipped
behavior, so the spec stops promising a diagnostic that does not exist.

#### Scenario: Legacy references still read (corrected)

- GIVEN an existing Source file with a `references:` block
- WHEN the scanner normalizes its frontmatter
- THEN the entries are read as `cited_works`
- AND no run-log deprecation note is emitted (this is a silent alias, unlike
  the `LEGACY_DERIVATION_KEY` warning for `derived_from`/`derived_from_inputs`,
  which does surface a diagnostic)
- AND neither `derived_from` nor `derived_from_inputs::` is written
