---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/executions/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-9-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-9-0_NN.md"
blueprint_version: "V_0-3-0"
title: "Executions App"
description: "Level-2 blueprint recording runs of procedures as models with state: one instance model per run, holding its header, one row per step and one row per artifact; the history of the run is the change log of that model."
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: false
  graph_edge:
    enabled: false
  sequence:
    enabled: true
---

# NN index

* [[Procedure Execution]]
  * [[Step Run]]
  * [[Run Artifact]]
  * [[Input]]

# NN Concept Definition

## NN Concept Definition: Procedure Execution
icon:: play-circle
type:: list
color:: purple
weight:: 100
storage:: distributed
placement:: "executions/{slug}/"

## NN Concept Definition: Step Run
icon:: list-checks
type:: list
color:: blue
weight:: 90
description:: One row per step of the procedure. Its slug is the step slug. Mutable: the runner writes it as the step advances.

## NN Concept Definition: Run Artifact
icon:: package
type:: list
color:: orange
weight:: 80
description:: One row per artifact of the procedure. Its slug is the artifact slug. Mutable: verification and staleness move it.

## NN Concept Definition: Input
icon:: log-in
type:: list
color:: grey
weight:: 70
description:: A computed or entered input the run recorded, with its revision. One row per input name.

# NN Field Definition

## NN Field Definition: procedure
concept:: Procedure Execution
type:: address
description:: Address of the Procedure or root Work this run executes (model@element or document@container).

## NN Field Definition: def_rev
concept:: Procedure Execution
type:: string
description:: knowledge_version of the procedure model when the run started; the run follows that revision to the end.

## NN Field Definition: params
concept:: Procedure Execution
type:: string
description:: Opaque parameters the run was started with (a JSON object of slot values).

## NN Field Definition: seq
concept:: Procedure Execution
type:: number
description:: The run's write counter. Every runner changeset increments it with a from guard, so any concurrent write to the same run conflicts the whole changeset.

## NN Field Definition: state
concept:: Procedure Execution
type:: select
options:: [open, paused, completed, failed, cancelled]
transitions:: {"": ["open"], "open": ["paused", "completed", "failed", "cancelled"], "paused": ["open", "completed", "failed", "cancelled"], "completed": [], "failed": [], "cancelled": []}
description:: The stored lifecycle of the run. The status the tools return is the fold's derived RunStatus, which reports paused when this is paused.

## NN Field Definition: status
concept:: [Step Run, Run Artifact]
type:: select
options:: [pending, active, waiting, done, failed, expected, produced, validated, rejected]
transitions:: {"": ["pending", "expected"], "pending": ["active", "failed", "done"], "active": ["waiting", "done", "failed"], "waiting": ["active", "done", "failed"], "failed": ["active"], "done": ["active"], "expected": ["produced", "validated", "rejected"], "produced": ["validated", "rejected"], "validated": ["produced"], "rejected": ["produced"]}
description:: The stored lifecycle of a step row (pending, active, waiting, done, failed) or an artifact row (expected, produced, validated, rejected). Each row only takes the edges of its own lifecycle; the rows never cross.

## NN Field Definition: attempt
concept:: Step Run
type:: number
description:: The attempt number of the current claim, 1 for the first try.

## NN Field Definition: outcome
concept:: Step Run
type:: string
description:: The answer the step recorded; for a decision step, the token its next conditions test.

## NN Field Definition: next
concept:: Step Run
type:: string
description:: The slug of the step this one moved to.

## NN Field Definition: inputs
concept:: Step Run
type:: string
description:: The input artifact revisions frozen at claim time: a JSON object mapping artifact slug to its rev.

## NN Field Definition: waiting_on
concept:: Step Run
type:: string
description:: What a waiting step waits on.

## NN Field Definition: failure
concept:: Step Run
type:: string
description:: Why the step failed.

## NN Field Definition: claimed_at
concept:: Step Run
type:: string
description:: When the current attempt was claimed (ISO 8601).

## NN Field Definition: timeout_ms
concept:: Step Run
type:: number
description:: The budget of the current attempt. At most 300000.

## NN Field Definition: holder
concept:: Step Run
type:: string
description:: Who holds the claim, as pid@host. A step whose holder is gone is a crash, derived from it.

