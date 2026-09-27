# Tasks: Console Export JSON Slot Escaping and Standalone CDN Pinning

- [x] 1.1 Refactor `injectSlots` in `scripts/export-console.mjs` to use functional regex replacers and accumulator chaining.
- [x] 1.2 Remove coupling to `scripts/lib/console-release-info.js`, `yaml-parser.js`, and `manifest/source.yaml`, deriving CDN pins directly from the vendored bundle banner.
- [x] 1.3 Add test coverage in `scripts/export-console.test.mjs` for `$`-sequence payloads and standalone execution.
- [x] 1.4 Validate all tests in `scripts/export-console.test.mjs` and monorepo integrity gates.
