# Tasks: Template Procedures Manifest Distribution and Dynamic MCP Discovery

- [x] 1.1 Export `findSpecInPackageDir` from `iNNfo/packages/innfo-mcp/src/tools/resolver-node.ts`.
- [x] 1.2 Update `listTemplates` in `iNNfo/packages/innfo-mcp/src/tools/spec.ts` to discover package directories in `templates/`, `specs/templates/`, and global stores.
- [x] 1.3 Update `discoverTransitiveAssets` in `iNNfo/packages/innfo-mcp/src/tools/spec.ts` to scan on-disk `procedures/` directories for executable SOP procedures.
- [x] 1.4 Update `installTemplateAtCommit` in `scripts/lib/skills-commands.js` to extract and install complete template package directories from GitHub tarballs.
- [x] 1.5 Add tests in `iNNfo/packages/innfo-mcp/src/tools/spec.spec.ts` verifying on-disk procedure discovery and directory template listing.
- [x] 1.6 Validate full test suites across `innfo-mcp` and monorepo integrity checks.
