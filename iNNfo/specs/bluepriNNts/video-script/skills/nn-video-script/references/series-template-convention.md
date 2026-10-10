# Series Template Convention

Defines how a Series carries its reusable configuration: a Series is a Level-2
blueprint (schema) plus a Level-3 Template-data kNNowledge document. See spec
`series-script-templates` for the normative requirements; this file is the
authoring-facing "how", not a restatement of the spec.

## Series = blueprint + L3 Template data

A Series ships two artifacts:

- A **blueprint** under `iNNfo/specs/bluepriNNts/<series>/spec_NN.md` that
  `includes: [video-script]` and adds only series-specific fields (for example
  series `tone` and `sound_tags`).
- A **Level-3 Template-data document** that adopts that blueprint and declares
  the Series' `Template` instances (tool, voice, model).

A video script never carries voice or model configuration inline. It references a
Template instance through the `template::` reference Field:

```
template:: [[Series :: narrator-en]]
```

Field names and allowed values are read from the blueprint at run time; they are
never restated here as prose.

## Tone and sound-tag rules live once

Series-wide rules (tone, sound-tag conventions) live once in the Series blueprint
and its L3 Template-data document. Per-element instructions MUST NOT duplicate
them; if every scene in a series should share a tone, that tone lives in the
Series blueprint, not copy-pasted into each Scene.

## Why validation runs before the engine

Author-fillable content is modeled as native blueprint Fields, not text markers.
An undefined or empty required Field is rejected by `video-script` blueprint
validation (the engine's pre-compile guard) before the engine emits any manifest.
There is no separate placeholder gate.
