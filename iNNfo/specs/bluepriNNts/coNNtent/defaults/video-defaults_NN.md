---
level: 3
parent_spec:
  name: "coNNtent_V_0-15-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Video Defaults"
---

# NN index

* [[Video Defaults]]

# NN Video Defaults

## NN Video Defaults: Defaults

slug:: defaults
voice_model:: minimax/speech-2.8-hd
background_audio_volume:: 0.2
transition:: none
fit:: [native=cover, mismatch=blur]
frame:: neutral
output_formats:: [1920x1080, 1080x1920, 1080x1080]
review_gates:: [script, preview]
captions:: off
thumbnail_formats:: [2560x1440, 1080x1920]
components:: [title=title, lower-third=lower-third, caption=caption, quote=quote, watermark=watermark, b-roll=b-roll]

The blueprint-level `Video Defaults`: every cascade parameter's baseline value, shipped in
the bluepriNNt package. A domain adopts it by copying this document to its root as
`video-defaults_NN.md` and tuning the copy. It declares no `budget` and no `language`: an
unset budget always asks at the budget gate, and an unset language is a validation error.

It pins no vendor model either: `image_model` (the model of every generated image Layer,
including the still of an `avatar` Layer) and `avatar_model` (the lip-sync clip of an
`avatar` Layer) are the domain's plug point. A domain
declares them in its own `video-defaults_NN.md` copy as `image_model:: <api_id>` and
`avatar_model:: <api_id>`, each naming a Model of the merged catalog (the shipped reference
catalog lists the available ones); a Series, Character, Preset, Scene or Layer may override
them. A generated image or an avatar job whose model resolves nowhere is refused before any
spend.
