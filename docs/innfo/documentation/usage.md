# Usage Guide

## Creating an iNNfo Model

An iNNfo model is a single Markdown file (`_NN.md`) with YAML frontmatter following the spec chain conventions.

```markdown
---
spec_version: "V_0-2-0"
level: 3
parent: "business_V_1-0-0"
model_version: "V_0-1-0"
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

1. Open [innfo-editor](innfo-editor) and start from a starter app, a sample model, or an existing workspace folder.
2. Edit concepts, elements, and fields through the editor's per-node views.
3. Validation runs automatically on every parse — check the header badge or open the full validation report.
4. Use the "Use AI" button to open the AI Guide, or connect an AI agent directly via [innfo-mcp](innfo-mcp).

## Running the editor

```bash
# From the iNNfo repo root
npm install
npm run build -w @cognnitive/innfo-core
npm run dev -w @cognnitive/innfo-editor
```

Open the local dev server URL printed in the terminal.
