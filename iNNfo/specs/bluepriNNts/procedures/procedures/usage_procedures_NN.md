---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Using the Procedures Blueprint"
---

# NN Procedure

## NN Procedure: Using the Procedures Blueprint
slug:: using-the-procedures-blueprint
summary:: Builds one procedure document: its Procedure header, the Work steps nested under it, the Artifacts, Tools and Roles they use, and a first run in the guided stepper.
inputs_required:: @procedures-model
outputs_expected:: @executable-procedure
Covers one procedure document from an empty model to a first run. It does not cover publishing the procedure or composing it into another one. It starts when you want to model a repeatable, executable workflow.

### NN Work: Declare the Procedure
slug:: declare-the-procedure
step_type:: task
next:: @decompose-into-work-steps
condition:: The procedure document has no Procedure header yet
input:: @procedures-model
output:: @procedures-model
tool:: @console
executor:: human
scope:: internal
Add the one `Procedure` element of the document, its header, with `summary`, `category`, `inputs_required` and `outputs_expected`. Write the summary an agent reads to decide whether this procedure applies: the derived catalog shows it.

### NN Work: Decompose into Work Steps
slug:: decompose-into-work-steps
step_type:: task
next:: @name-artifacts-tools-and-roles
condition:: The Procedure header is declared
input:: @procedures-model
output:: @procedures-model
tool:: @console
executor:: human
scope:: internal
Nest the steps under the header as `### NN Work:` headings, link them with `next`, and mark each `step_type` and `executor`. The step with no incoming `next` is where a run starts.

### NN Work: Name Artifacts, Tools and Roles
slug:: name-artifacts-tools-and-roles
step_type:: task
next:: @run-the-guided-stepper
condition:: Work steps defined
input:: @procedures-model
output:: @procedures-model
tool:: @console
executor:: human
scope:: internal
Declare the `Artifact`, `Tools` and `Roles` elements, wire them to steps through `input`, `output` and `tool`, and record who answers for each step in the `work-roles matrix`.

### NN Work: Run the Guided Stepper
slug:: run-the-guided-stepper
step_type:: task
condition:: Procedure fully modelled
input:: @executable-procedure
output:: @executed-procedure
tool:: @console
executor:: human
scope:: internal
Open the `guided-procedure` viewer to walk the Work steps end to end.

# NN Artifact

## NN Artifact: Procedures Model
slug:: procedures-model
type:: input
description:: The active level 3 model built on the Procedures blueprint.

## NN Artifact: Executable Procedure
slug:: executable-procedure
type:: intermediate
description:: A procedure document: one Procedure header with a complete Work step sequence.

## NN Artifact: Executed Procedure
slug:: executed-procedure
type:: output
description:: Procedure whose steps have been walked and verified.

# NN Tools

## NN Tools: Console
slug:: console
type:: manual
description:: The cogNNitive console, including the guided-procedure stepper.

# NN Roles

## NN Roles: Procedure Author
slug:: procedure-author
type:: author
description:: Owns a procedure document and its step decomposition.
