---
spec_version: "V_0-4-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/changes/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-4-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-4-0_NN.md"
blueprint_name: "changes"
blueprint_version: "V_0-1-0"
title: "Changeset Blueprint"
description: "Level-2 blueprint defining the normative document model for graph mutations, proposals, reviews, and version transitions in cogNNitive."
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Change]]

# NN Concept Definition

## NN Concept Definition: Change
icon:: git-commit
type:: list
color:: blue
weight:: 100

# NN Field Definition

## NN Field Definition: op
concept:: Change
type:: select
options:: [update_field, add_element, remove_element, rename_element, rename_concept, update_matrix_cell, comment]
description:: Mutation or review operation.

## NN Field Definition: target
concept:: Change
type:: string
description:: Canonical D5 target address (model@element&field or model@matrix&row&col).

## NN Field Definition: from
concept:: Change
type:: string
description:: Precondition check value prior to mutation.

## NN Field Definition: to
concept:: Change
type:: string
description:: Proposed target value.

## NN Field Definition: concept
concept:: Change
type:: string
description:: Target concept for add_element operations.

## NN Field Definition: name
concept:: Change
type:: string
description:: Display name for added or renamed entities.

## NN Field Definition: slug
concept:: Change
type:: string
description:: Proposed explicit slug.

## NN Field Definition: fields
concept:: Change
type:: string
description:: Initial field key-values for added elements.

## NN Field Definition: author
concept:: Change
type:: string
description:: Identifier of author, reviewer, or agent.

## NN Field Definition: notes
concept:: Change
type:: string
description:: Rationale, commit note, or review critique.

## NN Field Definition: status
concept:: Change
type:: select
options:: [proposed, applied, rejected, conflict]
description:: Execution status annotation assigned by agent.

## NN Field Definition: resolution
concept:: Change
type:: string
description:: Execution outcome or conflict description.

## NN Field Definition: resolved_slug
concept:: Change
type:: string
description:: Disambiguated slug assigned upon insertion.

# Changeset Blueprint

## A level-2 blueprint defining the normative document model for graph mutations, proposals, reviews, and version transitions in cogNNitive

## Philosophy

Every graph mutation in cogNNitive is represented as a structured changeset document. Rather than performing uncoordinated mutations or relying on informal agent chat transcript promotion, changesets serve as the single authoritative mutation and provenance medium. Changesets are cryptographically sealed with a proposal hash, verified before application, and recorded permanently to form an immutable chain of provenance.

## Objectives

- Standardize graph mutation operations across models, elements, fields, and matrices.
- Provide cryptographic proposal sealing to detect tampering before execution.
- Support atomic two-phase transactions with zero partial side-effects on validation failure.
- Preserve explicit field-level citations pointing directly to originating changes.
- Enable structured human and agent review feedback as comment operations.

## Specification

A changeset document lives in the changes/ directory at the domain root with the filename pattern <workspace_id>_<author>_<stamp>_changes_NN.md.

Each change is declared as an element of concept Change:
- op: One of update_field, add_element, remove_element, rename_element, rename_concept, update_matrix_cell, comment.
- target: Canonical target address identifying the model, element, field, matrix, row, or column.
- from: Precondition value that must match the live model state.
- to: Proposed value.
- Execution annotations (status, resolution, resolved_slug) record the outcome of applying the change.

## Template

### Level 3 Changeset Template

```markdown
---
spec_version: "V_0-4-0"
parent_spec: "changes"
blueprint_version: "V_0-1-0"
status: proposed
proposal_sha: "<64-character-sha256-hex>"
title: "<Changeset Title>"
author: "<Author>"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Change]]

# NN Change

## NN Change: change-1
op:: update_field
target:: model@element&field
from:: "old_value"
to:: "new_value"
```

## Examples

### Field Update and Review Comment

```markdown
## NN Change: c-01
op:: update_field
target:: strategy@vision&statement
from:: "Initial draft"
to:: "Accelerate renewable adoption"
author:: agent-1
notes:: Align with 2026 sustainability roadmap

## NN Change: c-02
op:: comment
target:: strategy@vision&statement
author:: reviewer-human
notes:: Verified alignment with executive briefing
```
