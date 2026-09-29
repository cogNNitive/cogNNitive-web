# Proposal: Console Export JSON Slot Escaping and Standalone CDN Pinning

## Why

1. **Issue #89**: `scripts/export-console.mjs` in `injectSlots()` injected JSON model payloads via `String.prototype.replace(regex, replacementString)`. When model data contains `$` patterns (`$1`, `$2`, `$&`, `$$`), the JavaScript regex engine interprets them as special replacement patterns rather than literal text. This resulted in corrupted model JSON, injected `<script>` tags, syntax errors on `JSON.parse`, and broken console HTML renders for Level 3 models with currency or regex symbols.
2. **Issue #91**: `export-console.mjs` previously imported `scripts/lib/console-release-info.js`, requiring `yaml-parser.js`, `channel-refs.js`, and `manifest/source.yaml`. This violated the standalone workspace tool contract, making the exporter fail in workspace-only environments lacking the root monorepo repository tree.

## What Changes

- **Function Replacer in Slot Injection**: Update `injectSlots()` to use a replacer function `(_m, open, close) => \`\${open}\\n\${JSON.stringify(json, null, 2)}\\n\${close}\`` and properly accumulate replacements across `innfo-config`, `innfo-schema`, and `innfo-model`.
- **Standalone Exporter CDN Resolution**: Derive the runtime CDN pin directly from the vendored bundle banner in the console assets directory rather than requiring `manifest/source.yaml` and internal helper modules.
- **Full Test Coverage**: Add regression tests verifying verbatim JSON emission with `$` symbols and standalone execution outside the repository root.

## Capabilities

### Modified Capabilities
- `export-console`: Standalone execution contract and literal JSON slot injection without pattern corruption.

## Impact

- Zero external dependencies for `export-console.mjs`.
- Level 3 models containing `$1M`, `$200`, `$&`, or other `$` character sequences export cleanly to valid HTML consoles.
