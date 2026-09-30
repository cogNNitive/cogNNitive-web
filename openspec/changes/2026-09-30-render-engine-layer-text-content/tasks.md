# Tasks: Scene compiler reads `layer_text_content` for text layers

## Phase 0: Restore Point

- [x] 0.1 Confirm the dedicated branch `feat/vus-parser-vendoring` holds the
      fix (compiler + test edits are uncommitted on the change worktree).

## Phase 1: Compiler fix

- [x] 1.1 Replace `layer_generation_text` → `layer_text_content` in the three
      overlay factories (`createLowerThirdOverlay`, `createKineticTitleOverlay`,
      `createConceptCalloutOverlay`). `[cognnitive-video-engine:Requirement:Programmatic Remotion Scene Compilation]`
- [x] 1.2 Replace `layer_generation_text` → `layer_text_content` at the three
      overlay call sites (lowerThird / kineticTitle / conceptCallout branches),
      dropping the legacy `text` fallback. `[cognnitive-video-engine:Requirement:Programmatic Remotion Scene Compilation]`

## Phase 2: Tests

- [x] 2.1 Update `video-engine-cli.test.mjs` sample from `layer_generation_text`
      to `layer_text_content`.
- [x] 2.2 Verify `scene-compiler.test.mjs` and `video-engine-cli.test.mjs` green.

## Phase 3: Spec delta + gates

- [ ] 3.1 Delta `openspec/specs/cognnitive-video-engine/spec.md` to require the
      compiler reads `layer_text_content`.
- [ ] 3.2 `npm run lint`, `npm run typecheck`, and the package/skill test suites.
- [ ] 3.3 `node scripts/verify.js` and `node scripts/check-integrity.js` green.
- [ ] 3.4 Lands in the next `skills-v*` tag (maintainer, with the release batch).