# Canonical Vocabulary Specification

## Purpose

Pin a canonical term dictionary for the cogNNitive ecosystem, collapsing overlapping vocabulary onto canonical nouns with explicit deprecated aliases. Establishes **app** as the canonical term for the Level-2 schema (currently called **template**) while keeping all identifiers stable, and excludes unrelated senses of "template".

## Requirements

### Requirement: Canonical term dictionary is machine-readable and human-visible

The system MUST provide a canonical term dictionary in two forms: a machine-readable map (`vocabulary.json` under `iNNfo/specs/`) that drives editor labels and skill copy, and a human-readable page under `docs/innfo/documentation/vocabulary.md`. The `iNNfo/AGENTS.md` "Ubiquitous Language & Domain Terminology" block MUST be updated to match.

#### Scenario: Dictionary consumed by editor labels

- GIVEN the canonical dictionary published as `vocabulary.json`
- WHEN `innfo-editor` renders a label for a Level-2 schema
- THEN the label MUST use the canonical term `app` for the schema sense

#### Scenario: Dictionary rendered as docs page

- GIVEN the canonical dictionary
- WHEN `docs/innfo/documentation/vocabulary.md` is generated
- THEN it lists every canonical term with its deprecated aliases and sense exclusions

### Requirement: `app` is canonical, `template` is an explicit deprecated alias

The dictionary MUST declare **app** as the canonical noun for the Level-2 schema (`_spec_NN.md` pinned by `parent_spec`). **template** MUST be accepted as a documented deprecated alias for one release (read, not written), then removed from user-facing copy. The deprecation MUST follow the `provenance-vocabulary` pattern: explicit, published, and never a silent fallback.

#### Scenario: New copy uses app

- GIVEN user-facing copy authored after this change
- WHEN it refers to a Level-2 schema
- THEN it MUST use `app`, not `template`

#### Scenario: Legacy copy still readable

- GIVEN existing docs/skills that say `template`
- WHEN the dictionary deprecation window is open
- THEN `template` resolves to `app` with a deprecation note in the dictionary

### Requirement: Excluded senses of "template"

The rename MUST NOT apply to: nn-trannsform's transformation templates (`traNNsformations/` directory, CLI `--apply <name>`), Vue SFC `<template>` blocks, or generic English usage. The dictionary MUST record these exclusions explicitly.

#### Scenario: nn-trannsform vocabulary untouched

- GIVEN `nn-trannsform` skill copy
- WHEN it refers to its transformation templates
- THEN the term `template` remains valid in that context and is NOT renamed

#### Scenario: Source code syntax untouched

- GIVEN `.vue` files in `innfo-editor`
- WHEN inspected after this change
- THEN `<template>` SFC blocks are byte-identical

### Requirement: Identifiers remain stable

All resolution-bearing identifiers MUST remain unchanged: `iNNfo/specs/templates/<name>/` paths, `spec_url`, `parent_spec.url`, `template_version`, `template_name`, MCP tool names (`get_template`, `validate_template`, `list_templates`, `hydrate_template`, `list_template_procedures`, `list_template_skills`), manifest `templates:`/`frozen_templates:`/`ref_key: templates`, git tags `templates-v*`, `SHIPPED_TEMPLATE_VERSIONS` keys, and hydration paths. Each stable identifier MUST be recorded in the dictionary's alias table.

#### Scenario: No identifier migration in this change

- GIVEN the dictionary's "planned migrations" section
- WHEN it is read
- THEN every stable identifier is listed as a future migration candidate, not a current one

#### Scenario: Resolution unaffected

- GIVEN a Level-3 model pinning `parent_spec.url` to a template spec URL
- WHEN resolved after this change
- THEN resolution succeeds unchanged

### Requirement: Element-vocabulary audit

The audit MUST review L2 Concept Definition names in the 13 active templates AND the Ghostbusters Inc. canonical samples, and MUST produce a proposed simpler surface. Scope is pinned to those two artifact sets; MCP tool names and internal SDD spec identifiers are out of scope.

#### Scenario: Audit covers samples

- GIVEN the element-vocabulary audit
- WHEN it runs
- THEN it reviews concept names in `iNNfo/specs/templates/*/spec_NN.md` and `*/samples/Ghostbusters*.md`

#### Scenario: Audit produces a proposal

- GIVEN the audit output
- WHEN it is reviewed
- THEN it proposes a consistent, simpler element-vocabulary surface for a follow-up change

### Requirement: Backlog follow-up item for identifier migration

The unified backlog MUST gain a new work item recording the future mechanical identifier migration (paths, URLs, keys, tags) as a coordinated release-bound change.

#### Scenario: Follow-up item exists

- GIVEN `openspec/backlog.md`
- WHEN read after this change
- THEN it contains a new work item for the identifier migration with the dictionary's "planned migrations" section as its source