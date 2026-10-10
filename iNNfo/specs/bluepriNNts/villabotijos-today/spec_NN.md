---
spec_version: "V_0-4-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/villabotijos-today/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-4-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-4-0_NN.md"
blueprint_name: "villabotijos-today"
blueprint_version: "V_0-1-0"
title: "Villabotijos Today Series"
includes:
  - name: "video-script"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: false
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]
* [[Template]]
* [[Series]]

# NN Concept Definition

## NN Concept Definition: Series
slug:: series
icon:: radio
type:: list
color:: teal
weight:: 100

# NN Field Definition

## NN Field Definition: tone
concept:: Series
type:: string
description:: Series-wide tone-of-voice rule. Read once from the Series blueprint and applied to every video; never restated per element.

## NN Field Definition: sound_tags
concept:: Series
type:: string
description:: Series-wide palette of sound tags (e.g. sting, whoosh) available to every video in the series.

# Villabotijos Today Series

## A Series blueprint: the video-script schema plus the series-wide tone and sound rules

## Philosophy

A Series is a blueprint (this schema) plus an L3 Template-data document that ships its
`Template` instances. The Series blueprint composes the canonical `video-script` schema
via `includes` and adds only the series-wide fields — `tone` and `sound_tags` — that must
live in exactly one place and never be restated per element.

## Objectives

- Reuse the `video-script` schema additively through `includes`.
- Hold series-wide tone and sound rules once, on the `Series` Concept.
- Ship tool/voice/model configuration as `Template` instances in an L3 Template-data doc.

## Specification

The tone and sound rules are read from this blueprint; a video that uses them references
the behavior but does not duplicate the rule text. Tools, voices, and models are declared
as `Template` elements in the series' L3 Template-data document and referenced from Scenes
through `template::`.

# Concept Guidance Documentation

## Series

### Summary

The single series-wide element carrying the tone-of-voice and sound-tag rules.

### Description

One `## NN Series: <name>` element holds the series-wide rules in `tone` and `sound_tags`.
Its `slug::` is the stable identity. Because the rule lives here once, per-element
instructions MUST NOT repeat it.

### Methodologies

- Declare tone and sound tags once; reference them from videos, never copy them.

### Prompts

- "Set the series `tone` to `<tone>`."

## Video

### Summary

The video-script root Concept, composed from the `video-script` include.

### Description

Adopts the canonical `Video` Concept: exactly one per script, carrying the human `title`.

### Methodologies

- Use the inherited `video-script` schema unchanged.

### Prompts

- "Create a `Video` named `<title>`."

## Scene

### Summary

The video-script Scene Concept, composed from the `video-script` include.

### Description

Adopts the canonical `Scene` Concept: ordered, prose narration body, owning its Layers.

### Methodologies

- Use the inherited `video-script` schema unchanged.

### Prompts

- "Add a `Scene` named `<name>`."

## Layer

### Summary

The video-script Layer Concept, composed from the `video-script` include.

### Description

Adopts the canonical `Layer` Concept discriminated by `type::`.

### Methodologies

- Use the inherited `video-script` schema unchanged.

### Prompts

- "Add a `Layer` of `type:: <type>`."

## Template

### Summary

The video-script Template Concept, composed from the `video-script` include.

### Description

Adopts the canonical `Template` Concept carrying `tool`, `voice`, and `model`.

### Methodologies

- Declare Template instances in the Series' L3 Template-data document.

### Prompts

- "Add a `Template` named `<name>` with `voice:: <voice>`."
