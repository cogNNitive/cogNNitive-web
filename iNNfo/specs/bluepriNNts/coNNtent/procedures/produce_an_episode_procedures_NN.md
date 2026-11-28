---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-32-6"
slots:
  - { name: episode, kind: value, required: false, type: string, label: Episode, description: "The episode Produce an Episode runs on, for example series/<s>/episodes/<slug>." }
title: "Produce an Episode"
---

# NN Procedure

## NN Procedure: Produce an Episode
slug:: produce-an-episode
summary:: The procedure that runs the pipeline through its gates to a delivered episode.
level:: episode
outputs_expected:: @delivered-episode
It starts when: A sealed scene draft exists, or a content change re-opened an episode. The gates declared by `review_gates` are open.

### NN Work: Run produce to the script gate
slug:: run-produce-to-the-script-gate
next:: @review-the-script
step_type:: task
executor:: engine
command:: ~/.agents/skills/nn-conntent/scripts/produce.mjs {episode}
exit_codes:: {"10": "waiting", "11": "waiting", "12": "failed"}
scope:: internal
`produce` is the only engine command this procedure runs. It applies pending human changesets, validates, plans, and stops at the first open gate. Exit `0` done, `10` an unsatisfied gate, `11` a spend stop no verdict can satisfy, `12` `failed_qa`, `1` any other named error. It regenerates the console data at every exit.

### NN Work: Review the script
slug:: review-the-script
next:: @decide-the-script-verdicts
step_type:: task
executor:: human
section:: Episode > Review
scope:: internal
Each scene in order with its Kind, narration, the estimate against `budget`, and a verdict control. A reason is a changeset comment on the scene, never a field.

### NN Work: Decide the script verdicts
slug:: decide-the-script-verdicts
next:: @run-produce-to-the-preview-gate
step_type:: decision
executor:: human
decision:: `approved` or `needs-change` with a reason for every scene
scope:: internal
The verdict is a `review_gate` changeset carrying the scene's `reviewed_hash`. Approvals happen in the console or by replying OK, and never by the agent. A verdict signs the scene on disk, so while a scene has a pending edit in the same draft the console offers no verdict for it: apply the edit first, reopen the console, then approve.

### NN Work: Run produce to the preview gate
slug:: run-produce-to-the-preview-gate
next:: @review-the-animatic
step_type:: task
executor:: engine
command:: ~/.agents/skills/nn-conntent/scripts/produce.mjs {episode}
scope:: internal
`produce` synthesizes TTS and images in parallel, aligns captions, builds the animatic, and stops at the `preview` gate. No avatar call is made before it.

### NN Work: Review the animatic
slug:: review-the-animatic
next:: @approve-the-avatar-spend
step_type:: task
executor:: human
section:: Episode > Review
scope:: internal
The low-resolution animatic with real audio and the scene stills. A scene whose `reviewed_hash` no longer matches is refused with "content changed since you reviewed it; reopen the console".

### NN Work: Approve the avatar spend
slug:: approve-the-avatar-spend
next:: @run-produce-to-delivered
step_type:: decision
executor:: human
decision:: approve the `preview` gate (each scene slice hash) or the `budget` gate (`plan_hash`) that `produce` lists
scope:: internal
With `preview` on, the preview approval authorizes the avatar spend and no second approval is asked. A `budget` gate appears only when the plan exceeds `budget`.

### NN Work: Run produce to delivered
slug:: run-produce-to-delivered
next:: @read-the-result
step_type:: task
executor:: engine
command:: ~/.agents/skills/nn-conntent/scripts/produce.mjs {episode}
scope:: internal
`produce` synthesizes the avatars, compiles once, links assets, renders every output format natively, runs `hyperframes check` and QA on each format and a cross-format timeline check, writes the thumbnails and the description, delivers under `deliveries/v<N>/`, and sets `status:: delivered`. Delivery is automatic once QA passes and is the final outcome of this run, not a step of its own.

### NN Work: Read the result
slug:: read-the-result
step_type:: task
executor:: human
section:: Episode > Status
scope:: internal
The lifecycle position, the QA result and the delivery version. When QA fails the episode is `failed_qa` (exit 12) and no delivery is assembled: read the failing checkpoint here, fix it, and run `produce` again. When a delivered episode changes, the first changed gate re-opens for the affected scenes and `produce` stops there again.

A gate absent from `review_gates` is skipped, and the stages around it still run in order.
With `review_gates:: []` and a plan within `budget`, the run reaches `delivered` with no human step. Every gate approval is a human `review_gate` changeset: the agent never approves and never invents a hash.

# NN Artifact

## NN Artifact: Delivered Episode
slug:: delivered-episode
