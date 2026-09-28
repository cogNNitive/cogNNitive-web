# Docs Content Hygiene Specification

## Purpose

Published repository documentation MUST describe the repository as it
actually exists, MUST NOT keep duplicate canonical pages, and MUST NOT ship
unpublished orphaned content. This capability also fences off unrelated WIP
that must not be touched by this change.

## Requirements

### Requirement: Accurate Repository Map In README

`README.md`'s repository structure diagram MUST list only paths that exist
in the working tree, using their actual current location (e.g. `skills/` at
repo root, not a removed `actioNN/` top-level directory).

#### Scenario: Every mapped path exists

- GIVEN the repository structure diagram in `README.md`
- WHEN each listed path is checked against the working tree
- THEN every path resolves to an existing file or directory

#### Scenario: Stale path is corrected

- GIVEN the diagram currently lists `actioNN/skills/` and `actioNN/scripts/`, which no longer exist
- WHEN this change is applied
- THEN the diagram lists the current real locations of that content instead

### Requirement: About Page Has a Generated Markdown Twin

`docs/innfo/about.html` MUST be the single canonical About page.
`docs/innfo/about.md` MUST NOT be hand-authored: it is a generated Markdown
twin, mechanically derived from `about.html` by
`scripts/generate-about-twin.mjs`, with no nav/footer/script chrome. This
follows the AI-readiness convention already applied across the site
(`skills/nn-site-generator/components/ai-readiness.md`): every published HTML
page carries a Markdown twin with the same content. `docs/innfo/about.html`,
`docs/innfo/llms.txt`, and `docs/innfo/ai-index.yaml` continue to reference
`about.md` — it still exists, it is just no longer a hand-maintained file.

#### Scenario: about.md is generated, not hand-authored

- GIVEN `docs/innfo/about.html`
- WHEN `scripts/generate-about-twin.mjs` runs in write mode
- THEN `docs/innfo/about.md` is (re)written deterministically from
  `about.html`'s content, excluding any `<nav>`, `<footer>`, or `<script>`
  elements

#### Scenario: about.html remains the reachable canonical page

- GIVEN `docs/innfo/sitemap.xml`'s `/innfo/about` entry
- WHEN a reader follows it
- THEN it resolves to `about.html` with no broken link introduced

#### Scenario: about.md drift is caught, not silently republished

- GIVEN `docs/innfo/about.md` at `HEAD` no longer matches a fresh render of
  `docs/innfo/about.html`
- WHEN `scripts/generate-about-twin.mjs --check --against HEAD` runs
- THEN it exits non-zero, naming the stale file

### Requirement: No Orphaned Unpublished Marketing Content

`marketing/storyboard/` MUST be removed. Nothing links to it and it is not
served by any published site.

#### Scenario: Storyboard directory is removed

- GIVEN `marketing/storyboard/` exists before the change
- WHEN this change is applied
- THEN `marketing/storyboard/` no longer exists

#### Scenario: No dangling reference remains

- GIVEN the repository after removal
- WHEN scanned for references to `marketing/storyboard/`
- THEN none is found outside version-control history

### Requirement: Unrelated Maintainer WIP Stays Untouched

This change MUST NOT create, modify, or delete
`docs/innfo/documentation/_sidebar.md`,
`docs/innfo/documentation/specifications.md`,
`docs/innfo/documentation/templates.md`,
`docs/innfo/documentation/template-video.md`, or any file under
`docs/innfo/documentation/assets/`. These are concurrent, unrelated WIP owned
by another session and are out of scope in full.

#### Scenario: Diff excludes the fenced paths

- GIVEN the full diff produced by implementing this change
- WHEN the fenced paths are checked against that diff
- THEN none of them appear as added, modified, or deleted
