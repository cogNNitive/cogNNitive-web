---
level: 3
parent_spec:
  name: "video-script_V_0-14-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Video Defaults"
---

# NN index

* [[Video Defaults]]

# NN Video Defaults

## NN Video Defaults: Defaults

slug:: defaults
master_resolution:: 1920x1920
voice:: default
voice_model:: minimax/speech-2.8-hd
image_model:: wavespeed-ai/z-image/turbo
avatar_model:: wavespeed-ai/infinitetalk-fast
background_audio_volume:: 0.2
transition:: none
fit:: cover
frame:: neutral
components:: [title=title, lower-third=lower-third, caption=caption, quote=quote, watermark=watermark, b-roll=b-roll]
sounds:: [scene-boundary=whoosh]

The blueprint-level `Video Defaults`: every cascade parameter's baseline value,
shipped in the bluepriNNt package. A domain adopts it by copying this document to
its root as `video-defaults_NN.md` and tuning the copy.
