---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/repository/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
template_version: "V_0-1-1"
title: "Repository App"
relationship_types:
  hierarchy:
    enabled: true
    via: index block
  evaluable_matrix:
    enabled: true
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Repository]]
  * [[State]]
  * [[Releases]]
  * [[Changes]]

# NN Concept Definition

## NN Concept Definition: Repository
icon:: github
type:: category
color:: blue
weight:: 100

## NN Concept Definition: State
icon:: activity
type:: weight
color:: blue
weight:: 70

## NN Concept Definition: Releases
icon:: tag
type:: list
color:: green
weight:: 80

## NN Concept Definition: Changes
icon:: git-commit-horizontal
type:: list
color:: purple
weight:: 60

# NN Field Definition

## NN Field Definition: name
concept:: Repository
type:: string
description:: Full repository name (`owner/repo`).

## NN Field Definition: remote_url
concept:: Repository
type:: url
description:: Canonical remote URL of the repository.

## NN Field Definition: description
concept:: Repository
type:: markdown_inline
description:: Short description of the repository scope.

## NN Field Definition: status
concept:: State
type:: select
options:: [draft, active, archived]
description:: Lifecycle state of the repository.

## NN Field Definition: default_branch
concept:: State
type:: string
description:: Default branch name (e.g. `main`).

## NN Field Definition: visibility
concept:: State
type:: select
options:: [public, private]
description:: Repository visibility.

## NN Field Definition: version
concept:: Releases
type:: string
description:: Release version (`vX.Y.Z`).

## NN Field Definition: released_at
concept:: Releases
type:: string
description:: ISO timestamp of the release.

## NN Field Definition: notes
concept:: Releases
type:: markdown_inline
description:: Release notes summary.

## NN Field Definition: change_type
concept:: Changes
type:: select
options:: [feat, fix, chore, refactor, docs, test, ci]
description:: Conventional commit type of the change.

## NN Field Definition: scope
concept:: Changes
type:: markdown_inline
description:: Affected area of the change.

## NN Field Definition: merged_at
concept:: Changes
type:: string
description:: ISO timestamp when the change landed.

# NN Marker Definition

## NN Marker Definition: shipped
applies_to:: [Element]
widget:: boolean
symbol:: ✓
icon:: rocket
color:: green
description:: Marked when the change or release reached the default branch.

# NN Matrix Definition

## NN Matrix Definition: change release relations
source:: Changes
target:: Releases
widget:: set
widget_config:: {"max_selections": 1}
values:: [included_in]
description:: A change lands in exactly one release (`included_in` is directional: row change belongs to column release).

## NN Matrix Definition: state release relations
source:: Releases
target:: State
widget:: set
widget_config:: {"max_selections": 1}
values:: [advances_to]
description:: A release advances the repository to a new state.

# Repository Template

## A schema for modelling a GitHub repository lifecycle

## Philosophy

The Repository Template models a GitHub repository as a container (`Repository`) holding its operational state (`State`), its `Releases`, and the individual `Changes` that land in them. It couples each change to the release that shipped it and each release to the state it produced, so the whole lifecycle is traceable from one model.

## Objectives

- Provide a valid Level 2 template usable as `parent_spec` for repository models.
- Model a repository lifecycle: state, releases, and per-change history.
- Express change-to-release and release-to-state relations as evaluable matrices.
- Keep the body valid against the `iNNfo_V_0-2-1` meta-template.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Repository** | `category` | The repository container |
| **State** | `weight` | Current lifecycle state |
| **Releases** | `list` | Published releases |
| **Changes** | `list` | Individual changes that landed |

### Fields

| Concept | Field | Type | Purpose |
|---|---|---|---|
| Repository | `name` | string | `owner/repo` name |
| Repository | `remote_url` | url | Canonical remote URL |
| Repository | `description` | markdown_inline | Scope description |
| State | `status` | select | draft/active/archived |
| State | `default_branch` | string | Default branch |
| State | `visibility` | select | public/private |
| Releases | `version` | string | `vX.Y.Z` |
| Releases | `released_at` | string | ISO timestamp |
| Releases | `notes` | markdown_inline | Release notes |
| Changes | `change_type` | select | feat/fix/chore/refactor/docs/test/ci |
| Changes | `scope` | markdown_inline | Affected area |
| Changes | `merged_at` | string | ISO timestamp |

### Markers

| Marker | Applies to | Widget | Meaning |
|---|---|---|---|
| `shipped` | Element | boolean | The change or release reached the default branch |

### Matrices

| Matrix | Source | Target | Values | Meaning |
|---|---|---|---|---|
| `change release relations` | Changes | Releases | `[included_in]` | A change lands in one release (directional) |
| `state release relations` | Releases | State | `[advances_to]` | A release advances the repository state |

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ✅ | change/release + release/state |
| Graph edge | ❌ | Not applicable |
# Concept Guidance Documentation

## Repository

### Summary

A single repository container, described by `name`, `remote_url`, and `description`, that groups its `State`, `Releases`, and `Changes` elements.

### Description

The `Repository` concept models the container: one `## NN Repository: <name>` element per repository. Its fields hold the `owner/repo` name, the canonical remote URL, and a short scope description. The lifecycle elements live under the `State`, `Releases`, and `Changes` concepts.

### Methodologies

- One `Repository` element per repository, kept as the single entry point of the model.
- Keep the `description` short and stable; it names the scope, not the change list.

### Prompts

- "Create a `Repository` named `<owner/repo>` describing `<scope>`."
- "List every `Release` that belongs to this `Repository`."

## State

### Summary

The current lifecycle state of the repository: status, default branch, and visibility.

### Description

Each `State` element captures the operational posture of the repository — `status` (draft/active/archived), `default_branch`, and `visibility`. A `Release` that ships advances the repository to a new `State` through the `state release relations` matrix.

### Methodologies

- Keep exactly one active `State` element per repository; archive older ones.
- Record state transitions only through the `state release relations` matrix, never as free text.

### Prompts

- "What is the current `State` of `<Repository>`?"
- "Mark that `<Release>` advances the repository to `<State>`."

## Releases

### Summary

Published releases, each tied to the changes it includes.

### Description

Each `Release` element carries `version` (`vX.Y.Z`), `released_at`, and `notes`. The `change release relations` matrix links every `Change` to the single release that shipped it; a release with the `shipped` marker has reached the default branch.

### Methodologies

- One `Release` per published version; keep `version` aligned with the git tag.
- Record change membership only through the `change release relations` matrix.

### Prompts

- "Add a `Release` for `<version>` released at `<timestamp>`."
- "Which `Change` elements are included in `<Release>`?"

## Changes

### Summary

Individual changes that landed, classified by conventional commit type.

### Description

Each `Change` element carries `change_type` (feat/fix/chore/refactor/docs/test/ci), `scope`, and `merged_at`. The `shipped` marker distinguishes merged-but-unreleased changes from those that reached a release.

### Methodologies

- One `Change` per merged pull request or squashed commit.
- Classify with the conventional commit type; keep `merged_at` as the ISO merge timestamp.

### Prompts

- "Add a `Change` of type `<feat>` in scope `<area>` merged at `<timestamp>`."
- "Which `Change` elements are marked `shipped`?"