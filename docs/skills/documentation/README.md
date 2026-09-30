---
title: "cogNNitive — Documentation"
description: "Technical documentation for the cogNNitive skills ecosystem"
html_url: https://cognnitive.com/skills/documentation/
generator: https://cognnitive.com/skills/nn-design-presets
---

# cogNNitive — Documentation

**cogNNitive** is a **skills** ecosystem for AI agents. Each skill is an autonomous module that teaches the agent to solve a specific type of task with domain knowledge.

## Canonical Skills Catalog

The cogNNitive ecosystem provides the following specialized, autonomous agent skills, derived from [`manifest/source.yaml`](https://github.com/cogNNitive/cogNNitive/blob/main/manifest/source.yaml):

<!-- generated:skills-catalog (source: manifest/source.yaml; run node scripts/generate-docs-facts.mjs) -->
**9** skills

| Skill | Version | Description |
|-------|---------|-------------|
| [`nn-start`](skills/nn-start.md) | `V_3-4-2` | Central system governance, setup, environment readiness gate (Preflight), and start router. |
| [`nn-trannsform`](skills/nn-trannsform.md) | `V_3-4-2` | Ingest documents (PDF, DOCX, XLSX), transform using blueprints, and execute multi-step procedures (procedures_V_0-1-0_NN.md). |
| [`nn-innfo`](skills/nn-innfo.md) | `V_0-5-4` | Author, edit, and validate iNNfo knowledge with built-in step-by-step Model Creation Wizard. |
| [`nn-preflight`](skills/nn-preflight.md) | `V_0-2-1` | Environment readiness gate (Tier 1/Tier 2/Tier 3) and canonical skill-location reference. |
| [`nn-upgrade`](skills/nn-upgrade.md) | `V_0-2-0` | Guided, consent-gated migration of a domaiNN to the latest adopted iNNfo Level-2 blueprints. |
| [`nn-site-generator`](skills/nn-site-generator.md) | `V_0-2-0` | Create or edit websites, add analytics, add contact forms. |
| [`nn-design-presets`](skills/nn-design-presets.md) | `V_1-3-0` | cogNNitive visual design presets — palettes, typography, spacing. |
| [`nn-skills-lifecycle`](skills/nn-skills-lifecycle.md) | `V_1-2-0` | Audit, update, and maintain cogNNitive skills. |
| [`nn-video-script`](skills/nn-video-script.md) | `V_0-2-0` | Author, gate, and finalize cogNNitive-video (VUS) video scripts, asset pipeline, and thumbnails inside iNNfo Series. |
<!-- /generated:skills-catalog -->

## Installation

For full install steps across every supported AI coding agent (Claude Code, Cursor, Google Antigravity, Codex, and OpenCode Desktop — recommended), see the [canonical install guide](https://cognnitive.com/innfo/documentation/#/installing-ai-agents).

Skills that declare `mcp[]` register the MCP server at install time. Skills that declare `templates:` resolve versioned iNNfo template packages through `innfo-mcp`'s four-tier lookup (workspace package directory, workspace flat fallback, global user cache, installed skills directory).

## Sample Workflows

Ready-to-run transformation recipes on the [landing page](/):

| Sample | What it does |
|--------|-------------|
| [Paper to YouTube Script](/samples/paper-to-youtube/) | Convert a scientific PDF into a YouTube video script |
| [Meeting Notes to Executive Summary](/samples/meeting-to-summary/) | Transform a video transcript into a structured summary with decisions and action items |

Each sample includes a downloadable input, step-by-step instructions, and an output preview.

---

## Philosophy

- **CONCEPTS > CODE**: understand the foundation before writing a line
- **Atomic skills**: each skill solves one specific problem without coupling to others
- **Declarative skills**: each skill defines triggers and behavior in clear frontmatter
- **Bilingual**: frontmatter in English for the system, interaction in Rioplatense Spanish with the user

## Tech Stack

- **Runtime**: AI agent (OpenCode, Claude Code, Gemini, Cursor, or any compatible agent)
- **Persistent memory**: Engram
- **Primary OS**: Windows (NTFS junctions for installation)
- **Documentation**: Docsify + this site
