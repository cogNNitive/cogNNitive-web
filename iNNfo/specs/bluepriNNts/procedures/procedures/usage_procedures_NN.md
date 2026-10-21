---
level: 3
parent_spec:
  name: "procedures_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Procedures Blueprint"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN Work

## NN Work: Using the Procedures Blueprint
step_type:: task
condition:: You want to model a repeatable, executable workflow
input:: [[Procedures Model]]
output:: [[Executable Procedure]]
tool:: [[Console]]
scope:: internal
Getting started with the Procedures blueprint: declare a Procedure catalog entry, decompose it into Work steps, name the Artifacts, Tools and Roles it uses, then run it through the guided stepper.

## NN Work: Declare the Procedure
parent:: [[Using the Procedures Blueprint]]
step_type:: task
next:: [[Decompose into Work Steps]]
condition:: No procedure catalog exists yet
input:: [[Procedures Model]]
output:: [[Procedures Model]]
tool:: [[Console]]
scope:: internal
Add a `Procedure` element with `category`, `summary`, `inputs_required`, `outputs_expected` and `executed_by`.

## NN Work: Decompose into Work Steps
parent:: [[Using the Procedures Blueprint]]
step_type:: task
next:: [[Name Artifacts, Tools and Roles]]
condition:: Procedure catalog entry declared
input:: [[Procedures Model]]
output:: [[Procedures Model]]
tool:: [[Console]]
scope:: internal
Add `Work` elements (root = the procedure, children = ordered steps) linked with `parent` and `next`, and mark each `step_type`.

## NN Work: Name Artifacts, Tools and Roles
parent:: [[Using the Procedures Blueprint]]
step_type:: task
next:: [[Run the Guided Stepper]]
condition:: Work steps defined
input:: [[Procedures Model]]
output:: [[Procedures Model]]
tool:: [[Console]]
scope:: internal
Declare the `Artifact`, `Tools` and `Roles` elements and wire them to steps via `input`, `output`, `tool` and `scope`.

## NN Work: Run the Guided Stepper
parent:: [[Using the Procedures Blueprint]]
step_type:: task
condition:: Procedure fully modelled
input:: [[Executable Procedure]]
output:: [[Executed Procedure]]
tool:: [[Console]]
scope:: internal
Open the `guided-procedure` viewer to walk the Work steps end to end.

# NN Artifact

## NN Artifact: Procedures Model
type:: input
description:: The active level 3 model built on the Procedures blueprint.

## NN Artifact: Executable Procedure
type:: intermediate
description:: A Procedure catalog entry with a complete Work step sequence.

## NN Artifact: Executed Procedure
type:: output
description:: Procedure whose steps have been walked and verified.

# NN Tools

## NN Tools: Console
type:: manual
description:: The cogNNitive console, including the guided-procedure stepper.

# NN Roles

## NN Roles: Procedure Author
type:: author
description:: Owns the procedure catalog and its step decomposition.
