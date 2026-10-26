# cogNNitive Deliverable Review & Feedback Guide

## Overview

Deliverables produced within the **cogNNitive** ecosystem (such as business plans, technical specifications, and operating procedures) are compiled directly from structured **iNNfo** kNNowledge documents and their verified evidence sources.

Feedback flows back into the kNNowledge as **changesets**: reviewed proposals stored as `_changes_NN.md` documents under `changes/`. A changeset is never applied silently — it is reviewed, then applied with `apply_change`, so every mutation is recorded and traceable.

---

## 1. The Review Surface: the Domain Console

Deliverables and their source kNNowledge are inspected in the **domain console** (`domaiNN_console.html`, one per domaiNN). The console renders concepts, elements, matrices, and lineage; citation fields resolve to the exact source heading through the `@` grammar (`sources/import/meeting.md@## Budget`).

There is no separate Word-based review file. The console is the single review surface, and it is self-contained: open the `.html` file in any browser, with no server and no build step.

---

## 2. How Feedback Becomes a Changeset

1. **Propose.** While reviewing, the reviewer (or an AI agent acting on the review) records changes. Agents derive operations and call the `propose_changeset` MCP tool, which writes a sealed changeset with status `proposed` under `changes/` and regenerates the console so the change can be inspected.
2. **Review.** Each proposal carries its target, the intended change, the author, and its evidence citation (`sources`). An unsent change is stored locally in the console and shown with the **Unsent** badge; a proposed changeset document is the durable record.
3. **Approve and apply.** When the user confirms, `apply_change` is called with the changeset path. It validates first, then persists atomically, records the change in `ChangeHistory`, and regenerates the console.

---

## 3. Changeset Operations

`propose_changeset` accepts a list of operations, each with `op`, `target`, and operation-specific keys:

- `update_field`, `update_concept_field`, `update_matrix_cell`, `update_concept_text`
- `add_element`, `remove_element`, `rename_element`, `rename_concept`
- `add_model` (with `blueprint_name`, `blueprint_url`, and optional `knowledge_version`)
- `add_matrix`, `remove_matrix`
- `freeze_slugs`, `bump_version`
- `comment`

`apply_change` applies either a changeset document (`changeset` / `changeset_path`) or a bare intent operation (`op` + `args`) against a knowledge `id`.

---

## 4. Statuses and Staleness

- **Unsent** — a change recorded locally in the console, not yet written to `changes/`.
- **Applied** / **Not applied** — the outcome recorded in the console's `ChangeHistory` after an `apply_change` run (`applied` and `partially_applied` map to **Applied**; `conflict` and `rejected` map to **Not applied**).
- **Target changed** — the cited element hash drifted since the change was proposed. Staleness is **per change**, so a version bump elsewhere never invalidates an unrelated change; a change whose target drifted stays exportable and is flagged for re-review.

---

## 5. Traceability

Every applied change is recorded in the kNNowledge's lineage and in the changeset file. Each element cites its exact origin with the `@` locator grammar, resolved through sidecars and the lineage record, so a reviewer can always walk from a claim back to the file and heading it came from.
