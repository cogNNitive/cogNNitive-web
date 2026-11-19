---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/executions/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-8-0_NN.md"
blueprint_version: "V_0-2-0"
title: "Executions App"
description: "Level-2 blueprint recording runs of procedures: one instance model per run, with an append-only log of events, closed after its terminal event."
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
  * [[Execution Event]]

# NN Concept Definition

## NN Concept Definition: Procedure Execution
icon:: play-circle
type:: list
color:: purple
weight:: 100
storage:: distributed
placement:: "executions/{slug}/"

## NN Concept Definition: Execution Event
icon:: history
type:: list
color:: purple
weight:: 90
write_policy:: append-only

# NN Field Definition

## NN Field Definition: procedure
concept:: Procedure Execution
type:: address
description:: Address of the Procedure or root Work this run executes (model@element).

## NN Field Definition: def_rev
concept:: Procedure Execution
type:: string
description:: knowledge_version of the procedure model when the run started; the run follows that revision to the end.

## NN Field Definition: params
concept:: Procedure Execution
type:: string
description:: Opaque parameters the run was started with (a JSON object of slot values).

## NN Field Definition: kind
concept:: Execution Event
type:: select
options:: [started, step_started, step_waiting, step_completed, step_failed, input_recorded, artifact_produced, artifact_validated, artifact_rejected, interrupted, resumed, rebased, completed, failed, cancelled]
description:: What happened. completed, failed and cancelled are terminal.

## NN Field Definition: step
concept:: Execution Event
type:: address
description:: Address of the Work step the event belongs to, when it belongs to one.

## NN Field Definition: field
concept:: Execution Event
type:: string
description:: Name of the input an input_recorded event records, or the slug of the Artifact an artifact event records.

## NN Field Definition: value
concept:: Execution Event
type:: string
description:: Value the event records: an input value, an artifact path or address, what a step waits on, a failure reason, or the new definition revision of a rebased event.

## NN Field Definition: outcome
concept:: Execution Event
type:: string
description:: Answer a step_completed event records; for a decision step, the token its next conditions test.

## NN Field Definition: next
concept:: Execution Event
type:: string
description:: Slug of the Work step a step_completed event moves to.

## NN Field Definition: attempt
concept:: Execution Event
type:: number
description:: Attempt number of a step_started event (1 for the first try).

## NN Field Definition: inputs
concept:: Execution Event
type:: string
description:: Input revisions a step_started event froze: a JSON object mapping artifact slug to its validated rev.

## NN Field Definition: rev
concept:: Execution Event
type:: string
description:: Revision of what an input or artifact event records: sha256 for a file or command, the last change id for an element, empty for a human check.

## NN Field Definition: actor
concept:: Execution Event
type:: string
description:: Who caused the event: a person, an agent or the engine.

## NN Field Definition: at
concept:: Execution Event
type:: string
description:: When the event happened (ISO 8601).

# Executions App

## A blueprint for recording runs of procedures as append-only logs

## Philosophy

A procedure (the `procedures` bluepriNNt) says what should happen; an execution records what did happen in one run. The two are kept in separate bluepriNNts on purpose: a procedures document is a definition the procedure loaders read, while a run is ordinary kNNowledge, discovered, listed and versioned like any other model.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Procedure Execution** | `list` | One run of a procedure, stored as its own instance model under `executions/{slug}/` |
| **Execution Event** | `list` | One thing that happened in the run. `append-only`: written once, never changed or removed |

### Run Header

The root element of a run carries `procedure` (the address of what runs), `def_rev` (the procedure model's `knowledge_version` the run follows to the end) and `params`. The header is mutable while the run is open.

### Event Log

Everything that happens is appended as an **Execution Event**, each with its `actor` and `at`:

| kind | meaning | fields |
|---|---|---|
| `started` | run created | `actor` |
| `step_started` | a step began | `step`, `attempt`, `inputs` (artifact slug to rev, frozen) |
| `step_waiting` | handed to a person, an agent or the console | `step`, `value` (what it waits on) |
| `step_completed` | step done | `step`, `outcome`, `next` (slug of the step taken) |
| `step_failed` | step failed | `step`, `value` (reason or exit code) |
| `input_recorded` | a value read or entered | `field`, `value`, `rev` |
| `artifact_produced`, `artifact_validated`, `artifact_rejected` | artifact fact | `step`, `field` (artifact slug), `value` (path or address), `rev` |
| `interrupted`, `resumed` | a person paused or resumed the run | `actor` |
| `rebased` | the actor accepted a new definition revision | `value` (the new revision) |
| `completed`, `failed`, `cancelled` | terminal | `actor` |

Each event is one `add_element` change that carries its fields (`to:: {json}`). Events are `write_policy:: append-only` (iNNfo V_0-8-0): an event is added, its empty values may be filled once, and nothing written is ever changed or removed; a mistake is corrected by a new event. The state of a run (current step, recorded inputs, outcome, stale artifacts, drift from `def_rev`) is derived from its events and is not stored. An engine step that started and recorded nothing else is a crash, derived and never written.

### Closing

After its terminal event the run is closed with the `close_model` change; a closed run accepts no further write. A run that holds events cannot be removed or moved.

A closed run is a record, so it can be cited as evidence (`<run id>@<event>`), like a source; an open run cannot (CITATION_NOT_CLOSED).

### Computed Values

A computed value (a KPI computed from a metrics model, for instance) is the output of a run: the run records an `input_recorded` event for each value it reads (its address in `step` or `field`, the value, the model version) and an event with the result, then it is closed. The computed value cites that run. The evidence keeps the inputs as they were, and comparing them with the current values shows when the value must be recomputed.

## Template

### Level 3 Run Template

```markdown
---
level: 3
parent_spec:
  name: "executions"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/executions/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Onboard ACME"
---

# NN Procedure Execution
## NN Procedure Execution: Onboard ACME
slug:: onboard-acme
procedure:: suppliers@onboard-supplier
def_rev:: V_1-2-0
params:: {"supplier": "ACME"}

# NN Execution Event
## NN Execution Event: e-001
kind:: started
actor:: ana
at:: 2026-11-18T09:00:00Z

## NN Execution Event: e-002
kind:: input_recorded
step:: suppliers@collect-tax-id
field:: tax_id
value:: B12345678
actor:: ana
at:: 2026-11-18T09:04:00Z
```
