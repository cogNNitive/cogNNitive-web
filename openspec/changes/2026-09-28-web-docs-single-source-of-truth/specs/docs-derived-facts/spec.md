# Docs Derived Facts Specification

## Purpose

Published MCP tool facts and the public skills catalog MUST be generated from
their canonical sources at docs-build time instead of hand-typed, and CI MUST
detect drift between the canonical source and the published output.

## Requirements

### Requirement: MCP Tool Facts Derived From The Registry

The docs build MUST derive the published MCP tool count and tool list from
`TOOL_REGISTRY` / `toolDefinitions` / `TOOL_COUNT` exported by
`iNNfo/packages/innfo-mcp/src/server.ts` (via its built output), not from a
hand-typed number in any docs source file.

#### Scenario: Registry grows by one tool

- GIVEN a new entry is added to `TOOL_REGISTRY`
- WHEN the docs build runs
- THEN the published tool count and tool list reflect the new total
- AND no docs source file requires a manual edit

#### Scenario: Hand-typed count is removed

- GIVEN any docs source file that previously hard-coded an MCP tool count
- WHEN the docs build runs
- THEN that file no longer contains a literal tool count; it renders the derived value

### Requirement: Skills Catalog Derived From `source.yaml`

The published skills catalog MUST list only skills declared in
`manifest/source.yaml`, with name and version read from that file, not
hand-typed in the docs source.

#### Scenario: Version bump propagates

- GIVEN a skill's version changes in `manifest/source.yaml`
- WHEN the docs build runs
- THEN the published catalog entry for that skill shows the new version with no manual edit

#### Scenario: Unregistered skill stays hidden

- GIVEN a skill exists under `skills/` but has no entry in `manifest/source.yaml` (e.g. `nn-workspace-git` before release)
- WHEN the docs build runs
- THEN the published catalog does not list that skill

### Requirement: CI Drift Guard

`scripts/verify.js` MUST fail when a generated docs file differs from what
regenerating it from its canonical source would produce, OR when a
hand-typed MCP tool count or skill version reappears in a docs source file.

#### Scenario: Stale generated file fails verify

- GIVEN a generated docs file that is out of sync with its canonical source
- WHEN `verify.js` runs
- THEN it reports a failure naming the stale file

#### Scenario: Reintroduced hand-typed fact fails verify

- GIVEN a docs source file with a literal MCP tool count or skill version added by hand
- WHEN `verify.js` runs
- THEN it reports a failure naming the offending literal

#### Scenario: Regeneration is deterministic

- GIVEN no change to any canonical source (`server.ts`, `source.yaml`)
- WHEN the docs build runs twice in a row
- THEN both runs produce byte-identical generated output with no timestamps or counters

### Requirement: Build Order Dependency On The MCP Package

Any docs generation step that reads MCP tool facts MUST run only after the
`innfo-mcp` package has been built in the current pipeline run, and MUST fail
fast with a clear error (not a silent fallback) if the built artifact is missing.

#### Scenario: Docs build already sequences correctly

- GIVEN `scripts/build-docs.mjs` builds `innfo-mcp` before staging docs
- WHEN the tool-facts generation step runs
- THEN it reads the just-built artifact and succeeds

#### Scenario: Built artifact missing

- GIVEN the `innfo-mcp` build artifact does not exist when tool-facts generation runs
- WHEN the docs build reaches that step
- THEN it exits with a non-zero status and a message naming the missing artifact

### Requirement: Generator Scope Isolation From Unrelated WIP

Generators introduced by this capability MUST write only to the specific
generated files they own (e.g. the MCP tool facts file and the skills
catalog file) and MUST NOT modify, regenerate, or overwrite
`docs/innfo/documentation/_sidebar.md`, `specifications.md`, `templates.md`,
`template-video.md`, or any file under `docs/innfo/documentation/assets/`,
even when those files are present as unrelated concurrent WIP in the same
directory.

#### Scenario: Generator runs alongside unrelated WIP

- GIVEN `docs/innfo/documentation/_sidebar.md` and `specifications.md` contain uncommitted WIP changes from another session
- WHEN the docs-derived-facts generator runs
- THEN those files are byte-identical before and after the run
- AND only the tool-facts and skills-catalog generated files change
