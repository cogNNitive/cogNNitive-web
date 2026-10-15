# @cognnitive/innfo-core

Framework-agnostic TypeScript library shared across the cogNNitive ecosystem. Used by `innfo-mcp` and the domain console tooling.

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

## Legacy Ledger

The package has no legacy detection and no `./legacy` subpath export: a domain on a retired layout is replaced by a new domain that imports the old one as a Source. Remaining temporary compatibility code is tracked 1:1 in `legacy-ledger.yaml`:
- **Ledger & Markers**: Every ledgered file carries a marker formatted as `legacy:<namespace>/<id>`.
- **Enforcement**: CI guards (`legacy-ledger-guard`, `legacy-write-guard`) keep markers, ledger entries and retired tokens in step.

## Usage

```bash
# Build the library
npm run build -w @cognnitive/innfo-core

# Run tests
npm run test -w @cognnitive/innfo-core
```

