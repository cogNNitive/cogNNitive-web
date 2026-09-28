---
title: About — iNNfo
description: Learn about iNNfo, the hub for the iNNfo ecosystem — the iNNfo Modeler, innfo-core, innfo-mcp, and the spec chain.
html_url: https://cognnitive.com/innfo/about
generator: https://cognnitive.com/skills/nn-design-presets
---

# About iNNfo

The monorepo that ties the iNNfo ecosystem together.

## Architecture

iNNfo is organized as an npm workspaces monorepo — one editor app, two shared
packages, and the spec chain:

iNNfo/

├── apps/

│ └── innfo-editor/ // Vue 3 workspace editor — the iNNfo Modeler

├── packages/

│ ├── innfo-core/ // TS parser, resolver, validator

│ └── innfo-mcp/ // MCP server for AI agents

├── specs/ // defiNNe, iNNfo, templates, samples

└── docs/ // This website

## App

@cognnitive/innfo-editor v0.1.0

### iNNfo Modeler

A Vue 3 workspace editor with Pinia state management and Vue Router. Uses the File
System Access API to open a workspace folder, runs a single recursive parse pass into
one normalized model graph, and edits nodes through block sheets, a table view, and
metamodel-driven forms. Validation runs automatically on every parse; a graph viewer,
matrix grids, and an AI-guidance sidebar round out the workspace. Directory handles
persist in IndexedDB for a fast reopen.

## Packages

@cognnitive/innfo-core v0.1.0

### innfo-core

Framework-agnostic TypeScript library: the iNNfo parser, model types (Concept,
Element, Field, Marker, Matrix, Relationship), IO drivers for the browser and Node, a
validator against template schemas, and a parent-spec-chain resolver. Both the Modeler
and the MCP server run on top of it.

@cognnitive/innfo-mcp v0.1.0

### innfo-mcp

A Model Context Protocol server (stdio) wrapping innfo-core. It exposes a focused set
of semantic tools so any MCP-capable AI agent can read, validate, and
safely mutate iNNfo models. Spec and template resolution follow the model's parent
chain, with no hardcoded URLs. See the
[full tool reference](/innfo/documentation/#/innfo-mcp) for the current list.

## Specifications

The ecosystem defines four specification levels, each building on the previous:

Level 0

### defiNNe

Meta-specification: structure, SemVer, RFC 2119. The root of the chain.

Level 1

### iNNfo

The central specification. A single-file `_NN.md` model with YAML
frontmatter, concepts, elements, markers, and relationships.

Level 2

### Templates

business, procedures, organization — each declares concepts, markers, and
relationship types on top of iNNfo.

Level 3

### Models

Concrete instances like Ghostbusters or Engineering Team. Lightweight — just data
and a parent pointer.

## Open Knowledge Format compatibility

The iNNfo specification is **100% compatible** with
[OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
(Open Knowledge Format) by Google Cloud Platform. Every iNNfo document is a valid OKF
knowledge bundle.

### Shared substrate

Both formats use Markdown files with YAML frontmatter as their core representation.
No proprietary tooling, no centralized schema registry — just text files in version
control. OKF's "if you can `cat` a file, you can read OKF" applies equally
to iNNfo.

### Conformance met

OKF v0.1 conformance (§9) requires: (1) parseable YAML frontmatter on every
non-reserved `.md` file, (2) a non-empty `type` field, (3)
reserved filenames follow OKF conventions. iNNfo satisfies all three: every
`_NN.md` has frontmatter, the `level`+template system provides
type semantics, and `index.md` follows the same progressive-disclosure
pattern.

### Extensions tolerated

OKF explicitly states consumers MUST NOT reject bundles because of unknown
additional frontmatter keys, unknown `type` values, or missing optional
fields. iNNfo's richer frontmatter — `spec_version`, `level`,
`parent`, `concepts`, `markers`,
`matrices` — is fully tolerated by OKF consumers.

### A workspace = an OKF Bundle

An iNNfo workspace produces exactly the directory-of-Markdown-files structure that
OKF defines as a *knowledge bundle* (§3). Each `_NN.md` maps to an
OKF *concept document* (§4) with `index.md` as the directory
listing (§6). Wikilinks and standard Markdown links coexist for cross-linking.

## Get in Touch

Contributions, questions, ideas — we're always open.

[Contact Us](https://cognnitive.com/contact)
https://cognnitive.com/contact
