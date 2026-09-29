# Spec: Console Export JSON Slot Escaping and Standalone CDN Pinning

## Requirements

### R-EXP-01: Verbatim Model JSON Slot Emission
`scripts/export-console.mjs` MUST emit all embedded JSON script slots (`innfo-config`, `innfo-schema`, `innfo-model`) verbatim without interpreting `$` character sequences (`$1`, `$2`, `$&`, `$$`) in model content as capture group replacement patterns.

#### Scenario: Exporting model containing currency and dollar patterns
- GIVEN a Level 3 iNNfo model containing fields with `$1M`, `$250`, or regex dollar characters
- WHEN `export-console.mjs` compiles the model to HTML
- THEN the `innfo-model` script slot in the generated HTML MUST be valid JSON containing the literal `$1M` and `$250` strings
- AND `JSON.parse()` of the slot content MUST succeed without error.

### R-EXP-02: Standalone Exporter Single-File Execution Contract
`scripts/export-console.mjs` MUST be runnable as a standalone CLI script given access only to the model workspace and the vendored console assets (`blueprint.html`, `innfo-console.bundle.js`), without requiring `scripts/lib/*` or `manifest/source.yaml`.

#### Scenario: Running export-console in workspace-only environment
- GIVEN a directory containing only `export-console.mjs`, `blueprint.html`, and `innfo-console.bundle.js`
- WHEN invoked against a valid Level 3 model workspace
- THEN it MUST successfully export the console HTML without throwing module-resolution errors.
