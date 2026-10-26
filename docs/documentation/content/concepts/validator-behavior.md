# Validator behavior

Validation is where cogNNitive's guarantees actually live. A model is not "probably
fine" — it is either conformant or it is not, and the reasons are a deterministic list of
diagnostics. This page explains what the validator checks, how it ranks findings, how it
resolves the schema to check against, and how the per-document validator differs from the
repository-wide gate.

## The problem

An AI agent can produce a document that *looks* right and is structurally wrong: a
duplicate slug, an unknown Concept, a `select` value outside its allowed set, a citation
to a heading that no longer exists. Without a deterministic checker, those defects are
found late, by a human, by accident. cogNNitive validates on every read, write, and
build, with the same rules everywhere.

## Deterministic validation

The validator is a pure function of the document and its resolved parent. Given the same
inputs it produces the same diagnostics, in a stable order — no randomness, no network,
no clock. It runs as a single entry point so that the MCP server, the console, and the
skills all hold a document to one set of rules:

- A **document-hygiene** pass checks frontmatter keys, body structure, and naming
  conventions.
- A **schema-conformance** pass (for level-2 and level-3 documents with a resolved
  parent) checks the document against the Concepts, Fields, and Matrices its parent
  declares.

The two passes are merged into one flat view of `errors` and `warnings`.

## Severity levels

Every diagnostic is routed to a bucket by its severity:

| Severity | Effect | Examples |
|---|---|---|
| `error` | The document is invalid. | `MARKERS_REMOVED`, `DUPLICATE_SLUG`, `RESERVED_CONCEPT_NAME`, `L3_SCHEMA_COMPONENTS`, `INVALID_NESTED_CONCEPT`, `AMBIGUOUS_ELEMENT_NAME`, `QU_NOT_PROVENANCE` |
| `warning` | Reported, but does not affect validity. | `UNFROZEN_MODEL`, `PARENT_CONCEPT_GUIDANCE_INCOMPLETE`, `TEMPLATE_CACHE_STALE`, `NN_NAME_INVARIANT` |
| `info` | An informational notice, reported but never blocking. | `BOM_WARNING` (a byte-order mark was stripped before parsing) |

A document is valid when it has **no errors**. Warnings and informational notices are
surfaced so they stay visible, but they do not fail validation. The citation checks
(`KU_*`) sit in this system too — for example `KU_BINARY_TARGET` tells you to cite a
binary's sidecar, and `KU_EXCLUDED_PATH` reports that a `staging/` path is scratch, not
missing.

## The diagnostic list

A diagnostic carries a stable `code`, a `path` into the document, a human-readable
`message`, and often a `promptHint` describing the fix. Representative codes by area:

| Area | Codes |
|---|---|
| Removed constructs | `MARKERS_REMOVED` |
| Identity and naming | `DUPLICATE_SLUG`, `UNFROZEN_MODEL`, `RESERVED_CONCEPT_NAME`, `NN_NAME_INVARIANT` |
| Structure | `INVALID_NESTED_CONCEPT`, `SECTION_CONCEPT_MISMATCH`, `L3_SCHEMA_COMPONENTS` |
| References | `AMBIGUOUS_ELEMENT_NAME`, `SUBMODEL_NOT_FOUND`, `SUBMODEL_TEMPLATE_MISMATCH` |
| Citations | `KU_DANGLING_FILE`, `KU_UNKNOWN_SLUG`, `KU_UNKNOWN_ROW`, `KU_UNKNOWN_POINTER`, `KU_BINARY_TARGET`, `KU_EXCLUDED_PATH`, `QU_NOT_PROVENANCE` |
| Freshness | `TEMPLATE_CACHE_STALE`, `BOM_WARNING` |

The full set is produced by the validator; treat this table as a map of the areas, not an
exhaustive list. See [Validator behavior](../how-to/validate-domain.md) in practice, and
[Sources, citations and lineage](sources-citations-lineage.md) for the citation codes.

## Resolution order

Before a document can be checked, its parent bluepriNNt must be found. Resolution is
**domain-first**, then outward:

1. The `domaiNN`'s `specs/bluepriNNts/<name>/` package directory.
2. The flat `specs/` fallback under the domain root.
3. The global `~/.agents/bluepriNNts/` store.
4. The bluepriNNts bundled with installed skills.

The same ordered list drives both the actual lookup and the "searched:" paths shown when
resolution fails, so where a bluepriNNt is found cannot drift from where the engine
claims to have looked. See [The specification chain](specifications.md).

## Two gates, two jobs

There are two validators, and it is important not to conflate them:

- **The per-document validator** checks **one document** against its resolved parent and
  returns diagnostics. This is the one your agent runs (through the `validate_knowledge`
  and `validate_blueprint` tools) and the one the console runs when it renders a model.
- **The repository gate** (`node scripts/verify.js`) is a contributor-facing check for the
  cogNNitive source repository itself: blueprint inventory parity, drift guards between
  generated artifacts and their sources, static type checking, license checks, the
  discovered test suites, and the hand-typed-facts and lineage-drift guards. It is not part
  of your domaiNN.

The first answers "is this document valid?"; the second answers "is the cogNNitive
repository internally consistent and buildable?". They share the engine underneath but
serve different scopes.

## See also

- [The specification chain](specifications.md)
- [Sources, citations and lineage](sources-citations-lineage.md)
- [Tags and open taxonomy](tags-and-taxonomy.md)
- [Validate a domaiNN](../how-to/validate-domain.md)
- [MCP tools](../reference/mcp-tools.md)
