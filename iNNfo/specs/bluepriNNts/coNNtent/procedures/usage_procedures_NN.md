---
level: 3
parent_spec:
  name: "procedures_V_0-5-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the coNNtent Blueprint"
---

# NN Work

## NN Work: Using the coNNtent Blueprint
step_type:: task
condition:: You want to take one episode from an idea to a published master
input:: [[Video Domain]]
output:: [[Produced Episode]]
tool:: [[AI Agent]]
scope:: internal
An episode moves through five states: `idea`, `draft`, `approved`, `produced` and `published`. Every state change and every field value is written through a changeset, because changesets are the only change record. `produce` is the single command that walks the pipeline; it never spends before the review and budget gates pass.

## NN Work: Draft the Episode
parent:: [[Using the coNNtent Blueprint]]
step_type:: task
next:: [[Propose the Changeset]]
condition:: The episode exists as `idea`, or a scene needs redrafting
input:: [[Series Scope]]
output:: [[Proposed Changeset]]
tool:: [[AI Agent]]
scope:: internal
Read the Series scope document, its `Scene Kind` elements and its `Preset` elements, then draft the scenes. Write the result as a sealed proposed changeset named `proposal_changes_NN.md` in the episode folder. The proposal carries one `add_element` per Scene and per Layer, and a `comment` only where a decision needs explaining. Give every change an `evidence::` line: the apply engine refuses a change without one.

## NN Work: Propose the Changeset
parent:: [[Using the coNNtent Blueprint]]
step_type:: task
next:: [[Review the Episode]]
condition:: The proposal is drafted
input:: [[Proposed Changeset]]
output:: [[Sealed Proposal]]
tool:: [[AI Agent]]
scope:: internal
Seal the proposal with its `proposal_sha` and hand it to `produce`, which dry-applies it against the workspace before touching anything: an unknown Field name, a bad target or a missing evidence line stops the run with the document unchanged. When it applies, `produce` sets `status:: draft` in a separate engine changeset.

## NN Work: Review the Episode
parent:: [[Using the coNNtent Blueprint]]
step_type:: task
next:: [[Approve the Spend]]
condition:: The episode is `draft`
input:: [[Produced Episode]]
output:: [[Reviewed Episode]]
tool:: [[Console]]
scope:: internal
Open the Episode review view. Each Scene has a verdict (`review:: approved` or `review:: needs-change`) and a comment box; the reason for a `needs-change` is a `comment` op on the Scene, never a field. Picking a variant is an `update_field` that copies the value into the Scene field, so the view holds no private copy. `produce` stops with exit 10 while any Scene is unapproved and prints the reviewer's reason verbatim.

## NN Work: Approve the Spend
parent:: [[Using the coNNtent Blueprint]]
step_type:: task
next:: [[Produce the Master]]
condition:: Every Scene is approved
input:: [[Proposed Changeset]]
output:: [[Approved Episode]]
tool:: [[AI Agent]]
scope:: internal
Run the cost estimator and read the plan. When the estimate exceeds the Episode's `budget::`, the human decides and the run proceeds only with `--approve <plan_hash>` matching the current hash: a price or model change makes the hash differ, so a stale approval cannot be replayed. Never invent a hash. `produce` then sets `status:: approved` and retires the consumed `Variant` elements through a changeset; `script_review:: skip` keeps them.

## NN Work: Produce the Master
parent:: [[Using the coNNtent Blueprint]]
step_type:: task
next:: [[Finish the Publication]]
condition:: The episode is `approved`
input:: [[Approved Episode]]
output:: [[Produced Episode]]
tool:: [[AI Agent]]
scope:: internal
`produce` compiles, synthesizes the missing assets, renders the master in place and derives the delivery formats under `formats/`, then writes the chapters into `description.md` and sets `status:: produced`. Talking avatars are the costliest call: they are produced only by `synthesize-avatar.mjs`, never by an ad-hoc provider call, so they stay under the budget, the daily cap and the ledger.

## NN Work: Finish the Publication
parent:: [[Using the coNNtent Blueprint]]
step_type:: task
condition:: The master and the formats exist
input:: [[Produced Episode]]
output:: [[Published Episode]]
tool:: [[AI Agent]]
scope:: internal
Write the publication body in `description.md`, generate the thumbnail with `render-thumbnail.mjs`, and set `published_url::` once it is live. `status:: published` is terminal for the pipeline: `produce` refuses an episode that is already published.
