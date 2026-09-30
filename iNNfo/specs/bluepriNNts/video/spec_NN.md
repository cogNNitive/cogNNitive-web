---
spec_version: "V_0-3-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/video/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-3-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"
blueprint_version: "V_0-6-0"
title: "Video App"
procedures:
  - id: "generate-video-script"
    name: "Generate Video Script"
    path: "procedures/generate_video_script_NN.md"
  - id: "publish-web-portal"
    name: "Publish Video Web Portal"
    path: "procedures/publish_web_portal_NN.md"
  - id: "setup-github-pages-repo"
    name: "Setup GitHub Pages Repo"
    path: "procedures/setup_github_pages_repo_NN.md"
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

# NN Concept Definition

## NN Concept Definition: Video
icon:: video
type:: category
color:: blue
weight:: 100

# NN Field Definition

## NN Field Definition: title
concept:: Video
type:: string
description:: Title of the video.

## NN Field Definition: description
concept:: Video
type:: markdown_inline
description:: Short description of the video scope.

## NN Field Definition: script
concept:: Video
type:: file
description:: The cogNNitive Video script, stored in the video's own folder.

## NN Field Definition: thumbnail
concept:: Video
type:: image
description:: Cover image of the video.

## NN Field Definition: voiceover
concept:: Video
type:: audio
description:: Master voiceover track of the video.

## NN Field Definition: master
concept:: Video
type:: video
description:: Rendered video file of the video.

## NN Field Definition: status
concept:: Video
type:: select
options:: [draft, scripting, rendering, published, archived]
description:: Production state of the video.

## NN Field Definition: youtube_url
concept:: Video
type:: string
description:: Public YouTube URL of the uploaded video (optional).

## NN Field Definition: preset
concept:: Video
type:: string
description:: Design preset reference (e.g. [[Ghostbusters Tech Noir]], [[morado-nazareno]]) for typography and illustration style.

# Video App

## A minimal schema for one video: its metadata, its own media folder, and traceability to its sources

## Philosophy

