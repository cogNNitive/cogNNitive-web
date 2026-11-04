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
voice:: default
voice_model:: minimax/speech-2.8-hd
image_model:: wavespeed-ai/z-image/turbo
image_size:: 1024x1024
avatar_model:: wavespeed-ai/infinitetalk-fast
background_audio_volume:: 0.2
transition:: none
fit:: cover
frame:: neutral
output_formats:: [1920x1920, 1080x1920, 1920x1080, 1080x1080]
script_review:: required
components:: [title=title, lower-third=lower-third, caption=caption, quote=quote, watermark=watermark, b-roll=b-roll]

The blueprint-level `Video Defaults`: every cascade parameter's baseline value, shipped in
the bluepriNNt package. A domain adopts it by copying this document to its root as
`video-defaults_NN.md` and tuning the copy. It declares no `budget` and no `language`: an
unset budget always asks at the budget gate, and an unset language is a validation error.
