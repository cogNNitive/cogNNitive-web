---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-32-6"
title: "Define a Frame"
---

# NN Procedure

## NN Procedure: Define a Frame
slug:: define-a-frame
summary:: The wizard that produces `library/frames/<name>/FRAME.md` at the domaiNN or the series level.
level:: domaiNN or series
outputs_expected:: @frame-folder
It starts when: Set up the Domain is applied. Optional: a series that ships no frame of its own renders with the package `neutral` frame.

### NN Work: Choose the frame level and source
slug:: choose-the-frame-level-and-source
next:: @build-the-frame
step_type:: decision
executor:: human
decision:: the level (domaiNN or series) and the starting point — one of the thirteen HyperFrames frame presets, `hyperframes capture <url>`, or scratch
scope:: internal
A series-level frame lives in `series/<s>/library/frames/`; a domaiNN-level frame serves every series.

### NN Work: Build the frame
slug:: build-the-frame
next:: @preview-the-frame
step_type:: task
executor:: agent
produces:: `library/frames/<name>/FRAME.md` with normative frontmatter (`colors`, `typography`, `spacing`, `components`) and its intent prose
scope:: internal
Start from the preset tokens, the captured tokens or scratch. Add `caption-skin.html` beside the frame when it styles captions, and a `fonts/` folder when its typography names fonts. A frame is truth for colour and type, never for layout.

### NN Work: Preview the frame
slug:: preview-the-frame
next:: @deliver-the-frame-proposal
step_type:: decision
executor:: human
decision:: accept the preview, tune the tokens, or try another starting point
scope:: internal
The agent renders a sample overlay from the frame tokens so the preview shows the type and accents in use, not a swatch list.

### NN Work: Deliver the frame proposal
slug:: deliver-the-frame-proposal
next:: @approve-the-frame-proposal
step_type:: task
executor:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset` that names the frame and, when it becomes the default, the `frame` field at the chosen level
scope:: internal
One `produce_artifact` record with the sha256 of every created file (the frame, the skin, each font). Dry-apply it. The agent does not apply it.

### NN Work: Approve the frame proposal
slug:: approve-the-frame-proposal
step_type:: decision
executor:: human
decision:: approve or reject the proposed changeset in the console (`Series > Config`) or by replying OK
scope:: internal
The frame is referenced by rendering only after the change is applied.

# NN Artifact

## NN Artifact: Frame Folder
slug:: frame-folder
