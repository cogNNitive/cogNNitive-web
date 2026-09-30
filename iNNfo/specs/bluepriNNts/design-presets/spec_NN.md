---
spec_version: "V_0-3-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/design-presets/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-3-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"
title: "Design Presets App"
blueprint_version: "V_0-3-0"
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

* [[DesignPreset]]

# NN Concept Definition

## NN Concept Definition: DesignPreset
icon:: palette
type:: category
color:: purple
weight:: 100

# NN Field Definition

## NN Field Definition: name
concept:: DesignPreset
type:: string
description:: Human-readable title of the design preset.

## NN Field Definition: description
concept:: DesignPreset
type:: markdown_inline
description:: Overview of the visual aesthetic, mood, and intended use cases.

## NN Field Definition: category
concept:: DesignPreset
type:: select
options:: [web, video, illustration, unified]
description:: Primary domain of the preset (Web UI, Video Motion/Text, Generative Illustration, or Unified).

## NN Field Definition: palette
concept:: DesignPreset
type:: string
description:: Key color tokens (primary, secondary, accent, surface, background).

## NN Field Definition: typography_ui
concept:: DesignPreset
type:: string
description:: Typography stack and font families for Web and UI interfaces.

## NN Field Definition: typography_video_title
concept:: DesignPreset
type:: string
description:: Font family, weight, and styling for video title overlays in cogNNitive-video.

## NN Field Definition: typography_video_subtitle
concept:: DesignPreset
type:: string
description:: Font family and style for video subtitle and lower-third overlays.

## NN Field Definition: illustration_prompt_anchor
concept:: DesignPreset
type:: string
description:: Style tokens, art technique, and aesthetic modifiers for generative image/illustration prompts.

## NN Field Definition: illustration_negative_prompt
concept:: DesignPreset
type:: string
description:: Negative prompt modifiers to exclude conflicting aesthetic artifacts in generated images.

## NN Field Definition: sample_preview
concept:: DesignPreset
type:: image
description:: Representative preview image showcasing the preset style.

# Design Presets App

## A multi-modal design system schema for Web, Video, and Generative Illustration

## Philosophy

Visual identity should not be trapped in unstructured text guides or isolated within UI-only silos. The Design Presets App establishes a single source of truth for design tokens across the cogNNitive ecosystem. By structuring typography, color palettes, motion text tokens, and generative illustration prompt anchors into formal iNNfo data, agents and automated pipelines can query and apply visual styles deterministically across web interfaces, video overlays, and generative image rendering.

## Objectives

- Provide a standardized Level-2 template for design systems and visual presets.
- Define multi-modal tokens spanning Web UI, cogNNitive-video Video Overlays, and Generative Illustration.
- Enable direct binding from Video elements and Series via `preset:: [[PresetName]]`.
- Serve as the structured data foundation for `skills/nn-design-presets` and `skills/nn-video-script`.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **DesignPreset** | `category` | One unified visual preset with multi-modal design tokens |

### Fields

| Concept | Field | Type | Purpose |
|---|---|---|---|
| DesignPreset | `name` | string | Display name of the preset |
| DesignPreset | `description` | markdown_inline | Summary of aesthetic tone and use case |
| DesignPreset | `category` | select | web / video / illustration / unified |
| DesignPreset | `palette` | string | Hex color tokens for key roles |
| DesignPreset | `typography_ui` | string | Web / UI font families and weights |
| DesignPreset | `typography_video_title` | string | cogNNitive-video title overlay font configuration |
| DesignPreset | `typography_video_subtitle` | string | cogNNitive-video subtitle overlay font configuration |
| DesignPreset | `illustration_prompt_anchor` | string | Generative image style prompt modifiers |
| DesignPreset | `illustration_negative_prompt` | string | Generative image negative prompt tokens |
| DesignPreset | `sample_preview` | image | Preview image asset |

# Concept Guidance Documentation

## DesignPreset

### Summary

A structured record of visual identity tokens spanning Web, Video, and Generative Illustration.

### Description

Each `## NN DesignPreset: <name>` Element represents a cohesive design preset. It unifies colors (`palette`), web fonts (`typography_ui`), video overlay fonts (`typography_video_title`, `typography_video_subtitle`), and generative image prompt guidelines (`illustration_prompt_anchor`, `illustration_negative_prompt`).

### Methodologies

- Define workspace-wide presets at `models/design-presets_NN.md` or within dedicated models.
- Reference presets from `Video` elements or Series to automate asset generation prompts in `asset_plan.md`.
- Reference presets from Web generators to apply matching CSS variables and layout tokens.
