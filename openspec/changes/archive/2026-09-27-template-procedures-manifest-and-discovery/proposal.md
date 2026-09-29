# Proposal: Template Procedures Manifest Distribution and Dynamic MCP Discovery

## Why

**Issue #90**: `list_template_procedures` in `innfo-mcp` was returning `[]` for templates because:
1. `listTemplates` only inspected top-level `.md` files in scanned directories and missed template package directories (such as `specs/templates/<name>/...`, `templates/<name>/...`, and `~/.agents/templates/<name>/...`).
2. `discoverTransitiveAssets` previously only checked explicit `fm.procedures` frontmatter declarations and did not discover procedure markdown files from the on-disk `procedures/` package subdirectory.
3. `installTemplateAtCommit` in `skills-commands.js` previously downloaded only the individual `.md` file for templates whose path ended in `.md`, dropping the template's accompanying `procedures/`, `assets/`, and `samples/` folders during manifest installation.

## What Changes

- **Template Package Directory Discovery**: Update `listTemplates` to discover templates structured as directories containing `spec_NN.md`, `spec.md`, or `<name>.md`.
- **On-Disk Procedure & Asset Discovery**: Update `discoverTransitiveAssets` to scan on-disk `procedures/*.md` directories adjacent to the spec file or inside the template package directory, extracting procedure identifiers, names, and relative paths dynamically.
- **Full Template Package Installation**: Update `installTemplateAtCommit` in `scripts/lib/skills-commands.js` to extract and install complete template package folders (including `procedures/` and `assets/`) when downloading from GitHub.
- **Resolver Export**: Export `findSpecInPackageDir` from `resolver-node.ts` for unified package spec resolution.

## Capabilities

### Modified Capabilities
- `template-dynamic-discovery`: Discovery of template procedures across on-disk package directories and frontmatter declarations.
- `skills-lifecycle`: Full template package extraction and installation.

## Impact

- `list_template_procedures` returns all procedures shipped with templates (e.g. `video` procedures `generate_anydeo_script_NN.md`, `publish_web_portal_NN.md`, `setup_github_pages_repo_NN.md`).
- Both flat template files and directory-based template packages are discovered and listed consistently.
