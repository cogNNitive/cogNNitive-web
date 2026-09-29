# @cognnitive/innfo-core

Framework-agnostic TypeScript library shared across the cogNNitive ecosystem. Used by both `innfo-editor` and `innfo-mcp`.

## Features

- **Parser** — unified frontmatter, concept, and matrix parsing for `_NN.md` iNNfo documents
- **Model** — type definitions for Concept, Element, Field, Marker, Matrix, Relationship
- **Validator** — `validateModel`, `validateFormatContent`, `validateFormatSyntax`, and `validateReferences`, validating model instances against template schemas
- **IO Drivers** — drivers for reading and writing iNNfo documents, including a browser driver for the File System Access API
- **Resolver** — resolves the parent chain from level 3 (model) up to level 0 (defiNNe), downloading specs as needed and caching them locally

## API

```typescript
import { parseFrontmatter, validateModel } from '@cognnitive/innfo-core'

// Parse YAML frontmatter from an iNNfo document
const fm = parseFrontmatter(content)
// Returns: { title, level, parent, ... }

// Validate a parsed model against its resolved template and spec chain
const result = validateModel(model, template, formatSpec)
```

## Quarantine Module & Legacy Boundary

All temporary legacy compatibility code is strictly quarantined in `src/legacy/` and tracked 1:1 in `legacy-ledger.yaml`:
- **Subpath Export**: `@cognnitive/innfo-core/legacy` exposes `detectLegacy` and `DomainReader`.
- **Browser Safety**: The `./legacy` browser export is detect-only and free of Node built-ins.
- **Ledger & Markers**: Every quarantined file carries a marker formatted as `legacy:<namespace>/<id>`.
- **Enforcement**: Vitest and CI guards ensure no external module outside the authorized quarantine boundary imports legacy migration code.

## Usage

```bash
# Build the library
npm run build -w @cognnitive/innfo-core

# Run tests
npm run test -w @cognnitive/innfo-core
```