The Video App models one video as a single Element that owns its own media folder. The script is a **generated artifact** authored in cogNNitive Video syntax (scenes `@`, layers `@@`, `layer_type`, `scene_templates`, `scene_tts_model`, overlays, transitions) and compiled by the [`skills/nn-video-script`](https://github.com/cogNNitive/cogNNitive/tree/main/skills/nn-video-script) skill into Remotion Composition Manifests — it is not re-modelled as iNNfo data. The Element records where its files live and which sources it derives from (`sources::`), so the model never re-encodes structure the video engine already expresses.

## Production Hierarchy: Workspace → Subject → Series → Video

A video is produced by combining exactly one **Subject** with exactly one **Series**:

- **Workspace** — the iNNfo workspace root. Its own `assets/` folder holds files shared across every Series, never referenced directly from a script (stage them into a Series' `shared/` folder first, as a copy).
- **Subject** — the content: facts and sources. Subject stays **workspace-custom** — this template does not ship a cogNNitive-owned Subject template (a workspace models it however fits its domain, e.g. bespoke historical-innovation or product templates). A Video references its Subject generically through the reserved `sources::` property (see Reserved Properties below), never through a new Field, so no particular Subject shape is required.
- **Series** — the production format: one procedure that extends `generate_video_script_NN.md`, one script template (`script_template.md`), a series-wide rules document (`series_rules.md`), and shared series assets. A Series is **not a new template** — it **reuses this very `video` template** as a Level-3 model (`<SeriesName>_V_x-y-z_video_NN.md`) whose frontmatter carries a `series:` block (at minimum: slug, the procedure it extends, the script-template path, and the shared-assets folder) and which contains that Series' own Video Elements as children. Because a Video Element lives inside exactly one Series model file, a Video belongs to exactly one Series by construction — no separate registry mechanism is needed.
- **Video** — combines exactly one Subject with exactly one Series. Subject and Series vary independently: the same Subject may be produced again under a different Series without any coupling to the first.

A standalone Video with no Series (as in the Ghostbusters sample) remains valid: it simply has no `series:` block on its model, and its folder resolution follows the unchanged rule below.

## The video folder

Every file-backed field of a video resolves to one folder named after the video Element, relative to wherever that Element's own model file lives (`{modelDir}`) — **this rule is unchanged**:

```
{modelDir}/assets/{video-slug}/{filename}
```

For a standalone Video (no Series), `{modelDir}` is wherever that model file lives in the workspace, exactly as before. For a Video that is part of a Series, the Series' own model file is what lives at `series/{series-slug}/`, so `{modelDir}` resolves there and the same rule yields:

```
series/{series-slug}/assets/{video-slug}/{filename}
```

The field values are **bare filenames** — they do not repeat the folder, because the folder already identifies the video. So `script:: script.md` on the Element `Recruitment Spot` (slug `recruitment-spot`), owned by Series `interviews`, resolves to:

```
series/interviews/assets/recruitment-spot/script.md
```

Renaming the Element renames its folder with it. One video, one folder, all of its media, script, and planning files inside. During production, the folder also hosts the asset generation and cost plan (`asset_plan.md`) preceding media rendering.

### Folder contract (D4)

Assets are scoped at exactly three levels — workspace, series, video — matching the three folder levels above. A script's asset paths **MUST NOT resolve above its own Series folder**: `../../shared/x.mp4` (staying inside the Series) is allowed; a path that climbs out to another Series or the workspace root (e.g. `../../../../assets/x.mp4`) is rejected. `http(s)://` references are allowed; `file://`, absolute paths, and `asset://` are rejected outright. `skills/nn-video-script`'s `check-script.mjs` enforces this mechanically as part of script validation — see the procedure below.

`renders/<ref>/` and `.cognnitive/cache/video/`, wherever they appear inside a video or series folder, are engine output and cache stores: gitignored, and never treated as iNNfo Artifacts or scanned as knowledge inputs. The generic procedure's finalize step promotes the files a video actually keeps (`master`, `thumbnail`, `voiceover`) out of `renders/<ref>/` into the video's own folder; nothing in `renders/` or cache directories is directly referenced by a Video Element's fields once finalize has run.

## Remotion Scene Engine Architecture

The cogNNitive Video Engine compiles scripts into typed Remotion Composition Manifests consisting of:
- **Scene Tracks**: Ordered sequence tracks supporting `chapter_title`, `image_motion`, `kinetic_text`, `concept_diagram`, and `split_screen` types with frame math ($\text{frames} = \lceil\text{durationInSeconds} \times \text{FPS}\rceil$).
- **Audio Bindings**: Precise TTS voiceover track synchronization probed to prevent audio clipping.
- **Visual Overlays**: Frame-timed `lowerThird`, `kineticTitle`, and `conceptCallout` overlays.
- **Headless CLI**: Headless Remotion rendering and preview server execution via `video-engine-cli.mjs`.

## Objectives

- Provide a valid Level 2 template usable as `parent_spec` for video models, reusable as the Level-3 Series registry itself (AD1).
- Model one video per Element: `title`, `description`, `status`, and its media fields.
- Plan and estimate media generation costs via `asset_plan.md` before executing generation/renders.
- Keep every file of a video inside that video's own folder, scoped inside its Series when one applies.
- Keep traceability to input documents, and to the Video's own Subject, through the reserved `sources::` property.
- Support programmatic compilation, asset synthesis caching, and Remotion rendering via cogNNitive Video Engine.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Video** | `category` | One video, its metadata, and its media folder |

### Fields

| Concept | Field | Type | Purpose |
|---|---|---|---|
| Video | `title` | string | Video title |
| Video | `description` | markdown_inline | Scope description |
| Video | `script` | file | cogNNitive Video script (`assets/{slug}/`) |
| Video | `thumbnail` | image | Cover image (`assets/{slug}/`) |
| Video | `voiceover` | audio | Master voiceover track (`assets/{slug}/`) |
| Video | `master` | video | Rendered video file (`assets/{slug}/`) |
| Video | `status` | select | draft / scripting / rendering / published / archived |
| Video | `youtube_url` | string | Public YouTube URL (optional) |
| Video | `preset` | string | Design preset reference (optional) |

Each file-backed field holds exactly one filename. A video that needs several images or several voice clips keeps them in its folder as attachments.

### Reserved Properties

`sources::` is an optional reserved property of the iNNfo meta-template used on an Element to cite the source documents the video derives from. It requires no Field Definition and is written as a bracketed list of `sources/nn/<file>#<heading-slug>`.

When a Video is part of the Workspace → Subject → Series → Video hierarchy, `sources::` is also the channel a Video uses to bind its Subject: its first entry is `models/<file>_NN.md#<element-slug>`, pointing at exactly one Subject Element, optionally followed by further `sources/nn/...` citation anchors. This reuses the existing reserved property rather than freezing a new Field onto the Video concept.

### Relationship Types

| Type | Enabled | Representation |
|---|---|---|
| Hierarchy | ✅ | index block (wikilinks) |
| Evaluable matrix | ❌ | Not applicable — pipeline structure lives in video engine |
| Graph edge | ❌ | Not applicable |
| Sequence | ❌ | Not applicable |

# Concept Guidance Documentation

## Video

### Summary

One video: its title, description, status, and optional `youtube_url`, plus the file-backed fields `script`, `thumbnail`, `voiceover`, and `master`, all stored in the video's own folder.

### Description

The `Video` concept is the only concept of this template. One `## NN Video: <name>` Element models one video. Its `title`, `description`, and `status` describe the video; its file-backed fields (`script`, `thumbnail`, `voiceover`, `master`) point at files inside `assets/{video-slug}/` using bare filenames, resolved under the owning model's own `{modelDir}` — a standalone location for a video with no Series, or `series/{series-slug}/` when the Video belongs to a Series (a model file that reuses this same template at Level 3, per AD1). Traceability to input material, and to the Video's own Subject, is expressed with the reserved `sources::` property rather than with a separate `Source` concept or a new Field.

### Methodologies

- One `Video` Element per video, kept as the single entry point of the model.
- Treat the script as an external artifact: point at it with `script`, never inline it. Author, gate, and finalize it with `skills/nn-video-script`.
- Keep all of a video's media in its own folder; never scatter files across the workspace, and never let a script's asset paths climb above their own Series folder (D4).
- Keep `sources::` as the single traceability channel back to normalized sources, and — for a Video that is part of the Subject/Series hierarchy — as the same channel that binds its one Subject Element.
- When grouping videos into a Series, reuse this template as the Series' own Level-3 model (a `series:` frontmatter block on a model that itself contains the Series' Video Elements) instead of inventing a separate registry format.

### Prompts

- "Create a `Video` named `<title>` describing `<scope>`."
- "Set `script` of `<video>` to `script.md` and status to `published`."
- "Which sources does `<video>` derive from?"
- "Create a Series `<name>` reusing the video template, with a `script_template.md` and `series_rules.md`."
- "Bind `<video>` to Subject `<subject-element>` and Series `<series-name>`."