## NN Field Definition: evidence
concept:: Step Run
type:: string
description:: The applied change ids a human step observed, such as the verdicts it waited on.

## NN Field Definition: kind
concept:: Run Artifact
type:: select
options:: [file, element, changeset]
description:: How the artifact is carried: a file, a model element, or a changeset of several elements.

## NN Field Definition: value
concept:: Run Artifact
type:: string
description:: Where the artifact is: a path, a model@element address, or a changeset path.

## NN Field Definition: rev
concept:: [Run Artifact, Input]
type:: string
description:: The revision that pins the artifact (sha256 for a file, the element's origin change id for an element, the applied change for a changeset) or the recorded input's value.

# Executions App

## A blueprint for recording runs of procedures as models with state

## Philosophy

A procedure (the `procedures` bluepriNNt) says what should happen; an execution records the state of what is happening in one run. The two are kept in separate bluepriNNts on purpose: a procedures document is a definition the procedure loaders read, while a run is ordinary kNNowledge, discovered, listed and versioned like any other model.

A run stores state, not a second ledger. Its history is the change log of its own model, like every other model: who moved which step, when, and from what is read from the applied changes, never from an event concept the runner invents.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Procedure Execution** | `list`, distributed | One run of a procedure, stored as its own instance model under `executions/{slug}/`. Its header: `procedure`, `def_rev`, `params`, `seq`, `state` |
| **Step Run** | `list` | One row per step, slug = step slug. Mutable |
| **Run Artifact** | `list` | One row per artifact, slug = artifact slug. Mutable |
| **Input** | `list` | One row per recorded input, with its value and revision |

### Run Header

The root element of a run carries `procedure` (the address of what runs), `def_rev` (the procedure model's `knowledge_version` the run follows to the end), `params`, a `seq` counter and its `state`. The header is mutable while the run is open.

### State, not events

A step's status, attempt, outcome, chosen `next` and frozen `inputs` live on its `Step Run` row; an artifact's `kind`, `value`, `rev` and `status` live on its `Run Artifact` row. There is no event concept: everything the runner would have logged as an event is either a row field (state) or a change (history).

`procedure_start` writes one atomic changeset: `add_model`, the header, and one `add_element` per step and per artifact. Either the whole run exists or none of it does.

### Concurrency

Every runner changeset holds the header's `seq: n -> n+1` with `from: {seq: n}`, so any concurrent write to the same run conflicts the whole changeset. A step claim and completion also guard the step's `status` and `attempt`, so a late completion from an older attempt conflicts (the fence). A process that dies between claim and completion leaves `active`; the step is derived as crashed from its `holder`, and the next caller records `active -> failed` and may retry.

### Artifacts

- A `file` artifact is a hash-verified reference, not frozen bytes: a file changed after it was recorded is detected (its rev no longer matches, so dependents go stale), not prevented.
- An `element` artifact's `rev` is the element's origin change id, computed by the runner.
- A `changeset` artifact is a multi-element output whose `value` is the changeset path: `produced` while it is proposed, `validated` when it is applied, `rejected` when it is rejected.

### Closing

After its terminal `state`, the run is closed with the `close_model` change; a closed run accepts no further write.

A closed run is a record, so it can be cited as evidence (`<run id>@<step-slug>`), like a source; an open run cannot (CITATION_NOT_CLOSED). The run context a step's changesets carry (`run:: <run-id>@<step-slug>`) is what makes "what did this step produce" a run-scoped read of the change log.

## Template

### Level 3 Execution Template

```markdown
---
spec_version: "V_0-5-0"
level: 3
parent_spec:
  name: executions
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/executions/spec_NN.md"
blueprint_version: "V_0-3-0"
status: active
---

# NN index

* [[Procedure Execution]]
  * [[Step Run]]
  * [[Run Artifact]]

# NN Procedure Execution

## NN Procedure Execution: <title>
procedure:: <model>@<element>
def_rev:: <version>
params:: {json}
seq:: 1
state:: open

# NN Step Run

## NN Step Run: <step name>
slug:: <step-slug>
status:: pending
attempt:: 0

# NN Run Artifact

## NN Run Artifact: <artifact name>
slug:: <artifact-slug>
kind:: file
status:: expected
```
