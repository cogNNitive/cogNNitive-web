---
spec_version: "V_0-2-1"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/documentation/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md"
title: "Documentation Specification App"
template_version: "V_0-2-1"
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
procedures:
  - id: "generate-docsify-suite"
    name: "Generate Docsify Suite"
    path: "procedures/generate_docsify_suite_NN.md"
assets:
  - id: "docs-portal-layout"
    name: "Documentation Portal HTML Layout"
    path: "assets/docs_portal_console.html"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[DocSite]]
* [[Section]]
* [[Page]]
* [[NavbarItem]]
* [[Asset]]

# NN Concept Definition

## NN Concept Definition: DocSite
icon:: book-open
type:: text
color:: purple
weight:: 100

## NN Concept Definition: Section
icon:: folder
type:: category
color:: blue
weight:: 80

## NN Concept Definition: Page
icon:: file-text
type:: text
color:: green
weight:: 60

## NN Concept Definition: NavbarItem
icon:: compass
type:: text
color:: teal
weight:: 50

## NN Concept Definition: Asset
icon:: paperclip
type:: list
color:: grey
weight:: 40

# NN Field Definition

## NN Field Definition: title
concept:: Page
type:: string
description:: Display title of the page for navigation and headings.

## NN Field Definition: source
concept:: Page
type:: markdown_file
description:: Workspace-relative path to the markdown content file.

## NN Field Definition: route
concept:: Page
type:: string
description:: Routing path or slug used by Docsify or static site generator.

## NN Field Definition: order
concept:: Page
type:: string
description:: Numeric sequence or key used to sort navigation entries.

## NN Field Definition: description
concept:: Page
type:: string
description:: Summary or SEO description for the page.

## NN Field Definition: parent
concept:: Page
type:: reference
target_concepts:: [DocSite, Section]
description:: Owning Section, or the DocSite itself for a top-level page.

## NN Field Definition: tags
concept:: Page
type:: string
description:: Freeform tags or classifications for categorization and AI routing.

## NN Field Definition: section_order
concept:: Section
type:: string
description:: Sorting sequence for sections in the sidebar.

## NN Field Definition: parent
concept:: Section
type:: reference
target_concepts:: [DocSite]
description:: The DocSite this section belongs to.

## NN Field Definition: label
concept:: NavbarItem
type:: string
description:: Display text or markdown label shown in the top navigation bar.

## NN Field Definition: url
concept:: NavbarItem
type:: string
description:: Target URL or internal route for the navbar item.

## NN Field Definition: order
concept:: NavbarItem
type:: string
description:: Sorting sequence for navbar items from left to right.

## NN Field Definition: parent
concept:: NavbarItem
type:: reference
target_concepts:: [DocSite, NavbarItem]
description:: Owning DocSite for top-level navbar items, or parent NavbarItem for dropdowns.

## NN Field Definition: site_title
concept:: DocSite
type:: string
description:: Global brand name or title for the documentation site.

## NN Field Definition: site_description
concept:: DocSite
type:: string
description:: Short summary of the documentation site's purpose and scope.

## NN Field Definition: base_path
concept:: DocSite
type:: string
description:: Base URL prefix or workspace directory where documentation lives.

## NN Field Definition: site_logo
concept:: DocSite
type:: string
description:: Relative path or URL to site logo image.

## NN Field Definition: repo_url
concept:: DocSite
type:: string
description:: Target URL to public source code repository.

## NN Field Definition: nav_enabled
concept:: DocSite
type:: select
options:: [true, false]
description:: Flag indicating whether top navbar rendering is enabled.

## NN Field Definition: asset_path
concept:: Asset
type:: file
description:: Relative path to static media, image, or attached document.

## NN Field Definition: type
concept:: Asset
type:: select
options:: [image, diagram, file, config]
description:: Functional classification of the static asset.

# Documentation Specification Template

## A level-2 template for technical documentation sites and Docsify workspaces

## Philosophy

A documentation model is an architectural map of knowledge assets, not a container for raw markdown prose. Clean markdown files hold the authoritative text; the documentation model governs site hierarchy, sections, ordering, navigation paths, header menus, and asset linkages.

By decoupling the semantic taxonomy from the markdown content, documentation sites can be deterministically compiled, linted for broken links, and rendered by lightweight client-side SPAs (such as Docsify) or static site generators, while also producing machine-readable indexes (`llms.txt`, `ai-index.yaml`) for AI agents.

## Objectives

- Provide a canonical level-2 template for structuring technical documentation workspaces.
- Model pages with first-class `markdown_file` references.
- Model top navigation headers (`NavbarItem`) and site configurations.
- Enable deterministic generation of the complete Docsify publication suite (`_sidebar.md`, `_navbar.md`, `llms.txt`, `ai-index.yaml`).
- Eliminate dead links and orphaned markdown files by validating model paths against the filesystem.

# Concept Guidance Documentation

## DocSite

### Summary
The root container of a documentation model. Exactly one DocSite per model, holding site identity, metadata, and configuration.

### Description
A DocSite is the single top-level element of a documentation model. It declares the site brand (`site_title`), a short summary of what the site covers (`site_description`), and the workspace directory or URL prefix its pages resolve against (`base_path`). It also configures optional header navigation flags (`nav_enabled`), repository links (`repo_url`), and logo branding (`site_logo`). Every Section and top-level NavbarItem attaches to the DocSite.

## Section

### Summary
A named grouping of pages in the sidebar — the middle level of the hierarchy, between the DocSite and individual Pages.

### Description
A Section groups related Pages under a common heading in the generated navigation (`_sidebar.md`). Its `parent` points to the owning DocSite, and `section_order` fixes where it appears relative to sibling sections. Sections carry no prose of their own; they exist to give the reader a scannable table of contents.

## Page

### Summary
A single documentation page backed by one markdown file — the leaf of the hierarchy and the only concept that maps to authored prose on disk.

### Description
A Page couples a navigation entry to a markdown content file. `source` is the workspace-relative path to that file (`type:: markdown_file`), `route` is the slug the site generator publishes it under, `title` is the label shown in the sidebar and page heading, `order` positions it among sibling pages, and `description` supplies a summary for search and previews. `tags` enables categorization and AI agent discovery.

## NavbarItem

### Summary
A header navigation link or dropdown menu item displayed in the top bar (`_navbar.md`).

### Description
A NavbarItem represents a link or dropdown menu item in the documentation header. `label` defines the anchor text (with emoji or badge support), `url` defines the destination link (external URL or site route), `order` dictates left-to-right display order, and `parent` references the DocSite (for top-level entries) or another NavbarItem (for nested dropdown menus).

## Asset

### Summary
A static media file — image, diagram, or downloadable attachment — that pages reference but that is not itself a navigation entry.

### Description
An Asset records a binary or non-markdown resource that documentation pages link to, such as an architecture diagram, screenshot, PDF, or logo. `asset_path` is the relative path to the file, and `type` classifies its functional role.
