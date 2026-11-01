# Series Preset Convention

Defines how a Series carries its reusable configuration: a Series is a Level-2
blueprint (schema) plus a Level-3 scope document whose `Preset` elements carry the
reusable cascade parameters. This file is the authoring-facing "how", not a
restatement of the spec; the normative requirements live in capability
`video-presets` and in `video-series-folders`.

## Series = blueprint + scope document + Presets

A Series ships these artifacts:

- A **blueprint** under `iNNfo/specs/bluepriNNts/<series>/spec_NN.md` that
  `includes: [video-script]` and adds only series-specific fields (for example
  series `tone` and `sound_tags`).
- A **scope document** `<s>_scope_NN.md` with frontmatter `scope: true`. It is the
  only file that anchors the Series, and its Fields supply the `series` level of
  the parameter cascade.
- Optional **`Preset` elements** in that same document, after its `Series` section.
  A Preset is a named bundle of cascade parameters with no fields of its own and no
  Layers.

A script references Presets by bare name in an ordered list:

```
presets:: [Lucas, Studio Warm]
```

The script never carries provider configuration inline by default: voice ids, model
ids and delivery settings SHOULD live in a Preset or in a scope document, and a
script MAY override any of them with the cascade Field of the same name. Field
names and allowed values are read from the blueprint at run time; they are never
restated here as prose.

## The list is ordered and additive

Within one level the **last Preset of the list wins**, and an element's own explicit
fields always beat its Presets. Across levels the lists are **additive**: each
level's list sits directly under that level's explicit fields, outer levels first,
so a nearer level always wins. A Preset that omits a parameter does not reset it.

Lookup is one order for every reference: the script, then the Series chain from the
innermost to the outermost scope document, then the domain
`video-defaults_NN.md`. A deeper definition shadows an outer one with the same name.

## Tone and sound-tag rules live once

Series-wide rules (tone, sound-tag conventions) live once in the Series blueprint
and its scope document. Per-element instructions MUST NOT duplicate them; if every
scene in a series should share a tone, that tone lives in the scope document, not
copy-pasted into each Scene.

## Why validation runs before the engine

Author-fillable content is modeled as native blueprint Fields, not text markers. An
undefined or empty required Field, an unknown Preset name, a wiki-link inside a
`presets` list or a non-parameter key inside a Preset is rejected by the pre-compile
guard before the engine emits any manifest or spends anything. There is no separate
placeholder gate.

## Version boundary

The Preset mechanism replaced the retired `Template` concept in blueprint `V_0-14-0`.
A document written for an earlier version is rejected; it is not converted, and this
skill ships no migration tool. An episode produced with an earlier version is
re-produced only with that version's blueprint.
