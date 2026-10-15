# iNNfo Documentation

Welcome to the iNNfo documentation. iNNfo is the monorepo (`@cognnitive/innfo`) that powers the cogNNitive **iNNfo** ecosystem.

## Quick Start

```bash
# Install dependencies
npm install

# Build innfo-core and the MCP server
npm run build -w @cognnitive/innfo-core
npm run build -w @cognnitive/innfo-mcp
```

## Sections

### [Offline consoles](offline-consoles)
The **domain console** — one self-contained `domaiNN_console.html` per domaiNN, generated locally. It shows the domain's kNNowledge and reviews it through changesets.

### [innfo-core](innfo-core)
`@cognnitive/innfo-core` is the framework-agnostic TypeScript library shared across the ecosystem: parser, model types, validator, IO drivers, and the spec-chain resolver.

### [innfo-mcp](innfo-mcp)
`@cognnitive/innfo-mcp` is an MCP server that exposes iNNfo models and operations to AI coding agents (Claude Code, OpenCode, and others) over stdio.

### [Ecosystem](ecosystem)
The four-level specification chain:

| Level | Name | Description |
|-------|------|-------------|
| 0 | **defiNNe** | Meta-specification: structure, SemVer, RFC 2119 |
| 1 | **iNNfo** | Central spec — single-file `_NN.md` documents |
| 2 | **Apps** | business, procedures, organization |
| 3 | **Models** | Concrete instances (Ghostbusters, Code Review Process, Engineering Team) |

### [Specifications](specifications)
Complete listing of all specs and models at every level, with links to source files.

### [Open Knowledge Format (OKF)](ecosystem?id=open-knowledge-format-compatibility)
iNNfo is **compatible** with OKF v0.1 by Google Cloud Platform. Every iNNfo document is a valid OKF knowledge bundle.

### [Usage](usage)
How to create iNNfo models, use apps, and work with the ecosystem.

### [iNNfo Agent (OpenCode)](opencode-innfo-agent)
Connect the iNNfo MCP agent to OpenCode Desktop for natural-language model editing.
