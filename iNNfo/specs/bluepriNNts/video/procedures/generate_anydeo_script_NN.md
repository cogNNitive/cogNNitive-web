---
level: 3
parent_spec:
  name: "procedures"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
model_version: "V_0-3-0"
title: "Generate Anydeo Script Procedure (Deprecated)"
---

> [!WARNING]
> **DEPRECATED PROCEDURE**: `generate_anydeo_script_NN.md` has been superseded by the canonical procedure [`generate_video_script_NN.md`](generate_video_script_NN.md).
> All video authoring, asset synthesis, Remotion scene compilation, and headless rendering are now provided directly by the embedded **cogNNitive Video Engine**.

# NN index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Procedure

## NN Procedure: Generate Anydeo Script (Deprecated)
category:: transformation
summary:: [DEPRECATED] Redirects execution to the canonical procedure generate_video_script_NN.md.
inputs_required:: Subject Element (via sources::) and Series registry model
outputs_expected:: Registered Video Assets
executed_by:: Video Producer
procedure_model:: procedures/generate_anydeo_script_NN.md

# NN Work

## NN Work: Redirect to Canonical Video Script Procedure
step_type:: task
condition:: Invocation of legacy generate_anydeo_script_NN procedure
input:: [[Subject and Series Selection]]
output:: [[Registered Video Assets]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Notify the user of procedure deprecation and immediately redirect execution to [[Generate Video Script Workflow]] in `procedures/generate_video_script_NN.md`.

# NN Artifact

## NN Artifact: Subject and Series Selection
type:: input
description:: The Subject Element (cited via the owning Video's sources::) and the Series registry model the Video belongs to.

## NN Artifact: Registered Video Assets
type:: output
description:: The finalized video assets registered on the owning Video Element.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent routing execution to canonical generate_video_script_NN.md.

# NN Roles

## NN Roles: Video Producer
type:: owner
description:: Owns the video's scope and executes the canonical video script procedure.
