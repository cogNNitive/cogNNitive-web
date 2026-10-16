# Usage Guide

## Creating an iNNfo Model

An iNNfo model is a single Markdown file (`_NN.md`) with YAML frontmatter following the spec chain conventions.

```markdown
---
spec_version: "V_0-2-0"
level: 3
parent_spec:
  name: "business_V_0-2-1"
knowledge_version: "V_0-1-0"
title: "My Model"
---

# My Model

_NN Strategy

* _NN Strategy: Core Objective
  * type: text
  * value: "Build the next generation of..."

_NN Metrics

* _NN Metrics: KPI
  * type: text
  * value: "Monthly active users"
```

## Apps

Level 2 apps declare the concepts, markers, and relationship types available to a model:

- **business** — business strategy modeling
- **procedures** — workflows, SOPs, processes
- **organization** — organizational structure modeling

## Working with the ecosystem

1. Create or open a workspace folder and let your AI agent author the models through [innfo-mcp](innfo-mcp).
2. Generate the domain console (`domaiNN_console.html`) with `export-console.mjs` or the MCP `regenerate_console` tool and open it in a browser; see [offline consoles](offline-consoles).
3. Validation runs on every write through [innfo-mcp](innfo-mcp) (`validate_model`).
4. Reviewers send feedback as changesets; see the [reviewer guide](reviewer-guide).
5. Change models through the agent or a changeset, not by hand; see [editing models by hand](manual-editing-risks).

## Generating the console

```bash
# From the iNNfo repo root
node scripts/export-console.mjs <workspaceRoot> --domain
```

The command writes `domaiNN_console.html` at the domain root; open it in a browser.
