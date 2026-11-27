---
level: 3
parent_spec:
  name: "procedures_V_0-7-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Using the Procedures Blueprint"
---

# NN Work

## NN Work: Using the Procedures Blueprint
slug:: using-the-procedures-blueprint
step_type:: task
condition:: You want to model a repeatable, executable workflow
input:: @procedures-model
output:: @executable-procedure
tool:: @console
executor:: human
scope:: internal
Getting started with the Procedures blueprint: declare a Procedure catalog entry, decompose it into Work steps, name the Artifacts, Tools and Roles it uses, then run it through the guided stepper.

## NN Work: Declare the Procedure
slug:: declare-the-procedure
parent:: @using-the-procedures-blueprint
step_type:: task
next:: @decompose-into-work-steps
condition:: No procedure catalog exists yet
input:: @procedures-model
output:: @procedures-model
tool:: @console
executor:: human
scope:: internal
Add a `Procedure` element with `category`, `summary`, `inputs_required`, `outputs_expected` and `executed_by`.

## NN Work: Decompose into Work Steps
slug:: decompose-into-work-steps
parent:: @using-the-procedures-blueprint
step_type:: task
next:: @name-artifacts-tools-and-roles
condition:: Procedure catalog entry declared
input:: @procedures-model
output:: @procedures-model
tool:: @console
executor:: human
scope:: internal
Add `Work` elements (root = the procedure, children = ordered steps) linked with `parent` and `next`, and mark each `step_type`.

## NN Work: Name Artifacts, Tools and Roles
slug:: name-artifacts-tools-and-roles
parent:: @using-the-procedures-blueprint
step_type:: task
next:: @run-the-guided-stepper
condition:: Work steps defined
input:: @procedures-model
output:: @procedures-model
tool:: @console
executor:: human
scope:: internal
Declare the `Artifact`, `Tools` and `Roles` elements and wire them to steps via `input`, `output`, `tool` and `scope`.

## NN Work: Run the Guided Stepper
slug:: run-the-guided-stepper
parent:: @using-the-procedures-blueprint
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
description:: A Procedure catalog entry with a complete Work step sequence.

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
description:: Owns the procedure catalog and its step decomposition.
