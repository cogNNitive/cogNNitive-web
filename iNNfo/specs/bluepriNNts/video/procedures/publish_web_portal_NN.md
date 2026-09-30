---
level: 3
parent_spec:
  name: "procedures"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Publish Video Web Portal Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Procedure

## NN Procedure: Publish Video Web Portal
category:: distribution
summary:: Scaffold and update a lightweight zero-build public web portal in the web/ folder with an interactive Hero, searchable/filterable video cards by tags and categories, embedded video player, and Markdown sources/notes viewer ready for GitHub Pages.
inputs_required:: Video Element with metadata, thumbnail, sources::, and optional youtube_url
outputs_expected:: Published Web Portal Artifacts
executed_by:: Video Web Publisher
procedure_model:: procedures/publish_web_portal_NN.md

# NN Work

## NN Work: Publish Video Web Portal Workflow
step_type:: task
next:: [[Scaffold Web Workspace]]
condition:: A Video Element with registered assets is ready for publication
input:: [[Video Metadata and Sources]]
output:: [[Published Web Portal Artifacts]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Orchestrate publication of the video companion page and web portal: ensure the `web/` runtime directory exists with GitHub Pages compatibility (`.nojekyll` and `index.html`), compile the video's show-notes and sources into a dedicated Markdown article under `web/content/{slug}.md`, and upsert the video entry in `web/data/videos.json`.

## NN Work: Scaffold Web Workspace
parent:: [[Publish Video Web Portal Workflow]]
step_type:: task
next:: [[Generate Video Markdown Article]]
condition:: Web portal folder is initialized or inspected
input:: [[Web Portal Template Files]]
output:: [[Scaffolded Web Workspace]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Inspect the workspace root for the `web/` directory. If it does not exist, create `web/`, `web/data/`, and `web/content/`. Ensure `web/.nojekyll` exists so GitHub Pages does not ignore underscore files. If `web/index.html` does not exist, scaffold the standalone zero-build micro-SPA (using Alpine.js, Marked.js, and Tailwind CSS CDN) and initialize `web/data/videos.json` as an empty array `[]`.

## NN Work: Generate Video Markdown Article
parent:: [[Publish Video Web Portal Workflow]]
step_type:: task
next:: [[Upsert Video Catalog Entry]]
condition:: Scaffolded web workspace is available
input:: [[Video Metadata and Sources]]
output:: [[Video Markdown Article]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Extract the Video's title, scope description, and cited sources from `sources::` (along with script highlights, voiceover model notes, and timeline beats). Compile these into a structured, readable Markdown document at `web/content/{video-slug}.md`. Include clear headings for Overview, Sources & References, Production Notes, and Credits.

## NN Work: Upsert Video Catalog Entry
parent:: [[Publish Video Web Portal Workflow]]
step_type:: task
next:: [[Verify GitHub Pages Readiness]]
condition:: Video Markdown article is generated
input:: [[Video Markdown Article]], [[Scaffolded Web Workspace]]
output:: [[Updated Video Catalog]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Read `web/data/videos.json`. Perform an upsert (matching on `id: "{video-slug}"`): populate `title`, `description`, `date` (ISO format), `category`, `tags` (extracted from Subject and Series context), `thumbnail` (path or external URL), `youtube_url` (from the Video Element's `youtube_url::` field if present, or null), and `content_file` pointing to `content/{video-slug}.md`. Format `videos.json` cleanly with 2-space indentation.

## NN Work: Verify GitHub Pages Readiness
parent:: [[Publish Video Web Portal Workflow]]
step_type:: task
condition:: Catalog and content files are updated
input:: [[Updated Video Catalog]]
output:: [[Published Web Portal Artifacts]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Verify that all relative paths in `web/data/videos.json` resolve correctly against `web/`, and that `web/.nojekyll` is present. If `web/.git` is not yet initialized or published, guide the user to execute the `Setup GitHub Pages Repo` procedure (`procedures/setup_github_pages_repo_NN.md`). If already published, commit the new content on `main` and push to remote. Provide the final public URL to be placed in the YouTube video description.

# NN Artifact

## NN Artifact: Video Metadata and Sources
type:: input
description:: The Video Element fields (`title`, `description`, `thumbnail`, `youtube_url`) and cited references in `sources::`.

## NN Artifact: Web Portal Template Files
type:: input
description:: Baseline zero-build `index.html` SPA template and `.nojekyll` configuration file.

## NN Artifact: Scaffolded Web Workspace
type:: intermediate
description:: The directory structure `web/`, `web/data/`, and `web/content/` with baseline `index.html`, `.nojekyll`, and initialized `videos.json`.

## NN Artifact: Video Markdown Article
type:: intermediate
description:: The detailed companion document `web/content/{video-slug}.md` containing full source citations, research background, and production notes.

## NN Artifact: Updated Video Catalog
type:: intermediate
description:: The `web/data/videos.json` registry containing the updated array of video card metadata.

## NN Artifact: Published Web Portal Artifacts
type:: output
description:: The complete, self-contained `web/` directory ready for GitHub Pages hosting, providing live playback, card filtering, and markdown source navigation.

# NN Tools

## NN Tools: File Editor
type:: automated
description:: Tool creating directories and writing `index.html`, `videos.json`, and `.nojekyll` files into the workspace.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent synthesizing source documents and video metadata into clear, structured Markdown articles.

# NN Roles

## NN Roles: Video Web Publisher
type:: owner
description:: Responsible for maintaining the public video portal, curating video tags and categories, and syncing YouTube URLs upon release.
