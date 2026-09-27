# Design: Template Procedures Manifest Distribution and Dynamic MCP Discovery

## Architecture Overview

Template packages in iNNfo can be structured as either single-file specifications (`<name>_spec_NN.md`) or multi-file directory packages (`<name>/spec_NN.md`, `<name>/procedures/*.md`, `<name>/assets/*`, `<name>/samples/*`).

### 1. Template Package Directory Discovery in `listTemplates`

In `iNNfo/packages/innfo-mcp/src/tools/spec.ts`:
`scanDir` now recursively checks child directories for package root specs using `findSpecInPackageDir(pkgDir, dirName)`:
- Detects `spec_NN.md`, `spec.md`, `<name>_NN.md`, and versioned subdirectories.
- Reads `template_version`, `version`, or `spec_version` from frontmatter.
- Adds discovered package entries to the `discovered` template catalog.

### 2. On-Disk Procedure Scanning in `discoverTransitiveAssets`

When discovering procedures:
- Parses `fm.procedures` from the frontmatter if present.
- Discovers on-disk procedures from `join(templateDir, 'procedures')`:
  - Scans all `*.md` files.
  - Derives procedure ID: `id` from frontmatter or normalized kebab-case stem (`_NN` stripped).
  - Derives procedure name: `title` or `name` from frontmatter, or Title Case derived from stem.
  - Stores relative path: `procedures/<filename>.md`.
  - Deduplicates by procedure `id` across the transitive composition tree (depth 10).

### 3. Full Package Extraction in `skills-manager`

In `scripts/lib/skills-commands.js`:
- When installing or updating templates from GitHub tarballs, checks if the template resides in a package directory with `procedures`, `assets`, or `samples`.
- Atomically replaces/copies the entire package directory to `~/.agents/templates/<name>/`.
- Ensures both the package directory and the flat `<name>.md` fallback exist.
