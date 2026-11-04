---
level: 3
parent_spec:
  name: "coNNtent_V_0-15-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Model Catalog"
---

# NN index

* [[Provider]]
* [[Model]]
* [[Voice]]

# NN Provider

## NN Provider: WaveSpeed
slug:: wavespeed
name:: WaveSpeed
api_base:: https://api.wavespeed.ai

## NN Provider: Replicate
slug:: replicate
name:: Replicate
api_base:: https://api.replicate.com

## NN Provider: Local
slug:: local
name:: Local
api_base:: file://local

# NN Model

## NN Model: minimax-speech-2-8-hd
slug:: minimax-speech-2-8-hd
provider:: wavespeed
api_id:: minimax/speech-2.8-hd
capability:: tts
controls:: [speed, emotion]
adapter:: minimax-speech
price:: 0.02
price_unit:: per_1k_chars
price_date:: 2026-11-02
status:: active

## NN Model: minimax-speech-2-8-turbo
slug:: minimax-speech-2-8-turbo
provider:: wavespeed
api_id:: minimax/speech-2.8-turbo
capability:: tts
controls:: [speed, emotion]
adapter:: minimax-speech
price:: 0.015
price_unit:: per_1k_chars
price_date:: 2026-11-02
status:: active

## NN Model: infinitetalk-fast
slug:: infinitetalk-fast
provider:: wavespeed
api_id:: wavespeed-ai/infinitetalk-fast
capability:: avatar
controls:: [resolution]
adapter:: infinitetalk
price:: 0.015
price_unit:: per_second
price_date:: 2026-11-02
status:: active

## NN Model: z-image-turbo
slug:: z-image-turbo
provider:: wavespeed
api_id:: wavespeed-ai/z-image/turbo
capability:: image
controls:: [size]
sizes:: [1024x1024]
adapter:: wavespeed-image
price:: 0.005
price_unit:: per_image
price_date:: 2026-11-02
status:: active

## NN Model: flux-schnell
slug:: flux-schnell
provider:: replicate
api_id:: black-forest-labs/flux-schnell
capability:: image
controls:: [size]
sizes:: [1024x1024]
adapter:: replicate-image
price:: 0.003
price_unit:: per_image
price_date:: 2026-11-02
status:: active

## NN Model: luma-uni-v1-text-to-image
slug:: luma-uni-v1-text-to-image
provider:: wavespeed
api_id:: luma/uni-v1/text-to-image
capability:: image
controls:: [size]
sizes:: [1024x1024]
adapter:: wavespeed-image
price:: 0.043
price_unit:: per_image
price_date:: 2026-11-02
status:: active

## NN Model: flux-3-text-to-image
slug:: flux-3-text-to-image
provider:: wavespeed
api_id:: black-forest-labs/flux-3/text-to-image
capability:: image
controls:: [size]
sizes:: [1024x1024]
adapter:: wavespeed-image
price:: 0.05
price_unit:: per_image
price_date:: 2026-11-02
status:: active

## NN Model: minimax-h3-image-edit
slug:: minimax-h3-image-edit
provider:: wavespeed
api_id:: wavespeed-ai/minimax-h3/image-edit
capability:: image
controls:: [size]
sizes:: [1024x1024]
adapter:: wavespeed-image
price:: 0.035
price_unit:: per_image
price_date:: 2026-11-02
status:: active

# NN Voice

## NN Voice: friendly-person
slug:: friendly-person
model:: minimax-speech-2-8-hd
voice_id:: Friendly_Person
language:: en

## NN Voice: deep-voice-man
slug:: deep-voice-man
model:: minimax-speech-2-8-hd
voice_id:: Deep_Voice_Man
language:: en

The dated reference catalog shipped by the `coNNtent` bluepriNNt. The prices are the ones
the engine carried in code before V_0-15-0, recorded here on 2026-11-02 as the observation
date; a domaiNN SHOULD replace them with invoice values in its `model-catalog_NN.md` overlay.
`infinitetalk` is an active, allowed avatar model. A model the domaiNN does not allow is
refused before spend.
