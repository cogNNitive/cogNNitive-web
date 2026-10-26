---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/changes/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-5-0_NN.md"
blueprint_name: "changes"
blueprint_version: "V_0-5-5"
title: "Changeset Blueprint"
description: "Level-2 blueprint defining the normative document model for graph mutations, proposals, reviews, and version transitions in cogNNitive."
nature:
  structure: members
  ownership: derived
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN index

* [[Change]]

# NN Concept Definition

## NN Concept Definition: Change
icon:: git-commit
type:: list
color:: blue
weight:: 100

# NN Field Definition

## NN Field Definition: tags
concept:: *
type:: select
multiple:: true
description:: Open vocabulary ad-hoc tags and classification labels.

## NN Field Definition: op
concept:: Change
type:: select
options:: [update_field, add_element, remove_element, rename_element, rename_concept, update_matrix_cell, update_concept_text, update_concept_field, remove_matrix, add_matrix, comment, add_model, freeze_slugs, bump_version]
description:: Mutation or review operation.

## NN Field Definition: target
concept:: Change
type:: address
description:: Canonical D5 target address (model@element&field or model@matrix&row&col).

## NN Field Definition: from
concept:: Change
type:: string
description:: Precondition check value prior to mutation.

## NN Field Definition: to
concept:: Change
type:: string
description:: Proposed target value. For bump_version, the version level to bump: patch, minor or major. For add_matrix, the column-axis concept.

## NN Field Definition: base_hash
concept:: Change
type:: string
description:: Content hash of the target element when the change was written (the console's element hash). A different current hash is a precondition failure (conflict). Optional; absent means the change is not guarded by element content.

## NN Field Definition: concept
concept:: Change
type:: string
description:: Target concept for add_element operations, and the row-axis concept for add_matrix.

## NN Field Definition: name
concept:: Change
type:: string
description:: Display name for added or renamed entities; the title of a model created by add_model (defaults to the id); the matrix name for add_matrix.

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

## NN Field Definition: evidence
concept:: Change
type:: citation
description:: Evidence the change derives from — the ONLY provenance of the mutation — in the shared citation grammar (<path>@## <Heading>, <csv>@<row>, <json>@/<pointer>, a bare path, or the literal tokens decision / unknown). Mandatory on every change; written by the proposer at proposal time and sealed into proposal_sha; apply only verifies that it resolves.

## NN Field Definition: blueprint_name
concept:: Change
type:: string
description:: add_model only. Name of the parent bluepriNNt of the model to create.

## NN Field Definition: blueprint_url
concept:: Change
type:: string
description:: add_model only. Immutable URL of the parent bluepriNNt of the model to create.

## NN Field Definition: knowledge_version
concept:: Change
type:: string
description:: add_model only. Optional initial knowledge_version of the created model (inferred from the bluepriNNt when omitted).

## NN Field Definition: status
concept:: Change
type:: select
options:: [proposed, applied, partially_applied, rejected, conflict]
description:: Execution status annotation assigned by the apply engine. partially_applied is a changeset-level status (some changes applied, some conflicted); a change itself is applied, conflict or rejected.

## NN Field Definition: resolution
concept:: Change
type:: string
description:: Execution outcome, conflict description or rejection reason. A rejected changeset records why it was rejected here and is never re-applied.

## NN Field Definition: resolved_slug
concept:: Change
type:: string
description:: Disambiguated slug assigned upon insertion.

# Changeset Blueprint

## A level-2 blueprint defining the normative document model for graph mutations, proposals, reviews, and version transitions in cogNNitive

## Philosophy

Every graph mutation in cogNNitive is represented as a structured changeset document. Rather than performing uncoordinated mutations or relying on informal agent chat transcript promotion, changesets serve as the single authoritative mutation and provenance medium. Changesets are sealed with a proposal hash, verified before application, and recorded permanently to form an immutable chain of provenance. The seal is produced at intake when a proposer omits it (see Specification).

## Objectives

- Standardize graph mutation operations across models, elements, fields, and matrices.
- Provide cryptographic proposal sealing to detect tampering before execution.
- Support atomic two-phase transactions with zero partial side-effects on validation failure.
- Preserve explicit field-level citations pointing directly to originating changes.
- Enable structured human and agent review feedback as comment operations.

## Specification

A changeset document lives in the changes/ directory at the domain root with the filename pattern <prefix>_<author>_<stamp>_changes_NN.md. The prefix is the workspace_id for a changeset written by the MCP (propose_changeset, init_knowledge, apply_change) and the model slug for a changeset exported by the console review.

Each change is declared as an element of concept Change:
- op: One of update_field, add_element, remove_element, rename_element, rename_concept, update_matrix_cell, update_concept_text, update_concept_field, remove_matrix, add_matrix, comment, add_model, freeze_slugs, bump_version.
- target: Canonical target address identifying the model, element, field, matrix, row, or column.
- from: Precondition value that must match the live model state.
- to: Proposed value.
- add_model: Creates a new Level-3 kNNowledge document. target is the new model id; blueprint_name and blueprint_url are required; name (title) and knowledge_version are optional. It carries no from, to or base_hash and no element payload: initial elements are add_element changes that follow it in the same changeset.
- freeze_slugs: Writes an explicit slug for every element of the model that lacks one. target is the bare model id; it carries no other payload.
- bump_version: Raises the model knowledge_version by the level named in to (patch, minor or major). target is the bare model id. The apply engine bumps each touched model exactly once: a changeset that carries bump_version applies that level instead of the default patch bump, never both. The unversioned lineage record cannot be bumped.
- add_matrix: Adds a new matrix table to a Level-3 model. target is model@matrix:&lt;name&gt;; name is the matrix name, concept is the row-axis concept and to is the column-axis concept. Optional fields.columns and fields.rows (comma-separated) seed the grid; when omitted they default to the axis concepts' own elements. Every seeded cell starts empty, ready for update_matrix_cell. It is refused on a Level-2 bluepriNNt (declare a Matrix Definition element there instead), and rejected when the matrix already exists.
- base_hash: Optional precondition on the target element content; a mismatch is a conflict.
- evidence: Mandatory. Evidence the change derives from (a citation, or the literal tokens decision / unknown); written by the proposer and sealed with the proposal. The change is the only provenance of the mutation.
- Execution annotations (status, resolution, resolved_slug, applied_at, batch) record the outcome of applying the change. Each change carries its own applied_at (UTC), status, author and batch; the change chain, ordered by applied_at, is a field's history.

Changeset status is one of proposed, applied, partially_applied, rejected, conflict. A changeset is rejected when the proposal itself is invalid (a failed validation or an unresolved citation): the status and the reason (resolution) are persisted and the changeset is never re-applied. A conflict is a failed precondition of the live model and may be fixed and retried.

A changeset MAY be authored by hand (for example a large agent-generated batch) and applied by path with `apply_change`; it does not require a pre-computed `proposal_sha`. When the seal is omitted the runtime computes it at intake; a present but non-matching value is rejected as tampered (`PROPOSAL_TAMPERED`), so a hand-authored changeset MUST either omit the seal or carry the exact hash. The document-level `proposal_sha` is therefore optional in the template below.

## Template

### Level 3 Changeset Template

```markdown
---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: changes
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/changes/spec_NN.md"
blueprint_version: "V_0-4-0"
status: proposed
proposal_sha: "<64-character-sha256-hex>"
title: "<Changeset Title>"
author: "<Author>"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN index

* [[Change]]

# NN Change

## NN Change: change-1
op:: update_field
target:: model@element&field
from:: "old_value"
to:: "new_value"
evidence:: sources/import/<file>@## <Heading>
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
