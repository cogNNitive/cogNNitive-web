# Nomenclature Migration Inventory Checklist

Per-file inventory generated for `2026-09-29-nn-level-nomenclature-rename` (Task 7.1).
Search pattern: `specs/templates|~/.agents/templates|INNFO_MODELS_DIR|models/`

## Slice S6a: innfo-core src/
- `iNNfo/packages/innfo-core/src/layout.ts` (new constants module)
- `iNNfo/packages/innfo-core/src/resolver.ts`
- `iNNfo/packages/innfo-core/src/recursiveParser/workspace.ts`
- `iNNfo/packages/innfo-core/src/validator/content.ts`
- `iNNfo/packages/innfo-core/src/serializer.ts`
- `iNNfo/packages/innfo-core/src/types/parser.ts`
- `iNNfo/packages/innfo-core/src/agentModification.ts`
- `iNNfo/packages/innfo-core/src/schema/extract.ts`

## Slice S6b: innfo-mcp src/
- `iNNfo/packages/innfo-mcp/src/server.ts`
- `iNNfo/packages/innfo-mcp/src/resolver-node.ts`
- `iNNfo/packages/innfo-mcp/src/tools/*.ts`
- `iNNfo/packages/innfo-mcp/src/tools/legacy-hint.ts`
- `iNNfo/packages/innfo-mcp/README.md`

## Slice S6c: innfo-editor src/
- `iNNfo/apps/innfo-editor/src/components/FieldModel.vue`
- `iNNfo/apps/innfo-editor/src/config/samples.ts`
- `iNNfo/apps/innfo-editor/src/utils/constants.ts`
- `iNNfo/apps/innfo-editor/src/composables/useLegacyDomain.ts`
- `iNNfo/apps/innfo-editor/src/schemas/feedback.schema.json`

## Slice S7: Path move, manifest, catalog, bluepriNNts/
- `iNNfo/specs/templates/` -> `iNNfo/specs/bluepriNNts/` (directory move)
- `iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md`
- `manifest/source.yaml`
- `scripts/template-catalog.mjs` -> `scripts/blueprint-catalog.mjs`
- `scripts/manifest/{generate-manifest,validate-manifest,check-parity}.js`
- `scripts/guard-template-immutability.js`
- `scripts/sync-versions.mjs`
- `scripts/channel-refs.js`
- `scripts/lib/tag-pin-freshness.js`
- `scripts/build-docs.mjs`

## Slice S8: Preflight, skills-manager, skills
- `skills/nn-preflight/scripts/preflight-check.js`
- `skills/nn-preflight/scripts/upgrade-check.js`
- `scripts/skills-manager.js`
- `scripts/lib/skills-commands.js`
- `skills/nn-innfo/`
- `skills/nn-start/`
- `skills/nn-trannsform/`
- `skills/nn-video-script/`
- `skills/nn-design-presets/`
- `skills/nn-workspace-git/` -> `skills/nn-domain-git/`

## Slice S9a: Core/MCP/Editor test fixtures and simulation journeys
- `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion` (live copy)
- `iNNfo/packages/innfo-core/tests/simulacro-user-workspace.test.ts`
- `iNNfo/packages/innfo-core/tests/roundtrip-fidelity.test.ts`
- `iNNfo/packages/innfo-mcp/test/fixtures/`
- `simulation/fixtures/acme/`
- `simulation/scenarios/06-workspace-manifest.mjs`
- `simulation/run-all.mjs`

## Slice S9b: Dogfood domains
- `workspace_NN/`
- `_samples_nn/`
- `docs/cognitive_nn/use-cases/consulting-sales/`
- `docs/cognitive_nn/use-cases/freelance-designer/`
- `docs/cognitive_nn/use-cases/startup-founder/`
- `docs/cognitive_nn/use-cases/youtube-creator/`
